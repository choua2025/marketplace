"use client";

import "./globals.css";

/**
 * Last resort when the root layout itself fails: it replaces the whole
 * document, so there's no translation provider -- the text is in all three
 * languages.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="th">
      <body className="flex min-h-screen items-center justify-center bg-background p-4 font-sans text-foreground">
        <main className="flex max-w-sm flex-col items-center gap-3 text-center">
          <h1 className="text-xl font-semibold">เกิดข้อผิดพลาด · Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            ລະບົບມີບັນຫາ ກະລຸນາລອງໃໝ່ · กรุณาลองใหม่อีกครั้ง · Please try again.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="h-12 rounded-lg bg-primary px-6 font-medium text-primary-foreground"
          >
            ลองใหม่ · Try again
          </button>
        </main>
      </body>
    </html>
  );
}
