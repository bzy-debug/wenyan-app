import { z } from "zod";
import { byId, course } from "../content";
import { grade } from "../domain/session";
import { intervals, shiftDay } from "../domain/review";
import type { Progress } from "./model";
import type { Round } from "../domain/progression";

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
const round = z.strictObject({
  id,
  kind,
  targetId: id,
  questionIds: ids,
  index: z.int().min(0),
  selected: ids,
  hinted: z.boolean(),
  feedback: z.boolean().nullable(),
  xp: count,
  attempts: record(
    z.strictObject({ correct: z.boolean(), hinted: z.boolean() }),
  ),
});
const result = z.strictObject({
  roundId: id,
  kind,
  targetId: id,
  total: count,
  xp: count,
});
const common = {
  mistakes: ids,
  xp: count,
  days: z.array(day).refine((xs) => xs.length === new Set(xs).size),
  cards: record(
    z.strictObject({
      level: count.max(intervals.length - 1),
      due: day,
      lastDay: day,
      lastQuestionId: id,
    }),
  ),
};
const model = z.strictObject({
  ...common,
  completedIds: ids,
  active: round.nullable(),
  paused: z.array(round),
  lastResult: result.nullable(),
});
const previous = z.strictObject({
  ...common,
  passedIds: ids,
  active: round.extend({ index: z.int().min(-1) }).nullable(),
  lastResult: result
    .extend({
      passed: z.boolean(),
      earned: count,
      coverage: z.array(z.strictObject({ id, earned: count, total: count })),
    })
    .nullable(),
});
const envelope = {
  format: z.literal("wenyan-progress"),
  courseId: z.literal(course.id),
  courseVersion: z.literal(course.version),
};
const backup = z.discriminatedUnion("version", [
  z.strictObject({ ...envelope, version: z.literal(2), progress: previous }),
  z.strictObject({ ...envelope, version: z.literal(3), progress: model }),
]);
export function backupText(progress: Progress): string {
  return JSON.stringify(
    {
      format: "wenyan-progress",
      version: 3,
      courseId: course.id,
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
function checkRound(r: Round, p: Progress) {
  const expected = targetQuestions(r.kind, r.targetId);
  if (r.kind === "lesson" || r.kind === "assessment") {
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
      .slice(0, r.index)
      .every((id) => Object.hasOwn(r.attempts, id)),
  );
  const q = byId(course.questions, r.questionIds[r.index]);
  check(
    r.selected.every((id) => q.options.some((o) => o.id === id)) &&
      r.selected.length <= q.answer.length,
  );
  // The only pre-awarded XP is from a v2 in-progress review.
  check(
    r.xp === 0 ||
      (r.kind === "review" &&
        r.xp === 5 &&
        p.xp >= 5 &&
        r.attempts[q.id]?.correct &&
        !r.attempts[q.id].hinted),
  );
  if (r.feedback !== null) {
    check(r.attempts[q.id]);
    if (r.selected.length === 0) check(r.feedback === false && r.hinted);
    else
      check(
        r.selected.length === q.answer.length &&
          grade(q, r.selected) === r.feedback,
      );
  }
}
function checkProgress(p: Progress): Progress {
  const ids = new Set(
    [...course.lessons, ...course.assessments].map((t) => t.id),
  );
  for (const target of p.completedIds) check(ids.has(target));
  for (const q of p.mistakes) byId(course.questions, q);
  for (const [id, state] of Object.entries(p.cards)) {
    const card = byId(course.cards, id);
    check(
      byId(course.questions, state.lastQuestionId).skillId === card.skillId,
    );
    check(state.due === shiftDay(state.lastDay, intervals[state.level]));
  }
  const rounds = p.active ? [p.active, ...p.paused] : p.paused;
  check(new Set(rounds.map((r) => r.id)).size === rounds.length);
  check(
    new Set(rounds.map((r) => r.kind + ":" + r.targetId)).size ===
      rounds.length,
  );
  for (const r of rounds) checkRound(r, p);
  if (p.lastResult) {
    const r = p.lastResult;
    const items = targetQuestions(r.kind, r.targetId);
    const ordinary = r.kind === "lesson" || r.kind === "assessment";
    check(
      r.total === (ordinary ? items.length : 1) &&
        r.xp <= p.xp &&
        !rounds.some((round) => round.id === r.roundId),
    );
    if (ordinary) check(p.completedIds.includes(r.targetId));
  }
  return p;
}
/** Existing on-device v2 records and v2 portable backups use the same upgrade. */
export function migratePrevious(input: unknown): Progress {
  const legacy = previous.parse(input);
  const { passedIds, active, lastResult, ...rest } = legacy;
  const completedIds = [...passedIds];
  if (
    lastResult &&
    (lastResult.kind === "lesson" || lastResult.kind === "assessment") &&
    !completedIds.includes(lastResult.targetId)
  )
    completedIds.push(lastResult.targetId);
  const result = lastResult && {
    roundId: lastResult.roundId,
    kind: lastResult.kind,
    targetId: lastResult.targetId,
    total: lastResult.total,
    xp: lastResult.xp,
  };
  return checkProgress({
    ...rest,
    completedIds,
    active: active && { ...active, index: Math.max(0, active.index) },
    paused: [],
    lastResult: result,
  });
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
  return parsed.data.version === 2
    ? migratePrevious(parsed.data.progress)
    : checkProgress(parsed.data.progress);
}
