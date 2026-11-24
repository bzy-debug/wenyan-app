import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./app/App.vue";
import Home from "./features/Home.vue";
import Path from "./features/Path.vue";
import Learn from "./features/Learn.vue";
import Result from "./features/Result.vue";
import Review from "./features/Review.vue";
import Knowledge from "./features/Knowledge.vue";
import Settings from "./features/Settings.vue";
import Pilot from "./features/Pilot.vue";
import "./app/styles.css";

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", component: Home, meta: { title: "今日学习" } },
    { path: "/path", component: Path, meta: { title: "课程路径" } },
    { path: "/learn/:id", component: Learn, meta: { title: "阅读练习" } },
    { path: "/practice", component: Learn, meta: { title: "巩固练习" } },
    { path: "/result", component: Result, meta: { title: "本轮结算" } },
    { path: "/review", component: Review, meta: { title: "复习" } },
    { path: "/knowledge", component: Knowledge, meta: { title: "知识库" } },
    { path: "/settings", component: Settings, meta: { title: "设置" } },
    { path: "/pilot", component: Pilot, meta: { title: "阅读试用" } },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
  scrollBehavior(_to, _from, position) {
    return position ?? { top: 0 };
  },
});
router.afterEach((to) => {
  document.title = to.meta.title + " · 文言拾阶";
});
createApp(App).use(router).mount("#app");
