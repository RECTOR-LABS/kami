import '@testing-library/jest-dom/vitest';
import { Readable } from 'node:stream';

// Vite's nodePolyfills replaces `node:stream` with the `readable-stream`
// package in the bundled test runtime. `readable-stream` does not expose
// `Readable.fromWeb` (a Node 17+ native). Provide a minimal shim so
// handlers that pipe a Web ReadableStream into res (api/chat.ts) can be
// exercised. Cast through `any` — @types/node declares fromWeb with an
// overloaded signature that a single narrow shim cannot satisfy.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = Readable as any;
if (typeof R.fromWeb !== 'function') {
  R.fromWeb = function fromWeb(webStream: ReadableStream<Uint8Array>) {
    const reader = webStream.getReader();
    return new Readable({
      async read() {
        try {
          const { value, done } = await reader.read();
          if (done) this.push(null);
          else this.push(Buffer.from(value));
        } catch (err) {
          this.destroy(err instanceof Error ? err : new Error(String(err)));
        }
      },
    });
  };
}
