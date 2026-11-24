<script setup lang="ts">
import { Check } from "@lucide/vue";
import type { InputProps } from "./types";
defineProps<InputProps>();
defineEmits<{ select: [ids: string[]] }>();
</script>

<template>
  <div class="choices" role="group" aria-label="选择一个答案">
    <button
      v-for="(option, index) in question.options"
      :key="option.id"
      type="button"
      :aria-pressed="selected[0] === option.id"
      :disabled="locked"
      @click="$emit('select', [option.id])"
    >
      <span class="letter" aria-hidden="true">{{
        String.fromCharCode(65 + index)
      }}</span>
      {{ option.label
      }}<Check v-if="selected[0] === option.id" :size="16" aria-hidden="true" />
    </button>
  </div>
</template>
