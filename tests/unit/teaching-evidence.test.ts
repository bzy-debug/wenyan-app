import { expect, it } from "vitest";
import {
  headingLinks,
  linkTeachingEvidence,
  validateTeachingEvidence,
} from "../../scripts/teaching-evidence";
import { compileCourse } from "../../src/content/compile";
import { readSources } from "../../src/content/node";

const documents = readSources("docs/example-course");

// 后一课按观测地点登记知识点，辨地点的题也可以要求读者比较两日气温。
const laterLesson = `# 课文：辨认观测地点 {#place}
简介：知道每条记录在哪里测得。

## 正文

先找地点，再看测量结果。

## 知识点：观测点 {#station}
义项：测量实际发生的地点
领域：观察记录
要诀：区分观测点与报告送达之处。
讲解：在甲地测得的数据，送往乙地，仍然属于甲地。
例句：hill

## 原文：教学例句 {#hill}
> 山顶清晨三度，山下村人接到记录。
译文：测量在山顶，记录送到山下。

## 单选：今天的这次观测在哪里做的？ {#where}
考点：station
语境：hill

- [ ] 山下
  理由：山下是接到记录的地方。
- [x] 山顶

提示：在哪里读出了“三度”？
解析：“山顶”写在读数前面。

## 原文：教学例句 {#river}
> 渡口今日比昨日暖，县城收到两天的报数。
译文：渡口负责测量，再将记录报往县城。

## 单选：哪里的记录有两天可供比较？ {#river-reading}
考点：station
语境：river

- [x] 渡口
- [ ] 县城
  理由：县城收到了渡口送来的记录。

提示：哪一处的气温变暖了？
解析：县城收到数字，不等于数字是在县城测得。
`;

const sampleCourse = compileCourse({
  ...documents,
  "unit.md": documents["unit.md"].replace("课序：rise", "课序：rise place"),
  "place.md": laterLesson,
  "check.md":
    documents["check.md"] +
    `
## 单选：这里用哪处的记录来比较上午和中午？ {#check-place}
考点：station
语境：hillside

- [x] 山下
- [ ] 山顶
  理由：原文报出的读数都在山下。

提示：地点写在第一句开头。
解析：“山下”同时限定了两次读数。
`,
});

const sections = ["句法", "实词", "虚词", "篇章", "研读", "文化"];
// 表头的空白和正文中给 ID 加的反引号都是常见 Markdown 格式。
const header = "| 读法  | 教材定位 |  讲解课 ID | 独立题 ID  | 异篇复现题 ID |";
const separator = "| --- | --- | --- | --- | --- |";
function row(
  reading: string,
  lesson = "rise",
  first = "warmer",
  next = "sequence",
) {
  return `| ${reading} | 宋 105 | \`${lesson}\` | ${first} | \`${next}\` |`;
}
function tables() {
  const files = Object.fromEntries(
    sections.map((section) => [
      section + ".md",
      [header, separator, row("在" + section + "材料中辨认气温的变化")].join(
        "\n",
      ),
    ]),
  );
  files["文化.md"] +=
    "\n" + row("比对所记的地点", "place", "where", "check-place");
  return files;
}

it("允许草稿课，按条目计数；两种读法可引用同题，复现题可登记在另一知识卡", () => {
  const files = tables();
  files["句法.md"] +=
    "\n" + row("读懂不同地点的两次观测", "rise", "warmer", "river-reading");
  const result = validateTeachingEvidence(sampleCourse, files);
  expect(result.total).toBe(8);
  expect(Object.values(result.counts).sort()).toEqual([1, 1, 1, 1, 2, 2]);
});

it("整行删除后，另一读法的复现题主考该卡也不能补足它的独立题", () => {
  const files = tables();
  files["文化.md"] = files["文化.md"].split("\n").slice(0, -1).join("\n");
  files["篇章.md"] +=
    "\n" + row("据另一地的记录辨变化", "rise", "warmer", "river-reading");
  expect(() => validateTeachingEvidence(sampleCourse, files)).toThrow(
    /station/,
  );
});

it("只在规划课中列作主修的知识卡不要求登记首题", () => {
  const course = structuredClone(sampleCourse);
  course.lessons.find((lesson) => lesson.id === "place")!.stage = "planned";
  const files = tables();
  files["文化.md"] = files["文化.md"].split("\n").slice(0, -1).join("\n");
  expect(validateTeachingEvidence(course, files).total).toBe(6);
});

it.each([
  ["missing-lesson", "warmer", "sequence", "missing-lesson"],
  ["rise", "missing-first", "sequence", "missing-first"],
  ["rise", "warmer", "missing-transfer", "missing-transfer"],
])("指出 %s / %s / %s 中断链的实体", (lesson, first, next, broken) => {
  const files = tables();
  files["实词.md"] = [
    header,
    separator,
    row("比较读数", lesson, first, next),
  ].join("\n");
  expect(() => validateTeachingEvidence(sampleCourse, files)).toThrow(broken);
});

