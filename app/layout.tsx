import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Student Assistant Chatbot",
  description:
    "A modern AI-powered chatbot to help students with programming, data structures, algorithms, AI, ML, mathematics, and all college subjects. Powered by Google Gemini.",
  keywords: [
    "AI chatbot",
    "student assistant",
    "programming help",
    "Gemini AI",
    "DSA",
    "machine learning",
    "study assistant",
  ],
  authors: [{ name: "AI Student Assistant" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🤖</text></svg>" />
      </head>
      <body>{children}</body>
    </html>
  );
}
