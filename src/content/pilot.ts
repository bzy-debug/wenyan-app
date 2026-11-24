import packet from "virtual:wenyan-pilot";
import type { PilotForm } from "./compilePilot";
export type { PilotForm } from "./compilePilot";
export const pilot = packet;
export function scoreReading(
  form: PilotForm,
  selections: Record<string, number>,
) {
  return form.questions.map((q) => {
    const submitted = selections[q.id];
    if (
      !Number.isInteger(submitted) ||
      submitted < 0 ||
      submitted >= q.options.length
    )
      throw new Error("请答完这篇文章的阅读题。");
    return {
      questionId: q.id,
      selected: submitted,
      correct: submitted === q.correct,
    };
  });
}
