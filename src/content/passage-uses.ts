import type { Assessment, Course, Lesson } from "./schema";

export function passagesOf(course: Course, target: Lesson | Assessment) {
  const ids = new Set("exampleIds" in target ? target.exampleIds : []);
  const questions = new Set(target.questionIds);
  for (const q of course.questions) {
    if (questions.has(q.id)) ids.add(q.passageId);
  }
  return course.passages.filter((p) => ids.has(p.id));
}

interface PassageOwner {
  id: string;
  title: string;
  kind: "lesson" | "assessment";
}

export function vocabularyEntries(course: Course) {
  const owners = new Map<string, PassageOwner[]>();
  for (const target of [...course.lessons, ...course.assessments]) {
    if (target.stage !== "available") continue;
    for (const p of passagesOf(course, target)) {
      const links = owners.get(p.id) ?? [];
      links.push({
        id: target.id,
        title: target.title,
        kind: "exampleIds" in target ? "lesson" : "assessment",
      });
      owners.set(p.id, links);
    }
  }
  return course.passages.flatMap((passage) => {
    const links = owners.get(passage.id);
    return links
      ? passage.glosses.map((note) => ({ ...note, passage, links }))
      : [];
  });
}
