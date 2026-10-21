# ChangDee (ช่างดี) — Project Specification for Claude Code

> วิธีใช้: วางไฟล์นี้ไว้ในโฟลเดอร์โปรเจกต์เปล่าในชื่อ `SPEC.md` แล้วสั่ง Claude Code ว่า
> "อ่าน SPEC.md ให้ครบทุกส่วน แล้วเริ่มทำตามหัวข้อ 'วิธีการทำงาน'"

---

## 1. บทบาทของคุณ

คุณคือ Senior Full-Stack Engineer และ Software Architect ที่มีประสบการณ์ 15 ปี
เคยสร้าง Two-sided Marketplace ที่มีผู้ใช้จริงหลักแสนคน เชี่ยวชาญ PostgreSQL, ระบบจอง,
แชต Real-time, การออกแบบสิทธิ์ผู้ใช้ และความปลอดภัยของข้อมูล
คุณเขียนโค้ดระดับ Production: สะอาด ทดสอบได้ ดูแลรักษาง่าย และไม่ทิ้งงานครึ่งทาง

## 2. ภาพรวมโปรเจกต์

- **ชื่อ:** ChangDee (ช่างดี)
- **ประเภท:** Web App แบบ PWA (ติดตั้งบนมือถือได้เหมือนแอป)
- **แนวคิด:** แพลตฟอร์มเชื่อมลูกค้ากับช่างและฟรีแลนซ์ในพื้นที่ เช่น ช่างแอร์ ช่างไฟ ช่างประปา
  แม่บ้าน ช่างภาพ กราฟิกดีไซเนอร์
- **เป้าหมาย:** ลูกค้าหาช่างที่น่าเชื่อถือและจองงานได้ภายใน 5 นาที
  ช่างได้ช่องทางหางานและสร้างชื่อเสียงจากรีวิว
- **ภาษาในระบบ:** ไทย (ค่าเริ่มต้น) และอังกฤษ ออกแบบให้เพิ่มภาษาอื่นได้ภายหลัง
- **เขตเวลาเริ่มต้น:** Asia/Bangkok

### ผู้ใช้ 3 กลุ่ม

1. **ลูกค้า:** อายุ 25–55 ปี ใช้มือถือเป็นหลัก ต้องการความเร็วและความมั่นใจ
2. **ช่าง/ฟรีแลนซ์:** บางคนไม่ถนัดเทคโนโลยี ต้องใช้งานง่ายมาก ปุ่มใหญ่ ขั้นตอนน้อย
3. **แอดมิน:** ตรวจสอบตัวตนช่าง จัดการข้อร้องเรียน ดูสถิติ (หน้าแอดมินอยู่ในเฟส 2)

## 3. ขอบเขตงาน

### ✅ เฟส 1 — สร้างตอนนี้ (MVP)

1. สมัคร/เข้าสู่ระบบ: เบอร์โทร + OTP และ Google Login เลือกบทบาทลูกค้าหรือช่างตอนสมัคร
2. โปรไฟล์ช่าง: รูป, ชื่อร้าน, หมวดงาน, พื้นที่ให้บริการ, ราคาเริ่มต้น, แกลเลอรีผลงาน, เวลาทำงานรายสัปดาห์
3. ค้นหาช่าง: กรองตามหมวด ระยะทาง คะแนน ราคา แสดงเป็นรายการและแผนที่
4. ระบบจองงาน: เลือกวันเวลา อธิบายปัญหา แนบรูปได้สูงสุด 5 รูป พร้อมสถานะงานครบวงจร
5. แชต Real-time ระหว่างลูกค้ากับช่าง (ข้อความและรูป) พร้อมสถานะ "อ่านแล้ว"
6. รีวิวและคะแนน 1–5 ดาว เฉพาะงานที่เสร็จจริง

### ⏳ เฟส 2–3 — ห้ามสร้างตอนนี้ แต่ออกแบบให้ต่อยอดได้

- ยืนยันตัวตนช่าง (บัตรประชาชน + เซลฟี่), ใบเสนอราคา, Push/LINE Notification, ระบบร้องเรียน
- ชำระเงินผ่าน QR แบบพักเงิน (Escrow), ค่าธรรมเนียมแพลตฟอร์ม, แพ็กเกจโปรโมต, Admin Dashboard

## 4. เทคโนโลยี (กำหนดแล้ว ห้ามเปลี่ยนโดยไม่ถาม)

