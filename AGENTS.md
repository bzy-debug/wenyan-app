# 持续开发约定
使用现有 checkout、.nvmrc 与 npm ci。先阅读 docs/SPEC.md 和 docs/CONTENT_GUIDE.md；仅推进当前里程碑。
课程写入 content/v1 JSON，保留稳定 ID。Zod 契约和跨实体校验同时服务于构建与测试。题目或答案不得硬编码在 UI。领域层保持纯函数，不导入 React、路由、浏览器 API 或数据库。M2 的 Dexie 适配器与 M3 的可替换调度器独立实现。
每次变更运行 npm run check、npm run test:e2e 与 npm run build。变更评分必测首答、提示、重试、知识点覆盖与边界值。修改交互检查键盘和手机视口。不得削弱校验或提交生成的依赖、凭证。内容发布必须人工审核。
