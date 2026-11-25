import { compileReadings } from "../src/content/compileReadings";
import { validateUnseenTexts } from "../src/content/validate";
import { resolve } from "node:path";
import { readCourse, readSources } from "../src/content/node";
import { checkUnit } from "./check-unit";
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
  const report = checkUnit(readSources(root), folder);
  console.log(
    `${folder} · ${report.title}：${report.lessons} 节课、1 次检查、${report.questions} 道练习、${report.notes} 条随文词注通过校验。`,
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
