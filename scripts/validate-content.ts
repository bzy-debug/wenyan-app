import { compileReadings } from "../src/content/compileReadings";
import { validateUnseenTexts } from "../src/content/validate";
import { resolve } from "node:path";
import { readCourse, readSources } from "../src/content/node";
import { compileCourse } from "../src/content/compile";
import { blocks, fields, required } from "../src/content/markdown";
import { compilePilot, pilotPassages } from "../src/content/compilePilot";

const root = resolve("content/v1/course");
const [flag, folder, ...extra] = process.argv.slice(2);
if (
  flag !== undefined &&
  (flag !== "--unit" || !/^u[0-9]+$/.test(folder ?? "") || extra.length)
) {
  throw new Error(
    "用法：npm run validate:content 或 npm run validate:content -- --unit u05",
  );
}

if (folder) {
  // Authors can validate a unit even while other chapters are being written.
  // Use the production compiler and the same unit size contract as this book.
  const source = readSources(resolve(root, folder));
  const [unit] = blocks(folder + "/unit.md", source["unit.md"] ?? "", []);
  if (unit.kind !== "单元") throw new Error(folder + "/unit.md：需要单元文档");
  const meta = fields(unit, ["等级", "简介", "课序", "检查"]);
  const level = required(unit, meta, "等级");
  const preview = compileCourse({
    ...source,
    "course.md": [
      "# 课程：单元独立校验 {#validation}",
      "简介：" + unit.title,
      "单元：" + unit.id,
      "完整性：" + level + " 1 3 8 6 30",
      "## 等级：" + level + " {#" + level + "}",
      "目标：校验本单元。",
    ].join("\n"),
  });
  const glossary = preview.passages.flatMap((p) => p.glosses);
  console.log(
    `${folder} · ${unit.title}：${preview.lessons.length} 节课、${preview.assessments.length} 次检查、${preview.questions.length} 道练习、${glossary.length} 条随文词注通过校验。`,
  );
} else {
  const course = readCourse(root);
  const pilot = compilePilot(readSources(resolve("content/v1/pilot")));
  const readers = compileReadings(readSources(resolve("content/v1/readings")));
  const glossary = course.passages.flatMap((p) => p.glosses);
  const terms = new Set(glossary.map((entry) => entry.term));
  const independent = readers.map((r) => ({ id: r.id, text: r.passage }));
  validateUnseenTexts(independent, course.passages);
  validateUnseenTexts(pilotPassages(pilot), [
    ...course.passages,
    ...independent,
  ]);
  for (const level of course.levels) {
    const units = course.units.filter((u) => u.level === level.id);
    if (units.length)
      console.log(
        `${level.id} · ${level.title}：${units.length} 个单元，${units.flatMap((u) => u.lessonIds).length} 节课。`,
      );
  }
  console.log(
    `${course.title} · ${course.units.length} 个单元、${course.lessons.length} 节课、${course.assessments.length} 次检查、${course.questions.length} 道练习、${glossary.length} 条随文词注（${terms.size} 个不同字词）、${pilot.forms.length} 篇独立试读、${readers.length} 篇自读文选。Markdown 编译及校验通过。`,
  );
}
