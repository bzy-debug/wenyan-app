<script setup lang="ts">
import { computed } from "vue";
import { Flag } from "@lucide/vue";
import { course } from "../content";
import { progress } from "../storage/progress";
import UnitPath from "./UnitPath.vue";

const passed = computed(
  () =>
    course.lessons.filter((lesson) =>
      progress.value.passedIds.includes(lesson.id),
    ).length,
);
const passedChecks = computed(
  () =>
    course.assessments.filter((assessment) =>
      progress.value.passedIds.includes(assessment.id),
    ).length,
);
</script>

<template>
  <main class="shell path">
    <div class="eyebrow"><span class="dash" /> L1 · 读懂单句</div>
    <h1>课程路径</h1>
    <p class="lead">
      从辨认一个词，到读懂一段古文。循序完成各课，通过单元检查后进入下一单元。
    </p>
    <div class="overview">
      <Flag :size="17" aria-hidden="true" />
      <span
        >已通过 <b>{{ passed }} / {{ course.lessons.length }}</b> 课</span
      >
      <span class="overview-separator" aria-hidden="true"></span>
      <span
        ><b>{{ passedChecks }} / {{ course.assessments.length }}</b>
        项单元检查</span
      >
      <small>教学内容 · 草稿试用</small>
    </div>
    <div class="path-grid">
      <UnitPath v-for="unit in course.units" :key="unit.id" :unit="unit" />
    </div>
  </main>
</template>

<style scoped>
.path {
  padding-bottom: 48px;
}
.overview {
  color: var(--muted);
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  align-items: center;
  border-top: 1px solid var(--line);
  padding-block: 15px;
  font-size: 13px;
}
.overview b,
.overview svg {
  color: var(--green);
}
.overview small {
  margin-left: auto;
  font-size: 12px;
}
.overview-separator {
  height: 13px;
  border-left: 1px solid var(--line);
}
@media (max-width: 450px) {
  .overview {
    gap: 6px;
  }
  .overview small {
    width: 100%;
    margin-left: 23px;
  }
}
</style>
