import { resolve } from "node:path";
import { expect, it } from "vitest";
import { compileCourse } from "../../src/content/compile";
import { readSources } from "../../src/content/node";

const file = "lesson.md";
const example = readSources(resolve("docs/example-course"));
function withEdit(before: string, after: string) {
  expect(example[file]).toContain(before);
  return { ...example, [file]: example[file].replace(before, after) };
}
it("用气象课文独立编译新领域、自由课序与隐式知识卡", () => {
  const c = compileCourse(example);
  expect(c.levels[0]).toMatchObject({ id: "beginner", title: "气象入门" });
  expect(c.units[0].lessonIds).toEqual(["rise"]);
  expect(c.lessons[0]).toMatchObject({
    questionIds: ["warmer", "later"],
  });
  expect(c.cards).toEqual([
    {
      id: "card.increase",
      skillId: "increase",
      questionIds: ["warmer", "later"],
    },
  ]);
  expect(c.questions[0].answer).toEqual(["warmer.o1"]);
  expect(c.assessments[0].questionIds).toEqual(["sequence"]);
  expect(c.questions[2].answer).toEqual(["sequence.o2", "sequence.o1"]);
});
it("正文保留 Markdown、代码块内相同标题和字面符号", () => {
  const prose =
    "**气温** [记录](https://example.org) <script>不会在编译时执行</script>\n\n~~~md\n## 原文：教学例句 {#example}\n~~~";
  const c = compileCourse(withEdit("### 看单位，再比数值", prose));
  expect(c.lessons[0].body).toContain(prose);
  const edit = compileCourse(
    withEdit("- [x] 升高", "- [x] [升高] | [x]：3℃ {#answer.same}"),
  );
  expect(edit.questions[0].options[0]).toMatchObject({
    id: "answer.same",
    label: "[升高] | [x]：3℃",
  });
});
it.each([
  ["简介：", "通过题数：1\n简介：", /lesson\.md:\d+.*未知字段/],
  ["考点：increase", "考点：missing", /lesson\.md:\d+.*missing/],
  ["- [x] 升高", "- [ ] 升高", /lesson\.md:\d+.*正确选项/],
  ["- [x] 升高", "- [a] 升高", /lesson\.md:\d+.*选项格式/],
  ["原文：教学例句", "原文：古籍引文", /lesson\.md:\d+.*出处/],
  ["语境：morning", "时间：morning", /lesson\.md:\d+.*时间/],
  ["15 ℃。", "15 ℃，复测 15 ℃。", /lesson\.md:\d+.*第几处/],
])("编辑错误能定位文件、行与原因：%s", (before, after, error) => {
  expect(() => compileCourse(withEdit(before, after))).toThrow(error);
});
it("证据候选词即使来自不同位置，也须有可区分的选项文字", () => {
  const source = withEdit("正午 12 ℃，午后 15 ℃。", "正午 15 ℃，午后 15 ℃。");
  source[file] = source[file]
    .replace("- [ ] 12 ℃", "- [ ] 15 ℃\n  第几处：1")
    .replace("- [x] 15 ℃", "- [x] 15 ℃\n  第几处：2");
  expect(() => compileCourse(source)).toThrow(/重复选项/);
});

it("拒绝同一选项在位置标记前后分别填写两条错因", () => {
  const source = withEdit(
    "理由：这是正午的数据。",
    "理由：这是正午的数据。\n  第几处：1\n  理由：看测量时间。",
  );
  expect(() => compileCourse(source)).toThrow(/选项理由重复/);
});

it("重复片段显式选择出现次数，UTF-16 偏移与原文一致", () => {
  const source = withEdit("15 ℃。", "15 ℃，🌡复测 15 ℃。");
  source[file] = source[file].replace("- [x] 15 ℃", "- [x] 15 ℃\n  第几处：2");
  const c = compileCourse(source);
  const p = c.passages.find((p) => p.id === "afternoon")!;
  const span = c.spans.find((s) => s.id === "s.later.o2")!;
  expect(span.start).toBe(p.text.lastIndexOf("15 ℃"));
  expect(p.text.slice(span.start, span.end)).toBe(span.text);
});

it("古籍底本链接仅接受 HTTPS 并保留到原文出处", () => {
  const source = withEdit(
    "原文：教学例句 {#morning}",
    "原文：古籍引文 {#morning}\n出处：格式测试样例\n版本：测试本\n作者：测试作者\n原文权利：仅作格式测试\n译注权利：自撰\n底本链接：https://example.org/book",
  );
  expect(
    compileCourse(source).passages.find((p) => p.id === "morning")?.source?.url,
  ).toBe("https://example.org/book");
  source[file] = source[file].replace(
    "https://example.org/book",
    "javascript:alert(1)",
  );
  expect(() => compileCourse(source)).toThrow(/lesson\.md:\d+.*url/);
});
