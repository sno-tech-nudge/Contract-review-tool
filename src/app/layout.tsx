import type { Metadata } from "next";
import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import { ToastProvider } from "@/components/Toast";
import { aiEnabled } from "@/lib/ai/claude";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contract review · The/Nudge",
  description: "Review contracts against our repository, Indian non-profit law and our own business rules.",
  icons: { icon: "/brand/thenudge-slash-brown.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <ToastProvider>
          <header className="nav">
            <Link href="/" className="nav__brand" aria-label="Contract review home">
              <img src="/brand/thenudge-wordmark-brown.png" alt="The/Nudge" />
              <span className="nav__product">Contract review</span>
            </Link>
            <NavLinks />
            <div className="nav__end">
              <span className={`badge ${aiEnabled() ? "badge--moss" : "badge--neutral"}`} title={aiEnabled() ? "Claude adds a summary and extra risks to every review" : "Set ANTHROPIC_API_KEY to add AI review"}>
                <span className="dot" aria-hidden />
                {aiEnabled() ? "AI review on" : "Rule checks only"}
              </span>
            </div>
          </header>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
