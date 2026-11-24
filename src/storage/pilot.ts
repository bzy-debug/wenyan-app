import Dexie, { type Table } from "dexie";
import { pilot, scoreReading, type PilotForm } from "../content/pilot";

export interface PilotRecord {
  formId: string;
  version: number;
  consentVersion: 1;
  completedAt: string;
  answers: ReturnType<typeof scoreReading>;
  feedback: string;
  segments: number[];
  interpretation: string;
}

// Keep optional pilot responses independently erasable from course progress.
class PilotDatabase extends Dexie {
  submissions!: Table<PilotRecord, string>;
  constructor() {
    super("wenyan-reading-pilot");
    this.version(1).stores({ submissions: "&formId" });
  }
}
const db = new PilotDatabase();
export function readPilotRecords() {
  return db.submissions.toArray();
}
export function clearPilotRecords() {
  return db.submissions.clear();
}
export async function savePilot(
  form: PilotForm,
  choices: Record<string, number>,
  feedback: string,
  segments: number[],
  interpretation: string,
) {
  const record: PilotRecord = {
    formId: form.id,
    version: pilot.version,
    consentVersion: 1,
    completedAt: new Date().toISOString(),
    segments: [...segments].sort((a, b) => a - b),
    interpretation: interpretation.trim().slice(0, 1000),
    answers: scoreReading(form, choices),
    feedback: feedback.trim().slice(0, 1000),
  };
  await db.submissions.add(record);
  return record;
}
