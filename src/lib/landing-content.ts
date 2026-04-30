// Hardcoded data for the bento landing. Centralized so future
// updates (test count drifts, new sponsors) touch one place.

export interface LandingStat {
  key: string;
  value: string;
  highlight: boolean;
}

export const LANDING_STATS: ReadonlyArray<LandingStat> = [
  { key: 'sys.tools_loaded', value: '7 active', highlight: true },
  { key: 'ci.tests_passing', value: '270 suite', highlight: false },
  { key: 'net.roundtrips', value: '3 mainnet', highlight: false },
  { key: 'sys.genesis', value: '2026-04-19', highlight: false },
];

export interface LatestTx {
  signature: string;
  shortSignature: string;
  solscanUrl: string;
  action: string;
}

const TX_SIG = '5XKeETjGfmj9jEWUNCKcf8u49bY4hEzX2a7JcB4nPxQCBbmZ7ipoNrgTXQMJWXHvKw7Bsera9xxYygLVxLUpUvZE';

export const LATEST_TX: LatestTx = {
  signature: TX_SIG,
  shortSignature: `${TX_SIG.slice(0, 10)}…${TX_SIG.slice(-5)}`,
  solscanUrl: `https://solscan.io/tx/${TX_SIG}`,
  action: '5 USDC supplied to Kamino',
};

export const SPONSORS: ReadonlyArray<string> = [
  'Eitherway',
  'Kamino',
  'Solflare',
  'Helius',
  'Vercel',
];

export type ToolIconKey =
  | 'findYield'
  | 'getPortfolio'
  | 'simulateHealth'
  | 'buildSign';

export interface ToolCellData {
  name: string;
  description: string;
  hint: string;
  iconKey: ToolIconKey;
}

export const TOOL_CELLS: ReadonlyArray<ToolCellData> = [
  {
    name: 'tool/findYield',
    description: 'Scans Kamino reserves for highest supply / borrow APY.',
    hint: '→ KaminoMarket.reserves',
    iconKey: 'findYield',
  },
  {
    name: 'tool/getPortfolio',
    description: "Fetches connected wallet's positions, debt, health factor.",
    hint: '→ KaminoMarket.getObligationByAddress',
    iconKey: 'getPortfolio',
  },
  {
    name: 'tool/simulateHealth',
    description: 'Projects post-action health factor before signing.',
    hint: '→ Obligation.simulateBorrowAndWithdrawAction',
    iconKey: 'simulateHealth',
  },
  {
    name: 'tool/buildSign',
    description: 'Builds + signs deposit / borrow / withdraw / repay v0 transactions.',
    hint: '→ KaminoAction.build*Txns',
    iconKey: 'buildSign',
  },
];

export type PipelineIconKey = 'intent' | 'signature' | 'execution';

export interface PipelineStep {
  index: string;
  label: string;
  iconKey: PipelineIconKey;
}

export const PIPELINE_STEPS: ReadonlyArray<PipelineStep> = [
  { index: '1/3', label: 'INTENT', iconKey: 'intent' },
  { index: '2/3', label: 'SIGNATURE', iconKey: 'signature' },
  { index: '3/3', label: 'EXECUTION', iconKey: 'execution' },
];
