import { cleanup, render, screen, within } from "@testing-library/vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { course } from "../../src/content";
import { progress } from "../../src/storage/progress";
import { emptyProgress } from "../../src/storage/model";
import Home from "../../src/features/Home.vue";
import Path from "../../src/features/Path.vue";
import Result from "../../src/features/Result.vue";
import type { Round } from "../../src/domain/progression";

vi.mock("../../src/storage/progress", async () => {
  const { shallowRef } = await import("vue");
  const { emptyProgress } = await import("../../src/storage/model");
  const progress = shallowRef(emptyProgress());
  return {
    progress,
    dueCards: () => [],
    streak: () => 0,
  };
});

async function show(page: typeof Home | typeof Path | typeof Result) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:rest(.*)*", component: page }],
  });
  await router.push(
    page === Path ? "/path" : page === Home ? "/today" : "/result",
  );
  render(page, { global: { plugins: [router] } });
}

beforeEach(() => {
  progress.value = emptyProgress();
});
afterEach(cleanup);

it("今日学习推荐一项练习，本单元其余课与检查可直接进入", async () => {
  await show(Home);
  const track = screen.getByRole("list", { name: "古今词义学习顺序" });
  expect(within(track).getAllByRole("listitem")).toHaveLength(4);
  const active = track.querySelector('[aria-current="step"]') as HTMLElement;
  expect(
    within(active)
      .getByRole("link", { name: /开始学习/ })
      .getAttribute("href"),
  ).toBe("/learn/l1.1");
  expect(within(track).getAllByRole("link")).toHaveLength(4);
  expect(
    screen.getByRole("link", { name: "完整路径" }).getAttribute("href"),
  ).toBe("/path");
});

it("课程路径默认从 L1 开始，推荐入口可直接作答，五个路标均可定位", async () => {
  await show(Path);
  const levels = within(
    screen.getByRole("navigation", { name: "跳到学习等级" }),
  );
  const ids = ["L1", "L2", "L3", "L4", "L5"];
  expect(levels.getAllByRole("link")).toHaveLength(ids.length);
  for (const id of ids) {
    const link = levels.getByRole("link", { name: new RegExp("^" + id) });
    expect(link.getAttribute("href")).toBe("/path?level=" + id);
  }
  const first = course.lessons[0];
  expect(
    screen
      .getByRole("link", { name: "开始学习 · " + first.title })
      .getAttribute("href"),
  ).toBe("/learn/" + first.id);
});

it("五级同页列出，未完成首课也能访问最后一课和每项检查", async () => {
  const first = course.lessons[0];
  const last = course.lessons.at(-1)!;
  const round: Round = {
    id: "resume-first",
    kind: "lesson",
    targetId: first.id,
    index: 1,
    questionIds: first.questionIds,
    selected: [],
    hinted: false,
    feedback: null,
    attempts: {},
    xp: 0,
  };
  progress.value = {
    ...emptyProgress(),
    paused: [round],
    active: {
      ...round,
      id: "reading-last",
      targetId: last.id,
      questionIds: last.questionIds,
    },
  };
  await show(Path);
  const sections = screen.getAllByRole("region", { name: /^L[1-5]/ });
  expect(sections.map((section) => section.id)).toEqual(
    course.levels.map((level) => "level-" + level.id),
  );
  for (const [i, level] of course.levels.entries()) {
    const ids = course.units
      .filter((unit) => unit.level === level.id)
      .flatMap((unit) => [...unit.lessonIds, unit.assessmentId]);
    const links = within(sections[i]).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      ids.map((id) => "/learn/" + id),
    );
    if (ids.includes(first.id))
      expect(links[0].textContent).toContain("继续学习");
  }
  expect(
    screen
      .getByRole("link", { name: "继续学习 · " + last.title })
      .getAttribute("href"),
  ).toBe("/learn/" + last.id);
  cleanup();
  progress.value = { ...progress.value, active: null };
  await show(Home);
  expect(
    screen.getByRole("link", { name: /继续学习/ }).getAttribute("href"),
  ).toBe("/learn/" + first.id);
});

it("复习中途回今日学习能接着本轮学习，课程全部完成后推荐复习", async () => {
  const allIds = course.units.flatMap((unit) => [
    ...unit.lessonIds,
    unit.assessmentId,
  ]);
  const card = course.cards[0];
  progress.value = {
    ...emptyProgress(),
    completedIds: allIds,
    active: {
      id: "round",
      kind: "review",
      targetId: card.id,
      index: 0,
      questionIds: [card.questionIds[0]],
      selected: [],
      attempts: {},
      feedback: null,
      hinted: false,
      xp: 0,
    },
  };
  await show(Home);
  expect(
    screen.getByRole("link", { name: "继续练习" }).getAttribute("href"),
  ).toBe("/practice");
  progress.value = { ...progress.value, active: null };
  expect(
    (await screen.findByRole("link", { name: "前往复习" })).getAttribute(
      "href",
    ),
  ).toBe("/review");
});

it("完成首课后仍能再练，并推荐第二课", async () => {
  progress.value = { ...emptyProgress(), completedIds: ["l1.1"] };
  await show(Home);
  const track = screen.getByRole("list", { name: "古今词义学习顺序" });
  const completed = within(track).getByRole("link", { name: /已完成 · 再练/ });
  expect(completed.getAttribute("href")).toBe("/learn/l1.1");
  const next = within(track).getByRole("link", { name: /开始学习/ });
  expect(next.getAttribute("href")).toBe("/learn/l1.2");
  expect(next.closest("li")?.getAttribute("aria-current")).toBe("step");
});

it("直接完成最后一课时，结算展示参与记录并建议未做的课，回看讲解不另开练习", async () => {
  const last = course.lessons.at(-1)!;
  progress.value = {
    ...emptyProgress(),
    completedIds: [last.id],
    lastResult: {
      roundId: "round-last",
      targetId: last.id,
      kind: "lesson",
      total: last.questionIds.length,
      xp: 20,
    },
  };
  await show(Result);
  expect(screen.getByRole("heading", { name: "本课已完成" })).toBeTruthy();
  expect(screen.getByText("已练习").nextElementSibling?.textContent).toMatch(
    /8\s*题/,
  );
  expect(screen.getByText("本轮经验").nextElementSibling?.textContent).toMatch(
    /\+20\s*XP/,
  );
  expect(
    screen.getByRole("link", { name: /推荐练习/ }).getAttribute("href"),
  ).toBe("/learn/" + course.lessons[0].id);
  screen.getByText("回看讲解").click();
  expect(progress.value.active).toBeNull();
});
