"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { headerCountsAction, type HeaderCounts } from "@/server/actions/header";
import { cn } from "@/lib/utils";

const REFRESH_MS = 30_000;
/** Fired by the chat thread after it marks a conversation read. */
export const MESSAGES_READ_EVENT = "changdee:messages-read";

export type HeaderBadge = keyof HeaderCounts;

const NO_COUNTS: HeaderCounts = { messages: 0, pendingBookings: 0 };
const HeaderCountsContext = createContext<HeaderCounts>(NO_COUNTS);

/**
 * Holds the signed-in user's header badge counts (unread messages, and for
 * providers, booking requests to answer). Starts from the server-rendered
 * counts, then refreshes every 30s, when the tab regains focus, and right
 * after a conversation is read.
 */
export function HeaderCountsProvider({
  initialCounts,
  children,
}: {
  initialCounts: HeaderCounts;
  children: React.ReactNode;
}) {
  const [counts, setCounts] = useState(initialCounts);
  const [lastInitial, setLastInitial] = useState(initialCounts);
  if (
    initialCounts.messages !== lastInitial.messages ||
    initialCounts.pendingBookings !== lastInitial.pendingBookings
  ) {
    // A fresh server render (e.g. router.refresh after accepting a job) brought newer counts.
    setLastInitial(initialCounts);
    setCounts(initialCounts);
  }

  const refresh = useCallback(async () => {
    try {
      setCounts(await headerCountsAction());
    } catch {
      // Offline or signed out mid-session: keep the last known counts.
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(MESSAGES_READ_EVENT, refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(MESSAGES_READ_EVENT, refresh);
    };
  }, [refresh]);

  return <HeaderCountsContext value={counts}>{children}</HeaderCountsContext>;
}

export function useHeaderCounts() {
  return useContext(HeaderCountsContext);
}

/** Red count bubble for an icon's top-right corner; renders nothing at 0. */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-background",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
