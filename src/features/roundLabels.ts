import { byId, course } from "../content";

export function roundTitle(
  kind: "lesson" | "assessment" | "mistake" | "review",
  targetId: string,
) {
  if (kind === "lesson") return byId(course.lessons, targetId).title;
  if (kind === "assessment") {
    return byId(course.assessments, targetId).title;
  }
  const skillId =
    kind === "mistake"
      ? byId(course.questions, targetId).skillId
      : byId(course.cards, targetId).skillId;
  const skill = byId(course.skills, skillId);
  return (kind === "mistake" ? "错题订正" : "知识卡复习") + " · " + skill.word;
}

export function studyLink(round: { kind: string; targetId: string }) {
  return round.kind === "lesson" || round.kind === "assessment"
    ? "/learn/" + round.targetId
    : "/practice";
}
