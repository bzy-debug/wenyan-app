import { z } from "zod";
import { blocks, fields, fail, required, type Block } from "./markdown";
import { validateCompleteness, validateCourse } from "./validate";
import type { Assessment, Course, Lesson, Passage, ReviewCard } from "./schema";
import {
  modes,
  editorialKeys,
  editorial,
  readPassage,
  readQuestion,
} from "./markdown-entities";
export { documentHeader } from "./markdown";

const types = ["等级", "正文", "知识点", "原文", ...Object.keys(modes)];
const split = (text = "") => (text.trim() ? text.trim().split(/\s+/) : []);

function stage(b: Block, f: Record<string, string>): Lesson["stage"] {
  if (!f.进度 || f.进度 === "开放") return "available";
  if (f.进度 === "规划") return "planned";
  fail(b, "进度应为开放或规划");
}
type Document = { head: Block; sections: Block[] };
function sectionFilter(doc: Document, allowed: string[]) {
  for (const b of doc.sections)
    if (!allowed.includes(b.kind))
      fail(b, doc.head.kind + "中不能出现" + b.kind);
}
function declaredIds(
  parent: Block,
  kind: string,
  ids: string[],
  docs: Map<string, Document>,
): Document[] {
  const seen = new Set<string>();
  return ids.map((id) => {
    if (seen.has(id)) fail(parent, "重复引用：" + id);
    seen.add(id);
    const doc = docs.get(id);
    if (!doc || doc.head.kind !== kind)
      fail(parent, "找不到" + kind + "：" + id);
    return doc;
  });
}

function compileTarget(
  target: Document,
  course: Course,
  passages: Map<string, Passage>,
) {
  const b = target.head,
    lesson = b.kind === "课文";
  sectionFilter(
    target,
    lesson
      ? ["正文", "知识点", "原文", ...Object.keys(modes)]
      : ["原文", ...Object.keys(modes)],
  );
  const tf = fields(b, [...(lesson ? ["简介"] : []), "进度", ...editorialKeys]);
  const questions = target.sections
    .filter((s) => Object.hasOwn(modes, s.kind))
    .map((s) => readQuestion(s, passages, course.spans));
  course.questions.push(...questions);
  const common = {
    id: b.id,
    ...editorial(b, tf),
    stage: stage(b, tf),
    questionIds: questions.map((q) => q.id),
  };
  if (!lesson) {
    course.assessments.push({
      ...common,
      title: b.title,
    } satisfies Assessment);
    return;
  }
  const bodies = target.sections.filter((s) => s.kind === "正文");
  if (bodies.length > 1) fail(b, "一课只设一个正文区块");
  const entry: Lesson = {
    ...common,
    title: b.title,
    intro: tf.简介,
    body: bodies[0]?.lines.join("\n").trim() ?? "",
    mainSkills: [],
    exampleIds: [],
  };
  if (entry.stage === "available" && !entry.body)
    fail(b, "可学课文需要 ## 正文");
  for (const s of target.sections.filter((s) => s.kind === "知识点")) {
    const sf = fields(s, [
      "义项",
      "领域",
      "要诀",
      "讲解",
      "例句",
      "复习题",
      ...editorialKeys,
    ]);
    const exampleId = required(s, sf, "例句");
    if (!passages.has(exampleId)) fail(s, "找不到例句：" + exampleId);
    course.skills.push({
      id: s.id,
      word: s.title,
      meaning: required(s, sf, "义项"),
      area: required(s, sf, "领域"),
      short: required(s, sf, "要诀"),
      detail: required(s, sf, "讲解"),
      ...editorial(s, sf),
    });
    entry.mainSkills.push(s.id);
    entry.exampleIds.push(exampleId);
    const cards = sf.复习题
      ? split(sf.复习题)
      : questions.filter((q) => q.skillId === s.id).map((q) => q.id);
    course.cards.push({
      id: "card." + s.id,
      skillId: s.id,
      questionIds: cards,
    } satisfies ReviewCard);
  }
  course.lessons.push(entry);
}

