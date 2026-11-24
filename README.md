# 🤖 AI Student Assistant Chatbot

A modern, fully functional AI chatbot for students — built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, and powered by the **Google Gemini API**.

> Ask anything about Python, C/C++, Java, DSA, SQL, AI/ML, Maths, Computer Networks, Operating Systems, and more!

---

## ✨ Features

- 🎓 AI-powered answers via Google Gemini (server-side, API key never exposed)
- 🌙 Dark / Light theme toggle
- 💬 Multi-turn conversation memory
- 📋 Copy response button
- 🧑‍💻 Markdown + syntax-highlighted code blocks
- ⌨️ Enter to send, Shift+Enter for new line
- 📱 Fully responsive (desktop + mobile)
- 🗂️ Sidebar with New Chat & Clear Chat
- 💡 Suggested question cards on welcome screen
- ⚡ Loading animation while AI responds
- 🔒 Gemini API key strictly server-side (never in client JS or Git)

---

## 🚀 Local Setup

### Prerequisites
- Node.js 18 or later: https://nodejs.org
- Google Gemini API key: https://aistudio.google.com/app/apikey

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/amsharaiman3-maker/ai-student-chatbot.git
cd ai-student-chatbot

# 2. Install dependencies
npm install

# 3. Create your local environment file
cp .env.example .env.local
```

Edit `.env.local` and fill in your API key:

```
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

```bash
# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deploy to Vercel

1. Push this repository to GitHub (see below).
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your GitHub repo.
3. In **Environment Variables**, add:

   | Variable | Value |
   |---|---|
   | `GEMINI_API_KEY` | Your Gemini API key (required) |
   | `GEMINI_MODEL` | `gemini-2.5-flash` (optional, this is the default) |

4. Click **Deploy**. Done!

> **Note:** The project is lightweight and well within Vercel Hobby plan limits (no model weights, no large datasets).

---

## 📁 Project Structure

```
ai-student-chatbot/
├── app/
│   ├── api/chat/route.ts   # Gemini API server route
│   ├── globals.css          # Tailwind + dark/light theme
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main chatbot UI
├── lib/
│   └── gemini.ts            # Gemini config (model, system instruction)
├── types/
│   └── chat.ts              # TypeScript types
├── .env.example             # Template for environment variables
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 🔐 Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | — | Your Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model to use |

> ⚠️ **Never commit `.env.local` to Git.** It is already excluded by `.gitignore`.

---

## 🧠 Topics Covered

- Python programming
- C and C++ programming
- Data Structures and Algorithms
- Java
- SQL and Databases
- Artificial Intelligence
- Machine Learning & Data Science
- Computer Networks
- Operating Systems
- Mathematics
- General college subjects
- General knowledge

---

## 📄 License

MIT License — feel free to use, modify, and share.

