import { redirect, notFound } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { getPublicProviderProfile } from "@/server/services/provider";
import { AppError } from "@/server/lib/errors";
import { BookingForm } from "@/components/booking/booking-form";

export default async function BookProviderPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  const actor = await getActor();
  if (!actor) redirect("/login");

  let provider;
  try {
    provider = await getPublicProviderProfile(actor, providerId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  if (actor.role !== "customer") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 text-center">
        <p className="text-muted-foreground">เฉพาะบัญชีลูกค้าเท่านั้นที่จองงานได้</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-12">
      <h1 className="text-2xl font-bold">จองงานกับ {provider.displayName}</h1>
      <BookingForm
        providerId={provider.id}
        categories={provider.categories}
        basePrice={provider.basePrice}
        priceUnit={provider.priceUnit}
      />
    </main>
  );
}
