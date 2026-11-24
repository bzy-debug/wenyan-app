<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { ArrowRight, BookOpen, Check, CircleCheck } from "@lucide/vue";
import { byId, course } from "../content";
import { initProgress, progress } from "../storage/progress";
import { roundTitle } from "./roundLabels";

const loading = ref(true);
const error = ref("");
onMounted(async () => {
  try {
    await initProgress();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "无法读取本地成绩。";
  } finally {
    loading.value = false;
  }
});
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
  <main class="reading">
    <p v-if="loading" role="status">正在读取结算…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <section v-else-if="!result">
      <h1>还没有结算记录</h1>
      <RouterLink class="primary" to="/path"
        >查看课程路径<ArrowRight
      /></RouterLink>
    </section>
    <template v-else>
      <div class="eyebrow"><CircleCheck :size="18" />练习结算</div>
      <h1>{{ heading }}</h1>
      <p class="lead">{{ roundTitle(result.kind, result.targetId) }}</p>
      <section class="score">
        <span>无提示首答正确</span
        ><strong
          >{{ result.earned }}<small> / {{ result.total }}</small></strong
        ><span>本轮经验 +{{ result.xp }} XP</span>
      </section>
      <template v-if="result.coverage.length">
        <h2>本轮知识点表现</h2>
        <div class="coverage">
          <div v-for="item in result.coverage" :key="item.id">
            <span
              >{{ byId(course.skills, item.id).word }} ·
              {{ byId(course.skills, item.id).meaning }}</span
            >
            <b
              >{{ item.earned }} / {{ item.total }}
              <Check v-if="item.earned > 0" :size="15" aria-hidden="true"
            /></b>
          </div>
        </div>
      </template>
      <p v-if="result.kind === 'review' && progress.cards[result.targetId]">
        下次复习日期 ·
        <time :datetime="progress.cards[result.targetId].due">{{
          progress.cards[result.targetId].due
        }}</time>
      </p>
      <p v-if="result.kind === 'mistake' && !result.passed">
        本题保留在错题中。下一次订正时，无提示首答正确即可移出。
      </p>
      <p v-if="!result.passed && courseRound">
        {{
          result.kind === "lesson"
            ? "通过条件为至少 6 题无提示首答正确，且每个主要知识点至少 1 题达标。"
            : "通过条件为至少 4 题无提示首答正确。"
        }}
        可以重开一轮练习。
      </p>
      <p v-if="courseRound && result.passed && !nextTarget">
        你已通过 L1 的最后一关，接下来可用到期知识卡巩固阅读能力。
      </p>
      <div class="actions">
        <RouterLink
          v-if="nextTarget"
          class="primary"
          :to="'/learn/' + nextTarget.id"
          >下一关 · {{ nextTarget.title }}<ArrowRight
        /></RouterLink>
        <RouterLink
          :class="nextTarget ? 'secondary' : 'primary'"
          :to="courseRound ? '/path' : '/review'"
          >{{ courseRound ? "查看课程路径" : "返回复习" }}<ArrowRight
        /></RouterLink>
        <RouterLink
          v-if="courseRound"
          class="secondary"
          :to="'/learn/' + result.targetId"
          ><BookOpen :size="16" />再学一次</RouterLink
        >
      </div>
    </template>
  </main>
</template>
