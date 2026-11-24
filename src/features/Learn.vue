<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ArrowRight, BookOpen, RotateCcw, X } from "@lucide/vue";
import AnswerFeedback from "../components/questions/AnswerFeedback.vue";
import { byId, course } from "../content";
import RichText from "../components/RichText.vue";
import LessonReading from "../components/LessonReading.vue";
import "./study.css";
import QuestionInput from "../components/questions/QuestionInput.vue";
import {
  advance,
  progress,
  retryAnswer,
  selectAnswer,
  revealAnswer,
  startRound,
  submitAnswer,
} from "../storage/progress";
import SourceCredit from "../components/SourceCredit.vue";
import { roundTitle } from "./roundLabels";

const route = useRoute();
const router = useRouter();
const targetId = computed(() => String(route.params.id || ""));
const lesson = computed(() =>
  course.lessons.find((l) => l.id === targetId.value),
);
const assessment = computed(() =>
  course.assessments.find((a) => a.id === targetId.value),
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
const names = { choice: "选一项", order: "排出先后", span: "从原文里找" };
const completeInput = computed(
  () =>
    question.value &&
    round.value?.selected.length ===
      (question.value.mode === "order" ? question.value.options.length : 1),
);
const error = ref("");
const loading = ref(true);
const saving = ref(false);
const unavailable = computed(() => {
  if (!targetId.value) return false;
  const target = lesson.value ?? assessment.value;
  return target?.stage !== "available";
});
const prompt = ref<HTMLElement | null>(null);
const feedbackPanel = ref<InstanceType<typeof AnswerFeedback>>();
const guide = ref<HTMLDialogElement>();
const guideOpen = ref(false);
async function openGuide() {
  guideOpen.value = true;
  await nextTick();
  guide.value?.showModal();
}
const finishedRound = ref("");
const reviewMode = computed(() => !targetId.value);

async function openTarget() {
  const id = targetId.value;
  await startRound(lesson.value ? "lesson" : "assessment", id);
}

onMounted(async () => {
  try {
    if (!reviewMode.value && !unavailable.value && !round.value)
      await openTarget();
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : "这节练习没能打开。回到课程路径，再试一次。";
  } finally {
    loading.value = false;
  }
});

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

function questionAction(
  method: (roundId: string, questionId: string) => Promise<void>,
) {
  const r = round.value,
    q = question.value;
  if (r && q) void act(() => method(r.id, q.id));
}

function next() {
  const r = round.value,
    q = question.value;
  if (!r || !q) return;
  void act(async () => {
    if (r.index === r.questionIds.length - 1) finishedRound.value = r.id;
    await advance(r.id, q.id);
    if (progress.value.lastResult?.roundId === r.id && !progress.value.active) {
      await router.push("/result");
    }
  });
}

watch(
  () => (loading.value ? undefined : question.value?.id),
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
    feedbackPanel.value?.focus();
  },
);

