# 持续开发约定

- 在当前 checkout 从最新 main 创建本地功能分支。合入 main 前完成验证，推送 main 会触发 GitHub Pages 发布。
- 使用 .nvmrc 固定的 Node LTS 和 npm ci。界面使用 Vue 3 单文件组件，路由使用 Vue Router。保留 GitHub Pages 的项目子路径、hash 路由及离线资源作用域。
- 先阅读 docs/SPEC.md、docs/CONTENT_GUIDE.md。课程写入 content/v1，保留稳定 ID。Zod 和跨实体校验同时用于运行时、构建及测试。
- 判题、解锁、日期及复习规则使用纯函数；Dexie 在存储层负责原子更新。新增存储版本时须考虑已有用户、恢复与备份。禁止将学习记录或自由反馈发送给第三方。
- 修改评分时测试首答、提示、重试、义项覆盖和边界值。运行 npm run check、npm run build、npm run test:e2e。移动端及桌面端都需能使用键盘或触控完成练习。
- 只有真实审核才能改变内容状态。试用结果须来自自愿参与者，参照 docs/PILOT.md，记录迭代依据。
