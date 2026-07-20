# 02 — Storage & Types：类型、IndexedDB、前缀与迁移

## Goal

建立金库领域类型与本地持久化层；使用 `kbox_*` 命名空间；支持从 demo 的 `apiKeySafe_*` 一次性迁移。

## Depends on

- [01-toolchain.md](./01-toolchain.md)（环境可构建即可；本阶段无 UI 依赖）

## In scope

- `src/types/vault.ts`
- `src/lib/indexedDB.ts`（及常量/legacy 辅助）
- 存储 key 约定与 legacy 迁移读路径

## Out of scope

- 加解密算法实现（见 Phase 03）
- React hooks / UI

## Source

- `demo/api-key-safe/src/types.ts`
- `demo/api-key-safe/src/lib/indexedDB.ts`
- `demo/api-key-safe/src/App.tsx`（加载与 v1/v2 分支逻辑）

## Target

| 文件                               | 动作                           |
| ---------------------------------- | ------------------------------ |
| `src/types/vault.ts`               | 新建                           |
| `src/lib/indexedDB.ts`             | 新建（可含 storage keys 常量） |
| 可选 `src/lib/vaultStorageKeys.ts` | 若常量过多可拆出               |

## Requirements

### Types（`type`，非 `interface`）

- [ ] `KeyEntry`：`id`, `label`, `value`, 可选 `encryptedValue`, `iv`
- [ ] `ApiKeyItem`：`id`, `label`, 可选 `tag`/`description`, `keys: KeyEntry[]`, `createdAt`, `updatedAt`
- [ ] `VaultMetadata`：与 demo 字段对齐（`isInitialized`, `hasWebAuthn`, `webauthnCredentialId?`, `salt`, `pinIv`, `webauthnIv?`, `encryptedMasterKeyWithPin`, `encryptedMasterKeyWithWebAuthn?`）
- [ ] `EncryptedDatabase`：`{ items: ApiKeyItem[] }`（v1 整库解密后结构）
- [ ] `LockBehavior`：`'always' | 'delay-30s' | 'delay-1m' | 'delay-5m' | 'once'`
- [ ] `VaultState`：`'loading' | 'uninitialized' | 'locked' | 'unlocked'`
- [ ] 全部 `export type`；使用 `import type` 消费

### Storage keys（新写入只用 kbox）

| 用途                          | kbox key                       | demo legacy（只读迁移）    |
| ----------------------------- | ------------------------------ | -------------------------- |
| Metadata                      | `kbox_vault_metadata`          | `apiKeySafe_metadata`      |
| v2 items（localStorage 备份） | `kbox_vault_items_v2`          | `apiKeySafe_db_items_v2`   |
| Lock behavior                 | `kbox_vault_lock_behavior`     | `apiKeySafe_lock_behavior` |
| v1 IV                         | `kbox_vault_db_iv`（若仍写入） | `apiKeySafe_db_iv`         |
| v1 ciphertext                 | `kbox_vault_db_ciphertext`     | `apiKeySafe_db_ciphertext` |

- [ ] IndexedDB 库名：`KboxVaultDB`（version 1）
- [ ] Object store：`secure_store`
- [ ] Store 内条目 key：与 v2 items localStorage key 一致（`kbox_vault_items_v2`）

### IndexedDB API

- [ ] `saveEncryptedItemsToDB(items)`：先写 localStorage 备份，再写 IndexedDB；IDB 失败不抛死（已有 backup）
- [ ] `getEncryptedItemsFromDB()`：优先 IndexedDB，空/失败则 fallback localStorage
- [ ] `clearVaultStorage()`（或等价名）：清除 kbox 相关 localStorage keys + IndexedDB 条目；reset 时调用
- [ ] 对 IndexedDB 不可用环境降级到 localStorage，并 `console.warn`

### Legacy migration helpers

- [ ] 提供读取 legacy metadata / v2 items / v1 iv+ciphertext / lock behavior 的函数或在 load 流程中检测
- [ ] 检测到 legacy 数据时：读入 → 写入 kbox keys →（可选）清理 legacy，或保留 legacy 只读直至用户 reset
- [ ] **建议**：迁移成功写入 kbox 后删除对应 `apiKeySafe_*`，避免双源；若删除需在需求勾选中明确并在实现注释说明
- [ ] 新用户从不创建 `apiKeySafe_*`

### Load decision tree（供 Phase 04 实现，本阶段可用纯函数辅助）

1. 读 `kbox_vault_metadata`，若无则尝试 legacy metadata → 写入 kbox
2. 若无任何 metadata → `uninitialized`
3. 若有 metadata：
    - 有 v2 items（IDB 或 LS）→ `unlocked`（view-only，items 为密文结构）
    - 仅有 v1 ciphertext → `locked`（需全屏解锁迁移）
    - 有 metadata 无 items → 初始化空 v2 数组并 `unlocked`

## Acceptance

- [ ] 类型文件可被 TS 编译引用，无 `any`
- [ ] 手动/临时脚本或后续 hook 能：写入空 items 数组 → 刷新后读回相同结构
- [ ] legacy key 映射表在代码常量中集中定义，无魔法字符串散落
- [ ] `clearVaultStorage` 后 metadata 与 items 均不可读

## Notes

- v1→v2 **解密迁移**依赖 master key，业务编排在 Phase 04；本阶段只保证存储读写与 key 命名正确。
- Setup 流程在 demo 仍会写 v1 `db_iv`/`db_ciphertext`；kbox 实现时 **Setup 可直接只写 v2**，不必再写 v1（更干净）。若为兼容测试保留写 v1，须在 04 文档说明。**推荐：Setup 只写 v2。**
