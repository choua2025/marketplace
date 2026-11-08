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

  // The stream can end three ways: the request is aborted, the runtime
  // cancels the stream (client gone -- not always reported as an abort), or a
  // write fails because the stream is already closed. All of them stop the
  // heartbeat and the Postgres subscription exactly once.
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;

  function cleanup() {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe?.();
    try {
      streamController?.close();
    } catch {
      // already closed by the client disconnecting
    }
  }

  function write(chunk: string) {
    if (closed || !streamController) return;
    try {
      streamController.enqueue(encoder.encode(chunk));
    } catch {
      cleanup();
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      streamController = controller;
      request.signal.addEventListener("abort", cleanup);

      heartbeat = setInterval(() => write(`: heartbeat\n\n`), HEARTBEAT_MS);

      const stop = await subscribeToConversation(conversationId, async (messageId) => {
        const message = await getMessageById(Number(messageId));
        if (!message) return;
        const imageUrl = await getSignedImageUrl(message.imageKey);
        write(`event: message\ndata: ${JSON.stringify({ ...message, imageUrl })}\n\n`);
      });

      // The client may have left while we were subscribing.
      if (closed || request.signal.aborted) {
        stop();
        cleanup();
        return;
      }
      unsubscribe = stop;
    },
    cancel() {
      cleanup();
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
