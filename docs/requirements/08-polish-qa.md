# 08 — Polish & QA

## Goal

主线功能打磨与质量门禁：文案、空状态、响应式、无障碍基础、lint/build；勾完总清单主线项。

## Depends on

- Phase 01–07 代码已合并可运行

## In scope

- 文案与视觉一致性检查
- 响应式与基础 a11y
- `pnpm lint` / `pnpm build`
- 更新 [CHECKLIST.md](./CHECKLIST.md) 勾选状态
- 确认无假密钥、无中文 UI、无 Simulator、无半套 PWA

## Out of scope

- Backlog 功能实现
- E2E 测试框架引入（可列 backlog）
- 改 `demo/`

## Requirements

### Copy & i18n

- [ ] 所有用户可见字符串为英文
- [ ] 错误 / 空状态 / 按钮 / aria-label 抽查无中文、无 lorem
- [ ] 品牌名统一 `kbox`

### UX polish

- [ ] Loading / empty / error 三态齐全
- [ ] 应用内至少 2–3 处有意 `motion`（Setup 入场、Modal、列表等），无过量动画
- [ ] 移动宽度（~375px）与桌面（~1280px）主流程可用
- [ ] Focus：Modal 打开时焦点合理；Esc 关闭 Modal（Form / Settings / Unlock modal）—— 能做则做，至少按钮可关

### Security hygiene

- [ ] 初始化不写入假 AK/SK
- [ ] `masterKey` 不写入 localStorage / IndexedDB
- [ ] Reveal 后 lock 会清除 revealed 状态
- [ ] 控制台无意外打印明文密钥（避免 `console.log(item)`）

### Code quality

- [ ] `import type` / 无 `any`（必要时 `unknown` 收窄）
- [ ] 无未使用的 demo import（motion/lucide 按需）
- [ ] 默认无多余 `useMemo`/`useCallback`
- [ ] Prettier 格式符合项目（4 spaces 等）

### Verify commands

- [ ] `pnpm lint` 通过
- [ ] `pnpm build` 通过
- [ ] 手动冒烟（见下）

### Manual smoke checklist

- [ ] 首次访问 → Setup → 空 Dashboard
- [ ] Add 多行 key → Reveal / Copy / Edit / Delete
- [ ] Lock → view-only → Modal unlock → Reveal 恢复
- [ ] 改 auto-lock → 验证触发
- [ ] Reset → Setup
- [ ] （可选）同域若残留 `apiKeySafe_*`，迁移到 `kbox_*` 后仍可解锁

## Acceptance

- [ ] 上述命令与冒烟全部通过
- [ ] [CHECKLIST.md](./CHECKLIST.md) 主线（01–08）全部勾选
- [ ] `99-backlog.md` 仍仅文档、未误当作已交付

## Deliverable note

本阶段完成后，主线迁移 **可视为功能完成**。PWA / Simulator / 测试等需用户从 backlog 开新阶段。
