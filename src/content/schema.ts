import { z } from "zod";

const text = z.string().trim().min(1);
const ids = z
  .array(text)
  .refine((items) => new Set(items).size === items.length, "重复引用");
const entity = z.object({ id: text });
const editorial = entity
  .extend({
    status: z.enum(["draft", "reviewed", "published"]),
    reviewer: text.optional(),
  })
  .refine(
    (item) => item.status === "draft" || Boolean(item.reviewer),
    "审核内容需记录审核人",
  );
const skill = editorial.safeExtend({
  word: text,
  meaning: text,
  short: text,
  detail: text,
  area: z.enum(["实词", "虚词", "句法", "篇章", "阅读技能", "文化背景"]),
});
const passage = editorial
  .safeExtend({
    kind: z.enum(["teaching", "source"]),
    text,
    gloss: text,
    textRights: text,
    glossRights: text,
    source: z
      .object({ work: text, edition: text, attribution: text })
      .optional(),
  })
  .refine(
    (item) => item.kind === "teaching" || Boolean(item.source),
    "古籍原文需有出处",
  );
const span = entity.extend({
  passageId: text,
  start: z.int().nonnegative(),
  end: z.int().positive(),
  text,
});
const card = entity.extend({ skillId: text, questionIds: ids });
const question = editorial.safeExtend({
  mode: z.enum(["choice", "span", "order"]),
  skillId: text,
  passageId: text,
  prompt: text,
  options: z
    .array(
      entity.extend({
        label: text.optional(),
        spanId: text.optional(),
        reason: z.string(),
      }),
    )
    .min(2),
  answer: ids,
  analysis: text,
  hint: text,
});
const lesson = editorial.safeExtend({
  title: text,
  stage: z.enum(["planned", "available"]),
  intro: text.optional(),
  mainSkills: ids.default([]),
  exampleIds: ids.default([]),
  questionIds: ids.default([]),
});
const unit = entity.extend({
  level: z.enum(["L1", "L2", "L3", "L4", "L5"]),
  title: text,
  description: text,
  lessonIds: ids,
  assessmentId: text,
});
const assessment = editorial.safeExtend({
  stage: z.enum(["planned", "available"]),
  questionIds: ids,
});
export const courseSchema = z.object({
  version: z.literal(1),
  skills: z.array(skill),
  passages: z.array(passage),
  spans: z.array(span),
  cards: z.array(card),
  questions: z.array(question),
  lessons: z.array(lesson),
  units: z.array(unit),
  assessments: z.array(assessment),
});
export type Course = z.infer<typeof courseSchema>;
export type Skill = z.infer<typeof skill>;
export type Passage = z.infer<typeof passage>;
export type Span = z.infer<typeof span>;
export type ReviewCard = z.infer<typeof card>;
export type Question = z.infer<typeof question>;
export type Lesson = z.infer<typeof lesson>;
export type Unit = z.infer<typeof unit>;
export type Assessment = z.infer<typeof assessment>;
