import { test, expect } from "@playwright/test";
import {
  course,
  byId,
  firstLesson,
  firstQuestion as first,
  incorrectAnswer,
  optionText,
  submit,
} from "./course";

const wrong = incorrectAnswer(first);
const mistake =
  first.mode === "order"
    ? "第 1 步是“" + optionText(first, first.answer[0]) + "”"
    : byId(first.options, wrong[0]).reason;
const href = "#/learn/" + firstLesson.id;

test("首页默认显示完整路线，能从今日学习返回并直接开始首课", async ({
  page,
}, info) => {
  await page.goto("./");
  const save = (name: string) =>
    page.screenshot({
      path: info.outputPath(name + ".png"),
      fullPage: name !== "home",
    });
  await expect(page).toHaveURL(/#\/path$/);
  await expect(
    page.getByRole("heading", { name: "课程路径", exact: true }),
  ).toBeVisible();
  const editorialNote = page.getByText("课程试读稿，待审校", { exact: true });
  await expect(editorialNote).toHaveCount(0);
  const start = page.getByRole("link", { name: /^开始学习 · / });
  await expect(start).toHaveAttribute("href", href);
  await page.evaluate(() => document.fonts.ready);
  await save("home");
  await page.getByRole("link", { name: "今日学习", exact: true }).click();
  await expect(page).toHaveURL(/#\/today$/);
  await expect(page.getByRole("heading", { name: "今日学习" })).toBeVisible();
  await expect(editorialNote).toHaveCount(0);
  const current = page.locator('.track [aria-current="step"]');
  await expect(current.getByRole("link", { name: /开始学习/ })).toHaveAttribute(
    "href",
    href,
  );
  await page.getByRole("link", { name: "完整路径" }).click();
  await expect(page.locator("section.unit-track")).toHaveCount(
    course.units.length,
  );
  await expect(page.locator(".lesson-row")).toHaveCount(course.lessons.length);
  await start.click();
  const guide = page.getByRole("button", { name: "本课讲解" });
  await expect(
    page.getByRole("heading", { name: first.prompt, exact: true }),
  ).toBeVisible();
  const passage = byId(course.passages, first.passageId);
  await expect(page.locator(".source-caption")).toContainText(
    passage.source?.work ?? "教学例句",
  );
  await save("lesson");
  await expect(page.getByRole("button", { name: /关键提示/ })).toHaveCount(0);
  await guide.click();
  const example = byId(course.passages, firstLesson.exampleIds[0]);
  await expect(
    page
      .getByRole("dialog")
      .locator(".usage-examples article")
      .first()
      .locator("blockquote"),
  ).toHaveText(example.text);
  await page.getByRole("button", { name: "回到练习" }).click();
  await expect(page.getByRole("button", { name: "提交答案" })).toBeDisabled();
  await submit(page, first, wrong);
  await expect(
    page
      .locator(".answer-feedback")
      .getByText(mistake, { exact: first.mode !== "order" }),
  ).toBeVisible();
  await expect(page.locator(".correct-answer")).toContainText(
    first.answer.map((id) => optionText(first, id)).join(" → "),
  );
  await page.reload();
  await expect(
    page
      .locator(".answer-feedback")
      .getByText(mistake, { exact: first.mode !== "order" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "再试一次" }).click();
  await submit(page, first);
  const details = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "看解析" }) });
  await expect(details).toBeVisible();
  await expect(details).not.toHaveAttribute("open");
  const rationale = details.getByText(first.analysis, { exact: true });
  await expect(rationale).toBeHidden();
  await details.locator("summary").click();
  await expect(rationale).toBeVisible();
  await expect(details.getByText("句意", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "下一题" }).click();
  await page.getByRole("button", { name: "不知道", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "看看这题怎么读" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "下一题" }).click();
  const remaining = firstLesson.questionIds.slice(2);
  for (const [i, id] of remaining.entries()) {
    const question = byId(course.questions, id);
    if (question.mode === "span") {
      const passage = byId(course.passages, question.passageId);
      await expect(page.locator(".q-passage")).toHaveText(passage.text);
      const evidence = page.getByRole("group", { name: "原文证据选项" });
      await expect(evidence.getByRole("button")).toHaveCount(
        question.options.length,
      );
      await save("span");
    }
    await submit(page, question);
    await expect(page.getByRole("heading", { name: "答对了" })).toBeVisible();
    await page
      .getByRole("button", {
        name: i === remaining.length - 1 ? "完成练习" : "下一题",
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "这节课学完了" }),
  ).toBeVisible();
  await expect(page.getByText("+20 XP", { exact: true })).toBeVisible();
  await save("result");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "查看课程路径" }).click();
  await expect(page.locator('#level-L1 a[href$="' + href + '"]')).toContainText(
    "已完成",
  );
});
