<script setup lang="ts">
import { computed } from "vue";
import type { InputProps } from "./types";
const props = defineProps<InputProps>();
defineEmits<{ select: [ids: string[]] }>();
const passage = computed(() =>
  props.course.passages.find((p) => p.id === props.question.passageId)!,
);
const spans = computed(() =>
  props.question.options
    .map((o) => ({
      id: o.id,
      span: props.course.spans.find((s) => s.id === o.spanId)!,
    }))
    .sort((a, b) => a.span.start - b.span.start),
);
</script>
<template>
  <div class="q-passage q-spans" role="group" aria-label="点选原文片段">
    <template v-for="({ id, span }, i) in spans" :key="id"
      >{{ passage.text.slice(i ? spans[i - 1].span.end : 0, span.start)
      }}<button
        type="button"
        :disabled="locked"
        :aria-pressed="selected.includes(id)"
        :aria-keyshortcuts="String(i + 1)"
        :class="{
          correct: feedback != null && question.answer.includes(id),
          missed: feedback === false && selected.includes(id),
        }"
        @click="$emit('select', [id])"
      >
        {{ span.text }}
      </button></template
    >{{ passage.text.slice(spans.at(-1)!.span.end) }}
  </div>
</template>
