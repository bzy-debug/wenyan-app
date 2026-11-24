import { z } from "zod";
import { byId, course } from "../content";
import { unlocked } from "../domain/progression";
import { grade } from "../domain/session";
import { intervals, shiftDay } from "../domain/review";
import type { Progress } from "./model";

const id = z
  .string()
  .min(1)
  .max(180)
  .regex(/^[\w.-]+$/);
const ids = z.array(id).refine((xs) => xs.length === new Set(xs).size);
const count = z.int().nonnegative();
const day = z.iso.date();
const kind = z.enum(["lesson", "assessment", "review", "mistake"]);
const record = <T extends z.ZodType>(value: T) => z.record(id, value);
const model = z.strictObject({
  passedIds: ids,
  mistakes: ids,
  xp: count,
  days: z.array(day).refine((xs) => new Set(xs).size === xs.length),
  cards: record(
    z.strictObject({
      level: count.max(intervals.length - 1),
      due: day,
      lastDay: day,
      lastQuestionId: id,
    }),
  ),
  active: z
    .strictObject({
      id,
      kind,
      targetId: id,
      questionIds: ids,
      index: z.int().min(-1),
      selected: ids,
      hinted: z.boolean(),
      feedback: z.boolean().nullable(),
      xp: count,
      attempts: record(
        z.strictObject({ correct: z.boolean(), hinted: z.boolean() }),
      ),
    })
    .nullable(),
  lastResult: z
    .strictObject({
      roundId: id,
      kind,
      targetId: id,
      passed: z.boolean(),
      total: count,
      earned: count,
      xp: count,
      coverage: z.array(z.strictObject({ id, earned: count, total: count })),
    })
    .nullable(),
});
const backup = z.strictObject({
  format: z.literal("wenyan-progress"),
  version: z.literal(1),
  courseVersion: z.literal(1),
  progress: model,
});
export function backupText(progress: Progress): string {
  return JSON.stringify(
    {
      format: "wenyan-progress",
      version: 1,
      courseVersion: course.version,
      progress,
    },
    null,
    2,
  );
}
function check(condition: unknown): asserts condition {
  if (!condition) throw new Error("备份中的课程或学习记录不一致");
}
function targetQuestions(kind: string, target: string): string[] {
  if (kind === "lesson") return byId(course.lessons, target).questionIds;
  if (kind === "assessment")
    return byId(course.assessments, target).questionIds;
  if (kind === "review") return byId(course.cards, target).questionIds;
  return [byId(course.questions, target).id];
}
export function validateBackup(text: string): Progress {
  if (text.length > 4_000_000) throw new Error("备份超过 4 MB");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("备份文件不是有效的 JSON");
  }
  const parsed = backup.safeParse(raw);
  if (!parsed.success) throw new Error("备份格式、日期或版本无效");
  const p = parsed.data.progress;
  for (const target of p.passedIds)
    check(unlocked(course, p.passedIds, target));
  for (const q of p.mistakes) byId(course.questions, q);
  for (const [id, state] of Object.entries(p.cards)) {
    const card = byId(course.cards, id);
    const lastQuestion = byId(course.questions, state.lastQuestionId);
    check(lastQuestion.skillId === card.skillId);
    check(state.due === shiftDay(state.lastDay, intervals[state.level]));
  }
  if (p.active) {
    const r = p.active;
    const expected = targetQuestions(r.kind, r.targetId);
    const normal = r.kind === "lesson" || r.kind === "assessment";
    if (normal) {
      check(unlocked(course, p.passedIds, r.targetId));
      check(
        r.questionIds.length === expected.length &&
          expected.every((id, i) => id === r.questionIds[i]),
      );
    } else {
      check(
        r.questionIds.length === 1 &&
          expected.includes(r.questionIds[0]) &&
          r.index === 0,
      );
      if (r.kind === "review") check(p.cards[r.targetId]);
    }
    check(r.index < r.questionIds.length);
    check(
      Object.keys(r.attempts).every((id) =>
        r.questionIds.slice(0, r.index + 1).includes(id),
      ),
    );
    check(
      r.questionIds
        .slice(0, Math.max(r.index, 0))
        .every((id) => r.attempts[id]),
    );
    if (r.index < 0)
      check(!r.selected.length && !r.hinted && r.feedback === null);
    else {
      const q = byId(course.questions, r.questionIds[r.index]);
      check(r.selected.every((id) => q.options.some((o) => o.id === id)));
      check(r.selected.length <= q.answer.length);
      if (r.feedback !== null) {
        check(
          r.attempts[q.id] &&
            r.selected.length === q.answer.length &&
            grade(q, r.selected) === r.feedback,
        );
      }
    }
  }
  if (p.lastResult) {
    const r = p.lastResult;
    const items = targetQuestions(r.kind, r.targetId);
    const normal = r.kind === "lesson" || r.kind === "assessment";
    check(
      r.total === (normal ? items.length : 1) &&
        r.earned <= r.total &&
        r.xp <= p.xp,
    );
    const skills =
      r.kind === "lesson" ? byId(course.lessons, r.targetId).mainSkills : [];
    check(
      r.coverage.length === skills.length &&
        r.coverage.every(
          (c, i) =>
            c.id === skills[i] &&
            c.earned <= c.total &&
            c.total ===
              items.filter((id) => byId(course.questions, id).skillId === c.id)
                .length,
        ),
    );
    const threshold = r.kind === "lesson" ? 6 : r.kind === "assessment" ? 4 : 1;
    check(
      r.passed ===
        (r.earned >= threshold && r.coverage.every((c) => c.earned > 0)),
    );
    if (normal && r.passed) check(p.passedIds.includes(r.targetId));
  }
  return p;
}
