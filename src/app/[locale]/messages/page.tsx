import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getActor } from "@/server/auth/session";
import { listConversations } from "@/server/services/chat-read";

export default async function MessagesInboxPage() {
  const actor = await getActor();
  if (!actor) throw redirect({ href: "/login", locale: await getLocale() });

  const [conversations, t, format] = await Promise.all([
    listConversations(actor),
    getTranslations("chat"),
    getFormatter(),
  ]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-12">
      <h1 className="text-xl font-bold">{t("inboxTitle")}</h1>

      {conversations.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">{t("empty")}</p>
      ) : (
        <div className="flex flex-col divide-y rounded-lg border">
          {conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/messages/${conversation.id}`}
              className="hover:bg-accent flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{conversation.counterpartyName}</p>
                <p className="text-muted-foreground truncate text-sm">
                  {conversation.lastMessageIsImage
                    ? t("photoPreview")
                    : (conversation.lastMessagePreview ?? t("startConversation"))}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {conversation.lastMessageAt ? (
                  <span className="text-muted-foreground text-xs">
                    {format.dateTime(conversation.lastMessageAt, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                ) : null}
                {conversation.unreadCount > 0 ? (
                  <span className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full text-xs">
                    {conversation.unreadCount}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
