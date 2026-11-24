<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  Clock3,
  Flame,
  Layers,
  ListChecks,
  Map,
  Sparkles,
} from "@lucide/vue";
import { byId, course } from "../content";
import { dueCards, isUnlocked, progress, streak } from "../storage/progress";
import UnitPath from "./UnitPath.vue";

const active = computed(() => progress.value.active);
const unfinishedTarget = computed(() =>
  course.units
    .flatMap((unit) => [...unit.lessonIds, unit.assessmentId])
    .find((id) => isUnlocked(id) && !progress.value.passedIds.includes(id)),
);
const taskId = computed(() => {
  const round = active.value;
  if (round && (round.kind === "lesson" || round.kind === "assessment"))
    return round.targetId;
  return unfinishedTarget.value;
});
const taskLesson = computed(() =>
  course.lessons.find((lesson) => lesson.id === taskId.value),
);
const unit = computed(
  () =>
    course.units.find(
      (u) =>
        u.lessonIds.includes(taskId.value || "") ||
        u.assessmentId === taskId.value,
    ) ?? course.units.at(-1)!,
);
const passedLessons = computed(
  () =>
    course.lessons.filter((lesson) =>
      progress.value.passedIds.includes(lesson.id),
    ).length,
);
const check = computed(() =>
  course.assessments.find((assessment) => assessment.id === taskId.value),
);

const task = computed(() => {
  const round = active.value;
  const unitLabel = unit.value.title;
  if (round && (round.kind === "review" || round.kind === "mistake")) {
    const review = round.kind === "review";
    return {
      tag: "进行中",
      unitLabel: "复习与巩固",
      title: review ? "知识卡复习" : "错题纠正",
      intro: review
        ? "换一个语境，重新辨认学过的用法。"
        : "回到原句，找出上一次遗漏的线索。",
      path: "/practice",
      button: "继续练习",
      quantity: round.questionIds.length + " 道练习",
      time: "",
    };
  }
  const lesson = taskLesson.value;
  if (lesson || check.value) {
    const title = lesson?.title ?? "单元检查";
    const quantity = (lesson ?? check.value)!.questionIds.length + " 道练习";
    return {
      tag: round ? "进行中" : "当前课程",
      unitLabel,
      title: title.split("：").at(-1)!,
      intro: lesson?.intro ?? "回顾本单元的知识，在新的语境中检验阅读能力。",
      path: "/learn/" + taskId.value,
      button: round ? "继续学习" : lesson ? "开始学习" : "开始检查",
      quantity,
      time: lesson ? "5–8 分钟" : "单元检查",
    };
  }
  return {
    tag: "L1 已完成",
    unitLabel: "读懂单句",
    title: "温故知新",
    intro: "你已走完本级课程。通过间隔复习，保持对这些义项和句式的熟悉。",
    path: "/review",
    button: "前往复习",
    quantity: "",
    time: "",
  };
});

const noteLesson = computed(
  () => taskLesson.value ?? byId(course.lessons, unit.value.lessonIds.at(-1)!),
);
const noteIndex = ref(0);
watch(
  () => noteLesson.value.id,
  () => {
    noteIndex.value = 0;
  },
);
const noteSkills = computed(() =>
  noteLesson.value.mainSkills.map((id) => byId(course.skills, id)),
);
const noteLabels = computed(() =>
  noteSkills.value.map((entry) =>
    noteSkills.value.some(
      (other) => other.id !== entry.id && other.word === entry.word,
    )
      ? entry.meaning
      : entry.word,
  ),
);
const skill = computed(() => noteSkills.value[noteIndex.value]);
const passage = computed(() =>
  byId(course.passages, noteLesson.value.exampleIds[noteIndex.value]),
);
const highlight = computed(() => {
  const start = passage.value.text.indexOf(skill.value.word);
  if (start < 0) return { before: passage.value.text, word: "", after: "" };
  return {
    before: passage.value.text.slice(0, start),
    word: skill.value.word,
    after: passage.value.text.slice(start + skill.value.word.length),
  };
});
</script>

