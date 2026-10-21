"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { becomeProviderAction } from "@/server/actions/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BecomeProviderPrompt() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await becomeProviderAction();
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>ยังไม่ได้เปิดโปรไฟล์ช่าง</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          บัญชีของคุณเป็นลูกค้าอยู่ตอนนี้ กดปุ่มด้านล่างเพื่อเปิดโปรไฟล์ช่างและเริ่มรับงาน
        </p>
        <Button className="h-12" disabled={loading} onClick={handleClick}>
          {loading ? <Loader2 className="animate-spin" /> : "เปลี่ยนเป็นช่าง/ฟรีแลนซ์"}
        </Button>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
