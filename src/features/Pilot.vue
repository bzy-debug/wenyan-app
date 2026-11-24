<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef } from "vue";
import { ArrowLeft, ChevronDown } from "@lucide/vue";
import { RouterLink } from "vue-router";
import { downloadText } from "../services/download";
import RichText from "../components/RichText.vue";
import { pilot, type PilotForm } from "../content/pilot";
import {
  readPilotRecords,
  clearPilotRecords,
  savePilot,
  type PilotRecord,
} from "../storage/pilot";

const consent = ref(false);
const records = ref<PilotRecord[]>([]);
const active = shallowRef<PilotForm>();
const selections = ref<Record<string, number>>({});
const feedback = ref("");
const cancelRequested = ref(false);
const taskHeading = ref<HTMLElement>();
function sourceLabel(form: PilotForm) {
  return form.kind === "teaching" ? "自编教学短文" : form.attribution;
}
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
const answered = computed(
  () =>
    active.value?.questions.filter((q) =>
      Number.isInteger(selections.value[q.id]),
    ).length ?? 0,
);
const complete = computed(() =>
  Boolean(active.value && answered.value === active.value.questions.length),
);
const findRecord = (form: PilotForm) =>
  records.value.find((r) => r.formId === form.id);
const forms = computed(() =>
  pilot.forms.map((current) => {
    const record = findRecord(current);
    // Legacy records only contain option indexes. Resolve them against their original revision.
    const form = record?.material ?? current;
    const hasMaterial =
      !record || Boolean(record.material) || record.version === current.version;
    const explanations = form.questions.map((question) => {
      const answer = record?.answers.find((a) => a.questionId === question.id);
      return {
        question,
        selection: answer ? question.options[answer.selected] : "",
      };
    });
    return { form, record, explanations, hasMaterial };
  }),
);
async function load() {
  try {
    records.value = await readPilotRecords();
    ready.value = true;
  } catch {
    message.value = "自测记录打不开。请允许浏览器保存本地数据，然后刷新。";
  } finally {
    busy.value = false;
  }
}
onMounted(load);

async function start(form: PilotForm) {
  if (!consent.value || !ready.value || findRecord(form)) return;
  selections.value = {};
  feedback.value = "";
  segments.value = [];
  interpretation.value = "";
  message.value = "";
  cancelRequested.value = false;
  active.value = form;
  await nextTick();
  taskHeading.value?.focus();
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
    message.value = "你的答案和反馈已保存在这个浏览器里。";
  } catch {
    await load();
    if (active.value && findRecord(active.value)) active.value = undefined;
    message.value = "这次没有保存成功。请看看是否已有记录，或检查浏览器是否允许保存数据。";
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
    message.value = "本机自测记录已删除。";
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
    message.value = "这个浏览器里还没有可导出的自测记录。";
    return;
  }
  const payload = {
    kind: "wenyan-reading-pilot",
    version: pilot.version,
    submissions: records.value,
  };
  try {
    downloadText(
      "wenyan-pilot-v" + pilot.version + ".json",
      JSON.stringify(payload, null, 2),
    );
  } catch {
    message.value = "导出失败，请重新下载。";
  }
}
</script>

