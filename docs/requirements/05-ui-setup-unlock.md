# 05 — UI：Vault Setup & Unlock

## Goal

实现首次初始化与解锁界面（全屏 + Modal），英文文案，Tailwind + lucide-react + motion；无 BiometricSimulator。

## Depends on

- [01-toolchain.md](./01-toolchain.md)
- [03-crypto-webauthn.md](./03-crypto-webauthn.md)
- [04-vault-hooks.md](./04-vault-hooks.md)

## In scope

- `src/components/vault/VaultSetup.tsx`
- `src/components/vault/VaultUnlock.tsx`
- 与 `useVault` 的 `completeSetup` / unlock API 对接

## Out of scope

- Dashboard / Form / Card / Settings（06–07）
- BiometricSimulator（→ backlog）

## Source

- `demo/api-key-safe/src/components/VaultSetup.tsx`
- `demo/api-key-safe/src/components/VaultUnlock.tsx`

## Target

| 文件                                   | 动作                                   |
| -------------------------------------- | -------------------------------------- |
| `src/components/vault/VaultSetup.tsx`  | 新建（可移植布局与逻辑，去 Simulator） |
| `src/components/vault/VaultUnlock.tsx` | 新建                                   |

## Requirements

### VaultSetup

- [ ] 收集：display/owner name、PIN、confirm PIN、可选「Enable biometric」
- [ ] PIN 长度 4–12；两次一致；错误英文提示
- [ ] 生成 `masterKeyHex` + `saltHex`；`deriveKeyFromPin` → `encryptMasterKey` → 组装 `VaultMetadata`
- [ ] 若启用 WebAuthn：调用 `registerWebAuthnCredential`；成功则用 `deriveKeyFromWebAuthnSignatureHex` 加密第二份 master key；失败则英文错误，可回退仅 PIN
- [ ] iframe 或 `!isWebAuthnSupported`：禁用生物识别选项或显示说明「Use PIN instead」
- [ ] 成功后调用 `completeSetup(masterKeyHex, metadata)`（由 hook 写 storage + 空 items）
- [ ] 品牌可见：首屏有 **kbox** 产品名（hero 级，非仅小字 eyebrow）
- [ ] 使用 `motion` 做有节制入场（1–2 处）
- [ ] 图标来自 `lucide-react`

### VaultUnlock

- [ ] 两种呈现：`mode: 'fullscreen' | 'modal'`（prop）
- [ ] PIN 输入解锁；若 `metadata.hasWebAuthn` 显示生物识别按钮
- [ ] 解锁成功调用 hook 的 unlock API（含迁移路径）
- [ ] 错误：错误 PIN / WebAuthn 取消 / 解密失败 → 英文提示
- [ ] Modal：关闭按钮；关闭时取消 pending（调用 hook 清理）
- [ ] 可选：危险操作「Reset vault…」确认后 `resetVault`（也可仅放 Settings；若 Setup/Unlock 有入口需二次确认）
- [ ] **不**引入 BiometricSimulator；iframe 内生物识别不可用时引导 PIN

### Copy (English examples)

- Setup title: e.g. `Set up your vault`
- Unlock: e.g. `Unlock vault` / `Authenticate to continue`
- Errors: `PINs do not match`, `Incorrect PIN`, `Biometrics unavailable — use your PIN`

### Styling

- [ ] Tailwind utility；与 `@theme` 色板一致
- [ ] 桌面与移动可用（表单可滚动、触控友好）
- [ ] 避免卡片堆砌英雄区；Setup/Unlock 为单焦点表单构图

## Acceptance

- [ ] 冷启动无数据 → 只见 Setup → 完成后进入 unlocked（空列表由 Phase 06 承接时可先占位）
- [ ] 错误 PIN 不进入 dashboard；不写坏 metadata
- [ ] Modal unlock 可取消且不泄漏 masterKey
- [ ] 无中文 UI 文案
- [ ] `pnpm build` 通过

## Notes

- Demo Setup 内联了 WebAuthn KEK；kbox 必须调用 `lib/crypto` 统一函数。
- Owner name 主要用于 WebAuthn user.name；可写入 metadata 扩展字段若需要 —— **首版可不持久化 owner name**（demo 亦未写入 VaultMetadata），仅用于注册 WebAuthn。
