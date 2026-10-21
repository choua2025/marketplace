"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { becomeProviderAction } from "@/server/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Role = "customer" | "provider";
type Step = "enter-phone" | "enter-code";

interface LoginFormProps {
  devEmailLoginEnabled: boolean;
}

export function LoginForm({ devEmailLoginEnabled }: LoginFormProps) {
  const router = useRouter();

  const [role, setRole] = useState<Role>("customer");
  const [step, setStep] = useState<Step>("enter-phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [devEmail, setDevEmail] = useState("");
  const [devPassword, setDevPassword] = useState("");

  async function afterSignedIn() {
    if (role === "provider") {
      await becomeProviderAction();
    }
    router.push("/");
    router.refresh();
  }

  async function handleSendOtp() {
    setError(null);
    setLoading(true);
    const { error: sendError } = await authClient.phoneNumber.sendOtp({ phoneNumber: phone });
    setLoading(false);
    if (sendError) {
      setError(sendError.message ?? "ส่งรหัส OTP ไม่สำเร็จ");
      return;
    }
    setStep("enter-code");
  }

  async function handleVerifyOtp() {
    setError(null);
    setLoading(true);
    const { error: verifyError } = await authClient.phoneNumber.verify({
      phoneNumber: phone,
      code,
    });
    setLoading(false);
    if (verifyError) {
      setError(verifyError.message ?? "รหัส OTP ไม่ถูกต้อง");
      return;
    }
    await afterSignedIn();
  }

  async function handleGoogleLogin() {
    await authClient.signIn.social({ provider: "google", callbackURL: "/" });
  }

  async function handleDevEmailLogin() {
    setError(null);
    setLoading(true);
    const { error: signInError } = await authClient.signIn.email({
      email: devEmail,
      password: devPassword,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message ?? "เข้าสู่ระบบไม่สำเร็จ");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">เข้าสู่ระบบ / สมัครสมาชิก</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          ใช้เบอร์โทรเพื่อเข้าสู่ระบบหรือสมัครสมาชิกใหม่
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">ฉันคือ</legend>
        <RadioGroup
          value={role}
          onValueChange={(value) => setRole(value as Role)}
          className="flex gap-4"
        >
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="customer" /> ลูกค้า
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="provider" /> ช่าง/ฟรีแลนซ์
          </label>
        </RadioGroup>
      </fieldset>

      {step === "enter-phone" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="+66812345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-12"
          />
          <Button
            type="button"
            className="h-12"
            disabled={loading || phone.length < 8}
            onClick={handleSendOtp}
          >
            {loading ? <Loader2 className="animate-spin" /> : "ส่งรหัส OTP"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">รหัส OTP</Label>
          <Input
            id="code"
            type="text"
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-12"
          />
          <Button
            type="button"
            className="h-12"
            disabled={loading || code.length < 4}
            onClick={handleVerifyOtp}
          >
            {loading ? <Loader2 className="animate-spin" /> : "ยืนยันและเข้าสู่ระบบ"}
          </Button>
          <button
            type="button"
            className="text-muted-foreground text-sm underline"
            onClick={() => setStep("enter-phone")}
          >
            เปลี่ยนเบอร์โทร
          </button>
        </div>
      )}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex items-center gap-2">
        <div className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">หรือ</span>
        <div className="bg-border h-px flex-1" />
      </div>

      <Button type="button" variant="outline" className="h-12" onClick={handleGoogleLogin}>
        เข้าสู่ระบบด้วย Google
      </Button>

      {devEmailLoginEnabled ? (
        <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
          <p className="text-muted-foreground text-xs">
            Dev only: เข้าสู่ระบบด้วยอีเมล (บัญชีตัวอย่างจาก db:seed)
          </p>
          <Input
            type="email"
            aria-label="อีเมล"
            placeholder="customer1@changdee.test"
            value={devEmail}
            onChange={(e) => setDevEmail(e.target.value)}
          />
          <Input
            type="password"
            aria-label="รหัสผ่าน"
            placeholder="password123"
            value={devPassword}
            onChange={(e) => setDevPassword(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={handleDevEmailLogin}
          >
            เข้าสู่ระบบ (dev)
          </Button>
        </div>
      ) : null}
    </div>
  );
}
