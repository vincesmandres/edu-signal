import { safeEvidenceFilename } from "../evidence";

export function createEvidenceStoragePath(classroomId: string, studentId: string, evidenceId: string, filename: string) {
  return `${classroomId}/${studentId}/${evidenceId}/${crypto.randomUUID()}/${safeEvidenceFilename(filename)}`;
}