function onStudyKey(event: KeyboardEvent) {
  const r = round.value,
    q = question.value;
  if (
    !r ||
    !q ||
    guideOpen.value ||
    saving.value ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    event.shiftKey
  )
    return;
  const target = event.target;
  if (
    !(target instanceof HTMLElement) ||
    target.closest("input,textarea,select,[contenteditable=true]")
  )
    return;
  if (/^[1-9]$/.test(event.key) && r.feedback === null) {
    const main = event.currentTarget as HTMLElement;
    const option = main.querySelector<HTMLButtonElement>(
      'button[aria-keyshortcuts="' + event.key + '"]',
    );
    if (option && !option.disabled) {
      event.preventDefault();
      option.click();
    }
    return;
  }
  if (event.key !== "Enter") return;
  const control = target.closest("button,a,summary");
  // Enter activates a focused control normally. After choosing an option it
  // also allows a keyboard learner to check the selected answer.
  if (
    control &&
    !control.matches('button[aria-pressed="true"][aria-keyshortcuts]')
  )
    return;
  if (r.feedback !== null) {
    event.preventDefault();
    next();
  } else if (completeInput.value) {
    event.preventDefault();
    questionAction(submitAnswer);
  }
}
</script>
<template>
  <main class="study" @keydown="onStudyKey">
    <header class="study-head">
      <div class="study-width study-top">
        <RouterLink
          class="study-exit"
          :to="reviewMode ? '/review' : '/path'"
          aria-label="退出练习，进度已保存"
          title="退出练习，进度已保存"
          ><X :size="21" aria-hidden="true"
        /></RouterLink>
        <div class="study-meter">
          <div class="meter-caption">
            <span>{{
              round && question
                ? roundTitle(round.kind, round.targetId)
                : course.title
            }}</span>
            <strong v-if="round && question"
              >第 {{ round.index + 1 }} /
              {{ round.questionIds.length }} 题</strong
            >
          </div>
          <progress
            v-if="round"
            :value="Math.max(0, round.index) + (round.feedback != null ? 1 : 0)"
            :max="round.questionIds.length"
            aria-label="本轮已完成题数"
          />
        </div>
      </div>
    </header>
    <div class="study-width study-content">
      <p v-if="error" role="alert" class="study-issue">{{ error }}</p>
      <p v-if="loading" role="status">正在读取学习进度…</p>
      <section v-else-if="unavailable">
        <h1>这节练习暂时打不开</h1>
        <RouterLink class="primary" to="/path">查看课程路径</RouterLink>
      </section>
      <section v-else-if="!round && !finishedRound">
        <h1>还没有要继续的练习</h1>
        <RouterLink class="primary" :to="reviewMode ? '/review' : '/path'">{{
          reviewMode ? "去复习" : "查看课程路径"
        }}</RouterLink>
      </section>
      <template v-else-if="round && question && passage">
        <div class="study-tools">
          <p class="study-kicker">{{ names[question.mode] }}</p>
          <button
            v-if="lesson"
            type="button"
            class="guide-trigger"
            aria-haspopup="dialog"
            @click="openGuide"
          >
            <BookOpen :size="16" aria-hidden="true" />本课讲解
          </button>
        </div>
        <h1 ref="prompt" class="prompt" tabindex="-1">
          <RichText :source="question.prompt" inline />
        </h1>
        <div class="source-caption">
          <SourceCredit :passage="passage" />
        </div>
        <blockquote v-if="question.mode !== 'span'" class="q-passage">
          {{ passage.text }}
        </blockquote>
        <QuestionInput
          :course="course"
          :question="question"
          :selected="round.selected"
          :feedback="round.feedback"
          :locked="saving || round.feedback !== null"
          @select="changeSelection"
        />
      </template>
    </div>
    <footer
      v-if="!loading && round && question && !unavailable"
      class="study-dock"
      :class="{
        positive: round.feedback === true,
        correction: round.feedback === false && round.selected.length > 0,
        assisted: round.feedback === false && !round.selected.length,
      }"
    >
      <div class="study-width">
        <AnswerFeedback
          v-if="round.feedback != null"
          :key="question.id"
          ref="feedbackPanel"
          :course="course"
          :question="question"
          :selected="round.selected"
          :correct="round.feedback"
        />
        <div class="study-bar">
          <button
            v-if="round.feedback === false"
            class="study-retry"
            :disabled="saving"
            @click="questionAction(retryAnswer)"
          >
            <RotateCcw :size="16" aria-hidden="true" />再试一次
          </button>
          <button
            v-else-if="round.feedback === null && round.kind !== 'assessment'"
            class="study-help"
            type="button"
            :disabled="saving"
            @click="questionAction(revealAnswer)"
          >
            不知道
          </button>
          <small v-else-if="round.feedback === null" class="shortcuts"
            ><kbd>1–{{ question.options.length }}</kbd> 选答案
            <kbd>Enter</kbd> 提交</small
          >
          <button
            v-if="round.feedback === null"
            class="primary study-action"
            :disabled="saving || !completeInput"
            @click="questionAction(submitAnswer)"
          >
            提交答案<ArrowRight aria-hidden="true" />
          </button>
          <button
            v-else
            class="primary study-action"
            :disabled="saving"
            @click="next"
          >
            {{
              round.index + 1 === round.questionIds.length
                ? "完成练习"
                : "下一题"
            }}<ArrowRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
    <dialog
      v-if="lesson && round"
      ref="guide"
      class="lesson-guide"
      aria-labelledby="guide-title"
      @close="guideOpen = false"
    >
      <template v-if="guideOpen">
        <div class="guide-toolbar">
          <h2 id="guide-title">本课讲解</h2>
          <button
            type="button"
            class="secondary"
            autofocus
            @click="guide?.close()"
          >
            回到练习<X :size="16" aria-hidden="true" />
          </button>
        </div>
        <div class="guide-reading">
          <h3>{{ lesson.title }}</h3>
          <RichText
            v-if="lesson.intro && lesson.body.trim() !== lesson.intro.trim()"
            :source="lesson.intro"
          />
          <LessonReading :course="course" :lesson="lesson" />
        </div>
      </template>
    </dialog>
  </main>
</template>