| ส่วน                | เทคโนโลยี                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Framework           | Next.js (App Router, เวอร์ชันเสถียรล่าสุด) + TypeScript แบบ strict                                                               |
| UI                  | Tailwind CSS + shadcn/ui + lucide-react                                                                                          |
| ฐานข้อมูล           | **PostgreSQL 16** (ไม่ใช้ Supabase) รันด้วย Docker Compose                                                                       |
| ORM / Migration     | Drizzle ORM + drizzle-kit (ใช้ custom SQL migration สำหรับ constraint และ trigger ที่ ORM ทำไม่ได้)                              |
| Authentication      | Better Auth พร้อม plugin เบอร์โทร/OTP และ Google OAuth เก็บ session ใน PostgreSQL                                                |
| SMS OTP             | สร้าง interface `SmsProvider` โหมด dev ให้พิมพ์ OTP ลง console ส่วน production เสียบผู้ให้บริการจริงภายหลัง                      |
| Real-time แชต       | Server-Sent Events (SSE) + PostgreSQL `LISTEN/NOTIFY` (ไม่ต้องมี service เพิ่ม)                                                  |
| เก็บไฟล์            | S3-compatible storage: ใช้ MinIO ใน dev (อยู่ใน docker-compose) และ Cloudflare R2/AWS S3 ใน production อัปโหลดผ่าน presigned URL |
| แผนที่              | Leaflet + OpenStreetMap                                                                                                          |
| ฟอร์มและ Validation | react-hook-form + Zod (ใช้ schema เดียวกันทั้ง client และ server)                                                                |
| หลายภาษา            | next-intl                                                                                                                        |
| ทดสอบ               | Vitest (unit + integration กับ PostgreSQL จริง), Playwright (E2E)                                                                |
| Deploy              | Docker image สำหรับ VPS (แอปต้องรันแบบ long-running server เพราะ SSE และ LISTEN/NOTIFY ใช้กับ serverless ไม่ได้)                 |

ก่อนติดตั้งแพ็กเกจใด ให้ตรวจเอกสารล่าสุดของแพ็กเกจนั้นว่า API ยังเป็นแบบที่คุณจำได้ ถ้าไม่ตรงให้ทำตามเอกสารล่าสุด

## 5. กฎสถาปัตยกรรม (สำคัญมาก)

เพราะไม่มี Row Level Security ของ Supabase **การคุมสิทธิ์ทั้งหมดต้องอยู่ใน Service Layer ฝั่ง server**

```
UI (Server/Client Components)
   ↓ เรียกผ่าน Server Actions หรือ Route Handlers เท่านั้น
Service Layer  src/server/services/*.ts   ← ตรวจสิทธิ์ + business rules ทุกอย่างอยู่ที่นี่
   ↓
Repository / Drizzle  src/server/db/*
   ↓
PostgreSQL  ← ชั้นสุดท้าย: constraint, exclusion, trigger กันข้อมูลผิดแม้โค้ดมีบั๊ก
```

1. **ทุก service function รับ `actor`** (ผู้ใช้จาก session หรือ `null` สำหรับผู้เยี่ยมชม) เป็นพารามิเตอร์แรก และตรวจสิทธิ์ก่อนทำงานทุกครั้ง
2. **ห้าม import Drizzle client ใน component หรือ page โดยตรง** ให้เรียกผ่าน service เท่านั้น ตั้ง ESLint rule (`no-restricted-imports`) บังคับเรื่องนี้
3. **ห้ามรับค่าที่ระบบต้องกำหนดเองจาก client** เช่น `customerId`, `senderId`, `providerId` ของรีวิว, `status`, `rating_avg`, `role` ให้ service ใส่ค่าเหล่านี้จาก session หรือจากฐานข้อมูลเสมอ
4. **ข้อมูลที่ส่งออกไปหน้าเว็บต้องผ่าน DTO** ที่เลือกเฉพาะฟิลด์ที่อนุญาต ห้ามส่ง row ดิบจากฐานข้อมูล
5. **Error มาตรฐาน:** สร้าง class `AppError(code, httpStatus)` ใช้รหัสตามหัวข้อ 7 และแปลงเป็นข้อความไทย/อังกฤษในไฟล์ภาษา
6. **ใช้ transaction** ทุกครั้งที่แก้มากกว่า 1 ตาราง หรือมีการอ่านแล้วเขียนตามเงื่อนไข (ใช้ `SELECT ... FOR UPDATE` เมื่อจำเป็น)
7. **Connection:** แอปใช้ database user ที่ไม่ใช่ superuser มีสิทธิ์เฉพาะ schema ของแอป

