import { expect, it } from "vitest";
import { pilot, scoreReading } from "../../src/content/pilot";
import { course as raw } from "../../src/content";

it("两篇自编试读取材独立于课程，考察同一组阅读能力", () => {
  const [a, b] = pilot.forms;
  expect(a.passage).not.toBe(b.passage);
  expect(a.questions.map((q) => q.target)).toEqual(
    b.questions.map((q) => q.target),
  );
  for (const f of pilot.forms) {
    expect(raw.passages.some((p) => p.text === f.passage)).toBe(false);
    expect(f.kind === "teaching" || f.attribution).toBeTruthy();
  }
});
it("评分保留每题首选，不完整或越界数据不能提交", () => {
  const f = pilot.forms[0];
  const choices = Object.fromEntries(f.questions.map((q) => [q.id, q.correct]));
  choices[f.questions[0].id] =
    (f.questions[0].correct + 1) % f.questions[0].options.length;
  expect(scoreReading(f, choices).map((a) => a.correct)).toEqual(
    f.questions.map((_, i) => i > 0),
  );
  expect(() => scoreReading(f, {})).toThrow();
  choices[f.questions[0].id] = -1;
  expect(() => scoreReading(f, choices)).toThrow();
});
