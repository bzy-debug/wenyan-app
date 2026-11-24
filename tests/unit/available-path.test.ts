import { cleanup, render, screen, within } from "@testing-library/vue";
import { afterEach, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { course } from "../../src/content";
import Home from "../../src/features/Home.vue";
import Path from "../../src/features/Path.vue";
import { learningPath } from "../../src/features/learningPath";
import { emptyProgress } from "../../src/storage/model";
import { progress } from "../../src/storage/progress";

vi.mock("../../src/content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/content")>();
  const source = actual.course;
  const lessonId = source.units[2].lessonIds[1];
  const checkId = source.units[1].assessmentId;
  return {
    ...actual,
    course: {
      ...source,
      lessons: source.lessons.map((lesson) => ({
        ...lesson,
        stage: lesson.id === lessonId ? "available" : "planned",
      })),
      assessments: source.assessments.map((check) => ({
        ...check,
        stage: check.id === checkId ? "available" : "planned",
      })),
    },
  };
});

afterEach(() => {
  cleanup();
  progress.value = emptyProgress();
});

it("课程路径只列出能打开的课与自测，隐藏空单元、空等级与未开放的进度", async () => {
  const { lessons, assessments, levels } = learningPath;
  expect(levels.map((level) => level.id)).toEqual([course.units[1].level]);
  expect(learningPath.units.map((unit) => unit.id)).toEqual([
    course.units[1].id,
    course.units[2].id,
  ]);
  progress.value = {
    ...emptyProgress(),
    completedIds: course.lessons.map((lesson) => lesson.id),
  };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:path(.*)", component: Path }],
  });
  await router.push("/path");
  render(Path, { global: { plugins: [router] } });
  const nav = within(screen.getByRole("navigation", { name: "跳到学习等级" }));
  expect(nav.getAllByRole("link")).toHaveLength(1);
  const section = within(screen.getByRole("region", { name: /^L1 / }));
  const lessonLinks = section.getAllByRole("link");
  expect(lessonLinks.map((link) => link.getAttribute("href"))).toEqual([
    "/learn/" + assessments[0].id,
    "/learn/" + lessons[0].id,
  ]);
  expect(section.getByText(/^L1 · 单元 01$/)).toBeDefined();
  expect(section.getByText(/^L1 · 单元 02$/)).toBeDefined();
  expect(section.getByText("第 1 课")).toBeDefined();
  expect(document.querySelector(".overview")?.textContent).toMatch(/1 \/ 1.*课.*0 \/ 1/s);
  expect(
    screen.getByRole("link", { name: "开始自测 · " + assessments[0].title }),
  ).toBeDefined();

  cleanup();
  progress.value = {
    ...progress.value,
    completedIds: [...progress.value.completedIds, assessments[0].id],
  };
  render(Home, { global: { plugins: [router] } });
  expect(screen.getByRole("heading", { name: "这门课学完了" })).toBeDefined();
  expect(screen.getByText("已完成 1 / 1 课")).toBeDefined();
  expect(screen.getByText("100")).toBeDefined();
});
