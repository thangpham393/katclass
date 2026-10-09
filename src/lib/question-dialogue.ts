export interface DialogueTurn { speaker: string; text: string }

/** Works with source PDFs that flatten A: … B: … onto one line. */
export function parseDialogue(text: string) {
  const pattern = /(?:^|[\s。！？?!；;])([A-ZＡ-Ｚ]|[\p{Script=Han}]{1,8})\s*[:：]/gu;
  const matches = [...text.matchAll(pattern)];
  if (matches.length < 2 || new Set(matches.map(m => m[1])).size < 2) return null;
  return {
    instruction: text.slice(0, matches[0].index).trim(),
    turns: matches.map((match, i): DialogueTurn => ({
      speaker: match[1].normalize("NFKC"),
      text: text.slice(match.index! + match[0].length, matches[i + 1]?.index ?? text.length).trim(),
    })),
  };
}
