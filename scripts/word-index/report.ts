import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readCourse, readSources } from "../../src/content/node";
import { compileReadings } from "../../src/content/compileReadings";
import { contexts, coverage } from "./coverage";
import { studyScope } from "./study-scope";

const directory = resolve("docs/curriculum/word-index");
function table(filename: string, header: string[]) {
  const rows = readFileSync(resolve(directory, filename), "utf8")
    .trimEnd()
    .split(/\r?\n/);
  if (rows.shift() !== header.join("\t"))
    throw new Error(filename + " 的列名不符");
  return rows.map((row, index) => {
    const cells = row.split("\t");
    if (
      cells.length !== header.length ||
      cells.some((v) => !v.trim() || v !== v.trim())
    ) {
      throw new Error(
        filename + " 第 " + (index + 2) + " 行应以制表符分列，不得留空",
      );
    }
    return cells;
  });
}
const raw = table("headwords.tsv", ["组", "顺序号", "底本号", "词头"]);
const counts = [60, 62, 65, 65, 63, 66, 71, 93, 91, 95, 89, 88, 96, 82];
let index = 0;
for (const [group, count] of counts.entries()) {
  for (let n = 0; n < count; n++, index++) {
    const row = raw[index];
    if (
      !row ||
      Number(row[0]) !== group + 1 ||
      Number(row[1]) !== index + 1 ||
      Number(row[2]) !== (index === 784 ? 385 : index + 1) ||
      Array.from(row[3]).length !== 1
    ) {
      throw new Error("编号或分组待核对：" + (index + 1));
    }
  }
}
if (raw.length !== index) throw new Error("词目清单条数不符");
const variants = new Map<string, string[]>();
for (const [number, words] of table("forms.tsv", [
  "顺序号",
  "检索字形",
  "依据",
])) {
  const forms = words.split(" ");
  if (
    !raw.some((r) => r[1] === number) ||
    variants.has(number) ||
    forms.some((v) => Array.from(v).length !== 1) ||
    new Set(forms).size !== forms.length
  ) {
    throw new Error("检索字形或条号重复/未识别：" + number);
  }
  variants.set(number, forms);
}
const entries = raw.map(([group, number, , head]) => ({
  group,
  number,
  head,
  forms: variants.get(number) ?? [head],
}));
const alignments = table("alignments.tsv", [
  "顺序号",
  "知识点ID",
  "教材小项",
  "本课所考义项",
]).map(([number, skillId, part, sense]) => ({
  number,
  skillId,
  sense: part + " · " + sense,
}));
const returns = table("returns.tsv", [
  "知识点ID",
  "后来语境ID",
  "同义用例原文",
  "再考题号",
]).map(([skillId, passageId, evidence, id]) => ({
  skillId,
  passageId,
  evidence,
  questionId: id === "—" ? undefined : id.replace(/^互证\//, ""),
  secondary: id.startsWith("互证/"),
}));
const [mode = "--check", term, ...rest] = process.argv.slice(2);
if (
  !["--write", "--check", "--lookup", "--scope"].includes(mode) ||
  (mode === "--lookup" && !term) ||
  (mode !== "--lookup" && mode !== "--scope" && Boolean(term)) ||
  rest.length
) {
  throw new Error(
    "用法：npx tsx scripts/word-index/report.ts [--check | --write | --lookup 字或顺序号 | --scope [字或顺序号]]",
  );
}
const course = readCourse();
const unmatched = table("unmatched.tsv", ["顺序号", "知识点ID", "待辨之处"]);
for (const [number, id] of unmatched) {
  if (
    !entries.some((e) => e.number === number) ||
    !course.cards.some((c) => c.skillId === id) ||
    alignments.some((a) => a.skillId === id)
  )
    throw new Error("待辨卡与课程或义项对照冲突：" + id);
}
const corpus = contexts(
  course,
  compileReadings(readSources(resolve("content/v1/readings"))),
);
const stats = coverage(course, corpus, entries, alignments, returns);
const lookupSenses = table("lookup-senses.tsv", [
  "顺序号",
  "教材小项",
  "可借助释条读出的义项",
  "原文ID",
  "所据语句",
  "查读题ID",
  "核对办法",
]);
const scopeRows = studyScope(
  stats,
  course,
  {
    lookup: lookupSenses,
    sections: table("sense-sections.tsv", ["顺序号", "词头", "一级小项"]),
    glosses: table("gloss-senses.tsv", [
      "顺序号",
      "教材小项",
      "随文可查的句中义",
      "原文ID",
      "词注词头",
      "所据语句",
    ]),
  },
  mode === "--scope" ? term : undefined,
);
const scopeReport = scopeRows.map((row) => row.join("\t")).join("\n");
if (mode === "--scope") {
  console.log(scopeReport);
} else if (mode === "--lookup") {
  const found = stats.filter(
    ({ entry }) =>
      entry.number === term ||
      entry.head === term ||
      entry.forms.includes(term),
  );
  if (!found.length) throw new Error("未收此词头或编号：" + term);
  for (const r of found) {
    console.log(r.entry.number + "【" + r.entry.head + "】 " + r.status);
    for (const [, id, note] of unmatched.filter(([n]) => n === r.entry.number))
      console.log("  待辨 " + id + " · " + note);
    for (const a of r.senses)
      console.log(
        "  " +
          a.skillId +
          " · " +
          a.sense +
          " · 卡片语境 " +
          a.examples.map((c) => c.id).join(" "),
      );
    for (const v of r.verified)
      console.log(
        "  已对读 " +
          v.skillId +
          " " +
          v.passageId +
          " · " +
          v.evidence +
          (v.questionId ? " · 再考 " + v.questionId : ""),
      );
    for (const c of r.readings)
      console.log(
        "  " + c.level + " " + c.location + " " + c.id + " " + c.text,
      );
  }
} else {
  function output(name: string, text: string) {
    const file = resolve(directory, name);
    if (mode === "--write") writeFileSync(file, text);
    else if (!existsSync(file) || readFileSync(file, "utf8") !== text) {
      throw new Error(name + " 与当前课程不符。运行 --write，然后复核差异。");
    }
  }
  output("study-scope.tsv", scopeReport + "\n");
  const rows = [
    [
      "组",
      "顺序号",
      "原词头",
      "检索字形",
      "最高证据",
      "专卡ID及课内义项",
      "卡内不同篇例",
      "已核后续用例",
      "待辨的课程卡",
      "有同形词注的段数",
      "词注例ID",
      "正文同形段数",
      "正文例ID",
    ],
  ];
  for (const r of stats) {
    rows.push([
      r.entry.group,
      r.entry.number,
      r.entry.head,
      r.entry.forms.join(" "),
      r.status,
      r.senses.map((s) => s.skillId + "：" + s.sense).join(" / "),
      r.senses.map((s) => s.examples.map((c) => c.id).join(" ")).join(" / "),
      r.verified
        .map(
          (v) =>
            v.skillId +
            "→" +
            v.passageId +
            (v.questionId
              ? "（" + (v.secondary ? "互证/" : "") + v.questionId + "）"
              : ""),
        )
        .join(" / "),
      unmatched
        .filter(([n]) => n === r.entry.number)
        .map(([, id]) => id)
        .join(" "),
      String(r.glossed.length),
      r.glossed[0]?.id ?? "",
      String(r.readings.length),
      r.readings[0]?.id ?? "",
    ]);
  }
  output(
    "coverage.tsv",
    rows.map((row) => row.map((cell) => cell || "—").join("\t")).join("\n") +
      "\n",
  );
  const summary = [
    "# 各组常用词的课程证据",
    "",
    "按教材条目号计数。每条只进入一个证据栏。“后课／自读同义”是专卡的子集，列的是另篇中已核对的同一义项。可按条号在明细中查到知识卡、原文与词注。",
    "",
    "| 组别 | 条目 | 有义项专卡 | 有同形词注 | 仅正文同形 | 未见字形 | 后课／自读同义 | 其中跨等级 | 其中另篇再考 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const g of [...new Set(entries.map((e) => e.group)), "合计"]) {
    const group =
      g === "合计" ? stats : stats.filter((r) => r.entry.group === g);
    summary.push(
      "| " +
        [
          g,
          group.length,
          ...["有义项专卡", "有同形词注", "仅正文同形", "未见字形"].map(
            (s) => group.filter((r) => r.status === s).length,
          ),
          group.filter((r) => r.verified.length).length,
          group.filter((r) => r.laterLevel).length,
          group.filter((r) => r.verified.some((v) => v.questionId)).length,
        ].join(" | ") +
        " |",
    );
  }
  summary.push(
    "",
    "覆盖范围取自当前课程清单，共 " +
      course.units.length +
      " 个单元、" +
      course.lessons.length +
      " 节课；另含 " +
      corpus.filter((c) => c.slot === null).length +
      " 篇选读。已有 " +
      alignments.length +
      " 张卡纳入义项对照。",
    "",
  );
  output("summary.md", summary.join("\n"));
  console.log(
    "已核对 " +
      stats.length +
      " 个条目、" +
      alignments.length +
      " 张卡、" +
      returns.length +
      " 条逐段对读的后续用例。",
  );
}
