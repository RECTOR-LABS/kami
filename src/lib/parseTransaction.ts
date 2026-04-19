import type { TransactionIntent } from '../types';

export function parseTransactionBlock(content: string): TransactionIntent | null {
  const regex = /```transaction\s*\n([\s\S]*?)\n```/;
  const match = content.match(regex);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]);
    if (parsed.type && parsed.summary && parsed.details) {
      return parsed as TransactionIntent;
    }
    return null;
  } catch {
    return null;
  }
}

export function stripTransactionBlock(content: string): string {
  return content.replace(/```transaction\s*\n[\s\S]*?\n```/g, '').trim();
}
