export interface ReviewTimer {
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => number;
  getElapsedMs: () => number;
}

export function createReviewTimer(now: () => number = Date.now): ReviewTimer {
  let startedAt: number | null = null;
  let accumulatedMs = 0;

  return {
    start() {
      if (startedAt !== null) return;
      startedAt = now();
      accumulatedMs = 0;
    },
    pause() {
      if (startedAt === null) return;
      accumulatedMs += now() - startedAt;
      startedAt = null;
    },
    resume() {
      if (startedAt !== null) return;
      startedAt = now();
    },
    stop() {
      const elapsed = this.getElapsedMs();
      startedAt = null;
      accumulatedMs = 0;
      return elapsed;
    },
    getElapsedMs() {
      if (startedAt === null) return accumulatedMs;
      return accumulatedMs + Math.max(0, now() - startedAt);
    }
  };
}
