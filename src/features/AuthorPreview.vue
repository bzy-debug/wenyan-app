<script setup lang="ts">
import { computed, reactive, ref, shallowRef } from "vue";
import { ArrowLeft, Check, Download, FileInput } from "@lucide/vue";
import { compileCourse, documentHeader } from "../content/compile";
import { downloadText } from "../services/download";
import { byId, course, optionText } from "../content";
import { grade } from "../domain/session";
import AnswerFeedback from "../components/questions/AnswerFeedback.vue";
import QuestionInput from "../components/questions/QuestionInput.vue";
import LessonReading from "../components/LessonReading.vue";
import SourceCredit from "../components/SourceCredit.vue";
import RichText from "../components/RichText.vue";

const root = "/content/v1/course/";
const imported = import.meta.glob<string>("/content/v1/course/**/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
});
const sources = Object.fromEntries(
  Object.entries(imported).map(([path, value]) => [
    path.slice(root.length),
    value,
  ]),
);
const documents = Object.entries(sources)
  .map(([file, source]) => ({ file, ...documentInfo(file, source) }))
  .filter((doc) => doc.kind === "课文" || doc.kind === "检查");
function documentInfo(file: string, source: string) {
  const { kind, title, id } = documentHeader(source, file);
  return { kind, title, id };
}

const file = ref(documents[0].file);
const drafts = reactive<Record<string, string>>({});
const editor = computed({
  get: () => drafts[file.value] ?? sources[file.value],
  set: (value: string) => {
    drafts[file.value] = value;
  },
});
const compiled = shallowRef(course);
const currentId = ref(documents[0].id);
const lesson = computed(() =>
  compiled.value.lessons.find((l) => l.id === currentId.value),
);
const check = computed(() =>
  compiled.value.assessments.find((a) => a.id === currentId.value),
);
const questions = computed(
  () => (lesson.value ?? check.value)?.questionIds ?? [],
);
const step = ref(-1);
const question = computed(() =>
  step.value >= 0
    ? byId(compiled.value.questions, questions.value[step.value])
    : null,
);
const passage = computed(() =>
  question.value
    ? byId(compiled.value.passages, question.value.passageId)
    : null,
);
const selection = ref<string[]>([]);
const feedback = ref<boolean | null>(null);
const error = ref("");
const notice = ref("");
const applied = ref(editor.value);
const dirty = computed(() => applied.value !== editor.value);

function showStep(value: number) {
  step.value = value;
  selection.value = [];
  feedback.value = null;
}
function preview() {
  try {
    const source = editor.value;
    const header = documentInfo(file.value, source);
    const course = compileCourse({ ...sources, [file.value]: source });
    compiled.value = course;
    currentId.value = header.id;
    applied.value = source;
    error.value = "";
    notice.value = "预览已更新";
    showStep(header.kind === "检查" ? 0 : -1);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "无法读取课稿";
    notice.value = "";
  }
}
function selectDocument(value: string) {
  file.value = value;
  preview();
}
async function openFile(input: HTMLInputElement) {
  const local = input.files?.[0];
  if (!local) return;
  input.value = "";
  try {
    if (local.size > 1_000_000)
      throw new Error("课稿超过 1 MB，请一次打开一节课。");
    const source = await local.text();
    const header = documentInfo(local.name, source);
    const match = documents.find(
      (doc) => doc.id === header.id && doc.kind === header.kind,
    );
    if (!match)
      throw new Error(
        "单元目录里找不到这份课稿的 ID。如果是新课，请先把它加到目录里。",
      );
    drafts[match.file] = source;
    selectDocument(match.file);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "文件读取失败";
  }
}
function download() {
  downloadText(
    file.value.split("/").at(-1)!,
    editor.value,
    "text/markdown;charset=utf-8",
  );
}
</script>

