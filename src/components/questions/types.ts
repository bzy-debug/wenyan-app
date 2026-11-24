import type { Course, Question } from "../../content/schema";

export interface InputProps {
  course: Course;
  question: Question;
  selected: readonly string[];
  locked: boolean;
  feedback?: boolean | null;
}
