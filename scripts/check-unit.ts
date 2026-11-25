// Select the unit and the authors of any knowledge points its lessons revisit.
// Unrelated chapters can still be edited or incomplete during this check.
import { dirname } from "node:path";
import { compileCourse, courseSectionTypes } from "../src/content/compile";
import {
  blocks,
  documentHeader,
  fields,
  required,
} from "../src/content/markdown";
import { passagesOf } from "../src/content/passage-uses";

export function checkUnit(sources: Record<string, string>, folder: string) {
  const entries = Object.entries(sources);
  const selected = new Set<string>();
  const files: Record<string, string> = {};
  const units = new Map<string, string>();
  function include(dir: string) {
    if (selected.has(dir)) return;
    selected.add(dir);
    const unitFile = dir + "/unit.md";
    const [unit] = blocks(unitFile, sources[unitFile] ?? "", []);
    if (unit.kind !== "单元") throw new Error(unitFile + "：需要单元文档");
    const meta = fields(unit, ["等级", "简介", "课序", "检查"]);
    units.set(unit.id, required(unit, meta, "等级"));
    for (const [name, source] of entries.filter(
      ([name]) => dirname(name) === dir,
    )) {
      files[name] = source;
      const [doc] = blocks(name, source, courseSectionTypes);
      if (doc.kind !== "课文") continue;
      const lesson = fields(doc, ["简介", "进度", "状态", "审核人", "回读"]);
      for (const line of lesson.回读?.split("\n") ?? []) {
        const [skill] = line.trim().split(/\s+/);
        const definition = entries.find(
          ([file, text]) =>
            text.includes("{#" + skill + "}") &&
            blocks(file, text, courseSectionTypes).some(
              (b) => b.kind === "知识点" && b.id === skill,
            ),
        );
        if (definition) include(dirname(definition[0]));
      }
    }
  }
  include(folder);
  const [manifest] = blocks(
    "course.md",
    sources["course.md"],
    courseSectionTypes,
  );
  const route = fields(manifest, ["简介", "单元", "完整性"]).单元.split(/\s+/);
  const ids = [
    ...new Set([...route.filter((id) => units.has(id)), ...units.keys()]),
  ];
  const levels = [...new Set(units.values())];
  files["course.md"] = [
    "# 课程：单元校验 {#validation}",
    "简介：单元及其先修课稿。",
    "单元：" + ids.join(" "),
    "完整性：" +
      levels
        .map((level) => {
          const count = [...units.values()].filter(
            (value) => value === level,
          ).length;
          return [level, count, 3, 8, 6, count * 30].join(" ");
        })
        .join("\n  "),
    ...levels.flatMap((id) => [
      "## 等级：" + id + " {#" + id + "}",
      "目标：检查课稿。",
    ]),
  ].join("\n");
  const course = compileCourse(files);
  const requestedId = documentHeader(files[folder + "/unit.md"]).id;
  const unit = course.units.find((u) => u.id === requestedId)!;
  const targets = [
    ...course.lessons.filter((lesson) => unit.lessonIds.includes(lesson.id)),
    course.assessments.find((check) => check.id === unit.assessmentId)!,
  ];
  const passages = new Set(
    targets.flatMap((target) => passagesOf(course, target)),
  );
  return {
    title: unit.title,
    lessons: unit.lessonIds.length,
    questions: targets.flatMap((t) => t.questionIds).length,
    notes: [...passages].flatMap((p) => p.glosses).length,
  };
}
