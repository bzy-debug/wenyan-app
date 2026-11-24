import { courseSchema } from "./schema";

function requireContent(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function index<T extends { id: string }>(items: T[]) {
  const map = new Map(items.map((item) => [item.id, item]));
  requireContent(map.size === items.length, "实体 ID 重复");
  return (id: string) => {
    const item = map.get(id);
    requireContent(item, "无效引用 " + id);
    return item;
  };
}
export function validateCourse(raw: unknown) {
  const course = courseSchema.parse(raw);
  const getSkill = index(course.skills),
    getPassage = index(course.passages),
    getSpan = index(course.spans);
  const getQuestion = index(course.questions),
    getLesson = index(course.lessons),
    getAssessment = index(course.assessments);
  index(course.cards);
  index(course.units);
  for (const span of course.spans) {
    const source = getPassage(span.passageId).text;
    requireContent(
      span.end <= source.length &&
        source.slice(span.start, span.end) === span.text,
      "选段范围错误 " + span.id,
    );
  }
  for (const q of course.questions) {
    getSkill(q.skillId);
    getPassage(q.passageId);
    const getOption = index(q.options);
    q.answer.forEach(getOption);
    requireContent(
      q.answer.length === (q.mode === "order" ? q.options.length : 1),
      "答案数量错误 " + q.id,
    );
    const labels = q.options.map((option) => {
      if (q.mode !== "order")
        requireContent(option.reason.trim(), "缺少选项解释 " + q.id);
      if (q.mode !== "span") {
        requireContent(option.label && !option.spanId, "选项文字错误 " + q.id);
        return option.label;
      }
      requireContent(option.spanId && !option.label, "缺少选段 " + q.id);
      const span = getSpan(option.spanId);
      requireContent(span.passageId === q.passageId, "选段与原文不符 " + q.id);
      return span.text;
    });
    if (q.mode === "span") {
      const ranges = q.options
        .map((o) => getSpan(o.spanId!))
        .sort((a, b) => a.start - b.start);
      requireContent(
        ranges.every((s, i) => !i || s.start >= ranges[i - 1].end),
        "备选选段不能重叠 " + q.id,
      );
    }
    requireContent(new Set(labels).size === labels.length, "重复选项 " + q.id);
  }
  for (const card of course.cards) {
    getSkill(card.skillId);
    const linked = card.questionIds.map(getQuestion);
    requireContent(
      linked.every((q) => q.skillId === card.skillId) &&
        new Set(linked.map((q) => q.passageId)).size >= 2,
      "知识卡需关联同一义项的多种语境 " + card.id,
    );
  }
  for (const lesson of course.lessons) {
    lesson.exampleIds.forEach(getPassage);
    lesson.mainSkills.forEach(getSkill);
    const items = lesson.questionIds.map(getQuestion);
    if (lesson.stage === "planned") continue;
    requireContent(
      lesson.intro &&
        lesson.mainSkills.length &&
        lesson.exampleIds.length === lesson.mainSkills.length &&
        items.length === 8,
      "关卡内容不完整 " + lesson.id,
    );
    for (const id of lesson.mainSkills) {
      requireContent(
        items.some((q) => q.skillId === id) &&
          course.cards.some((c) => c.skillId === id),
        "知识点未覆盖 " + id,
      );
    }
  }
  for (const a of course.assessments) {
    a.questionIds.forEach(getQuestion);
    requireContent(
      a.stage === "planned" || a.questionIds.length === 6,
      "检查题数错误 " + a.id,
    );
  }
  const l1 = course.units.filter((u) => u.level === "L1");
  requireContent(
    l1.length === 4 && l1.every((u) => u.lessonIds.length === 3),
    "L1 应含四单元，每单元三课",
  );
  const lessons = course.units.flatMap((u) => u.lessonIds);
  lessons.forEach(getLesson);
  course.units.forEach((u) => getAssessment(u.assessmentId));
  requireContent(
    new Set(lessons).size === lessons.length &&
      lessons.length === course.lessons.length,
    "课程必须恰好归属一个单元",
  );
  const checks = new Set(course.units.map((u) => u.assessmentId));
  requireContent(
    checks.size === course.units.length &&
      checks.size === course.assessments.length,
    "单元检查归属错误",
  );
  return course;
}
