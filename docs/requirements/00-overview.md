# 00 — Overview：kbox API Key Vault

## Goal

将 `demo/api-key-safe` 迁移为 **kbox 主应用**（路由 `/`）：本地浏览器内的端到端加密 API Key 钱包。数据不出本地；主密钥仅在内存中，锁定后清除。

## Product summary

| 能力         | 说明                                                               |
| ------------ | ------------------------------------------------------------------ |
| 金库初始化   | Owner 名、PIN（4–12 位）、可选 WebAuthn                            |
| 解锁         | PIN 或 WebAuthn；支持全屏（迁移）与按需 Modal                      |
| API Key CRUD | label（唯一）、tag、description、多行 secret（AK/SK 等）           |
| 搜索 / 筛选  | 按 label / tag / description / key 值搜索；按 tag 筛选             |
| View-only    | 已初始化且无 `masterKey` 时可浏览元数据；reveal/copy/edit 需先解锁 |
| 自动锁定     | always / 30s / 1m / 5m / 仅手动                                    |
| 重置         | 清除全部本地加密数据，回到 Setup                                   |

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
  ├─► locked          （有 metadata + 待 v1 迁移）
  └─► unlocked        （有 v2 数据；masterKey 可为 null = view-only）

uninitialized ──Setup──► unlocked (masterKey in memory)
locked ──Unlock──► unlocked (migrate v1→v2)
unlocked ──lock──► unlocked (masterKey=null) 或保持 view-only
unlocked ──reset──► uninitialized
```

### Key hierarchy

```text
PIN ──PBKDF2(100k, SHA-256, salt)──► KEK_pin ──AES-GCM──► encryptedMasterKeyWithPin
WebAuthn signatureHex ──UTF-8 SHA-256──► KEK_webauthn ──AES-GCM──► encryptedMasterKeyWithWebAuthn
Master Key (32-byte hex) ──AES-GCM──► 每个 KeyEntry.value（v2 逐字段）
```

## Confirmed decisions

| 决策               | 结论                                          |
| ------------------ | --------------------------------------------- |
| 产品定位           | `/` 即金库主应用（替换 Home 占位）            |
| UI 依赖            | Tailwind v4 + `lucide-react` + `motion`       |
| 文案               | UI 与代码注释英文；需求文档可用中文           |
| 初始化数据         | 空列表 + 空状态引导；**不**写入假密钥 starter |
| BiometricSimulator | 主线不做 → 见 `99-backlog.md`                 |
| PWA                | 主线不做 → 见 `99-backlog.md`                 |
| demo 目录          | **不修改** `demo/`                            |
| 包管理             | 仅 pnpm                                       |
| Commit             | 仅用户明确要求时再提交                        |

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

见 [99-backlog.md](./99-backlog.md)：PWA、BiometricSimulator、RP 服务端、子路由拆分、单元测试、加密备份导入导出。

## Source of truth

- 需求：本目录 `docs/requirements/*`
- 参考实现：`demo/api-key-safe/src/**`（只读）
- 项目规范：`AGENTS.md`（Phase 01 会更新样式节）
