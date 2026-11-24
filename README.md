# 文言拾阶
面向中文母语成人的文言文阅读练习。M0 / M1 提供 L1 路径及“走、去、闻”一课的完整草稿体验。本阶段成绩仅在当前页面会话中保存。

## 本地开发
使用 .nvmrc 固定的 Node.js LTS，运行 `npm ci`、`npm run dev`。打开 Vite 输出的地址。从首页进入讲解，完成 8 题后查看首答与各义项成绩。也可直接访问 /path。
`npm run check` 执行类型检查、内容校验和单元／交互测试。`npx playwright install --with-deps chromium` 安装测试浏览器，随后运行 `npm run test:e2e`。已有 Chromium 时可设置 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH。`npm run build` 生成 dist，`npm run preview` 检查生产包。

## 代码地图
- content/v1 与 src/content：版本化数据、Zod 契约、引用及完整性检查。
- src/domain：纯函数判题、首答与结算；src/components/questions：输入组件。
- src/app 与 src/features：路由、页面与会话编排。M2 再加入存储层。
- scripts、tests、.github/workflows：校验入口、自动化测试、CI。
- docs/SPEC.md 与 docs/CONTENT_GUIDE.md：产品路线、内容规范与审核。

## Vercel
将仓库导入 Vercel，项目根目录选仓库根，框架 Vite，Node 选 24.x，安装命令 npm ci，构建命令 npm run build，输出目录 dist。无需环境变量。vercel.json 提供 SPA 深链接回退。授权 Git 集成后可为 PR 生成预览，以 main 作为生产分支。正式向学习者开放前请先完成人工内容审核。

## 浏览器实测截图
| 场景 | 桌面 Chromium | 手机尺寸 Chromium |
| --- | --- | --- |
| 首页 | [桌面首页](docs/screenshots/desktop-home.webp) | [手机首页](docs/screenshots/mobile-home.webp) |
| 选段练习 | [桌面选段](docs/screenshots/desktop-span.webp) | [手机选段](docs/screenshots/mobile-span.webp) |
| 结算 | [桌面结算](docs/screenshots/desktop-result.webp) | [手机结算](docs/screenshots/mobile-result.webp) |

首页山水插图为本项目生成的装饰插画。
