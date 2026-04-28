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
  type Base64EncodedWireTransaction,
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
import { assertWallet } from './wallet.js';

export const KAMINO_MAIN_MARKET: Address = address('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF');
export const KAMINO_MAIN_MARKET_NAME = 'Main';

const KLEND_NO_CLOSE_OBLIGATION =
  'klend does not currently expose a close_obligation instruction';

export const getPortfolioSchema = z.object({});

export interface PortfolioPosition {
  symbol: string;
  mint: string;
  reserve: string;
  amount: number;
  valueUsd: number;
  apyPercent: number;
  priceStale: boolean;
  slotsSinceRefresh: number;
}

export interface PortfolioSnapshot {
  wallet: string;
  marketName: string;
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
let loadingPromise: Promise<KaminoMarket> | null = null;

const pdaCache = new Map<string, Promise<Address>>();

export function getVanillaPda(market: Address, wallet: Address): Promise<Address> {
  const key = `${market}:${wallet}`;
  let promise = pdaCache.get(key);
  if (!promise) {
    // Catch-and-evict: a rejected promise must NOT poison the cache for the
    // session. PDA derivation is deterministic on valid inputs so this branch
    // is near-zero in practice, but the eviction prevents permanent dead-key
    // failure if the SDK or program ID ever changes shape.
    promise = new VanillaObligation(PROGRAM_ID).toPda(market, wallet)
      .catch((err) => {
        pdaCache.delete(key);
        return Promise.reject(err);
      });
    pdaCache.set(key, promise);
  }
  return promise;
}

export async function getMarket(): Promise<KaminoMarket> {
  const now = Date.now();
  if (cachedMarket && now - marketLoadedAt < MARKET_CACHE_TTL_MS) {
    return cachedMarket;
  }
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      const rpc = getRpc();
      const market = await KaminoMarket.load(rpc, KAMINO_MAIN_MARKET, DEFAULT_RECENT_SLOT_DURATION_MS);
      if (!market) {
        throw new Error(`Failed to load Kamino main market ${KAMINO_MAIN_MARKET}`);
      }
      cachedMarket = market;
      marketLoadedAt = Date.now();
      return market;
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

/**
 * Decimal → number for display purposes only.
 *
 * Loses precision when |d| > 2^53 (~9e15). Do not use for amounts that will be
 * hashed, sent on-chain, or compared for equality — pass the raw Decimal through
 * to the SDK in those cases. Returns 0 when the conversion overflows to ±Infinity
 * (Decimal can hold values larger than Number.MAX_VALUE).
 */
export function toNumber(d: Decimal): number {
  return Number.isFinite(d.toNumber()) ? d.toNumber() : 0;
}

const STALENESS_THRESHOLD_SLOTS = 600;  // ~4 min @ ~400ms/slot — empirically tuned (post-D-13 smoke 2026-04-27); 150-slot baseline produced too many false-positives on idle reserves

export function computeStaleness(
  reserve: KaminoReserve,
  currentSlot: bigint,
): { priceStale: boolean; slotsSinceRefresh: number } {
  const lastSlot = reserve.state.lastUpdate.slot.toNumber();
  const slotsSinceRefresh = Math.max(0, Number(currentSlot) - lastSlot);
  return {
    priceStale: slotsSinceRefresh > STALENESS_THRESHOLD_SLOTS,
    slotsSinceRefresh,
  };
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
    const staleness = reserve
      ? computeStaleness(reserve, currentSlot)
      : { priceStale: false, slotsSinceRefresh: 0 };
    out.push({
      symbol,
      mint: pos.mintAddress,
      reserve: pos.reserveAddress,
      amount: toNumber(tokenAmount),
      valueUsd: toNumber(pos.marketValueRefreshed),
      apyPercent: Number.isFinite(apy) ? apy * 100 : 0,
      ...staleness,
    });
  }
  return out;
}

export function computeHealthFactor(loanToValue: Decimal, liquidationLtv: Decimal): number | null {
  if (loanToValue.lte(0)) return null;
  return toNumber(liquidationLtv.div(loanToValue));
}

async function fetchVanillaObligation(
  market: KaminoMarket,
  wallet: Address
): Promise<KaminoObligation | null> {
  const vanillaPda = await getVanillaPda(market.getAddress(), wallet);
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
    const guard = assertWallet(ctx);
    if (!('wallet' in guard)) return guard;
    const wallet = guard.wallet;

    const market = await getMarket();
    const obligation = await fetchVanillaObligation(market, wallet);

    if (!obligation) {
      return {
        ok: true,
        data: {
          wallet: wallet,
          marketName: KAMINO_MAIN_MARKET_NAME,
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
        wallet: wallet,
        marketName: KAMINO_MAIN_MARKET_NAME,
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
  marketName: string;
  mint: string;
  reserve: string;
  side: 'supply' | 'borrow';
  apyPercent: number;
  ltvRatio: number;
  liquidationLtv: number;
  utilizationPercent: number;
  marketPriceUsd: number;
  priceStale: boolean;
  slotsSinceRefresh: number;
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
        marketName: KAMINO_MAIN_MARKET_NAME,
        mint: reserve.stats.mintAddress,
        reserve: reserve.address,
        side,
        apyPercent: apy * 100,
        ltvRatio: reserve.stats.loanToValue,
        liquidationLtv: reserve.stats.liquidationThreshold,
        utilizationPercent: computeUtilizationPercent(reserve),
        marketPriceUsd: toNumber(reserve.getOracleMarketPrice()),
        ...computeStaleness(reserve, currentSlot),
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
  marketName: string;
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
    const guard = assertWallet(ctx);
    if (!('wallet' in guard)) return guard;
    const wallet = guard.wallet;

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
        marketName: KAMINO_MAIN_MARKET_NAME,
        symbol: reserve.getTokenSymbol(),
        amount: input.amount,
        current,
        projected,
        warnings,
      },
    };
  },
};

const LAMPORTS_PER_SOL = 1_000_000_000;

export function formatSol(lamports: number | bigint): string {
  const n = typeof lamports === 'bigint' ? Number(lamports) : lamports;
  return (n / LAMPORTS_PER_SOL).toFixed(6).replace(/\.?0+$/, '');
}

interface PreflightOutcome {
  ok: boolean;
  error?: string;
}

async function preflightSimulate(
  rpc: ReturnType<typeof getRpc>,
  base64Txn: Base64EncodedWireTransaction,
  feePayer: Address,
  action: string,
  symbol: string,
  amount: number
): Promise<PreflightOutcome> {
  let balanceLamports: bigint;
  try {
    const balResp = await rpc.getBalance(feePayer).send();
    balanceLamports = balResp.value;
  } catch (err) {
    console.error('[preflight] getBalance threw — bypassing', err);
    return { ok: true };
  }

  if (balanceLamports < 10_000n) {
    return {
      ok: false,
      error: `Wallet ${feePayer} has only ${formatSol(balanceLamports)} SOL — not enough for even a transaction fee. Top up at least 0.01 SOL before signing.`,
    };
  }

  let simResp;
  try {
    simResp = await rpc
      .simulateTransaction(base64Txn, {
        encoding: 'base64',
        sigVerify: false,
        replaceRecentBlockhash: true,
        commitment: 'confirmed',
      })
      .send();
  } catch (err) {
    console.error('[preflight] simulateTransaction threw — bypassing', err);
    return { ok: true };
  }

  const err = simResp.value.err;
  if (!err) return { ok: true };

  const logs = simResp.value.logs ?? [];
  const insufficientLog = logs.find((line) => /insufficient lamports/i.test(line));
  if (insufficientLog) {
    const match = insufficientLog.match(/insufficient lamports (\d+),\s*need (\d+)/);
    if (match) {
      const have = Number(match[1]);
      const need = Number(match[2]);
      const shortfall = need - have;
      const approxTotal = Number(balanceLamports) + shortfall;
      return {
        ok: false,
        error: `Insufficient SOL for rent on this ${action}. The wallet would run out mid-transaction when setting up a required Kamino account. Current balance: ${formatSol(balanceLamports)} SOL. Estimated total needed: ~${formatSol(approxTotal)} SOL (short by ~${formatSol(shortfall)} SOL). Heads up: this is a one-time account setup cost per Kamino market — about ~0.022 SOL of this is obligation account rent that stays locked per (user, market) pair (${KLEND_NO_CLOSE_OBLIGATION}); the remainder is cToken ATA rent (recoverable when the ATAs are closed) plus the tx fee.`,
      };
    }
    return {
      ok: false,
      error: `Insufficient SOL for account rent on this ${action}. First-time Kamino setup needs ~0.05 SOL on top of your deposit amount; ~0.022 SOL of that is the obligation account rent that stays locked per market (${KLEND_NO_CLOSE_OBLIGATION}). Current balance: ${formatSol(balanceLamports)} SOL.`,
    };
  }

  const errStr = typeof err === 'string' ? err : safeStringify(err);
  const tail = logs.slice(-4).join(' | ') || '(no logs)';
  return {
    ok: false,
    error: `Simulation failed for ${action} ${amount} ${symbol}: ${errStr}. Last logs: ${tail}`,
  };
}

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
  } catch {
    return String(value);
  }
}

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

