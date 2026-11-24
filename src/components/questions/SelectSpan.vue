<script setup lang="ts">
import { computed } from "vue";
import { byId } from "../../content";
import Choice from "./Choice.vue";
import type { InputProps } from "./types";

const props = defineProps<InputProps>();
defineEmits<{ select: [ids: string[]] }>();
const passage = computed(() =>
  byId(props.course.passages, props.question.passageId),
);
</script>

<template>
  <blockquote class="q-passage" aria-label="原文">
    {{ passage.text }}
  </blockquote>
  <Choice
    v-bind="props"
    class="q-evidence"
    aria-label="原文证据选项"
    @select="$emit('select', $event)"
  />
</template>
