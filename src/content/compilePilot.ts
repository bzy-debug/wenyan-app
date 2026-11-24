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
    extension: z
      .object({
        text,
        segmented: text,
        interpretation: text,
        explanation: text,
      })
      .refine(
        (s) =>
          s.segmented.split("／").every(Boolean) &&
          s.segmented.replaceAll("／", "") === s.text,
        "断句示例须保留原文",
      ),
  })
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
      const prose = fields(part, ["原文", "断句", "参考大意", "说明"]);
      extension = {
        text: prose["原文"],
        segmented: prose["断句"],
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
