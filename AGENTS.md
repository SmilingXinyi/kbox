# kbox — 前端开发规范（AGENTS）

> 供 AI Agent 与协作者遵循的项目约定。  
> **代码注释与界面文案使用英文**；与用户沟通可使用中文。

## 技术栈

| 层级   | 选型                                                     |
| ------ | -------------------------------------------------------- |
| 运行时 | React 19 + React DOM                                     |
| 路由   | React Router 8（`react-router`，Data Router）            |
| 构建   | Vite 8（`@vitejs/plugin-react` + React Compiler）        |
| 语言   | TypeScript（strict，`verbatimModuleSyntax`）             |
| 包管理 | **仅使用 pnpm**（禁止 npm / yarn）                       |
| 质量   | ESLint flat config + Prettier                            |
| Git    | Husky + lint-staged + commitlint（Conventional Commits） |

## 常用命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 开发服务器
pnpm build            # tsc -b && vite build
pnpm preview          # 预览生产构建
pnpm lint             # eslint .
pnpm format           # prettier --write .
pnpm commit           # commitizen 交互式提交（可选）
```

## 目录结构

```text
kbox/
├── public/                 # 静态资源（原样拷贝）
├── src/
│   ├── main.tsx            # 应用入口：挂载 + RouterProvider
│   ├── App.tsx             # 根布局（Outlet），不含具体页面业务
│   ├── router.tsx          # 唯一路由表（createBrowserRouter）
│   ├── index.css           # 全局 reset / design tokens
│   ├── assets/             # 由模块导入的图片、图标等
│   ├── components/         # 可复用 UI（不做路由级数据请求）
│   ├── pages/              # 路由页面（default export）
│   ├── hooks/              # 共享 React Hooks
│   ├── lib/                # 非 React 工具、客户端、纯函数
│   ├── types/              # 共享 TypeScript 类型
│   └── styles/             # 共享样式 / tokens（按需）
├── index.html
├── vite.config.ts
├── eslint.config.js
├── lint-staged.config.js
├── commitlint.config.js
└── AGENTS.md
```

目录按首次需要再创建，不要提前建空文件夹。

### 放置规则

- **pages/** — 与路由一一对应的页面；文件变大时按页面分子目录（如 `pages/settings/SettingsPage.tsx`）。
- **components/** — 跨页面复用的展示 / 交互组件；默认不直接调 API（除非明确是数据型组件）。
- **hooks/** — 可复用的 `useXxx`；共享副作用与订阅放这里。
- **lib/** — 纯工具、请求封装、常量；优先函数而非 class。
- 保持扁平：不要在无关组件内嵌套另一套业务目录，跨目录 import。

## 路由规范

### 模式

- 使用 **Data Router**：`createBrowserRouter` + `RouterProvider`（见 `src/router.tsx` / `src/main.tsx`）。
- **禁止**再包一层 `BrowserRouter`；导航用 `Link` / `NavLink` / `useNavigate`，勿用 `window.location` 做站内跳转。
- 从包名 **`react-router`** 导入（本项目未使用 `react-router-dom`）。

### 职责划分

| 文件         | 职责                                     |
| ------------ | ---------------------------------------- |
| `main.tsx`   | `RouterProvider` 挂载，不写业务路由细节  |
| `router.tsx` | **唯一**路由注册表；新增页面必须在此登记 |
| `App.tsx`    | 根布局壳（`<Outlet />`、全局导航/壳层）  |
| `pages/*`    | 页面 UI 与页面级逻辑；**default export** |

### 新增页面流程

1. 在 `src/pages/` 新增页面组件（`XxxPage.tsx`，default export）。
2. 在 `src/router.tsx` 的 `children` 中注册 `path` / `index`。
3. 未知路径统一走 `{path: '*', element: <NotFoundPage />}`，不要散落多个 404。
4. 页面变重时用 `React.lazy` + `Suspense`（或路由级 lazy），在 `router.tsx` 中引入；轻量页可保持同步 import。

### 约定

- 路径使用 kebab-case（如 `/user-settings`）；动态段用 `:id`。
- 布局嵌套通过父路由 `element` + 子路由 + `<Outlet />` 实现，勿在页面里手写第二套路由树。
- 需要鉴权 / 重定向时，优先用路由 `loader`、包装布局或 `Navigate`，把门槛集中在路由层，而不是每个页面复制粘贴。
- Vite 已按 SPA 处理 history fallback；部署静态托管时需配置同源 fallback 到 `index.html`。

## 编码规范

### TypeScript

- 优先 `type`，仅在需要声明合并时用 `interface`。
- 类型-only 导入使用 `import type` / `export type`（配合 `verbatimModuleSyntax`）。
- 禁止随意使用 `any`；用 `unknown` 再收窄，或定义明确类型。
- 模块优先 named export；根布局 `App` 与 `pages/*` 使用 default export（便于路由与后续 lazy）。
- **默认不要**加 `useMemo` / `useCallback`（已启用 React Compiler）；仅在实测有问题或对齐既有写法时再加。

### React

- 仅使用函数组件。
- 组件样式就近放置（`Component.module.css` 或同级 CSS）。
- 全局样式与设计 token 放在 `src/index.css`（或 `src/styles/`）。
- 单一职责：逻辑复用或 JSX 过重时抽 hook。
- 副作用放在 `useEffect` / 事件处理 / hooks 中，禁止在 render 期间产生副作用。
- 表单优先受控组件；非受控仅在明显更简单时使用。

### 命名

| 类型        | 约定                          | 示例                 |
| ----------- | ----------------------------- | -------------------- |
| 组件 / 页面 | PascalCase                    | `UserCard.tsx`       |
| Hooks       | `use` + camelCase             | `useLocalStorage.ts` |
| lib 工具    | camelCase                     | `formatDate.ts`      |
| CSS Modules | `*.module.css`                | `Button.module.css`  |
| 常量        | SCREAMING_SNAKE 或 `as const` | `API_BASE_URL`       |

### 格式化（与 Prettier 一致，勿对抗）

- 缩进：**4 spaces**
- `printWidth`: 120
- `singleQuote`: true
- `semi`: true
- `trailingComma`: none
- `bracketSpacing`: false
- `arrowParens`: avoid

YAML 通过 override 使用 2 空格缩进。

### 导入

- 顺序：外部包 → 内部相对路径 / 别名 → 样式与资源。
- 在引入 path alias 之前，`src` 内用相对路径。
- 若新增别名（如 `@/`），须在同一次改动中同步更新 Vite 与 TypeScript 配置。

## 样式

- 默认使用 **Tailwind CSS v4**（`@tailwindcss/vite`）；design tokens 放在 `src/index.css` 的 `@theme` / CSS 变量。
- 已批准的 UI 依赖：`lucide-react`（图标）、`motion`（动画）。未经要求不引入其他 CSS-in-JS / UI 组件库。
- 魔法数字复用 ≥ 2 次时提取为 token（`@theme` 或 CSS 变量）。
- 同时兼顾桌面与移动端；应用壳层优先弹性布局，少用死板定宽网格。

## 状态与数据

- 局部 UI 状态：在最近的负责组件用 `useState` / `useReducer`。
- 跨组件共享状态：仅在 props 钻取明显痛苦时再引入 Context / 专用 store，禁止过早上全局状态库。
- 远程数据：请求封装在 `lib/` 或 hooks；UI 明确处理 loading / error / success。
- 禁止吞掉错误；应记录或给用户反馈，需要时向上抛出。

## Git 与提交

- Commit message：**英文**，遵循 Conventional Commits。

```text
feat: add settings page
fix: correct favicon path
chore: update eslint config
docs: clarify AGENTS layout
```

- type：`feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `build` | `ci` | `chore` | `revert`
- subject：祈使语气、无句号、尽量 ≤ 72 字符。
- pre-commit 会跑 **lint-staged**（ESLint --fix + Prettier）。失败须修复，禁止随意跳过 hook。
- 不提交密钥（`.env`、credentials）；需要时提供 `.env.example`。
- **仅在用户明确要求时创建 commit**。

## Agent 行为要求

1. **先读后写** — 对齐现有文件与本地模式。
2. **最小改动** — 只改任务所需；禁止顺手重构或无关文档修改。
3. **不臆加依赖** — 优先现有栈与标准能力；重大新依赖需用户确认。
4. **可验证** — 有意义改动后尽量跑 `pnpm lint` 和/或 `pnpm build`。
5. **歧义先问** — 产品行为、视觉方向、重大依赖选择需确认。
6. **注释克制** — 只解释非显而易见的意图；注释与 UI 文案用英文。

## 默认不做（除非用户要求）

- 后端 / 数据库 schema
- 原生移动端封装
- 引入 monorepo 工具链
- force push 或破坏性 git 操作
- 使用 `--no-verify` 跳过 hooks

## Cursor Cloud specific instructions

- **Client-only SPA** — no backend or database. The only long-running service is the Vite dev server (`pnpm dev`, serves `http://localhost:5173/`). Standard commands live in `README.md` / `package.json` scripts.
- **Cypress binary** — `pnpm test` (`cypress run --component --browser chrome`) needs the Cypress binary, but pnpm ignores Cypress's install script during `pnpm install`. The startup update script runs `pnpm exec cypress install` (idempotent) to fetch it; if tests error with a missing binary, run that manually. Chrome is preinstalled in the VM.
- **Known flaky component tests** — `VaultSync.cy.tsx` ("shows QR while host is waiting") and `usePWA.cy.tsx` (service-worker registration) can fail under headless Chrome due to viewport/`position:fixed` visibility and SW-registration timing, not app logic. The other 29 component tests pass.
- **Vault PIN** — the setup form enforces a 6–12 character PIN (README's "4–12" is outdated); use e.g. `123456` when manually testing vault setup.