## 6. Database Schema

ใช้ `uuid` (gen_random_uuid) เป็น primary key ยกเว้นที่ระบุ ทุกตารางที่แก้ไขได้มี `created_at`, `updated_at` (อัปเดตด้วย trigger)
ตาราง `user`, `session`, `account`, `verification` ของ Better Auth ให้สร้างตามเอกสารของ Better Auth

| ตาราง                 | ฟิลด์หลักและกฎ                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`            | `id` = user id (1:1), `role` enum(customer, provider, admin) ค่าเริ่มต้น customer, `full_name` ≤100, `avatar_key`, `locale` (th/en) — **ไม่มีข้อมูลลับในตารางนี้**                                                                                                                                                                                                                                                                           |
| `profile_contacts`    | `id` (1:1 profiles), `phone` (regex `^\+?[0-9]{8,15}$`), `line_id` ≤50 — เปิดเผยตามกฎข้อ 7.4 เท่านั้น                                                                                                                                                                                                                                                                                                                                        |
| `categories`          | `id` smallint identity, `slug` unique (`^[a-z0-9-]{2,40}$`), `name_th`, `name_en`, `icon`, `sort_order`, `is_active`                                                                                                                                                                                                                                                                                                                         |
| `provider_profiles`   | `id` (1:1 profiles), `display_name` 2–80, `bio` ≤2000, `base_price` numeric(10,2) ≥0, `price_unit` enum(job, hour, day), `latitude`, `longitude` (ต้องมีทั้งคู่หรือไม่มีทั้งคู่), `area_label`, `service_radius_km` 1–200 (ค่าเริ่มต้น 10), `timezone` ค่าเริ่มต้น Asia/Bangkok, `is_active` (ค่าเริ่มต้น false และเปิดได้ต่อเมื่อมีพิกัด) ฟิลด์ที่ระบบจัดการเอง: `is_verified`, `rating_avg` numeric(3,2), `rating_count`, `completed_jobs` |
| `provider_categories` | PK (`provider_id`, `category_id`)                                                                                                                                                                                                                                                                                                                                                                                                            |
| `portfolio_items`     | `provider_id`, `image_key`, `caption` ≤200, `sort_order` สูงสุด 30 รายการต่อช่าง                                                                                                                                                                                                                                                                                                                                                             |
| `availability_rules`  | `provider_id`, `weekday` 0–6 (0 = อาทิตย์), `start_time`, `end_time` (> start), unique(provider_id, weekday, start_time)                                                                                                                                                                                                                                                                                                                     |
| `bookings`            | `customer_id`, `provider_id`, `category_id`, `status` enum(pending, confirmed, in_progress, completed, cancelled), `start_at`, `end_at` (timestamptz, ยาวไม่เกิน 12 ชม.), `description` 10–2000, `address` 5–300, `latitude`, `longitude`, `photo_keys` text[] ≤5, `cancelled_by`, `cancel_reason`, `confirmed_at`, `started_at`, `completed_at`, `cancelled_at`, check `customer_id <> provider_id`                                         |
| `conversations`       | `customer_id`, `provider_id`, `last_message_at`, unique(customer_id, provider_id)                                                                                                                                                                                                                                                                                                                                                            |
| `messages`            | `id` bigint identity (ใช้เป็น cursor ของ infinite scroll), `conversation_id`, `sender_id`, `body` 1–2000, `image_key`, `read_at` ต้องมี body หรือ image อย่างน้อย 1 อย่าง                                                                                                                                                                                                                                                                    |
| `reviews`             | `booking_id` **unique**, `customer_id`, `provider_id`, `rating` 1–5, `comment` ≤1000                                                                                                                                                                                                                                                                                                                                                         |

### สิ่งที่ต้องทำใน custom SQL migration

1. `CREATE EXTENSION btree_gist;`
2. **กันการจองซ้อนระดับฐานข้อมูล:**
   ```sql
   ALTER TABLE bookings ADD CONSTRAINT no_double_booking
     EXCLUDE USING gist (provider_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
     WHERE (status IN ('confirmed', 'in_progress'));
   ```
   ฝั่ง service ต้องดักจับ error code `23P01` แล้วแปลงเป็น `SLOT_TAKEN`
3. Trigger อัปเดต `rating_avg` และ `rating_count` ของช่างเมื่อมีการเพิ่ม/แก้/ลบรีวิว
4. Trigger `pg_notify('chat_<conversation_id>', <message id>)` หลังเพิ่มข้อความ และอัปเดต `conversations.last_message_at`
5. Index สำหรับเส้นทางที่ใช้บ่อย: bookings(customer_id, start_at desc), bookings(provider_id, start_at desc), bookings(provider_id, status), messages(conversation_id, id desc), reviews(provider_id, created_at desc), provider_profiles(is_active, rating_avg desc), provider_categories(category_id)

## 7. Business Rules และ Error Codes

### 7.1 การสมัคร

- สมัครเป็น `customer` หรือ `provider` ได้เท่านั้น **ห้ามมีทางใดที่ผู้ใช้ตั้งตัวเองเป็น `admin`**
- เลือก provider แล้วสร้าง `provider_profiles` อัตโนมัติ (display_name = ชื่อผู้ใช้ หรือ "ช่างใหม่")
- ลูกค้าเปลี่ยนเป็นช่างภายหลังได้ด้วยฟังก์ชัน `becomeProvider`

### 7.2 การสร้างการจอง (ตรวจครบทุกข้อใน transaction เดียว)

| เงื่อนไข                                                                                    | Error code                  |
| ------------------------------------------------------------------------------------------- | --------------------------- |
| ช่างไม่มีอยู่ หรือ `is_active = false`                                                      | `PROVIDER_UNAVAILABLE`      |
| ช่างไม่ได้รับงานหมวดนี้                                                                     | `CATEGORY_NOT_OFFERED`      |
| เวลาเริ่มเร็วกว่า "ตอนนี้ + 1 ชั่วโมง" หรือเกิน 90 วัน                                      | `INVALID_START_TIME`        |
| ช่างตั้งเวลาทำงานไว้ แต่การจองไม่อยู่ในช่วงเวลาเดียวกันของวันนั้น (คิดตาม timezone ของช่าง) | `OUTSIDE_WORKING_HOURS`     |
| ลูกค้ามีคำขอสถานะ pending ครบ 5 รายการแล้ว                                                  | `TOO_MANY_PENDING_BOOKINGS` |

คำขอ pending ที่เวลาทับกัน **ส่งได้** เพราะช่างจะเลือกยืนยันเพียงรายการเดียว

### 7.3 State Machine ของการจอง (เปลี่ยนได้ทางเดียวผ่าน `updateBookingStatus`)

```
pending ──(ช่าง)──▶ confirmed ──(ช่าง)──▶ in_progress ──(ช่าง)──▶ completed
   │                    │
   └──(ทั้งสองฝ่าย)──▶ cancelled ◀──(ทั้งสองฝ่าย)   * ต้องระบุเหตุผลเมื่อยกเลิก
```

- ผู้ที่ไม่ใช่คู่กรณีของการจอง → `BOOKING_NOT_FOUND` (ห้ามบอกว่า "ไม่มีสิทธิ์" เพื่อไม่ให้รู้ว่ามีรายการอยู่)
- การเปลี่ยนสถานะที่ไม่อยู่ในแผนภาพ → `INVALID_TRANSITION`
- ยกเลิกโดยไม่ระบุเหตุผล → `CANCEL_REASON_REQUIRED`
- ยืนยันแล้วเวลาชนกับงานอื่น → `SLOT_TAKEN`
- เมื่อเป็น completed ให้เพิ่ม `completed_jobs` ของช่าง +1 ใน transaction เดียวกัน
- ล็อก row ด้วย `SELECT ... FOR UPDATE` ก่อนตรวจสถานะ

### 7.4 การเปิดเผยข้อมูลติดต่อ

- เบอร์โทรและ LINE ของอีกฝ่ายดูได้ผ่าน `getBookingContact(bookingId)` เท่านั้น
- เปิดเผยได้เมื่อสถานะเป็น confirmed, in_progress หรือ completed มิฉะนั้น → `CONTACT_LOCKED`

### 7.5 การมองเห็นข้อมูล

- โปรไฟล์ช่างที่ active: ทุกคนดูได้ (ไม่รวมเบอร์โทร)
- โปรไฟล์ลูกค้า: เห็นได้เฉพาะตัวเอง, แอดมิน และช่างที่มีการจองหรือแชตด้วยกัน
- การจอง: เห็นได้เฉพาะลูกค้าและช่างของงานนั้น และแอดมิน
- พิกัดช่างในผลค้นหา **ปัดเหลือทศนิยม 3 ตำแหน่ง** (ประมาณ 100 เมตร) เพื่อไม่ให้เปิดเผยที่อยู่บ้าน

### 7.6 การค้นหา (`searchProviders`)

- พารามิเตอร์: category slug, lat, lng, maxKm (ค่าเริ่มต้น 25, สูงสุด 200), minRating, maxPrice, sort (recommended | distance | rating | price), limit (สูงสุด 50), offset
- คำนวณระยะทางด้วยสูตร Haversine ใน SQL และแสดงเฉพาะช่างที่ระยะทาง ≤ maxKm และ ≤ service_radius_km ของช่าง
- การเรียง `recommended`: ช่างที่ยืนยันตัวตนก่อน แล้วตามด้วยคะแนนแบบถ่วงน้ำหนัก `(rating_avg × rating_count + 4.0 × 3) / (rating_count + 3)` จากนั้นจึงเรียงตามระยะทาง

### 7.7 รีวิว

- รีวิวได้เฉพาะลูกค้าของงาน และงานต้อง completed ภายใน 30 วัน
- 1 งาน = 1 รีวิว (`REVIEW_EXISTS`) และแก้ไขได้ภายใน 7 วัน
- `provider_id` ของรีวิวต้องดึงจากการจอง ห้ามรับจาก client

### 7.8 แชต

- `startConversation(providerId)` ต้อง idempotent (เรียกซ้ำได้ conversation เดิม) และห้ามแชตกับตัวเอง
- ส่ง/อ่านข้อความได้เฉพาะคู่สนทนา `sender_id` มาจาก session เสมอ
- จำกัด 20 ข้อความต่อนาทีต่อผู้ใช้ → `RATE_LIMITED`
- `markConversationRead` ตั้ง `read_at` ให้ข้อความที่อีกฝ่ายส่งมา
- SSE endpoint `/api/conversations/[id]/stream`: ตรวจสิทธิ์ก่อนเปิด stream, รับ NOTIFY แล้วดึงข้อความผ่าน service (ห้ามส่งเนื้อหาข้อความใน payload ของ NOTIFY), ส่ง heartbeat ทุก 25 วินาที, ใช้ connection สำหรับ LISTEN ร่วมกัน 1 connection ต่อ process
- โหลดข้อความเก่าแบบ cursor (`id < cursor`) ครั้งละ 30 ข้อความ

### 7.9 การอัปโหลดไฟล์

- ขั้นตอน: ขอ presigned URL จาก server → อัปโหลดตรงไปยัง storage → ส่ง key กลับมาบันทึก
- อนุญาตเฉพาะ image/jpeg, image/png, image/webp
- ขนาดสูงสุด: avatar 2MB, ไฟล์อื่น 5MB
- Key ต้องมีรูปแบบ `{bucket}/{ownerId หรือ conversationId}/{uuid}.{ext}` และ server ต้องตรวจว่า key ที่ client ส่งกลับมาขึ้นต้นด้วย prefix ของผู้ใช้คนนั้นจริง
- รูปการจองและรูปในแชตเป็นไฟล์ส่วนตัว ให้แสดงผ่าน signed URL อายุ 10 นาที เฉพาะผู้มีสิทธิ์

## 8. หน้าที่ต้องมี

| ผู้เยี่ยมชม                                             | ลูกค้า                                                  | ช่าง                                             |
| ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| หน้าแรก + เลือกหมวด                                     | ฟอร์มจอง (ปฏิทินแสดงเฉพาะช่วงเวลาที่ช่างรับงาน, แนบรูป) | Dashboard: งานวันนี้ + คำขอใหม่                  |
| ค้นหา + ตัวกรอง + สลับรายการ/แผนที่                     | รายการการจองของฉัน (แท็บตามสถานะ)                       | รายละเอียดคำขอ (ยืนยัน/ปฏิเสธ/เริ่มงาน/งานเสร็จ) |
| โปรไฟล์ช่าง `/p/[id]` (SSR + JSON-LD แบบ LocalBusiness) | รายละเอียดงาน + timeline สถานะ                          | แก้ไขโปรไฟล์ + หมวดงาน + แกลเลอรีผลงาน           |
| เข้าสู่ระบบ / สมัคร                                     | กล่องแชต + หน้าแชต                                      | ตั้งเวลาทำงานรายสัปดาห์                          |
|                                                         | เขียนรีวิว                                              | กล่องแชต + หน้าแชต                               |

ทุกหน้าต้องมีสถานะ loading (skeleton), empty และ error ที่ออกแบบไว้แล้ว

## 9. ดีไซน์

- สไตล์: น่าเชื่อถือ สะอาดตา เป็นมิตร คล้ายแอปบริการระดับสากล
- สีหลัก `#2563EB` (น้ำเงิน = ความน่าเชื่อถือ), สีเน้น `#F59E0B` (ส้ม = ปุ่มจอง/ปุ่มสำคัญ)
- ฟอนต์: Noto Sans Thai (ผ่าน `next/font`)
- รองรับ Dark Mode และกำหนดสีเป็น CSS variables
- Mobile-first: ปุ่มหลักสูงอย่างน้อย 48px และวางในระยะที่นิ้วโป้งเอื้อมถึง
- โปรไฟล์ช่างต้องเห็น 3 อย่างโดยไม่ต้องเลื่อน: **คะแนนรีวิว, ป้ายยืนยันตัวตน, ปุ่มจอง**
- หน้าของช่างใช้ภาษาง่าย ไอคอนชัด ขั้นตอนน้อยที่สุด

## 10. มาตรฐานคุณภาพ

- **Responsive:** 360px – 1920px
- **Performance:** Lighthouse 90+ ทุกหมวด, รูปผ่าน `next/image`, lazy load, หน้าค้นหาตอบกลับไม่เกิน 2 วินาที
- **Accessibility:** WCAG 2.1 AA (contrast, label, keyboard, focus ring, aria)
- **SEO:** metadata, Open Graph, sitemap.xml, robots.txt, โปรไฟล์ช่างทุกหน้าเป็น SSR
- **PWA:** manifest, icons, หน้า offline พื้นฐาน
- **Code Quality:** TypeScript strict (ห้ามใช้ `any`), ESLint + Prettier ผ่าน, ตั้งชื่อสื่อความหมาย, ไฟล์ละไม่เกิน ~300 บรรทัด

## 11. Security Checklist (ต้องผ่านทุกข้อ)

- [ ] ตรวจ input ด้วย Zod ที่ server ทุกจุด แม้ client ตรวจแล้ว
- [ ] Query ทุกตัวผ่าน Drizzle/parameterized ห้ามต่อ string เป็น SQL
- [ ] Server Actions และ Route Handlers ตรวจ session และสิทธิ์ทุกตัว
- [ ] Cookie ของ session เป็น `httpOnly`, `secure`, `sameSite=lax`
- [ ] Rate limit: ขอ OTP (3 ครั้ง/10 นาที/เบอร์ และ 10 ครั้ง/ชั่วโมง/IP), เข้าสู่ระบบ, สร้างการจอง, ส่งข้อความ
- [ ] ตั้ง Security headers: CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy
- [ ] ไม่มี secret ในโค้ด ทุกค่าอยู่ใน `.env` และมี `.env.example` ครบ ตรวจ env ตอนเริ่มแอปด้วย Zod
- [ ] Log ห้ามมีเบอร์โทร OTP หรือ token
- [ ] Error ที่ส่งให้ผู้ใช้ห้ามเปิดเผย stack trace หรือรายละเอียดฐานข้อมูล

## 12. การทดสอบ (บังคับ)

### Integration tests (Vitest + PostgreSQL จริงใน Docker, ล้างข้อมูลทุก test)

ต้องมีอย่างน้อยกรณีเหล่านี้ และผ่านทั้งหมด:

1. สมัครโดยแอบส่ง role = admin → ได้ customer
2. ผู้เยี่ยมชมค้นหาได้ ตัวกรองหมวดถูกต้อง และไม่เห็นโปรไฟล์ลูกค้า
3. ลูกค้าเปลี่ยน role ตัวเองไม่ได้ / แก้คะแนนช่างไม่ได้ / อ่านเบอร์ช่างตรง ๆ ไม่ได้
4. สร้างการจองสำเร็จได้สถานะ pending ส่วนการส่ง status มาเองถูกเพิกเฉยหรือถูกปฏิเสธ
5. `CATEGORY_NOT_OFFERED`, `OUTSIDE_WORKING_HOURS` (วันหยุดและเลยเวลาปิด), `INVALID_START_TIME`
6. ก่อนยืนยันได้ `CONTACT_LOCKED` และหลังยืนยันเห็นเบอร์
7. ลูกค้ายืนยันงานตัวเองไม่ได้ (`INVALID_TRANSITION`) / ลูกค้าคนอื่นเห็นหรือยกเลิกไม่ได้ (`BOOKING_NOT_FOUND`)
8. Pending ทับเวลากันได้ แต่ยืนยันรายการที่สองได้ `SLOT_TAKEN`
9. **ยืนยันพร้อมกัน 2 รายการด้วย `Promise.all` → สำเร็จเพียง 1 รายการเท่านั้น**
10. รีวิวก่อนงานเสร็จไม่ได้ / รีวิวซ้ำไม่ได้ / คนอื่นรีวิวแทนไม่ได้ / คะแนนเฉลี่ยของช่างอัปเดต
11. แชต: idempotent, คนนอกอ่านและส่งไม่ได้, ปลอม sender ไม่ได้, mark read ทำงาน, ส่งข้อความที่ 21 ภายใน 1 นาทีได้ `RATE_LIMITED`
12. อัปโหลด: ขอ URL ไปโฟลเดอร์คนอื่นไม่ได้ และบันทึก key ที่ไม่ใช่ของตัวเองไม่ได้
13. คำขอ pending ที่ 6 ได้ `TOO_MANY_PENDING_BOOKINGS`

### E2E (Playwright, ขนาดจอมือถือ)

- Flow A: ลูกค้าค้นหา → เปิดโปรไฟล์ → จอง → (ช่างยืนยัน) → เห็นเบอร์ → (ช่างกดเสร็จ) → รีวิว
- Flow B: ช่างล็อกอิน → เห็นคำขอใหม่ → แชตตอบลูกค้า (อีกแท็บเห็นข้อความแบบ real-time) → ยืนยัน → เริ่มงาน → งานเสร็จ

## 13. ข้อมูลตัวอย่าง (seed) สำหรับ dev

- หมวด 6 หมวด: air-conditioner (ช่างแอร์), electrician (ช่างไฟฟ้า), plumber (ช่างประปา), cleaning (แม่บ้าน/ทำความสะอาด), photographer (ช่างภาพ), graphic-design (กราฟิกดีไซน์)
- ช่าง 10 คนกระจายรอบกรุงเทพฯ และปริมณฑล มีชื่อร้านและคำอธิบายภาษาไทยที่สมจริง ราคาหลากหลาย บางคนมีมากกว่า 1 หมวด 4 คนมีป้ายยืนยันตัวตน และทุกคนทำงานจันทร์–เสาร์ 08:00–18:00
- ลูกค้า 2 คน
- งานที่เสร็จแล้วพร้อมรีวิว 1–4 รายการต่อช่าง (คะแนน 3–5) เพื่อให้หน้าค้นหามีข้อมูลจริง
- บัญชี: `customer1@changdee.test`, `customer2@changdee.test`, `provider1..10@changdee.test` รหัสผ่าน `password123` (เปิดล็อกอินด้วยอีเมลเฉพาะ `NODE_ENV=development`)
- คำสั่ง `pnpm db:seed` ต้องรันซ้ำได้โดยไม่ error

## 14. สิ่งที่ต้องส่งมอบ

- `docker-compose.yml`: postgres:16, minio และ service สร้าง bucket อัตโนมัติ
- `Dockerfile` แบบ multi-stage สำหรับ production (Next.js output: standalone)
- `.env.example` พร้อมคำอธิบายทุกตัวแปร
- Scripts ใน `package.json`: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `db:generate`, `db:migrate`, `db:seed`, `db:reset`
- `README.md` ภาษาไทย: ติดตั้ง, รัน, ทดสอบ, deploy บน VPS (Docker + Nginx + HTTPS + การตั้งค่าให้ SSE ทำงานผ่าน Nginx)
- `docs/ARCHITECTURE.md`: ER diagram (Mermaid), แผนภาพ state machine, การคุมสิทธิ์ และรายการ error codes
- GitHub Actions: lint + typecheck + test (มี service postgres)

## 15. โครงสร้างโฟลเดอร์ (แนวทาง)

```
changdee/
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── (public)/  page.tsx · search/ · p/[id]/
│   │   │   ├── (auth)/    login/
│   │   │   ├── (customer)/ book/[providerId]/ · bookings/ · bookings/[id]/
│   │   │   ├── (provider)/ dashboard/ · dashboard/profile/ · dashboard/schedule/
│   │   │   └── messages/ · messages/[conversationId]/
│   │   ├── api/  auth/[...all]/ · conversations/[id]/stream/ · uploads/presign/
│   │   └── manifest.ts · sitemap.ts · robots.ts
│   ├── components/  ui/ · booking/ · chat/ · provider/ · search/ · layout/
│   ├── server/
│   │   ├── db/        schema.ts · client.ts · migrations/ · seed.ts
│   │   ├── services/  booking.ts · provider.ts · search.ts · chat.ts · review.ts · upload.ts · profile.ts
│   │   ├── auth/      auth.ts · session.ts
│   │   ├── realtime/  pg-listener.ts
│   │   ├── storage/   s3.ts
│   │   ├── sms/       provider.ts · console-provider.ts
│   │   └── lib/       errors.ts · rate-limit.ts · env.ts
│   ├── lib/validations/   (Zod schemas ใช้ร่วม client/server)
│   └── hooks/  useChatStream.ts
├── messages/  th.json · en.json
├── tests/  integration/ · e2e/ · helpers/
├── docs/ARCHITECTURE.md
├── docker-compose.yml · Dockerfile · .env.example · README.md
```

## 16. วิธีการทำงาน

1. **อ่านเอกสารนี้ให้ครบ** แล้วถามคำถามที่จำเป็นจริง ๆ ไม่เกิน 5 ข้อ ถ้าไม่มีคำถามให้ข้ามไปข้อ 2
2. **เขียน `PLAN.md`** สรุปแผนแบ่งเป็น milestone พร้อมระบุสิ่งที่คุณตัดสินใจเองนอกเหนือจากเอกสารนี้ **แล้วหยุดรอให้ผมอนุมัติ**
3. หลังอนุมัติ ให้ทำตามลำดับ milestone นี้ โดยทุก milestone ต้องผ่าน `lint`, `typecheck`, `test` ก่อนขึ้น milestone ถัดไป และ commit แยกทุก milestone
   - **M0** ตั้งโปรเจกต์, Docker Compose, env validation, ESLint/Prettier, CI
   - **M1** Schema + custom SQL migration + seed + integration tests ของ database constraint
   - **M2** Auth (OTP + Google + อีเมลสำหรับ dev), session, หน้าเข้าสู่ระบบ/สมัคร, เลือกบทบาท
   - **M3** โปรไฟล์ช่าง + อัปโหลดรูป + เวลาทำงาน
   - **M4** ค้นหา + แผนที่ + หน้าโปรไฟล์สาธารณะ (SSR/SEO)
   - **M5** ระบบจอง + state machine + การเปิดเผยเบอร์ + หน้าการจองทั้งสองฝั่ง
   - **M6** แชต real-time (SSE + LISTEN/NOTIFY) + รูปในแชต + อ่านแล้ว
   - **M7** รีวิว + คะแนน
   - **M8** PWA, i18n อังกฤษ, Dark Mode, ปรับ Lighthouse/Accessibility, E2E, README, ARCHITECTURE, Dockerfile
4. จบแต่ละ milestone ให้สรุปสั้น ๆ: ทำอะไรไปบ้าง, ไฟล์หลักที่เกี่ยวข้อง, วิธีลองใช้ และปัญหาที่เจอ แล้วทำ milestone ถัดไปต่อเลย **หยุดถามเฉพาะเมื่อ** ต้องตัดสินใจที่ขัดกับเอกสารนี้ ต้องใช้ข้อมูลที่ผมเท่านั้นให้ได้ (เช่น API key จริง) หรือแก้ปัญหาเดิมไม่ได้หลังลอง 2 วิธีแล้ว

### กฎการเขียนโค้ด

- โค้ดต้องสมบูรณ์และรันได้จริง **ห้ามใช้ placeholder, `TODO` ที่ทำให้ฟีเจอร์ใช้ไม่ได้ หรือ mock ที่ปิดบังว่ายังไม่ได้ทำ**
- ห้ามแก้ test เพื่อให้ผ่าน ถ้า test ผิดจริงให้อธิบายเหตุผลก่อนแก้
- ห้ามปิด TypeScript/ESLint rule เพื่อเลี่ยง error
- ถ้าสิ่งที่ผมสั่งในเอกสารนี้มีจุดบกพร่องหรือมีวิธีที่ดีกว่าชัดเจน ให้บอกพร้อมเหตุผล แต่ห้ามเปลี่ยนเองโดยไม่ถาม

### รูปแบบการสื่อสาร

- อธิบายเป็นภาษาไทย กระชับ ตรงประเด็น
- คอมเมนต์ในโค้ด, ชื่อตัวแปร และ commit message เป็นภาษาอังกฤษ (ใช้ Conventional Commits)
