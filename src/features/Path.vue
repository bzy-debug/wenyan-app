<script setup lang="ts">
import { computed } from "vue";
import { ListChecks } from "@lucide/vue";
import { course } from "../content";
import { progress } from "../storage/progress";
import { currentTarget, isDraftCourse } from "./learningPath";
import UnitPath from "./UnitPath.vue";

const current = computed(currentTarget);
const completedLessons = computed(
  () =>
    course.lessons.filter((lesson) =>
      progress.value.completedIds.includes(lesson.id),
    ).length,
);
const completedChecks = computed(
  () =>
    course.assessments.filter((check) =>
      progress.value.completedIds.includes(check.id),
    ).length,
);
</script>

<template>
  <main class="shell path">
    <header class="path-title">
      <h1>课程路径</h1>
      <p>可任选一课或单元检查开始。切换练习时会保留已做的进度。</p>
    </header>
    <div class="overview">
      <ListChecks :size="17" aria-hidden="true" />
      <span
        >已完成
        <b>{{ completedLessons }} / {{ course.lessons.length }}</b> 课</span
      >
      <i aria-hidden="true" />
      <span
        ><b>{{ completedChecks }} / {{ course.assessments.length }}</b>
        项单元检查</span
      >
    </div>
    <div class="path-grid">
      <UnitPath
        v-for="unit in course.units"
        :key="unit.id"
        :unit="unit"
        :current-id="current"
      />
    </div>
    <small v-if="isDraftCourse" class="content-state"
      >课程内容 · 草稿试用</small
    >
  </main>
</template>

<style scoped>
.path-title h1 {
  margin: 0;
  font-family: inherit;
  font-size: clamp(28px, 3.3vw, 38px);
  letter-spacing: -0.04em;
  line-height: 1.25;
}
.path-title p {
  color: #647087;
  margin: 9px 0 0;
  font-size: 14px;
  line-height: 1.7;
}
.overview {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px;
  color: #657088;
  font-size: 13px;
  margin: 20px 0;
}
.overview svg,
.overview b {
  color: var(--accent-strong);
}
.overview i {
  height: 13px;
  border-left: 1px solid #d7dce7;
}
.path-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 23px;
  align-items: start;
}
.content-state {
  display: block;
  margin: 20px 0 0;
  color: #667187;
  font-size: 12px;
}
@media (max-width: 1060px) and (min-width: 840px), (max-width: 690px) {
  .path-grid {
    grid-template-columns: 1fr;
  }
}
</style>
