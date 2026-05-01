export type WalletErrorKind =
  | 'cancelled'
  | 'expired'
  | 'timeout'
  | 'insufficient'
  | 'network'
  | 'on-chain'
  | 'simulation-failed'   // H3: pre-broadcast wallet/RPC simulation rejected
  | 'dust-floor'          // H3: Kamino NetValueRemainingTooSmall (Anchor 0x17cc)
  | 'unknown';

export interface ClassifiedWalletError {
  kind: WalletErrorKind;
  message: string;
  hint?: string;
}

const CANCEL_PATTERNS = [
  'user rejected',
  'user declined',
  'user canceled',
  'user cancelled',
  'request was rejected',
  'request rejected',
  'transaction was rejected',
  'plugin closed',
];

const NETWORK_PATTERNS = [
  'failed to fetch',
  'network request failed',
  'networkerror',
  'err_network',
  'load failed',
];

const INSUFFICIENT_PATTERNS = [
  'insufficient funds',
  'insufficient lamports',
  'account not found',
  'insufficient balance',
];

export function classifyWalletError(err: unknown): ClassifiedWalletError {
  if (!err) return { kind: 'unknown', message: 'Unknown error.' };

  if (typeof err === 'string') {
    return classifyFromStrings(err, '');
  }

  if (err instanceof Error) {
    const name = err.name ?? 'Error';
    const message = err.message ?? '';
    const cause = (err as Error & { cause?: unknown }).cause;
    const causeMsg = cause instanceof Error ? cause.message : '';
    return classifyFromStrings(message, name, causeMsg);
  }

  return { kind: 'unknown', message: String(err) };
}

function classifyFromStrings(
  message: string,
  name: string,
  causeMsg = ''
): ClassifiedWalletError {
  const haystack = `${name} ${message} ${causeMsg}`.toLowerCase();

  // H3: WalletSignTransactionError — fired when user declines sign popup.
  // Distinct from WalletSendTransactionError (the legacy bypass-our-RPC path).
  // Name-based dispatch fires before CANCEL_PATTERNS so the sign-specific
  // message wins over the generic "Cancelled in wallet." copy.
  if (name === 'WalletSignTransactionError') {
    return {
      kind: 'cancelled',
      message: 'You declined the sign request in your wallet.',
      hint: 'Click Retry to reopen the signing popup.',
    };
  }

  if (CANCEL_PATTERNS.some((p) => haystack.includes(p))) {
    return {
      kind: 'cancelled',
      message: 'Cancelled in wallet.',
      hint: 'Reopen your wallet and approve when ready.',
    };
  }

  if (INSUFFICIENT_PATTERNS.some((p) => haystack.includes(p))) {
    return {
      kind: 'insufficient',
      message: message || 'Insufficient funds.',
      hint: 'Top up SOL (for fees and rent) or the tokens being spent.',
    };
  }

  if (haystack.includes('blockhash expired') || haystack.includes('block height exceeded')) {
    return {
      kind: 'expired',
      message: 'Blockhash expired before confirmation.',
      hint: 'Retry — a fresh transaction will be built with a new blockhash.',
    };
  }

  if (haystack.includes('timed out') || haystack.includes('timeout')) {
    return {
      kind: 'timeout',
      message: 'Timed out waiting for confirmation.',
      hint: 'The network may be congested. Retry, and the new tx will use a fresh blockhash.',
    };
  }

  if (NETWORK_PATTERNS.some((p) => haystack.includes(p))) {
    return {
      kind: 'network',
      message: 'Network hiccup reaching the RPC.',
      hint: 'Check your connection and retry.',
    };
  }

  if (haystack.includes('on-chain failure')) {
    return {
      kind: 'on-chain',
      message: message || 'Transaction failed on-chain.',
      hint: 'Review the program error and adjust inputs.',
    };
  }

  // H3: Kamino NetValueRemainingTooSmall — Anchor error 0x17cc
  // Now reachable because H6 routes broadcast through our RPC, which surfaces
  // SendTransactionError.logs containing the raw Anchor message + custom code.
  if (haystack.includes('netvalueremainingtoosmall') || haystack.includes('0x17cc')) {
    return {
      kind: 'dust-floor',
      message:
        'Kamino rejected this action — would leave the obligation below the minimum value floor.',
      hint:
        "Either deposit more collateral first, do a partial repay (leaving a tiny dust amount), or use Kamino UI's Repay Max for atomic close-out.",
    };
  }

  // H3: Generic simulation failure (pre-broadcast preflight rejected the tx)
  if (haystack.includes('simulation failed') || haystack.includes('preflight check failed')) {
    return {
      kind: 'simulation-failed',
      message: 'Transaction would fail on-chain — pre-broadcast simulation rejected it.',
      hint:
        "Check the failure reason in your wallet's popup, or retry in a moment if it was a transient state issue.",
    };
  }

  // H3: Empty WalletSendTransactionError — now rare since H6 routes via signTransaction.
  // When it does fire, it's typically a popup closed without action.
  if (name === 'WalletSendTransactionError' && message.trim() === '') {
    return {
      kind: 'cancelled',
      message: 'Wallet returned no detail — the popup was closed without action.',
      hint: 'Reopen your wallet, watch for the signing popup, and click Approve or Reject.',
    };
  }

  const tag = name && name !== 'Error' && !message.includes(name) ? ` (${name})` : '';
  const base = message ? `${message}${tag}` : `${name || 'Error'} — wallet returned no detail.`;
  const full = causeMsg ? `${base} — cause: ${causeMsg}` : base;
  return { kind: 'unknown', message: full };
}
