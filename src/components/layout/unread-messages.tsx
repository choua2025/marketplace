"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { unreadMessageCountAction } from "@/app/[locale]/messages/actions";
import { cn } from "@/lib/utils";

const REFRESH_MS = 30_000;
/** Fired by the chat thread after it marks a conversation read. */
export const MESSAGES_READ_EVENT = "changdee:messages-read";

const UnreadMessagesContext = createContext(0);

/**
 * Holds the signed-in user's unread message count for the header badge.
 * Starts from the server-rendered count, then refreshes every 30s, when the
 * tab regains focus, and right after a conversation is read.
 */
export function UnreadMessagesProvider({
  initialCount,
  children,
}: {
  initialCount: number;
  children: React.ReactNode;
}) {
  const [count, setCount] = useState(initialCount);
  const [lastInitial, setLastInitial] = useState(initialCount);
  if (initialCount !== lastInitial) {
    // A fresh server render (e.g. router.refresh) brought a newer count.
    setLastInitial(initialCount);
    setCount(initialCount);
  }

  const refresh = useCallback(async () => {
    try {
      setCount(await unreadMessageCountAction());
    } catch {
      // Offline or signed out mid-session: keep the last known count.
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

  return <UnreadMessagesContext value={count}>{children}</UnreadMessagesContext>;
}

export function useUnreadMessages() {
  return useContext(UnreadMessagesContext);
}

/** Red count bubble for an icon's top-right corner; renders nothing at 0. */
export function UnreadBadge({ count, className }: { count: number; className?: string }) {
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
