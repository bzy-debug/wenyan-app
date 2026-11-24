<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { ArrowRight, Download, FileUp, NotebookPen } from "@lucide/vue";
import {
  exportBackup,
  importBackup,
  validateBackup,
} from "../storage/progress";
import { downloadText } from "../services/download";
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
    cause instanceof Error ? cause.message : "这次没能完成，请再试一次。";
}
async function download() {
  if (busy.value) return;
  busy.value = true;
  error.value = notice.value = "";
  try {
    downloadText(
      "文言拾阶-学习备份-" + localDay() + ".json",
      await exportBackup(),
    );
    notice.value = "备份文件已生成。";
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
      error.value = "这个文件超过 4 MB。请选择从文言拾阶导出的备份。";
      return;
    }
    const text = await file.text();
    const backup = validateBackup(text);
    candidate.value = {
      text,
      name: file.name,
      count: backup.completedIds.length,
      xp: backup.xp,
    };
  } catch {
    error.value = "读不了这个文件。请选择从文言拾阶导出的 JSON 备份。";
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
    <p class="lead">学习记录存在这个浏览器里。换设备前，可以先下载备份。</p>
    <section aria-labelledby="backup-title">
      <h2 id="backup-title">学习备份</h2>
      <div class="setting-row">
        <div>
          <h3>下载学习记录</h3>
          <p>
            备份里有你的学习进度、没做完的练习和复习安排。
          </p>
        </div>
        <button class="secondary" :disabled="busy" @click="download">
          <Download />导出备份
        </button>
      </div>
      <div class="setting-row">
        <div>
          <h3>从备份恢复</h3>
          <p>选好备份文件后，可以先看看里面记了多少次练习。</p>
        </div>
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
          {{ candidate.name }} · 已完成 {{ candidate.count }} 项练习 ·
          {{ candidate.xp }} XP
        </p>
        <p>恢复后，这个浏览器里现有的学习进度会被备份替换。</p>
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
      <h2>阅读自测</h2>
      <p>开始学习前读一篇，学过一段时间再读另一篇，看看自己能读懂多少。</p>
      <RouterLink class="text-link" to="/pilot"
        ><NotebookPen :size="16" />去做自测 <ArrowRight :size="16"
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
  outline: 3px solid var(--accent);
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
  background: var(--accent-tint);
  border: 1px solid #d6d8ee;
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
  color: var(--danger);
}
.settings h3 {
  font-size: 16px;
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 0;
}
.setting-row + .setting-row {
  border-top: 1px solid var(--line);
}
.setting-row p {
  font-size: 14px;
  margin-top: 4px;
}
.setting-row .secondary {
  flex-shrink: 0;
}
@media (max-width: 520px) {
  .setting-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }
}
</style>
