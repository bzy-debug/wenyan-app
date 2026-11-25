import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("由仓库所存王本的目录、词头与释项段落重建两张定位清单", () => {
  const output = execFileSync(
    "python3",
    ["scripts/word-index/extract_headwords.py"],
    {
      encoding: "utf8",
    },
  );
  expect(output).toContain("已核对十四组 1086 个词条");
});

it("保存异常原编号，不将编者的回指、辨析或下一级分项误列为一级", () => {
  const sections = new Map<string, string[]>();
  const text = readFileSync(
    "docs/curriculum/word-index/sense-sections.tsv",
    "utf8",
  );
  for (const row of text.trimEnd().split("\n").slice(1)) {
    const [number, , label] = row.split("\t");
    sections.set(number, [...(sections.get(number) ?? []), label]);
  }
  expect(sections.size).toBe(1086);
  expect(sections.get("73")).toEqual(["一", "二", "三", "四", "五", "六"]); // （三）连排
  expect(sections.get("333")).toEqual(["一", "二", "二（重号）"]);
  expect(sections.get("357")).toEqual(["首段未编号", "二"]);
  expect(sections.get("504")).toEqual(["全条"]); // 通论（三）只是参考
  expect(sections.get("659")).toEqual(["一", "二"]); // ［辨］另排自己的编号
  expect(sections.get("813")).toEqual(["一", "三"]);
  expect(sections.get("825")).toEqual(["一", "二"]); // (1)、(2) 从属于（二）
});