/** Compile a complete set of authoring sources. No filesystem, browser or Vite APIs. */
export function compileCourse(sources: Record<string, string>): Course {
  const docs = new Map<string, Document>();
  const locations = new Map<string, Block>();
  const passages = new Map<string, Passage>();
  for (const [file, text] of Object.entries(sources)) {
    const [head, ...sections] = blocks(file, text, types);
    if (!["课程", "单元", "课文", "检查"].includes(head.kind))
      fail(head, "文档类型应为课程、单元、课文或检查");
    for (const b of [head, ...sections]) {
      if (!b.id) continue;
      const earlier = locations.get(b.id);
      if (earlier)
        fail(b, `重复 ID ${b.id}，首次出现在 ${earlier.file}:${earlier.line}`);
      locations.set(b.id, b);
      if (b.kind === "原文") passages.set(b.id, readPassage(b));
    }
    docs.set(head.id, { head, sections });
  }
  const manifests = [...docs.values()].filter((d) => d.head.kind === "课程");
  if (manifests.length !== 1)
    throw new Error(
      "课程目录应恰有一份「# 课程」文档，当前数量：" + manifests.length,
    );
  const manifest = manifests[0],
    h = manifest.head;
  sectionFilter(manifest, ["等级"]);
  const mf = fields(h, ["简介", "单元", "完整性"]);
  const course: Course = {
    id: h.id,
    title: h.title,
    description: required(h, mf, "简介"),
    version: 1,
    levels: manifest.sections.map((b) => ({
      id: b.id,
      title: b.title,
      goal: required(b, fields(b, ["目标"]), "目标"),
    })),
    completeness: (mf.完整性 ?? "")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const [level, ...sizes] = split(line);
        if (sizes.length !== 5 || sizes.some((t) => !/^[1-9]\d*$/.test(t))) {
          fail(
            h,
            "完整性声明应每个等级一行：等级ID 单元数 每单元课数 每课题数 检查题数 总题数；收到「" +
              line +
              "」",
          );
        }
        const [units, lessonsPerUnit, lessonSize, checkSize, questions] =
          sizes.map(Number);
        return {
          level,
          units,
          lessonsPerUnit,
          lessonSize,
          checkSize,
          questions,
        };
      }),
    units: [],
    lessons: [],
    assessments: [],
    questions: [],
    skills: [],
    spans: [],
    cards: [],
    passages: [...passages.values()],
  };
  const visited = new Set([h.id]);
  const own = (b: Block) => {
    if (visited.has(b.id)) fail(b, "文档被多个父级引用：" + b.id);
    visited.add(b.id);
  };
  for (const unit of declaredIds(
    h,
    "单元",
    split(required(h, mf, "单元")),
    docs,
  )) {
    const u = unit.head;
    own(u);
    sectionFilter(unit, []);
    const f = fields(u, ["等级", "简介", "课序", "检查"]);
    const level = required(u, f, "等级");
    if (!course.levels.some((l) => l.id === level))
      fail(u, "未知等级：" + level);
    const lessonIds = split(required(u, f, "课序")),
      assessmentId = required(u, f, "检查");
    course.units.push({
      id: u.id,
      title: u.title,
      level,
      description: required(u, f, "简介"),
      lessonIds,
      assessmentId,
    });
    const targets = [
      ...declaredIds(u, "课文", lessonIds, docs),
      ...declaredIds(u, "检查", [assessmentId], docs),
    ];
    for (const target of targets) {
      own(target.head);
      compileTarget(target, course, passages);
    }
  }
  for (const doc of docs.values())
    if (!visited.has(doc.head.id)) fail(doc.head, "文档未被课程或单元引用");
  for (const q of course.questions)
    if (!course.skills.some((s) => s.id === q.skillId))
      fail(locations.get(q.id)!, "找不到知识点：" + q.skillId);
  // Structural and educational validation runs on every author preview as well
  // as the published bundle. Translate entity IDs and Zod paths to source files.
  try {
    const result = validateCourse(course);
    validateCompleteness(result);
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      const [group, position] = issue.path;
      const items = course[group as keyof Course];
      const item =
        Array.isArray(items) && typeof position === "number"
          ? items[position]
          : undefined;
      fail(
        item && "id" in item ? (locations.get(item.id) ?? h) : h,
        issue.path.join(".") + "：" + issue.message,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    // Graph errors from validateCourse carry the failing entity in their message.
    const match = message
      .split(/\s+/)
      .map((t) => locations.get(t) ?? locations.get(t.replace(/^card\./, "")))
      .find(Boolean);
    fail(match ?? h, message);
  }
}
