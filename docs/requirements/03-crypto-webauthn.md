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

- [x] `arrayBufferToHex` / `hexToArrayBuffer` / `stringToBuffer` / `bufferToString`
- [x] `generateRandomHex(bytesCount)`
- [x] `deriveKeyFromPin(pin, saltHex)`：PBKDF2，**600_000** iterations，SHA-256，AES-GCM 256
- [x] `encryptMasterKey` / `decryptMasterKey`
- [x] `encryptDatabase` / `decryptDatabase`（对 UTF-8 字符串 payload；v2 中用于单个 key value）
- [x] **`deriveKeyFromWebAuthnPrf(prfOutput)`**：WebAuthn PRF raw bytes → HKDF → AES-GCM KEK（用途绑定）
- [x] 旧 `signatureHex` / UTF-8 SHA-256 路径已移除（与当前 vault 格式不兼容）

### webauthn.ts

- [x] `isWebAuthnSupported()` / `isRunningInIframe()`
- [x] `registerWebAuthnCredential(username)` / `getWebAuthnAssertion(credentialId, prfSaltHex)`
- [x] RP name：`kbox`；`rp.id` 用 `location.hostname`
- [x] Challenge 每次随机（纯客户端，无服务端 attestation；升级见 backlog B3）
- [x] **不**在 lib 层返回 simulator 成功路径；iframe / 不支持时返回 `errorMessage`，由 UI 决定是否启用 DEV sandbox
- [x] 类型使用 `type`；与 `crypto` 的 hex 工具正确 `import`

### vaultItems.ts

- [x] `serializeAndEncryptItems(plainItems, masterKeyHex)`：每个有 `value` 的 entry → `encryptDatabase` → 写 `encryptedValue`+`iv`，`value` 置 `''`
- [x] `decryptItemsInMemory(encryptedItems, masterKeyHex)`：**fail-closed** — 任一密文解密失败则抛错，不写入假明文
- [x] 纯 async 函数，无 React / 无直接 storage 副作用

## Acceptance

- [x] PIN + salt 可加密/解密同一 master key hex
- [x] 同一 PRF 输出两次 `deriveKeyFromWebAuthnPrf` 得到可互换的 KEK
- [x] 明文 items → serialize → decrypt round-trip 后 `value` 一致
- [x] `pnpm build` 类型检查通过
- [x] BiometricSimulator 仅 DEV / 显式 flag（见 `src/lib/biometricSimulator.ts`）

## Security notes (document in code briefly)

- Master key 仅应存在于内存（hooks 层约束）
- WebAuthn 无服务端 attestation；升级见 backlog B3
- BiometricSimulator 固定材料不可用于生产
- 剪贴板 / 屏幕可见明文由 UI 层控制 reveal 生命周期
