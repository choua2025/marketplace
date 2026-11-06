import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getActor } from "@/server/auth/session";
import { getConversationDetail, listMessages } from "@/server/services/chat-read";
import { getSignedImageUrl } from "@/server/services/upload";
import { AppError } from "@/server/lib/errors";
import { loginHref } from "@/lib/login-next";
import { ChatThread } from "@/components/chat/chat-thread";
import { NotInYourAccount } from "@/components/auth/not-in-your-account";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const actor = await getActor();
  const path = `/messages/${conversationId}`;
  if (!actor) throw redirect({ href: loginHref(path), locale: await getLocale() });

  let detail;
  let page;
  try {
    [detail, page] = await Promise.all([
      getConversationDetail(actor, conversationId),
      listMessages(actor, conversationId, {}),
    ]);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      return <NotInYourAccount actor={actor} path={path} />;
    }
    throw error;
  }

  const counterpartyAvatarUrl = await getSignedImageUrl(detail.counterpartyAvatarKey);
  const initialMessages = await Promise.all(
    page.items.map(async (item) => ({
      id: item.id,
      conversationId: item.conversationId,
      senderId: item.senderId,
      body: item.body,
      imageUrl: await getSignedImageUrl(item.imageKey),
      readAt: item.readAt ? item.readAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
    })),
  );

  return (
    <ChatThread
      conversationId={conversationId}
      actorId={actor.id}
      counterpartyName={detail.counterpartyName}
      counterpartyAvatarUrl={counterpartyAvatarUrl}
      initialMessages={initialMessages}
      initialNextCursor={page.nextCursor}
    />
  );
}
