import { expect, test, type Page } from "@playwright/test";
import { readCourse, readSources } from "../../src/content/node";
import { compileReadings } from "../../src/content/compileReadings";

const course = readCourse();

async function startFirstLesson(page: Page, level: string) {
  const lessonId = course.units.find((unit) => unit.level === level)!
    .lessonIds[0];
  const lesson = course.lessons.find((item) => item.id === lessonId)!;
  const question = course.questions.find(
    (item) => item.id === lesson.questionIds[0],
  )!;
  await page
    .locator("#level-" + level)
    .locator('a[href$="#/learn/' + lessonId + '"]')
    .click();
  await expect(
    page.getByRole("heading", { name: question.prompt, exact: true }),
  ).toBeVisible();
  return question;
}

test("首页的等级路标只定位，后退能回到原等级，也能直接学高阶课程", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page).toHaveURL(/#\/path$/);
  const directory = page.getByRole("navigation", { name: "跳到学习等级" });
  await expect(directory.getByRole("link")).toHaveCount(5);
  const groups = page.locator("section[id^=level-]");
  await expect(groups).toHaveCount(5);
  expect(
    await groups.evaluateAll((sections) => sections.map((s) => s.id)),
  ).toEqual(["level-L1", "level-L2", "level-L3", "level-L4", "level-L5"]);
  for (const id of ["L2", "L5"]) {
    await directory.getByRole("link", { name: new RegExp("^" + id) }).click();
    await expect(page).toHaveURL(new RegExp("level=" + id + "$"));
    await expect(page.locator("#title-" + id)).toBeInViewport();
    await expect(groups.locator(".lesson-row")).toHaveCount(
      course.lessons.length,
    );
    await expect(groups.locator(".assessment-row")).toHaveCount(
      course.assessments.length,
    );
  }
  await page.goBack();
  await expect(page).toHaveURL(/level=L2$/);
  await expect(page.locator("#title-L2")).toBeInViewport();
  await startFirstLesson(page, "L2");
});

test("无效等级的深链仍能查看完整路线，从首课开始", async ({ page }) => {
  await page.goto("./#/path?level=unknown");
  const first = course.lessons[0];
  const question = course.questions.find((q) => q.id === first.questionIds[0])!;
  await expect(page.locator("section[id^=level-]")).toHaveCount(5);
  await page.getByRole("link", { name: "开始学习 · " + first.title }).click();
  await expect(
    page.getByRole("heading", { name: question.prompt, exact: true }),
  ).toBeVisible();
});

test("L5 深链定位后可直接学该级课程，整篇自读可查词、自校", async ({
  page,
}) => {
  await page.goto("./#/path?level=L5");
  await expect(page.locator("#title-L5")).toBeInViewport();
  const question = await startFirstLesson(page, "L5");
  const passage = course.passages.find((p) => p.id === question.passageId)!;
  const source = passage.source;
  const credit = page.locator(".source-caption");
  if (source?.url) {
    await expect(
      credit.getByRole("link", { name: source.work }),
    ).toHaveAttribute("href", source.url);
  } else {
    await expect(credit).toContainText(source?.work ?? "教学例句");
  }
  await page.goBack();
  await expect(page).toHaveURL(/level=L5$/);
  await page.getByRole("link", { name: "整篇自读" }).click();
  const readings = compileReadings(readSources("content/v1/readings"));
  const links = page.locator(".reading-list a");
  await expect(links).toHaveCount(readings.length);
  for (const reading of readings) {
    const entry = page.locator('a[href$="#/read/' + reading.id + '"]');
    await entry.click();
    await expect(
      page.getByRole("heading", { name: reading.title }),
    ).toBeVisible();
    const glosses = page.locator(".lookup");
    await expect(glosses.locator("dd").first()).toBeHidden();
    await glosses.locator("summary").click();
    await expect(glosses.locator("dd").first()).toHaveText(
      reading.glosses[0].meaning,
    );
    const prompt = page.locator(".retell details").first();
    await expect(prompt.locator("blockquote")).toBeHidden();
    await prompt.locator("summary").click();
    await expect(prompt.locator("blockquote")).toHaveText(
      reading.prompts[0].evidence,
    );
    await expect(page.getByRole("link", { name: "核对底本" })).toHaveAttribute(
      "href",
      reading.source,
    );
    await expect(
      page
        .locator("article footer")
        .getByText(reading.edition, { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("link", { name: "自读篇目" }).click();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
