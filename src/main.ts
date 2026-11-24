import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./app/App.vue";
import "./app/styles.css";

const learn = () => import("./features/Learn.vue");
const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: () => import("./features/Home.vue"),
      meta: { title: "今日学习" },
    },
    {
      path: "/path",
      component: () => import("./features/Path.vue"),
      meta: { title: "课程路径" },
    },
    {
      path: "/learn/:id",
      component: learn,
      meta: { title: "阅读练习", focused: true },
    },
    {
      path: "/practice",
      component: learn,
      meta: { title: "巩固练习", focused: true },
    },
    {
      path: "/result",
      component: () => import("./features/Result.vue"),
      meta: { title: "练习完成", focused: true },
    },
    {
      path: "/review",
      component: () => import("./features/Review.vue"),
      meta: { title: "复习" },
    },
    {
      path: "/knowledge",
      component: () => import("./features/Knowledge.vue"),
      meta: { title: "知识库" },
    },
    {
      path: "/settings",
      component: () => import("./features/Settings.vue"),
      meta: { title: "设置" },
    },
    {
      path: "/pilot",
      component: () => import("./features/Pilot.vue"),
      meta: { title: "阅读试用" },
    },
    {
      path: "/author",
      component: () => import("./features/AuthorPreview.vue"),
      meta: { title: "作者预览", focused: true, standalone: true },
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
  scrollBehavior(_to, _from, position) {
    return position ?? { top: 0 };
  },
});
router.afterEach((to) => {
  document.title = to.meta.title + " · 文言拾阶";
});
const app = createApp(App).use(router);
void router.isReady().then(() => app.mount("#app"));
