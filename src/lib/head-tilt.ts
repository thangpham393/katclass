export type TiltSide = "left" | "right";
export const TILT_SELECT_ANGLE = 14;

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

  reset() {
    this.armed = false;
  }

  update(angle: number | null, answered: boolean): {
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
      this.armed = true;
      return { side: null, progress: 0, ready: this.armed };
    }
    const side = angle >= TILT_SELECT_ANGLE ? "left" : angle <= -TILT_SELECT_ANGLE ? "right" : null;
    if (!this.armed || side === null) {
      return { side: null, progress: 0, ready: this.armed };
    }
    this.reset();
    return { side, progress: 1, choose: side, ready: false };
  }
}
