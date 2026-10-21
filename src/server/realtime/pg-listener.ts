import { EventEmitter } from "node:events";
import { Client } from "pg";
import { env } from "@/server/lib/env";

/**
 * One dedicated LISTEN connection per process (SPEC.md section 7.8) --
 * separate from the `db` query Pool, since a pooled connection could be
 * handed back and reused mid-LISTEN. Fans Postgres NOTIFYs out to local
 * SSE subscribers via an EventEmitter.
 */
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

// Channel -> subscriber count, so a dropped connection knows which
// channels to re-LISTEN on reconnect even though the emitter itself
// never loses its listeners.
const channelSubscriberCounts = new Map<string, number>();

let client: Client | null = null;
let connecting: Promise<Client> | null = null;

function channelName(conversationId: string): string {
  return `chat_${conversationId}`;
}

async function connect(): Promise<Client> {
  const c = new Client({ connectionString: env.DATABASE_APP_URL });

  c.on("notification", (msg) => {
    if (msg.channel && msg.payload) emitter.emit(msg.channel, msg.payload);
  });
  c.on("error", (error) => {
    console.error("pg-listener connection error", error);
    client = null;
  });

  await c.connect();
  for (const channel of channelSubscriberCounts.keys()) {
    await c.query(`LISTEN "${channel}"`);
  }
  return c;
}

async function getClient(): Promise<Client> {
  if (client) return client;
  if (!connecting) {
    connecting = connect()
      .then((c) => {
        client = c;
        connecting = null;
        return c;
      })
      .catch((error) => {
        connecting = null;
        throw error;
      });
  }
  return connecting;
}

/**
 * Subscribes to new-message notifications for one conversation. The
 * callback receives the new message's id (never its content -- the NOTIFY
 * payload itself only ever carries the id; the caller re-fetches via the
 * chat service so authorization is re-checked on every delivery).
 * Returns an unsubscribe function.
 */
export async function subscribeToConversation(
  conversationId: string,
  onMessage: (messageId: string) => void,
): Promise<() => void> {
  const channel = channelName(conversationId);
  const c = await getClient();

  const count = channelSubscriberCounts.get(channel) ?? 0;
  if (count === 0) {
    await c.query(`LISTEN "${channel}"`);
  }
  channelSubscriberCounts.set(channel, count + 1);
  emitter.on(channel, onMessage);

  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;
    emitter.off(channel, onMessage);
    const remaining = (channelSubscriberCounts.get(channel) ?? 1) - 1;
    if (remaining <= 0) {
      channelSubscriberCounts.delete(channel);
    } else {
      channelSubscriberCounts.set(channel, remaining);
    }
  };
}
