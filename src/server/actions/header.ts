"use server";

import { getActor } from "@/server/auth/session";
import { countUnreadMessages } from "@/server/services/chat-read";
import { countPendingRequests } from "@/server/services/booking-read";

export interface HeaderCounts {
  /** Unread chat messages (customers and providers). */
  messages: number;
  /** Booking requests waiting for the provider to answer (providers only). */
  pendingBookings: number;
}

/** For the header's icon badges; all 0 when signed out. */
export async function headerCountsAction(): Promise<HeaderCounts> {
  const actor = await getActor();
  const [messages, pendingBookings] = await Promise.all([
    countUnreadMessages(actor),
    countPendingRequests(actor),
  ]);
  return { messages, pendingBookings };
}
