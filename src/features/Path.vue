<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { ArrowRight, BookOpen, ListChecks } from "@lucide/vue";
import { completedCount, currentTarget, inProgress, learningPath } from "./learningPath";
import CourseLevels from "./CourseLevels.vue";
import UnitPath from "./UnitPath.vue";

const route = useRoute();
const { levels, lessons, assessments } = learningPath;
const jumpLevel = computed(
  () => levels.find((level) => level.id === route.query.level)?.id,
);
function jumpToSection() {
  if (!jumpLevel.value) return;
  const section = document.getElementById("level-" + jumpLevel.value);
  section?.focus({ preventScroll: true });
  section?.scrollIntoView?.({ block: "start" });
}
onMounted(jumpToSection);
watch(jumpLevel, jumpToSection, { flush: "post" });

const current = computed(currentTarget);
const recommendation = computed(() => {
  const id = current.value;
  if (!id) return;
  const lesson = lessons.find((item) => item.id === id);
  const target = lesson ?? assessments.find((item) => item.id === id);
  if (!target) return;
  const action = inProgress(id) ? "继续学习" : lesson ? "开始学习" : "开始自测";
  return { id, label: action + " · " + target.title };
});
const completedLessons = computed(() => completedCount(lessons));
const completedChecks = computed(() => completedCount(assessments));
</script>

<template>
  <main class="shell path">
    <header class="path-title">
      <h1>课程路径</h1>
      <div v-if="lessons.length || assessments.length" class="overview">
        <ListChecks :size="17" aria-hidden="true" />
        <span>已完成</span>
        <span v-if="lessons.length">
          <b>{{ completedLessons }} / {{ lessons.length }}</b> 课
        </span>
        <i v-if="lessons.length && assessments.length" aria-hidden="true" />
        <span v-if="assessments.length">
          <b>{{ completedChecks }} / {{ assessments.length }}</b>
          次单元自测
        </span>
      </div>
      <div class="path-actions">
        <RouterLink
          v-if="recommendation"
          class="primary"
          :to="'/learn/' + recommendation.id"
        >
          {{ recommendation.label }}<ArrowRight :size="17" aria-hidden="true" />
        </RouterLink>
        <template v-else>
          <span
            v-if="
              levels.length &&
              completedLessons === lessons.length &&
              completedChecks === assessments.length
            "
          >
            所有课和单元自测都做完了
          </span>
          <RouterLink class="primary" to="/review">前往复习</RouterLink>
        </template>
        <RouterLink class="text-link" to="/read">
          <BookOpen :size="17" aria-hidden="true" />整篇自读
        </RouterLink>
      </div>
    </header>
    <CourseLevels :selected="jumpLevel" />
    <section
      v-for="level in levels"
      :id="'level-' + level.id"
      :key="level.id"
      class="map-level"
      tabindex="-1"
      :aria-labelledby="'title-' + level.id"
    >
      <header class="level-head">
        <h2 :id="'title-' + level.id">
          <span>{{ level.id }}</span> {{ level.title }}
        </h2>
        <p>{{ level.goal }}</p>
      </header>
      <div class="path-units">
        <UnitPath
          v-for="unit in level.units"
          :key="unit.id"
          :unit="unit"
          :current-id="current"
        />
      </div>
    </section>
  </main>
</template>

<style scoped>
.path {
  max-width: 54rem;
}
.path-title h1 {
  font-family: inherit;
}
.overview,
.path-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.overview {
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
  margin: 10px 0 18px;
}
.overview svg,
.overview b {
  color: var(--accent-strong);
}
.overview i {
  height: 13px;
  border-left: 1px solid var(--line);
}
.path-actions {
  gap: 10px 22px;
  margin-bottom: 22px;
}
.path-actions .text-link {
  min-height: 44px;
  font-size: 14px;
}
.map-level {
  scroll-margin-top: 16px;
  margin-top: 36px;
}
.map-level:focus {
  outline: none;
}
.map-level:focus-visible > .level-head h2 {
  width: fit-content;
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.level-head {
  margin-bottom: 14px;
}
.level-head h2 {
  font-size: clamp(21px, 2.2vw, 28px);
}
.level-head h2 span {
  margin-right: 4px;
  color: var(--accent-strong);
}
.level-head p {
  color: var(--muted);
  font-size: 14px;
  margin-top: 5px;
}
.path-units {
  --connector-x: 30px;
  display: grid;
  gap: 16px;
}
.path-units :deep(.track) {
  position: relative;
}
.path-units :deep(.track)::before,
.path-units :deep(.unit-track:not(:last-child) .track li:last-child)::after {
  position: absolute;
  left: var(--connector-x);
  width: 3px;
  content: "";
  background: var(--track-line);
}
.path-units :deep(.track)::before {
  top: 0;
  height: 50px;
}
.path-units :deep(.unit-track:not(:last-child) .track li:last-child)::after {
  top: 36px;
  bottom: -16px;
}
@media (max-width: 560px) {
  .path-units {
    --connector-x: 22px;
  }
}
</style>
