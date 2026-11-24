import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { byId, course } from "../../src/content";
import { learnCard, localDay, shiftDay } from "../../src/domain/review";
import { backupText } from "../../src/storage/backup";
import { emptyProgress } from "../../src/storage/model";
import {
  progress,
  initProgress,
  importBackup,
  exportBackup,
  validateBackup,
  startRound,
  startQuestions,
  selectAnswer,
  submitAnswer,
  retryAnswer,
  showHint,
  advance,
  dueCards,
  streak,
} from "../../src/storage/progress";

const lesson = course.lessons[0];
beforeEach(async () => {
  await initProgress();
  await importBackup(backupText(emptyProgress()));
});
async function begin() {
  await startRound("lesson", lesson.id);
  const id = progress.value.active!.id;
  await startQuestions(id);
  return id;
}
it("锁定课程拒绝直接进入，保留原数据", async () => {
  await expect(startRound("lesson", course.lessons[1].id)).rejects.toThrow();
  expect(progress.value.active).toBeNull();
});
it("事务存储首答、重试与提示并恢复未完成轮次，过期窗口无法提交", async () => {
  const id = await begin();
  const q = byId(course.questions, lesson.questionIds[0]);
  const wrong = q.options.find((o) => !q.answer.includes(o.id))!;
  await selectAnswer(id, q.id, [wrong.id]);
  await showHint(id, q.id);
  await submitAnswer(id, q.id);
  const saved = await exportBackup();
  expect(validateBackup(saved).active).toMatchObject({
    feedback: false,
    selected: [wrong.id],
    hinted: true,
    attempts: { [q.id]: { correct: false, hinted: true } },
  });
  await importBackup(saved);
  const restored = progress.value.active!.id;
  await expect(retryAnswer(id, q.id)).rejects.toThrow();
  await retryAnswer(restored, q.id);
  await selectAnswer(restored, q.id, q.answer);
  await submitAnswer(restored, q.id);
  expect(progress.value.active?.attempts[q.id]).toEqual({
    correct: false,
    hinted: true,
  });
  await advance(restored, q.id);
  expect(progress.value.active?.index).toBe(1);
  expect(progress.value.mistakes).toContain(q.id);
  expect(streak()).toBe(1);
});
it("结算事务和并发重放只解锁、发放一次 XP", async () => {
  for (let run = 0; run < 2; run++) {
    const id = await begin();
    for (const qid of lesson.questionIds) {
      const q = byId(course.questions, qid);
      await selectAnswer(id, qid, q.answer);
      await Promise.all([submitAnswer(id, qid), submitAnswer(id, qid)]);
      if (qid === lesson.questionIds.at(-1))
        await Promise.all([advance(id, qid), advance(id, qid)]);
      else await advance(id, qid);
    }
    expect(progress.value.xp).toBe(20);
    expect(validateBackup(await exportBackup()).lastResult?.xp).toBe(
      run === 0 ? 20 : 0,
    );
  }
  expect(progress.value.passedIds).toEqual([lesson.id]);
});
it("到期复习使用新语境与事务计分；同日不得再开始", async () => {
  const p = emptyProgress(),
    card = course.cards[0],
    previous = card.questionIds[0];
  p.cards[card.id] = learnCard(shiftDay(localDay(), -1), previous);
  await importBackup(backupText(p));
  expect(dueCards().map((c) => c.id)).toContain(card.id);
  await startRound("review", card.id);
  const r = progress.value.active!,
    q = byId(course.questions, r.questionIds[0]);
  expect(q.passageId).not.toBe(byId(course.questions, previous).passageId);
  await selectAnswer(r.id, q.id, q.answer);
  await submitAnswer(r.id, q.id);
  expect(progress.value.cards[card.id].level).toBe(1);
  await advance(r.id, q.id);
  expect(progress.value.lastResult?.xp).toBe(5);
  expect(dueCards()).toHaveLength(0);
  await expect(startRound("review", card.id)).rejects.toThrow();
});
it("成功订正移出错题，不提前提升知识卡", async () => {
  const p = emptyProgress(),
    q = byId(course.questions, lesson.questionIds[0]);
  p.mistakes = [q.id];
  await importBackup(backupText(p));
  await startRound("mistake", q.id);
  const r = progress.value.active!;
  await selectAnswer(r.id, q.id, q.answer);
  await submitAnswer(r.id, q.id);
  await advance(r.id, q.id);
  expect(progress.value.mistakes).toEqual([]);
  expect(progress.value.xp).toBe(0);
});
it("无效备份拒绝覆盖原进度", async () => {
  await begin();
  const prior = await exportBackup();
  const raw = JSON.parse(prior);
  raw.progress.active.index = 100;
  await expect(importBackup(JSON.stringify(raw))).rejects.toThrow();
  expect(await exportBackup()).toBe(prior);
});

it("到期日先做普通练习，备份保留最新语境，随后到期复习使用不同原文", async () => {
  const q = byId(course.questions, lesson.questionIds[0]);
  const card = course.cards.find((c) => c.skillId === q.skillId)!;
  const priorQuestion = card.questionIds.find(
    (id) => byId(course.questions, id).passageId !== q.passageId,
  )!;
  const p = emptyProgress();
  const schedule = learnCard(shiftDay(localDay(), -1), priorQuestion);
  p.cards[card.id] = schedule;
  await importBackup(backupText(p));
  const round = await begin();
  await selectAnswer(round, q.id, q.answer);
  await submitAnswer(round, q.id);
  const saved = await exportBackup();
  expect(validateBackup(saved).cards[card.id]).toEqual({
    ...schedule,
    lastQuestionId: q.id,
  });
  await importBackup(saved);
  await startRound("review", card.id);
  const next = byId(course.questions, progress.value.active!.questionIds[0]);
  expect(next.passageId).not.toBe(q.passageId);
});

it("拒绝来自另一门课程的备份", async () => {
  const backup = JSON.parse(await exportBackup());
  backup.courseId = "different-course";
  await expect(importBackup(JSON.stringify(backup))).rejects.toThrow();
  expect(progress.value).toEqual(emptyProgress());
});
