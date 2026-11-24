import { byId, course } from "../content";
import type { Passage } from "../content/schema";

export function roundTitle(
  kind: "lesson" | "assessment" | "mistake" | "review",
  targetId: string,
) {
  if (kind === "lesson") return byId(course.lessons, targetId).title;
  if (kind === "assessment") {
    const unit = course.units.find((unit) => unit.assessmentId === targetId);
    return unit ? unit.title + " · 单元检查" : "单元检查";
  }
  const skillId =
    kind === "mistake"
      ? byId(course.questions, targetId).skillId
      : byId(course.cards, targetId).skillId;
  const skill = byId(course.skills, skillId);
  return (kind === "mistake" ? "错题订正" : "知识卡复习") + " · " + skill.word;
}

export function passageLabel(passage: Passage) {
  if (passage.kind === "teaching") return "教学例句";
  const source = passage.source!;
  return `${source.attribution}《${source.work}》 · ${source.edition}`;
}

export function studyLink(round: { kind: string; targetId: string }) {
  return round.kind === "lesson" || round.kind === "assessment"
    ? "/learn/" + round.targetId
    : "/practice";
}
