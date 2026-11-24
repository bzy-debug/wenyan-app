import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { createMemoryHistory, createRouter } from "vue-router";
import { course } from "../../src/content";
import { localDay, learnCard, shiftDay } from "../../src/domain/review";
import { emptyProgress } from "../../src/storage/model";
import { backupText } from "../../src/storage/backup";
import { progress, startRound, importBackup } from "../../src/storage/progress";
import Review from "../../src/features/Review.vue";
import Knowledge from "../../src/features/Knowledge.vue";
import Settings from "../../src/features/Settings.vue";

vi.mock("../../src/storage/progress", async () => {
  const { shallowRef } = await import("vue");
  const { emptyProgress } = await import("../../src/storage/model");
  const { validateBackup } = await import("../../src/storage/backup");
  const { course } = await import("../../src/content");
  const { localDay } = await import("../../src/domain/review");
  const progress = shallowRef(emptyProgress());
  return {
    progress,
    dueCards: () =>
      course.cards.filter(
        (card) => progress.value.cards[card.id]?.due <= localDay(),
      ),
    startRound: vi.fn(),
    importBackup: vi.fn(),
    exportBackup: vi.fn(),
    validateBackup,
  };
});

beforeEach(() => {
  progress.value = emptyProgress();
  vi.clearAllMocks();
});
afterEach(cleanup);

async function show(
  component: typeof Review | typeof Knowledge | typeof Settings,
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  });
  await router.push("/");
  render(component, { global: { plugins: [router] } });
  return router;
}

it("只显示已到期知识卡，订正入口按题定位", async () => {
  const [today, later] = course.cards;
  progress.value = {
    ...emptyProgress(),
    cards: {
      [today.id]: learnCard(shiftDay(localDay(), -1), today.questionIds[0]),
      [later.id]: learnCard(localDay(), later.questionIds[0]),
    },
    mistakes: [course.questions[0].id],
  };
  const router = await show(Review);
  expect(screen.getAllByRole("button", { name: /^复习：/ })).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: "订正" }));
  expect(startRound).toHaveBeenCalledWith("mistake", course.questions[0].id);
  expect(router.currentRoute.value.path).toBe("/practice");
});

it("从未完成课程进入订正时直接切换，由存储层暂存课程", async () => {
  const q = course.questions[0],
    lesson = course.lessons[0];
  progress.value = {
    ...emptyProgress(),
    active: {
      id: "round",
      kind: "lesson",
      targetId: lesson.id,
      index: 0,
      questionIds: lesson.questionIds,
      selected: [],
      hinted: false,
      feedback: null,
      attempts: {},
      xp: 0,
    },
    mistakes: [q.id],
  };
  await show(Review);
  await userEvent.click(screen.getByRole("button", { name: "订正" }));
  expect(startRound).toHaveBeenCalledWith("mistake", q.id);
});

it("到期卡提交后切换页面，仍可从暂存入口恢复原语境", async () => {
  const card = course.cards[0],
    q = course.questions.find((q) => q.id === card.questionIds[0])!;
  progress.value = {
    ...emptyProgress(),
    paused: [
      {
        id: "pending-review",
        kind: "review",
        targetId: card.id,
        questionIds: [q.id],
        index: 0,
        selected: q.answer,
        hinted: false,
        feedback: true,
        attempts: { [q.id]: { correct: true, hinted: false } },
        xp: 0,
      },
    ],
  };
  const router = await show(Review);
  await userEvent.click(screen.getByRole("button", { name: "继续上次练习" }));
  expect(startRound).toHaveBeenCalledWith("review", card.id);
  expect(router.currentRoute.value.path).toBe("/practice");
});

it("知识库可按进度及搜索词筛选，展开后可读取释义", async () => {
  const card = course.cards[0],
    skill = course.skills.find((s) => s.id === card.skillId)!;
  progress.value = {
    ...emptyProgress(),
    cards: { [card.id]: learnCard(localDay(), card.questionIds[0]) },
  };
  await show(Knowledge);
  await userEvent.click(screen.getByRole("checkbox", { name: /只看已学/ }));
  expect(screen.getByRole("status").textContent).toContain("1");
  await userEvent.click(screen.getByText(skill.word + " · " + skill.meaning));
  expect((await screen.findByText(skill.detail)).closest("details")?.open).toBe(
    true,
  );
  await userEvent.type(screen.getByRole("searchbox"), "完全无法匹配的词");
  expect(screen.getByText("没有查到，试试换个字或清除筛选。")).toBeTruthy();
});

it("导入备份先校验有效性，通过确认后才覆盖进度", async () => {
  await show(Settings);
  const input = screen.getByLabelText("选择备份文件");
  const select = async (text: string) => {
    const file = new File([text], "backup.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => text });
    await fireEvent.change(input, { target: { files: [file] } });
  };
  await select("{}");
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(importBackup).not.toHaveBeenCalled();
  const backup = backupText(emptyProgress());
  await select(backup);
  expect(await screen.findByText("恢复这个备份？")).toBeTruthy();
  expect(importBackup).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(importBackup).not.toHaveBeenCalled();
  await select(backup);
  await userEvent.click(
    await screen.findByRole("button", { name: "确认恢复" }),
  );
  expect(importBackup).toHaveBeenCalledWith(backup);
  expect(screen.getByRole("status").textContent).toContain("已恢复");
});
