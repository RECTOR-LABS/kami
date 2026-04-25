import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  toNumber,
  computeHealthFactor,
  formatSol,
  safeStringify,
  verbFor,
  type BuildAction,
} from './kamino';

describe('toNumber', () => {
  it('returns the underlying number for finite Decimals', () => {
    expect(toNumber(new Decimal('1.25'))).toBe(1.25);
    expect(toNumber(new Decimal(0))).toBe(0);
    expect(toNumber(new Decimal('-3.14'))).toBe(-3.14);
  });

  it('returns 0 for non-finite Decimals (Infinity, NaN)', () => {
    expect(toNumber(new Decimal(1).div(0))).toBe(0);
    expect(toNumber(new Decimal(0).div(0))).toBe(0);
  });
});

describe('computeHealthFactor', () => {
  it('returns null when loanToValue is zero or negative', () => {
    expect(computeHealthFactor(new Decimal(0), new Decimal('0.85'))).toBeNull();
    expect(computeHealthFactor(new Decimal('-0.1'), new Decimal('0.85'))).toBeNull();
  });

  it('returns liquidationLtv / loanToValue for healthy positions', () => {
    expect(computeHealthFactor(new Decimal('0.25'), new Decimal('0.85'))).toBeCloseTo(3.4, 5);
    expect(computeHealthFactor(new Decimal('0.5'), new Decimal('0.85'))).toBeCloseTo(1.7, 5);
  });

  it('returns 1.0 at the liquidation boundary', () => {
    expect(computeHealthFactor(new Decimal('0.85'), new Decimal('0.85'))).toBeCloseTo(1.0, 5);
  });

  it('returns < 1.0 when loanToValue exceeds liquidationLtv', () => {
    const r = computeHealthFactor(new Decimal('0.9'), new Decimal('0.85'));
    expect(r).not.toBeNull();
    expect(r!).toBeLessThan(1.0);
  });
});

describe('formatSol', () => {
  it('formats whole SOL values without decimals', () => {
    expect(formatSol(1_000_000_000)).toBe('1');
    expect(formatSol(2_000_000_000)).toBe('2');
  });

  it('formats fractional SOL up to 6 decimal places', () => {
    expect(formatSol(500_000_000)).toBe('0.5');
    expect(formatSol(1_234_000)).toBe('0.001234');
    expect(formatSol(1_234_567)).toBe('0.001235'); // .toFixed(6) rounds half-up
  });

  it('trims trailing zeros from the decimal portion', () => {
    expect(formatSol(1_500_000_000)).toBe('1.5');
    expect(formatSol(100_000_000)).toBe('0.1');
  });

  it('accepts bigint inputs', () => {
    expect(formatSol(1_000_000_000n)).toBe('1');
    expect(formatSol(22_000_000n)).toBe('0.022');
  });

  it('returns "0" for zero lamports', () => {
    expect(formatSol(0)).toBe('0');
    expect(formatSol(0n)).toBe('0');
  });
});

describe('safeStringify', () => {
  it('serializes plain objects + arrays', () => {
    expect(safeStringify({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}');
    expect(safeStringify([1, 2, 3])).toBe('[1,2,3]');
  });

  it('serializes BigInt values as their decimal string', () => {
    expect(safeStringify({ amount: 12345n })).toBe('{"amount":"12345"}');
    expect(safeStringify(9_999_999_999_999n)).toBe('"9999999999999"');
  });

  it('falls back to String() on circular references', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const result = safeStringify(circular);
    expect(result).toMatch(/object Object/);
  });

  it('serializes primitive values directly', () => {
    expect(safeStringify('hello')).toBe('"hello"');
    expect(safeStringify(42)).toBe('42');
    expect(safeStringify(null)).toBe('null');
  });
});

describe('verbFor', () => {
  it('capitalizes each BuildAction', () => {
    const cases: Array<[BuildAction, string]> = [
      ['deposit', 'Deposit'],
      ['borrow', 'Borrow'],
      ['withdraw', 'Withdraw'],
      ['repay', 'Repay'],
    ];
    for (const [action, expected] of cases) {
      expect(verbFor(action)).toBe(expected);
    }
  });
});
