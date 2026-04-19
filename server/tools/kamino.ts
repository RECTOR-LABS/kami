import { z } from 'zod';
import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type TransactionSigner,
} from '@solana/kit';
import Decimal from 'decimal.js';
import {
  KaminoAction,
  KaminoMarket,
  VanillaObligation,
  PROGRAM_ID,
  DEFAULT_RECENT_SLOT_DURATION_MS,
  type KaminoObligation,
  type KaminoReserve,
  type ActionType,
} from '@kamino-finance/klend-sdk';
import type { ToolDefinition, ToolResult } from './types.js';
import { getRpc } from '../solana/connection.js';

export const KAMINO_MAIN_MARKET: Address = address('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF');

export const getPortfolioSchema = z.object({});

export interface PortfolioPosition {
  symbol: string;
  mint: string;
  reserve: string;
  amount: number;
  valueUsd: number;
  apyPercent: number;
}

export interface PortfolioSnapshot {
  wallet: string;
  hasObligation: boolean;
  totalDepositedUsd: number;
  totalBorrowedUsd: number;
  netValueUsd: number;
  loanToValue: number;
  liquidationLtv: number;
  healthFactor: number | null;
  deposits: PortfolioPosition[];
  borrows: PortfolioPosition[];
}

const MARKET_CACHE_TTL_MS = 30_000;
let cachedMarket: KaminoMarket | null = null;
let marketLoadedAt = 0;

async function getMarket(): Promise<KaminoMarket> {
  const now = Date.now();
  if (cachedMarket && now - marketLoadedAt < MARKET_CACHE_TTL_MS) {
    return cachedMarket;
  }
  const rpc = getRpc();
  const market = await KaminoMarket.load(rpc, KAMINO_MAIN_MARKET, DEFAULT_RECENT_SLOT_DURATION_MS);
  if (!market) {
    throw new Error(`Failed to load Kamino main market ${KAMINO_MAIN_MARKET}`);
  }
  cachedMarket = market;
  marketLoadedAt = now;
  return market;
}

function toNumber(d: Decimal): number {
  return Number.isFinite(d.toNumber()) ? d.toNumber() : 0;
}

function mapPositions(
  positions: IterableIterator<[Address, { reserveAddress: Address; mintAddress: Address; mintFactor: Decimal; amount: Decimal; marketValueRefreshed: Decimal }]>,
  market: KaminoMarket,
  currentSlot: bigint,
  kind: 'supply' | 'borrow'
): PortfolioPosition[] {
  const out: PortfolioPosition[] = [];
  for (const [, pos] of positions) {
    const reserve: KaminoReserve | undefined = market.getReserveByAddress(pos.reserveAddress);
    const symbol = reserve?.getTokenSymbol() ?? 'UNKNOWN';
    const tokenAmount = pos.amount.div(pos.mintFactor);
    const apy = reserve
      ? kind === 'supply'
        ? reserve.totalSupplyAPY(currentSlot)
        : reserve.totalBorrowAPY(currentSlot)
      : 0;
    out.push({
      symbol,
      mint: pos.mintAddress,
      reserve: pos.reserveAddress,
      amount: toNumber(tokenAmount),
      valueUsd: toNumber(pos.marketValueRefreshed),
      apyPercent: Number.isFinite(apy) ? apy * 100 : 0,
    });
  }
  return out;
}

function computeHealthFactor(loanToValue: Decimal, liquidationLtv: Decimal): number | null {
  if (loanToValue.lte(0)) return null;
  return toNumber(liquidationLtv.div(loanToValue));
}

async function fetchVanillaObligation(
  market: KaminoMarket,
  wallet: Address
): Promise<KaminoObligation | null> {
  const vanillaPda = await new VanillaObligation(PROGRAM_ID).toPda(market.getAddress(), wallet);
  return market.getObligationByAddress(vanillaPda);
}

export const getPortfolio: ToolDefinition<
  z.infer<typeof getPortfolioSchema>,
  ToolResult<PortfolioSnapshot>
