import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_MODEL, FALLBACK_MODEL, SYSTEM_INSTRUCTION } from "@/lib/gemini";
import { ChatRequest, ChatResponse } from "@/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RETRIES = 2; // Up to 2 retries (3 total attempts) to prevent excessive waiting
const INITIAL_BACKOFF_MS = 600; // Fast initial retry: 600ms, 1200ms

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface StreamAttemptResult {
  ok: boolean;
  status: number;
  response?: Response;
  errorMessage?: string;
  isRetryable?: boolean;
}

async function tryStreamGemini(
  modelName: string,
  apiKey: string,
  geminiPayload: unknown
): Promise<StreamAttemptResult> {
  // Use SSE streaming endpoint (alt=sse) with streamGenerateContent for instant word-by-word response
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelName
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s initial connection timeout

    let res: Response;
    try {
      res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(geminiPayload),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (attempt < MAX_RETRIES) {
        await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
        continue;
      }
      return {
        ok: false,
        status: 504,
        errorMessage: "Network timeout or connection error while contacting Gemini API.",
        isRetryable: true,
      };
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.ok && res.body) {
      return { ok: true, status: res.status, response: res };
    }

    const errorText = await res.text().catch(() => "");
    let errMsg = `Gemini API returned status ${res.status}.`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson?.error?.message) {
        errMsg = errorJson.error.message;
      }
    } catch {}

    const isRetryable =
      res.status === 503 ||
      res.status === 429 ||
      errMsg.toLowerCase().includes("high demand") ||
      errMsg.toLowerCase().includes("overloaded") ||
      errMsg.toLowerCase().includes("spikes in demand");

    if (isRetryable && attempt < MAX_RETRIES) {
      await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
      continue;
    }

    return {
      ok: false,
      status: res.status,
      errorMessage: errMsg,
      isRetryable,
    };
  }

  return {
    ok: false,
    status: 503,
    errorMessage: "Model temporarily unavailable due to high demand.",
    isRetryable: true,
  };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json<ChatResponse>(
        {
          success: false,
          error:
            "Gemini API key is not configured. Please add GEMINI_API_KEY to your .env.local file or Vercel environment variables.",
        },
        { status: 500 }
      );
    }

    const primaryModel = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

    let body: ChatRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json<ChatResponse>(
        { success: false, error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const { message, history } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json<ChatResponse>(
        { success: false, error: "Message cannot be empty." },
        { status: 400 }
      );
    }

    // Limit user message size (max 3000 chars) for prompt efficiency
    const trimmedMessage = message.trim().slice(0, 3000);

    // Prepare contents array for Gemini REST API
    const contents: Array<{ role: "user" | "model"; parts: [{ text: string }] }> = [];

    // Keep only the last 6 turns (3 exchanges) of history to minimize input token processing overhead
    if (Array.isArray(history)) {
      const recentHistory = history.slice(-6);
      for (const item of recentHistory) {
        if (item.content && typeof item.content === "string") {
          contents.push({
            role: item.role === "assistant" ? "model" : "user",
            parts: [{ text: item.content.slice(0, 1500) }],
          });
        }
      }
    }

    // Add current user prompt
    contents.push({
      role: "user",
      parts: [{ text: trimmedMessage }],
    });

    // Optimized payload: 1024 maxOutputTokens is ideal for fast academic explanations and code snippets
    const geminiPayload = {
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    };

    // 1. Attempt streaming with primary model (gemini-3.8-flash)
    let streamResult = await tryStreamGemini(primaryModel, apiKey, geminiPayload);

    // 2. Fallback to gemini-3.5-flash-lite if primary is overloaded or returns 503/429
    if (!streamResult.ok && streamResult.isRetryable && primaryModel !== FALLBACK_MODEL) {
      streamResult = await tryStreamGemini(FALLBACK_MODEL, apiKey, geminiPayload);
    }

    if (!streamResult.ok || !streamResult.response?.body) {
      let finalErrorMessage = streamResult.errorMessage || "An unexpected error occurred.";

      if (streamResult.isRetryable) {
        finalErrorMessage =
          "The AI models are currently experiencing high demand. Please wait a moment and try asking again.";
      } else if (streamResult.status === 400 && finalErrorMessage.toLowerCase().includes("api_key")) {
        finalErrorMessage = "Invalid Gemini API key provided. Please verify your GEMINI_API_KEY.";
      } else if (streamResult.status === 429) {
        finalErrorMessage = "Gemini API rate limit reached. Please wait a moment before asking again.";
      }

      return NextResponse.json<ChatResponse>(
        { success: false, error: finalErrorMessage },
        { status: streamResult.status >= 400 && streamResult.status < 600 ? streamResult.status : 500 }
      );
    }

    // Transform Gemini's SSE stream into a clean raw text stream
    const geminiBody = streamResult.response.body;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let buffer = "";

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last partial line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(dataStr);
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            } catch {
              // Ignore unparseable SSE line fragments
            }
          }
        }
      },
      flush(controller) {
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(trimmed.slice(6).trim());
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            } catch {}
          }
        }
      },
    });

    const readable = geminiBody.pipeThrough(transformStream);

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected server error occurred.";
    return NextResponse.json<ChatResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
