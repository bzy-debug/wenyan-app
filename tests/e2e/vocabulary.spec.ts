import { buffer } from "node:stream/consumers";
import { expect, test } from "@playwright/test";
import { byId, course, submit } from "./course";

test("查到随文词义后能回到原课，作答时不展示词注", async ({ page }, info) => {
  const lesson = course.lessons.find((candidate) => {
    const q = byId(course.questions, candidate.questionIds[0]);
    return byId(course.passages, q.passageId).glosses.length > 0;
  });
  expect(lesson, "至少一篇课文首题配有可查阅的词注").toBeDefined();
  const first = byId(course.questions, lesson!.questionIds[0]);
  const passage = byId(course.passages, first.passageId);
  const note = passage.glosses[0];
  await page.goto("./#/knowledge");
  await page.getByRole("button", { name: "随文词义" }).click();
  await page.getByRole("searchbox", { name: "搜索随文词义" }).fill(note.term);
  const entry = page
    .locator("details.note")
    .filter({ has: page.locator("blockquote", { hasText: passage.text }) })
    .filter({ has: page.locator("summary b", { hasText: note.term }) })
    .first();
  await entry.locator("summary").click();
  await expect(entry.locator("summary")).toContainText(note.meaning);
  await expect(entry.locator("figcaption")).toContainText(
    passage.source?.work ?? "教学例句",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("vocabulary.png") });
  const settings = await page.context().newPage();
  await settings.goto("./#/settings");
  const downloading = settings.waitForEvent("download");
  await settings.getByRole("button", { name: "导出备份" }).click();
  const file = await downloading;
  const data = JSON.parse(
    (await buffer(await file.createReadStream())).toString("utf8"),
  );
  expect(data.progress).toMatchObject({
    cards: {},
    days: [],
    xp: 0,
    active: null,
    completedIds: [],
  });
  await settings.close();
  await entry.getByRole("link", { name: lesson!.title, exact: true }).click();
  await expect(page.getByRole("heading", { name: first.prompt })).toBeVisible();
  const glosses = page.locator('.answer-feedback dl[aria-label="随文词义"]');
  await expect(page.locator('dl[aria-label="随文词义"]')).toHaveCount(0);
  await submit(page, first);
  await expect(glosses).toBeHidden();
  await page.locator(".answer-feedback summary").click();
  await expect(glosses.getByText(note.meaning, { exact: true })).toBeVisible();
});
