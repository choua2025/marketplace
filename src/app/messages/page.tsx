import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { listConversations } from "@/server/services/chat-read";

function formatRelativeTime(date: Date): string {
  return date.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

export default async function MessagesInboxPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const conversations = await listConversations(actor);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-12">
      <h1 className="text-xl font-bold">ข้อความ</h1>

      {conversations.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">ยังไม่มีการสนทนา</p>
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
                  {conversation.lastMessagePreview ?? "เริ่มการสนทนา"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {conversation.lastMessageAt ? (
                  <span className="text-muted-foreground text-xs">
                    {formatRelativeTime(conversation.lastMessageAt)}
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
