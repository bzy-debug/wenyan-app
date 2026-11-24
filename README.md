# 文言拾阶

面向中文母语成人的文言文阅读练习。L1–L5 教学草稿包含 38 个单元、114 节课、38 次单元检查，共 1140 道练习。可以从任意一课或单元检查开始。点进课程就读句子、动手作答，需要时再打开本课讲解。课程、练习、复习和学习记录都在浏览器内运行。

[分级选课](https://bzy-debug.github.io/wenyan-app/#/path) · [整篇自读](https://bzy-debug.github.io/wenyan-app/#/read) · [课程范围与教学依据](docs/CURRICULUM.md)

课程从单句辨义逐步过渡到通读史传、论说和散文。常用词专题覆盖 160 个字头、168 个义项。知识库共收录 318 个具体知识点，每个知识点都有多语境复习卡。八篇独立自读材料提供按需查词、口头复述和原文证据自校，其中包括明代寓言和清代完整游记。

## 编写与预览课程

在[作者预览](https://bzy-debug.github.io/wenyan-app/#/author)选择任意课稿，可修改 Markdown、查看讲解、直接试做该课任意一题并下载修改稿。已有稿件也可以从本机打开。预览在浏览器内运行，独立于学习进度。

课稿位于 [content/v1/course](content/v1/course)。目录声明课程顺序，每课一份 Markdown，其中包含讲解、例句、题目和反馈。试读另放在 [content/v1/pilot](content/v1/pilot)。上稿格式见[作者手册](docs/AUTHORING.md)，书目与修订依据见[教学参考](docs/TEACHING_REFERENCES.md)。

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

`check` 执行 vue-tsc、课程完整性检查和 Vitest。Playwright 在桌面和手机视口测试 dist 生产包，涵盖自由选课、跨课续学、求助、作答反馈、刷新和断网场景。云环境已有 Chromium 时可设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`。运行 `npm run preview` 后访问输出地址的 `/wenyan-app/` 路径。

## 学习记录和离线使用

课程目录提供建议顺序。每节课都能随时进入、离开和续学。在普通课里点「不知道」可以看答案和点拨，按自己的节奏继续。看完一轮题目就算完成，同一种练习的完成经验固定。首次作答情况用于安排下次复习的时间，到期复习会换一个语境。经验值、连续学习记录和进度保存在当前浏览器，设置页支持备份导出与恢复。首次联网打开后，等待应用资源缓存完毕，即可在此设备离线学习。安装入口随浏览器而异。

新版会自动迁移上一版的本地进度，也能导入其 v2 备份。旧格式只保存过关清单与最近一次练习结果，能据此恢复的完成记录会一并带入。

## GitHub Pages 发布

生产站点地址为 https://bzy-debug.github.io/wenyan-app/ 。在仓库 Settings → Pages → Build and deployment 中选择 GitHub Actions。推送到 main 后，工作流会安装依赖、校验、运行测试、上传 dist 并部署到 github-pages 环境。也可在 Actions 中手动运行。部署状态和实际发布地址见该次工作流的 deploy 作业。

生产资源以 `/wenyan-app/` 为根；Vue Router 使用 hash，课程和复习页面可直接分享或刷新。GitHub Pages 只接收静态资源；备份和试用反馈由用户自行保存。

## 仓库地图

| 路径 | 职责 |
| --- | --- |
| content/v1、src/content、scripts | Markdown 课稿、构建期编译、数据契约与校验 |
| src/domain、src/storage | 判题、复习阶梯、进度规则、IndexedDB 与备份 |
| src/components/questions、src/features | Vue 答题组件、学习、路径、复习、知识库、设置与试用页面 |
| src/app、src/main.ts | 应用外壳、响应式布局、Vue Router |
| tests、.github/workflows | 单元、交互与端到端验证；Pages 部署 |
| docs | 产品规格、内容生产规范、试用流程、浏览器截图 |

阅读 [产品规格](docs/SPEC.md)、[内容指南](docs/CONTENT_GUIDE.md) 和 [试用说明](docs/PILOT.md)。当前课程为待审核草稿。古籍引文注明所据文本，现代译注与练习为自撰。

## 界面实测

| 学习环节 | 桌面浏览器 | 手机尺寸浏览器 |
| --- | --- | --- |
| 今日学习 | [桌面首页](docs/screenshots/desktop-home.webp) | [手机首页](docs/screenshots/mobile-home.webp) |
| 分级选课与整篇自读 | [五级课程目录](docs/screenshots/desktop-levels.webp) | [手机读《梦溪笔谈》](docs/screenshots/mobile-reader.webp) |
| 从原文找证据 | [桌面练习](docs/screenshots/desktop-span.webp) | [手机练习](docs/screenshots/mobile-span.webp) |
| 完成一课 | [桌面结算](docs/screenshots/desktop-result.webp) | [手机结算](docs/screenshots/mobile-result.webp) |
