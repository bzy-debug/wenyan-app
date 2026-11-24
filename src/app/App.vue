<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  BookOpenText,
  House,
  Milestone,
  RotateCcw,
  Settings2,
} from "@lucide/vue";
import { initProgress } from "../storage/progress";

const mark = import.meta.env.BASE_URL + "mark.svg";
const destinations = [
  { to: "/", label: "今日学习", icon: House },
  { to: "/path", label: "课程路径", icon: Milestone },
  { to: "/review", label: "复习", icon: RotateCcw },
  { to: "/knowledge", label: "知识库", icon: BookOpenText },
  { to: "/settings", label: "设置", icon: Settings2 },
];
const route = useRoute();
const focused = computed(() => Boolean(route.meta.focused));
const content = ref<HTMLElement>();
const status = ref<"loading" | "ready" | "error">("loading");
async function openLibrary() {
  status.value = "loading";
  try {
    await initProgress();
    status.value = "ready";
  } catch {
    status.value = "error";
  }
}
watch(
  () => route.meta.standalone,
  (standalone) => {
    if (!standalone && status.value !== "ready") void openLibrary();
  },
  { immediate: true },
);
</script>
<template>
  <a href="#main-content" class="skip-link" @click.prevent="content?.focus()"
    >跳到正文</a
  >
  <div class="app-frame" :class="{ 'focus-mode': focused }">
    <header v-if="!focused" class="app-rail">
      <RouterLink to="/" class="brand">
        <img :src="mark" width="36" height="36" alt="" />
        文言拾阶
      </RouterLink>
      <nav aria-label="主导航">
        <RouterLink
          v-for="item in destinations"
          :key="item.to"
          :to="item.to"
          :class="{ 'settings-link': item.to === '/settings' }"
          exact-active-class="active"
        >
          <component :is="item.icon" :size="21" aria-hidden="true" /><span>{{
            item.label
          }}</span>
        </RouterLink>
      </nav>
    </header>
    <div id="main-content" ref="content" tabindex="-1">
      <RouterView
        v-if="status === 'ready' || route.meta.standalone"
        :key="route.path"
      />
      <main v-else class="reading" role="status">
        <p v-if="status === 'loading'">正在打开学习记录…</p>
        <template v-else>
          <h1>无法读取学习记录</h1>
          <p class="lead">请检查浏览器是否允许此网站使用本地存储。</p>
          <button class="primary" @click="openLibrary">重试</button>
        </template>
      </main>
    </div>
  </div>
</template>
