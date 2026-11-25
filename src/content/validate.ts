import { plainText } from "./passage-text";
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
    const requiredLessons = new Map(
      Object.entries(card.requiredLessonByQuestion ?? {}),
    );
    for (const [qid, lessonId] of requiredLessons) {
      requireContent(
        card.questionIds.includes(qid) &&
          getLesson(lessonId).questionIds.includes(qid),
        "回读题须属于指定知识卡和课文 " + card.id,
      );
    }
    const baseTexts = linked
      .filter((q) => !requiredLessons.has(q.id))
      .map((q) => plainText(getPassage(q.passageId).text));
    requireContent(
      linked.every((q) => q.skillId === card.skillId) &&
        new Set(baseTexts).size >= 2,
      "知识卡需关联同一义项的多种语境，至少两种无需完成回读课 " + card.id,
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
  const usedPassages = new Set([
    ...course.lessons.flatMap((lesson) => lesson.exampleIds),
    ...course.questions.map((q) => q.passageId),
  ]);
  for (const passage of course.passages) {
    const terms = passage.glosses.map((note) => note.term);
    requireContent(
      terms.length === new Set(terms).size &&
        terms.every((term) => passage.text.includes(term)),
      "词注须与本段原文对应且不重复 " + passage.id,
    );
    requireContent(
      usedPassages.has(passage.id),
      "原文未被任何例句或练习引用 " + passage.id,
    );
  }
  for (const unit of course.units) {
    const check = getAssessment(unit.assessmentId);
    if (check.stage === "planned") continue;
    const lessons = unit.lessonIds.map(getLesson);
    const practiceTexts = new Set(
      lessons
        .flatMap((lesson) => [
          ...lesson.exampleIds,
          ...lesson.questionIds.map((id) => getQuestion(id).passageId),
        ])
        .map((id) => plainText(getPassage(id).text)),
    );
    for (const id of check.questionIds) {
      const passage = getPassage(getQuestion(id).passageId);
      requireContent(
        !practiceTexts.has(plainText(passage.text)),
        "单元检查须使用新语境 " + check.id + "：" + passage.id,
      );
    }
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
  if (!course.completeness.length) return;
  const lessons = index(course.lessons);
  const assessments = index(course.assessments);
  const levels = new Set(course.levels.map((l) => l.id));
  const checked = new Set<string>();
  for (const policy of course.completeness) {
    requireContent(
      levels.has(policy.level),
      "完整性声明中的等级不存在：" + policy.level,
    );
    requireContent(
      !checked.has(policy.level),
      "等级完整性声明重复：" + policy.level,
    );
    checked.add(policy.level);
    const units = course.units.filter((u) => u.level === policy.level);
    requireContent(
      units.length === policy.units,
      policy.level + " 单元数量应为 " + policy.units,
    );
    let questionCount = 0;
    for (const unit of units) {
      requireContent(
        unit.lessonIds.length === policy.lessonsPerUnit,
        "每单元课数与声明不符 " + unit.id,
      );
      for (const lesson of unit.lessonIds.map(lessons)) {
        requireContent(
          lesson.stage === "available",
          "完整课程含有未开放的课 " + lesson.id,
        );
        requireContent(
          lesson.questionIds.length === policy.lessonSize,
          "课题数与完整性声明不符 " + lesson.id,
        );
        questionCount += lesson.questionIds.length;
      }
      const check = assessments(unit.assessmentId);
      requireContent(
        check.stage === "available",
        "完整课程含有未开放的检查 " + check.id,
      );
      requireContent(
        check.questionIds.length === policy.checkSize,
        "检查题数与完整性声明不符 " + check.id,
      );
      questionCount += check.questionIds.length;
    }
    requireContent(
      questionCount === policy.questions,
      policy.level +
        " 练习总数应为 " +
        policy.questions +
        "，实际 " +
        questionCount,
    );
  }
  for (const unit of course.units) {
    requireContent(
      checked.has(unit.level),
      "有学习单元的等级缺少完整性声明：" + unit.level,
    );
  }
}

/** Check for a full short text or thirty consecutive shared characters from
 * a passage. Common expressions can recur naturally across independent works. */
export function validateUnseenTexts(
  heldOut: readonly { id: string; text: string }[],
  taught: readonly { id: string; text: string }[],
) {
  const training = taught.map((p) => ({ id: p.id, text: plainText(p.text) }));
  for (const passage of heldOut) {
    const text = plainText(passage.text);
    const chars = Array.from(text);
    const length = Math.min(30, chars.length);
    for (let i = 0; i <= chars.length - length; i++) {
      const excerpt = chars.slice(i, i + length).join("");
      const found = training.find((p) => p.text.includes(excerpt));
      if (found)
        throw new Error(
          `独立阅读材料 ${passage.id} 已出现在 ${found.id}：「${excerpt}」`,
        );
    }
    training.push({ id: passage.id, text });
  }
}
