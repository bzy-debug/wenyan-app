<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ArrowLeft, ArrowRight, CircleHelp, RotateCcw } from "@lucide/vue";
import { byId, course, optionText } from "../content";
import QuestionInput from "../components/questions/QuestionInput.vue";
import {
  advance,
  initProgress,
  isUnlocked,
  progress,
  retryAnswer,
  selectAnswer,
  showHint,
  startQuestions,
  startRound,
  submitAnswer,
} from "../storage/progress";
import { passageLabel, roundTitle, studyLink } from "./roundLabels";

const route = useRoute();
const router = useRouter();
const targetId = computed(() => String(route.params.id || ""));
const lesson = computed(() =>
  course.lessons.find((l) => l.id === targetId.value),
);
const assessment = computed(() =>
  course.assessments.find((a) => a.id === targetId.value),
);
const unit = computed(() =>
  course.units.find(
    (u) =>
      u.lessonIds.includes(targetId.value) || u.assessmentId === targetId.value,
  ),
);
const active = computed(() => progress.value.active);
const round = computed(() => {
  const current = active.value;
  if (!current) return null;
  if (current.kind === "review" || current.kind === "mistake")
    return !targetId.value ? current : null;
  return current.targetId === targetId.value ? current : null;
});
const question = computed(() => {
  const r = round.value;
  return r && r.index >= 0
    ? byId(course.questions, r.questionIds[r.index])
    : null;
});
const passage = computed(() =>
  question.value ? byId(course.passages, question.value.passageId) : null,
);
const examples = computed(
  () =>
    lesson.value?.mainSkills.map((id, i) => ({
      skill: byId(course.skills, id),
      passage: byId(course.passages, lesson.value!.exampleIds[i]),
    })) ?? [],
);
const names = { choice: "单项选择", order: "事件排序", span: "原文选段" };
const completeInput = computed(
  () =>
    question.value &&
    round.value?.selected.length ===
      (question.value.mode === "order" ? question.value.options.length : 1),
);
const mismatch = computed(() => {
  const q = question.value,
    r = round.value;
  if (!q || !r || q.mode !== "order" || r.feedback !== false) return "";
  const i = q.answer.findIndex((id, i) => id !== r.selected[i]);
  return i >= 0
    ? `你把“${optionText(q, r.selected[i])}”放在第 ${i + 1} 位。按原文，此处应先选“${optionText(q, q.answer[i])}”。`
    : "";
});
const error = ref("");
const loading = ref(true);
const saving = ref(false);
const unavailable = ref(false);
const prompt = ref<HTMLElement | null>(null);
const feedbackHeading = ref<HTMLElement | null>(null);
const finishedRound = ref("");
const reviewMode = computed(() => !targetId.value);

async function openTarget() {
  const id = targetId.value;
  await startRound(lesson.value ? "lesson" : "assessment", id);
}

watch(
  () => route.path,
  async (_path, _old, cleanup) => {
    let current = true;
    cleanup(() => {
      current = false;
    });
    loading.value = true;
    error.value = "";
    unavailable.value = false;
    finishedRound.value = "";
    try {
      await initProgress();
      if (!current) return;
      if (!reviewMode.value) {
        const target = lesson.value || assessment.value;
        if (target?.stage !== "available" || !isUnlocked(target.id))
          unavailable.value = true;
        else if (!active.value || round.value) await openTarget();
      }
    } catch (e) {
      if (current)
        error.value = e instanceof Error ? e.message : "读取进度失败。";
    } finally {
      if (current) loading.value = false;
    }
  },
  { immediate: true },
);

async function act(operation: () => Promise<void>) {
  if (saving.value) return;
  saving.value = true;
  error.value = "";
  try {
    await operation();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "保存未成功，请重试。";
  } finally {
    saving.value = false;
  }
}

function changeSelection(ids: string[]) {
  const r = round.value,
    q = question.value;
  if (r && q) void act(() => selectAnswer(r.id, q.id, ids));
}

function questionAction(method: typeof showHint) {
  const r = round.value,
    q = question.value;
  if (r && q) void act(() => method(r.id, q.id));
}

function next() {
  const r = round.value,
    q = question.value;
  if (!r) return;
  void act(async () => {
    if (q) {
      if (r.index === r.questionIds.length - 1) finishedRound.value = r.id;
      await advance(r.id, q.id);
      if (
        progress.value.lastResult?.roundId === r.id &&
        !progress.value.active
      ) {
        await router.push("/result");
      }
    } else await startQuestions(r.id);
  });
}

watch(
  () => question.value?.id,
  async (id) => {
    if (!id) return;
    await nextTick();
    prompt.value?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  },
);
watch(
  () => round.value?.feedback,
  async (feedback) => {
    if (typeof feedback !== "boolean") return;
    await nextTick();
    feedbackHeading.value?.focus({ preventScroll: true });
  },
);
</script>

