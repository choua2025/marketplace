"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { loginHref } from "@/lib/login-next";
import { Button } from "@/components/ui/button";

/** Signs out, then opens the login page returning to `next` (a locale-less path). */
export function SwitchAccountButton({ next }: { next: string }) {
  const t = useTranslations("wrongAccount");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await authClient.signOut();
    router.push(loginHref(next));
    router.refresh();
  }

  return (
    <Button className="h-12 w-full" disabled={loading} onClick={handleClick}>
      {loading ? <Loader2 className="animate-spin" /> : t("switchAccount")}
    </Button>
  );
}
