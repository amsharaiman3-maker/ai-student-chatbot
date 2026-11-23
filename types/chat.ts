export type Role = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  error?: boolean;
}

export interface ChatRequest {
  message: string;
  history?: Array<{
    role: Role;
    content: string;
  }>;
}

export interface ChatResponse {
  success: boolean;
  text?: string;
  error?: string;
}

