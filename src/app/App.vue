<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  BookOpen,
  Compass,
  LibraryBig,
  Route,
  Settings2,
  Repeat2,
} from "@lucide/vue";
import { initProgress } from "../storage/progress";

const destinations = [
  { to: "/", label: "今日学习", icon: Compass },
  { to: "/path", label: "课程路径", icon: Route },
  { to: "/review", label: "复习", icon: Repeat2 },
  { to: "/knowledge", label: "知识库", icon: LibraryBig },
  { to: "/settings", label: "设置", icon: Settings2 },
];
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
onMounted(openLibrary);
</script>
<template>
  <a
    href="#main-content"
    class="skip-link"
    @click.prevent="($refs.content as HTMLElement)?.focus()"
    >跳到正文</a
  >
  <header class="top">
    <div class="top-inner">
      <RouterLink to="/" class="brand"
        ><span class="mark"><BookOpen :size="23" /></span>文言拾阶</RouterLink
      >
      <nav aria-label="主导航">
        <RouterLink
          v-for="link in destinations"
          :key="link.to"
          :to="link.to"
          exact-active-class="active"
        >
          <component :is="link.icon" aria-hidden="true" />{{ link.label }}
        </RouterLink>
      </nav>
      <span class="level">L1 <i /> 读懂单句</span>
    </div>
  </header>
  <div id="main-content" ref="content" tabindex="-1">
    <RouterView v-if="status === 'ready'" :key="$route.path" />
    <main v-else class="reading" role="status">
      <p v-if="status === 'loading'">正在打开本地学习记录…</p>
      <template v-else
        ><h1>暂时无法打开学习记录</h1>
        <p>请检查浏览器是否允许本网站使用本地存储，再重新打开。</p>
        <button class="primary" @click="openLibrary">重试</button></template
      >
    </main>
  </div>
</template>
