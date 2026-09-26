import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";

export const AI_PROMPT_VERSION = "curriculum-loop-v1";

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type StructuredResult<T> = {
  data: T;
  model: string;
  promptVersion: string;
  usage: AiUsage;
};

export type StructuredRequest<T> = {
  schema: ZodType<T>;
  schemaName: string;
  system: string;
  input: string;
  maxOutputTokens?: number;
  signal?: AbortSignal;
};

export class AiProviderError extends Error {
  constructor(public readonly code: "disabled" | "configuration" | "authentication" | "rate_limited" | "timeout" | "provider" | "invalid_output") {
    super(code);
    this.name = "AiProviderError";
  }
}

export interface AiProvider {
  generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>>;
}

function mapProviderError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) return new AiProviderError("authentication");
  if (error instanceof OpenAI.RateLimitError) return new AiProviderError("rate_limited");
  if (error instanceof OpenAI.APIConnectionTimeoutError || (error instanceof DOMException && error.name === "AbortError")) return new AiProviderError("timeout");
  return new AiProviderError("provider");
}

export class OpenAiResponsesProvider implements AiProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: { apiKey: string; model?: string; timeoutMs?: number }) {
    if (!options.apiKey) throw new AiProviderError("configuration");
    this.model = options.model || "gpt-5-mini";
    this.timeoutMs = options.timeoutMs ?? 45_000;
    this.client = new OpenAI({ apiKey: options.apiKey, timeout: this.timeoutMs, maxRetries: 2 });
  }

  async generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const abort = () => controller.abort();
    request.signal?.addEventListener("abort", abort, { once: true });

    try {
      const response = await this.client.responses.parse({
        model: this.model,
        instructions: request.system,
        input: request.input,
        max_output_tokens: request.maxOutputTokens ?? Number(process.env.AI_GENERATION_MAX_OUTPUT_TOKENS || 12_000),
        text: { format: zodTextFormat(request.schema, request.schemaName) },
      }, { signal: controller.signal });
      const parsed = response.output_parsed;
      if (!parsed) throw new AiProviderError("invalid_output");
      const validated = request.schema.safeParse(parsed);
      if (!validated.success) throw new AiProviderError("invalid_output");
      return {
        data: validated.data,
        model: response.model,
        promptVersion: AI_PROMPT_VERSION,
        usage: {
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      throw mapProviderError(error);
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener("abort", abort);
    }
  }
}

export function createAiProvider(): AiProvider {
  if (process.env.AI_CURRICULUM_ENABLED !== "true" && process.env.DEEP_LEARNING_LOOP_ENABLED !== "true") {
    throw new AiProviderError("disabled");
  }
  return new OpenAiResponsesProvider({
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL,
    timeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS || 45_000),
  });
}
