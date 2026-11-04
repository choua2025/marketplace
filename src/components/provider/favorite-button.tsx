"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { addFavoriteAction, removeFavoriteAction } from "@/server/actions/favorite";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  providerId: string;
  initialFavorited: boolean;
  variant?: "icon" | "full";
}

export function FavoriteButton({
  providerId,
  initialFavorited,
  variant = "icon",
}: FavoriteButtonProps) {
  const t = useTranslations("favorites");
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    // Used inside <Link>-wrapped provider cards -- never navigate on click.
    e.preventDefault();
    e.stopPropagation();

    const next = !favorited;
    setFavorited(next);
    startTransition(async () => {
      const result = next
        ? await addFavoriteAction(providerId)
        : await removeFavoriteAction(providerId);
      if (!result.ok) {
        setFavorited(!next);
        return;
      }
      router.refresh();
    });
  }

  if (variant === "full") {
    return (
      <Button type="button" variant="outline" disabled={isPending} onClick={toggle}>
        <Heart className={cn("size-4", favorited && "fill-destructive text-destructive")} />
        {favorited ? t("remove") : t("add")}
      </Button>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={toggle}
      aria-label={favorited ? t("remove") : t("add")}
      aria-pressed={favorited}
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur transition-colors hover:bg-background disabled:opacity-50"
    >
      <Heart
        className={cn(
          "size-4",
          favorited ? "fill-destructive text-destructive" : "text-muted-foreground",
        )}
      />
    </button>
  );
}
