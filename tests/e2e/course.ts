import { expect, type Locator, type Page } from "@playwright/test";
import { readCourse } from "../../src/content/node";
import type { Question } from "../../src/content/schema";

export const course = readCourse();
export function byId<T extends { id: string }>(entries: T[], id: string) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) throw new Error("未找到题库内容 " + id);
  return entry;
}
export function optionText(question: Question, id: string) {
  const option = byId(question.options, id);
  return option.spanId ? byId(course.spans, option.spanId).text : option.label!;
}

export function incorrectAnswer(question: Question) {
  if (question.mode === "order") return [...question.answer].reverse();
  return [
    question.options.find((option) => !question.answer.includes(option.id))!.id,
  ];
}

export const firstLesson = byId(course.lessons, course.units[0].lessonIds[0]);
export const firstQuestion = byId(course.questions, firstLesson.questionIds[0]);

export async function select(
  page: Page | Locator,
  question: Question,
  ids: string[],
) {
  for (const id of ids) {
    await page
      .getByRole("group")
      .getByRole("button", {
        name: optionText(question, id),
        exact: true,
      })
      .click();
  }
}

export async function submit(
  page: Page,
  question: Question,
  answer = question.answer,
) {
  await expect(
    page.getByRole("heading", { name: question.prompt, exact: true }),
  ).toBeVisible();
  await select(page, question, answer);
  await page.getByRole("button", { name: "提交答案" }).click();
}

export async function reviewQuestion(page: Page, prior: Question) {
  const card = course.cards.find((c) => c.skillId === prior.skillId)!;
  const prompt = await page.locator("h1.prompt").innerText();
  const passage = await page.locator(".q-passage").innerText();
  const match = card.questionIds
    .map((id) => byId(course.questions, id))
    .find(
      (q) =>
        q.prompt === prompt &&
        byId(course.passages, q.passageId).text === passage,
    );
  expect(match, "本轮复习应取自同一张卡的其他语境").toBeDefined();
  expect(passage).not.toBe(byId(course.passages, prior.passageId).text);
  return match!;
}