> = {
  name: 'getPortfolio',
  description:
    "Fetch the connected wallet's Kamino main-market obligation: deposits, borrows, APYs, LTV, and health factor.",
  schema: getPortfolioSchema,
  handler: async (_input, ctx) => {
    if (!ctx.walletAddress) {
      return {
        ok: false,
        error: 'No wallet connected. Ask the user to connect Phantom or Solflare first.',
      };
    }

    let wallet: Address;
    try {
      wallet = address(ctx.walletAddress);
    } catch {
      return { ok: false, error: `Invalid wallet address: ${ctx.walletAddress}` };
    }

    const market = await getMarket();
    const obligation = await fetchVanillaObligation(market, wallet);

    if (!obligation) {
      return {
        ok: true,
        data: {
          wallet: ctx.walletAddress,
          hasObligation: false,
          totalDepositedUsd: 0,
          totalBorrowedUsd: 0,
          netValueUsd: 0,
          loanToValue: 0,
          liquidationLtv: 0,
          healthFactor: null,
          deposits: [],
          borrows: [],
        },
      };
    }

    const rpc = getRpc();
    const currentSlot = await rpc.getSlot().send();

    const stats = obligation.refreshedStats;
    const deposits = mapPositions(obligation.deposits.entries(), market, currentSlot, 'supply');
    const borrows = mapPositions(obligation.borrows.entries(), market, currentSlot, 'borrow');

    return {
      ok: true,
      data: {
        wallet: ctx.walletAddress,
        hasObligation: true,
        totalDepositedUsd: toNumber(stats.userTotalDeposit),
        totalBorrowedUsd: toNumber(stats.userTotalBorrow),
        netValueUsd: toNumber(stats.netAccountValue),
        loanToValue: toNumber(stats.loanToValue),
        liquidationLtv: toNumber(stats.liquidationLtv),
        healthFactor: computeHealthFactor(stats.loanToValue, stats.liquidationLtv),
        deposits,
        borrows,
      },
    };
  },
};

