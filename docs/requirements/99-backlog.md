# 99 — Backlog：后续项（不阻塞主线）

> 这些能力来自 demo 或后续增强。主线 Phase 01–08 **不实现**。每条保留动机与建议，避免遗忘；启动前需产品确认。

## How to use

1. 从本文件挑选条目 → 新建 `docs/requirements/1x-….md` 或扩写现有阶段
2. 更新 [CHECKLIST.md](./CHECKLIST.md) 增加对应勾选
3. 实现后将条目移到「Done」或删除

---

## B1 — PWA（Service Worker + Manifest）

**动机**：demo 提供离线缓存与更新提示；金库本地优先，离线体验有价值。

**建议包含**：

- `public/manifest.json`、图标、`theme_color`
- `public/sw.js` 或 Vite PWA 插件（需评估与 Vite 8 兼容）
- 注册逻辑；`updateAvailable` UI（英文）
- Settings 中「Update available / Reload」

**依赖**：Phase 01 工具链；注意 SW 缓存策略勿缓存敏感内存态（SW 只缓存静态资源）

**风险**：开发态 HMR 与 SW 冲突；需 `dev` 可禁用 SW

- [ ] 未开始

---

## B2 — BiometricSimulator（iframe / 预览降级）

**动机**：demo 在 AI Studio iframe 内无法用真实 WebAuthn，用固定 signature 模拟。

**建议**：仅 `import.meta.env.DEV` 或显式 flag 启用；生产默认关闭。

**风险**：固定签名降低安全性；文档必须标明「non-production」

- [ ] 未开始

---

## B3 — WebAuthn 随机 challenge + RP 服务端

**动机**：静态 challenge 非标准；无法防重放；无服务器 attestation 验证。

**建议**：后端签发 challenge、验证 assertion 后再允许派生；或接受纯客户端局限并在 UI 声明。

**依赖**：后端（AGENTS 默认不做，需单独立项）

- [ ] 未开始

---

## B4 — 子路由拆分

**动机**：Settings / 编辑页深链；URL 可分享状态。

**建议**：`/settings`、或 query `?unlock=1`；仍用 Data Router，鉴权门槛放 loader/布局。

**依赖**：Phase 06–07 稳定后

- [ ] 未开始

---

## B5 — 单元测试（crypto / vaultItems / migration）

**动机**：加解密与迁移易回归；适合 Vitest + 少量 webcrypto mock。

**建议优先**：

- PIN wrap/unwrap master key
- serialize ↔ decrypt round-trip
- legacy key 检测

- [ ] 未开始

---

## B6 — 加密备份导入 / 导出

**动机**：换机迁移；用户导出加密 blob。

**建议**：用户选密码派生包装；不导出 raw master key。

**风险**：文件泄漏 + 弱导出密码

- [ ] 未开始

---

## B7 — 启动默认全屏锁定（非 view-only）

**动机**：更强默认安全；demo 为 UX 选择 view-only 先看元数据。

**建议**：设置项 `requireUnlockOnLaunch`；默认 false 保持现状或 true 更安全（产品定）

- [ ] 未开始

---

## B8 — Owner display name 持久化

**动机**：Setup 收集的 name 目前可只用于 WebAuthn；可写入 metadata 扩展字段用于 UI 问候。

- [ ] 未开始

---

## B9 — E2E（Playwright）冒烟

**动机**：加密流程手动冒烟成本高。

**建议**：覆盖 Setup → Add → Lock → Unlock → Reset（WebAuthn 可 mock）

- [ ] 未开始

---

## Explicitly not planned

| 项                                        | 原因                       |
| ----------------------------------------- | -------------------------- |
| 将密钥同步到云 / 自建后端存储明文或主密钥 | 违背端到端本地加密产品定位 |
| 迁入 `@google/genai` / Express demo 残留  | 与功能无关                 |
| 修改 `demo/` 源码                         | 保留参考；主线只读         |

---

## Done

（实现后移到此处）

_None yet._
