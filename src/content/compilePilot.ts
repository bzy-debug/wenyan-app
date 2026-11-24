import { z } from "zod";
import { blocks, fields } from "./markdown";

const text = z.string().trim().min(1);
const question = z
  .object({
    id: text,
    target: text,
    prompt: text,
    options: z.array(text).min(2),
    correct: z.number().int().nonnegative(),
    explanation: text,
  })
  .refine(
    (q) =>
      q.correct < q.options.length &&
      new Set(q.options).size === q.options.length,
    "试读选项无效",
  );

// A reading passage may use punctuation throughout. Only the text whose
// boundaries the learner must supply needs a clean, unsegmented input.
const pauseMarks = /[\p{P}\p{Cf}\s|∣]+/u;
const extension = z
  .object({
    text: text.refine(
      (value) => !pauseMarks.test(value),
      "待断句原文不能带标点、分隔符或字间空白",
    ),
    segmented: text,
    alternatives: z.array(text),
    interpretation: text,
    explanation: text,
  })
  .refine((value) => {
    const readings = [value.segmented, ...value.alternatives];
    return (
      new Set(readings).size === readings.length &&
      readings.every((reading) => {
        const pieces = reading.split("／");
        return (
          pieces.length > 1 &&
          pieces.every(Boolean) &&
          pieces.join("") === value.text
        );
      })
    );
  }, "每种断句示例须保留原文、含实际断点且不重复");

function exposesReading(
  passage: string,
  exercise: z.infer<typeof extension>,
): boolean {
  if (!exercise.text) return false;
  const chunks = passage.split(pauseMarks).filter(Boolean);
  let offset = 0;
  const printedPauses = new Set(
    chunks.slice(0, -1).map((chunk) => (offset += chunk.length)),
  );
  const plain = chunks.join("");
  const breaks = [exercise.segmented, ...exercise.alternatives].flatMap(
    (reading) => {
      let end = 0;
      return reading
        .split("／")
        .slice(0, -1)
        .map((clause) => (end += clause.length));
    },
  );
  for (
    let start = plain.indexOf(exercise.text);
    start >= 0;
    start = plain.indexOf(exercise.text, start + 1)
  ) {
    if (breaks.some((end) => printedPauses.has(start + end))) return true;
  }
  return false;
}

const form = z
  .object({
    id: text,
    title: text,
    stage: z.enum(["学习前", "学习后"]),
    version: z.number().int().positive(),
    kind: z.enum(["teaching", "source"]),
    status: z.enum(["draft", "reviewed", "published"]),
    reviewer: text.optional(),
    attribution: text.optional(),
    textRights: text,
    glossRights: text,
    passage: text,
    glossary: text,
    questions: z.array(question).min(1),
    extension,
  })
  .refine(
    (f) => !exposesReading(f.passage, f.extension),
    "正文已标出续读片段的断点，请换用未展示的片段",
  )
  .refine(
    (f) => f.status === "draft" || Boolean(f.reviewer),
    "审核内容须记录审核人",
  )
  .refine(
    (f) => f.kind === "teaching" || Boolean(f.attribution),
    "古籍原文须注明作者、篇名与版本",
  );

export type PilotForm = z.infer<typeof form>;
export interface PilotPacket {
  version: 1;
  forms: PilotForm[];
}

function compileForm(file: string, source: string): PilotForm {
  const [header, ...parts] = blocks(file, source, ["试读", "练习", "续读"]);
  if (!header || header.kind !== "试读")
    throw new Error("文件须以“试读”标题开始");
  const details = fields(header, [
    "阶段",
    "版本",
    "状态",
    "类型",
    "原文权利",
    "译注权利",
    "正文",
    "词注",
    "审核人",
    "出处",
  ]);
  const kinds: Record<string, string> = {
    教学自编: "teaching",
    古籍原文: "source",
  };
  const statuses: Record<string, string> = {
    草稿: "draft",
    已审核: "reviewed",
    已发布: "published",
  };
  const questions = [];
  let extension;
  for (const part of parts) {
    if (part.kind === "续读") {
      if (extension) throw new Error("续读段落重复");
      const prose = fields(part, [
        "原文",
        "断句",
        "其他读法",
        "参考大意",
        "说明",
      ]);
      extension = {
        text: prose["原文"],
        segmented: prose["断句"],
        alternatives:
          prose["其他读法"]?.split("\n").map((line) => line.trim()) ?? [],
        interpretation: prose["参考大意"],
        explanation: prose["说明"],
      };
      continue;
    }
    if (part.kind !== "练习") throw new Error("一个文件只可包含一篇试读");
    const options: string[] = [];
    const correct: number[] = [];
    const lines = part.lines.map((line) => {
      const option = /^- \[([ xX])\]\s+(.+)$/u.exec(line);
      if (!option) return line;
      if (option[1].trim()) correct.push(options.length);
      options.push(option[2].trim());
      return "";
    });
    if (correct.length !== 1) throw new Error(part.id + " 须勾选一个正确选项");
    const prompt = fields({ ...part, lines }, ["考点", "解析"]);
    questions.push({
      id: part.id,
      prompt: part.title,
      target: prompt["考点"],
      explanation: prompt["解析"],
      options,
      correct: correct[0],
    });
  }
  return form.parse({
    id: header.id,
    title: header.title,
    stage: details["阶段"],
    version: Number(details["版本"]),
    kind: kinds[details["类型"]],
    status: statuses[details["状态"]],
    reviewer: details["审核人"],
    attribution: details["出处"],
    textRights: details["原文权利"],
    glossRights: details["译注权利"],
    passage: details["正文"],
    glossary: details["词注"],
    questions,
    extension,
  });
}

export function compilePilot(files: Record<string, string>): PilotPacket {
  const forms = Object.entries(files)
    .map(([file, source]) => {
      try {
        return compileForm(file, source);
      } catch (error) {
        throw new Error(
          file +
            " · " +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    })
    .sort((a, b) => (a.stage === b.stage ? 0 : a.stage === "学习前" ? -1 : 1));
  if (forms.length !== 2 || forms[0].stage === forms[1].stage)
    throw new Error("试读须各有一篇学习前、学习后材料");
  const ids = forms.flatMap((form) => [
    form.id,
    ...form.questions.map((q) => q.id),
  ]);
  if (new Set(ids).size !== ids.length)
    throw new Error("试读材料或题目 ID 重复");
  return { version: 1, forms };
}
