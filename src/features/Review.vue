<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { ArrowRight, BookOpen, CalendarDays, PencilLine } from "@lucide/vue";
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
  progress.value.mistakes.map((id) => byId(course.questions, id)),
);
const active = computed(() => progress.value.active);
const resumePath = computed(() =>
  !active.value || ["review", "mistake"].includes(active.value.kind)
    ? "/practice"
    : "/learn/" + active.value.targetId,
);
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
    <h1>复习</h1>
    <p class="lead">换个语境，再认一次学过的义项。</p>
    <div v-if="active" class="resume">
      <span>有一轮练习尚未完成。</span
      ><RouterLink class="text-link" :to="resumePath"
        >继续上次练习 <ArrowRight :size="15"
      /></RouterLink>
    </div>
    <section v-if="pending" class="confirm" role="alert">
      <h2>替换正在进行的练习？</h2>
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
    <section class="schedule">
      <div class="schedule-heading">
        <CalendarDays :size="21" />
        <h2>到期知识卡</h2>
        <span>{{ due.length }} 张</span>
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
      <div v-for="q in mistakes" :key="q.id" class="row">
        <div>
          <small
            >{{ byId(course.skills, q.skillId).word }} ·
            {{ byId(course.skills, q.skillId).meaning }}</small
          >
          <h3>{{ q.prompt }}</h3>
          <p class="excerpt">{{ byId(course.passages, q.passageId).text }}</p>
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
    <RouterLink class="text-link knowledge-link" to="/knowledge"
      ><BookOpen :size="16" />查看知识点与复习间隔</RouterLink
    >
  </main>
</template>

<style scoped>
.review {
  max-width: 900px;
  padding-bottom: 48px;
}
.schedule {
  border: 1px solid #ccd8c7;
  border-radius: 12px;
  overflow: hidden;
  background: #f2f5ec;
}
.schedule-heading,
.resume,
.row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.schedule-heading {
  padding: 18px 22px;
  color: var(--green);
}
.schedule-heading h2,
.corrections h2 {
  font-size: 22px;
}
.schedule-heading span {
  margin-left: auto;
  font-size: 14px;
}
.quiet,
.due-list {
  padding: 0 22px 18px;
}
.quiet h3,
.row h3 {
  font-size: 18px;
}
.quiet p,
.confirm p {
  color: var(--muted);
  margin: 7px 0;
  line-height: 1.7;
}
.quiet a,
.knowledge-link {
  width: fit-content;
  min-height: 44px;
}
.row {
  justify-content: space-between;
  padding: 14px 0;
  border-top: 1px solid var(--line);
}
.row button {
  flex-shrink: 0;
}
.row button:disabled {
  opacity: 0.6;
}
.corrections {
  margin: 28px 0 18px;
}
.empty {
  padding: 15px 0;
  border-block: 1px solid var(--line);
  color: var(--muted);
}
.excerpt {
  margin-top: 3px;
  font: 16px/1.7 var(--serif);
}
.resume,
.confirm {
  margin: 0 0 16px;
  background: #f2eee3;
  border-radius: 7px;
  padding: 10px 16px;
}
.resume {
  justify-content: space-between;
  flex-wrap: wrap;
  font-size: 14px;
}
.resume a {
  min-height: 44px;
}
.confirm h2 {
  font-size: 21px;
}
.confirm {
  padding: 16px;
}
</style>
