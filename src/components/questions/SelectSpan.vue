<script setup lang="ts">
import { computed } from "vue";
import { byId, course } from "../../content";
import type { InputProps } from "./types";

const props = defineProps<InputProps>();
defineEmits<{ select: [ids: string[]] }>();
const passage = computed(() => byId(course.passages, props.question.passageId));
const spans = computed(() =>
  props.question.options
    .map((option) => ({
      id: option.id,
      span: byId(course.spans, option.spanId!),
    }))
    .sort((a, b) => a.span.start - b.span.start),
);
</script>

<template>
  <div class="span-input" role="group" aria-label="点选原文片段">
    <template v-for="({ id, span }, index) in spans" :key="id"
      >{{ passage.text.slice(index ? spans[index - 1].span.end : 0, span.start)
      }}<button
        type="button"
        :disabled="locked"
        :aria-pressed="selected[0] === id"
        @click="$emit('select', [id])"
      >
        {{ span.text }}
      </button></template
    >{{ passage.text.slice(spans.at(-1)!.span.end) }}
  </div>
</template>