<template>
  <main class="shell">
    <div class="page-heading">
      <div>
        <div class="eyebrow"><span class="dash" /> L1 · 读懂单句</div>
        <h1>今日学习</h1>
      </div>
      <div class="course-progress">
        <span>课程进度</span> <b>{{ passedLessons }}</b> /
        {{ course.lessons.length }} 课
        <progress
          :value="passedLessons"
          :max="course.lessons.length"
          aria-label="已通过课程"
        />
      </div>
    </div>

    <section class="hero" aria-labelledby="continue-title">
      <div class="hero-copy">
        <div class="tagline">
          <span class="tag">{{ task.tag }}</span><span>{{
            task.unitLabel
          }}</span>
        </div>
        <h2
          id="continue-title"
          :class="{ 'long-title': task.title.length > 6 }"
        >
          {{ task.title }}
        </h2>
        <p>{{ task.intro }}</p>
        <div v-if="task.time || task.quantity" class="meta">
          <span v-if="task.time"><Clock3 />{{ task.time }}</span>
          <i v-if="task.time && task.quantity" aria-hidden="true" />
          <span v-if="task.quantity"><ListChecks />{{ task.quantity }}</span>
        </div>
        <RouterLink class="primary" :to="task.path"
          >{{ task.button }}<ArrowRight :size="18"
        /></RouterLink>
      </div>
      <div
        class="hero-art"
        role="img"
        aria-label="青绿色山水版画，旅人沿河过桥"
      />
    </section>

    <dl class="study-strip">
      <div>
        <dt><Flame />连续学习</dt>
        <dd>{{ streak() }} <small>天</small></dd>
      </div>
      <div>
        <dt><Sparkles />累计经验</dt>
        <dd>{{ progress.xp }} <small>XP</small></dd>
      </div>
      <div>
        <dt><Layers />到期复习</dt>
        <dd>
          <RouterLink to="/review" aria-label="查看到期复习"
            >{{ dueCards().length }} <small>张</small><ArrowUpRight :size="14"
          /></RouterLink>
        </dd>
      </div>
    </dl>

    <div class="home-grid">
      <section>
        <div class="section-head">
          <h2 class="section-title"><Map />课程路径</h2>
          <RouterLink class="text-link" to="/path"
            >查看全部 <ArrowUpRight :size="15"
          /></RouterLink>
        </div>
        <UnitPath :unit="unit" compact />
      </section>
      <section v-if="skill">
        <div class="section-head">
          <h2 class="section-title"><Bookmark />字词手记</h2>
        </div>
        <div class="note">
          <div class="note-top">
            <span>{{ skill.area }} · {{ unit.title }}</span
            ><span class="folio"
              >{{ String(noteIndex + 1).padStart(2, "0") }} /
              {{ String(noteSkills.length).padStart(2, "0") }}</span
            >
          </div>
          <div class="word-line">
            <strong :class="{ 'long-word': skill.word.length > 3 }">{{
              skill.word
            }}</strong><span>{{ skill.meaning }}</span>
          </div>
          <blockquote>
            {{ highlight.before }}<em>{{ highlight.word }}</em
            >{{ highlight.after }}
          </blockquote>
          <small>{{
            passage.kind === "teaching" ? "教学例句" : passage.source?.work
          }}</small>
          <div class="word-buttons" role="group" aria-label="选择知识点">
            <button
              v-for="(s, i) in noteSkills"
              :key="s.id"
              type="button"
              :aria-pressed="i === noteIndex"
              @click="noteIndex = i"
            >
              {{ noteLabels[i] }}
            </button>
          </div>
        </div>
      </section>
    </div>

    <footer>
      <BookOpen :size="14" />文言拾阶<span>教学内容 · 草稿试用</span>
    </footer>
  </main>
</template>

<style scoped>
.course-progress {
  color: var(--muted);
  font-size: 13px;
  min-width: 128px;
}
.course-progress b {
  color: var(--green);
  font-size: 15px;
  margin-left: 4px;
}
.course-progress progress {
  height: 4px;
  margin: 5px 0 0;
}
.long-title {
  font-size: clamp(32px, 3.2vw, 45px);
  line-height: 1.45;
}
.hero-copy > .primary {
  margin-top: 15px;
}
.meta + .primary {
  margin-top: 0;
}
.study-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-block: 1px solid var(--line);
  padding-block: 15px;
  margin: 20px 0 0;
}
.study-strip > div {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}
.study-strip > div + div {
  border-left: 1px solid var(--line);
}
.study-strip dt,
.study-strip dd a {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.study-strip dt {
  color: var(--muted);
  font-size: 13px;
}
.study-strip dt svg {
  width: 17px;
  height: 17px;
  color: var(--green);
}
.study-strip dd {
  margin: 0;
  color: var(--green);
  font: 650 23px/1.25 var(--serif);
}
.study-strip dd small {
  font:
    12px/1 system-ui,
    sans-serif;
}
.study-strip dd a {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}
.word-line {
  flex-wrap: wrap;
  gap: 10px;
}
.word-line .long-word {
  font-size: 34px;
}
.word-buttons {
  flex-wrap: wrap;
}
@media (max-width: 570px) {
  .study-strip > div {
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .study-strip {
    margin-top: 17px;
    padding-block: 12px;
  }
  .study-strip dt svg {
    width: 14px;
    height: 14px;
  }
  .study-strip dt {
    font-size: 12px;
  }
  .course-progress {
    min-width: 0;
    font-size: 11px;
  }
  .course-progress b {
    font-size: 12px;
  }
  .long-title {
    font-size: 30px;
  }
}
</style>
