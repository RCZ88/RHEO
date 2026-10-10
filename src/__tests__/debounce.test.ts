/**
 * The extracted debounce/throttle.
 *
 * There were SEVEN byte-identical local copies of this function before, and no
 * throttle anywhere. A util with no callers is worse than no util, so main.ts's
 * preference flush now uses this one — see the mount-chain check.
 */
import { debounce, throttle } from '../lib/debounce';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('debounce — trailing edge', () => {
  it('does not fire synchronously', async () => {
    const calls: string[] = [];
    const d = debounce((x: string) => calls.push(x), 20);
    d('a'); d('b'); d('c');
    expect(calls.length).toBe(0);
    await sleep(60);
    expect(calls.length).toBe(1);
  });
  it('carries the LAST arguments', async () => {
    const calls: string[] = [];
    const d = debounce((x: string) => calls.push(x), 20);
    d('a'); d('b'); d('c');
    await sleep(60);
    expect(calls[0]).toBe('c');
  });
  it('coalesces 50 rapid calls into exactly 1 write', async () => {
    let writes = 0;
    const save = debounce(() => { writes += 1; }, 30);
    for (let i = 0; i < 50; i++) save();
    expect(writes).toBe(0);
    await sleep(70);
    expect(writes).toBe(1);
  });
});

describe('debounce — cancel and flush', () => {
  it('cancel() prevents a late timer firing', async () => {
    const calls: string[] = [];
    const d = debounce((x: string) => calls.push(x), 20);
    d('x');
    expect(d.pending()).toBe(true);
    d.cancel();
    expect(d.pending()).toBe(false);
    await sleep(60);
    expect(calls.length).toBe(0);
  });
  it('flush() delivers the last edit immediately', () => {
    const calls: string[] = [];
    const d = debounce((x: string) => calls.push(x), 5000);
    d('final');
    d.flush();
    expect(calls.length).toBe(1);
    expect(calls[0]).toBe('final');
  });
  it('flush() on an idle timer is a no-op', () => {
    const d = debounce(() => {}, 10);
    d.flush();
    expect(d.pending()).toBe(false);
  });
});

describe('throttle — leading edge', () => {
  it('fires immediately, then delivers the trailing value', async () => {
    const seen: number[] = [];
    const t = throttle((n: number) => seen.push(n), 30);
    t(1); t(2); t(3);
    expect(seen.length).toBe(1);
    expect(seen[0]).toBe(1);
    await sleep(70);
    expect(seen.length).toBe(2);
    expect(seen[1]).toBe(3);
  });
  it('cancel() is safe to call twice', () => {
    const t = throttle(() => {}, 10);
    t();
    t.cancel();
    t.cancel();
    expect(true).toBe(true);
  });
});
