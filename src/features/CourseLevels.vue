<script setup lang="ts">
import { RouterLink } from "vue-router";
import { course } from "../content";

defineProps<{ selected?: string }>();
</script>

<template>
  <nav class="course-levels" aria-label="跳到学习等级">
    <span class="jump-label" aria-hidden="true">跳至</span>
    <div class="level-links">
      <RouterLink
        v-for="level in course.levels"
        :key="level.id"
        class="level-link"
        :to="{ path: '/path', query: { level: level.id } }"
        :aria-label="level.id + ' ' + level.title"
        :aria-current="selected === level.id ? 'page' : undefined"
      >
        <b>{{ level.id }}</b>
        <span class="level-title">{{ level.title }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.course-levels {
  container-type: inline-size;
  display: flex;
  gap: 8px;
  align-items: center;
  border-block: 1px solid var(--line);
}
.jump-label {
  flex: none;
  color: var(--muted);
  font-size: 13px;
}
.level-links {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
}
.level-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 44px;
  padding: 4px 0;
  color: var(--accent-strong);
  border-radius: 5px;
  text-align: center;
}
.level-link b {
  font-size: 14px;
}
.level-link:hover,
.level-link[aria-current="page"] {
  background: var(--accent-tint);
}
.level-link:hover b,
.level-link[aria-current="page"] b {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.level-title {
  display: none;
}
@container (min-width: 32rem) {
  .level-link {
    flex-direction: column;
    gap: 1px;
  }
  .level-title {
    display: block;
    font-size: 13px;
    line-height: 1.45;
  }
}
@container (min-width: 43rem) {
  .level-link {
    flex-direction: row;
    gap: 5px;
  }
}
</style>
