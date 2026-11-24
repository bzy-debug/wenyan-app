<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CirclePlay,
  Flag,
  Play,
} from "@lucide/vue";
import { byId, course } from "../content";
import type { Unit } from "../content/schema";
import { progress } from "../storage/progress";

import { inProgress } from "./learningPath";

const props = defineProps<{ unit: Unit; currentId?: string; home?: boolean }>();
const levelUnits = computed(() =>
  course.units.filter((unit) => unit.level === props.unit.level),
);
const position = computed(
  () => levelUnits.value.findIndex((unit) => unit.id === props.unit.id) + 1,
);
const levelLessons = computed(() =>
  levelUnits.value.flatMap((unit) => unit.lessonIds),
);
const completed = computed(
  () =>
    props.unit.lessonIds.filter((id) =>
      progress.value.completedIds.includes(id),
    ).length,
);
const steps = computed(() => {
  const lessons = props.unit.lessonIds.map((id) => {
    const lesson = byId(course.lessons, id);
    return {
      id,
      title: lesson.title,
      available: lesson.stage === "available",
      label: "第 " + (levelLessons.value.indexOf(id) + 1) + " 课",
      description: lesson.intro,
      questions: lesson.questionIds.length,
      isCheck: false,
    };
  });
  const assessment = byId(course.assessments, props.unit.assessmentId);
  return [
    ...lessons,
    {
      id: assessment.id,
      title: assessment.title,
      available: assessment.stage === "available",
      label: "单元检查",
      description: props.unit.description,
      questions: assessment.questionIds.length,
      isCheck: true,
    },
  ].map((step) => {
    return { ...step, state: status(step.id, step.available) };
  });
});
const activeUnit = computed(() =>
  steps.value.some((step) => step.id === props.currentId),
);

function status(id: string, available: boolean) {
  if (props.currentId === id) return "current";
  if (progress.value.completedIds.includes(id)) return "completed";
  return available ? "open" : "planned";
}
function startLabel(id: string, isCheck: boolean) {
  if (inProgress(id)) return "继续学习";
  return isCheck ? "开始检查" : "开始学习";
}
</script>

