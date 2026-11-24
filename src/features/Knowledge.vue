<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { BookOpen, ChevronDown, Search } from "@lucide/vue";
import { byId, course } from "../content";
import type { Skill } from "../content/schema";
import { progress } from "../storage/progress";
import { intervals } from "../domain/review";

const query = ref("");
const area = ref("");
const onlyLearned = ref(false);
const areas = [...new Set(course.skills.map((skill) => skill.area))];
const entries = computed(() =>
  course.skills.map((skill) => {
    const card = course.cards.find(
      (candidate) => candidate.skillId === skill.id,
    );
    const schedule = card && progress.value.cards[card.id];
    const lessons = course.lessons.filter((lesson) =>
      lesson.mainSkills.includes(skill.id),
    );
    const examples = lessons.flatMap((lesson) => {
      const index = lesson.mainSkills.indexOf(skill.id);
      const passageId = lesson.exampleIds[index];
      return passageId ? [byId(course.passages, passageId)] : [];
    });
    return { skill, schedule, examples, lessons };
  }),
);
const visible = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return entries.value.filter(({ skill, schedule }) => {
    const searchable = [skill.word, skill.meaning, skill.detail, skill.area]
      .join(" ")
      .toLowerCase();
    return (
      (!area.value || skill.area === area.value) &&
      (!onlyLearned.value || schedule) &&
      searchable.includes(keyword)
    );
  });
});
const learned = computed(
  () => entries.value.filter((entry) => entry.schedule).length,
);
const statusLabel: Record<Skill["status"], string> = {
  draft: "待审核",
  reviewed: "已审核",
  published: "已发布",
};
</script>

<template>
  <main class="shell knowledge">
    <h1>知识库</h1>
    <p class="lead">查找具体的字义、句法和阅读方法，回看例句与复习进度。</p>
    <div class="filters">
      <label class="search">
        <Search :size="18" aria-hidden="true" />
        <input
          v-model="query"
          type="search"
          aria-label="搜索知识点"
          placeholder="搜索字、义项或用法"
        />
      </label>
      <select v-model="area" aria-label="知识领域">
        <option value="">全部领域</option>
        <option v-for="item in areas" :key="item">{{ item }}</option>
      </select>
      <label class="toggle"
        ><input v-model="onlyLearned" type="checkbox" />只看已学（{{
          learned
        }}）</label
      >
    </div>
    <p class="count" role="status">共 {{ visible.length }} 个知识点</p>
    <p v-if="!visible.length" class="empty">没有找到匹配的知识点。</p>
    <details
      v-for="{ skill, schedule, examples, lessons } in visible"
      :key="skill.id"
      class="entry"
    >
      <summary>
        <div>
          <small>{{ skill.area }}</small>
          <h2>{{ skill.word }} · {{ skill.meaning }}</h2>
        </div>
        <span class="mastery">{{
          schedule ? intervals[schedule.level] + " 天间隔" : "未学"
        }}</span>
        <ChevronDown :size="17" class="chevron" aria-hidden="true" />
      </summary>
      <div class="definition">
        <p>{{ skill.detail }}</p>
        <figure v-for="example in examples" :key="example.id">
          <blockquote>{{ example.text }}</blockquote>
          <figcaption>
            {{
              example.kind === "teaching" ? "教学例句" : example.source?.work
            }}
            · {{ example.gloss }}
          </figcaption>
        </figure>
        <p v-if="schedule">
          下次复习 <time :datetime="schedule.due">{{ schedule.due }}</time>
        </p>
        <div class="sources">
          <span>{{ statusLabel[skill.status] }}</span>
          <RouterLink v-if="lessons.length" to="/path"
            ><BookOpen :size="14" />{{ lessons[0].title }}</RouterLink
          >
        </div>
      </div>
    </details>
  </main>
</template>

<style scoped>
.knowledge {
  max-width: 940px;
  padding-bottom: 48px;
}
.filters,
.toggle,
.search,
.sources,
.sources a {
  display: flex;
  align-items: center;
  gap: 10px;
}
.filters {
  flex-wrap: wrap;
}
.search,
select {
  background: #fffefa;
  border: 1px solid var(--line);
  border-radius: 7px;
  min-height: 44px;
  padding: 0 12px;
}
.search {
  color: var(--muted);
  flex: 1;
  min-width: 180px;
}
input[type="search"] {
  border: 0;
  min-width: 0;
  width: 100%;
  background: transparent;
  font: inherit;
  color: var(--ink);
  padding: 9px 0;
}
select {
  font: inherit;
  color: var(--ink);
}
.toggle {
  font-size: 14px;
  min-height: 44px;
}
.toggle input {
  accent-color: var(--green);
  width: 17px;
  height: 17px;
}
.count {
  color: var(--muted);
  font-size: 13px;
  margin: 20px 0 8px;
}
.entry {
  border-top: 1px solid var(--line);
}
.entry:last-child {
  border-bottom: 1px solid var(--line);
}
summary {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 15px 3px;
}
summary::-webkit-details-marker {
  display: none;
}
summary h2 {
  font-size: 20px;
}
summary small,
.sources {
  font-size: 12px;
}
.mastery {
  margin-left: auto;
  color: var(--green);
  font-size: 13px;
  white-space: nowrap;
}
[open] .chevron {
  transform: rotate(180deg);
}
.definition {
  padding: 0 4px 20px;
  line-height: 1.8;
}
figure {
  margin: 14px 0;
  padding: 10px 16px;
  border-left: 3px solid #809775;
  background: #eeefe5;
}
blockquote {
  font: 500 21px/1.7 var(--serif);
}
figcaption,
.empty,
.sources {
  color: var(--muted);
}
.sources {
  margin-top: 13px;
  flex-wrap: wrap;
}
.sources a {
  color: var(--green);
}
</style>
