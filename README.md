# 文言拾阶

面向中文母语成人的文言文阅读练习。六个阶段共 52 个单元、156 节课、52 次单元检查，合计 1560 道题。打开一课先读句子、动手作答，需要时可以翻看讲解。所有关卡都能自由进入。

[完整课程路径](https://bzy-debug.github.io/wenyan-app/#/path) · [整篇自读](https://bzy-debug.github.io/wenyan-app/#/read) · [课程范围与教学依据](docs/curriculum/SCOPE.md)

从辨清单句中的动作，到跟住长段的论证，最后借辞书独立研读。知识库可检索课内的随文词义并回到原句。十三篇自读文选单列，供读者查词、复述和用原文自校。每个单元所据的教材篇章及改编方法见[教学参考](docs/TEACHING_REFERENCES.md)。

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

`check` 执行 vue-tsc、课程完整性检查、教材词条及六个领域的教学证据校验和 Vitest。Playwright 在桌面和手机视口测试 dist 生产包，涵盖自由选课、跨课续学、求助、作答反馈、刷新和断网场景。云环境已有 Chromium 时可设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`。运行 `npm run preview` 后访问输出地址的 `/wenyan-app/` 路径。

## 学习记录和离线使用

打开应用就能沿完整课程路径学习。首页标出下一项推荐练习，也支持在同一条路线中直接跳至任意等级。每节课都能随时进入、离开和续学。在普通课里点「不知道」可以看答案和点拨，按自己的节奏继续。看完一轮题目就算完成，同一种练习的完成经验固定。首次作答情况用于安排下次复习的时间，到期复习会换一个语境。经验值、连续学习记录和进度保存在当前浏览器，设置页支持备份导出与恢复。首次联网打开后，等待应用资源缓存完毕，即可在此设备离线学习。安装入口随浏览器而异。

新编课程使用独立的课程标识。学习记录及备份与对应课程绑定。

## GitHub Pages 发布

生产站点地址为 https://bzy-debug.github.io/wenyan-app/ 。在仓库 Settings → Pages → Build and deployment 中选择 GitHub Actions。推送到 main 后，工作流会安装依赖、校验、运行测试、上传 dist 并部署到 github-pages 环境。也可在 Actions 中手动运行。部署状态和实际发布地址见该次工作流的 deploy 作业。

生产资源以 `/wenyan-app/` 为根；Vue Router 使用 hash，课程和复习页面可直接分享或刷新。GitHub Pages 只接收静态资源；备份和试用反馈由用户自行保存。

## 仓库地图

| 路径 | 职责 |
| --- | --- |
| references | 编课用的三本教材，与网站构建分开 |
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
| 默认首页 · 完整课程路径 | [桌面首页](docs/screenshots/desktop-home.webp) | [手机首页](docs/screenshots/mobile-home.webp) |
| 等级衔接与整篇自读 | [从 L1 接着读 L2](docs/screenshots/desktop-levels.webp) | [手机读《梦溪笔谈》](docs/screenshots/mobile-reader.webp) |
| 按知识领域找课与检索句式 | [桌面搜状语后置](docs/screenshots/desktop-knowledge.webp) | [手机搜状语后置](docs/screenshots/mobile-knowledge.webp) |
| 按字查课文中的意思 | [桌面查词](docs/screenshots/desktop-words.webp) | [手机查词](docs/screenshots/mobile-words.webp) |
| 从原文找证据 | [桌面练习](docs/screenshots/desktop-span.webp) | [手机练习](docs/screenshots/mobile-span.webp) |
| 诗词对读与查字 | [桌面读《江雪》](docs/screenshots/desktop-verse.webp) | [手机按部首查“楫”](docs/screenshots/mobile-lookup.webp) |
| 完成一课 | [桌面结算](docs/screenshots/desktop-result.webp) | [手机结算](docs/screenshots/mobile-result.webp) |
