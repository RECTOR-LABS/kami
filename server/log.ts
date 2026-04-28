export interface Logger {
  info: (fields: Record<string, unknown>, msg: string) => void;
  warn: (fields: Record<string, unknown>, msg: string) => void;
  error: (fields: Record<string, unknown>, msg: string) => void;
}

function emit(
  stream: 'log' | 'error',
  level: 'info' | 'warn' | 'error',
  fields: Record<string, unknown>,
  msg: string,
): void {
  // Reserved fields (ts, level, msg) come AFTER spread so caller-supplied
  // fields cannot override them — blocks log injection at the smallest surface.
  const line = JSON.stringify({ ...fields, ts: new Date().toISOString(), level, msg });
  if (stream === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function createLogger(): Logger {
  return {
    info: (fields, msg) => emit('log', 'info', fields, msg),
    warn: (fields, msg) => emit('log', 'warn', fields, msg),
    error: (fields, msg) => emit('error', 'error', fields, msg),
  };
}
