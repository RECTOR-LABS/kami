import { describe, it, expect } from 'vitest';
import {
  LANDING_STATS,
  LATEST_TX,
  SPONSORS,
  TOOL_CELLS,
  PIPELINE_STEPS,
} from './landing-content';

describe('landing-content', () => {
  it('LANDING_STATS has 4 entries with key/value/highlight shape', () => {
    expect(LANDING_STATS).toHaveLength(4);
    LANDING_STATS.forEach((s) => {
      expect(typeof s.key).toBe('string');
      expect(typeof s.value).toBe('string');
      expect(typeof s.highlight).toBe('boolean');
    });
    expect(LANDING_STATS[0].key).toBe('sys.tools_loaded');
    expect(LANDING_STATS[0].highlight).toBe(true);
  });

  it('LATEST_TX has the Day-6 mainnet signature + Solscan URL', () => {
    expect(LATEST_TX.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]{86,90}$/);
    expect(LATEST_TX.solscanUrl).toContain(LATEST_TX.signature);
    expect(LATEST_TX.solscanUrl.startsWith('https://solscan.io/tx/')).toBe(true);
    expect(LATEST_TX.action).toBe('5 USDC supplied to Kamino');
  });

  it('SPONSORS includes the 5 bounty-acknowledged sponsors in order', () => {
    expect(SPONSORS).toEqual(['Eitherway', 'Kamino', 'Solflare', 'Helius', 'Vercel']);
  });

  it('TOOL_CELLS has 4 entries with name/description/hint/iconKey shape', () => {
    expect(TOOL_CELLS).toHaveLength(4);
    const names = TOOL_CELLS.map((t) => t.name);
    expect(names).toEqual([
      'tool/findYield',
      'tool/getPortfolio',
      'tool/simulateHealth',
      'tool/buildSign',
    ]);
    TOOL_CELLS.forEach((t) => {
      expect(typeof t.description).toBe('string');
      expect(t.hint.startsWith('→ ')).toBe(true);
      expect(typeof t.iconKey).toBe('string');
    });
  });

  it('PIPELINE_STEPS has 3 entries with index/label/iconKey shape', () => {
    expect(PIPELINE_STEPS).toHaveLength(3);
    const labels = PIPELINE_STEPS.map((p) => p.label);
    expect(labels).toEqual(['INTENT', 'SIGNATURE', 'EXECUTION']);
    PIPELINE_STEPS.forEach((p, i) => {
      expect(p.index).toBe(`${i + 1}/3`);
    });
  });
});
