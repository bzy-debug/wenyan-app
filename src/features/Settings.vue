<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { ArrowRight, Download, FileUp } from "@lucide/vue";
import {
  exportBackup,
  importBackup,
  validateBackup,
} from "../storage/progress";
import { localDay } from "../domain/review";

const busy = ref(false);
const error = ref("");
const notice = ref("");
const candidate = ref<{
  text: string;
  name: string;
  count: number;
  xp: number;
} | null>(null);
function displayError(cause: unknown) {
  error.value =
    cause instanceof Error ? cause.message : "操作未能完成，请重试。";
}
async function download() {
  if (busy.value) return;
  busy.value = true;
  error.value = notice.value = "";
  try {
    const blob = new Blob([await exportBackup()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "文言拾阶-学习备份-" + localDay() + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice.value = "已生成备份文件，请妥善保存。";
  } catch (cause) {
    displayError(cause);
  } finally {
    busy.value = false;
  }
}
async function choose(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || busy.value) return;
  candidate.value = null;
  busy.value = true;
  error.value = notice.value = "";
  try {
    if (file.size > 4_000_000) {
      error.value = "备份超过 4 MB。请选择有效的学习备份。";
      return;
    }
    const text = await file.text();
    const backup = validateBackup(text);
    candidate.value = {
      text,
      name: file.name,
      count: backup.passedIds.length,
      xp: backup.xp,
    };
  } catch {
    error.value = "无法读取此备份。请选择从文言拾阶导出的有效 JSON 学习备份。";
  } finally {
    busy.value = false;
  }
}
async function restore() {
  if (!candidate.value || busy.value) return;
  busy.value = true;
  error.value = notice.value = "";
  try {
    await importBackup(candidate.value.text);
    candidate.value = null;
    notice.value = "学习进度已恢复。";
  } catch (cause) {
    displayError(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="reading settings">
    <h1>设置</h1>
    <section>
      <h2>学习备份</h2>
      <p>
        学习记录保存在此浏览器中。换设备或清理浏览器前，可导出进度，再在另一台设备上恢复。
      </p>
      <div class="actions">
        <button class="primary" :disabled="busy" @click="download">
          <Download />导出备份
        </button>
        <label class="secondary file" :class="{ disabled: busy }"
          ><FileUp />选择备份文件<input
            type="file"
            accept=".json,application/json"
            aria-label="选择备份文件"
            :disabled="busy"
            @change="choose"
        /></label>
      </div>
      <div v-if="candidate" class="preview">
        <h3>恢复这个备份？</h3>
        <p>
          {{ candidate.name }} · 已通过 {{ candidate.count }} 个关卡 ·
          {{ candidate.xp }} XP
        </p>
        <p>确认后，备份中的学习记录将覆盖此浏览器的现有进度。</p>
        <div class="actions">
          <button class="primary" :disabled="busy" @click="restore">
            确认恢复
          </button>
          <button class="secondary" :disabled="busy" @click="candidate = null">
            取消
          </button>
        </div>
      </div>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="notice" role="status">{{ notice }}</p>
    </section>
    <section>
      <h2>参与试用</h2>
      <RouterLink class="text-link" to="/pilot"
        >陌生文本试读与反馈 <ArrowRight :size="16"
      /></RouterLink>
    </section>
  </main>
</template>

<style scoped>
.settings section {
  padding: 23px 0;
  border-bottom: 1px solid var(--line);
}
.settings h2 {
  font-size: 23px;
}
.settings p {
  margin-top: 8px;
  color: var(--muted);
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.file {
  position: relative;
  cursor: pointer;
}
.file:focus-within {
  outline: 3px solid #a55a28;
  outline-offset: 3px;
}
.file input {
  opacity: 0;
  position: absolute;
  inset: 0;
  width: 100%;
  cursor: pointer;
}
.disabled {
  opacity: 0.6;
}
.preview {
  background: #edf2e7;
  border: 1px solid #ccd7c5;
  padding: 16px;
  border-radius: 9px;
  margin-top: 16px;
}
.preview h3 {
  font-size: 19px;
}
.settings .text-link {
  width: fit-content;
  min-height: 44px;
}
.settings [role="alert"] {
  color: #914a22;
}
</style>