export function verbFor(action: BuildAction): string {
  return action.charAt(0).toUpperCase() + action.slice(1);
}

async function buildPendingTransaction(
  action: BuildAction,
  input: BuildActionInput,
  wallet: Address
): Promise<ToolResult<PendingTransaction>> {
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
    // Server-side triage: keep the raw error and request context. The
    // user-facing message stays scrubbed below.
    console.error('[Kami] KaminoAction build failed', {
      action,
      symbol: input.symbol,
      amount: input.amount,
      wallet,
      err,
    });
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

  const preflight = await preflightSimulate(rpc, base64Txn, wallet, action, symbol, uiAmount);
  if (!preflight.ok) {
    return { ok: false, error: preflight.error ?? 'Transaction would fail simulation.' };
  }

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
      const guard = assertWallet(ctx);
      if (!('wallet' in guard)) return guard;
      return buildPendingTransaction(action, input, guard.wallet);
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

/** For tests only — clears module-scope caches so unit tests start clean.
 *  Throws when invoked outside `NODE_ENV === 'test'` (matches D-21 pattern). */
export function _resetCachesForTesting(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('_resetCachesForTesting may only be called when NODE_ENV === "test"');
  }
  cachedMarket = null;
  marketLoadedAt = 0;
  loadingPromise = null;
  pdaCache.clear();
}
