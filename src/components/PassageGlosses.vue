<script setup lang="ts">
import type { WordGloss } from "../content/schema";
defineProps<{ notes: WordGloss[] }>();
</script>

<template>
  <dl v-if="notes.length" class="glosses" aria-label="随文词义">
    <template v-for="note in notes" :key="note.term">
      <dt>{{ note.term }}</dt>
      <dd>{{ note.meaning }}</dd>
    </template>
  </dl>
</template>

<style scoped>
.glosses {
  display: grid;
  grid-template-columns: fit-content(35%) minmax(0, 1fr);
  gap: 4px 14px;
  margin: 9px 0;
  font-size: 0.93rem;
  line-height: 1.65;
  overflow-wrap: anywhere;
}
dt {
  font-weight: 650;
  color: var(--ink);
}
dd {
  margin: 0;
}
</style>
