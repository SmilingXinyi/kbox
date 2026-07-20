# 07 — Settings & Auto-lock UX

## Goal

实现设置面板：自动锁定策略、危险区重置；与 `useAutoLock` / `lockBehavior` 完整接通。

## Depends on

- [04-vault-hooks.md](./04-vault-hooks.md)
- [06-ui-dashboard-crud.md](./06-ui-dashboard-crud.md)

## In scope

- `src/components/vault/VaultSettings.tsx`
- Dashboard Settings 入口与面板开闭
- lock behavior 持久化与文案

## Out of scope

- PWA「有更新」条与 `swRegistration`（→ backlog；**不要**复制 demo 中无效的 SW UI 半套）
- 账户系统 / 云同步

## Source

- `demo/api-key-safe/src/components/VaultSettings.tsx`
- `demo/api-key-safe/src/App.tsx`（settings open state、lockBehavior）

## Target

| 文件                                     | 动作 |
| ---------------------------------------- | ---- |
| `src/components/vault/VaultSettings.tsx` | 新建 |

## Requirements

### VaultSettings panel

- [ ] 以 Modal 或侧滑面板打开；可关闭
- [ ] 区块 **Auto-lock**：
    - 选项：`always` | `delay-30s` | `delay-1m` | `delay-5m` | `once`
    - 英文标签示例：
        - Always (lock after short idle)
        - 30 seconds
        - 1 minute
        - 5 minutes
        - Only manually
    - 变更立即 `setLockBehavior` 并持久化 `kbox_vault_lock_behavior`
- [ ] 区块 **Danger zone**：
    - Reset vault：二次确认（输入确认词或 Confirm 对话框）
    - 确认后 `resetVault()` → 回到 Setup
- [ ] 可选：显示 vault 是否启用 WebAuthn（只读）
- [ ] lucide 图标；轻微 motion 即可

### Integration

- [ ] HomePage（或壳层）Settings 按钮打开本面板
- [ ] `useAutoLock` 已在 Phase 04 实现；本阶段验证 UI 改选项后行为变化
- [ ] 无 masterKey（view-only）时仍可打开 Settings 改 lock behavior / reset（与 demo 一致：reset 可用）

### Copy

- [ ] 全英文；无 demo 残留中文（demo Settings 中有中文 toast/文案须替换）

## Acceptance

- [ ] 选择 `delay-30s`，解锁后静置 ≥30s → 自动 lock（`masterKey` 清除）
- [ ] 选择 `once`，长时间空闲不自动 lock
- [ ] 刷新后 lock behavior 保持
- [ ] Reset 后 storage 空，进入 Setup；旧 items 不可恢复
- [ ] 无 PWA 更新按钮（除非已实现 backlog PWA）
- [ ] `pnpm build` 通过

## Notes

- Demo「立即锁定」映射为 `always`（短空闲）；若产品要「离开页面立即锁」，可另加 backlog。
- Reset 确认文案建议明确：`This permanently deletes all encrypted keys on this device.`
