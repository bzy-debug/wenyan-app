<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { ArrowRight, BookOpen, CalendarDays, PencilLine } from "@lucide/vue";
import { studyLink } from "./roundLabels";
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
const active = computed(() => progress.value.active);
const confirmHeading = ref<HTMLElement>();
const pending = ref<Practice | null>(null);
const busy = ref(false);
const error = ref("");
async function begin(request: Practice, replace = false) {
  if (busy.value) return;
  const round = active.value;
  if (
    !replace &&
    round &&
    (round.kind !== request.kind || round.targetId !== request.id)
  ) {
    pending.value = request;
    await nextTick();
    confirmHeading.value?.focus();
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    await startRound(request.kind, request.id);
    await router.push("/practice");
    pending.value = null;
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
        <p class="lead">在新的语境里，检验学过的知识点。</p>
      </div>
      <RouterLink class="text-link" to="/knowledge"
        ><BookOpen :size="16" aria-hidden="true" />查看知识库</RouterLink
      >
    </header>
    <div v-if="active" class="resume">
      <span>有一轮练习尚未完成。</span
      ><RouterLink class="text-link" :to="studyLink(active)"
        >继续上次练习 <ArrowRight :size="15"
      /></RouterLink>
    </div>
    <section v-if="pending" class="confirm" role="alert">
      <h2 ref="confirmHeading" tabindex="-1">替换正在进行的练习？</h2>
      <p>开始这一题会结束当前未完成的练习。已结算的成绩会保留。</p>
      <div class="actions">
        <button class="primary" :disabled="busy" @click="begin(pending, true)">
          替换并开始</button
        ><button class="secondary" :disabled="busy" @click="pending = null">
          保留原练习
        </button>
      </div>
    </section>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="review-columns">
      <section class="schedule">
        <div class="schedule-heading">
          <CalendarDays :size="21" />
          <h2>到期知识卡</h2>
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
              :disabled="busy || !!pending"
              :aria-label="'复习：' + skill.word + ' · ' + skill.meaning"
              @click="begin({ kind: 'review', id: card.id })"
            >
              复习 <ArrowRight :size="16" />
            </button>
          </div>
        </div>
        <div v-else class="quiet">
          <h3>{{ nextDue ? "今日暂无到期卡片" : "还没有到期的知识卡" }}</h3>
          <p v-if="nextDue">
            下次复习 <time :datetime="nextDue">{{ nextDue }}</time>
          </p>
          <p v-else>学习新义项后，次日可以在这里复习。</p>
          <RouterLink class="text-link" to="/path"
            >前往课程路径 <ArrowRight :size="15"
          /></RouterLink>
        </div>
      </section>
      <section class="corrections">
        <div class="section-head">
          <h2 class="section-title"><PencilLine />错题订正</h2>
          <small>{{ mistakes.length }} 道待订正</small>
        </div>
        <p v-if="!mistakes.length" class="empty">目前没有需要订正的题目。</p>
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
            :disabled="busy || !!pending"
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
.confirm p,
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
.resume,
.confirm {
  margin: 14px 0;
  background: var(--accent-tint);
  border-radius: 10px;
  padding: 12px 18px;
}
.resume {
  flex-wrap: wrap;
  font-size: 14px;
}
.confirm h2 {
  font-size: 19px;
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
