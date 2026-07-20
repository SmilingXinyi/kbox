# 06 — UI：Dashboard、CRUD、搜索与按需解锁

## Goal

实现金库主界面：列表、搜索筛选、新增/编辑表单、卡片展示（reveal/copy/edit/delete），以及按需解锁串联。

## Depends on

- [04-vault-hooks.md](./04-vault-hooks.md)
- [05-ui-setup-unlock.md](./05-ui-setup-unlock.md)（Unlock modal）

## In scope

- `src/pages/HomePage.tsx`（dashboard 组装；按 `vaultState` 切换 Setup / Unlock / Dashboard）
- `src/components/vault/ApiKeyForm.tsx`
- `src/components/vault/ApiKeyCard.tsx`
- `src/App.tsx` 壳层品牌（若顶栏放在 App 或 HomePage，二选一写清）
- `src/router.tsx` 仍 `index → HomePage`

## Out of scope

- Settings 面板细节（Phase 07，可先放 Settings 按钮占位）
- PWA 更新条

## Source

- `demo/api-key-safe/src/App.tsx`（dashboard JSX、filter、modal 编排）
- `demo/api-key-safe/src/components/ApiKeyForm.tsx`
- `demo/api-key-safe/src/components/ApiKeyCard.tsx`

## Target

| 文件                                  | 动作                   |
| ------------------------------------- | ---------------------- |
| `src/pages/HomePage.tsx`              | 重写为 Vault 主页面    |
| `src/components/vault/ApiKeyForm.tsx` | 新建                   |
| `src/components/vault/ApiKeyCard.tsx` | 新建                   |
| `src/App.tsx`                         | 可选轻量壳；勿塞满业务 |

## Requirements

### HomePage routing by state

- [ ] `loading`：简洁 loading（英文，如 `Loading vault…`）
- [ ] `uninitialized`：`<VaultSetup />`
- [ ] `locked`：全屏 `<VaultUnlock mode="fullscreen" />`
- [ ] `unlocked`：Dashboard
- [ ] `showUnlockModal`：`<VaultUnlock mode="modal" />`

### Dashboard chrome

- [ ] 品牌 **kbox** 在首屏显著可见
- [ ] 操作：Add key、Lock（当有 masterKey）、Settings（Phase 07 接线）
- [ ] View-only 时显示锁定态提示（如 `Vault is locked — authenticate to reveal secrets`）
- [ ] `motion`：列表/空状态有节制动画（合计应用内 2–3 处有意动效即可）

### Search & filter

- [ ] 搜索：匹配 label、tag、description；若已解密也可匹配 key value（未解密则跳过 value）
- [ ] Tag 筛选：`All` + 从 items 收集的 tag；无 tag 项仍可在 All 下显示
- [ ] 无匹配时英文 empty filter 状态

### ApiKeyForm

- [ ] 新增 / 编辑共用；字段：label\*、tag、description、动态 keys（label + value），至少一行
- [ ] label 唯一（相对其他 items）；校验英文错误
- [ ] 编辑时：无 masterKey 应先走 unlock（由页面在打开编辑前 `request` 或检查）
- [ ] Submit → `addItem` / `updateItem`；Cancel 关闭
- [ ] Modal 或面板呈现；Tailwind；lucide 图标

### ApiKeyCard

- [ ] 展示 label、tag、description、各 key 行
- [ ] 默认掩码 value（如 `••••` + 末几位仅在已 reveal 且有明文时）
- [ ] Reveal / Hide、Copy、Edit、Delete
- [ ] Copy/Reveal 走 hook `requestCopy` / `requestReveal`
- [ ] Delete 需确认（英文 confirm）
- [ ] 无 masterKey 时 Edit/Delete 触发解锁或提示

### Empty state

- [ ] 无 items：引导 `Add your first API key`（**不**自动插入假 Gemini 密钥）

### App / Router

- [ ] `router.tsx`：`index` → `HomePage`；`*` → `NotFoundPage` 保留
- [ ] 不新增子路由（Settings 同页）

## Acceptance

- [ ] 完整路径：Setup → 空 Dashboard → Add → 列表显示 → Reveal（先解锁若需要）→ Copy → Edit → Delete → Lock → 再 Unlock
- [ ] 刷新后 view-only：可见 label/tag，不可见明文；Reveal 弹出 Modal unlock
- [ ] 搜索与 tag 筛选行为正确
- [ ] UI 全英文
- [ ] `pnpm lint` / `pnpm build` 可通过（允许 Settings 未完成时按钮先打开空面板或 noop，但需在 07 补齐）

## Visual direction

- 单页仪表构图，非营销 landing；但仍需品牌信号
- 少卡片套卡片；列表项可用轻微分隔，避免阴影堆叠
- 色板跟 Phase 01 `@theme`
