
import type {Metadata} from "next";
import {Toaster} from "sonner";
import {Providers} from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lyrical Studio — AI Lyrical Video Generator",
  description:
    "Transcribe, align, edit, animate and export lyrical videos with precise word synchronization. Powered by Groq Whisper, NVIDIA NIM, and Remotion."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            richColors
            closeButton
            toastOptions={{
              className: "panel-glass",
              style: {
                background: "var(--color-surface-overlay)",
                border: "1px solid var(--color-border-subtle)",
                color: "var(--color-text-primary)"
              }
            }}
          />
        </Providers>
      </body>
    </html>
  );
}


