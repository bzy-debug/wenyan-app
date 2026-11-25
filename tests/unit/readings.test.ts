import { resolve } from "node:path";
import { expect, it } from "vitest";
import { readSources } from "../../src/content/node";
import { compileReadings } from "../../src/content/compileReadings";

const files = readSources(resolve("content/v1/readings"));
const file = Object.keys(files)[0];
const original = files[file];
it("各篇自读原文提供可靠底本、逐字可找的证据和查词线索", () => {
  const readings = compileReadings(files);
  expect(readings).toHaveLength(13);
  expect(readings.find((r) => r.id === "blind-bird")?.prompts).toHaveLength(4);
  expect(new Set(readings.map((r) => r.id)).size).toBe(readings.length);
  expect(new Set(readings.map((r) => r.work)).size).toBeGreaterThanOrEqual(8);
  expect(
    readings.filter((r) => r.passage.length > 100).length,
  ).toBeGreaterThanOrEqual(8);
  for (const r of readings) {
    expect(r.source).toMatch(/\/blob\/[a-f0-9]{40}\/.*#L\d+(?:-L\d+)?$/);
    expect(r.prompts.length).toBeGreaterThanOrEqual(2);
    for (const prompt of r.prompts)
      expect(r.passage).toContain(prompt.evidence);
    for (const gloss of r.glosses) expect(r.passage).toContain(gloss.term);
  }
});
it("自读稿中的生词和自校证据必须出现在读者面前的这段原文", () => {
  expect(() =>
    compileReadings({ [file]: original.replace("词注：", "词注：虚构的字：") }),
  ).toThrow(/词注/);
  expect(() =>
    compileReadings({ [file]: original.replace("证据：", "证据：无关选文") }),
  ).toThrow(/证据/);
});
