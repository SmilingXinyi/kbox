# 00 — Overview：kbox API Key Vault

> **历史主线（Phase 01–08）**。当前产品口径、减法与待确认项见 [10-direction.md](./10-direction.md)。冲突时以 10-direction 与代码为准（PIN **6–12**；无独立 `locked` 状态）。

## Goal

将 `demo/api-key-safe` 迁移为 **kbox 主应用**（路由 `/`）：浏览器内端到端加密的 API Key 保险箱。**无 kbox 服务端**；主密钥仅在内存中，锁定后清除。数据移动（WebRTC / Drive / 恢复文件）是后来加上的可选能力，见 10-direction。

## Product summary

| 能力         | 说明                                                                  |
| ------------ | --------------------------------------------------------------------- |
| 金库初始化   | Owner 名、PIN（6–12 位）、可选 WebAuthn                               |
| 解锁         | PIN 或 WebAuthn；按需 Modal（历史文档中的全屏 `locked` 迁移已不使用） |
| API Key CRUD | label（唯一）、tag、description、多行 secret（AK/SK 等）              |
| 搜索 / 筛选  | 按 label / tag / description 搜索；解锁后可搜 secret；按 tag 筛选     |
| View-only    | 已初始化且无 `masterKey` 时可浏览元数据；reveal/copy/edit 需先解锁    |
| 自动锁定     | always / 30s / 1m / 5m / 仅手动                                       |
| 重置         | 清除本机金库数据，回到 Setup                                          |

## Architecture

```text
HomePage
  └── useVault (+ useAutoLock)
        ├── lib/vaultItems.ts
        ├── lib/crypto.ts
        ├── lib/indexedDB.ts
        └── lib/webauthn.ts
VaultSetup / VaultUnlock ──► crypto + webauthn
ApiKeyForm / ApiKeyCard / VaultSettings ──► 纯 UI + 回调
```

### Vault state machine

```text
loading
  ├─► uninitialized   （无 metadata）
  └─► unlocked        （有 v2 数据；masterKey 可为 null = view-only）

uninitialized ──Setup──► unlocked (masterKey in memory)
unlocked ──lock──► unlocked (masterKey=null，view-only)
unlocked ──reset──► uninitialized
```

（Phase 02 曾规划 `locked` 给 v1 全屏迁移；现网 Setup 只写 v2，类型里已无 `locked`。）

### Key hierarchy

```text
PIN ──PBKDF2(600k, SHA-256, salt)──► KEK_pin ──AES-GCM──► encryptedMasterKeyWithPin
WebAuthn PRF ──HKDF──► KEK_webauthn ──AES-GCM──► encryptedMasterKeyWithWebAuthn
Master Key (32-byte hex) ──AES-GCM──► 每个 KeyEntry.value（v2 逐字段）
```

> BiometricSimulator（固定材料）仅 `import.meta.env.DEV` 或 `VITE_ENABLE_BIOMETRIC_SIMULATOR=true` 可用；生产默认关闭。

## Confirmed decisions

| 决策               | 结论                                          |
| ------------------ | --------------------------------------------- |
| 产品定位           | `/` 即金库主应用；**无服务端**，可选数据移动  |
| UI 依赖            | Tailwind v4 + `lucide-react` + `motion`       |
| 文案               | UI 与代码注释英文；需求文档可用中文           |
| 初始化数据         | 空列表 + 空状态引导；**不**写入假密钥 starter |
| BiometricSimulator | 已实现，仅 DEV / 显式 flag（见 10-direction） |
| PWA                | 已实现，保留                                  |
| demo 目录          | **不修改** `demo/`                            |
| 包管理             | 仅 pnpm                                       |
| Commit             | 仅用户明确要求时再提交                        |
| 后续减法           | [10-direction.md](./10-direction.md)          |

## Target layout

```text
src/
├── types/vault.ts
├── lib/
│   ├── crypto.ts
│   ├── indexedDB.ts
│   ├── webauthn.ts
│   └── vaultItems.ts
├── hooks/
│   ├── useVault.ts
│   └── useAutoLock.ts
├── components/vault/
│   ├── VaultSetup.tsx
│   ├── VaultUnlock.tsx
│   ├── ApiKeyForm.tsx
│   ├── ApiKeyCard.tsx
│   └── VaultSettings.tsx
├── pages/HomePage.tsx
├── App.tsx
├── router.tsx
└── index.css
```

## Phase map

| Phase | File                                                 | Summary                         |
| ----- | ---------------------------------------------------- | ------------------------------- |
| 01    | [01-toolchain.md](./01-toolchain.md)                 | 依赖、Vite、Tailwind、AGENTS    |
| 02    | [02-storage-types.md](./02-storage-types.md)         | 类型、IndexedDB、key 前缀、迁移 |
| 03    | [03-crypto-webauthn.md](./03-crypto-webauthn.md)     | 加密、WebAuthn、vaultItems      |
| 04    | [04-vault-hooks.md](./04-vault-hooks.md)             | useVault / useAutoLock          |
| 05    | [05-ui-setup-unlock.md](./05-ui-setup-unlock.md)     | Setup / Unlock UI               |
| 06    | [06-ui-dashboard-crud.md](./06-ui-dashboard-crud.md) | Dashboard、CRUD、搜索           |
| 07    | [07-settings-autolock.md](./07-settings-autolock.md) | Settings、自动锁定 UX           |
| 08    | [08-polish-qa.md](./08-polish-qa.md)                 | 打磨、lint/build                |
| 99    | [99-backlog.md](./99-backlog.md)                     | 后续项（不阻塞主线）            |
| 10    | [10-direction.md](./10-direction.md)                 | 当前口径与减法（2026-09）       |

总勾选表：[CHECKLIST.md](./CHECKLIST.md)

## Dependencies between phases

```text
01 → 02 → 03 → 04 → 05
                 └→ 06 → 07 → 08
```

05 与 06 可在 04 完成后部分并行；07 依赖 06 的 Settings 入口。

## Constraints

- TypeScript strict + `import type`；优先 `type`，避免 `any`
- 默认不加 `useMemo` / `useCallback`（React Compiler）
- 组件不直接碰 IndexedDB；数据经 hooks / lib
- 错误不吞掉：加解密失败要可观察（UI 英文提示或向上抛）
- 不引入未列依赖；主线无后端

## Out of scope (mainline)

历史主线曾把 PWA / Simulator / 备份放进 backlog，后来都已做。当前「明确不做」与待确认见 [10-direction.md](./10-direction.md) 与 [99-backlog.md](./99-backlog.md)。

## Source of truth

- 需求：本目录 `docs/requirements/*`（产品口径以 [10-direction.md](./10-direction.md) 为准）
- 参考实现：`demo/api-key-safe/src/**`（只读）
- 项目规范：`AGENTS.md`（Phase 01 会更新样式节）
