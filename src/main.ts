import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./app/App.vue";
import { course } from "./content";
import "./app/styles.css";

const learn = () => import("./features/Learn.vue");
const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/path" },
    {
      path: "/today",
      component: () => import("./features/Home.vue"),
      meta: { title: "今日学习" },
    },
    {
      path: "/path",
      component: () => import("./features/Path.vue"),
      meta: { title: "课程路径" },
    },
    {
      path: "/read/:id?",
      component: () => import("./features/ReadingRoom.vue"),
      meta: { title: "整篇自读" },
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
  scrollBehavior(to, from, position) {
    const level = to.query.level;
    if (
      to.path === "/path" &&
      course.levels.some((item) => item.id === level)
    ) {
      const section = document.getElementById("level-" + level);
      // Path handles deep links after the learning record and the sections load.
      if (to.fullPath === from.fullPath && section)
        return { el: section, top: 16 };
      return false;
    }
    return position ?? { top: 0 };
  },
});
router.afterEach((to) => {
  document.title = to.meta.title + " · 文言拾阶";
});
const app = createApp(App).use(router);
void router.isReady().then(() => app.mount("#app"));
