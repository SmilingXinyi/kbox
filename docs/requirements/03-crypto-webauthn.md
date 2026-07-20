# 03 — Crypto & WebAuthn：加密、断言、条目加解密

## Goal

迁入并整理 Web Crypto / WebAuthn 工具层；统一 WebAuthn KEK 推导；提供 v2 条目级加解密纯函数。

## Depends on

- [02-storage-types.md](./02-storage-types.md)（`ApiKeyItem` / `KeyEntry` 类型）

## In scope

- `src/lib/crypto.ts`
- `src/lib/webauthn.ts`
- `src/lib/vaultItems.ts`

## Out of scope

- BiometricSimulator 组件（→ backlog）
- React UI / hooks 编排

## Source

- `demo/api-key-safe/src/lib/crypto.ts`
- `demo/api-key-safe/src/lib/webauthn.ts`
- `demo/api-key-safe/src/App.tsx`（`serializeAndEncryptItems` / `decryptItemsInMemory`）
- `demo/api-key-safe/src/components/VaultSetup.tsx` / `VaultUnlock.tsx`（`importWebAuthnKeyFromHex` 实际路径）

## Target

| 文件                    | 动作                                           |
| ----------------------- | ---------------------------------------------- |
| `src/lib/crypto.ts`     | 复制 + 统一 WebAuthn KEK API                   |
| `src/lib/webauthn.ts`   | 复制 + 去 simulator 分支依赖；RP 名称改为 kbox |
| `src/lib/vaultItems.ts` | 从 App 抽出加解密编排                          |

## Requirements

### crypto.ts

- [ ] `arrayBufferToHex` / `hexToArrayBuffer` / `stringToBuffer` / `bufferToString`
- [ ] `generateRandomHex(bytesCount)`
- [ ] `deriveKeyFromPin(pin, saltHex)`：PBKDF2，100000 iterations，SHA-256，AES-GCM 256
- [ ] `encryptMasterKey` / `decryptMasterKey`
- [ ] `encryptDatabase` / `decryptDatabase`（对 UTF-8 字符串 payload；v2 中用于单个 key value）
- [ ] **`deriveKeyFromWebAuthnSignatureHex(signatureHex: string)`**：对 **hex 字符串的 UTF-8 字节** 做 SHA-256，再 import 为 AES-GCM key —— **与 demo 组件现网行为一致**，保证同域旧 vault 可解
- [ ] 删除或标记废弃未使用的「对 raw signature ArrayBuffer 哈希」路径；若保留 `deriveKeyFromWebAuthnSignature(buffer)`，须在注释中说明 **不用于当前 vault 格式**
- [ ] 组件内不得再复制一份 `importWebAuthnKeyFromHex`

### webauthn.ts

- [ ] `isWebAuthnSupported()` / `isRunningInIframe()`
- [ ] `registerWebAuthnCredential(username)` / `assertWebAuthnCredential(credentialId)`
- [ ] RP name：`kbox`（或 `Kbox Vault`）；`rp.id` 仍用 `location.hostname`
- [ ] 静态 `STATIC_CHALLENGE` 可暂时保留（纯客户端可复现签名）；英文注释标明：**无服务端验证，非标准生产 WebAuthn 流程**
- [ ] **不**返回依赖 BiometricSimulator 的成功路径；不支持或 iframe 时返回明确 `errorMessage`，`signatureHex` 为空，由 UI 引导 PIN
- [ ] 类型改为 `type`（若原先 `interface`）；与 `crypto` 的 hex 工具正确 `import`

### vaultItems.ts

- [ ] `serializeAndEncryptItems(plainItems, masterKeyHex)`：每个有 `value` 的 entry → `encryptDatabase` → 写 `encryptedValue`+`iv`，`value` 置 `''`
- [ ] `decryptItemsInMemory(encryptedItems, masterKeyHex)`：有密文则解密填 `value`；失败时该 entry 标记可读错误（如 `value: 'Decryption Error'`）并 `console.error`，不中断整表
- [ ] 纯 async 函数，无 React / 无直接 storage 副作用

## Acceptance

- [ ] PIN + salt 可加密/解密同一 master key hex
- [ ] 同一 `signatureHex` 两次 `deriveKeyFromWebAuthnSignatureHex` 得到可互换的 KEK（能解同一密文）
- [ ] 明文 items → serialize → decrypt round-trip 后 `value` 一致
- [ ] `pnpm build` 类型检查通过
- [ ] 无 BiometricSimulator import

## Security notes (document in code briefly)

- Master key 仅应存在于内存（hooks 层约束）
- WebAuthn 静态 challenge 仅适合本地 demo 级 vault；升级见 backlog
- 剪贴板 / 屏幕可见明文由 UI 层控制 reveal 生命周期
