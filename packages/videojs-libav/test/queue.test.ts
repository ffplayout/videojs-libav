import { describe, expect, it } from 'vitest';
import { BoundedQueue } from '../src/queue.js';

describe('BoundedQueue', () => {
  it('never exceeds its configured capacity', async () => {
    const queue = new BoundedQueue<number>(1);
    expect(queue.push(1)).toBe(true);
    expect(queue.push(2)).toBe(false);
    expect(await queue.shift()).toBe(1);
    expect(queue.push(2)).toBe(true);
  });
});