<template>
  <main class="reading pilot">
    <RouterLink to="/settings" class="back"
      ><ArrowLeft :size="16" aria-hidden="true" /> 设置</RouterLink
    >
    <h1>阅读自测</h1>
    <template v-if="!active">
      <p class="lead">开始学习前，先自己读一篇古文。学过一段时间，再读第二篇，看看哪些地方已经能自己读懂。</p>

      <div class="pilot-permission">
        <p>答案和反馈只保存在这个浏览器里。要分享给别人，可以自行下载记录。</p>
        <label v-if="forms.some((item) => !item.record)" class="permission">
          <input
            v-model="consent"
            type="checkbox"
          />我同意在本机保存这次自测的答案和自愿填写的反馈。
        </label>
      </div>
      <section
        v-for="{ form, record, explanations, hasMaterial } in forms"
        :key="form.id"
        class="pilot-section"
      >
        <small
          >{{ form.stage }} · {{ sourceLabel(form) }} ·
          {{ form.questions.length }} 道阅读题</small
        >
        <h2>{{ form.title }}</h2>
        <template v-if="record">
          <p>自测记录已保存</p>
          <details v-if="hasMaterial">
            <summary>
              查看作答与解析 <ChevronDown :size="16" aria-hidden="true" />
            </summary>
            <blockquote>{{ form.passage }}</blockquote>
            <div
              v-for="{ question: q, selection } in explanations"
              :key="q.id"
              class="finding"
            >
              <strong
                >{{ q.target }} · <RichText :source="q.prompt" inline
              /></strong>
              <p>你的选择：{{ selection }}</p>
              <p>
                参考答案：{{ q.options[q.correct] }}。<RichText
                  :source="q.explanation"
                  inline
                />
              </p>
            </div>
            <h3>对照看看怎么断句、怎么理解</h3>
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
            <p v-for="other in form.extension.alternatives ?? []" :key="other">
              另一种读法：{{ other }}
            </p>
            <p>你写的大意：{{ record.interpretation || "未填写" }}</p>
            <p>参考大意：{{ form.extension.interpretation }}</p>
            <p v-if="record.feedback">你的反馈：{{ record.feedback }}</p>
          </details>
          <p v-else>这份记录对应旧版材料。仍可导出当时的答案和反馈。</p>
        </template>
        <button
          v-else
          class="secondary"
          :disabled="!consent || !ready || busy"
          @click="start(form)"
        >
          {{ form.stage === "学习前" ? "开始第一篇" : "开始第二篇" }}
        </button>
      </section>
      <div v-if="records.length" class="actions">
        <button class="primary" @click="download">导出答案和反馈</button>
        <button
          v-if="!confirmingClear"
          class="secondary"
          @click="confirmingClear = true"
        >
          删除本机自测记录
        </button>
        <template v-else>
          <button class="secondary" :disabled="busy" @click="erase">
            确认删除全部自测记录
          </button>
          <button :disabled="busy" @click="confirmingClear = false">
            取消
          </button>
        </template>
      </div>
    </template>
    <form v-else class="pilot-form" @submit.prevent="submit">
      <h2 ref="taskHeading" tabindex="-1">{{ active.title }}</h2>
      <blockquote class="passage">{{ active.passage }}</blockquote>
      <p>
        <small
          >{{ sourceLabel(active) }} ·
          <RichText :source="active.glossary" inline
        /></small>
      </p>
      <div class="answered" aria-live="polite">
        已答 {{ answered }} / {{ active.questions.length }} 题
        <progress
          :value="answered"
          :max="active.questions.length"
          aria-label="已答题数"
        />
      </div>
      <fieldset class="question" v-for="(q, i) in active.questions" :key="q.id">
        <legend>{{ i + 1 }}. <RichText :source="q.prompt" inline /></legend>
        <label
          v-for="(option, index) in q.options"
          :key="option"
          :class="{ selected: selections[q.id] === index }"
        >
          <input
            v-model="selections[q.id]"
            type="radio"
            :name="q.id"
            :value="index"
            required
          /><RichText :source="option" inline />
        </label>
      </fieldset>
      <fieldset class="extension">
        <legend>再读一句（选做）</legend>
        <p>
          读到哪里想停一停？点一下那个字，就会在它后面标出停顿。再点一下可以取消。做完可以和参考读法对照。
        </p>
        <div
          class="segmentation"
          role="group"
          aria-label="在无标点原文中标记停顿"
        >
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
        <label for="pilot-interpretation">用自己的话说说这句话的意思</label>
        <textarea
          id="pilot-interpretation"
          v-model="interpretation"
          rows="2"
          maxlength="1000"
        />
      </fieldset>
      <label for="pilot-feedback">阅读反馈（选填）</label>
      <textarea
        id="pilot-feedback"
        v-model="feedback"
        maxlength="1000"
        rows="3"
        placeholder="哪一句让你多读了几遍？也可以说说哪个字帮了你。请勿填写姓名或联系方式。"
      />
      <div class="actions">
        <button class="primary" :disabled="busy || !complete">
          保存作答与反馈
        </button>
        <button
          type="button"
          class="secondary"
          :disabled="busy"
          @click="cancelRequested = true"
        >
          放弃本次作答
        </button>
      </div>
      <div v-if="cancelRequested" class="discard" role="alert">
        <p>离开后，这次还没保存的答案和文字都会丢失。</p>
        <div class="actions">
          <button type="button" class="secondary" @click="active = undefined">
            确认放弃</button
          ><button
            type="button"
            class="primary"
            @click="cancelRequested = false"
          >
            继续作答
          </button>
        </div>
      </div>
    </form>
    <p v-if="message" role="status">{{ message }}</p>
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
  accent-color: var(--accent);
  flex: none;
}
.pilot-section {
  border-top: 1px solid var(--line);
  padding: 22px 0;
}
.pilot-section h2,
.pilot-form h2 {
  margin: 0.4rem 0 0.8rem;
}
.pilot details blockquote {
  font-size: 1.3rem;
  line-height: 1.8;
  margin: 0.5rem 0;
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
  font-size: 1.3rem;
}
.segmentation button {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 5px;
}
.segmentation button[aria-pressed="true"] {
  color: var(--accent);
  background: var(--accent-tint);
}
.pilot-form textarea {
  resize: vertical;
  color: var(--ink);
  background: var(--surface);
  width: 100%;
  font: inherit;
  padding: 0.6rem;
  border: 1px solid var(--line);
  border-radius: 6px;
}
.pilot .back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  color: var(--accent);
}
.pilot-permission,
.discard {
  background: #f1f2f9;
  border-radius: 10px;
  padding: 12px 17px;
  margin: 18px 0;
}
.pilot-permission p {
  color: var(--muted);
  margin: 0;
  font-size: 14px;
}
.pilot-section small {
  color: var(--accent);
  font-weight: 600;
}
.pilot-section summary {
  cursor: pointer;
  padding: 0.4rem 0;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  color: var(--accent);
}
.pilot-section summary::-webkit-details-marker {
  display: none;
}
.finding {
  margin: 0.8rem 0;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.pilot-form .passage {
  margin: 16px 0 8px;
  padding: 17px 20px;
  background: #f0f4f8;
  border-left: 3px solid #8193aa;
  font-size: 22px;
  line-height: 1.9;
}
.answered {
  color: var(--muted);
  margin: 20px 0;
  font-size: 14px;
}
.answered progress {
  display: block;
  width: 100%;
  height: 6px;
  margin-top: 6px;
}
.pilot-form .question label {
  border: 1px solid var(--line);
  background: var(--surface);
  border-radius: 9px;
  padding: 9px 12px;
  margin: 6px 0;
  cursor: pointer;
}
.pilot-form .question label.selected {
  border-color: var(--accent);
  background: var(--accent-tint);
}
.pilot-form input[type="radio"],
.permission input {
  width: 17px;
  height: 17px;
}
.pilot .extension {
  margin: 18px 0;
}
</style>
