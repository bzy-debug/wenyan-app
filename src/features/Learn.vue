<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Lightbulb,
  RotateCcw,
  X,
} from "@lucide/vue";
import { byId, course, optionText } from "../content";
import RichText from "../components/RichText.vue";
import LessonReading from "../components/LessonReading.vue";
import "./study.css";
import QuestionInput from "../components/questions/QuestionInput.vue";
import {
  advance,
  isUnlocked,
  progress,
  retryAnswer,
  selectAnswer,
  showHint,
  startQuestions,
  startRound,
  submitAnswer,
} from "../storage/progress";
import SourceCredit from "../components/SourceCredit.vue";
import { roundTitle, studyLink } from "./roundLabels";

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
const unavailable = computed(() => {
  if (!targetId.value) return false;
  const target = lesson.value ?? assessment.value;
  return target?.stage !== "available" || !isUnlocked(target.id);
});
const prompt = ref<HTMLElement | null>(null);
const feedbackHeading = ref<HTMLElement | null>(null);
const finishedRound = ref("");
const reviewMode = computed(() => !targetId.value);

async function openTarget() {
  const id = targetId.value;
  await startRound(lesson.value ? "lesson" : "assessment", id);
}

onMounted(async () => {
  try {
    if (!reviewMode.value && !unavailable.value && !active.value)
      await openTarget();
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : "无法开启本关，请返回课程路径重试。";
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
    feedbackHeading.value?.focus({ preventScroll: true });
  },
);

function onStudyKey(event: KeyboardEvent) {
  const r = round.value,
    q = question.value;
  if (
    !r ||
    !q ||
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
            <strong v-else-if="round">课前准备</strong>
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
        <h1>本关尚未解锁</h1>
        <p>完成前一关后，就可以来这里学习。</p>
        <RouterLink class="primary" to="/path">查看课程路径</RouterLink>
      </section>
      <section v-else-if="!round && active && !reviewMode">
        <h1>继续上次练习？</h1>
        <p>
          「{{
            roundTitle(active.kind, active.targetId)
          }}」进度已保存。如果开启本关，上次练习会结束。
        </p>
        <div class="actions">
          <RouterLink class="primary" :to="studyLink(active)"
            >继续已保存的练习</RouterLink
          ><button
            class="secondary"
            :disabled="saving"
            @click="act(openTarget)"
          >
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
        <p class="study-kicker">
          {{ unit?.title }} · {{ lesson ? "课前讲解" : "单元检查" }}
        </p>
        <h1>{{ roundTitle(round.kind, round.targetId) }}</h1>
        <div
          v-if="!lesson || lesson.body.trim() !== lesson.intro?.trim()"
          class="study-intro"
        >
          <RichText
            :source="
              lesson?.intro || '读一组新的例句，综合运用本单元学到的阅读方法。'
            "
          />
        </div>
        <LessonReading v-if="lesson" :course="course" :lesson="lesson" />
        <p class="study-fine">
          {{ (lesson || assessment)?.status === "draft" ? "教学草稿 · " : ""
          }}{{ round.questionIds.length }} 题中至少
          {{ (lesson || assessment)?.passCount }} 题无提示首答正确{{
            lesson ? "，并覆盖每个主要知识点" : ""
          }}，即可通过。
        </p>
      </template>
      <template v-else-if="round && question && passage">
        <p class="study-kicker">{{ names[question.mode] }}</p>
        <h1 ref="prompt" class="prompt" tabindex="-1">
          <RichText :source="question.prompt" inline />
        </h1>
        <div class="source-caption">
          <SourceCredit :passage="passage" />{{
            question.status === "draft" ? " · 草稿" : ""
          }}
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
        <template v-if="round.feedback === null">
          <button
            class="study-hint"
            :disabled="saving || round.hinted"
            @click="questionAction(showHint)"
          >
            <CircleHelp :size="16" aria-hidden="true" />查看关键提示（影响首答）
          </button>
          <div v-if="round.hinted" role="status" class="hint-box">
            <RichText :source="question.hint" />
          </div>
        </template>
      </template>
    </div>
    <footer
      v-if="!loading && round && !unavailable"
      class="study-dock"
      :class="{
        positive: round.feedback === true,
        correction: round.feedback === false,
      }"
    >
      <div class="study-width">
        <section
          v-if="question && passage && round.feedback != null"
          class="explanation"
          aria-live="polite"
        >
          <h2 ref="feedbackHeading" tabindex="-1">
            <component
              :is="round.feedback ? Check : Lightbulb"
              :size="19"
              aria-hidden="true"
            />{{ round.feedback ? "回答正确" : "再读一遍原文" }}
          </h2>
          <p class="answer">
            <b>答案</b>
            {{
              question.answer.map((id) => optionText(question!, id)).join(" → ")
            }}
          </p>
          <RichText
            v-if="round.feedback === false"
            :source="
              mismatch || byId(question.options, round.selected[0]).reason
            "
          />
          <RichText :source="question.analysis" />
          <div class="gloss">
            <b>句意</b> <RichText :source="passage.gloss" inline />
          </div>
        </section>
        <div class="study-bar">
          <button
            v-if="round.feedback === false"
            class="study-retry"
            :disabled="saving"
            @click="questionAction(retryAnswer)"
          >
            <RotateCcw :size="16" aria-hidden="true" />重试本题
          </button>
          <small
            v-else-if="question && round.feedback === null"
            class="shortcuts"
            ><kbd>1–{{ question.options.length }}</kbd> 选答案
            <kbd>Enter</kbd> 提交</small
          >
          <small v-else-if="question" class="shortcuts"
            ><kbd>Enter</kbd> 继续</small
          >
          <small v-else class="start-count"
            >{{ round.questionIds.length }} 道练习</small
          >
          <button
            v-if="round.index < 0"
            class="primary study-action"
            :disabled="saving"
            @click="next"
          >
            开始练习<ArrowRight aria-hidden="true" />
          </button>
          <button
            v-else-if="round.feedback === null"
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
                ? "查看结算"
                : "下一题"
            }}<ArrowRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  </main>
</template>
