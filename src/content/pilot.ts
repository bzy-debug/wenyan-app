import { z } from "zod";
import raw from "../../content/v1/pilot.json";

const text = z.string().trim().min(1);
const prompt = z
  .object({
    id: text,
    target: text,
    prompt: text,
    options: z.array(text).min(2),
    correct: z.int().nonnegative(),
    explanation: text,
  })
  .refine(
    (q) =>
      q.correct < q.options.length &&
      new Set(q.options).size === q.options.length,
    "试读选项无效",
  );

const form = z.object({
  id: text,
  title: text,
  kind: z.literal("teaching"),
  status: z.literal("draft"),
  textRights: text,
  glossRights: text,
  passage: text,
  glossary: text,
  questions: z.array(prompt).length(3),
  extension: z
    .object({ text, segmented: text, interpretation: text, explanation: text })
    .refine(
      (s) => s.segmented.split("／").join("") === s.text,
      "断句示例须保留原文",
    ),
});

const packet = z
  .object({ version: z.literal(1), forms: z.array(form).length(2) })
  .refine(
    ({ forms }) => new Set(forms.map((f) => f.id)).size === forms.length,
    "试读文本 ID 重复",
  )
  .refine(({ forms }) => {
    const questions = forms.flatMap((f) => f.questions);
    return new Set(questions.map((q) => q.id)).size === questions.length;
  }, "试读题目 ID 重复");

export const pilot = packet.parse(raw);
export type PilotForm = z.infer<typeof form>;

export function scoreReading(
  form: PilotForm,
  selections: Record<string, number>,
) {
  return form.questions.map((q) => {
    const submitted = selections[q.id];
    if (
      !Number.isInteger(submitted) ||
      submitted < 0 ||
      submitted >= q.options.length
    )
      throw new Error("请完成每道试读题。");
    return {
      questionId: q.id,
      selected: submitted,
      correct: submitted === q.correct,
    };
  });
}
