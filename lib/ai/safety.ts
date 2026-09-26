const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const SIGNED_URL_PATTERN = /https:\/\/[^\s"'<>]+(?:[?&](?:token|signature|sig|x-amz-signature|x-goog-signature|expires)=[^\s"'<>]*)/gi;
const STORAGE_PATH_PATTERN = /(?:^|[\s"'])\/?(?:storage\/v1\/object|teacher-materials|evidence-files)\/[^\s"'<>]+/gim;

export function redactForAi(value: string, sensitiveValues: readonly string[] = []): string {
  let redacted = value
    .replace(SIGNED_URL_PATTERN, "[REDACTED_URL]")
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]")
    .replace(UUID_PATTERN, "[REDACTED_ID]")
    .replace(STORAGE_PATH_PATTERN, " [REDACTED_STORAGE_PATH]");

  for (const sensitiveValue of sensitiveValues) {
    const candidate = sensitiveValue.trim();
    if (candidate.length < 2) continue;
    redacted = redacted.replaceAll(candidate, "[REDACTED_NAME]");
  }

  return redacted;
}

export function pseudonymousLearnerId(studentId: string, salt: string): string {
  let hash = 2166136261;
  for (const character of `${salt}:${studentId}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `learner-${(hash >>> 0).toString(36)}`;
}

export function delimitUntrustedContent(content: string): string {
  return `<student_work>\n${content.replaceAll("</student_work>", "&lt;/student_work&gt;")}\n</student_work>`;
}
