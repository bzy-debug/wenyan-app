<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { ArrowRight, BookOpen, CalendarDays, PencilLine } from "@lucide/vue";
import { studyLink, roundTitle } from "./roundLabels";
import RichText from "../components/RichText.vue";
import { byId, course } from "../content";
import { dueCards, progress, startRound } from "../storage/progress";

type Practice = { kind: "review" | "mistake"; id: string };
const router = useRouter();
const nextDue = computed(
  () =>
    Object.values(progress.value.cards)
      .map((card) => card.due)
      .sort()[0],
);
const due = computed(() =>
  dueCards().map((card) => ({
    card,
    skill: byId(course.skills, card.skillId),
  })),
);
const mistakes = computed(() =>
  progress.value.mistakes.map((id) => {
    const question = byId(course.questions, id);
    return {
      question,
      skill: byId(course.skills, question.skillId),
      passage: byId(course.passages, question.passageId),
    };
  }),
);
const resumable = computed(() => {
  const { active, paused } = progress.value;
  const recent = active ?? paused.at(-1);
  return recent
    ? [
        recent,
        ...paused.filter(
          (round) =>
            round.id !== recent.id &&
            (round.kind === "review" || round.kind === "mistake"),
        ),
      ]
    : [];
});
const busy = ref(false);
const error = ref("");
async function begin(request: Practice) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await startRound(request.kind, request.id);
    await router.push("/practice");
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "练习未能打开，请重试。";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="shell review">
    <header class="review-head">
      <div>
        <h1>复习</h1>
        <p class="lead">换一句古文，看看上次学过的用法还认不认得。</p>
      </div>
      <RouterLink class="text-link" to="/knowledge"
        ><BookOpen :size="16" aria-hidden="true" />查看知识库</RouterLink
      >
    </header>
    <div v-for="(round, index) in resumable" :key="round.id" class="resume">
      <span>上次学到 · {{ roundTitle(round.kind, round.targetId) }}</span>
      <button
        v-if="
          round.id !== progress.active?.id &&
          (round.kind === 'review' || round.kind === 'mistake')
        "
        type="button"
        class="text-link"
        :disabled="busy"
        @click="begin({ kind: round.kind, id: round.targetId })"
      >
        继续{{ index ? "练习" : "上次练习" }}
        <ArrowRight :size="15" aria-hidden="true" />
      </button>
      <RouterLink v-else class="text-link" :to="studyLink(round)"
        >继续上次练习 <ArrowRight :size="15" aria-hidden="true"
      /></RouterLink>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="review-columns">
      <section class="schedule">
        <div class="schedule-heading">
          <CalendarDays :size="21" />
          <h2>今天要复习</h2>
          <span class="quantity">{{ due.length }} 张</span>
        </div>
        <div v-if="due.length" class="due-list">
          <div v-for="{ card, skill } in due" :key="card.id" class="row">
            <div>
              <small>{{ skill.area }}</small>
              <h3>{{ skill.word }} · {{ skill.meaning }}</h3>
            </div>
            <button
              class="secondary"
              :disabled="busy"
              :aria-label="'复习：' + skill.word + ' · ' + skill.meaning"
              @click="begin({ kind: 'review', id: card.id })"
            >
              复习 <ArrowRight :size="16" />
            </button>
          </div>
        </div>
        <div v-else class="quiet">
          <h3>{{ nextDue ? "今天没有要复习的卡片" : "这里还没有复习卡" }}</h3>
          <p v-if="nextDue">
            下次复习 <time :datetime="nextDue">{{ nextDue }}</time>
          </p>
          <p v-else>今天学过的字句，明天可以来这里再练。</p>
          <RouterLink class="text-link" to="/path"
            >去选一课 <ArrowRight :size="15"
          /></RouterLink>
        </div>
      </section>
      <section class="corrections">
        <div class="section-head">
          <h2 class="section-title"><PencilLine />错题订正</h2>
          <small>{{ mistakes.length }} 道待订正</small>
        </div>
        <p v-if="!mistakes.length" class="empty">没有待订正的错题。</p>
        <div
          v-for="{ question: q, skill, passage } in mistakes"
          :key="q.id"
          class="row"
        >
          <div>
            <small>{{ skill.word }} · {{ skill.meaning }}</small>
            <h3><RichText :source="q.prompt" inline /></h3>
            <p class="excerpt">{{ passage.text }}</p>
          </div>
          <button
            class="secondary"
            :disabled="busy"
            @click="begin({ kind: 'mistake', id: q.id })"
          >
            订正
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.review {
  max-width: 1060px;
}
.review-head,
.schedule-heading,
.resume,
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.review-head,
.resume,
.row {
  justify-content: space-between;
}
.review-head .text-link {
  white-space: nowrap;
  min-height: 44px;
}
.review-columns {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr);
  gap: 32px;
  align-items: start;
  margin-top: 18px;
}
.schedule {
  border: 1px solid #ccddd6;
  background: #f1faf6;
  border-radius: 16px;
  padding: 24px;
}
.schedule-heading h2,
.corrections h2 {
  font-size: 21px;
}
.schedule-heading {
  color: var(--success);
}
.quantity {
  margin-left: auto;
  font-size: 14px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.quiet {
  margin-top: 24px;
}
.quiet h3,
.row h3 {
  font-size: 17px;
}
.quiet p,
.empty {
  color: var(--muted);
  line-height: 1.7;
}
.quiet p {
  margin: 8px 0;
}
.quiet a,
.resume a {
  width: fit-content;
  min-height: 44px;
}
.due-list {
  margin-top: 16px;
}
.row {
  padding: 15px 0;
  border-top: 1px solid var(--line);
}
.row button {
  flex-shrink: 0;
}
.row button:disabled {
  opacity: 0.6;
}
.corrections {
  padding: 12px 0;
}
.corrections .section-head {
  margin-bottom: 15px;
}
.corrections h2 svg {
  color: var(--accent);
}
.empty {
  padding: 20px 0;
  border-top: 1px solid var(--line);
}
.excerpt {
  margin-top: 5px;
  line-height: 1.7;
  color: var(--muted);
}
.resume {
  margin: 14px 0;
  background: var(--accent-tint);
  border-radius: 10px;
  padding: 12px 18px;
}
.resume {
  flex-wrap: wrap;
  font-size: 14px;
}
@media (max-width: 720px) {
  .review-columns {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .schedule {
    padding: 18px;
  }
}
</style>
