# 99 — Backlog：后续项（不阻塞主线）

> 主线 Phase 01–08 **已完成**。产品口径与减法见 [10-direction.md](./10-direction.md)。本文件只跟踪尚未做完或已拍板待改的条目。

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

- [x] 已实现（`registerServiceWorker` + `usePWA` + `public/sw.js`；生产默认注册）

---

## B2 — BiometricSimulator（iframe / 预览降级）

**动机**：demo 在 AI Studio iframe 内无法用真实 WebAuthn，用固定 signature 模拟。

**建议**：仅 `import.meta.env.DEV` 或显式 flag 启用；生产默认关闭。

**风险**：固定签名降低安全性；文档必须标明「non-production」

- [x] 已实现：`src/lib/biometricSimulator.ts` 门控；生产默认关闭；UI 标注 Non-production

---

## B3 — WebAuthn 随机 challenge + RP 服务端

**动机**：静态 challenge 非标准；无法防重放；无服务器 attestation 验证。

**建议**：后端签发 challenge、验证 assertion 后再允许派生；或接受纯客户端局限并在 UI 声明。

**依赖**：后端（AGENTS 默认不做，需单独立项）

**备注**：客户端 challenge 已改为每次随机；仍无服务端 attestation。

- [ ] 未开始（服务端部分）

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

- [ ] 未开始（已有 Cypress component：sync / PWA / QR；缺 crypto 单测）

---

## B6 — 加密备份导入 / 导出

**动机**：换机迁移；用户导出加密 blob。

**建议**：用户选密码派生包装；不导出 raw master key。

**风险**：文件泄漏 + 弱导出密码

- [x] 已实现：`src/lib/vaultBackup.ts` + Settings 导出 / Setup 恢复；恢复 passphrase 包装 plaintext items + master key，恢复后设新 PIN。WebAuthn **不能**随文件搬家；Settings 可重新登记（B12）

---

## B7 — 启动默认全屏锁定（非 view-only）

**动机**：更强默认安全；demo 为 UX 选择 view-only 先看元数据。

**建议**：设置项 `requireUnlockOnLaunch`；默认 false 保持现状或 true 更安全。

- [ ] 未开始（已拍板：维持 view-only，本项不做）

---

## B8 — Owner display name 持久化

**动机**：曾考虑把 Setup 的 name 写入 metadata 做 UI 问候。用户对 WebAuthn user.name 无感知，产品侧不收集、不展示。

- [x] 不做：登记凭证时用固定 `WEBAUTHN_USER_NAME`（`kbox`）。

---

## B9 — E2E（Playwright）冒烟

**动机**：加密流程手动冒烟成本高。

**建议**：覆盖 Setup → Add → Lock → Unlock → Reset（WebAuthn 可 mock）

- [x] 部分完成：`pnpm test`（Cypress component）+ `pnpm test:dual-sync`（双浏览器 WebRTC 同步）

---

## B10 — 移除 OneDrive

**动机**：云盘只留 Google Drive，去掉第二套 PKCE / 用户自建应用。已拍板（10-direction）。

**建议**：删 `oneDrive` transport 与 UI 入口；Drive 相关测试不再覆盖 OneDrive。不做用户迁移。

- [x] 已实现：删除 `oneDrive` transport、PKCE popup、Setup/Settings 入口与相关测试。旧 `onedrive` 会话读取时丢弃。

---

## B11 — Google Drive 同步改为可开关

**动机**：现网授权后 600ms 自动 push、解锁自动 pull，和「可选数据移动」冲突。已拍板：手动 Push / Pull + 自动开关，**默认关**。

**建议**：Settings 提供 Push / Pull；自动推拉仅在开关打开后生效。P2P 覆盖后仅当开关开着才 `schedulePush`。

- [x] 已实现：Settings 手动 Push / Pull；`autoSync` 默认 false；关闭时不 schedulePush、不解锁 auto-pull。

---

## B12 — 恢复 / 拉云后重新登记 WebAuthn

**动机**：云端包与恢复文件都会把 `hasWebAuthn` 打成 false；设置页只有只读状态。已拍板：做重新登记。

- [x] 已实现：Settings Face ID 段可 Enable / Replace；`useVault.enrollWebAuthn` 用当前主密钥重新 wrap。

---

## B13 — Reset 时断开云盘

**动机**：`resetVault` 现不清 `kbox_cloud_sync`。空库再解锁可能把空包推上去或把旧包拉回来。已拍板：Reset 断开 Google 并清本地 OAuth。

- [x] 已实现：HomePage Reset 先 `cloud.reset()`（`clearCloudSyncState`），再 `resetVault`。Google 从不持久化 token。

---

## Explicitly not planned

| 项                                       | 原因                              |
| ---------------------------------------- | --------------------------------- |
| kbox 自建后端存储明文、主密钥或金库账号  | 无服务端定位                      |
| 条目级 merge / CRDT                      | 现网 WebRTC 与 Drive 都是整库覆盖 |
| 迁入 `@google/genai` / Express demo 残留 | 与功能无关                        |
| 修改 `demo/` 源码做产品功能              | 保留参考；主线只读                |
| 把产品写成「纯本地、数据不能离开设备」   | 数据移动是可选真实需求            |

---

## Done

- B1 PWA（manifest / SW / update banner）— **保留**
- B2 BiometricSimulator DEV-only gate
- B6 加密恢复文件
- B9 部分：Cypress component + dual-browser sync smoke
