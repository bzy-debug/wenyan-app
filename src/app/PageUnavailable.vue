<script setup lang="ts">
import { useRoute } from "vue-router";

const route = useRoute();
function reopen() {
  window.location.reload();
}
</script>

<template>
  <main class="reading">
    <h1>这个页面没能打开</h1>
    <p class="lead">请检查网络连接，再试一次。</p>
    <div class="recovery-actions">
      <button class="primary" type="button" @click="reopen">重新打开</button>
      <RouterLink v-if="route.path !== '/path'" class="secondary" to="/path">
        返回课程路径
      </RouterLink>
    </div>
  </main>
</template>

<style scoped>
.recovery-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
</style>
