import { describe, expect, it } from 'vitest';
import { createReviewTimer } from './reviewTimer';

describe('review timer', () => {
  it('visible timer accumulates time', () => {
    let now = 1000;
    const timer = createReviewTimer(() => now);
    timer.start();
    now = 3000;
    expect(timer.stop()).toBe(2000);
  });

  it('hidden pauses and visible resumes', () => {
    let now = 1000;
    const timer = createReviewTimer(() => now);
    timer.start();
    now = 2000;
    timer.pause();
    now = 5000;
    timer.resume();
    now = 6000;
    expect(timer.stop()).toBe(2000);
  });
});
