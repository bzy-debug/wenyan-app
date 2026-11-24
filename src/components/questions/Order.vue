<script setup lang="ts">
import { ArrowDown, Undo2 } from "@lucide/vue";
import { optionText } from "../../content";
import type { InputProps } from "./types";

defineProps<InputProps>();
defineEmits<{ select: [ids: string[]] }>();
</script>

<template>
  <div class="order-input">
    <div
      class="order-slots"
      role="list"
      aria-label="已排顺序"
      aria-live="polite"
    >
      <div
        v-for="(option, i) in question.options"
        :key="option.id"
        role="listitem"
      >
        <span>{{ i + 1 }}</span>{{
          selected[i] ? optionText(question, selected[i]) : "待选择"
        }}
        <ArrowDown
          v-if="i + 1 < question.options.length"
          :size="14"
          aria-hidden="true"
        />
      </div>
    </div>
    <div class="order-pool" role="group" aria-label="按顺序选择动作">
      <button
        v-for="option in question.options"
        :key="option.id"
        type="button"
        :disabled="locked || selected.includes(option.id)"
        @click="$emit('select', [...selected, option.id])"
      >
        {{ option.label }}
      </button>
      <button
        type="button"
        :disabled="locked || !selected.length"
        @click="$emit('select', selected.slice(0, -1))"
      >
        <Undo2 :size="14" aria-hidden="true" />撤回上一步
      </button>
    </div>
  </div>
</template>
