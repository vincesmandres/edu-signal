declare module "cloudflare:workers" {
  export const env: Record<string, unknown> & {
    EVIDENCE_BUCKET?: {
      put(key: string, value: ReadableStream, options?: Record<string, unknown>): Promise<void>;
    };
  };
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface D1Database {
  prepare(query: string): unknown;
}
