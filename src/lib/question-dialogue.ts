export interface DialogueTurn { speaker: string; text: string }

/** Accept explicit speakers, or source line breaks under a dialogue instruction. */
export function parseDialogue(text: string) {
  const pattern = /(?:^|[\s。！？?!；;])([A-ZＡ-Ｚ]|[\p{Script=Han}]{1,8})\s*[:：]/gu;
  const matches = [...text.matchAll(pattern)];
  if (matches.length >= 2 && new Set(matches.map(m => m[1])).size >= 2) {
    return {
      instruction: text.slice(0, matches[0].index).trim(),
      turns: matches.map((match, i): DialogueTurn => ({
        speaker: match[1].normalize("NFKC"),
        text: text.slice(match.index! + match[0].length, matches[i + 1]?.index ?? text.length).trim(),
      })),
    };
  }

  // Older workbook imports have a dialogue title and one turn per line,
  // without speaker labels. Keep those boundaries instead of splitting sentences:
  // a question and a follow-up question may belong to the same speaker.
  const titled = text.match(/^([^\r\n]*\bhội thoại\b[^\r\n]*[:：.!?])[^\S\r\n]*\r?\n([\s\S]+)$/iu);
  if (!titled || matches.length > 0) return null;
  const lines = titled[2].split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  return {
    instruction: titled[1].trim(),
    turns: lines.map((line, i): DialogueTurn => ({ speaker: i % 2 === 0 ? "A" : "B", text: line })),
  };
}
