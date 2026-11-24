import { expect, it } from "vitest";
import { pilotPassages } from "../../src/content/compilePilot";
import { validateUnseenTexts } from "../../src/content/validate";
import { pilot, scoreReading } from "../../src/content/pilot";
import { course as raw } from "../../src/content";

it("两篇自编试读取材独立于课程，考察同一组阅读能力", () => {
  const [a, b] = pilot.forms;
  expect(a.passage).not.toBe(b.passage);
  expect(a.questions.map((q) => q.target)).toEqual(
    b.questions.map((q) => q.target),
  );
  expect(() =>
    validateUnseenTexts(pilotPassages(pilot), raw.passages),
  ).not.toThrow();
  for (const f of pilot.forms) {
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

it("试读正文与续读即使更换标点并嵌入长篇，仍能识别已学材料", () => {
  const f = pilot.forms[0];
  for (const excerpt of [f.passage, f.extension.text]) {
    const copied = "上文。" + excerpt.replace(/\p{P}/gu, "") + "。下文。";
    expect(() =>
      validateUnseenTexts(pilotPassages(pilot), [
        { id: "p.copied", text: copied },
      ]),
    ).toThrow("p.copied");
  }
});

it("长篇自读即使只有中间一段出现在正课，也会指出重合的原文", () => {
  const text = pilot.forms[0].passage;
  const shared = Array.from(text.replace(/\p{P}/gu, "")).slice(2, 32).join("");
  expect(Array.from(shared)).toHaveLength(30);
  expect(() =>
    validateUnseenTexts(
      [{ id: "self-read", text }],
      [{ id: "lesson-excerpt", text: "前文，" + shared + "。后文。" }],
    ),
  ).toThrow(shared);
});
