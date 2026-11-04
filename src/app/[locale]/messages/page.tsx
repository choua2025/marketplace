import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { MessageCircle } from "lucide-react";
import { Link, redirect } from "@/i18n/navigation";
import { getActor } from "@/server/auth/session";
import { listConversations } from "@/server/services/chat-read";
import { getSignedImageUrl } from "@/server/services/upload";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";

export default async function MessagesInboxPage() {
  const actor = await getActor();
  if (!actor) throw redirect({ href: "/login", locale: await getLocale() });

  const [conversations, t, format] = await Promise.all([
    listConversations(actor),
    getTranslations("chat"),
    getFormatter(),
  ]);
  const avatarUrls = await Promise.all(
    conversations.map((conversation) => getSignedImageUrl(conversation.counterpartyAvatarKey)),
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6 pb-16">
      <h1 className="text-2xl font-bold tracking-tight">{t("inboxTitle")}</h1>

      {conversations.length === 0 ? (
        <Card className="items-center gap-3 px-4 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MessageCircle className="size-6" />
          </span>
          <p className="text-muted-foreground">{t("empty")}</p>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {conversations.map((conversation, index) => {
              const unread = conversation.unreadCount > 0;
              return (
                <li key={conversation.id}>
                  <Link
                    href={`/messages/${conversation.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
                  >
                    <Avatar className="size-11 shrink-0">
                      <AvatarImage
                        src={avatarUrls[index] ?? undefined}
                        alt={conversation.counterpartyName}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                        {initials(conversation.counterpartyName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn("truncate", unread ? "font-semibold" : "font-medium")}>
                          {conversation.counterpartyName}
                        </p>
                        {conversation.lastMessageAt ? (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {format.dateTime(conversation.lastMessageAt, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-sm",
                            unread ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {conversation.lastMessageIsImage
                            ? t("photoPreview")
                            : (conversation.lastMessagePreview ?? t("startConversation"))}
                        </p>
                        {unread ? (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </main>
  );
}
