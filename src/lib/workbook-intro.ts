import type { QuestionContent, QuestionType } from "./question-schema";

interface WorkbookQuestion {
  type: QuestionType;
  content: QuestionContent;
  lesson_id?: string | null;
  lesson?: { textbook_id: string | null } | null;
}

/** Legacy imports store the worksheet's introduction in question 1's passage.
 * Interpret that field at display time, keeping stored questions and snapshots intact.
 * A real reading passage must remain part of its question.
 */
export function workbookIntro(q: WorkbookQuestion) {
  if (q.type === "reading") return null;
  const text = q.content.passage?.trim();
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  const title = lines[0].normalize("NFC").trim();
  if (!/^NHẮC LẠI KIẾN THỨC(?:\s|$)/iu.test(title) || lines.length < 2) return null;
  const body = lines.slice(1).join("\n").trim();
  if (!body) return null;
  const source = q.content.source;
  const scope = q.lesson_id ?? `${q.lesson?.textbook_id ?? ""}|${source?.sha256 ?? source?.file ?? ""}|${source?.unit ?? ""}`;
  return { key: `${scope}|${text.normalize("NFC")}`, title, body };
}

/** Pure view transformation: retain IDs, question text, choices and answers. */
export function questionWithoutWorkbookIntro<T extends WorkbookQuestion>(q: T): T {
  if (!workbookIntro(q)) return q;
  const content = { ...q.content };
  delete content.passage;
  return { ...q, content };
}

/** Keep original row order and PDF column boundaries, without mobile-sized spacer runs. */
export function workbookIntroRows(body: string): string[][][] {
  return body.split(/\n\s*\n/).map(block => block.split("\n")
    .map(line => line.trim().split(/[ \t]{3,}/).map(cell => cell.trim()).filter(Boolean))
    .filter(row => row.length > 0)).filter(block => block.length > 0);
}
