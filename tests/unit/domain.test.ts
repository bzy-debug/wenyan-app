import { describe, expect, it } from "vitest";
import { course } from "../../src/content";
import {
  grade,
  recordFirst,
  summarize,
  type Attempts,
} from "../../src/domain/session";
const lesson = course.lessons[0],
  questions = course.questions;
function attempts(wrong: number[] = [], hinted: number[] = []): Attempts {
  return Object.fromEntries(
    questions.map((q, i) => [
      q.id,
      { correct: !wrong.includes(i + 1), hinted: hinted.includes(i + 1) },
    ]),
  );
}
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
  it("恰好六道独立首答、三个义项均覆盖时通过", () => {
    expect(summarize(lesson, questions, attempts([1], [2]))).toMatchObject({
      earned: 6,
      passed: true,
    });
  });
  it("五题不能通过", () =>
    expect(summarize(lesson, questions, attempts([1, 2, 3])).passed).toBe(
      false,
    ));
  it("六题正确但缺少闻义项不能通过", () =>
    expect(summarize(lesson, questions, attempts([], [3, 6]))).toMatchObject({
      earned: 6,
      passed: false,
    }));
  it("题数未完成不能结算通过", () => {
    const a = { ...attempts() };
    delete a["q.8"];
    expect(summarize(lesson, questions, a)).toMatchObject({
      earned: 7,
      complete: false,
      passed: false,
    });
  });
});
