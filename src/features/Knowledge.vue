<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { BookOpen, ChevronDown, Search } from "@lucide/vue";
import { byId, course, knowledgeAreas } from "../content";
import PassageVocabulary from "./PassageVocabulary.vue";
import SourceCredit from "../components/SourceCredit.vue";
import RichText from "../components/RichText.vue";
import { progress } from "../storage/progress";
import { intervals } from "../domain/review";
import { learningPath, unitOfTarget } from "./learningPath";

const view = ref<"skills" | "words">("skills");
const query = ref("");
const route = useRoute();
const router = useRouter();
const area = computed({
  get() {
    const selected = route.query.area;
    return typeof selected === "string" && knowledgeAreas.includes(selected)
      ? selected
      : "";
  },
  set(selected: string) {
    void router.replace({
      query: { ...route.query, area: selected || undefined },
    });
  },
});
const onlyLearned = ref(false);
const expanded = ref(new Set<string>());
function toggleDefinition(id: string, event: Event) {
  if ((event.currentTarget as HTMLDetailsElement).open) expanded.value.add(id);
  else expanded.value.delete(id);
}
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
  const locations = lessons.map((lesson) => ({
    lesson,
    unit: unitOfTarget(lesson.id),
  }));
  const searchable = [
    skill.word,
    skill.meaning,
    skill.short,
    skill.detail,
    skill.area,
    ...lessons.map((lesson) => lesson.title),
  ].join(" ").toLowerCase();
  return { skill, card, examples, locations, searchable };
});
const entries = computed(() =>
  sources.map((entry) => ({
    ...entry,
    schedule: entry.card && progress.value.cards[entry.card.id],
  })),
);
const visible = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return entries.value.filter(
    ({ skill, schedule, searchable }) =>
      (!area.value || skill.area === area.value) &&
      (!onlyLearned.value || schedule) &&
      searchable.includes(keyword),
  );
});
const learned = computed(
  () => entries.value.filter((entry) => entry.schedule).length,
);
</script>

<template>
  <main class="shell knowledge">
    <h1>知识库</h1>
    <p class="lead">
      按字词、句式或阅读方法查找知识点，点开条目可看例句和所属课文。
    </p>
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
            view === 'words' ? '搜索字词、释义或出处' : '搜索字词、句式或课名'
          "
        />
      </label>
      <select v-if="view === 'skills'" v-model="area" aria-label="知识领域">
        <option value="">全部领域</option>
        <option v-for="item in knowledgeAreas" :key="item">{{ item }}</option>
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
        v-for="{ skill, schedule, examples, locations } in visible"
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
          <p class="skill-tip">{{ skill.short }}</p>
          <RichText :source="skill.detail" />
          <figure v-for="example in examples" :key="example.id">
            <blockquote class="original-text">{{ example.text }}</blockquote>
            <figcaption>
              <SourceCredit :passage="example" />
              · <RichText :source="example.gloss" inline />
            </figcaption>
          </figure>
          <p v-if="schedule">
            下次复习 <time :datetime="schedule.due">{{ schedule.due }}</time>
          </p>
          <ul v-if="locations.length" class="sources" aria-label="所属课文">
            <li v-for="{ lesson, unit } in locations" :key="lesson.id">
              <span v-if="unit">{{ unit.level }} · {{ unit.title }}</span>
              <RouterLink :to="'/learn/' + lesson.id">
                <BookOpen :size="16" aria-hidden="true" />{{ lesson.title }}
              </RouterLink>
            </li>
          </ul>
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
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
  flex-wrap: wrap;
  gap: 6px 20px;
}
.sources li {
  min-width: 0;
}
.sources li span {
  display: block;
}
.skill-tip {
  margin: 0 0 5px;
  font-weight: 600;
}
.sources a {
  min-height: 44px;
  font-size: 15px;
  font-weight: 600;
  color: var(--accent);
}
.sources a svg {
  flex-shrink: 0;
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
