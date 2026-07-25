# CHECKLIST — kbox Vault 主线总表

> 开发时按阶段勾选。细节见各阶段文件。Backlog 见 [99-backlog.md](./99-backlog.md)。

**图例**：`[ ]` 未做 · `[x]` 完成 · `[~]` 进行中

---

## Docs

- [x] [00-overview.md](./00-overview.md)
- [x] [01-toolchain.md](./01-toolchain.md)
- [x] [02-storage-types.md](./02-storage-types.md)
- [x] [03-crypto-webauthn.md](./03-crypto-webauthn.md)
- [x] [04-vault-hooks.md](./04-vault-hooks.md)
- [x] [05-ui-setup-unlock.md](./05-ui-setup-unlock.md)
- [x] [06-ui-dashboard-crud.md](./06-ui-dashboard-crud.md)
- [x] [07-settings-autolock.md](./07-settings-autolock.md)
- [x] [08-polish-qa.md](./08-polish-qa.md)
- [x] [99-backlog.md](./99-backlog.md)

---

## Phase 01 — Toolchain

- [x] 安装 `lucide-react` / `motion` / `@tailwindcss/vite` / `tailwindcss`
- [x] `vite.config.ts` 接入 Tailwind
- [x] `src/index.css`：`@import "tailwindcss"` + `@theme`
- [x] 更新 `AGENTS.md` 样式约定
- [x] `pnpm build` 通过

详见 [01-toolchain.md](./01-toolchain.md)

---

## Phase 02 — Storage & Types

- [x] `src/types/vault.ts`
- [x] `src/lib/indexedDB.ts` + `kbox_*` keys
- [x] Legacy `apiKeySafe_*` 迁移读路径
- [x] clear / save / get 验收

详见 [02-storage-types.md](./02-storage-types.md)

---

## Phase 03 — Crypto & WebAuthn

- [x] `src/lib/crypto.ts`（含统一 `deriveKeyFromWebAuthnSignatureHex`）
- [x] `src/lib/webauthn.ts`（无 Simulator）
- [x] `src/lib/vaultItems.ts` round-trip

详见 [03-crypto-webauthn.md](./03-crypto-webauthn.md)

---

## Phase 04 — Hooks

- [x] `useVault` 状态机 + CRUD + pending unlock
- [x] `useAutoLock`
- [x] Setup 只写 v2；无假密钥

详见 [04-vault-hooks.md](./04-vault-hooks.md)

---

## Phase 05 — Setup / Unlock UI

- [x] `VaultSetup.tsx`
- [x] `VaultUnlock.tsx`（fullscreen + modal）
- [x] 英文文案；品牌 kbox

详见 [05-ui-setup-unlock.md](./05-ui-setup-unlock.md)

---

## Phase 06 — Dashboard / CRUD

- [x] `HomePage.tsx` 按 vaultState 组装
- [x] `ApiKeyForm.tsx` / `ApiKeyCard.tsx`
- [x] 搜索 / tag 筛选 / 空状态
- [x] 按需解锁串联

详见 [06-ui-dashboard-crud.md](./06-ui-dashboard-crud.md)

---

## Phase 07 — Settings

- [x] `VaultSettings.tsx`
- [x] lock behavior 持久化 + 行为验证
- [x] Reset 二次确认

详见 [07-settings-autolock.md](./07-settings-autolock.md)

---

## Phase 08 — Polish & QA

- [x] 文案 / 响应式 / 安全卫生检查
- [x] `pnpm lint`
- [x] `pnpm build`
- [x] 手动冒烟全通过（Chrome DevTools，2026-07-14）

详见 [08-polish-qa.md](./08-polish-qa.md)

---

## Backlog（不阻塞）

- [x] B1 PWA（manifest + SW + `usePWA` 更新提示；见 `4894d96`）
- [x] B2 BiometricSimulator（仅 DEV / `VITE_ENABLE_BIOMETRIC_SIMULATOR`）
- [ ] B3 WebAuthn RP / 服务端 challenge
- [ ] B4 子路由
- [ ] B5 单元测试（crypto / vaultItems）
- [ ] B6 加密备份
- [ ] B7 启动强制解锁选项
- [ ] B8 Owner name 持久化
- [x] B9 E2E 冒烟（Cypress component + `pnpm test:dual-sync` Playwright）

详见 [99-backlog.md](./99-backlog.md)

---

## Sign-off

| 项                   | 状态                                        |
| -------------------- | ------------------------------------------- |
| 主线 Phase 01–08     | 完成（含 Chrome DevTools 冒烟，2026-07-14） |
| 可发布本地 vault MVP | 是                                          |

完成手动冒烟后将上表更新为完成，并注明日期。
