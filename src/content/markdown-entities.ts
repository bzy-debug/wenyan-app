import { fields, fail, required, type Block } from "./markdown";
import type { Course, Passage, Question, Skill } from "./schema";
export const modes = { 单选: "choice", 选段: "span", 排序: "order" } as const;
export const editorialKeys = ["状态", "审核人"];
export function editorial(
  b: Block,
  f: Record<string, string>,
): Pick<Skill, "status" | "reviewer"> {
  const names: Record<string, Skill["status"]> = {
    草稿: "draft",
    已审核: "reviewed",
    已发布: "published",
    draft: "draft",
    reviewed: "reviewed",
    published: "published",
  };
  const status = names[f.状态 ?? "草稿"];
  if (!status) fail(b, "未知审核状态：" + f.状态);
  return f.审核人 ? { status, reviewer: f.审核人 } : { status };
}
export function readPassage(b: Block): Passage {
  if (!["教学例句", "古籍引文"].includes(b.title))
    fail(b, "原文类型应为教学例句或古籍引文");
  const text: string[] = [];
  const lines = b.lines.map((line) => {
    if (!line.startsWith(">")) return line;
    text.push(line.replace(/^> ?/, ""));
    return "";
  });
  if (!text.join("").trim()) fail(b, "请用 Markdown 引用 > 写出原文");
  const f = fields({ ...b, lines }, [
    "译文",
    "原文权利",
    "译注权利",
    "出处",
    "版本",
    "作者",
    "底本链接",
    ...editorialKeys,
  ]);
  const source =
    b.title === "古籍引文"
      ? {
          work: required(b, f, "出处"),
          edition: required(b, f, "版本"),
          attribution: required(b, f, "作者"),
          url: f.底本链接,
        }
      : undefined;
  if (!source && (f.出处 || f.版本 || f.作者 || f.底本链接))
    fail(b, "真实引文请标记为古籍引文");
  return {
    id: b.id,
    kind: source ? "source" : "teaching",
    source,
    text: text.join("\n"),
    gloss: required(b, f, "译文"),
    textRights: source
      ? required(b, f, "原文权利")
      : (f.原文权利 ?? "项目自撰教学例句"),
    glossRights: source
      ? required(b, f, "译注权利")
      : (f.译注权利 ?? "项目自撰译注"),
    ...editorial(b, f),
  };
}
interface OptionLine {
  mark: string;
  label: string;
  id: string;
  line: number;
  reason?: string;
  occurrence?: number;
}
export function readQuestion(
  b: Block,
  passages: Map<string, Passage>,
  spans: Course["spans"],
): Question {
  const mode = modes[b.kind as keyof typeof modes];
  const options: OptionLine[] = [];
  let last: OptionLine | undefined;
  const lines = b.lines.map((line, index) => {
    const lineNo = b.line + index + 1,
      at = { file: b.file, line: lineNo };
    if (line.startsWith("- [")) {
      const m = line.match(
        /^- \[( |x|\d+)\]\s+(.+?)(?:\s+\{#([\w.-]+)\})?\s*$/u,
      );
      if (!m) fail(at, "选项格式应为「- [ ] 选项文字 {#选项ID}」");
      last = {
        mark: m[1],
        label: m[2],
        id: m[3] ?? b.id + ".o" + (options.length + 1),
        line: lineNo,
      };
      options.push(last);
      return "";
    }
    const detail = line.match(/^  (理由|第几处)[：:]\s*(.*)$/);
    if (last && detail) {
      if (detail[1] === "理由") {
        if (last.reason !== undefined) fail(at, "选项理由重复");
        last.reason = detail[2];
      } else {
        if (last.occurrence !== undefined || !/^[1-9]\d*$/.test(detail[2]))
          fail(at, "第几处应为唯一正整数");
        last.occurrence = Number(detail[2]);
      }
      return "";
    }
    if (last && line.startsWith("    ") && last.reason !== undefined) {
      last.reason += "\n" + line.slice(4);
      return "";
    }
    last = undefined;
    return line;
  });
  const f = fields({ ...b, lines }, [
    "考点",
    "语境",
    "提示",
    "解析",
    ...editorialKeys,
  ]);
  const passageId = required(b, f, "语境");
  const passage = passages.get(passageId);
  if (!passage) fail(b, "无效语境：" + passageId);
  let answer: string[];
  if (mode === "order") {
    const ordered = [...options].sort(
      (a, b) => Number(a.mark) - Number(b.mark),
    );
    if (ordered.some((o, i) => o.mark !== String(i + 1)))
      fail(b, "排序选项须用 [1] 起连续且不重复的序号");
    answer = ordered.map((o) => o.id);
  } else {
    if (options.some((o) => o.mark !== "x" && o.mark !== " "))
      fail(b, "单选与选段用 [x] 标出正确项");
    answer = options.filter((o) => o.mark === "x").map((o) => o.id);
    if (answer.length !== 1) fail(b, "须有且仅有一个正确选项 [x]");
  }
  const analysis = required(b, f, "解析");
  return {
    id: b.id,
    mode,
    skillId: required(b, f, "考点"),
    passageId,
    prompt: b.title,
    analysis,
    hint: required(b, f, "提示"),
    ...editorial(b, f),
    answer,
    options: options.map((o) => {
      const at = { file: b.file, line: o.line };
      if (!o.reason && mode !== "order" && o.id !== answer[0])
        fail(at, "干扰选项缺少理由");
      const base = {
        id: o.id,
        reason: o.reason ?? (mode === "order" ? "" : analysis),
      };
      if (mode !== "span") {
        if (o.occurrence) fail(at, "仅选段支持「第几处」");
        return { ...base, label: o.label };
      }
      const offsets: number[] = [];
      let from = 0;
      while (from < passage.text.length) {
        const start = passage.text.indexOf(o.label, from);
        if (start < 0) break;
        offsets.push(start);
        from = start + 1;
      }
      if (offsets.length > 1 && !o.occurrence)
        fail(at, "原文多处出现「" + o.label + "」，请标明第几处");
      const start = offsets[(o.occurrence ?? 1) - 1];
      if (start === undefined) fail(at, "选段位置不存在：" + o.label);
      const spanId = "s." + o.id;
      spans.push({
        id: spanId,
        passageId,
        text: o.label,
        start,
        end: start + o.label.length,
      });
      return { ...base, spanId };
    }),
  };
}
