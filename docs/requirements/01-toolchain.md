# 01 — Toolchain：依赖、Vite、Tailwind、AGENTS

## Goal

为 kbox 接入与 demo 对齐的 UI 工具链：Tailwind CSS v4、`lucide-react`、`motion`；更新全局样式入口与 `AGENTS.md` 约定。

## Depends on

无（首个实现阶段）

## In scope

- 安装运行时 / 构建依赖
- Vite 插件配置
- `src/index.css` Tailwind + `@theme`
- 更新 `AGENTS.md` 样式章节（允许 Tailwind v4）

## Out of scope

- PWA / Service Worker
- 业务组件与加密逻辑
- path alias `@/`（非必须；本项目继续相对路径，除非另开需求）

## Source

- `demo/api-key-safe/package.json`（依赖清单）
- `demo/api-key-safe/vite.config.ts`（Tailwind 插件用法）
- `demo/api-key-safe/src/index.css`（`@import "tailwindcss"` + `@theme`）

## Target

| 文件                              | 动作                          |
| --------------------------------- | ----------------------------- |
| `package.json` / `pnpm-lock.yaml` | 新增依赖                      |
| `vite.config.ts`                  | 加入 `@tailwindcss/vite`      |
| `src/index.css`                   | Tailwind + theme + 基础 reset |
| `AGENTS.md`                       | 样式节改为允许 Tailwind v4    |

## Requirements

### Dependencies

- [ ] `pnpm add lucide-react motion @tailwindcss/vite`
- [ ] `pnpm add -D tailwindcss`
- [ ] 不安装 demo 残留包：`@google/genai`、`express`、`dotenv`、`autoprefixer`（Tailwind v4 不需要）

### Vite

- [ ] 在现有 React + React Compiler / babel 插件旁注册 `tailwindcss()` from `@tailwindcss/vite`
- [ ] 不破坏现有 `reactCompilerPreset` 配置

### CSS / Theme

- [ ] `src/index.css` 包含 `@import "tailwindcss"`
- [ ] 使用 `@theme` 定义：
    - 无衬线展示字体（非 Inter/Roboto/Arial/system 默认栈作为唯一字体；可用 Google Fonts 或等价）
    - mono 字体用于密钥展示（如 JetBrains Mono 或等价）
    - 色板：安全工具气质；**避开**紫→靛渐变、warm cream + terracotta serif、纯黑 + 多层 glow 的常见 AI 默认风
- [ ] 保留合理全局 reset（`box-sizing`、`body` margin）
- [ ] 可选：细滚动条样式（参考 demo，非必须）

### AGENTS.md

- [ ] 「样式」一节改为：默认使用 **Tailwind CSS v4**（`@tailwindcss/vite`）；design tokens 放在 `src/index.css` 的 `@theme` / CSS 变量
- [ ] 注明：未经要求不引入其他 CSS-in-JS / 额外 UI 组件库；`lucide-react` 与 `motion` 已批准用于本应用
- [ ] 其余规范（路由、pnpm、Conventional Commits 等）不变

## Acceptance

- [ ] `pnpm install` 成功
- [ ] 任意页面元素使用 Tailwind utility class（如 `className="p-4 text-sm"`）在 `pnpm dev` 下生效
- [ ] `pnpm build` 通过
- [ ] `pnpm lint` 无因本阶段引入的新错误
- [ ] `AGENTS.md` 与实际栈一致，后续 Agent 不会按「禁止 Tailwind」行事

## Notes

- demo 使用 Vite 6；kbox 为 Vite 8 —— 使用 `@tailwindcss/vite` 当前稳定版即可，不必锁定 demo 精确版本号。
- 字体通过 `index.css` 的 `@import url(...)` 或 `index.html` link 引入均可，优先一种方式并写清。
