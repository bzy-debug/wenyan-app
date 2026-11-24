<script setup lang="ts">
import { ExternalLink } from "@lucide/vue";
import type { Passage } from "../content/schema";
defineProps<{ passage: Passage }>();
</script>
<template>
  <span v-if="passage.kind === 'teaching'">教学例句</span>
  <span v-else-if="passage.source" class="citation">
    <a
      v-if="passage.source.url"
      :href="passage.source.url"
      target="_blank"
      rel="noopener noreferrer"
      :title="passage.source.attribution + ' · ' + passage.source.edition"
    >
      {{ passage.source.work }}<ExternalLink :size="12" aria-hidden="true" />
    </a>
    <span v-else>{{ passage.source.work }} · {{ passage.source.edition }}</span>
  </span>
</template>
<style scoped>
.citation {
  overflow-wrap: anywhere;
}
.citation a {
  color: var(--accent-strong);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.citation svg {
  margin-left: 3px;
  vertical-align: baseline;
}
</style>
