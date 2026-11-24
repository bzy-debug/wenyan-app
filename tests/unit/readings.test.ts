import { resolve } from "node:path";
import { expect, it } from "vitest";
import { readSources } from "../../src/content/node";
import { compileReadings } from "../../src/content/compileReadings";

const files = readSources(resolve("content/v1/readings"));
const file = Object.keys(files)[0];
const original = files[file];
it("八篇连续自读原文提供可靠底本、逐字可找的证据和查词线索", () => {
  const readings = compileReadings(files);
  expect(readings).toHaveLength(8);
  expect(new Set(readings.map((r) => r.work)).size).toBe(8);
  for (const r of readings) {
    expect(r.source).toMatch(/\/blob\/[a-f0-9]{40}\/.*#L\d+-L\d+$/);
    expect(r.passage.length).toBeGreaterThan(100);
    expect(r.prompts.length).toBeGreaterThanOrEqual(2);
    expect(r.passage.includes(r.prompts[0].evidence)).toBe(true);
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
