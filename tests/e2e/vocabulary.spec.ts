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

test("从课程路径按知识领域找课，常用句法名称能找到实际练习", async ({ page }) => {
  await page.goto("./#/path");
  await page.getByText("按知识领域找课", { exact: true }).click();
  const areas = page.getByRole("navigation", { name: "按知识领域找课" });
  const areaNames = ["实词", "虚词", "句法", "篇章", "阅读技能", "文化背景"];
  expect((await areas.getByRole("link").allTextContents()).sort()).toEqual(
    [...areaNames].sort(),
  );
  await areas.getByRole("link", { name: "句法", exact: true }).click();

  const filter = page.getByRole("combobox", { name: "知识领域" });
  await expect(filter).toHaveValue("句法");
  await page.reload();
  await expect(filter).toHaveValue("句法");

  const search = page.getByRole("searchbox", { name: "搜索知识点" });
  const examples = [
    ["定语后置", "syn38.s.class", "syn38.1"],
    ["谓语前置", "syn38.s.subject", "syn38.3"],
    ["主谓倒装", "syn38.s.subject", "syn38.3"],
    ["状语后置", "g39.skill.site", "g39.2"],
  ];
  for (const [term, skillId, lessonId] of examples) {
    const skill = byId(course.skills, skillId);
    const lesson = byId(course.lessons, lessonId);
    const unit = course.units.find((owner) => owner.lessonIds.includes(lesson.id))!;
    await search.fill(term);
    const entry = page.locator("details.entry").filter({
      has: page.getByRole("heading", { name: skill.word + " · " + skill.meaning }),
    });
    const summary = entry.locator("summary");
    await expect(summary).toBeVisible();
    if (!(await entry.evaluate((node) => (node as HTMLDetailsElement).open))) {
      await summary.click();
    }
    const sources = entry.getByRole("list", { name: "所属课文" });
    await expect(sources).toContainText(unit.level + " · " + unit.title);
    await expect(sources.getByRole("link", { name: lesson.title })).toHaveAttribute(
      "href", new RegExp("#/learn/" + lessonId.replaceAll(".", "\\.") + "$"),
    );
  }

  await expect(page.locator("main")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("knowledge-area.png") });

  await filter.selectOption("实词");
  await expect(page.getByRole("status")).toHaveText("共 0 个知识点");
  await page.getByRole("button", { name: "清除筛选" }).click();
  await expect(filter).toHaveValue("");
  await expect(search).toHaveValue("");
  await filter.selectOption("文化背景");
  const culture = course.skills.filter((skill) => skill.area === "文化背景");
  expect(culture.length).toBeGreaterThan(0);
  await expect(page.getByRole("status")).toHaveText("共 " + culture.length + " 个知识点");
  const item = page.locator("details.entry").first();
  await item.locator("summary").click();
  const link = item.getByRole("list", { name: "所属课文" }).getByRole("link").first();
  const path = (await link.getAttribute("href"))!;
  await link.click();
  await expect(page).toHaveURL((url) => url.hash === path.slice(path.indexOf("#")));
});
