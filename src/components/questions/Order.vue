<script setup lang="ts">
import { Undo2 } from "@lucide/vue";
import type { InputProps } from "./types";
defineProps<InputProps>();
defineEmits<{ select: [ids: string[]] }>();
</script>
<template>
  <div class="q-order">
    <ol class="q-slots" aria-label="已排顺序" aria-live="polite">
      <li
        v-for="(opt, i) in question.options"
        :key="opt.id"
        :class="{
          filled: selected[i],
          correct: feedback != null && selected[i] === question.answer[i],
          missed: feedback === false && selected[i] !== question.answer[i],
        }"
      >
        <span aria-hidden="true">{{ i + 1 }}</span>{{
          selected[i]
            ? question.options.find((o) => o.id === selected[i])?.label
            : "待选择"
        }}
      </li>
    </ol>
    <div class="q-pool" role="group" aria-label="按顺序选择动作">
      <button
        v-for="(o, i) in question.options"
        type="button"
        :key="o.id"
        :disabled="locked || selected.includes(o.id)"
        :aria-keyshortcuts="String(i + 1)"
        @click="$emit('select', [...selected, o.id])"
      >
        {{ o.label }}
      </button>
      <button
        type="button"
        class="undo"
        :disabled="locked || !selected.length"
        @click="$emit('select', selected.slice(0, -1))"
      >
        <Undo2 :size="15" aria-hidden="true" />撤回上一步
      </button>
    </div>
  </div>
</template>
