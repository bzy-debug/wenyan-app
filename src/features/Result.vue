<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleDot,
  Flag,
  RotateCcw,
  Sparkles,
  Target,
} from "@lucide/vue";
import { byId, course } from "../content";
import { progress } from "../storage/progress";
import "./study.css";
import { roundTitle } from "./roundLabels";

const result = computed(() => progress.value.lastResult);
const courseRound = computed(
  () => result.value?.kind === "lesson" || result.value?.kind === "assessment",
);
const heading = computed(() => {
  const r = result.value;
  if (!r) return "";
  if (r.kind === "review") return "本次复习完成";
  if (r.kind === "mistake") return r.passed ? "本题已订正" : "仍需订正";
  if (!r.passed) return "本轮练习完成";
  return r.kind === "lesson" ? "本课已通过" : "单元检查已通过";
});
const target = computed(() =>
  result.value?.kind === "lesson"
    ? course.lessons.find((l) => l.id === result.value?.targetId)
    : course.assessments.find((a) => a.id === result.value?.targetId),
);
const nextTarget = computed(() => {
  const r = result.value;
  if (!r || !courseRound.value || !r.passed) return null;
  const ids = course.units.flatMap((u) => [...u.lessonIds, u.assessmentId]);
  const nextId = ids[ids.indexOf(r.targetId) + 1];
  return nextId
    ? {
        id: nextId,
        title: roundTitle(
          course.lessons.some((l) => l.id === nextId) ? "lesson" : "assessment",
          nextId,
        ),
      }
    : null;
});
</script>
<template>
  <main class="study-result">
    <div class="study-width result-content">
      <section v-if="!result">
        <h1>还没有结算记录</h1>
        <RouterLink class="primary" to="/path"
          >查看课程路径<ArrowRight aria-hidden="true"
        /></RouterLink>
      </section>
      <template v-else>
        <div
          class="result-icon"
          :class="{ replay: !result.passed }"
          aria-hidden="true"
        >
          <component :is="result.passed ? Flag : RotateCcw" :size="31" />
        </div>
        <h1>{{ heading }}</h1>
        <p class="result-title">
          {{ roundTitle(result.kind, result.targetId) }}
        </p>
        <dl class="result-stats">
          <div class="score">
            <dt><Target :size="16" aria-hidden="true" />无提示首答正确</dt>
            <dd>
              <strong
                >{{ result.earned }}<small> / {{ result.total }}</small></strong
              >
            </dd>
          </div>
          <div>
            <dt><Sparkles :size="16" aria-hidden="true" />本轮经验</dt>
            <dd>+{{ result.xp }} <small>XP</small></dd>
          </div>
        </dl>
        <section v-if="result.coverage.length" class="result-coverage">
          <h2>本轮知识点表现</h2>
          <ul>
            <li v-for="item in result.coverage" :key="item.id">
              <Check
                v-if="item.earned"
                class="skill-mark"
                :size="16"
                aria-hidden="true"
              /><CircleDot
                v-else
                class="skill-missed"
                :size="16"
                aria-hidden="true"
              />
              <span
                >{{ byId(course.skills, item.id).word }} ·
                {{ byId(course.skills, item.id).meaning }}</span
              ><b>{{ item.earned }} / {{ item.total }}</b>
            </li>
          </ul>
        </section>
        <p v-if="result.kind === 'review' && progress.cards[result.targetId]">
          下次复习
          <time :datetime="progress.cards[result.targetId].due">{{
            progress.cards[result.targetId].due
          }}</time>
        </p>
        <p v-if="result.kind === 'mistake' && !result.passed">
          这道题会留在错题里。再试一次，无提示首答正确即可移出。
        </p>
        <p v-if="courseRound && !result.passed">
          下次争取 {{ target?.passCount }} 题无提示首答正确{{
            result.kind === "lesson" ? "，并覆盖每个主要知识点" : ""
          }}，就能通过。
        </p>
        <p v-if="courseRound && result.passed && !nextTarget">
          你已完成《{{
            course.title
          }}》的全部课程。到复习页换个语境，试试自己能否独立读懂。
        </p>
        <div class="result-actions">
          <RouterLink
            v-if="nextTarget"
            class="primary"
            :to="'/learn/' + nextTarget.id"
            >下一关 · {{ nextTarget.title }}<ArrowRight aria-hidden="true"
          /></RouterLink>
          <RouterLink
            v-else-if="courseRound && !result.passed"
            class="primary"
            :to="'/learn/' + result.targetId"
            >再学一次<RotateCcw :size="16" aria-hidden="true"
          /></RouterLink>
          <RouterLink
            :class="
              courseRound && (nextTarget || !result.passed)
                ? 'secondary'
                : 'primary'
            "
            :to="courseRound ? '/path' : '/review'"
            >{{ courseRound ? "查看课程路径" : "返回复习"
            }}<ArrowRight :size="16" aria-hidden="true"
          /></RouterLink>
          <RouterLink
            v-if="courseRound && result.passed"
            class="secondary"
            :to="'/learn/' + result.targetId"
            ><BookOpen :size="16" aria-hidden="true" />再学一次</RouterLink
          >
        </div>
      </template>
    </div>
  </main>
</template>
