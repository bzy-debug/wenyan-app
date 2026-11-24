<script setup lang="ts">
import "./inputs.css";
import Choice from "./Choice.vue";
import SelectSpan from "./SelectSpan.vue";
import Order from "./Order.vue";
import type { InputProps } from "./types";

const props = defineProps<InputProps>();
defineEmits<{ select: [ids: string[]] }>();
const components = { choice: Choice, span: SelectSpan, order: Order };
</script>

<template>
  <component
    :is="components[question.mode]"
    v-bind="props"
    @select="$emit('select', $event)"
  />
</template>
