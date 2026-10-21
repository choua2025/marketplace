"use client";

import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { startConversationAction } from "@/app/[locale]/messages/actions";
import { Button } from "@/components/ui/button";

export function StartChatButton({ providerId }: { providerId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await startConversationAction(providerId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/messages/${result.data.id}`);
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full max-w-xs"
        disabled={loading}
        onClick={handleClick}
      >
        {loading ? <Loader2 className="animate-spin" /> : <MessageCircle className="size-4" />}
        แชทกับช่างนี้
      </Button>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
