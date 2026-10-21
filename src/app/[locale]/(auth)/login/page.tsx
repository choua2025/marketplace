import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <LoginForm devEmailLoginEnabled={process.env.NODE_ENV !== "production"} />
    </main>
  );
}
