import type { Lesson, Passage, Question } from "../../src/content/schema";
import type { coverage } from "./coverage";

type WordCoverage = ReturnType<typeof coverage>[number];
type ScopeTables = {
  sections: string[][];
  lookup: string[][];
  glosses: string[][];
};

// The lists cite a printed section first. Comments after its number may narrow it
// to an example, extension or construction. “一引申、二” explicitly cites both.
function sectionIds(label: string) {
  return label.split(/、(?=[一二三四五六七八九十])/u).map((part) => {
    const id = /^(全条|[一二三四五六七八九十]+)/u.exec(part)?.[1];
    if (!id) throw new Error("缺少教材一级小项编号：" + label);
    return id;
  });
}

export function studyScope(
  stats: WordCoverage[],
  course: {
    questions: Pick<Question, "id" | "skillId" | "passageId">[];
    passages: Pick<Passage, "id" | "text" | "glosses">[];
    lessons: Pick<Lesson, "id" | "questionIds">[];
  },
  tables: ScopeTables,
  term?: string,
) {
  const entries = new Map(stats.map((r) => [r.entry.number, r.entry]));
  const questions = new Map(course.questions.map((q) => [q.id, q]));
  const passages = new Map(course.passages.map((p) => [p.id, p]));
  const lessons = new Map(course.lessons.map((l) => [l.id, l]));
  const sections = new Map<string, string[]>();
  for (const [number, head, section] of tables.sections) {
    const current = sections.get(number) ?? [];
    if (entries.get(number)?.head !== head || current.includes(section))
      throw new Error("教材分项重复或词头不符：" + number + "/" + section);
    current.push(section);
    sections.set(number, current);
  }
  const seen = new Set<string>();
  for (const [number, , , passageId, text, questionId] of tables.lookup) {
    const key = number + "/" + questionId;
    if (
      !entries.has(number) ||
      seen.has(key) ||
      !passages.get(passageId)?.text.includes(text) ||
      questions.get(questionId)?.passageId !== passageId
    ) {
      throw new Error("查读条目、引文或题号待核：" + key);
    }
    seen.add(key);
  }
  for (const [number, , , pid, word, text] of tables.glosses) {
    const passage = passages.get(pid);
    const key = number + "/" + pid + "/" + text;
    if (
      seen.has(key) ||
      !entries.get(number)?.forms.includes(word) ||
      !text.includes(word) ||
      !passage?.text.includes(text) ||
      !passage.glosses.some((g) => g.term === word)
    ) {
      throw new Error("随文查义须有原句和同词头的词注：" + key);
    }
    seen.add(key);
  }

  const rows = [
    [
      "组",
      "顺序号",
      "词头",
      "教学取舍",
      "教材小项与句中义",
      "讲解课",
      "初学独立题",
      "后来异篇独立题",
      "查读题",
      "证据与边界",
    ],
  ];
  let matched = false;
  for (const r of stats) {
    const e = r.entry;
    const printed = sections.get(e.number);
    if (!printed?.length) throw new Error("缺少教材分项：" + e.number);
    if (term && term !== e.number && !e.forms.includes(term) && term !== e.head)
      continue;
    matched = true;
    const id = [e.group, e.number, e.head];
    const located = new Set<string>();
    const available = new Set(printed);
    function markSections(label: string) {
      for (const ref of sectionIds(label)) {
        if (!available.has(ref))
          throw new Error("条目 " + e.number + " 查无此原书小项：" + label);
        located.add(ref);
      }
    }

    for (const s of r.senses) {
      markSections(s.sense.split(" · ")[0]);
      const { location } = s.examples[0];
      const first =
        lessons.get(location)?.questionIds.filter((q) => {
          const item = questions.get(q)!;
          return (
            item.skillId === s.skillId &&
            s.examples.some((p) => p.id === item.passageId)
          );
        }) ?? [];
      if (!first.length)
        throw new Error("熟读义项缺少所在初学课的独立题：" + s.skillId);
      const later = r.verified.filter(
        (v) => v.skillId === s.skillId && v.questionId,
      );
      rows.push([
        ...id,
        "应熟读",
        s.sense,
        location,
        first.join(" "),
        later
          .map((v) => (v.secondary ? "互证/" : "") + v.questionId)
          .join(" ") || "—",
        "—",
        s.skillId +
          (later.length
            ? "；已有异篇答题证据"
            : "；课内已有独立题，异篇题待核"),
      ]);
    }
    for (const [, part, sense, , text, q, method] of tables.lookup.filter(
      ([n]) => n === e.number,
    )) {
      markSections(part);
      rows.push([
        ...id,
        "查读已考",
        part + " · " + sense,
        "—",
        "—",
        "—",
        q,
        text + "；" + method,
      ]);
    }
    for (const [, part, sense, pid, , text] of tables.glosses.filter(
      ([n]) => n === e.number,
    )) {
      markSections(part);
      rows.push([
        ...id,
        "随文查读",
        part + " · " + sense,
        "—",
        "—",
        "—",
        "—",
        pid + "：" + text,
      ]);
    }
    for (const part of printed) {
      if (located.has(part)) continue;
      const irregular = part.includes("重号") || part.includes("未编号");
      const decision = irregular ? "分项待核" : "遇到再查";
      const note = irregular
        ? "电子本编号有缺重，引用前需再核版本"
        : "本小项尚无专题取证";
      rows.push([
        ...id,
        decision,
        part,
        "—",
        "—",
        "—",
        "—",
        note +
          "；" +
          r.status +
          "（词头统计）" +
          (e.forms.includes(e.head)
            ? ""
            : "；本条按“" + e.forms.join("、") + "”检字，见 forms.tsv 校记"),
      ]);
    }
  }
  if (!matched) throw new Error("未收此词头或编号：" + term);
  return rows;
}
