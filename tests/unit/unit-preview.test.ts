import { expect, it } from "vitest";
import { checkUnit } from "../../scripts/check-unit";
import { readSources } from "../../src/content/node";

it("单元校稿随课载入旧义项，只统计目标单元，不依赖无关草稿", () => {
  const sources = readSources("content/v1/course");
  sources["unfinished/scratch.md"] = "还没有写课名。";
  const review = checkUnit(sources, "u35");
  expect(review).toMatchObject({ lessons: 3, questions: 30 });
  expect(review.notes).toBeGreaterThan(0);
});
