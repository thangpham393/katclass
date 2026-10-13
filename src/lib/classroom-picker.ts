/** Randomness is chosen once per round; animation never changes the result. */
export function eligibleStudents<T extends { id: string }>(students: T[], called: string[], fair: boolean): T[] {
  if (!fair) return students;
  const rest = students.filter(s => !called.includes(s.id));
  return rest.length ? rest : students;
}

export function pickStudent<T>(students: T[], random = Math.random): T | undefined {
  return students.length ? students[Math.min(students.length - 1, Math.floor(random() * students.length))] : undefined;
}

/** A square crop clamped to the source, without stretching edge faces. */
export function cropRegion(width: number, height: number, x: number, y: number, size: number) {
  const side = Math.max(1, Math.min(size, width, height));
  return { x: Math.max(0, Math.min(width - side, x - side / 2)), y: Math.max(0, Math.min(height - side, y - side / 2)), size: side };
}
