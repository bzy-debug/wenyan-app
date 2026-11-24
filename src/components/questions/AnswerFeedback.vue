<script setup lang="ts">
import { computed, ref } from "vue";
import { Check, Lightbulb } from "@lucide/vue";
import { byId, optionText } from "../../content";
import type { Course, Question } from "../../content/schema";
import RichText from "../RichText.vue";

const props = defineProps<{
  course: Course;
  question: Question;
  selected: readonly string[];
  correct: boolean;
}>();
const heading = ref<HTMLHeadingElement>();
defineExpose({ focus: () => heading.value?.focus({ preventScroll: true }) });
const assisted = computed(() => !props.selected.length);
const passage = computed(() =>
  byId(props.course.passages, props.question.passageId),
);
const answer = computed(() =>
  props.question.answer
    .map((id) => optionText(props.question, id, props.course))
    .join(" → "),
);
const cue = computed(() => {
  const { question, selected } = props;
  if (props.correct) return "";
  if (assisted.value) return question.hint;
  if (question.mode !== "order")
    return byId(question.options, selected[0]).reason;
  const index = question.answer.findIndex((id, i) => id !== selected[i]);
  if (index < 0) return "";
  const id = question.answer[index];
  const reason = byId(question.options, id).reason;
  return `第 ${index + 1} 步是“${optionText(question, id, props.course)}”。${reason}`;
});
</script>

<template>
  <section
    class="answer-feedback"
    :class="{ right: correct, missed: !correct && !assisted }"
    aria-live="polite"
  >
    <h2 ref="heading" tabindex="-1">
      <component
        :is="correct ? Check : Lightbulb"
        :size="19"
        aria-hidden="true"
      />{{ correct ? "答对了" : assisted ? "看看这题怎么读" : "再看看原句" }}
    </h2>
    <template v-if="!correct">
      <p class="correct-answer"><b>正确答案</b> {{ answer }}</p>
      <RichText v-if="cue" :source="cue" />
    </template>
    <details>
      <summary>看解析</summary>
      <RichText :source="question.analysis" />
      <p class="translation">
        <b>句意</b> <RichText :source="passage.gloss" inline />
      </p>
    </details>
  </section>
</template>

<style scoped>
.answer-feedback {
  padding: 2px 3px 4px;
  color: var(--ink, #202337);
  font-size: 14px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}
h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 4px;
  font-weight: 700;
  font-family: inherit;
  font-size: 19px;
  line-height: 1.5;
  color: #494086;
}
h2:focus {
  outline: none;
}
h2:focus-visible {
  outline: 2px solid #a7a0dc;
  outline-offset: 2px;
  border-radius: 3px;
}
.right h2 {
  color: #17654a;
}
.missed h2 {
  color: #80482e;
}
.correct-answer {
  margin: 0 0 3px;
}
b {
  font-size: 13px;
  margin-right: 6px;
}
summary {
  cursor: pointer;
  color: #4b4369;
  width: fit-content;
  padding: 7px 4px;
  min-height: 36px;
  font-weight: 600;
}
summary:focus-visible {
  outline: 2px solid #6b56cb;
  outline-offset: 2px;
}
details[open] {
  margin-top: 4px;
}
.translation {
  margin: 7px 0 0;
  font-size: 13px;
  color: #51576a;
}
</style>
