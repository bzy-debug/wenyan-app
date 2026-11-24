<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink } from "@lucide/vue";
import readings from "virtual:wenyan-readings";

const route = useRoute();
const current = computed(() => readings.find((r) => r.id === route.params.id));
const isIndex = computed(() => !route.params.id);
</script>

<template>
  <main class="shell reading-room">
    <RouterLink class="text-link" :to="isIndex ? '/path' : '/read'">
      <ArrowLeft :size="16" aria-hidden="true" />{{
        isIndex ? "课程路径" : "自读篇目"
      }}
    </RouterLink>
    <template v-if="isIndex">
      <h1>整篇自读</h1>
      <p class="lead">
        挑一篇感兴趣的读，遇到生词可以翻看词注。读完试着用自己的话讲一遍，再看文末的问题。
      </p>
      <ul class="reading-list">
        <li v-for="item in readings" :key="item.id">
          <RouterLink :to="'/read/' + item.id">
            <span
              ><small>{{ item.period }} · {{ item.genre }}</small
              ><b>{{ item.title }}</b
              ><span>{{ item.work }}</span></span
            >
            <ArrowRight :size="18" aria-hidden="true" />
          </RouterLink>
        </li>
      </ul>
    </template>
    <article v-else-if="current" :key="current.id">
      <p class="genre">{{ current.period }} · {{ current.genre }}</p>
      <h1>{{ current.title }}</h1>
      <p class="origin">{{ current.author }} · {{ current.work }}</p>
      <div class="reading-text" aria-label="自读原文">
        <p v-for="(paragraph, i) in current.passage.split(/\n\s*\n/u)" :key="i">
          {{ paragraph }}
        </p>
      </div>
      <details class="lookup">
        <summary><BookOpen :size="16" aria-hidden="true" />查词</summary>
        <dl>
          <template v-for="gloss in current.glosses" :key="gloss.term"
            ><dt>{{ gloss.term }}</dt>
            <dd>{{ gloss.meaning }}</dd></template
          >
        </dl>
        <a
          href="https://dict.revised.moe.edu.tw/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-link"
          >查《重编国语辞典修订本》<ExternalLink :size="14" aria-hidden="true"
        /></a>
      </details>
      <section class="retell">
        <h2>读完说说看</h2>
        <details v-for="prompt in current.prompts" :key="prompt.title">
          <summary>{{ prompt.title }}</summary>
          <blockquote>{{ prompt.evidence }}</blockquote>
          <p>{{ prompt.response }}</p>
        </details>
      </section>
      <footer>
        <a
          :href="current.source"
          target="_blank"
          rel="noopener noreferrer"
          class="text-link"
          >核对底本 <ExternalLink :size="14" aria-hidden="true"
        /></a>
        <p>{{ current.edition }}</p>
      </footer>
    </article>
    <h1 v-else>找不到这篇文章</h1>
  </main>
</template>

<style scoped>
.reading-room {
  max-width: 830px;
}
h1 {
  margin: 18px 0 8px;
  font-size: clamp(27px, 4vw, 38px);
  line-height: 1.3;
}
.genre,
.origin,
small,
footer p {
  color: var(--muted);
}
.genre {
  font-size: 14px;
  margin: 22px 0 0;
}
.genre + h1 {
  margin-top: 5px;
}
.origin {
  margin: 0 0 22px;
}
.reading-text {
  font-size: clamp(19px, 2.5vw, 23px);
  line-height: 1.95;
  overflow-wrap: anywhere;
}
.reading-text p {
  margin: 0.72em 0;
}
details,
.reading-list li {
  border-top: 1px solid var(--line);
}
summary {
  cursor: pointer;
  padding: 12px 0;
  min-height: 44px;
  font-weight: 650;
}
summary svg {
  vertical-align: -2px;
  margin-right: 6px;
}
dl {
  margin: 0 0 12px;
}
dt {
  font-weight: 700;
  margin-top: 8px;
}
dd {
  margin: 2px 0 0;
  color: var(--muted);
}
.lookup {
  padding-bottom: 8px;
}
.retell {
  margin-top: 24px;
}
h2 {
  font-size: 21px;
}
.retell p {
  line-height: 1.85;
}
blockquote {
  border-left: 3px solid var(--accent);
  padding-left: 12px;
  margin: 4px 0;
  font-weight: 650;
}
footer {
  border-top: 1px solid var(--line);
  margin: 16px 0;
  padding: 16px 0;
  font-size: 13px;
}
footer p {
  margin: 6px 0;
}
.reading-list {
  list-style: none;
  padding: 0;
}
.reading-list a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 4px;
  color: inherit;
  text-decoration: none;
}
.reading-list a:hover b {
  color: var(--accent);
}
.reading-list a > span {
  display: grid;
  gap: 3px;
}
.reading-list b {
  font-size: 19px;
}
.reading-list a > span > span {
  font-size: 14px;
  color: var(--muted);
}
</style>