<template>
  <main class="reading">
    <RouterLink class="back" :to="reviewMode ? '/review' : '/path'"
      ><ArrowLeft aria-hidden="true" />{{
        reviewMode ? "复习" : "课程路径"
      }}</RouterLink
    >
    <p v-if="error" role="alert" class="issue">{{ error }}</p>
    <p v-if="loading" role="status">正在读取学习进度…</p>
    <section v-else-if="unavailable">
      <h1>本关尚未解锁</h1>
      <p class="lead">请回到课程路径，完成前一关。</p>
      <RouterLink class="primary" to="/path">查看课程路径</RouterLink>
    </section>
    <section v-else-if="!round && active && !reviewMode">
      <h1>还有一轮练习未完成</h1>
      <p class="lead">
        已保存「{{
          roundTitle(active.kind, active.targetId)
        }}」。开启新关会结束这一轮，已结算的成绩会保留。
      </p>
      <div class="actions">
        <RouterLink class="primary" :to="studyLink(active)"
          >继续已保存的练习</RouterLink
        >
        <button class="secondary" :disabled="saving" @click="act(openTarget)">
          结束旧练习并开启本关
        </button>
      </div>
    </section>
    <section v-else-if="!round && !finishedRound">
      <h1>暂无进行中的练习</h1>
      <RouterLink class="primary" :to="reviewMode ? '/review' : '/path'">{{
        reviewMode ? "查看复习任务" : "查看课程路径"
      }}</RouterLink>
    </section>
    <template v-else-if="round && round.index < 0">
      <div class="eyebrow">
        {{ unit?.title }} · {{ lesson ? "课前讲解" : "单元检查" }}
      </div>
      <h1>{{ roundTitle(round.kind, round.targetId) }}</h1>
      <p class="lead">
        {{ lesson?.intro || "读一组新的例句，综合运用本单元学到的阅读方法。" }}
      </p>
      <div v-if="lesson" class="teaching">
        <article v-for="example in examples" :key="example.skill.id">
          <div
            class="character"
            :class="{ long: example.skill.word.length > 1 }"
            aria-hidden="true"
          >
            {{ example.skill.word }}
          </div>
          <div>
            <h2>{{ example.skill.meaning }}</h2>
            <p>{{ example.skill.detail }}</p>
            <blockquote>{{ example.passage.text }}</blockquote>
            <small
              >{{ passageLabel(example.passage) }} ·
              {{ example.passage.gloss }}</small
            >
          </div>
        </article>
      </div>
      <p class="fine">
        {{ (lesson || assessment)?.status === "draft" ? "草稿练习 · " : ""
        }}{{
          lesson
            ? "8 题中至少 6 题无提示首答正确，并覆盖每个主要知识点，即可通过。"
            : "6 题中至少 4 题无提示首答正确，即可通过。"
        }}
      </p>
      <button class="primary" :disabled="saving" @click="next">
        开始练习<ArrowRight aria-hidden="true" />
      </button>
    </template>
    <template v-else-if="round && question && passage">
      <div class="question-top">
        <span>{{ roundTitle(round.kind, round.targetId) }}</span><b
          >{{ round.index + 1 }} / {{ round.questionIds.length }}</b
        >
      </div>
      <progress
        :value="round.index + 1"
        :max="round.questionIds.length"
        aria-label="当前题号"
      />
      <div class="eyebrow">
        {{ names[question.mode] }} · {{ passageLabel(passage)
        }}{{ question.status === "draft" ? " · 草稿" : "" }}
      </div>
      <h1 ref="prompt" class="prompt" tabindex="-1">{{ question.prompt }}</h1>
      <blockquote v-if="question.mode !== 'span'" class="passage">
        {{ passage.text }}
      </blockquote>
      <QuestionInput
        :question="question"
        :selected="round.selected"
        :locked="saving || round.feedback !== null"
        @select="changeSelection"
      />
      <template v-if="round.feedback === null">
        <button
          class="hint"
          :disabled="saving || round.hinted"
          @click="questionAction(showHint)"
        >
          <CircleHelp aria-hidden="true" />查看关键提示（影响首答）
        </button>
        <p v-if="round.hinted" class="hint-text" role="status">
          {{ question.hint }}
        </p>
        <button
          class="primary"
          :disabled="saving || !completeInput"
          @click="questionAction(submitAnswer)"
        >
          提交答案<ArrowRight aria-hidden="true" />
        </button>
      </template>
      <section
        v-else
        class="feedback"
        :class="round.feedback ? 'right' : 'wrong'"
        aria-live="polite"
      >
        <h2 ref="feedbackHeading" tabindex="-1">
          {{ round.feedback ? "回答正确" : "再读一遍原文" }}
        </h2>
        <b
          >答案 ·
          {{
            question.answer.map((id) => optionText(question!, id)).join(" → ")
          }}</b
        >
        <p v-if="round.feedback === false">
          {{ mismatch || byId(question.options, round.selected[0]).reason }}
        </p>
        <p>{{ question.analysis }}</p>
        <small>句意 · {{ passage.gloss }}</small>
        <div class="actions">
          <button class="primary" :disabled="saving" @click="next">
            {{
              round.index + 1 === round.questionIds.length
                ? "查看结算"
                : "下一题"
            }}<ArrowRight aria-hidden="true" />
          </button>
          <button
            v-if="!round.feedback"
            class="secondary"
            :disabled="saving"
            @click="questionAction(retryAnswer)"
          >
            <RotateCcw aria-hidden="true" />重试本题
          </button>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.character.long {
  font-size: 14px;
  text-align: center;
  padding: 4px;
  height: auto;
  min-height: 48px;
  align-self: flex-start;
  overflow-wrap: anywhere;
}
.issue {
  color: #8f4026;
  margin-bottom: 1rem;
}
.prompt:focus,
.feedback h2:focus {
  outline: none;
}
</style>
