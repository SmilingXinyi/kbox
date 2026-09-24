# 10 — 产品口径与减法

> 2026-09-17 讨论后的**当前产品源**。B10–B13 已落地。

## 定位

kbox 是**无服务端**的浏览器端到端加密 API Key 保险箱：没有 kbox 账号、没有金库后端。主密钥只在内存中，锁定后清除。

数据**可以**离开这台设备，但都是可选能力（WebRTC 对拷、Google Drive 加密包、恢复文件）。不要写成「纯本地 / 数据不出设备 / No cloud account」。

| 说法         | 用                         | 不用                      |
| ------------ | -------------------------- | ------------------------- |
| 无服务端     | kbox 不运营账号或金库 API  | 「没有云」                |
| 可选数据移动 | 用户主动使用的换机 / 备份  | 「同步」暗示双向合并      |
| 端到端加密   | 密文离开设备时仍是用户密钥 | 把 Drive 当成 kbox 云账号 |

## 能力分层

| 层       | 能力                                                                 | 状态 |
| -------- | -------------------------------------------------------------------- | ---- |
| 核       | PIN 初始化、解锁、自动锁定、CRUD、搜索、重置                         | 现网 |
| 本机便利 | WebAuthn（Face ID / Touch ID）；凭证不能随保险箱搬家；设置可重新登记 | 现网 |
| 可选移动 | WebRTC 整库覆盖、Google Drive 整文件包、`.kboxbackup` 恢复文件       | 现网 |
| 壳       | PWA、iOS 安装提示                                                    | 现网 |
| 开发降级 | BiometricSimulator（DEV / 显式 flag）                                | 现网 |

## 三条数据移动

|               | WebRTC                 | Google Drive                                        | 恢复文件                       |
| ------------- | ---------------------- | --------------------------------------------------- | ------------------------------ |
| 带走什么      | 只替换 items           | 主密钥 PIN 包装 + items + 设置                      | 主密钥 + items；本机再设新 PIN |
| 本机 WebAuthn | 不变                   | 云端包不含；拉下来后在设置里重新登记                | 不含；恢复后在设置里重新登记   |
| 冲突          | 整库覆盖（A→B 或 B→A） | 整文件 `updatedAt` LWW                              | Setup 时整库替换               |
| 是否自动      | 否，双方确认           | 默认否。Settings 手动 Push / Pull；开关打开后才自动 | 否                             |

只支持 Google Drive。旧版 OneDrive 会话在读取时丢弃，不做迁移。

## 已拍板（已实现）

| 项                 | 结论                                                           |
| ------------------ | -------------------------------------------------------------- |
| 产品叙事           | 无服务端；可选数据移动                                         |
| OneDrive           | 已移除                                                         |
| WebRTC             | 留下；文案为 overwrite，不是 merge                             |
| Google Drive       | 手动 Push / Pull + **自动同步开关，默认关**                    |
| 恢复文件           | 留下                                                           |
| PWA / iOS 安装条   | 留下                                                           |
| 启动锁定           | 维持 view-only。不做 B7                                        |
| 面容跨设备         | 不随保险箱搬家；设置页可重新登记                               |
| Reset              | 清本机金库，同时清 `kbox_cloud_sync`（含 revision / autoSync） |
| BiometricSimulator | 仅 DEV / `VITE_ENABLE_BIOMETRIC_SIMULATOR`                     |

## 金库状态机（以代码为准）

`VaultState` 只有 `'loading' | 'uninitialized' | 'unlocked'`。没有独立的 `locked`。锁定 = `unlocked && masterKey === null`（view-only）。

```text
loading
  ├─► uninitialized
  └─► unlocked   （masterKey 有值 = 完全解锁；null = view-only）

uninitialized ──Setup / 恢复文件 / Drive 拉取──► unlocked
unlocked ──lock──► view-only
unlocked ──reset──► uninitialized
```

PIN 长度：**6–12**。锁定时磁盘上明文：label、tag、description、日期。密文：每个 secret 的 `encryptedValue`。

## 密钥身份

| 秘密            | 用途                                       |
| --------------- | ------------------------------------------ |
| Vault PIN       | 本机解锁；Drive 包用同一套 PIN wrap        |
| WebAuthn / 面容 | 仅本机第二把 KEK；不能导出                 |
| 恢复口令（≥8）  | 只包 `.kboxbackup`，与 PIN 不是同一个      |
| WebRTC 会话密钥 | QR / 邀请串里的一次性 AES 密钥，当密码对待 |

P2P 覆盖成功后仅当自动同步开着才推 Drive。`demo/` 继续只读。

## 明确不做（现阶段）

- kbox 自建后端、明文或主密钥上传到 kbox 服务器
- 条目级 merge / CRDT
- WebAuthn 服务端 attestation（B3）
- 修改 `demo/` 源码做产品功能
- 砍 PWA / iOS 安装条
- 把产品重新写成「纯本地、数据不能离开设备」
- 重新引入 OneDrive

## 文档角色

| 文件                                              | 角色                                 |
| ------------------------------------------------- | ------------------------------------ |
| [README.md](../../README.md)                      | 对外：现网行为 + 无服务端定位        |
| 本文件                                            | 产品口径                             |
| [00-overview.md](./00-overview.md) 起 Phase 01–08 | 历史实现记录；冲突时以本文和代码为准 |
| [99-backlog.md](./99-backlog.md)                  | 未做增强（B3–B5、B7、B8）            |
| [CHECKLIST.md](./CHECKLIST.md)                    | 勾选表                               |
