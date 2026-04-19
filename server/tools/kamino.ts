import { z } from 'zod';
import { address, type Address } from '@solana/kit';
import Decimal from 'decimal.js';
import {
  KaminoMarket,
  VanillaObligation,
  PROGRAM_ID,
  DEFAULT_RECENT_SLOT_DURATION_MS,
  type KaminoObligation,
  type KaminoReserve,
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

export const TOOLS = {
  getPortfolio,
} as const;