<template>
  <main class="shell author">
    <RouterLink to="/" class="text-link"
      ><ArrowLeft :size="16" />返回学习</RouterLink
    >
    <h1>作者预览</h1>
    <p class="lead">
      选一份课稿，改完点「更新预览」，就能试做里面的题。离开前记得下载课稿，保存这次修改。
    </p>
    <div class="tools">
      <label
        >课稿
        <select
          :value="file"
          @change="selectDocument(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="doc in documents" :key="doc.file" :value="doc.file">
            {{ doc.file }} · {{ doc.title }}
          </option>
        </select>
      </label>
      <label class="secondary upload"
        ><FileInput />打开 .md<input
          type="file"
          accept=".md,text/markdown"
          @change="openFile($event.target as HTMLInputElement)"
      /></label>
      <button type="button" class="secondary" @click="download">
        <Download />下载课稿
      </button>
    </div>
    <div class="editor-grid">
      <section>
        <label class="section-title" for="source">Markdown 原稿</label>
        <textarea id="source" v-model="editor" spellcheck="false" />
        <div class="actions">
          <button class="primary" @click="preview"><Check />更新预览</button>
          <span role="status">{{ dirty ? "改动还没显示在预览里" : notice }}</span>
        </div>
        <p v-if="error" role="alert">{{ error }}</p>
      </section>
      <section aria-label="课稿预览" class="reader">
        <template v-if="!error">
          <label
            >查看内容
            <select
              :value="step"
              @change="
                showStep(Number(($event.target as HTMLSelectElement).value))
              "
            >
              <option v-if="lesson" :value="-1">本课讲解</option>
              <option v-for="(id, i) in questions" :key="id" :value="i">
                第 {{ i + 1 }} 题
              </option>
            </select>
          </label>
          <template v-if="lesson && step === -1"
            ><h2>{{ lesson.title }}</h2>
            <LessonReading :course="compiled" :lesson="lesson"
          /></template>
          <template v-if="question && passage">
            <h2><RichText :source="question.prompt" inline /></h2>
            <small><SourceCredit :passage="passage" /></small>
            <blockquote v-if="question.mode !== 'span'" class="original-text">
              {{ passage.text }}
            </blockquote>
            <QuestionInput
              :key="question.id"
              :course="compiled"
              :question="question"
              :selected="selection"
              :locked="feedback !== null"
              :feedback="feedback"
              @select="selection = $event"
            />
            <div v-if="feedback === null" class="preview-actions">
              <button
                v-if="lesson"
                class="secondary"
                @click="
                  selection = [];
                  feedback = false;
                "
              >
                不知道
              </button>
              <button
                class="primary"
                :disabled="selection.length !== question.answer.length"
                @click="feedback = grade(question, selection)"
              >
                试答
              </button>
            </div>
            <template v-else>
              <AnswerFeedback
                :key="question.id"
                :course="compiled"
                :question="question"
                :selected="selection"
                :correct="feedback"
              />
              <button class="secondary" @click="showStep(step)">
                重新试答
              </button>
            </template>
            <details class="answer-key">
              <summary>校对题目</summary>
              <p>
                <b>正确答案</b> ·
                {{
                  question.answer
                    .map((id) => optionText(question!, id, compiled))
                    .join(" → ")
                }}
              </p>
              <template v-if="lesson && question.hint"
                ><p><b>提示</b></p>
                <RichText :source="question.hint"
              /></template>
              <p><b>解析</b></p>
              <RichText :source="question.analysis" />
              <template v-for="option in question.options" :key="option.id">
                <p v-if="option.reason">
                  <b>{{ optionText(question, option.id, compiled) }}</b> ·
                  {{ option.reason }}
                </p>
              </template>
            </details>
          </template>
        </template>
        <p v-else>按提示改好课稿，再点「更新预览」。</p>
      </section>
    </div>
  </main>
</template>

<style scoped>
.author {
  max-width: 1320px;
}
.author > .text-link {
  margin-bottom: 18px;
}
.tools {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.tools label:first-child {
  flex: 1;
  min-width: 190px;
}
select {
  display: block;
  width: 100%;
  min-height: 44px;
  background: white;
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 6px 10px;
}
.upload {
  position: relative;
  overflow: hidden;
  cursor: pointer;
}
.upload input {
  position: absolute;
  inset: 0;
  width: 100%;
  opacity: 0;
  cursor: pointer;
}
.upload:focus-within {
  outline: 3px solid var(--accent);
}
.editor-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22px;
}
.editor-grid > section {
  min-width: 0;
}
.section-title {
  font-weight: 700;
  margin-bottom: 8px;
}
textarea {
  display: block;
  width: 100%;
  height: 60vh;
  min-height: 270px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px;
  font:
    14px/1.7 ui-monospace,
    monospace;
}
.reader {
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: white;
}
.reader h2,
.reader h3,
.reader blockquote,
.reader button.primary {
  margin: 16px 0 10px;
}
.preview-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 10px;
}
.answer-key {
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.answer-key summary {
  cursor: pointer;
  color: var(--accent-strong);
  font-weight: 600;
}
.answer-key p {
  margin-top: 8px;
}
[role="alert"] {
  margin-top: 12px;
  color: var(--danger);
  overflow-wrap: anywhere;
}
@media (max-width: 760px) {
  .editor-grid {
    grid-template-columns: 1fr;
  }
  textarea {
    height: 35vh;
  }
}
</style>
