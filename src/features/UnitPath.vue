<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { Check, ChevronRight, Flag, LockKeyhole } from "@lucide/vue";
import { byId, course } from "../content";
import type { Unit } from "../content/schema";
import { isUnlocked, progress } from "../storage/progress";

const props = defineProps<{ unit: Unit; compact?: boolean }>();
const numerals = ["一", "二", "三", "四"];
const position = computed(() =>
  course.units.findIndex((unit) => unit.id === props.unit.id),
);
const lessons = computed(() =>
  props.unit.lessonIds.map((id) => byId(course.lessons, id)),
);
const assessment = computed(() =>
  byId(course.assessments, props.unit.assessmentId),
);
const completed = computed(
  () =>
    props.unit.lessonIds.filter((id) => progress.value.passedIds.includes(id))
      .length,
);

function status(id: string) {
  if (progress.value.active?.targetId === id) return "学习中";
  if (progress.value.passedIds.includes(id)) return "已通过 · 可重练";
  if (isUnlocked(id)) return "可学习";
  return "待解锁";
}
</script>

<template>
  <section class="unit-preview">
    <div class="unit-head">
      <div class="unit-line">
        <div class="unit-kicker">
          第{{ numerals[position] || position + 1 }}单元
        </div>
        <small class="unit-count"
          >{{ completed }} / {{ lessons.length }} 课</small
        >
      </div>
      <h2>{{ unit.title }}</h2>
      <p v-if="!compact">{{ unit.description }}</p>
    </div>
    <ol class="lesson-list">
      <li v-for="lesson in lessons" :key="lesson.id">
        <component
          :is="isUnlocked(lesson.id) ? RouterLink : 'div'"
          v-bind="isUnlocked(lesson.id) ? { to: '/learn/' + lesson.id } : {}"
          class="lesson-row"
          :class="{
            available: isUnlocked(lesson.id),
            done: progress.passedIds.includes(lesson.id),
          }"
        >
          <span class="step-num" aria-hidden="true">
            <Check v-if="progress.passedIds.includes(lesson.id)" :size="18" />
            <template v-else>{{
              String(course.lessons.indexOf(lesson) + 1).padStart(2, "0")
            }}</template>
          </span>
          <span class="row-title"
            >{{ lesson.title }}
            <small
              >{{ status(lesson.id)
              }}<template v-if="isUnlocked(lesson.id)">
                · {{ lesson.questionIds.length }} 道练习</template
              ></small
            >
          </span>
          <ChevronRight v-if="isUnlocked(lesson.id)" :size="18" />
          <LockKeyhole v-else :size="15" />
        </component>
      </li>
    </ol>
    <component
      :is="isUnlocked(assessment.id) ? RouterLink : 'div'"
      v-bind="
        isUnlocked(assessment.id) ? { to: '/learn/' + assessment.id } : {}
      "
      class="assessment"
      :class="{ accessible: isUnlocked(assessment.id) }"
    >
      <Flag v-if="isUnlocked(assessment.id)" :size="15" /><LockKeyhole
        v-else
        :size="14"
      />
      <span>单元检查 · {{ assessment.questionIds.length }} 题</span>
      <span class="check-status">{{
        isUnlocked(assessment.id)
          ? status(assessment.id)
          : "通过本单元课程后解锁"
      }}</span>
      <ChevronRight v-if="isUnlocked(assessment.id)" :size="15" />
    </component>
  </section>
</template>

<style scoped>
.unit-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.unit-count {
  font:
    12px/1.3 system-ui,
    sans-serif;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.step-num {
  flex-shrink: 0;
}
.row-title {
  color: var(--ink);
}
.done {
  background: #f6f8f1;
}
.done .step-num {
  color: var(--green);
  background: #dce8da;
}
.check-status {
  margin-left: auto;
  font-size: 12px;
}
.accessible {
  background: #e2ecdb;
  color: var(--green);
  font-weight: 600;
}
.accessible:hover {
  background: #d7e4cf;
}
.assessment {
  min-height: 43px;
}
@media (max-width: 365px) {
  .assessment {
    padding-inline: 13px;
    gap: 5px;
  }
}
</style>
