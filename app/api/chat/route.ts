import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_MODEL, FALLBACK_MODEL, SYSTEM_INSTRUCTION } from "@/lib/gemini";
import { ChatRequest, ChatResponse } from "@/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1s, 2s, 4s exponential backoff

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GeminiCallResult {
  ok: boolean;
  status: number;
  data?: any;
  errorMessage?: string;
  isHighDemand?: boolean;
}

async function callGeminiModel(
  modelName: string,
  apiKey: string,
  geminiPayload: any
): Promise<GeminiCallResult> {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelName
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout per request

    let res: Response;
    try {
      res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
      };
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: true, status: res.status, data };
    }

    const errorText = await res.text().catch(() => "");
    let errMsg = `Gemini API returned status ${res.status}.`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson?.error?.message) {
        errMsg = errorJson.error.message;
      }
    } catch {}

    const isHighDemand =
      res.status === 503 ||
      errMsg.toLowerCase().includes("high demand") ||
      errMsg.toLowerCase().includes("overloaded") ||
      errMsg.toLowerCase().includes("spikes in demand");

    // Retry on 503 or temporary high demand spikes with exponential backoff
    if (isHighDemand && attempt < MAX_RETRIES) {
      await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
      continue;
    }

    return {
      ok: false,
      status: res.status,
      errorMessage: errMsg,
      isHighDemand,
    };
  }

  return {
    ok: false,
    status: 503,
    errorMessage: "Model temporarily unavailable due to high demand.",
    isHighDemand: true,
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

    // Limit message size to prevent abuse (max 4000 chars)
    if (message.length > 4000) {
      return NextResponse.json<ChatResponse>(
        {
          success: false,
          error: "Message is too long. Please limit your input to 4,000 characters.",
        },
        { status: 400 }
      );
    }

    // Prepare contents array for Gemini REST API
    const contents: Array<{ role: "user" | "model"; parts: [{ text: string }] }> = [];

    // Include recent history (limit to last 16 turns to keep context optimal)
    if (Array.isArray(history)) {
      const recentHistory = history.slice(-16);
      for (const item of recentHistory) {
        if (item.content && typeof item.content === "string") {
          contents.push({
            role: item.role === "assistant" ? "model" : "user",
            parts: [{ text: item.content.slice(0, 3000) }],
          });
        }
      }
    }

    // Add current user prompt
    contents.push({
      role: "user",
      parts: [{ text: message.trim() }],
    });

    const geminiPayload = {
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    };

    // 1. Try primary model with up to 3 retries (exponential backoff on 503)
    let callResult = await callGeminiModel(primaryModel, apiKey, geminiPayload);

    // 2. If primary model continues returning 503 / high demand, switch to fallback model
    if (!callResult.ok && callResult.isHighDemand && primaryModel !== FALLBACK_MODEL) {
      callResult = await callGeminiModel(FALLBACK_MODEL, apiKey, geminiPayload);
    }

    if (!callResult.ok) {
      let finalErrorMessage = callResult.errorMessage || "An unexpected error occurred.";

      if (callResult.isHighDemand) {
        finalErrorMessage =
          "The AI models are currently experiencing unusually high demand. We automatically retried your request, but the service is still busy. Please wait a moment and try asking again.";
      } else if (callResult.status === 400 && finalErrorMessage.toLowerCase().includes("api_key")) {
        finalErrorMessage = "Invalid Gemini API key provided. Please verify your GEMINI_API_KEY.";
      } else if (callResult.status === 429) {
        finalErrorMessage = "Gemini API rate limit reached. Please wait a moment before asking again.";
      }

      return NextResponse.json<ChatResponse>(
        { success: false, error: finalErrorMessage },
        { status: callResult.status >= 400 && callResult.status < 600 ? callResult.status : 500 }
      );
    }

    const data = callResult.data;
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (!text) {
      const finishReason = candidate?.finishReason;
      return NextResponse.json<ChatResponse>(
        {
          success: false,
          error: finishReason
            ? `Response was halted by Gemini (reason: ${finishReason}). Please rephrase your question.`
            : "No response was generated. Please try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json<ChatResponse>({
      success: true,
      text,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected server error occurred.";
    return NextResponse.json<ChatResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

