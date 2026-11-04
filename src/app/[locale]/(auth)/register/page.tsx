import { RegisterForm } from "@/components/auth/register-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <RegisterForm initialRole={role === "provider" ? "provider" : "customer"} />
    </main>
  );
}
