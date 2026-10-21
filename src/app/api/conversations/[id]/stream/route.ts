import { getActor } from "@/server/auth/session";
import { AppError } from "@/server/lib/errors";
import { assertConversationParty, getMessageById } from "@/server/services/chat";
import { getSignedImageUrl } from "@/server/services/upload";
import { subscribeToConversation } from "@/server/realtime/pg-listener";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

/**
 * SSE endpoint (SPEC.md section 7.8). Auth + membership check happens
 * before the stream opens; the Postgres NOTIFY payload only ever carries a
 * message id, so every delivery re-fetches through the service and the DB
 * query is naturally scoped to this conversation -- no re-auth needed per
 * message, but no raw NOTIFY payload ever reaches the client either.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await params;
  const actor = await getActor();
  if (!actor) return new Response("Unauthorized", { status: 401 });

  try {
    await assertConversationParty(actor, conversationId);
  } catch (error) {
    if (error instanceof AppError) return new Response(error.code, { status: error.httpStatus });
    throw error;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      function send(event: string, data: unknown) {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      const heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, HEARTBEAT_MS);

      const unsubscribe = await subscribeToConversation(conversationId, async (messageId) => {
        const message = await getMessageById(Number(messageId));
        if (!message) return;
        const imageUrl = await getSignedImageUrl(message.imageKey);
        send("message", { ...message, imageUrl });
      });

      function cleanup() {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed by the client disconnecting
        }
      }

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
