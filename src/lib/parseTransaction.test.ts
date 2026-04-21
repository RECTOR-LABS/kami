import { describe, it, expect } from 'vitest';
import { parseTransactionBlock, stripTransactionBlock } from './parseTransaction';

describe('parseTransactionBlock', () => {
  it('returns null when no transaction block is present', () => {
    expect(parseTransactionBlock('plain assistant text')).toBeNull();
  });

  it('parses a complete transaction block', () => {
    const content = '```transaction\n{"type":"transfer","summary":"send 1 SOL","details":{"to":"x"}}\n```';
    expect(parseTransactionBlock(content)).toEqual({
      type: 'transfer',
      summary: 'send 1 SOL',
      details: { to: 'x' },
    });
  });

  it('returns null on malformed JSON inside block', () => {
    expect(parseTransactionBlock('```transaction\n{not json}\n```')).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    expect(parseTransactionBlock('```transaction\n{"type":"transfer"}\n```')).toBeNull();
  });

  it('extracts the first block when multiple are present', () => {
    const content =
      '```transaction\n{"type":"transfer","summary":"a","details":{}}\n```\n' +
      '```transaction\n{"type":"swap","summary":"b","details":{}}\n```';
    expect(parseTransactionBlock(content)?.summary).toBe('a');
  });
});

describe('stripTransactionBlock', () => {
  it('removes a single block', () => {
    expect(stripTransactionBlock('Before\n```transaction\n{"a":1}\n```\nAfter')).toBe('Before\n\nAfter');
  });

  it('returns trimmed text when no block exists', () => {
    expect(stripTransactionBlock('  hello  ')).toBe('hello');
  });

  it('removes every block when multiple are present', () => {
    const content = '```transaction\n{}\n```\nmiddle\n```transaction\n{}\n```';
    expect(stripTransactionBlock(content)).toBe('middle');
  });
});
