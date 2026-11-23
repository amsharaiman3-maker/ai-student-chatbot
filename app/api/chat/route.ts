import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_MODEL, SYSTEM_INSTRUCTION } from "@/lib/gemini";
import { ChatRequest, ChatResponse } from "@/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

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
    // Format: contents: [{ role: 'user' | 'model', parts: [{ text }] }]
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

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout

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
      if (err instanceof Error && err.name === "AbortError") {
        return NextResponse.json<ChatResponse>(
          {
            success: false,
            error: "The request timed out while waiting for a response from Gemini. Please try again.",
          },
          { status: 504 }
        );
      }
      return NextResponse.json<ChatResponse>(
        {
          success: false,
          error: "Network error connecting to Gemini API. Please check your internet connection.",
        },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      let errorMessage = `Gemini API returned status ${res.status}.`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson?.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {}

      if (res.status === 400 && errorMessage.toLowerCase().includes("api_key")) {
        errorMessage = "Invalid Gemini API key provided. Please verify your GEMINI_API_KEY.";
      } else if (res.status === 429) {
        errorMessage = "Gemini API rate limit reached. Please wait a moment before asking again.";
      }

      return NextResponse.json<ChatResponse>(
        { success: false, error: errorMessage },
        { status: res.status >= 400 && res.status < 600 ? res.status : 500 }
      );
    }

    const data = await res.json();
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

