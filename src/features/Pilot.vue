<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { pilot, type PilotForm } from "../content/pilot";
import {
  readPilotRecords,
  clearPilotRecords,
  savePilot,
  type PilotRecord,
} from "../storage/pilot";

const consent = ref(false);
const records = ref<PilotRecord[]>([]);
const active = ref<PilotForm>();
const selections = ref<Record<string, number>>({});
const feedback = ref("");
const segments = ref<number[]>([]);
const interpretation = ref("");
function toggleBreak(after: number) {
  segments.value = segments.value.includes(after)
    ? segments.value.filter((n) => n !== after)
    : [...segments.value, after];
}
function displaySegments(text: string, points: number[]) {
  return Array.from(text)
    .map((char, i) => char + (points.includes(i + 1) ? "／" : ""))
    .join("");
}
const confirmingClear = ref(false);
const busy = ref(true);
const ready = ref(false);
const message = ref("");
const complete = computed(() =>
  active.value?.questions.every((q) =>
    Number.isInteger(selections.value[q.id]),
  ),
);
const findRecord = (form: PilotForm) =>
  records.value.find((r) => r.formId === form.id);
const forms = computed(() =>
  pilot.forms.map((form) => {
    const record = findRecord(form);
    const explanations = form.questions.map((question) => {
      const answer = record?.answers.find((a) => a.questionId === question.id);
      return {
        question,
        selection: answer ? question.options[answer.selected] : "",
      };
    });
    const score = record?.answers.filter((answer) => answer.correct).length;
    return { form, record, score, explanations };
  }),
);
async function load() {
  try {
    records.value = await readPilotRecords();
    ready.value = true;
  } catch {
    message.value = "无法读取本机试读记录，请检查浏览器存储权限，再刷新重试。";
  } finally {
    busy.value = false;
  }
}
onMounted(load);

