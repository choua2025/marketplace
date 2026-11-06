import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/login-next";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <LoginForm next={safeNextPath(next) ?? undefined} />
    </main>
  );
}