it.each([
  ["拿同一道题作复现", "rise", "warmer", "warmer"],
  ["同课另一题另文", "rise", "warmer", "later"],
  ["复现早于独立题", "place", "where", "warmer"],
  ["独立题早于讲解", "place", "warmer", "sequence"],
])("拒绝%s", (_, lesson, first, next) => {
  const files = tables();
  files["篇章.md"] += "\n" + row("按地点对比", lesson, first, next);
  expect(() => validateTeachingEvidence(sampleCourse, files)).toThrow(
    /篇章\.md/,
  );
});

const excerpt =
  "山人出门踏雪至溪桥望见渡口木船系在老树旁便止步将当日所见与昨日所记两相比对";
it.each([
  ["相同正文换了 ID 和标点", "昨晨观雨，今晨观雪。", "昨晨观雨；今晨观雪！"],
  [
    "一篇完整短文嵌入长引文",
    "昨晨观雪，今晨观雨。",
    "吏取旧簿，昨晨观雪，今晨观雨。遂复其事。",
  ],
  [
    "两篇首尾不同而中间大段相重",
    "初晴。" + excerpt + "。山人还家。",
    "晨有霜。" + excerpt + "。弟子磨墨。",
  ],
])("%s 不能算异篇", (_, initial, transfer) => {
  const course = structuredClone(sampleCourse);
  const original = course.passages.find((passage) => passage.id === "morning")!;
  const repeated = course.passages.find(
    (passage) => passage.id === "hillside",
  )!;
  original.text = initial;
  repeated.text = transfer;
  expect(() => validateTeachingEvidence(course, tables())).toThrow(
    /异篇|重复|原文|重合|语境/,
  );
});

it.each(["讲解课", "复现课", "复现检查"])(
  "规划中的%s 即使留有题目也不算证据",
  (target) => {
    const course = structuredClone(sampleCourse);
    const files = tables();
    if (target === "复现检查") {
      course.assessments[0].stage = "planned";
    } else if (target === "讲解课") {
      course.lessons.find((lesson) => lesson.id === "rise")!.stage = "planned";
    } else {
      course.lessons.find((lesson) => lesson.id === "place")!.stage = "planned";
      files["研读.md"] +=
        "\n" + row("比较两日", "rise", "warmer", "river-reading");
    }
    expect(() => validateTeachingEvidence(course, files)).toThrow();
  },
);

it("每个领域都必须有证据表", () => {
  const files = tables();
  delete files["文化.md"];
  expect(() => validateTeachingEvidence(sampleCourse, files)).toThrow(/文化/);
});

it.each([
  "| 识读数字 | 宋 105 | rise | warmer |",
  "| 识读数字 | | rise | warmer | sequence |",
  "| 识读数字 | 宋 105 | rise | warmer | sequence | extra |",
])("遇到残缺或多余的列时指出文件和行号 %s", (badRow) => {
  const files = tables();
  files["句法.md"] += "\n" + badRow;
  expect(() => validateTeachingEvidence(sampleCourse, files)).toThrow(
    /句法\.md:4/,
  );
});

it("只报教材书名，或只报与三种教材无关的页码，不足以定位", () => {
  for (const reference of ["宋绍年《古代汉语》", "第 105 页"]) {
    const files = tables();
    files["句法.md"] +=
      "\n" + `| 辨词义 | ${reference} | rise | warmer | sequence |`;
    expect(() => validateTeachingEvidence(sampleCourse, files)).toThrow(
      /教材定位/,
    );
  }
});

it("证据行可由裸 ID 生成指向原课行号的链接，移动题目后能更新旧链接", () => {
  const sample = [header, separator, row("检查观测结果")].join("\n");
  const result = linkTeachingEvidence(
    "实词.md",
    sample,
    headingLinks(documents),
  );
  const line =
    documents["lesson.md"]
      .split("\n")
      .findIndex((s) => s.includes("{#warmer}")) + 1;
  expect(result).toContain(
    `[warmer](../../../content/v1/course/lesson.md?plain=1#L${line})`,
  );
  expect(linkTeachingEvidence("实词.md", result, headingLinks(documents))).toBe(
    result,
  );
  const moved = { ...documents, "lesson.md": "\n" + documents["lesson.md"] };
  expect(
    linkTeachingEvidence("实词.md", result, headingLinks(moved)),
  ).toContain(
    `[warmer](../../../content/v1/course/lesson.md?plain=1#L${line + 1})`,
  );
});
