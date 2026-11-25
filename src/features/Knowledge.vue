<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { BookOpen, ChevronDown, Search } from "@lucide/vue";
import { byId, course } from "../content";
import PassageVocabulary from "./PassageVocabulary.vue";
import SourceCredit from "../components/SourceCredit.vue";
import RichText from "../components/RichText.vue";
import { progress } from "../storage/progress";
import { intervals } from "../domain/review";
import { learningPath } from "./learningPath";

const view = ref<"skills" | "words">("skills");
const query = ref("");
const area = ref("");
const onlyLearned = ref(false);
const expanded = ref(new Set<string>());
function toggleDefinition(id: string, event: Event) {
  if ((event.currentTarget as HTMLDetailsElement).open) expanded.value.add(id);
  else expanded.value.delete(id);
}
const areas = [...new Set(course.skills.map((skill) => skill.area))];
const sources = course.skills.map((skill) => {
  const card = course.cards.find((candidate) => candidate.skillId === skill.id);
  const lessons = learningPath.lessons.filter((lesson) =>
    lesson.mainSkills.includes(skill.id),
  );
  const examples = lessons.flatMap((lesson) => {
    const index = lesson.mainSkills.indexOf(skill.id);
    const passageId = lesson.exampleIds[index];
    return passageId ? [byId(course.passages, passageId)] : [];
  });
  return { skill, card, examples, lessons };
});
const entries = computed(() =>
  sources.map((entry) => ({
    ...entry,
    schedule: entry.card && progress.value.cards[entry.card.id],
  })),
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
</script>

<template>
  <main class="shell knowledge">
    <h1>知识库</h1>
    <p class="lead">想不起一个字怎么用？搜一搜，点开就能看例句。</p>
    <div class="views" role="group" aria-label="知识库内容">
      <button :aria-pressed="view === 'skills'" @click="view = 'skills'">
        知识点
      </button>
      <button :aria-pressed="view === 'words'" @click="view = 'words'">
        随文词义
      </button>
    </div>
    <div class="filters">
      <label class="search">
        <Search :size="18" aria-hidden="true" />
        <input
          v-model="query"
          type="search"
          :aria-label="view === 'words' ? '搜索随文词义' : '搜索知识点'"
          :placeholder="
            view === 'words' ? '搜索字词、释义或出处' : '搜索字、义项或用法'
          "
        />
      </label>
      <select v-if="view === 'skills'" v-model="area" aria-label="知识领域">
        <option value="">全部领域</option>
        <option v-for="item in areas" :key="item">{{ item }}</option>
      </select>
      <label v-if="view === 'skills'" class="toggle"
        ><input v-model="onlyLearned" type="checkbox" />只看已学（{{
          learned
        }}）</label
      >
    </div>
    <PassageVocabulary
      v-if="view === 'words'"
      :course="course"
      :query="query"
      @clear="query = ''"
    />
    <template v-else>
      <p class="count" role="status">共 {{ visible.length }} 个知识点</p>
      <div v-if="!visible.length" class="empty">
        <p>没有查到，试试换个字或清除筛选。</p>
        <button
          class="secondary"
          @click="
            query = '';
            area = '';
            onlyLearned = false;
          "
        >
          清除筛选
        </button>
      </div>
      <details
        v-for="{ skill, schedule, examples, lessons } in visible"
        :key="skill.id"
        class="entry"
        :open="expanded.has(skill.id)"
        @toggle="toggleDefinition(skill.id, $event)"
      >
        <summary>
          <div>
            <small>{{ skill.area }}</small>
            <h2>{{ skill.word }} · {{ skill.meaning }}</h2>
          </div>
          <span class="mastery" :class="{ learned: schedule }">{{
            schedule ? intervals[schedule.level] + " 天复习一次" : "还没学"
          }}</span>
          <ChevronDown :size="17" class="chevron" aria-hidden="true" />
        </summary>
        <div v-if="expanded.has(skill.id)" class="definition">
          <RichText :source="skill.detail" />
          <figure v-for="example in examples" :key="example.id">
            <blockquote>{{ example.text }}</blockquote>
            <figcaption>
              <SourceCredit :passage="example" />
              · <RichText :source="example.gloss" inline />
            </figcaption>
          </figure>
          <p v-if="schedule">
            下次复习 <time :datetime="schedule.due">{{ schedule.due }}</time>
          </p>
          <div v-if="lessons.length" class="sources">
            <RouterLink
              v-for="lesson in lessons"
              :key="lesson.id"
              :to="'/learn/' + lesson.id"
              ><BookOpen :size="14" />练一练 · {{ lesson.title }}</RouterLink
            >
          </div>
        </div>
      </details>
    </template>
  </main>
</template>

<style scoped>
.knowledge {
  max-width: 940px;
  padding-bottom: 48px;
}
.views {
  display: flex;
  gap: 8px;
  margin: 14px 0;
}
.views button {
  min-height: 44px;
  padding: 6px 15px;
  border-radius: 7px;
  background: var(--surface);
  border: 1px solid var(--line);
}
.views button[aria-pressed="true"] {
  color: var(--accent-strong);
  background: #eeecff;
  border-color: currentColor;
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
  background: var(--surface);
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
  accent-color: var(--accent);
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
  color: var(--muted);
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
  border-left: 3px solid #9187d9;
  background: #f4f4fb;
}
blockquote {
  font-size: 21px;
  line-height: 1.7;
  font-weight: 550;
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
  color: var(--accent);
}
.filters {
  padding: 14px 16px;
  background: #f1f2f9;
  border-radius: 11px;
}
.search:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
input[type="search"]:focus {
  outline: 0;
}
.mastery.learned {
  color: var(--success);
  background: var(--success-tint);
  border-radius: 5px;
  padding: 3px 7px;
}
.empty button {
  margin-top: 12px;
}
summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
@media (max-width: 540px) {
  .search {
    flex-basis: 100%;
  }
  summary h2 {
    font-size: 17px;
  }
  .mastery {
    font-size: 12px;
  }
}
</style>
