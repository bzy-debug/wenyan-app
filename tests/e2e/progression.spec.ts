import { expect, test } from "@playwright/test";
import {
  course,
  byId,
  incorrectAnswer,
  reviewQuestion,
  submit,
} from "./course";

test("自由选择等级与课程，完成整条路径的练习、求助和独立检查", async ({
  page,
}) => {
  test.setTimeout(900_000);
  await page.goto("./#/path");
  const levels = page.getByRole("navigation", { name: "跳到学习等级" });
  await expect(levels.getByRole("link")).toHaveCount(course.levels.length);
  const ids = course.units.flatMap((unit) => [
    ...unit.lessonIds,
    unit.assessmentId,
  ]);
  let submitted = 0;
  for (const targetId of ids) {
    const lesson = course.lessons.find((l) => l.id === targetId);
    const check = course.assessments.find((a) => a.id === targetId);
    const target = lesson ?? check!;
    const unit = course.units.find(
      (u) => u.assessmentId === targetId || u.lessonIds.includes(targetId),
    )!;
    await page
      .locator("#level-" + unit.level)
      .locator('a[href$="#/learn/' + targetId + '"]')
      .click();
    for (const [index, id] of target.questionIds.entries()) {
      const question = byId(course.questions, id);
      if (targetId === course.lessons[0].id) {
        await page.getByRole("button", { name: "不知道", exact: true }).click();
        await expect(
          page.getByRole("heading", { name: "看看这题怎么读" }),
        ).toBeVisible();
      } else if (targetId === course.assessments[0].id) {
        await expect(
          page.getByRole("button", { name: "不知道", exact: true }),
        ).toHaveCount(0);
        await submit(page, question, incorrectAnswer(question));
        await expect(
          page.getByRole("heading", { name: "再看看原句" }),
        ).toBeVisible();
      } else {
        await submit(page, question);
        await expect(
          page.getByRole("heading", { name: "答对了" }),
        ).toBeVisible();
      }
      await page
        .getByRole("button", {
          name: index === target.questionIds.length - 1 ? "完成练习" : "下一题",
        })
        .click();
      submitted++;
    }
    await expect(
      page.getByRole("heading", {
        name: lesson ? "这节课学完了" : "单元自测做完了",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("+" + (lesson ? 20 : 30) + " XP", { exact: true }),
    ).toBeVisible();
    if (targetId === course.lessons[0].id) {
      await expect(page.getByText(/首答正确|通过率|及格线/)).toHaveCount(0);
      await page.goto("./#/review");
      await expect(page.getByText("没有待订正的错题。")).toBeVisible();
      await page
        .getByRole("navigation")
        .getByRole("link", { name: "课程路径" })
        .click();
    } else {
      await page.getByRole("link", { name: "查看课程路径" }).click();
    }
  }
  expect(submitted).toBe(course.questions.length);
  await page.reload();
  await expect(page.locator(".overview")).toContainText(
    course.lessons.length + " / " + course.lessons.length,
  );
  await expect(page.locator(".overview")).toContainText(
    course.assessments.length + " / " + course.assessments.length,
  );
  await page.getByRole("link", { name: "今日学习" }).click();
  await expect(
    page.getByText(
      course.lessons.length * 20 + course.assessments.length * 30 + " XP",
      { exact: true },
    ),
  ).toBeVisible();
});

test("从空记录直接进末单元检查，切换课程后仍可继续原题", async ({ page }) => {
  const check = course.assessments.at(-1)!;
  const question = byId(course.questions, check.questionIds[0]);
  await page.goto("./#/learn/" + check.id);
  await submit(page, question);
  await page.getByRole("button", { name: "下一题" }).click();
  const resumed = byId(course.questions, check.questionIds[1]);
  await expect(
    page.getByRole("heading", { name: resumed.prompt, exact: true }),
  ).toBeVisible();

  const lesson = course.lessons[6];
  await page.goto("./#/learn/" + lesson.id);
  const first = byId(course.questions, lesson.questionIds[0]);
  await expect(
    page.getByRole("heading", { name: first.prompt, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "不知道", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "看看这题怎么读" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "看看这题怎么读" }),
  ).toBeVisible();
  await page.goto("./#/learn/" + check.id);
  await expect(
    page.getByRole("heading", { name: resumed.prompt, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "不知道", exact: true }),
  ).toHaveCount(0);
});

test("跨日复习切换语境、错题独立订正、刷新保留间隔", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-03-01T12:00:00"));
  const first = byId(course.questions, course.lessons[0].questionIds[0]);
  await page.goto("./#/learn/" + course.lessons[0].id);
  await submit(page, first, incorrectAnswer(first));
  await expect(page.getByRole("heading", { name: "再看看原句" })).toBeVisible();

  await page.getByRole("link", { name: "退出练习，进度已保存" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "复习" })
    .click();
  await page.getByRole("button", { name: "订正", exact: true }).click();
  await submit(page, first);
  await page.getByRole("button", { name: "完成练习" }).click();
  await page.getByRole("link", { name: "返回复习" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "复习", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("没有待订正的错题。")).toBeVisible();
  await expect(page.locator("time")).toHaveAttribute("datetime", "2026-03-02");

  await page.clock.setFixedTime(new Date("2026-03-02T12:00:00"));
  await page.reload();
  await page.getByRole("button", { name: /^复习：/ }).click();
  const review = await reviewQuestion(page, first);
  await submit(page, review);
  await expect(page.getByRole("heading", { name: "答对了" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "答对了" })).toBeVisible();
  await page.getByRole("button", { name: "完成练习" }).click();
  await expect(page.getByText("+5 XP", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "返回复习" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "复习", exact: true }),
  ).toBeVisible();
  await expect(page.locator("time")).toHaveAttribute("datetime", "2026-03-05");
  await expect(page.getByRole("button", { name: /^复习：/ })).toHaveCount(0);

  await page.clock.setFixedTime(new Date("2026-03-05T12:00:00"));
  await page.reload();
  await page.getByRole("button", { name: /^复习：/ }).click();
  const next = await reviewQuestion(page, review);
  await submit(page, next, incorrectAnswer(next));
  await expect(page.getByRole("heading", { name: "再看看原句" })).toBeVisible();
  await page.getByRole("button", { name: "完成练习" }).click();
  await expect(page.getByText("+5 XP", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "返回复习" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "复习", exact: true }),
  ).toBeVisible();
  await expect(page.locator("time")).toHaveAttribute("datetime", "2026-03-06");

  // A correction on the due date is also evidence for the card schedule.
  await page.clock.setFixedTime(new Date("2026-03-06T12:00:00"));
  await page.reload();
  await page.getByRole("button", { name: "订正", exact: true }).click();
  await submit(page, next);
  await page.getByRole("button", { name: "完成练习" }).click();
  await expect(page.getByRole("heading", { name: "订正完了" })).toBeVisible();
  await expect(page.getByText("+5 XP", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "返回复习" }).click();
  await expect(
    page.getByRole("heading", { name: "复习", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("没有待订正的错题。")).toBeVisible();
  await expect(page.locator("time")).toHaveAttribute("datetime", "2026-03-09");
});

test("数字键作答，回车提交与继续，键盘聚焦的其他操作保持可用", async ({
  page,
}) => {
  await page.goto("./#/learn/" + course.lessons[0].id);
  const first = byId(course.questions, course.lessons[0].questionIds[0]);
  await expect(page.getByRole("heading", { name: first.prompt })).toBeFocused();
  for (const id of first.answer) {
    const correct = first.options.findIndex((o) => o.id === id);
    await page.keyboard.press(String(correct + 1));
  }
  const submitButton = page.getByRole("button", { name: "提交答案" });
  await expect(submitButton).toBeEnabled();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "答对了" })).toBeFocused();
  await page.keyboard.press("Enter");
  const second = byId(course.questions, course.lessons[0].questionIds[1]);
  await expect(
    page.getByRole("heading", { name: second.prompt }),
  ).toBeFocused();
  const guide = page.getByRole("button", { name: "本课讲解" });
  await guide.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "回到练习" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "回到练习" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: second.prompt }),
  ).toBeVisible();
});
