<script setup lang="ts">
import { computed } from "vue";
import { renderMarkdown } from "./markdown";

const props = defineProps<{ source: string; inline?: boolean }>();
const html = computed(() => renderMarkdown(props.source, props.inline));
</script>

<template>
  <component :is="inline ? 'span' : 'div'" class="rich-text" v-html="html" />
</template>

<style scoped>
.rich-text {
  overflow-wrap: anywhere;
  line-height: 1.8;
}
span.rich-text {
  line-height: inherit;
}
.rich-text :deep(> :first-child) {
  margin-top: 0;
}
.rich-text :deep(> :last-child) {
  margin-bottom: 0;
}
.rich-text :deep(p),
.rich-text :deep(ol),
.rich-text :deep(ul) {
  margin: 0.65em 0;
}
.rich-text :deep(ul),
.rich-text :deep(ol) {
  padding-inline-start: 1.5em;
}
.rich-text :deep(li + li) {
  margin-top: 0.25em;
}
.rich-text :deep(h2),
.rich-text :deep(h3),
.rich-text :deep(h4) {
  color: #20253a;
  font-family: inherit;
  line-height: 1.5;
  font-size: 1.08em;
  margin: 1.3em 0 0.35em;
}
.rich-text :deep(blockquote) {
  background: #f5f5fc;
  border-inline-start: 3px solid #8274df;
  padding: 0.6em 1em;
  margin: 0.75em 0;
  color: #3e3a5d;
  border-radius: 0 6px 6px 0;
}
.rich-text :deep(a) {
  color: #5240b8;
  text-decoration: underline;
  text-underline-offset: 0.18em;
}
.rich-text :deep(code) {
  padding: 0.05em 0.28em;
  border-radius: 4px;
  background: #efeff6;
}
.rich-text :deep(pre) {
  white-space: pre-wrap;
  margin: 0.6em 0;
}
.rich-text :deep(.table-scroll) {
  max-width: 100%;
  overflow-x: auto;
  margin: 1em 0;
}
.rich-text :deep(table) {
  border-collapse: collapse;
  width: 100%;
  min-width: 20rem;
  font-size: 0.94em;
}
.rich-text :deep(th),
.rich-text :deep(td) {
  text-align: start;
  vertical-align: top;
  padding: 0.5em 0.65em;
  border: 1px solid #dcdeeb;
}
.rich-text :deep(th) {
  background: #f1f1f8;
  color: #333447;
  font-weight: 650;
}
</style>
