"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  User,
  Send,
  PlusCircle,
  Trash2,
  Copy,
  Check,
  Menu,
  X,
  Moon,
  Sun,
  BookOpen,
  Code2,
  Brain,
  Database,
} from "lucide-react";
import { ChatMessage } from "@/types/chat";

const SUGGESTED_QUESTIONS = [
  {
    icon: <Code2 size={18} />,
    text: "Explain Python OOP with examples",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30 hover:border-blue-400/60",
  },
  {
    icon: <Brain size={18} />,
    text: "What is a binary search tree?",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/30 hover:border-purple-400/60",
  },
  {
    icon: <BookOpen size={18} />,
    text: "Explain machine learning simply",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-400/60",
  },
  {
    icon: <Database size={18} />,
    text: "Write a C program for stack operations",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30 hover:border-amber-400/60",
  },
];

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  };

  const sendMessage = useCallback(
    async (text: string) => {
      const userText = text.trim();
      if (!userText || loading) return;

      setInput("");
      setSidebarOpen(false);
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: userText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        // Build conversation history (excluding the latest user message just added)
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userText, history }),
        });

        const data = await response.json();

        if (data.success && data.text) {
          const aiMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: data.text,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, aiMsg]);
        } else {
          const errMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: data.error || "An unexpected error occurred. Please try again.",
            timestamp: Date.now(),
            error: true,
          };
          setMessages((prev) => [...prev, errMsg]);
        }
      } catch {
        const errMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content:
            "Failed to connect to the AI service. Please check your internet connection and try again.",
          timestamp: Date.now(),
          error: true,
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [loading, messages]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleClearChat = () => {
    setMessages([]);
    setSidebarOpen(false);
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const isScrolledToBottom = () => {
    const el = chatAreaRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  return (
    <div
      className={`flex h-dvh overflow-hidden transition-colors duration-200 ${
        darkMode ? "dark" : ""
      }`}
    >
      {/* ===================== SIDEBAR ===================== */}
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed md:static z-30 h-dvh w-72 sidebar-gradient flex flex-col
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Logo & Title */}
        <div className="flex items-center gap-3 px-5 pt-7 pb-6 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-xl animate-[pulse-ring_3s_ease-in-out_infinite]">
            🤖
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-tight">
              AI Student
            </h1>
            <p className="text-indigo-300 text-xs">Assistant Chatbot</p>
          </div>
          {/* Close button mobile */}
          <button
            className="ml-auto md:hidden text-indigo-300 hover:text-white transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Buttons */}
        <div className="p-4 space-y-2">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all duration-200 shadow-md hover:shadow-indigo-500/30 shimmer-btn"
          >
            <PlusCircle size={18} />
            New Chat
          </button>
          <button
            onClick={handleClearChat}
            disabled={messages.length === 0}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-200 hover:text-white text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={16} />
            Clear Chat
          </button>
        </div>

        {/* Topics */}
        <div className="flex-1 px-4 pb-4 overflow-y-auto">
          <p className="text-indigo-400 text-xs font-semibold uppercase tracking-widest mb-3 px-1">
            I can help with
          </p>
          <div className="space-y-1">
            {[
              "🐍 Python & OOP",
              "⚙️ C, C++ & Java",
              "🌳 Data Structures & Algorithms",
              "🗄️ SQL & Databases",
              "🤖 AI & Machine Learning",
              "📊 Data Science",
              "🌐 Computer Networks",
              "💻 Operating Systems",
              "📐 Mathematics",
              "📚 College Subjects",
              "💡 General Knowledge",
            ].map((topic) => (
              <div
                key={topic}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-indigo-200 text-xs hover:bg-white/5 transition-colors cursor-default"
              >
                {topic}
              </div>
            ))}
          </div>
        </div>

        {/* Theme toggle */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-200 hover:text-white text-sm transition-all duration-200"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </aside>

      {/* ===================== MAIN CONTENT ===================== */}
      <main className="flex flex-col flex-1 min-w-0 bg-[var(--chat-bg)]">
        {/* Top Header */}
        <header className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--header-border)] bg-[var(--header-bg)] shrink-0">
          <button
            className="md:hidden p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <div>
              <h2 className="font-semibold text-sm text-slate-800 dark:text-white leading-none">
                AI Student Assistant
              </h2>
              <p className="text-xs text-emerald-500 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1 animate-pulse" />
                Online · Powered by Gemini
              </p>
            </div>
          </div>
          {/* New chat top-right */}
          <button
            onClick={handleNewChat}
            className="ml-auto hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all duration-200"
          >
            <PlusCircle size={14} />
            New Chat
          </button>
        </header>

        {/* ===================== CHAT AREA ===================== */}
        <div
          ref={chatAreaRef}
          className="chat-area flex-1 px-4 py-6 overflow-y-auto space-y-6"
        >
          {/* Welcome Screen */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center animate-fade-up">
              <div className="w-20 h-20 rounded-3xl bg-indigo-600 flex items-center justify-center text-5xl mb-5 shadow-2xl shadow-indigo-500/30">
                🎓
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white mb-3">
                Hello! I&apos;m your AI Student Assistant.
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base max-w-lg mb-8">
                Ask me anything about programming, technology, college subjects or
                general knowledge. I&apos;ll explain concepts clearly with examples
                and code.
              </p>

              {/* Suggested question cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q.text)}
                    className={`welcome-card flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${q.bg} bg-white dark:bg-slate-800/50`}
                  >
                    <span className={`mt-0.5 shrink-0 ${q.color}`}>{q.icon}</span>
                    <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                      {q.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 animate-fade-up ${
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar */}
              <div
                className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm shadow ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : msg.error
                    ? "bg-red-500/20 text-red-400"
                    : "bg-slate-700 text-slate-100"
                }`}
              >
                {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
              </div>

              {/* Bubble */}
              <div
                className={`group relative max-w-[82%] sm:max-w-[75%] ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 shadow-sm ${
                    msg.role === "user"
                      ? "user-message bg-indigo-600 text-white rounded-tr-sm"
                      : msg.error
                      ? "bg-red-900/30 border border-red-500/40 text-red-300 rounded-tl-sm"
                      : "bg-[var(--ai-bubble)] border border-[var(--ai-bubble-border)] text-slate-800 dark:text-slate-100 rounded-tl-sm"
                  }`}
                >
                  <div className="prose-chat">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Timestamp + Copy */}
                <div
                  className={`flex items-center gap-2 mt-1 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <span className="text-xs text-slate-400">
                    {formatTime(msg.timestamp)}
                  </span>
                  {msg.role === "assistant" && !msg.error && (
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-400 p-1 rounded"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <Check size={13} className="text-emerald-400" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Loading animation */}
          {loading && (
            <div className="flex gap-3 animate-fade-up">
              <div className="shrink-0 w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center">
                <Bot size={16} className="text-slate-100" />
              </div>
              <div className="bg-[var(--ai-bubble)] border border-[var(--ai-bubble-border)] rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="animate-typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block" />
                  <span className="animate-typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block" />
                  <span className="animate-typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block" />
                </div>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* ===================== INPUT AREA ===================== */}
        <div className="shrink-0 px-4 pb-5 pt-3 bg-[var(--chat-bg)] border-t border-[var(--header-border)]">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-2xl px-4 py-3 shadow-lg focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all duration-200">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about programming, algorithms, AI, college subjects…"
                rows={1}
                className="chat-input flex-1 bg-transparent text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm outline-none"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="send-btn-gradient shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md"
                title="Send (Enter)"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-2">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-xs font-mono">Enter</kbd>
              {" "}to send ·{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-xs font-mono">Shift+Enter</kbd>
              {" "}for new line
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
