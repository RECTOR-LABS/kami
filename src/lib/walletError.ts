export type WalletErrorKind =
  | 'cancelled'
  | 'expired'
  | 'timeout'
  | 'insufficient'
  | 'network'
  | 'on-chain'
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

  // Heuristic: empty WalletSendTransactionError = silently dismissed popup
  if (name === 'WalletSendTransactionError' && message.trim() === '') {
    return {
      kind: 'cancelled',
      message: 'Wallet returned no detail — the popup was likely dismissed.',
      hint: 'Reopen your wallet, watch for the signing popup, and approve.',
    };
  }

  const tag = name && name !== 'Error' && !message.includes(name) ? ` (${name})` : '';
  const base = message ? `${message}${tag}` : `${name || 'Error'} — wallet returned no detail.`;
  const full = causeMsg ? `${base} — cause: ${causeMsg}` : base;
  return { kind: 'unknown', message: full };
}