<template>
  <section
    class="unit-track"
    :class="{ 'active-unit': activeUnit }"
    :aria-labelledby="'unit-title-' + unit.id"
  >
    <header class="track-header">
      <div class="unit-symbol"><BookOpen aria-hidden="true" :size="25" /></div>
      <div class="unit-name">
        <div class="unit-label">
          <template v-if="!home">{{ unit.level }} · </template>单元
          {{ String(position).padStart(2, "0") }}
        </div>
        <h2 :id="'unit-title-' + unit.id">{{ unit.title }}</h2>
      </div>
      <div
        class="unit-progress"
        :aria-label="
          '已完成 ' + completed + ' 课，共 ' + unit.lessonIds.length + ' 课'
        "
      >
        <span>{{ completed }} / {{ unit.lessonIds.length }} 课</span>
        <span class="mini-track" aria-hidden="true">
          <i
            v-for="id in unit.lessonIds"
            :key="id"
            :class="{ filled: progress.completedIds.includes(id) }"
          />
        </span>
      </div>
    </header>
    <ol class="track" :aria-label="unit.title + '学习顺序'">
      <li
        v-for="step in steps"
        :key="step.id"
        :class="step.state"
        :aria-current="step.state === 'current' ? 'step' : undefined"
      >
        <span class="node" aria-hidden="true">
          <Play
            v-if="step.state === 'current'"
            :size="19"
            fill="currentColor"
          />
          <Check v-else-if="step.state === 'completed'" :size="19" />
          <Flag v-else-if="step.isCheck" :size="17" />
          <CirclePlay v-else :size="17" />
        </span>
        <component
          :is="step.available ? RouterLink : 'div'"
          v-bind="step.available ? { to: '/learn/' + step.id } : {}"
          :class="[
            step.isCheck ? 'assessment-row' : 'lesson-row',
            'step-content',
          ]"
        >
          <span class="step-info">
            <span class="step-label"
              >{{ step.label }}
              <span v-if="step.state === 'current'" class="current-label">{{
                inProgress(step.id) ? "继续练习" : "推荐练习"
              }}</span>
            </span>
            <strong>{{ step.title }}</strong>
            <span v-if="step.state === 'current' && home" class="step-intro">{{
              step.description
            }}</span>
            <span class="step-detail">
              <template v-if="step.state === 'completed'"
                >已完成 · 再练</template
              >
              <template v-else-if="!step.available">编写中</template>
              <template
                v-else-if="step.state !== 'current' && inProgress(step.id)"
                >继续学习 · {{ step.questions }} 道练习</template
              >
              <template v-else>
                {{ step.questions }} 道练习<template
                  v-if="step.state === 'current' && !step.isCheck"
                >
                  · 5–8 分钟</template
                >
              </template>
            </span>
            <span v-if="step.state === 'current' && home" class="node-action">
              {{ startLabel(step.id, step.isCheck)
              }}<ArrowRight :size="16" aria-hidden="true" />
            </span>
          </span>
          <ChevronRight
            v-if="step.available && !(step.state === 'current' && home)"
            class="enter-icon"
            :size="17"
            aria-hidden="true"
          />
        </component>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.unit-track {
  --track-accent: var(--accent);
  --track-line: #e1e4ec;
  min-width: 0;
}
.track-header {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 88px;
  padding: 17px 22px;
  border: 1px solid #e2e5ee;
  border-radius: 14px;
  background: #f8f9fc;
}
.unit-symbol {
  width: 45px;
  height: 45px;
  flex: none;
  display: grid;
  place-items: center;
  color: #697286;
  background: #e9ecf3;
  border-radius: 12px;
}
.unit-name {
  min-width: 0;
}
.unit-label,
.step-label {
  font-size: 12px;
  font-weight: 600;
}
.unit-label {
  margin-bottom: 2px;
  color: #687087;
}
.track-header h2 {
  margin: 0;
  font-weight: 720;
  font-family: inherit;
  font-size: 23px;
  line-height: 1.35;
  letter-spacing: -0.02em;
}
.unit-progress {
  margin-left: auto;
  align-self: center;
  display: grid;
  gap: 7px;
  justify-items: end;
  white-space: nowrap;
  color: #606981;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.mini-track {
  display: flex;
  gap: 3px;
}
.mini-track i {
  width: 14px;
  height: 4px;
  background: #d8dce8;
  border-radius: 5px;
}
.mini-track .filled {
  background: #239470;
}
.active-unit .track-header {
  color: #fff;
  background: var(--track-accent);
  border-color: var(--track-accent);
}
.active-unit .unit-label,
.active-unit .unit-progress {
  color: #efedff;
}
.active-unit .unit-symbol {
  background: #6c64dd;
  color: #fff;
}
.active-unit .mini-track i {
  background: #837ce3;
}
.active-unit .mini-track .filled {
  background: #a6f4db;
}
.track {
  list-style: none;
  padding: 14px 0 0;
  margin: 0;
}
.track li {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr);
  align-items: start;
  position: relative;
}
.track li:not(:last-child)::after {
  position: absolute;
  z-index: 0;
  content: "";
  width: 3px;
  left: 30px;
  top: 36px;
  bottom: -35px;
  background: var(--track-line);
}
.track li.completed:not(:last-child)::after {
  background: #a7dcc9;
}
.node {
  position: relative;
  z-index: 1;
  justify-self: center;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-top: 18px;
  color: #798297;
  background: #eef0f5;
  border: 3px solid #fff;
  border-radius: 50%;
}
.current .node {
  color: #fff;
  background: var(--track-accent);
  border-color: #edeaff;
  outline: 1px solid #d9d6ff;
  width: 42px;
  height: 42px;
}
.current .node svg {
  margin-left: 2px;
}
.completed .node {
  color: #137357;
  background: #d5f3e8;
}
.step-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 2px 0;
  padding: 12px 16px;
  min-height: 75px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: #283044;
}
a.step-content:hover {
  background: #f6f6fc;
}
.current .step-content {
  background: #f5f4ff;
  border-color: #d8d5fc;
}
.current a.step-content:hover {
  background: #eeecff;
  border-color: #aca5f6;
}
.step-info {
  display: grid;
  justify-items: start;
  min-width: 0;
}
.step-label {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  color: #667088;
  font-variant-numeric: tabular-nums;
}
.current-label {
  color: var(--track-accent);
  font-weight: 700;
}
.current-label::before {
  content: "";
  width: 5px;
  height: 5px;
  display: inline-block;
  vertical-align: 0.18em;
  margin-right: 5px;
  border-radius: 50%;
  background: var(--track-accent);
}
.step-info strong {
  margin: 4px 0 3px;
  font-size: 16px;
  line-height: 1.45;
  font-weight: 650;
}
.current .step-info strong {
  color: #272044;
}
.planned .step-info strong {
  color: #525c70;
}
.step-intro,
.step-detail {
  color: #636d82;
  line-height: 1.6;
}
.step-intro {
  margin: 1px 0 6px;
  font-size: 14px;
}
.step-detail {
  font-size: 12px;
}
.completed .step-detail {
  color: #227761;
}
.node-action {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 8px 15px;
  min-height: 40px;
  margin-top: 13px;
  border-radius: 8px;
  color: #fff;
  background: var(--track-accent);
  font-size: 14px;
  font-weight: 650;
}
.enter-icon {
  color: var(--track-accent);
}
@media (max-width: 560px) {
  .track-header {
    padding: 14px 15px;
    gap: 11px;
    min-height: 76px;
  }
  .track-header h2 {
    font-size: 20px;
  }
  .unit-symbol {
    width: 39px;
    height: 39px;
  }
  .track li {
    grid-template-columns: 46px minmax(0, 1fr);
  }
  .track li:not(:last-child)::after {
    left: 22px;
  }
  .node {
    width: 32px;
    height: 32px;
  }
  .current .node {
    width: 35px;
    height: 35px;
  }
  .step-content {
    padding: 12px;
  }
}
</style>
