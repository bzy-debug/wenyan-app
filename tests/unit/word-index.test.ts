import { describe, expect, it } from "vitest";
import {
  coverage,
  type Alignment,
  type Context,
  type Entry,
} from "../../scripts/word-index/coverage";

const entry: Entry = { group: "3", number: "193", head: "适", forms: ["适"] };
const sense: Alignment = {
  number: "193",
  skillId: "travel",
  sense: "一 · 前往",
};
function context(
  id: string,
  text: string,
  slot: number | null,
  level = "L2",
  glosses: string[] = [],
): Context {
  return { id, text, slot, level, glosses, location: "lesson-" + id };
}
const first = context("a", "客适齐。", 0);
const second = { ...context("b", "舟人适楚。", 0), location: first.location };
const card = {
  questions: [
    { id: "q1", passageId: "a", skillId: "travel" },
    { id: "q2", passageId: "b", skillId: "travel" },
  ],
  cards: [{ skillId: "travel", questionIds: ["q1", "q2"] }],
};
describe("教材词目覆盖", () => {
  it("同一字形可属于不同编号，单有正文或词注不会变成已考义项", () => {
    const homograph = { ...entry, number: "999" };
    const late = context("late", "适有客至。", 7, "L4", ["适"]);
    const results = coverage(
      card,
      [first, second, late],
      [entry, homograph],
      [sense],
      [],
    );
    expect(results.map((r) => r.status)).toEqual(["有义项专卡", "有同形词注"]);
    expect(results[0].verified).toEqual([]);
    expect(results[0].laterLevel).toBe(false);
  });
  it("多字词注不拆成单字，译文和题干也不参与字形统计", () => {
    const late = context("late", "事适其愿。", 7, "L4", ["适其愿"]);
    const [r] = coverage({ questions: [], cards: [] }, [late], [entry], [], []);
    expect(r.status).toBe("仅正文同形");
    expect(r.glossed).toHaveLength(0);
  });
  it("同段重新标点不能充作第二种答题语境", () => {
    const duplicate = { ...second, text: "客适齐！" };
    expect(() =>
      coverage(card, [first, duplicate], [entry], [sense], []),
    ).toThrow("两段");
  });
  it("跨级复现须有逐字可查、含目标字的新语境，同一段拉长或缩短不计", () => {
    const late = context("late", "子适卫，冉有仆。", 5, "L4");
    const citation = {
      skillId: "travel",
      passageId: "late",
      evidence: "子适卫",
    };
    expect(
      coverage(card, [first, second, late], [entry], [sense], [citation])[0]
        .laterLevel,
    ).toBe(true);
    for (const bad of ["子适齐", "冉有仆"]) {
      expect(() =>
        coverage(
          card,
          [first, second, late],
          [entry],
          [sense],
          [{ ...citation, evidence: bad }],
        ),
      ).toThrow("复现");
    }
    const repeated = { ...late, text: "客适齐，旬日归。" };
    expect(() =>
      coverage(
        card,
        [first, second, repeated],
        [entry],
        [sense],
        [{ ...citation, evidence: "客适齐" }],
      ),
    ).toThrow("新文");
  });
  it("选读篇没有固定学习顺序，已对读的自读例不计作后级", () => {
    const extra = context("reading/x", "童子适野，采薪而归。", null, "自读");
    const [r] = coverage(
      card,
      [first, second, extra],
      [entry],
      [sense],
      [{ skillId: "travel", passageId: extra.id, evidence: "童子适野" }],
    );
    expect(r.verified).toHaveLength(1);
    expect(r.laterLevel).toBe(false);
  });

  it("编入同一复习卡的后课新题可以回证，另卡题号须明记互证", () => {
    const late = context("later", "客从魏适晋。", 5, "L4");
    const curriculum = {
      cards: [{ skillId: "travel", questionIds: ["q1", "q2", "q3"] }],
      questions: [
        ...card.questions,
        { id: "q3", passageId: "later", skillId: "travel" },
        { id: "q4", passageId: "later", skillId: "contrast" },
      ],
    };
    const citation = {
      skillId: "travel",
      passageId: "later",
      evidence: "从魏适晋",
      questionId: "q3",
    };
    const inspect = (r: typeof citation & { secondary?: boolean }) =>
      coverage(curriculum, [first, second, late], [entry], [sense], [r]);
    expect(inspect(citation)[0].verified).toHaveLength(1);
    expect(inspect(citation)[0].senses[0].examples).toHaveLength(2);
    expect(() => inspect({ ...citation, questionId: "q4" })).toThrow("复现");
    expect(
      inspect({ ...citation, questionId: "q4", secondary: true })[0].verified,
    ).toHaveLength(1);
  });
});
