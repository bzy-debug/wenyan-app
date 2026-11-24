# 文言拾阶

面向中文母语成人的文言文阅读练习。L1 草稿试用版包含 4 个单元、12 节课、4 次单元检查，共 120 道计分题。每节课先读讲解，再借上下文辨义、定位证据和梳理事件。课程、练习、复习和学习记录都在浏览器内运行。

## 开发和验证

使用 .nvmrc 指定的 Node.js 24 LTS 版本，依赖由 npm lockfile 固定。

```sh
npm ci
npm run dev
```

```sh
npm run check
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

`check` 执行 vue-tsc、课程完整性检查和 Vitest。Playwright 在桌面和手机视口测试 dist 生产包，包含首次提示、刷新、重试和断网场景。云环境已有 Chromium 时可设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`。运行 `npm run preview` 后访问输出地址的 `/wenyan-app/` 路径。

## 学习记录和离线使用

普通课需要至少 6/8 题首次无提示答对，并覆盖全部主要义项。检查门槛为 4/6。完成检查即可继续下一单元。复习页按到期知识卡抽取不同语境，错题可单独纠正。经验值、连续学习记录和进度保存在当前浏览器；设置页支持备份导出与恢复。首次联网打开后，等待应用资源缓存完毕，即可在此设备离线学习。安装入口随浏览器而异。

## GitHub Pages 发布

生产站点地址为 https://bzy-debug.github.io/wenyan-app/ 。在仓库 Settings → Pages → Build and deployment 中选择 GitHub Actions。推送到 main 后，工作流会安装依赖、校验、运行测试、上传 dist 并部署到 github-pages 环境。也可在 Actions 中手动运行。部署状态和实际发布地址见该次工作流的 deploy 作业。

生产资源以 `/wenyan-app/` 为根；Vue Router 使用 hash，课程和复习页面可直接分享或刷新。GitHub Pages 只接收静态资源；备份和试用反馈由用户自行保存。

## 仓库地图

| 路径 | 职责 |
| --- | --- |
| content/v1、src/content、scripts | 版本化题库、Zod 契约、引用及覆盖校验 |
| src/domain、src/storage | 判题、复习阶梯、进度规则、IndexedDB 与备份 |
| src/components/questions、src/features | Vue 答题组件、学习、路径、复习、知识库、设置与试用页面 |
| src/app、src/main.ts | 应用外壳、响应式布局、Vue Router |
| tests、.github/workflows | 单元、交互与端到端验证；Pages 部署 |
| docs | 产品规格、内容生产规范、试用流程、浏览器截图 |

阅读 [产品规格](docs/SPEC.md)、[内容指南](docs/CONTENT_GUIDE.md) 和 [试用说明](docs/PILOT.md)。示例均为草稿，采用自撰教学语境；发布为正式教材前须经人工审核。首页山水为项目生成的装饰插画。

## 界面实测

| 学习环节 | 桌面浏览器 | 手机尺寸浏览器 |
| --- | --- | --- |
| 今日学习 | [桌面首页](docs/screenshots/desktop-home.webp) | [手机首页](docs/screenshots/mobile-home.webp) |
| 点选原文证据 | [桌面练习](docs/screenshots/desktop-span.webp) | [手机练习](docs/screenshots/mobile-span.webp) |
| 首答与知识点结算 | [桌面结算](docs/screenshots/desktop-result.webp) | [手机结算](docs/screenshots/mobile-result.webp) |
