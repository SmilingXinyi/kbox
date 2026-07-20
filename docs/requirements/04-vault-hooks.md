# 04 — Vault Hooks：状态机、CRUD、自动锁定

## Goal

把 demo `App.tsx` 中的业务编排抽成可测试的 hooks：`useVault` + `useAutoLock`，供页面与 UI 组件消费。

## Depends on

- [02-storage-types.md](./02-storage-types.md)
- [03-crypto-webauthn.md](./03-crypto-webauthn.md)

## In scope

- `src/hooks/useVault.ts`
- `src/hooks/useAutoLock.ts`
- （可选）小范围类型：`PendingSensitiveAction` 等放 `types/vault.ts` 或 hooks 旁

## Out of scope

- 具体 JSX / Tailwind 布局（Phase 05–07）
- PWA Service Worker 注册

## Source

- `demo/api-key-safe/src/App.tsx`（状态、load、CRUD、lock、reset、pending action、auto-lock effect）

## Target

| 文件                       | 动作 |
| -------------------------- | ---- |
| `src/hooks/useVault.ts`    | 新建 |
| `src/hooks/useAutoLock.ts` | 新建 |

## Requirements

### useVault — state

- [ ] `vaultState: VaultState`
- [ ] `metadata: VaultMetadata | null`
- [ ] `masterKey: string | null`（仅内存）
- [ ] `items: ApiKeyItem[]`（解锁后为明文 values；锁定/view-only 时为密文结构或空 value）
- [ ] `error: string | null`（英文；用户可读）
- [ ] UI 辅助状态可由 hook 或页面持有，优先 hook 内聚敏感相关：
    - `revealedKeys: Record<string, boolean>`
    - `pendingAction: { type: 'reveal' | 'copy'; itemId: string; keyId: string } | null`
    - `showUnlockModal: boolean`

### useVault — lifecycle

- [ ] Mount 时按 Phase 02 决策树加载；legacy → kbox 迁移
- [ ] `initializeVault` 完成后由 Setup 回调写入 metadata + 空/初始 items（**无假密钥**）
- [ ] `unlockWithPin` / 完成 WebAuthn 后得到 masterKey 的路径：
    - 全屏迁移：若存在 v1 ciphertext → 解密 → serialize v2 → 存 IDB → 设明文 items
    - 按需：解密当前 IDB items → 执行 pending reveal/copy
- [ ] `lock()`：`masterKey=null`，清空 revealed；从 IDB 重载加密 items
- [ ] `resetVault()`：清 storage + 状态回到 `uninitialized`

### useVault — CRUD

- [ ] `addItem` / `updateItem` / `deleteItem`：要求 `masterKey` 存在，否则打开 unlock modal 或返回错误
- [ ] 持久化：明文变更后 `serializeAndEncryptItems` → `saveEncryptedItemsToDB`；内存保持明文以便编辑
- [ ] label 唯一性校验（可与 Form 双重校验；hook 侧也应拒绝重复）

### useVault — sensitive actions

- [ ] `requestReveal(itemId, keyId)` / `requestCopy(itemId, keyId)`：无 masterKey 则设 pending + `showUnlockModal=true`
- [ ] 解锁成功后自动完成 pending，然后清空 pending
- [ ] copy 使用 `navigator.clipboard.writeText`；失败时设 `error`

### useVault — API shape（建议）

对外至少暴露：

```ts
{
    vaultState,
        metadata,
        items,
        masterKey,
        error,
        isViewOnly, // unlocked && !masterKey
        showUnlockModal,
        setShowUnlockModal,
        revealedKeys,
        lockBehavior,
        setLockBehavior,
        completeSetup, // (masterKeyHex, meta) => Promise<void>
        unlockWithMasterKey, // 由 Unlock UI 在推导出 key 后调用
        lock,
        resetVault,
        addItem,
        updateItem,
        deleteItem,
        requestReveal,
        requestCopy,
        hideRevealedKey,
        clearError;
}
```

PIN/WebAuthn 具体 UI 交互可留在组件，组件调用 crypto/webauthn 后把 `masterKeyHex` 交给 hook；**或** hook 提供 `unlockWithPin(pin)` / `unlockWithWebAuthn()`。二选一写进实现并保持单一路径。**推荐：hook 提供 `unlockWithPin` / `unlockWithWebAuthn`，组件只收集输入。**

### useAutoLock

- [ ] 入参：`enabled`（如 `vaultState==='unlocked' && !!masterKey`）、`lockBehavior`、`onLock`
- [ ] 行为对齐 demo：
    - `once`：不因空闲锁定
    - `always`：空闲约 5s
    - `delay-30s` / `delay-1m` / `delay-5m`：对应毫秒
    - 监听 `mousedown` / `keydown` / `touchstart` / `scroll` 重置计时
    - `visibilitychange`：切到后台再回前台时，若已超过对应阈值则 lock
- [ ] `lockBehavior` 变更时写入 `kbox_vault_lock_behavior`
- [ ] 清理 timers / listeners（effect cleanup）

### Errors

- [ ] 解密失败、剪贴板失败、存储失败：设置英文 `error` 或 throw 并由调用方 setError
- [ ] 禁止空 `catch` 吞掉异常

## Acceptance

- [ ] 无 UI 时可用最小测试页或后续页面验证：setup → add → lock → unlock → delete → reset
- [ ] view-only 打开应用：items 无明文 value；reveal 弹出 unlock 需求（由 UI 接 showUnlockModal）
- [ ] 自动锁定在 `delay-1m` 下空闲后 `masterKey` 变 null
- [ ] 默认不加 `useMemo`/`useCallback`
- [ ] `pnpm build` 通过

## Notes

- `useVault` 体积可能较大，可按 `load` / `mutations` 拆内部模块，但对外一个 hook 入口。
- Setup 组件若自行写 localStorage metadata，须与 hook 的 `completeSetup` 约定单一写入点，避免双写竞态。**推荐：Setup 只负责收集 PIN/WebAuthn 并生成 meta+key，最后调用 `completeSetup`。**
