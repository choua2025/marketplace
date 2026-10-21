"use client";

import { useRouter } from "@/i18n/navigation";
import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { createBookingAction } from "@/app/[locale]/(customer)/book/[providerId]/actions";
import { uploadFile } from "@/lib/upload-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRICE_UNIT_LABEL: Record<string, string> = {
  job: "ต่องาน",
  hour: "ต่อชั่วโมง",
  day: "ต่อวัน",
};

const MAX_PHOTOS = 5;

interface BookingFormProps {
  providerId: string;
  categories: { slug: string; nameTh: string; icon: string }[];
  basePrice: string;
  priceUnit: "job" | "hour" | "day";
}

export function BookingForm({ providerId, categories, basePrice, priceUnit }: BookingFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? "");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [photoKeys, setPhotoKeys] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const key = await uploadFile(file, "booking");
      setPhotoKeys((keys) => [...keys, key]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "UPLOAD_FAILED");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto(key: string) {
    setPhotoKeys((keys) => keys.filter((k) => k !== key));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const result = await createBookingAction({
      providerId,
      categorySlug,
      startAt: startAt ? new Date(startAt).toISOString() : undefined,
      endAt: endAt ? new Date(endAt).toISOString() : undefined,
      description,
      address,
      photoKeys,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(`/bookings/${result.data.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        ราคาเริ่มต้น {Number(basePrice).toLocaleString()} บาท / {PRICE_UNIT_LABEL[priceUnit]}
      </p>

      <div className="flex flex-col gap-2">
        <Label>หมวดงาน</Label>
        <Select value={categorySlug} onValueChange={setCategorySlug}>
          <SelectTrigger className="h-12 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.nameTh}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="startAt">วันเวลาเริ่มงาน</Label>
          <Input
            id="startAt"
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className="h-12"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="endAt">ถึงเวลา</Label>
          <Input
            id="endAt"
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            className="h-12"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">อธิบายปัญหา</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="อธิบายงานที่ต้องการให้ช่างทำ อย่างน้อย 10 ตัวอักษร"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="address">ที่อยู่ที่ให้บริการ</Label>
        <Textarea
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={2}
          placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>รูปประกอบ (สูงสุด {MAX_PHOTOS} รูป)</Label>
        <div className="flex flex-wrap gap-2">
          {photoKeys.map((key) => (
            <div key={key} className="bg-muted flex items-center gap-1 rounded px-2 py-1 text-xs">
              <span className="max-w-32 truncate">{key.split("/").pop()}</span>
              <button type="button" onClick={() => removePhoto(key)} aria-label="ลบรูปนี้">
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleAddPhoto}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading || photoKeys.length >= MAX_PHOTOS}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <Upload className="size-4" />}
          เพิ่มรูป
        </Button>
      </div>

      <Button
        type="button"
        className="h-12 bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90"
        disabled={submitting || !startAt || !endAt || !description || !address}
        onClick={handleSubmit}
      >
        {submitting ? <Loader2 className="animate-spin" /> : "ส่งคำขอจอง"}
      </Button>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
