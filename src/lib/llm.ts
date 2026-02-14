/**
 * Unified LLM streaming client.
 * Supports OpenAI (gpt-5.2), Google Gemini (gemini-3-pro-preview), and
 * Anthropic Claude (claude-opus-4-5-20250918).
 *
 * All three expose the same async-generator interface so callers don't
 * need to know which provider is in use.
 */

import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import { ModelProvider } from "@/types/presentation";

// ── Clients (lazy singletons) ──────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

let _gemini: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!_gemini) {
    _gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  }
  return _gemini;
}

let _anthropic: AnthropicBedrock | null = null;
function getAnthropic(): AnthropicBedrock {
  if (!_anthropic) {
    _anthropic = new AnthropicBedrock({
      awsRegion: process.env.AWS_REGION ?? "us-east-1",
      // Use Bedrock API key (bearer token) instead of SigV4 signing
      skipAuth: true,
      defaultHeaders: {
        Authorization: `Bearer ${process.env.AWS_BEARER_TOKEN_BEDROCK}`,
      },
    });
  }
  return _anthropic;
}

// ── Model IDs ──────────────────────────────────────────────────────────────

const MODEL_IDS: Record<ModelProvider, string> = {
  openai: "gpt-5.2",
  gemini: "gemini-3-pro-preview",
  anthropic: "us.anthropic.claude-opus-4-5-20251101-v1:0",
};

// ── Public streaming function ──────────────────────────────────────────────

/**
 * Stream text from any of the three providers.
 * Yields string chunks as they arrive.
 */
export async function* streamLLM(
  provider: ModelProvider,
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<string> {
  switch (provider) {
    case "openai":
      yield* streamOpenAI(systemPrompt, userPrompt);
      break;
    case "gemini":
      yield* streamGemini(systemPrompt, userPrompt);
      break;
    case "anthropic":
      yield* streamAnthropic(systemPrompt, userPrompt);
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ── Provider implementations ───────────────────────────────────────────────

async function* streamOpenAI(
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<string> {
  const client = getOpenAI();
  const stream = await client.responses.create({
    model: MODEL_IDS.openai,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    stream: true,
  });
  for await (const event of stream) {
    if (event.type === "response.output_text.delta" && event.delta) {
      yield event.delta;
    }
  }
}

async function* streamGemini(
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<string> {
  const ai = getGemini();

  const response = await ai.models.generateContentStream({
    model: MODEL_IDS.gemini,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
    },
  });

  for await (const chunk of response) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}

async function* streamAnthropic(
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<string> {
  const client = getAnthropic();
  const stream = client.messages.stream({
    model: MODEL_IDS.anthropic,
    max_tokens: 16384,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