function start(form: PilotForm) {
  if (!consent.value || !ready.value || findRecord(form)) return;
  selections.value = {};
  feedback.value = "";
  segments.value = [];
  interpretation.value = "";
  message.value = "";
  active.value = form;
}
async function submit() {
  if (!active.value || !complete.value || !consent.value || busy.value) return;
  busy.value = true;
  try {
    const record = await savePilot(
      active.value,
      selections.value,
      feedback.value,
      segments.value,
      interpretation.value,
    );
    records.value = [...records.value, record];
    active.value = undefined;
    consent.value = false;
    message.value = "本次首答与反馈已保存在此浏览器。";
  } catch {
    await load();
    if (active.value && findRecord(active.value)) active.value = undefined;
    message.value = "未写入新记录。请查看已有记录或检查浏览器存储权限。";
  } finally {
    busy.value = false;
  }
}
async function erase() {
  busy.value = true;
  try {
    await clearPilotRecords();
    records.value = [];
    active.value = undefined;
    consent.value = false;
    confirmingClear.value = false;
    message.value = "本机试读记录已删除。";
  } catch {
    message.value = "删除失败，请重试。";
  } finally {
    busy.value = false;
  }
}
async function download() {
  try {
    records.value = await readPilotRecords();
  } catch {
    message.value = "导出失败，请检查本机存储权限后重试。";
    return;
  }
  if (!records.value.length) {
    message.value = "本机已没有可导出的试读记录。";
    return;
  }
  const payload = {
    kind: "wenyan-reading-pilot",
    version: pilot.version,
    submissions: records.value,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "wenyan-pilot-v1.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>

<template>
  <main class="reading pilot">
    <RouterLink to="/settings" class="back">← 设置</RouterLink>
    <h1>陌生文本试读</h1>
    <template v-if="!active">
      <p class="lead">学习前后各读一篇新短文，看看哪些文意可以独立读通。</p>
      <p>
        每篇 3 题，约 3
        分钟。请独立作答。成绩与反馈仅保存于此浏览器，只有你主动导出并分享时，试用组织者才能看到。
      </p>
      <label v-if="records.length < pilot.forms.length" class="permission">
        <input
          v-model="consent"
          type="checkbox"
        />我同意在本机记录试读首答与自愿填写的反馈。
      </label>
      <section
        v-for="({ form, record, score, explanations }, i) in forms"
        :key="form.id"
        class="pilot-section"
      >
        <small>{{ i === 0 ? "学习前" : "学习后" }} · 自编教学短文 · 草稿</small>
        <h2>{{ form.title }}</h2>
        <template v-if="record">
          <p>独立首答 {{ score }} / {{ form.questions.length }}</p>
          <details>
            <summary>查看首答与解析</summary>
            <blockquote>{{ form.passage }}</blockquote>
            <div
              v-for="{ question: q, selection } in explanations"
              :key="q.id"
              class="finding"
            >
              <strong>{{ q.target }} · {{ q.prompt }}</strong>
              <p>你的选择：{{ selection }}</p>
              <p>参考答案：{{ q.options[q.correct] }}。{{ q.explanation }}</p>
            </div>
            <h3>断句与译意自评</h3>
            <p>
              你的断句：{{
                displaySegments(form.extension.text, record.segments)
              }}
            </p>
            <p>
              一种读法：{{ form.extension.segmented }}。{{
                form.extension.explanation
              }}
            </p>
            <p>你的译意或概括：{{ record.interpretation || "未填写" }}</p>
            <p>参考大意：{{ form.extension.interpretation }}</p>
            <p v-if="record.feedback">你的反馈：{{ record.feedback }}</p>
          </details>
        </template>
        <button
          v-else
          class="secondary"
          :disabled="!consent || !ready || busy"
          @click="start(form)"
        >
          开始{{ i === 0 ? "学习前" : "学习后" }}试读
        </button>
      </section>
      <div v-if="records.length" class="actions">
        <button class="primary" @click="download">导出试读与反馈</button>
        <button
          v-if="!confirmingClear"
          class="secondary"
          @click="confirmingClear = true"
        >
          删除本机试读记录
        </button>
        <template v-else>
          <button class="secondary" :disabled="busy" @click="erase">
            确认删除全部试读记录
          </button>
          <button :disabled="busy" @click="confirmingClear = false">
            取消
          </button>
        </template>
      </div>
    </template>
    <form v-else class="pilot-form" @submit.prevent="submit">
      <h2>{{ active.title }}</h2>
      <blockquote class="passage">{{ active.passage }}</blockquote>
      <p>
        <small>自编教学短文 · 草稿。{{ active.glossary }}</small>
      </p>
      <fieldset v-for="(q, i) in active.questions" :key="q.id">
        <legend>{{ i + 1 }}. {{ q.prompt }}</legend>
        <label v-for="(option, index) in q.options" :key="option">
          <input
            v-model="selections[q.id]"
            type="radio"
            :name="q.id"
            :value="index"
            required
          />{{ option }}
        </label>
      </fieldset>
      <fieldset>
        <legend>续读 · 断句与译意（选做，自评）</legend>
        <p>点选一个字，在该字后加停顿；再次点选即可取消。</p>
        <div class="segmentation" aria-label="给短句断句">
          <template
            v-for="(char, i) in Array.from(active.extension.text)"
            :key="i"
          >
            <button
              v-if="i + 1 < Array.from(active.extension.text).length"
              type="button"
              :aria-label="`在第 ${i + 1} 字「${char}」后断句`"
              :aria-pressed="segments.includes(i + 1)"
              @click="toggleBreak(i + 1)"
            >
              {{ char }}<span v-if="segments.includes(i + 1)">／</span>
            </button>
            <span v-else>{{ char }}</span>
          </template>
        </div>
        <label for="pilot-interpretation">用自己的话译出或概括这句续文</label>
        <textarea
          id="pilot-interpretation"
          v-model="interpretation"
          rows="2"
          maxlength="1000"
        />
      </fieldset>
      <label for="pilot-feedback">试读反馈（选填）</label>
      <textarea
        id="pilot-feedback"
        v-model="feedback"
        maxlength="1000"
        rows="3"
        placeholder="哪句话让你犹豫？你用到了哪条线索？请勿填写姓名或联系方式。"
      />
      <div class="actions">
        <button class="primary" :disabled="busy || !complete">
          保存首答与反馈
        </button>
        <button
          type="button"
          class="secondary"
          :disabled="busy"
          @click="active = undefined"
        >
          放弃本次试读
        </button>
      </div>
    </form>
    <p role="status">{{ message }}</p>
  </main>
</template>

<style scoped>
.pilot p {
  margin: 0.65rem 0;
  line-height: 1.8;
}
.pilot .permission,
.pilot-form label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 44px;
}
.pilot input {
  accent-color: var(--green);
  flex: none;
}
.pilot-section {
  border-top: 1px solid var(--line);
  padding: 1rem 0;
}
.pilot-section h2,
.pilot-form h2 {
  margin: 0.4rem 0 0.8rem;
}
.pilot button:disabled {
  opacity: 0.55;
}
.pilot summary {
  cursor: pointer;
  padding: 0.4rem 0;
}
.pilot details blockquote {
  font: 1.3rem/1.8 var(--serif);
  margin: 0.5rem 0;
}
.finding {
  margin: 0.8rem 0;
}
.pilot-form fieldset {
  border: 0;
  border-top: 1px solid var(--line);
  padding: 0.8rem 0;
  margin: 0.8rem 0;
}
.pilot-form legend {
  font-weight: 650;
  padding-right: 0.5rem;
}
.segmentation {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
}
.segmentation button,
.segmentation > span {
  min-width: 44px;
  min-height: 44px;
  display: grid;
  place-content: center;
  grid-auto-flow: column;
  font: 1.3rem var(--serif);
}
.segmentation button {
  border: 1px solid var(--line);
  border-radius: 5px;
}
.segmentation button[aria-pressed="true"] {
  color: var(--green);
  background: #e4ecdd;
}
.pilot-form textarea {
  width: 100%;
  font: inherit;
  padding: 0.6rem;
  border: 1px solid var(--line);
  border-radius: 6px;
}
</style>
