import type { ToolCallRecord } from '../../types';

interface GroupedCall {
  name: string;
  status: ToolCallRecord['status'];
  count: number;
}

export function groupToolCalls(calls: ToolCallRecord[]): GroupedCall[] {
  if (calls.length === 0) return [];
  const result: GroupedCall[] = [];
  for (const call of calls) {
    // result.at(-1) requires ES2022 lib; src/* targets ES2020
    const last = result[result.length - 1];
    if (last && last.name === call.name && last.status === call.status) {
      last.count += 1;
    } else {
      result.push({ name: call.name, status: call.status, count: 1 });
    }
  }
  return result;
}
