<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import {
  ArrowRight,
  BookOpen,
  Check,
  ListChecks,
  RotateCcw,
  Sparkles,
} from "@lucide/vue";
import { course } from "../content";
import LessonReading from "../components/LessonReading.vue";
import { progress } from "../storage/progress";
import { currentTarget, levelOfTarget } from "./learningPath";
import { roundTitle } from "./roundLabels";
import "./study.css";

const result = computed(() => progress.value.lastResult);
const levelId = computed(() => levelOfTarget(result.value?.targetId));
const courseRound = computed(
  () => result.value?.kind === "lesson" || result.value?.kind === "assessment",
);
const lesson = computed(() =>
  result.value?.kind === "lesson"
    ? course.lessons.find((lesson) => lesson.id === result.value?.targetId)
    : null,
);
const headings = {
  lesson: "这节课学完了",
  assessment: "单元自测做完了",
  review: "复习完了",
  mistake: "订正完了",
};
const recommended = computed(() => {
  if (!courseRound.value) return;
  const id = currentTarget();
  if (!id || id === result.value?.targetId) return;
  return (
    course.lessons.find((lesson) => lesson.id === id) ??
    course.assessments.find((check) => check.id === id)
  );
});
</script>

<template>
  <main class="study-result">
    <div class="study-width result-content">
      <section v-if="!result">
        <h1>还没有完成的练习</h1>
        <RouterLink class="primary" to="/path"
          >查看课程路径<ArrowRight aria-hidden="true"
        /></RouterLink>
      </section>
      <template v-else>
        <div class="result-icon" aria-hidden="true"><Check :size="31" /></div>
        <h1>{{ headings[result.kind] }}</h1>
        <p class="result-title">
          {{ roundTitle(result.kind, result.targetId) }}
        </p>
        <dl class="result-stats">
          <div>
            <dt><ListChecks :size="16" aria-hidden="true" />已练习</dt>
            <dd>{{ result.total }} <small>题</small></dd>
          </div>
          <div>
            <dt><Sparkles :size="16" aria-hidden="true" />获得经验</dt>
            <dd>+{{ result.xp }} <small>XP</small></dd>
          </div>
        </dl>
        <p v-if="result.kind === 'review' && progress.cards[result.targetId]">
          下次复习
          <time :datetime="progress.cards[result.targetId].due">{{
            progress.cards[result.targetId].due
          }}</time>
        </p>
        <p
          v-if="
            result.kind === 'mistake' &&
            progress.mistakes.includes(result.targetId)
          "
        >
          这道题还在错题里，想再试时可以回来做。
        </p>
        <div class="result-actions">
          <RouterLink
            v-if="recommended"
            class="primary"
            :to="'/learn/' + recommended.id"
          >
            接着学 · {{ recommended.title }}<ArrowRight aria-hidden="true" />
          </RouterLink>
          <RouterLink
            :class="recommended ? 'secondary' : 'primary'"
            :to="
              courseRound
                ? { path: '/path', query: { level: levelId } }
                : '/review'
            "
          >
            {{ courseRound ? "查看课程路径" : "返回复习"
            }}<ArrowRight :size="16" aria-hidden="true" />
          </RouterLink>
          <RouterLink
            v-if="courseRound"
            class="secondary"
            :to="'/learn/' + result.targetId"
          >
            <RotateCcw :size="16" aria-hidden="true" />再练一次
          </RouterLink>
        </div>
        <details v-if="lesson" class="result-guide">
          <summary><BookOpen :size="17" aria-hidden="true" />回看讲解</summary>
          <LessonReading :lesson="lesson" :course="course" />
        </details>
      </template>
    </div>
  </main>
</template>

<style scoped>
.result-guide {
  border-top: 1px solid var(--study-line);
  margin-top: 26px;
  padding-top: 6px;
}
.result-guide summary {
  cursor: pointer;
  color: var(--study-accent);
  font-weight: 650;
  padding-block: 12px;
}
.result-guide summary svg {
  vertical-align: -0.15em;
  margin-inline: 4px;
}
</style>
