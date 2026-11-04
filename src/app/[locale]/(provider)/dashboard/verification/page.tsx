import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getActor } from "@/server/auth/session";
import { getMyVerification } from "@/server/services/verification";
import { getSignedImageUrl } from "@/server/services/upload";
import { BecomeProviderPrompt } from "@/components/provider/become-provider-prompt";
import { VerificationForm } from "@/components/provider/verification-form";
import { Badge } from "@/components/ui/badge";

export default async function VerificationPage() {
  const locale = await getLocale();
  const actor = await getActor();
  if (!actor) throw redirect({ href: "/login", locale });

  if (actor.role !== "provider") {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <BecomeProviderPrompt />
      </main>
    );
  }

  const [verification, t] = await Promise.all([
    getMyVerification(actor),
    getTranslations("verification"),
  ]);

  const documents = verification
    ? await Promise.all(
        verification.documentKeys.map(async (key) => ({
          key,
          url: await getSignedImageUrl(key),
        })),
      )
    : [];

  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
        {verification ? (
          <Badge
            variant={
              verification.status === "approved"
                ? "default"
                : verification.status === "rejected"
                  ? "destructive"
                  : "secondary"
            }
          >
            {t(`status_${verification.status}`)}
          </Badge>
        ) : null}
      </div>

      {verification?.status === "approved" ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">{t("approvedNote")}</p>
      ) : (
        <>
          {verification?.status === "rejected" && verification.rejectionReason ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {t("rejectionReasonLabel")}: {verification.rejectionReason}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">{t("description")}</p>
          <VerificationForm initialDocuments={documents} initialNote={verification?.note ?? null} />
        </>
      )}
    </main>
  );
}
