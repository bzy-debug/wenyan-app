import type { Question } from "../../content/schema";

export interface InputProps {
  question: Question;
  selected: readonly string[];
  locked: boolean;
}
