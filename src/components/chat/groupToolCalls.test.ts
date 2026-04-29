import { describe, it, expect } from 'vitest';
import { groupToolCalls } from './groupToolCalls';
import type { ToolCallRecord } from '../../types';

describe('groupToolCalls', () => {
  const mk = (name: string, status: ToolCallRecord['status']): ToolCallRecord => ({
    id: `${name}-${status}`,
    name,
    status,
  });

  it('returns empty array for empty input', () => {
    expect(groupToolCalls([])).toEqual([]);
  });

  it('passes through unique calls without count suffix', () => {
    const calls = [mk('tool/a', 'done'), mk('tool/b', 'done')];
    expect(groupToolCalls(calls)).toEqual([
      { name: 'tool/a', status: 'done', count: 1 },
      { name: 'tool/b', status: 'done', count: 1 },
    ]);
  });

  it('groups consecutive duplicate calls with count', () => {
    const calls = [
      mk('tool/a', 'done'),
      mk('tool/a', 'done'),
      mk('tool/a', 'done'),
    ];
    expect(groupToolCalls(calls)).toEqual([{ name: 'tool/a', status: 'done', count: 3 }]);
  });

  it('preserves order across distinct call names', () => {
    const calls = [mk('tool/b', 'calling'), mk('tool/a', 'done')];
    const result = groupToolCalls(calls);
    expect(result.map((r) => r.name)).toEqual(['tool/b', 'tool/a']);
  });
});
