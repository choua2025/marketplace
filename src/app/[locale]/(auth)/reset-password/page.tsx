import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  // Better Auth's emailed link checks the token and redirects here with
  // ?token=... (valid) or ?error=INVALID_TOKEN (expired or already used).
  const { token, error } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <ResetPasswordForm token={token} linkError={Boolean(error)} />
    </main>
  );
}
