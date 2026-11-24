import { describe, expect, it } from "vitest";
import { course } from "../../src/content";
import { grade, recordFirst } from "../../src/domain/session";
import { roundResult, type RoundKind } from "../../src/domain/progression";
const questions = course.questions;
describe("首答与判定", () => {
  it("重试保留初次结果及提示标记", () => {
    const first = recordFirst({}, "q.1", { correct: false, hinted: true });
    expect(recordFirst(first, "q.1", { correct: true, hinted: false })).toBe(
      first,
    );
    expect(first["q.1"]).toEqual({ correct: false, hinted: true });
  });
  it("排序必须完整并完全匹配原序", () => {
    const q = questions.find((q) => q.mode === "order")!;
    expect(grade(q, q.answer)).toBe(true);
    expect(grade(q, q.answer.slice(1))).toBe(false);
    expect(grade(q, [...q.answer].reverse())).toBe(false);
  });
  it("单选与选段都拒绝多选或错误 ID", () => {
    for (const q of questions.filter((q) => q.mode !== "order")) {
      expect(grade(q, q.answer)).toBe(true);
      expect(grade(q, [...q.answer, ...q.answer])).toBe(false);
      expect(grade(q, ["other"])).toBe(false);
    }
  });
  it.each([
    ["lesson", 20],
    ["assessment", 30],
    ["review", 5],
    ["mistake", 5],
  ] as const)(
    "完成 %s 的奖励与正误及提示无关",
    (kind: RoundKind, xp: number) => {
      const round = {
        id: "r",
        kind,
        targetId: "t",
        questionIds: ["a", "b"],
        index: 1,
        selected: [],
        feedback: false,
        hinted: true,
        xp: 0,
      };
      const withAnswers = (correct: boolean, hinted: boolean) =>
        roundResult({
          ...round,
          attempts: {
            a: { correct, hinted },
            b: { correct, hinted },
          },
        });
      expect(withAnswers(false, true)).toEqual(withAnswers(true, false));
      expect(withAnswers(false, false)).toEqual({
        roundId: "r",
        kind,
        targetId: "t",
        total: 2,
        xp,
      });
      expect(() =>
        roundResult({
          ...round,
          attempts: { a: { correct: true, hinted: false } },
        }),
      ).toThrow("完成");
    },
  );
});
