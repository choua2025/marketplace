"use client";

import { useEffect, useRef } from "react";

export interface StreamedMessage {
  id: number;
  conversationId: string;
  senderId: string;
  body: string | null;
  imageUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Subscribes to `/api/conversations/[id]/stream` for the lifetime of the component. */
export function useChatStream(
  conversationId: string,
  onMessage: (message: StreamedMessage) => void,
): void {
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const source = new EventSource(`/api/conversations/${conversationId}/stream`);

    function handleMessage(event: MessageEvent<string>) {
      onMessageRef.current(JSON.parse(event.data) as StreamedMessage);
    }

    source.addEventListener("message", handleMessage);
    return () => {
      source.removeEventListener("message", handleMessage);
      source.close();
    };
  }, [conversationId]);
}
