<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { ChevronDown } from "@lucide/vue";
import SourceCredit from "../components/SourceCredit.vue";
import { vocabularyEntries } from "../content/passage-uses";
import type { Course } from "../content/schema";

const props = defineProps<{ course: Course; query: string }>();
defineEmits<{ clear: [] }>();
const entries = computed(() => vocabularyEntries(props.course));
const matching = computed(() => {
  const search = props.query.trim().toLowerCase();
  if (!search) return entries.value;
  const hits = entries.value.filter(({ term, meaning, passage }) =>
    [term, meaning, passage.source?.work ?? "教学例句"].some((value) =>
      value.toLowerCase().includes(search),
    ),
  );
  return hits.sort(
    (a, b) =>
      Number(b.term.toLowerCase() === search) -
      Number(a.term.toLowerCase() === search),
  );
});
</script>

<template>
  <p class="count" role="status">共 {{ matching.length }} 条随文词义</p>
  <template v-if="!matching.length">
    <p>没有找到这条词义。</p>
    <button v-if="query" class="secondary" @click="$emit('clear')">
      清除搜索
    </button>
  </template>
  <details
    v-for="entry in matching"
    :key="entry.passage.id + ':' + entry.term"
    class="note"
  >
    <summary>
      <b>{{ entry.term }}</b
      ><span>{{ entry.meaning }}</span>
      <ChevronDown :size="17" aria-hidden="true" />
    </summary>
    <figure>
      <blockquote class="original-text">{{ entry.passage.text }}</blockquote>
      <figcaption><SourceCredit :passage="entry.passage" /></figcaption>
    </figure>
    <div class="links">
      <span v-for="link in entry.links" :key="link.id">
        {{ link.kind === "lesson" ? "课文" : "单元自测" }} ·
        <RouterLink :to="'/learn/' + link.id">{{ link.title }}</RouterLink>
      </span>
    </div>
  </details>
</template>

<style scoped>
.count {
  color: var(--muted);
  font-size: 13px;
  margin: 20px 0 8px;
}
.note {
  border-top: 1px solid var(--line);
}
summary {
  display: grid;
  grid-template-columns: fit-content(36%) 1fr auto;
  gap: 12px;
  align-items: baseline;
  cursor: pointer;
  min-height: 44px;
  padding: 13px 3px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}
summary::-webkit-details-marker {
  display: none;
}
summary b {
  font-size: 1.08rem;
}
summary svg {
  align-self: center;
}
details[open] svg {
  transform: rotate(180deg);
}
figure {
  margin: 0 0 10px;
}
blockquote {
  margin: 0 0 4px;
  line-height: 1.8;
}
figcaption,
.links {
  font-size: 0.875rem;
  color: var(--muted);
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 14px;
  padding-bottom: 16px;
}
.links a {
  color: var(--accent);
}
</style>
