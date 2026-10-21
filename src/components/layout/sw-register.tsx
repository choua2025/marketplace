"use client";

import { useEffect } from "react";

/** Registers the offline-fallback service worker (SPEC.md section 10). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-critical: the app works fine without the offline fallback.
      });
    }
  }, []);

  return null;
}
