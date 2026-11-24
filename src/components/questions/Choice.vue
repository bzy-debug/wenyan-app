<script setup lang="ts">
import { Circle, CircleCheck, CircleX } from "@lucide/vue";
import { optionText } from "../../content";
import type { InputProps } from "./types";
const props = defineProps<InputProps>();
defineEmits<{ select: [ids: string[]] }>();
function state(id: string) {
  if (props.feedback != null && props.question.answer.includes(id))
    return "correct";
  if (props.feedback === false && props.selected.includes(id)) return "missed";
  return props.selected.includes(id) ? "selected" : "";
}
</script>
<template>
  <div class="q-choices" role="group" aria-label="选择一个答案">
    <button
      v-for="(option, i) in question.options"
      :key="option.id"
      type="button"
      :class="state(option.id)"
      :aria-pressed="selected.includes(option.id)"
      :disabled="locked"
      :aria-keyshortcuts="String(i + 1)"
      @click="$emit('select', [option.id])"
    >
      <span class="q-key" aria-hidden="true">{{ i + 1 }}</span><span>{{
        optionText(question, option.id, course)
      }}</span>
      <component
        class="option-icon"
        :is="
          state(option.id) === 'missed'
            ? CircleX
            : state(option.id)
              ? CircleCheck
              : Circle
        "
        :size="19"
        aria-hidden="true"
      />
    </button>
  </div>
</template>