export const findYieldSchema = z.object({
  symbol: z
    .string()
    .optional()
    .describe("Optional token symbol filter, e.g. 'USDC', 'SOL', 'JitoSOL'. Omit to scan all reserves."),
  side: z
    .enum(['supply', 'borrow'])
    .default('supply')
    .describe("'supply' = lending APY you earn, 'borrow' = interest rate you pay."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .describe('Max number of reserves to return (sorted by APY, descending).'),
});

export interface YieldOpportunity {
  symbol: string;
  mint: string;
  reserve: string;
  side: 'supply' | 'borrow';
  apyPercent: number;
  ltvRatio: number;
  liquidationLtv: number;
  utilizationPercent: number;
  marketPriceUsd: number;
}

function computeUtilizationPercent(reserve: KaminoReserve): number {
  const borrowed = reserve.getBorrowedAmount();
  const available = reserve.getLiquidityAvailableAmount();
  const total = borrowed.plus(available);
  if (total.lte(0)) return 0;
  return toNumber(borrowed.div(total).mul(100));
}

export const findYield: ToolDefinition<
  z.infer<typeof findYieldSchema>,
  ToolResult<YieldOpportunity[]>
> = {
  name: 'findYield',
  description:
    'List top Kamino main-market reserves by live APY. Use when the user asks "where\'s the best yield", "best USDC rate", "cheapest place to borrow X", or any comparison across reserves.',
  schema: findYieldSchema,
  handler: async (input) => {
    const market = await getMarket();
    const rpc = getRpc();
    const currentSlot = await rpc.getSlot().send();

    const symbolFilter = input.symbol?.trim().toUpperCase();
    const side = input.side ?? 'supply';
    const limit = input.limit ?? 5;

    const opportunities: YieldOpportunity[] = [];
    for (const reserve of market.reserves.values()) {
      if (reserve.stats.status !== 'Active') continue;
      const symbol = reserve.getTokenSymbol();
      if (symbolFilter && symbol.toUpperCase() !== symbolFilter) continue;
      const apy =
        side === 'supply' ? reserve.totalSupplyAPY(currentSlot) : reserve.totalBorrowAPY(currentSlot);
      if (!Number.isFinite(apy)) continue;
      opportunities.push({
        symbol,
        mint: reserve.stats.mintAddress,
        reserve: reserve.address,
        side,
        apyPercent: apy * 100,
        ltvRatio: reserve.stats.loanToValue,
        liquidationLtv: reserve.stats.liquidationThreshold,
        utilizationPercent: computeUtilizationPercent(reserve),
        marketPriceUsd: toNumber(reserve.getOracleMarketPrice()),
      });
    }

    opportunities.sort((a, b) => b.apyPercent - a.apyPercent);

    return { ok: true, data: opportunities.slice(0, limit) };
  },
};

export const simulateHealthSchema = z.object({
  action: z
    .enum(['deposit', 'borrow', 'withdraw', 'repay'])
    .describe('Which obligation action to simulate.'),
  symbol: z.string().describe('Reserve symbol, e.g. "USDC", "SOL", "JitoSOL".'),
  amount: z
    .number()
    .positive()
    .describe('Amount in human token units (NOT lamports). e.g. 100 for 100 USDC.'),
});

export interface HealthSimulation {
  action: ActionType;
  symbol: string;
  amount: number;
  current: {
    loanToValue: number;
    liquidationLtv: number;
    healthFactor: number | null;
    netValueUsd: number;
    totalDepositedUsd: number;
    totalBorrowedUsd: number;
  };
  projected: {
    loanToValue: number;
    liquidationLtv: number;
    healthFactor: number | null;
    netValueUsd: number;
    totalDepositedUsd: number;
    totalBorrowedUsd: number;
  };
  warnings: string[];
}

function snapshotStats(stats: {
  loanToValue: Decimal;
  liquidationLtv: Decimal;
  netAccountValue: Decimal;
  userTotalDeposit: Decimal;
  userTotalBorrow: Decimal;
}): HealthSimulation['current'] {
  return {
    loanToValue: toNumber(stats.loanToValue),
    liquidationLtv: toNumber(stats.liquidationLtv),
    healthFactor: computeHealthFactor(stats.loanToValue, stats.liquidationLtv),
    netValueUsd: toNumber(stats.netAccountValue),
    totalDepositedUsd: toNumber(stats.userTotalDeposit),
    totalBorrowedUsd: toNumber(stats.userTotalBorrow),
  };
}

export const simulateHealth: ToolDefinition<
  z.infer<typeof simulateHealthSchema>,
  ToolResult<HealthSimulation>
> = {
  name: 'simulateHealth',
  description:
    "Project the user's Kamino main-market health factor after a hypothetical deposit / borrow / withdraw / repay. Call this before any risk-sensitive action to check if it would trigger liquidation.",
  schema: simulateHealthSchema,
  handler: async (input, ctx) => {
    if (!ctx.walletAddress) {
      return {
        ok: false,
        error: 'No wallet connected. Ask the user to connect Phantom or Solflare first.',
      };
    }

    let wallet: Address;
    try {
      wallet = address(ctx.walletAddress);
    } catch {
      return { ok: false, error: `Invalid wallet address: ${ctx.walletAddress}` };
    }

    const market = await getMarket();
    const obligation = await fetchVanillaObligation(market, wallet);
    if (!obligation) {
      return {
        ok: false,
        error:
          'This wallet has no active Kamino obligation yet. Simulation requires an existing position — the user should make their first deposit via the Kamino app first.',
      };
    }

    const reserve = market.getReserveBySymbol(input.symbol);
    if (!reserve) {
      return { ok: false, error: `Unknown reserve symbol "${input.symbol}" on Kamino main market.` };
    }

    const rpc = getRpc();
    const currentSlot = await rpc.getSlot().send();

    const mintFactor = new Decimal(10).pow(reserve.stats.decimals);
    const amountLamports = new Decimal(input.amount).mul(mintFactor);

    const isCollateralAction = input.action === 'deposit' || input.action === 'withdraw';
    const simParams = {
      action: input.action as ActionType,
      market,
      reserves: market.reserves,
      slot: currentSlot,
      ...(isCollateralAction
        ? { amountCollateral: amountLamports, mintCollateral: reserve.stats.mintAddress }
        : { amountDebt: amountLamports, mintDebt: reserve.stats.mintAddress }),
    };

    const simulated = obligation.getSimulatedObligationStats(simParams);

    const current = snapshotStats(obligation.refreshedStats);
    const projected = snapshotStats(simulated.stats);

    const warnings: string[] = [];
    if (projected.healthFactor !== null && projected.healthFactor < 1.0) {
      warnings.push(
        `Projected health factor ${projected.healthFactor.toFixed(3)} is below 1.0 — this action would trigger liquidation.`
      );
    } else if (projected.healthFactor !== null && projected.healthFactor < 1.1) {
      warnings.push(
        `Projected health factor ${projected.healthFactor.toFixed(3)} is razor-thin — leaves no buffer against price swings.`
      );
    }
    if (projected.loanToValue > current.liquidationLtv) {
      warnings.push(
        `Projected LTV ${(projected.loanToValue * 100).toFixed(2)}% exceeds the current liquidation threshold ${(current.liquidationLtv * 100).toFixed(2)}%.`
      );
    }

    return {
      ok: true,
      data: {
        action: input.action as ActionType,
        symbol: reserve.getTokenSymbol(),
        amount: input.amount,
        current,
        projected,
        warnings,
      },
    };
  },
};

export type BuildAction = 'deposit' | 'borrow' | 'withdraw' | 'repay';

export interface PendingTransaction {
  action: BuildAction;
  protocol: 'Kamino';
  symbol: string;
  amount: number;
  reserveAddress: string;
  mint: string;
  summary: string;
  base64Txn: string;
  blockhash: string;
  lastValidBlockHeight: string;
}

export const buildActionInputSchema = z.object({
  symbol: z
    .string()
    .describe('Reserve token symbol on the Kamino main market, e.g. "USDC", "SOL", "JitoSOL".'),
  amount: z
    .number()
    .positive()
    .describe('Amount in human token units (NOT lamports). e.g. 100 for 100 USDC.'),
});

type BuildActionInput = z.infer<typeof buildActionInputSchema>;

async function compileKaminoAction(
  action: BuildAction,
  mint: Address,
  amountStr: string,
  ownerSigner: TransactionSigner<string>,
  market: KaminoMarket,
  currentSlot: bigint
): Promise<KaminoAction> {
  const obligation = new VanillaObligation(PROGRAM_ID);
  const useV2Ixs = true;
  const extraComputeBudget = 400_000;
  const includeAtaIxs = true;
  const requestElevationGroup = false;

  switch (action) {
    case 'deposit':
      return KaminoAction.buildDepositTxns(
        market,
        amountStr,
        mint,
        ownerSigner,
        obligation,
        useV2Ixs,
        undefined,
        extraComputeBudget,
        includeAtaIxs,
        requestElevationGroup,
        undefined,
        undefined,
        currentSlot
      );
    case 'borrow':
      return KaminoAction.buildBorrowTxns(
        market,
        amountStr,
        mint,
        ownerSigner,
        obligation,
        useV2Ixs,
        undefined,
        extraComputeBudget,
        includeAtaIxs,
        requestElevationGroup,
        undefined,
        undefined,
        currentSlot
      );
    case 'withdraw':
      return KaminoAction.buildWithdrawTxns(
        market,
        amountStr,
        mint,
        ownerSigner,
        obligation,
        useV2Ixs,
        undefined,
        extraComputeBudget,
        includeAtaIxs,
        requestElevationGroup,
        undefined,
        undefined,
        currentSlot
      );
    case 'repay':
      return KaminoAction.buildRepayTxns(
        market,
        amountStr,
        mint,
        ownerSigner,
        obligation,
        useV2Ixs,
        undefined,
        currentSlot,
        undefined,
        extraComputeBudget,
        includeAtaIxs,
        requestElevationGroup,
        undefined,
        undefined
      );
  }
}

function verbFor(action: BuildAction): string {
  return action.charAt(0).toUpperCase() + action.slice(1);
}

async function buildPendingTransaction(
  action: BuildAction,
  input: BuildActionInput,
  walletAddress: string
): Promise<ToolResult<PendingTransaction>> {
  let wallet: Address;
  try {
    wallet = address(walletAddress);
  } catch {
    return { ok: false, error: `Invalid wallet address: ${walletAddress}` };
  }

  const market = await getMarket();
  const reserve = market.getReserveBySymbol(input.symbol);
  if (!reserve) {
    return { ok: false, error: `Unknown reserve symbol "${input.symbol}" on Kamino main market.` };
  }

  const rpc = getRpc();
  const currentSlot = await rpc.getSlot().send();

  const mintFactor = new Decimal(10).pow(reserve.stats.decimals);
  const amountLamports = new Decimal(input.amount).mul(mintFactor).toDecimalPlaces(0, Decimal.ROUND_FLOOR);
  if (amountLamports.lte(0)) {
    return { ok: false, error: `Amount too small: ${input.amount} ${input.symbol} rounds to zero lamports.` };
  }
  const amountStr = amountLamports.toFixed(0);

  const ownerSigner = createNoopSigner(wallet);
  const mint = reserve.stats.mintAddress;

  let kaminoAction: KaminoAction;
  try {
    kaminoAction = await compileKaminoAction(action, mint, amountStr, ownerSigner, market, currentSlot);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Failed to build ${action} transaction: ${message}` };
  }

  const allIxs = [
    ...kaminoAction.computeBudgetIxs,
    ...kaminoAction.setupIxs,
    ...kaminoAction.inBetweenIxs,
    ...kaminoAction.lendingIxs,
    ...kaminoAction.cleanupIxs,
    ...kaminoAction.refreshFarmsCleanupTxnIxs,
  ];

  const { value: latestBlockhash } = await rpc
    .getLatestBlockhash({ commitment: 'confirmed' })
    .send();

  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(ownerSigner, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(allIxs, tx)
  );

  const compiledTx = compileTransaction(txMessage);
  const base64Txn = getBase64EncodedWireTransaction(compiledTx);

  const uiAmount = amountLamports.div(mintFactor).toNumber();
  const symbol = reserve.getTokenSymbol();

  return {
    ok: true,
    data: {
      action,
      protocol: 'Kamino',
      symbol,
      amount: uiAmount,
      reserveAddress: reserve.address,
      mint,
      summary: `${verbFor(action)} ${uiAmount} ${symbol} on Kamino main market.`,
      base64Txn,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight.toString(),
    },
  };
}

function makeBuildTool(action: BuildAction, description: string): ToolDefinition<BuildActionInput, ToolResult<PendingTransaction>> {
  return {
    name: `build${verbFor(action)}`,
    description,
    schema: buildActionInputSchema,
    handler: async (input, ctx) => {
      if (!ctx.walletAddress) {
        return {
          ok: false,
          error: 'No wallet connected. Ask the user to connect Phantom or Solflare first.',
        };
      }
      return buildPendingTransaction(action, input, ctx.walletAddress);
    },
  };
}

export const buildDeposit = makeBuildTool(
  'deposit',
  'Build a Kamino deposit transaction for the connected wallet. Returns an unsigned base64-encoded v0 transaction the user can sign in their wallet. Call this when the user asks to deposit, supply, lend, or add collateral to Kamino.'
);

export const buildBorrow = makeBuildTool(
  'borrow',
  'Build a Kamino borrow transaction for the connected wallet. Returns an unsigned base64-encoded v0 transaction. Call this when the user asks to borrow / take out a loan. Always call simulateHealth first to confirm the borrow would not trigger liquidation.'
);

export const buildWithdraw = makeBuildTool(
  'withdraw',
  'Build a Kamino withdraw transaction (pulls previously-deposited collateral back to the wallet). Returns an unsigned base64-encoded v0 transaction. Call this when the user asks to withdraw, unstake collateral, or reclaim their supplied tokens.'
);

export const buildRepay = makeBuildTool(
  'repay',
  'Build a Kamino repay transaction (pays down existing borrow). Returns an unsigned base64-encoded v0 transaction. Call this when the user asks to repay, pay back, or close their loan. Hint: call getPortfolio first to read the current borrowed amount so you pass a valid value.'
);

export const TOOLS = {
  getPortfolio,
  findYield,
  simulateHealth,
  buildDeposit,
  buildBorrow,
  buildWithdraw,
  buildRepay,
} as const;
