export type TiltSide = "left" | "right";
export const TILT_SELECT_ANGLE = 16;

/** The preview is mirrored: a positive camera roll points to its left. */
export function eyeRoll(
  left: { x: number; y: number },
  right: { x: number; y: number },
  width: number,
  height: number,
): number {
  return Math.atan2((right.y - left.y) * height, (right.x - left.x) * width) * 180 / Math.PI;
}

export class TiltGesture {
  private armed = false;
  private neutralSince: number | null = null;
  private side: TiltSide | null = null;
  private since = 0;

  reset() {
    this.armed = false;
    this.neutralSince = null;
    this.side = null;
    this.since = 0;
  }

  update(angle: number | null, now: number, answered: boolean): {
    side: TiltSide | null;
    progress: number;
    choose?: TiltSide;
    ready: boolean;
  } {
    if (angle === null || !Number.isFinite(angle) || answered) {
      this.reset();
      return { side: null, progress: 0, ready: false };
    }
    if (Math.abs(angle) <= 7) {
      this.neutralSince ??= now;
      if (now - this.neutralSince >= 350) this.armed = true;
      this.side = null;
      return { side: null, progress: 0, ready: this.armed };
    }
    this.neutralSince = null;
    const side = angle >= TILT_SELECT_ANGLE ? "left" : angle <= -TILT_SELECT_ANGLE ? "right" : null;
    if (!this.armed || side === null) {
      this.side = null;
      return { side: null, progress: 0, ready: this.armed };
    }
    if (side !== this.side) {
      this.side = side;
      this.since = now;
    }
    const progress = Math.min(1, (now - this.since) / 900);
    if (progress === 1) {
      this.reset();
      return { side, progress, choose: side, ready: false };
    }
    return { side, progress, ready: true };
  }
}
