import type { Course, Question, ReviewCard } from "../../src/content/schema";
import type { Reading } from "../../src/content/compileReadings";

export interface Entry {
  number: string;
  group: string;
  head: string;
  forms: string[];
}
export interface Alignment {
  number: string;
  skillId: string;
  sense: string;
}
export interface Return {
  skillId: string;
  passageId: string;
  evidence: string;
  questionId?: string;
  secondary?: boolean;
}

export type Context = {
  id: string;
  text: string;
  glosses: string[];
  slot: number | null;
  level: string;
  location: string;
};

export function contexts(course: Course, readings: Reading[]): Context[] {
  const passages = new Map(course.passages.map((p) => [p.id, p]));
  const questions = new Map(course.questions.map((q) => [q.id, q]));
  const exampleIds = new Map(course.lessons.map((l) => [l.id, l.exampleIds]));
  const rounds = new Map(
    [...course.lessons, ...course.assessments].map((r) => [r.id, r]),
  );
  const result = new Map<string, Context>();
  let slot = 0;
  for (const unit of course.units) {
    for (const id of [...unit.lessonIds, unit.assessmentId]) {
      const round = rounds.get(id)!;
      const examples = exampleIds.get(id) ?? [];
      const ids = [
        ...examples,
        ...round.questionIds.map((q) => questions.get(q)!.passageId),
      ];
      for (const pid of ids) {
        const p = passages.get(pid)!;
        if (!result.has(pid)) {
          result.set(pid, {
            id: pid,
            text: p.text,
            glosses: p.glosses.map((g) => g.term),
            slot,
            level: unit.level,
            location: id,
          });
        }
      }
      slot++;
    }
  }
  return [
    ...result.values(),
    ...readings.map((r) => ({
      id: "reading/" + r.id,
      text: r.passage,
      glosses: r.glosses.map((g) => g.term),
      slot: null,
      level: "自读",
      location: r.id,
    })),
  ];
}

type CardEvidence = {
  questions: Pick<Question, "id" | "passageId" | "skillId">[];
  cards: Pick<ReviewCard, "skillId" | "questionIds">[];
};

function sameExcerpt(left: string, right: string) {
  const clean = (s: string) => s.replace(/[\p{P}\p{Z}\s]/gu, "");
  const a = clean(left);
  const b = clean(right);
  return a.includes(b) || b.includes(a);
}

export function coverage(
  course: CardEvidence,
  corpus: Context[],
  entries: Entry[],
  alignments: Alignment[],
  returns: Return[],
) {
  const byNumber = new Map(entries.map((e) => [e.number, e]));
  const byContext = new Map(corpus.map((c) => [c.id, c]));
  const question = new Map(course.questions.map((q) => [q.id, q]));
  const cards = new Map(course.cards.map((c) => [c.skillId, c]));
  const bySkill = new Map<string, Alignment>();
  const evidence = new Map<string, Context[]>();
  for (const a of alignments) {
    const entry = byNumber.get(a.number);
    const card = cards.get(a.skillId);
    if (!entry || !card || bySkill.has(a.skillId) || !a.sense)
      throw new Error("义项对照与课程不符：" + JSON.stringify(a));
    const samples = card.questionIds.map((qid) =>
      byContext.get(question.get(qid)!.passageId)!,
    );
    const eligible = [
      ...new Map(
        samples
          .filter((c) => entry.forms.some((word) => c.text.includes(word)))
          .map((c) => [c.id, c]),
      ).values(),
    ];
    const firstSlot = Math.min(...eligible.map((c) => c.slot!));
    const introductory = eligible.filter((c) => c.slot === firstSlot);
    if (
      !introductory.some((a) =>
        introductory.some((b) => !sameExcerpt(a.text, b.text)),
      )
    ) {
      throw new Error(a.skillId + " 缺少两段原文含目标词的复习题");
    }
    bySkill.set(a.skillId, a);
    evidence.set(a.skillId, introductory);
  }
  const returnIds = new Set<string>();
  for (const r of returns) {
    const a = bySkill.get(r.skillId);
    const c = byContext.get(r.passageId);
    const checkedQuestion = r.questionId
      ? question.get(r.questionId)
      : undefined;
    if (
      !a ||
      !c ||
      returnIds.has(r.skillId + "/" + r.passageId) ||
      !r.evidence ||
      !c.text.includes(r.evidence) ||
      (r.questionId !== undefined &&
        (!checkedQuestion ||
          checkedQuestion.passageId !== r.passageId ||
          (checkedQuestion.skillId !== r.skillId) !== Boolean(r.secondary))) ||
      (r.secondary && !r.questionId) ||
      !byNumber.get(a.number)!.forms.some((w) => r.evidence.includes(w))
    ) {
      throw new Error("复现引文或引用失效：" + JSON.stringify(r));
    }
    const samples = evidence.get(r.skillId)!;
    const first = samples[0];
    if (
      (c.slot !== null && c.slot <= first.slot!) ||
      samples.some(
        (s) => s.location === c.location || sameExcerpt(s.text, c.text),
      )
    ) {
      throw new Error(r.skillId + " 复现须另取后课或自读的一段新文：" + c.id);
    }
    returnIds.add(r.skillId + "/" + r.passageId);
  }
  return entries.map((entry) => {
    const senses = alignments
      .filter((a) => a.number === entry.number)
      .map((a) => ({ ...a, examples: evidence.get(a.skillId)! }));
    const readings = corpus.filter((c) =>
      entry.forms.some((w) => c.text.includes(w)),
    );
    const glossed = readings.filter((c) =>
      entry.forms.some((w) => c.glosses.includes(w)),
    );
    const verified = returns.filter((r) =>
      senses.some((s) => s.skillId === r.skillId),
    );
    const laterLevel = verified.some((r) => {
      const c = byContext.get(r.passageId)!;
      const firstSenseLevel = evidence.get(r.skillId)![0].level;
      return c.slot !== null && c.level !== firstSenseLevel;
    });
    return {
      entry,
      senses,
      verified,
      laterLevel,
      glossed,
      readings,
      status: senses.length
        ? "有义项专卡"
        : glossed.length
          ? "有同形词注"
          : readings.length
            ? "仅正文同形"
            : "未见字形",
    };
  });
}
