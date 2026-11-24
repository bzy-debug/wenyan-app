import { courseSchema, type Course } from "./schema";

function requireContent(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function checkPublication(
  item: { id: string; status: string },
  dependencies: { id: string; status: string }[],
) {
  if (item.status !== "published") return;
  for (const dep of dependencies) {
    requireContent(
      dep.status === "published",
      `已发布内容 ${item.id} 引用未发布实体 ${dep.id}`,
    );
  }
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
    checkPublication(q, [getSkill(q.skillId), getPassage(q.passageId)]);
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
        new Set(linked.map((q) => getPassage(q.passageId).text)).size >= 2,
      "知识卡需关联同一义项的多种语境 " + card.id,
    );
  }
  for (const lesson of course.lessons) {
    const items = lesson.questionIds.map(getQuestion);
    checkPublication(lesson, [
      ...lesson.exampleIds.map(getPassage),
      ...lesson.mainSkills.map(getSkill),
      ...items,
    ]);
    if (lesson.stage === "planned") continue;
    requireContent(
      lesson.intro &&
        lesson.mainSkills.length &&
        lesson.exampleIds.length === lesson.mainSkills.length &&
        items.length > 0,
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
    checkPublication(a, a.questionIds.map(getQuestion));
    requireContent(
      a.stage === "planned" || a.questionIds.length > 0,
      "检查题数错误 " + a.id,
    );
  }
  const getLevel = index(course.levels);
  course.units.forEach((u) => getLevel(u.level));
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
  const owners = [...course.lessons, ...course.assessments].flatMap(
    (target) => target.questionIds,
  );
  requireContent(
    new Set(owners).size === owners.length &&
      owners.length === course.questions.length,
    "每道计分题必须恰好归属一个关卡或单元检查",
  );
  for (const unit of course.units) {
    const check = getAssessment(unit.assessmentId);
    if (check.stage === "planned") continue;
    const lessons = unit.lessonIds.map(getLesson);
    const taught = new Set(lessons.flatMap((lesson) => lesson.mainSkills));
    const tested = new Set(
      check.questionIds.map((id) => getQuestion(id).skillId),
    );
    requireContent(
      [...tested].every((id) => taught.has(id)),
      "检查考查了本单元外的知识点 " + check.id,
    );
    requireContent(
      lessons.every((lesson) => lesson.mainSkills.some((id) => tested.has(id))),
      "单元检查应覆盖每节课 " + check.id,
    );
  }
  return course;
}

/** Publishing policy is declared by the course author in the manifest. */
export function validateCompleteness(course: Course) {
  const policy = course.completeness;
  if (!policy) return;
  const units = course.units.filter((u) => u.level === policy.level);
  requireContent(
    units.length === policy.units &&
      units.every((u) => u.lessonIds.length === policy.lessonsPerUnit),
    "课程规模与完整性声明不符：" + policy.level,
  );
  const lesson = index(course.lessons);
  const assessment = index(course.assessments);
  const targets = units.flatMap((u) => [
    ...u.lessonIds.map(lesson),
    assessment(u.assessmentId),
  ]);
  requireContent(
    units.every(
      (u) =>
        u.lessonIds.every(
          (id) => lesson(id).questionIds.length === policy.lessonSize,
        ) && assessment(u.assessmentId).questionIds.length === policy.checkSize,
    ),
    "关卡题数与完整性声明不符",
  );
  requireContent(
    targets.every((t) => t.stage === "available"),
    "完整课程含有未开放的关卡",
  );
  requireContent(
    targets.flatMap((t) => t.questionIds).length === policy.questions,
    "计分题总数与完整性声明不符：" + policy.questions,
  );
}
