<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  ChevronRight,
  Flame,
  Layers,
  ListRestart,
  Zap,
} from "@lucide/vue";
import { course } from "../content";
import { dueCards, progress, streak } from "../storage/progress";
import { currentTarget, isDraftCourse } from "./learningPath";
import UnitPath from "./UnitPath.vue";

const active = computed(() => progress.value.active);
const taskId = computed(currentTarget);
const firstUnfinishedUnit = computed(() =>
  course.units.find((unit) =>
    [...unit.lessonIds, unit.assessmentId].some(
      (id) => !progress.value.passedIds.includes(id),
    ),
  ),
);
const unit = computed(
  () =>
    course.units.find(
      (unit) =>
        unit.lessonIds.includes(taskId.value || "") ||
        unit.assessmentId === taskId.value,
    ) ??
    firstUnfinishedUnit.value ??
    course.units.at(-1)!,
);
const level = computed(() =>
  course.levels.find((level) => level.id === unit.value.level)!,
);
const passedLessons = computed(
  () =>
    course.lessons.filter((lesson) =>
      progress.value.passedIds.includes(lesson.id),
    ).length,
);
const practicing = computed(
  () => active.value?.kind === "review" || active.value?.kind === "mistake",
);
const percent = computed(() =>
  Math.round((passedLessons.value / course.lessons.length) * 100),
);
</script>

<template>
  <main class="shell dashboard">
    <header class="home-heading">
      <h1>今日学习</h1>
      <p>
        <b>{{ level.id }}</b>{{ level.title }}
      </p>
    </header>
    <div class="dashboard-grid">
      <div class="main-column">
        <div v-if="practicing || !taskId" class="resume">
          <component
            :is="practicing ? ListRestart : CheckCheck"
            :size="24"
            aria-hidden="true"
          />
          <div>
            <h2>
              {{
                practicing
                  ? active?.kind === "review"
                    ? "知识卡复习进行中"
                    : "错题订正进行中"
                  : firstUnfinishedUnit
                    ? "后续课程准备中"
                    : "已完成课程路径"
              }}
            </h2>
            <RouterLink
              class="resume-action"
              :to="practicing ? '/practice' : '/review'"
            >
              {{ practicing ? "继续练习" : "前往复习"
              }}<ArrowRight :size="16" />
            </RouterLink>
          </div>
        </div>
        <div class="track-heading">
          <h2>当前单元</h2>
          <RouterLink to="/path"
            >完整路径<ArrowUpRight :size="15" aria-hidden="true"
          /></RouterLink>
        </div>
        <UnitPath :unit="unit" :current-id="taskId" :home="!practicing" />
      </div>
      <aside class="record" aria-labelledby="record-title">
        <h2 id="record-title">学习概览</h2>
        <div class="record-panel">
          <div class="completion">
            <svg viewBox="0 0 64 64" class="completion-ring" aria-hidden="true">
              <circle class="ring-track" cx="32" cy="32" r="27" />
              <circle
                v-if="percent > 0"
                class="ring-filled"
                cx="32"
                cy="32"
                r="27"
                pathLength="100"
                :stroke-dasharray="percent + ' 100'"
              />
            </svg>
            <strong class="completion-label"
              >{{ percent }}<small>%</small></strong
            >
            <div class="completion-copy">
              <b>课程进度</b>
              <span
                >已通过 {{ passedLessons }} /
                {{ course.lessons.length }} 课</span
              >
            </div>
          </div>
          <dl class="metrics">
            <div>
              <Flame aria-hidden="true" :size="17" />
              <dt>连续学习</dt>
              <dd>{{ streak() }} 天</dd>
            </div>
            <div>
              <Zap aria-hidden="true" :size="17" />
              <dt>累计经验</dt>
              <dd>{{ progress.xp }} XP</dd>
            </div>
          </dl>
          <RouterLink class="review-link" to="/review"
            ><Layers aria-hidden="true" :size="17" /><span>到期复习</span
            ><b>{{ dueCards().length }} 张</b><ChevronRight :size="14"
          /></RouterLink>
        </div>
      </aside>
    </div>
    <small v-if="isDraftCourse" class="content-state"
      >课程内容 · 草稿试用</small
    >
  </main>
</template>

<style scoped>
.dashboard {
  min-width: 0;
}
.home-heading {
  margin: 0 0 28px;
}
.home-heading h1 {
  font-family: inherit;
  font-size: clamp(28px, 3.3vw, 38px);
  line-height: 1.25;
  letter-spacing: -0.04em;
}
.home-heading p {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 9px 0 0;
  color: #626c80;
  font-size: 14px;
}
.home-heading p b {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 6px;
  border-radius: 5px;
  background: #eeedff;
  color: var(--accent-strong);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
  letter-spacing: 0.035em;
}
.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(210px, 0.43fr);
  gap: clamp(18px, 3vw, 42px);
  align-items: start;
}
.main-column {
  min-width: 0;
}
.track-heading,
.record > h2 {
  margin: 0 0 13px;
}
.record > h2,
.track-heading h2,
.resume h2 {
  margin-top: 0;
  font-family: inherit;
  font-size: 18px;
  line-height: 1.4;
  font-weight: 730;
  letter-spacing: -0.025em;
}
.track-heading h2,
.resume h2 {
  margin-bottom: 0;
}
.track-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.track-heading a,
.resume-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--accent-strong);
  font-size: 13px;
  font-weight: 650;
}
.record-panel {
  border: 1px solid #e0e4ed;
  border-radius: 14px;
  background: #fff;
  padding: 19px;
}
.completion {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  column-gap: 13px;
  align-items: center;
}
.completion-ring,
.completion-label {
  grid-row: 1;
  grid-column: 1;
}
.completion-ring {
  width: 58px;
  height: 58px;
  transform: rotate(-90deg);
}
.completion-ring circle {
  fill: none;
  stroke-width: 5px;
}
.ring-track {
  stroke: #e8e7fa;
}
.ring-filled {
  stroke: var(--accent);
  stroke-linecap: round;
}
.completion-label {
  text-align: center;
  font-size: 19px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: #393456;
}
.completion-label small {
  font-size: 10px;
}
.completion-copy {
  display: grid;
  gap: 3px;
}
.completion-copy b {
  font-size: 14px;
}
.completion-copy span {
  color: #647087;
  font-size: 12px;
}
.metrics {
  display: grid;
  gap: 12px;
  padding: 16px 0;
  margin: 16px 0 0;
  border-block: 1px solid #e8eaf1;
}
.metrics div,
.review-link {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
}
.metrics svg {
  color: #746abf;
}
.metrics dd,
.review-link b {
  margin-left: auto;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
}
.review-link {
  min-height: 40px;
  padding-top: 10px;
  color: var(--accent-strong);
}
.resume {
  display: flex;
  gap: 13px;
  align-items: start;
  padding: 17px 19px;
  border: 1px solid #d9d6fb;
  background: #f6f5ff;
  border-radius: 12px;
  margin-bottom: 21px;
  color: #4941b2;
}
.resume-action {
  margin-top: 8px;
  min-height: 38px;
  padding-inline: 13px;
  border-radius: 7px;
  background: var(--accent-strong);
  color: #fff;
}
.content-state {
  display: block;
  margin: 22px 0 3px;
  color: #667187;
  font-size: 12px;
}
@media (max-width: 1040px) and (min-width: 840px), (max-width: 680px) {
  .dashboard-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
  .record-panel {
    max-width: none;
  }
}
@media (max-width: 560px) {
  .home-heading {
    margin-bottom: 19px;
  }
  .home-heading h1 {
    font-size: 29px;
  }
}
</style>
