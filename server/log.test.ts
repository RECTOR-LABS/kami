// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLogger } from './log';

describe('createLogger', () => {
  let log: ReturnType<typeof createLogger>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = createLogger();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('emits a single-line, parseable JSON object with ISO-8601 ts', () => {
    log.info({ wallet: 'abc', requestId: 'r-1' }, 'tool:invoke');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0][0] as string;
    expect(line.includes('\n')).toBe(false);
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({
      level: 'info',
      msg: 'tool:invoke',
      wallet: 'abc',
      requestId: 'r-1',
    });
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('routes info and warn to console.log; error to console.error', () => {
    log.info({}, 'i');
    log.warn({}, 'w');
    log.error({}, 'e');

    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(errSpy).toHaveBeenCalledTimes(1);

    const errLine = errSpy.mock.calls[0][0] as string;
    expect(JSON.parse(errLine).level).toBe('error');
  });

  it('reserved fields (ts, level, msg) cannot be overridden by caller', () => {
    log.info({ ts: 'hijacked', level: 'fake', msg: 'fake-msg' }, 'real-msg');

    const line = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.msg).toBe('real-msg');
    expect(parsed.level).toBe('info');
    expect(parsed.ts).not.toBe('hijacked');
  });

  it('preserves nested object and array fields', () => {
    log.info({ tool: 'getPortfolio', stats: { count: 3, items: ['a', 'b'] } }, 'snapshot');

    const line = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.tool).toBe('getPortfolio');
    expect(parsed.stats).toEqual({ count: 3, items: ['a', 'b'] });
  });
});
