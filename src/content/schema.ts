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
  area: text,
});
export const glossSchema = z.object({ term: text, meaning: text });
export type WordGloss = z.infer<typeof glossSchema>;
const passage = editorial
  .safeExtend({
    kind: z.enum(["teaching", "source"]),
    text,
    gloss: text,
    glosses: z.array(glossSchema).default([]),
    textRights: text,
    glossRights: text,
    source: z
      .object({
        work: text,
        edition: text,
        attribution: text,
        url: z.url({ protocol: /^https$/ }).optional(),
      })
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
const card = entity.extend({
  skillId: text,
  questionIds: ids,
  requiredLessonByQuestion: z.record(text, text).optional(),
});
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
  body: z.string().default(""),
  mainSkills: ids.default([]),
  // Parallel to mainSkills: two distinct readings can cite the same passage.
  exampleIds: z.array(text).default([]),
  questionIds: ids.default([]),
});
const unit = entity.extend({
  level: text,
  title: text,
  description: text,
  lessonIds: ids,
  assessmentId: text,
});
const assessment = editorial.safeExtend({
  title: text,
  stage: z.enum(["planned", "available"]),
  questionIds: ids,
});
export const courseSchema = z.object({
  version: z.literal(1),
  id: text,
  title: text,
  description: text,
  levels: z.array(entity.extend({ title: text, goal: text })),
  completeness: z
    .array(
      z.object({
        level: text,
        units: z.int().positive(),
        lessonsPerUnit: z.int().positive(),
        lessonSize: z.int().positive(),
        checkSize: z.int().positive(),
        questions: z.int().positive(),
      }),
    )
    .default([]),
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
