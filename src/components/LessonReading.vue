<script setup lang="ts">
import { computed } from "vue";
import RichText from "./RichText.vue";
import type { Course, Lesson } from "../content/schema";
import SourceCredit from "./SourceCredit.vue";
import PassageGlosses from "./PassageGlosses.vue";
import { passagesOf } from "../content/passage-uses";

const props = defineProps<{ course: Course; lesson: Lesson }>();
const examples = computed(() =>
  props.lesson.mainSkills.map((id, i) => ({
    skill: props.course.skills.find((s) => s.id === id)!,
    passage: props.course.passages.find(
      (p) => p.id === props.lesson.exampleIds[i],
    )!,
  })),
);
const annotated = computed(() =>
  passagesOf(props.course, props.lesson).filter((p) => p.glosses.length),
);
</script>
<template>
  <div class="lesson-reading">
    <RichText v-if="lesson.body" :source="lesson.body" />
    <section
      v-if="examples.length"
      class="usage-examples"
      aria-label="用法与例句"
    >
      <article v-for="{ skill, passage } in examples" :key="skill.id">
        <h3>
          <span>{{ skill.word }}</span
          >{{ skill.meaning }}
        </h3>
        <RichText :source="skill.detail" />
        <blockquote class="original-text">{{ passage.text }}</blockquote>
        <small
          ><SourceCredit :passage="passage" /> ·
          <RichText :source="passage.gloss" inline
        /></small>
      </article>
    </section>
    <details v-if="annotated.length" class="lesson-glossary">
      <summary>本课词注</summary>
      <figure v-for="p in annotated" :key="p.id">
        <blockquote class="original-text">{{ p.text }}</blockquote>
        <figcaption><SourceCredit :passage="p" /></figcaption>
        <PassageGlosses :notes="p.glosses" />
      </figure>
    </details>
  </div>
</template>
<style scoped>
.lesson-reading {
  color: #44475b;
}
.usage-examples {
  margin-top: 18px;
  border-top: 1px solid #e4e5ee;
}
.usage-examples article {
  padding: 18px 0;
  border-bottom: 1px solid #e4e5ee;
}
.usage-examples h3 {
  display: flex;
  gap: 10px;
  align-items: center;
  font: inherit;
  font-weight: 700;
  margin: 0 0 6px;
  color: #272a43;
}
.usage-examples h3 span {
  color: #5245b7;
  background: #eeedff;
  border-radius: 6px;
  padding: 2px 8px;
}
.usage-examples blockquote {
  margin: 8px 0 3px;
  font-size: 1.1rem;
  font-weight: 600;
}
.usage-examples small {
  color: #666a80;
  line-height: 1.7;
}
.lesson-glossary {
  margin-top: 16px;
}
.lesson-glossary summary {
  cursor: pointer;
  font-weight: 650;
  padding: 10px 0;
}
.lesson-glossary figure {
  margin: 0;
  padding: 12px 0;
  border-top: 1px solid var(--line);
}
.lesson-glossary blockquote {
  margin: 0;
}
.lesson-glossary figcaption {
  margin-top: 4px;
  font-size: 0.85rem;
}
</style>
