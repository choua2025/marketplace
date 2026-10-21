# PLAN.md — ChangDee (ช่างดี)

> อ่าน `SPEC.md` ครบทุกส่วนแล้ว ไม่มีคำถามที่จำเป็นต้องถามก่อนเริ่ม (ตามเงื่อนไขในหัวข้อ 16 ข้อ 1)
> เรื่องที่ปกติต้องถาม เช่น Google OAuth Client ID/Secret จริง, โดเมน/VPS จริงสำหรับ deploy
> ไม่กระทบแผนงานหรือโครงสร้างโค้ด จึงใส่เป็น placeholder ใน `.env.example` และ README แทน
> ผู้ใช้เติมค่าจริงได้เองภายหลังโดยไม่ต้องแก้โค้ด

สภาพแวดล้อมที่ตรวจแล้วว่าพร้อมใช้งานบนเครื่องนี้: Node v24.11.0, pnpm 12.14.0, Docker 28.5.1,
Docker Compose v2.40.3, Git 2.51.2 — เพียงพอสำหรับทุก milestone

## สิ่งที่ตัดสินใจเองนอกเหนือจาก SPEC.md (ระบุเหตุผล)

1. **Package manager:** ใช้ pnpm (single package, ไม่ทำ monorepo) — SPEC อ้าง script แบบ `pnpm db:seed` อยู่แล้ว
2. **Git:** โฟลเดอร์นี้ยังไม่ใช่ git repo จะรัน `git init` ใน M0 และ commit แยกทุก milestone ตามที่ SPEC กำหนด
   แต่ **จะไม่ push ไป remote ใด ๆ** จนกว่าผู้ใช้จะสั่งและระบุ remote เอง
3. **เวอร์ชันแพ็กเกจ:** จะตรวจเอกสารล่าสุดของแต่ละแพ็กเกจตอนติดตั้งจริงใน M0/M2/M6/M9 (ตามที่ SPEC หัวข้อ 4 กำหนด)
   ไม่ใช้เวอร์ชันที่จำจาก training data ตรง ๆ
4. **Database สำหรับ integration test:** ใช้ Postgres container เดียวกับ dev แต่คนละ database name
   (`changdee` กับ `changdee_test`) เพื่อไม่ต้องเพิ่ม service ใน docker-compose แต่ยังแยกข้อมูลสนิท
   แต่ละ test ล้างข้อมูลด้วย `TRUNCATE ... CASCADE` ในลำดับที่ปลอดภัยกับ foreign key
5. **Rate limiting (OTP, login, booking, message):** เก็บ state ใน-memory ต่อ process (ไม่ใช้ Redis เพิ่ม)
   เหตุผล: แอป deploy เป็น long-running single container บน VPS ตาม SPEC หัวข้อ 4/14 ไม่มีการ scale
   แนวนอนหลายอินสแตนซ์ใน MVP ถ้าในอนาคตต้อง scale ค่อยย้ายไป Postgres-backed หรือ Redis (จะระบุ TODO
   ในเอกสาร ARCHITECTURE.md ว่าเป็น known limitation ไม่ใช่ TODO ในโค้ดที่ทำให้ฟีเจอร์พัง)
6. **Admin role ใน service layer:** แม้หน้า UI ของแอดมินจะยังไม่สร้าง (เฟส 2) แต่ permission check ที่เกี่ยวกับ
   admin (เช่น เห็นโปรไฟล์ลูกค้า, เห็นการจองทุกรายการ) จะเขียนไว้ใน service layer ตั้งแต่ตอนนี้เพื่อให้ตรงกับ
   schema/business rules ใน SPEC หัวข้อ 7.5 — ไม่มีทางสมัคร/ล็อกอินเป็น admin ได้ (ตาม 7.1), ต้อง insert ตรงใน
   DB เองถ้าต้องการทดสอบ ไม่รวมอยู่ใน seed script
7. **Storage abstraction:** เขียน interface กลาง (`src/server/storage/s3.ts`) ครอบ `@aws-sdk/client-s3` +
   presigned URL เดียวกันทั้ง MinIO (dev) และ R2/S3 (prod) ต่างกันแค่ env (`endpoint`, `forcePathStyle`)
8. **SSE/LISTEN connection:** ทำ singleton pg client สำหรับ LISTEN ต่อ process ตาม SPEC หัวข้อ 7.8 โดยใช้ Node
   `EventEmitter` ภายในกระจาย event ไปยังทุก SSE connection ที่เปิดอยู่ในหน่า process เดียวกัน (ไม่ต้องมี pub/sub
   เพิ่มเพราะ deploy เป็น container เดียว)
9. **CI:** จะเขียน GitHub Actions workflow (lint/typecheck/test + postgres service) ไว้ใน `.github/workflows/`
   แต่จะไม่สร้าง/เชื่อม GitHub repo จริงให้ จนกว่าผู้ใช้จะขอ

**อัปเดตจาก M0 — MinIO ใช้ไม่ได้แล้ว:** official MinIO Docker image ถูกลบออกจากทุก registry ที่ลองแล้ว
(repo archived เม.ย. 2026, community edition เหลือแต่ source) ยืนยันด้วยการ `docker pull` จริงจาก Docker Hub,
quay.io, Bitnami ไม่ได้ทั้งหมด **เปลี่ยนไปใช้ Garage แทนในฐานะ dev-only S3-compatible emulator** (ถามผู้ใช้แล้ว)
Production ยังใช้ Cloudflare R2/AWS S3 เหมือนเดิมตาม SPEC ไม่กระทบโค้ดแอป กระทบแค่ docker-compose

**เพิ่มจาก M1:**

- **ลบ package `server-only` ออก:** ของจริง throw ไม่มีเงื่อนไขนอก Next bundler ทำให้ CLI script
  (`db:seed`, `db:reset` ผ่าน tsx) import `src/server/db/client` ไม่ได้ ใช้ ESLint
  `no-restricted-imports` (ที่ SPEC กำหนดไว้แล้ว) เป็นตัวบังคับหลักเพียงตัวเดียวแทน
- **`src/server/lib/env.ts` โหลด `.env` เอง** ผ่าน `process.loadEnvFile(".env")` (try/catch เผื่อไม่มีไฟล์)
  เพราะ Next.js โหลด .env ให้อัตโนมัติ แต่ CLI script ที่รันผ่าน tsx และ Vitest ไม่โหลดให้
- **Integration test รันกับ Postgres จริงเสมอ** ผ่าน Vitest `globalSetup` ที่ apply migration ให้
  `changdee_test` อัตโนมัติก่อนรัน test ทั้งหมด (`pnpm test` ต้อง `docker compose up` ก่อนเสมอ)
- **Better Auth core schema (user/session/account/verification) generate ไว้แล้วใน M1** ผ่าน
  `npx auth generate` ส่วน plugin เบอร์โทร/OTP และ Google OAuth (ที่จะเพิ่มคอลัมน์ เช่น phoneNumber ใน user)
  จะ wiring และ regenerate schema อีกครั้งใน M2 ตามที่ SPEC แบ่ง milestone ไว้

**เพิ่มจาก M2:**

- **หน้าเว็บยังไม่มี `[locale]` segment** (ถามผู้ใช้แล้ว เลือกสร้างแบบไม่มี locale ไปก่อน) SPEC หัวข้อ 15
  ให้ path เป็น `src/app/[locale]/...` แต่ next-intl จริง ๆ เพิ่งเข้ามา M8 — หน้า login ตอนนี้จึงอยู่ที่
  `src/app/(auth)/login` ตรง ๆ ไม่มี `/th` หรือ `/en` นำหน้า **M8 ต้องย้ายทุก page เข้า `[locale]`**
  และอัปเดต Link/redirect ทั้งหมดให้มี locale prefix ตอนเพิ่ม next-intl
- **Role selection ตอนสมัครใช้งานได้เต็มที่เฉพาะ flow เบอร์โทร/OTP:** กด "ช่าง/ฟรีแลนซ์" แล้วระบบจะเรียก
  `becomeProvider()` ให้อัตโนมัติทันทีหลัง verify OTP สำเร็จ ส่วน Google/dev email สมัครใหม่จะได้ role
  `customer` เสมอก่อน (ตาม Better Auth hook) แล้วไปกด "เปลี่ยนเป็นช่าง" เองทีหลังได้ (หน้านี้จะมีใน M3)
  เหตุผล: role ที่เลือกไว้ในฟอร์มจะหายไปตอน redirect ไป Google OAuth แล้วกลับมา ถ้าจะรองรับ Google ด้วย
  ต้องส่ง role ผ่าน query param ของ callbackURL เพิ่ม ซึ่งยังไม่ทำตอนนี้เพื่อไม่ให้ scope บวมเกินจำเป็น
- **Vitest ต้องรัน test file แบบ sequential (`fileParallelism: false`):** หลายไฟล์ integration test
  ใช้ฐานข้อมูล `changdee_test` เดียวกันและ truncate ทุก test ถ้ารันพร้อมกันจะชนกัน (เจอจริงตอนเพิ่ม
  `tests/integration/auth.test.ts` คู่กับไฟล์ M1 แล้ว test หลุดแบบสุ่ม)
- **`emailAndPassword.enabled` เช็ค `NODE_ENV !== "production"`** ไม่ใช่ `=== "development"` ตรงตัวตาม
  คำใน SPEC หัวข้อ 13 เพราะถ้าเช็คตรงตัว จะปิดใช้งานใน `NODE_ENV=test` ด้วย ทำให้ integration test ของ
  บัญชี seed (email+password) รันใน CI ไม่ได้เลย — ตีความว่า "ไม่ใช่ production" คือเจตนาจริงของ SPEC

**เพิ่มจาก M3:**

- **แก้บั๊กจาก M1: `portfolio_items` ไม่มี unique constraint** ทำให้รัน `pnpm db:seed` ซ้ำโดยไม่ `db:reset`
  ก่อนได้แถวซ้ำ (เจอจริงตอน smoke test M3 — มี 2 แถวต่อช่างทั้งที่ seed ควร idempotent) เพิ่ม
  `unique(provider_id, image_key)` ใน migration ใหม่ และ dedupe ข้อมูลเก่าใน dev DB ก่อน apply
- **รูปภาพทั้งหมด (avatar/portfolio/booking/chat) ใช้ signed URL เสมอ** ไม่ทำ public-read bucket policy
  แม้ SPEC หัวข้อ 7.9 จะเจาะจงคำว่า "private" ไว้แค่ booking/chat — เหตุผล: Garage ตั้ง policy แบบ
  per-prefix (เช่น public แค่ avatars/) ไม่ได้ง่ายเท่า whole-bucket, จึงให้ avatar/portfolio ใช้ signed URL
  อายุยาวกว่า (1 ชม.) ส่วน booking/chat ใช้ 10 นาทีตาม SPEC ตรงตัว ผลลัพธ์ต่อผู้ใช้เหมือนกัน (ดูได้)
  แต่ bucket ยังล็อกไว้ทั้งหมดเหมือนเดิม
- **บังคับ max-size จริงด้วยการ sign `ContentLength`** ไม่ใช่แค่เช็คตอน presign แล้วหวังว่า client ซื่อสัตย์
  — ทดสอบจริงแล้วว่า Garage ปฏิเสธ request ที่ขนาดไม่ตรงกับที่ sign ไว้ (403 Invalid signature)
- **ต้องตั้ง `requestChecksumCalculation: "WHEN_REQUIRED"` บน S3Client** AWS SDK v3 เวอร์ชันใหม่ (≥3.729)
  default เป็น `WHEN_SUPPORTED` ซึ่งแอบใส่ checksum header เปล่าๆใน presigned PUT URL ทำให้ Garage/MinIO
  ปฏิเสธการอัปโหลดทุกครั้งด้วย `InvalidDigest` — เจอจาก GitHub issue ตรงๆ ก่อนเขียนโค้ดจริง

**เพิ่มจาก M4:**

- **หน้า `/search` และ `/p/[id]` ยังไม่มี `[locale]`** เช่นเดียวกับที่ตกลงไว้ตั้งแต่ M2 — ย้ายเข้า `[locale]`
  พร้อมกันหมดใน M8
- **ปุ่ม "จองงานกับช่างนี้" บนหน้าโปรไฟล์ชี้ไป `/book/[id]` ซึ่งยังไม่มีหน้าจริง (จะ 404) จนกว่าจะถึง M5**
  เลือกใส่ปุ่มไว้ตามโครงที่ SPEC หัวข้อ 9 กำหนด (ต้องเห็นปุ่มจองโดยไม่ต้องเลื่อน) ดีกว่าตัดออกไปเฉยๆ
  แต่ไม่ได้ปลอมว่าใช้งานได้แล้ว — ระบบจองจริงจะมาทำให้ลิงก์นี้ใช้งานได้ใน M5
- **แก้บั๊กอีกตัวจาก M1 ที่เจอตอน smoke test M4:** seed.ts สร้างแถว `portfolio_items` แต่ไม่เคยอัปโหลดไฟล์จริง
  ขึ้น storage เลย (ตอน M1 ระบบอัปโหลดยังไม่มี) ทำให้ signed URL ที่ generate ได้ถูกต้องตาม logic แต่
  เปิดแล้ว 404 จริง เพราะไฟล์ไม่มีอยู่จริงใน Garage — เพิ่ม `putObject()` ใน storage client แล้วให้ seed
  อัปโหลด PNG 1x1 จริงๆ ไปที่ key ที่บันทึกไว้ ตรวจแล้วว่าเปิดได้จริง (HTTP 200, PNG ใช้งานได้)
- **รูปภาพ (avatar/portfolio) แสดงผ่าน `next/image` แบบ `unoptimized`** ไม่ใช้ Next Image Optimization เต็ม
  รูปแบบ เพราะ URL เป็น signed URL ที่เปลี่ยนทุกครั้ง (query string ใหม่ตลอด) การตั้ง remotePatterns ให้ตรง
  กับ domain ที่เปลี่ยนได้ตามสภาพแวดล้อม (dev=Garage, prod=R2/S3) ไม่คุ้มกับความซับซ้อน ไว้พิจารณาอีกครั้ง
  ตอน M8 ปรับ Lighthouse ถ้าจำเป็นต้องบีบขนาดภาพจริงจัง
- **ตั้งค่าพิกัด search อ้างอิงจาก browser geolocation** ไม่รับ lat/lng ผ่าน query param ของ `/search`
  (ถึงแม้ SPEC หัวข้อ 7.6 จะลิสต์ lat/lng เป็น parameter ของ service ก็ตาม — service ใช้งานแบบนั้นได้ แค่
  UI ตอนนี้ไม่ได้ทำ bookmarkable URL) **อัปเดตใน M8:** เดิมขอ permission geolocation ทันทีตอนเปิดหน้า
  (Lighthouse ตีว่าเป็น best-practice violation -- `geolocation-on-start`) เปลี่ยนเป็นเริ่มที่จุดกลาง
  กรุงเทพฯ ทันทีโดยไม่ขอ permission เลย แล้วมีปุ่ม "ใช้ตำแหน่งของฉัน" ให้กดขอ permission เองตอนต้องการ

**เพิ่มจาก M5:**

- **หน้า pending ของลูกค้าสามารถซ้อนทับเวลากันได้โดยไม่ error** เช่น ขอช่างคนเดียวกัน 2 ช่วงเวลาที่ชนกันพร้อมกัน
  (ทั้งคู่ยัง pending) — ตั้งใจตาม SPEC หัวข้อ 7.2/12: ให้ช่างเป็นคนเลือกว่าจะ "ยืนยันรับงาน" ช่วงไหน การกันชน
  จริงจะเกิดตอน `updateBookingStatus` ไปเป็น `confirmed` เท่านั้น ผ่าน exclusion constraint `no_double_booking`
  ในฐานข้อมูล (แปลง error code `23P01` เป็น `SLOT_TAKEN` ด้วย `getPgErrorCode()`) — ทดสอบจริงด้วย
  `Promise.allSettled` ยิง `updateBookingStatus(..., "confirmed")` พร้อมกัน 2 คำขอที่ชนเวลากัน ได้ผลสำเร็จ 1
  และ `SLOT_TAKEN` 1 ตรงตามที่ออกแบบไว้
- **`BOOKING_NOT_FOUND` แทน `FORBIDDEN` เสมอเมื่อคนนอกพยายามเข้าถึง booking ที่ไม่ใช่ของตัวเอง** ทั้งตอนอ่าน
  (`getBookingDetail`/`getBookingContact`) และตอนเขียน (`updateBookingStatus`) เพื่อไม่ให้รู้ว่า booking ID
  นั้นมีอยู่จริงหรือไม่ (SPEC หัวข้อ 7.3-7.4) — ยกเว้น admin ที่อนุญาตให้ "อ่าน" ได้ (เผื่อ support/dispute ใน
  อนาคต) แต่ไม่มีสิทธิ์ "เขียน" สถานะแทนคู่กรณีจริง
- **หน้า `/bookings/[id]` ไม่ได้อยู่ใต้ `(customer)` หรือ `(provider)` route group** เพราะทั้งสอง role ต้องเห็น
  booking เดียวกันผ่าน URL เดียวกัน (route group ไม่มีผลต่อ URL อยู่แล้ว) หน้า detail นี้จึงเช็ค role จาก
  `isCustomer`/`isProvider` ที่ compute จากตัว booking เอง แล้วค่อยโชว์ปุ่ม action ที่ต่างกันให้แต่ละฝั่ง
- **เบอร์โทร/LINE ของอีกฝ่ายถูกล็อกไว้จนกว่า booking จะถึงสถานะ `confirmed` ขึ้นไป** (SPEC หัวข้อ 7.4) ก่อนหน้า
  นั้นหน้า detail จะโชว์ข้อความแทน ไม่ throw error ไปที่ UI ตรงๆ — ดักจับ `CONTACT_LOCKED` เฉพาะ code นี้แล้ว
  คืนค่า `null` แทน เพื่อแยกจาก error code อื่นที่ควรปล่อยให้ error boundary จัดการจริง
- **ดึง `uploadFile()` (browser-side presign+PUT) และ `toActionResult()`/`createUploadUrlAction` ออกมาเป็น
  ของกลาง** (`src/lib/upload-client.ts`, `src/server/actions/result.ts`, `src/server/actions/upload.ts`)
  เพราะฟอร์มจองงานต้องอัปโหลดรูปเหมือนหน้าจัดการ portfolio ของช่างทุกประการ — รอจน consumer ตัวที่สองเกิดขึ้น
  จริงก่อนค่อยดึงออกมา ไม่ได้เผื่อไว้ล่วงหน้า
- **เวลาทำงาน/วันหยุดเช็คจาก timezone ของช่างจริง ไม่ใช่ server/browser timezone** ใช้
  `Intl.DateTimeFormat` + `hourCycle: "h23"` คำนวณ weekday และเวลาท้องถิ่นจาก `providerProfiles.timezone`
  (ป้องกันปัญหา `hour12`/"24:00" ของเที่ยงคืน) — ทดสอบจริงด้วยการ seed availability จันทร์-เสาร์ 08:00-18:00
  แล้วยิงจองวันอาทิตย์/หลังเวลาปิด ได้ `OUTSIDE_WORKING_HOURS` ตามคาด

**เพิ่มจาก M6:**

- **ไม่ต้องติดตั้งแพ็กเกจใหม่** ใช้ `pg` (มีอยู่แล้วตั้งแต่ M0) สร้าง connection แยกสำหรับ `LISTEN` และใช้
  Web Streams API (`ReadableStream`) ของ Next.js Route Handler ทำ SSE โดยตรง ไม่ต้องพึ่งไลบรารีเพิ่ม
  ตามที่ SPEC หัวข้อ 3 ตั้งใจไว้ ("ไม่ต้องมี service เพิ่ม")
- **`startConversation(providerId)` จำกัดให้ลูกค้าเป็นผู้เริ่มเท่านั้น** (ช่างเรียกแล้วได้ `FORBIDDEN`) ตรงตาม
  signature ที่ SPEC หัวข้อ 7.8 กำหนดตรงตัว — ช่างตอบกลับได้ผ่านกล่องแชต/หน้าแชตที่มีอยู่ แต่ไม่มีปุ่ม
  "เริ่มแชทกับลูกค้า" ใหม่ เพราะ schema `conversations` ผูกคู่ (customer_id, provider_id) ไว้แบบตายตัวอยู่แล้ว
  ไม่มีเหตุผลทางสเปกที่ต้องให้ช่างเริ่มคู่สนทนาใหม่ที่ยังไม่มีการจอง/ทักมาก่อน
- **คนนอกที่ไม่ใช่คู่สนทนา → `NOT_FOUND` เสมอ** (อ่าน/ส่ง/mark read ทุกทาง) ใช้แนวทางเดียวกับ `BOOKING_NOT_FOUND`
  ใน M5: ไม่บอกว่า "ไม่มีสิทธิ์" เพื่อไม่ให้รู้ว่า conversation ID นั้นมีอยู่จริง
- **LISTEN connection แยกจาก query Pool จริง** (`src/server/realtime/pg-listener.ts`) เป็น `pg.Client` เดี่ยว
  ต่อ process ตามที่ SPEC กำหนด เก็บ subscriber count ต่อ channel ไว้ด้วย เผื่อ connection หลุดแล้วต้อง
  `LISTEN` ใหม่ทุก channel ที่ยังมีผู้ติดตามอยู่ตอน reconnect (best-effort -- ถ้าหลุดระหว่างนั้นผู้ใช้ไม่เห็น
  ข้อความใหม่จนกว่าจะ reconnect สำเร็จ แต่ heartbeat ทุก 25 วิยังทำให้ connection ไม่ถูก proxy/browser ตัดทิ้ง)
- **NOTIFY payload ส่งแค่ message id ตามสเปกเป๊ะ ๆ** SSE route ดึงข้อความจริงผ่าน service (`getMessageById`)
  ทุกครั้งที่มี NOTIFY แทนที่จะเชื่อ payload ตรงๆ — เพิ่ม signed URL ให้รูปในข้อความตรงนี้ด้วยก่อนส่งลง SSE
- **รูปในแชต key เป็น `chat/{conversationId}/{uuid}.{ext}`** (ไม่ใช่ `{purpose}/{actorId}/...` แบบ avatar/
  portfolio/booking) เพราะทั้งสองฝ่ายต้องเห็นรูปเดียวกันได้ — `createUploadUrl` ตรวจว่า actor เป็นคู่สนทนา
  จริงก่อนออก presigned URL ให้ purpose นี้ และ `sendMessage` ตรวจ prefix ของ `imageKey` อีกชั้นก่อนบันทึก
- **ฝั่ง client มองเห็นข้อความใหม่ 2 ทาง:** (1) เรียก `sendMessageAction` แล้วต่อผลลัพธ์ที่ได้ไปต่อท้ายทันที
  (optimistic) และ (2) รับผ่าน SSE ที่ trigger จะ broadcast กลับมาให้ทุกคนในห้องรวมถึงคนที่ส่งเอง — กันข้อความ
  ซ้ำด้วยการเช็ค `id` ซ้ำก่อน append ทุกครั้ง เพื่อให้ผู้ส่งเห็นข้อความทันทีไม่ต้องรอ round-trip ของ NOTIFY
  แต่ยังมี SSE เป็น source of truth เดียวสำหรับอีกฝ่าย
- **ทดสอบ LISTEN/NOTIFY ข้าม process จริง** (ไม่ใช่แค่ใน process เดียวกันกับ integration test) ด้วยการรัน
  dev server จริงแล้วเปิด SSE ผ่าน `curl` ด้วย session cookie ของผู้ใช้จริง จากนั้นส่งข้อความจาก script
  คนละ process กัน ยืนยันว่า event ถูกส่งมาถึง `curl` แบบ real-time จริง ไม่ใช่แค่ mock ภายใน test runner

**เพิ่มจาก M7:**

- **เพิ่ม error code ใหม่ 3 ตัวที่ SPEC ไม่ได้ระบุชื่อตรงๆ** (`BOOKING_NOT_COMPLETED`, `REVIEW_WINDOW_EXPIRED`,
  `REVIEW_EDIT_WINDOW_EXPIRED`) เพื่อให้ตรงกับกฎข้อ 7.7 ที่เขียนไว้เป็นข้อความ ("งานต้อง completed ภายใน 30
  วัน" และ "แก้ไขได้ภายใน 7 วัน") แต่ไม่มีชื่อ error code กำกับไว้ชัดเจนแบบหัวข้อ 7.2
- **คนอื่นรีวิวแทนไม่ได้ → `BOOKING_NOT_FOUND`** (ไม่ใช่ `FORBIDDEN`) ใช้แนวทางเดียวกับ booking/chat ใน
  M5-M6: ไม่เปิดเผยว่า booking ID นั้นมีอยู่จริงหรือไม่ให้คนที่ไม่ใช่คู่กรณี
- **แก้ไขรีวิวได้แค่ rating/comment** ไม่มีฟิลด์อื่นให้แก้ (bookingId/providerId/customerId ผูกกับรีวิวเดิม
  ตลอดชีวิต) และยังคง derive provider_id จาก booking เท่านั้นตอนสร้าง ไม่รับจาก client แม้จะส่งมาก็ถูกเพิกเฉย
  (ทดสอบแล้วว่าส่ง `providerId`/`customerId` ปลอมมาใน input ไม่มีผลอะไร)
- **`rating_avg`/`rating_count` ไม่ต้องคำนวณเองในโค้ด** ใช้ trigger `reviews_update_provider_rating` ที่สร้าง
  ไว้ตั้งแต่ M0 (AFTER INSERT/UPDATE/DELETE) ซึ่งครอบคลุมทั้งตอนสร้างและตอนแก้ไขรีวิวให้แล้ว — ยืนยันด้วย
  integration test และ manual check กับข้อมูล seed จริง (ช่าง seed_provider_1 มี 2 รีวิว ได้ rating_avg
  3.50 ตรงกับที่คำนวณเอง)
- **หน้าเขียน/แก้ไขรีวิวอยู่ที่ `/bookings/[id]/review`** (ไม่แยก path สำหรับ "แก้ไข" ต่างหาก) หน้าเดียวกัน
  เช็คว่ามีรีวิวอยู่แล้วหรือยังผ่าน `getReviewForBooking` แล้วสลับ label ปุ่ม/หัวข้อให้เหมาะสม ตามแนวทาง
  เดียวกับหน้า booking detail ที่ใช้ URL เดียวกันทั้งสอง role

**เพิ่มจาก M8:**

- **`next-intl` ใช้ `localePrefix: "as-needed"`** (th = default ไม่มี prefix, en = `/en/...`) ทุก URL
  ที่มีอยู่แล้วตั้งแต่ M1-M7 ยังใช้งานได้เหมือนเดิมสำหรับผู้ใช้ไทย ย้ายทุกหน้าเข้า `src/app/[locale]/`
  โดย root layout เดิม (`src/app/layout.tsx`) หายไป กลายเป็น `[locale]/layout.tsx` แทน (ใส่ฟอนต์
  Noto Sans Thai ผ่าน `next/font/google` ตามหัวข้อ 9 ที่ยังไม่เคยทำตั้งแต่ M0, ตั้ง `<html lang>` ตาม
  locale จริง, เพิ่ม `NextIntlClientProvider`)
- **`src/i18n/request.ts` ใช้ `requestLocale` (ของเดิม, ไม่ใช่ `next/root-params` ที่ docs ปัจจุบันแนะนำ)**
  — ทดสอบจริงแล้วว่า `next/root-params` throw ทันทีถ้าถูกเรียกจากภายใน Server Action
  (`"...was used inside a Server Action. This is not supported."`) ซึ่งตรงกับที่ `toActionResult`
  (ใช้ทุก Server Action ในแอป) ต้องเรียก `getLocale()` เพื่อแปล error message — บั๊กนี้ไม่โชว์ตอน
  happy-path เลยเพราะ action ที่ไม่ throw ไม่เคยเรียก `getLocale()`, เจอจริงครั้งแรกตอน Playwright E2E
  ยิง `createBookingAction` จนชน `TOO_MANY_PENDING_BOOKINGS` ระหว่างทดสอบซ้ำหลายรอบ
- **`toActionResult` แปล `AppError` เป็นข้อความ th/en จริงแล้ว** (เดิมตั้งแต่ M5 ส่ง error code ดิบๆ เช่น
  "PROVIDER_UNAVAILABLE" ตรงๆให้ UI โชว์ เป็นช่องโหว่ UX ที่ไม่มีใครสังเกตมาตลอด M5-M7) ใช้
  `translateErrorCode(code, locale)` ที่มีอยู่แล้วตั้งแต่ M0 แต่ไม่เคยถูกเรียกใช้จริงที่ไหนเลย
- **สีหลัก/สีเน้นตาม SPEC หัวข้อ 9 ไม่เคยถูกเซ็ตจริงตั้งแต่ M0** — shadcn preset ที่ scaffold ไว้ใช้
  เทาเข้ม/ดำเป็น `--primary` (ไม่ใช่ `#2563EB` ตามสเปก) แก้โดยตั้ง `--primary` เป็นน้ำเงินตามสเปกทั้ง
  light/dark mode และเพิ่ม token ใหม่ `--brand-accent` (ส้ม `#F59E0B`) แยกจาก `--accent` เดิมของ shadcn
  (ซึ่งใช้เป็นสี hover แบบจางๆทั่วแอปอยู่แล้ว เปลี่ยนความหมายจะทำให้ hover state ทุกจุดกลายเป็นส้มจัดไปด้วย)
  ใช้ `bg-brand-accent` เฉพาะปุ่มจอง/ปุ่มสำคัญจริงๆ (ปุ่ม "จองงานกับช่างนี้" และปุ่ม "ส่งคำขอจอง")
- **Dark mode ใช้ CSS variable `.dark` class ที่ shadcn preset สร้างไว้ให้ตั้งแต่ M0 อยู่แล้ว** (ไม่รู้ตัว
  มาก่อนว่ามีครบ) งานจริงมีแค่เพิ่ม toggle (`theme-toggle.tsx`) ที่อ่าน/เซ็ต `localStorage` + inline
  script ใน `<head>` ก่อน hydrate กัน flash สีผิด — คอมโพเนนต์ตัวนี้อ่าน `document.documentElement`
  ตรงๆใน lazy initializer ของ `useState` แทนการใช้ `useEffect` + `setState` เพราะ ESLint
  (`react-hooks/set-state-in-effect`) ของโปรเจกต์ไม่อนุญาตรูปแบบหลัง
- **PWA icons สร้างด้วย `next/og`'s `ImageResponse`** (ไม่มีเครื่องมือออกแบบกราฟิกจริงในมือ) เป็นรูป
  สี่เหลี่ยมพื้นน้ำเงิน ตัวอักษร "ช" สีส้ม ขนาด 192/512 -- ใช้ชั่วคราวจนกว่าจะมีโลโก้จริง
- **Service worker เขียนมือ ไม่ใช้ `next-pwa`** (ไลบรารีนั้นไม่ได้อัปเดตรองรับ App Router/Next 16 อย่าง
  เป็นทางการ) ทำแค่ตามที่สเปกขอ: cache `offline.html` ไว้ตอน install แล้ว fallback ไปหน้านั้นเมื่อ
  navigation request fail เพราะไม่มีเน็ต ไม่ precache asset อื่นใด
- **Security headers (CSP/X-Frame-Options/Referrer-Policy/Permissions-Policy) ย้ายจาก
  `next.config.ts`'s `headers()` ไปอยู่ใน `src/proxy.ts` แทน** เพราะทดสอบจริงด้วย `docker build` +
  `docker run` คนละค่า `S3_ENDPOINT` กันแล้วพบว่า `next.config.ts` คำนวณ CSP แค่ครั้งเดียวตอน build
  (ค่า placeholder ที่ตั้งไว้ให้ build ผ่าน) ไม่ได้อ่านค่า runtime จริงที่ส่งมาตอน `docker run -e` เลย
  — ย้ายไปคำนวณต่อ request ใน middleware แก้ปัญหานี้ และยืนยันด้วย container จริงว่า CSP เปลี่ยนตาม
  env ที่ส่งเข้าไปตอน run ถูกต้อง
- **CSP ต้องมี `'unsafe-eval'` เฉพาะตอน `NODE_ENV !== "production"`** React dev mode (Fast Refresh/error
  overlay) ใช้ `eval()` จริง — เจอจาก Playwright เปิดหน้าแล้วเจอ Runtime Error เต็มจอทันทีตอนเพิ่ม CSP
  เข้าไปใหม่ๆ, CSP ตอน production ไม่ใส่ `unsafe-eval` เหมือนเดิม
- **หน้าแรกกับ `sitemap.ts` ต้องเป็น `export const dynamic = "force-dynamic"`** ทั้งสองไฟล์ query
  ฐานข้อมูลตรงๆ (รายการหมวดงาน, รายชื่อช่าง active) ซึ่ง Next พยายาม static-generate ตอน build โดย
  ค่าเริ่มต้น — ใช้งานได้ปกติตอน `pnpm build` บนเครื่อง dev เพราะ Postgres รันอยู่ แต่ `docker build`
  ไม่มีฐานข้อมูลให้เชื่อมต่อ ทำให้ build fail จริง (ทดสอบแล้ว ไม่ใช่แค่คาดเดา)
- **Dockerfile ต้อง copy `pnpm-workspace.yaml` เข้าไปด้วย** (ไม่ใช่แค่ `package.json`/`pnpm-lock.yaml`)
  เพราะไฟล์นี้เก็บ `allowBuilds` ของแพ็กเกจที่มี native postinstall script (`@swc/core`,
  `@parcel/watcher` ฯลฯ) — ไม่มีไฟล์นี้ `pnpm install --frozen-lockfile` จะ fail ด้วย
  `ERR_PNPM_IGNORED_BUILDS` ข้าง container (ทดสอบจริงด้วย `docker build` จนรันสำเร็จ รวมถึงรัน
  container จริงต่อกับ `docker compose` network แล้วเทียบ response กับ dev server)
- **บั๊กจริงที่เจอจาก Playwright, ไม่เกี่ยวกับ M8 โดยตรง แต่ซ่อนมาตั้งแต่ M3/M4:** หน้าโปรไฟล์ช่างพัง
  ทั้งหน้า (client-side Runtime Error หลัง hydrate) สำหรับช่างทุกคนที่มีพิกัด เพราะ import รูป marker
  ของ Leaflet จาก `node_modules` ตรงๆ ได้ `iconUrl` เป็นค่าว่างภายใต้ Turbopack — ไม่มีใครเจอมาก่อนเพราะ
  การตรวจสอบก่อนหน้านี้ใช้ `curl` ดู HTML จาก server เท่านั้น ซึ่งไม่รัน JS ฝั่ง client เลยจึงไม่เจอ
  error ชนิดนี้ แก้โดย copy รูป marker 3 ไฟล์เข้า `public/leaflet/` แล้วอ้างเป็น static path ตรงๆแทน
  การ import จาก package
- **Playwright E2E: ต้องบังคับ `locale: "th-TH"` ตอนสร้าง browser context** อุปกรณ์จำลอง "Pixel 7"
  (ตามที่สเปกต้องการ ขนาดจอมือถือ) มี default locale เป็น `en-US` ซึ่งทำให้ next-intl ตรวจจับแล้ว
  redirect ทุกหน้าไปที่ `/en/...` โดยไม่ได้ตั้งใจ ยืนยันด้วยการดู URL จริงหลังล็อกอินที่ error context
  ของ Playwright
- **Better Auth จำกัดการเข้าสู่ระบบไว้ที่ 3 ครั้ง/10 วินาที/IP ให้ทุก path ที่ขึ้นต้นด้วย `/sign-in`
  โดย default** (ไม่ใช่บั๊ก เป็น SPEC หัวข้อ 11 ที่ทำงานถูกต้อง) — รัน Flow A + Flow B ติดกันในชุด
  ทดสอบเดียว (login รวม 4 ครั้งจากคนละบัญชี แต่ IP เดียวกัน) ชนขีดจำกัดนี้ได้จริง ตัวช่วย
  `loginAsDevUser` ใน `tests/e2e/helpers.ts` จึงรอ 11 วิแล้วลองใหม่อัตโนมัติถ้าเจอ 429 (สูงสุด 5 ครั้ง)
  และปรับ `playwright.config.ts`'s `timeout` เป็น 90 วิ ให้มีพื้นที่พอสำหรับการรอนี้
- **ข้อความแชตในเทสต์ E2E ต้องมี nonce ต่อรอบ (`Date.now()`) ต่อท้าย** เพราะ Flow B รันกับฐานข้อมูล dev
  จริงที่ไม่ได้ truncate ต่อเทสต์แบบ integration test รันซ้ำหลายรอบด้วยข้อความเดิมจะเจอ
  strict-mode violation (ข้อความซ้ำหลายรายการ) ใน Playwright locator
- **Lighthouse spot-check (production build, `next build` + `.next/standalone/server.js`, หน้า `/`
  และ `/search`):** Accessibility 100 และ SEO 100 ทั้งสองหน้าทุกรอบที่รัน, Performance อยู่ในช่วง
  82-92 ขึ้นอยู่กับโหลดของเครื่องตอนรัน (เครื่อง dev ถูกใช้ทดสอบหนักมากตลอด M8 ทำให้ตัวเลขแปรผันได้),
  Best Practices ติดอยู่ที่ 81 จาก audit เดียวคือ `is-on-https` (รันทดสอบที่ `http://localhost` ไม่มี
  TLS จริง) ซึ่งจะผ่านอัตโนมัติเมื่อ deploy จริงหลัง Nginx+TLS ตามที่ README อธิบายไว้ — ตรวจแล้วว่า
  ไม่มี console error/404 เหลืออยู่จริง (เจอรอบแรกเพราะทดสอบจาก `node .next/standalone/server.js`
  ตรงๆโดยไม่ copy `public/`กับ`.next/static/` เข้าไปด้วยตามที่ Dockerfile ทำจริง -- เป็นปัญหาของวิธี
  ทดสอบเอง ไม่ใช่ของแอป) และเจอ `geolocation-on-start` จริง (ขอ permission ตำแหน่งทันทีตอนเปิดหน้า
  ค้นหา) แก้แล้วด้วยการตั้งค่าเริ่มต้นเป็นกรุงเทพฯ กลางเมืองทันทีโดยไม่ขอ permission แล้วเพิ่มปุ่ม
  "ใช้ตำแหน่งของฉัน" ให้กดขอเองตอนต้องการ
- **ขอบเขตที่ตั้งใจไม่ทำให้ครบ 100% ในรอบนี้:** แปล UI เป็นอังกฤษแค่บางส่วน (nav bar, error message,
  language switcher) — ข้อความส่วนใหญ่ในแต่ละหน้ายังเป็นภาษาไทยแข็งในโค้ด ไม่ได้ผ่าน
  `useTranslations` ทุกจุด เพราะใช้เวลามากเทียบกับงาน infra (routing, dark mode, security headers,
  PWA, Docker, E2E) ที่ยังไม่เคยมีเลยและมีความเสี่ยงสูงกว่าถ้าไม่เสร็จ — บันทึกไว้ใน
  `docs/ARCHITECTURE.md`'s Known Limitations ด้วย

## Milestone Breakdown

### M0 — Project Setup

- `git init`, `.gitignore`, pnpm + Next.js (App Router, TS strict) ล่าสุด, Tailwind, shadcn/ui, lucide-react
- `docker-compose.yml`: postgres:16 (2 databases: changdee, changdee_test), minio + mc job สร้าง bucket อัตโนมัติ
- `src/server/lib/env.ts`: ตรวจ env ด้วย Zod ตอน startup, `.env.example` พร้อมคำอธิบายทุกตัวแปร
- ESLint (flat config) + Prettier + custom `no-restricted-imports` กัน import Drizzle client นอก `src/server`
- GitHub Actions workflow: lint + typecheck + test (postgres service container)
- Scripts พื้นฐานใน `package.json` (ที่เหลือเติมเมื่อ feature พร้อม)
- **Exit:** `pnpm lint`, `pnpm typecheck` ผ่าน, `docker compose up` ขึ้นสำเร็จ

### M1 — Schema + DB Constraints

- Drizzle schema ทุกตารางตาม SPEC หัวข้อ 6 (รวม Better Auth tables ตามเอกสาร Better Auth)
- Custom SQL migration: `btree_gist`, exclusion constraint กันจองซ้อน, trigger rating_avg/rating_count,
  trigger `pg_notify` + อัปเดต `last_message_at`, updated_at trigger, index ทั้งหมดตามหัวข้อ 6
- App database user แยกจาก superuser (least privilege ตามหัวข้อ 5.7)
- `pnpm db:seed` (6 หมวด, ช่าง 10 คน, ลูกค้า 2 คน, งานเสร็จ+รีวิว) — รันซ้ำได้ไม่ error
- Integration tests: exclusion constraint กันจองซ้อนจริงในระดับ DB, trigger ต่าง ๆ ทำงานถูกต้อง
- **Exit:** lint/typecheck/test ผ่าน, seed รันซ้ำได้

### M2 — Authentication

- Better Auth + plugin เบอร์โทร/OTP (dev: console `SmsProvider`) + Google OAuth + อีเมล (เฉพาะ dev)
- เลือกบทบาท customer/provider ตอนสมัคร, auto-create `provider_profiles` เมื่อเลือก provider
- `becomeProvider()`, session เก็บใน Postgres, cookie httpOnly/secure/sameSite=lax
- Rate limit OTP (3/10นาที/เบอร์, 10/ชม./IP) และ login
- หน้า login/สมัคร (mobile-first)
- Integration tests: สมัครแอบส่ง role=admin → ได้ customer, rate limit ทำงาน

### M3 — Provider Profile

- โปรไฟล์ช่าง (รูป, ชื่อร้าน, หมวด, พื้นที่, ราคา, แกลเลอรี ≤30, เวลาทำงานรายสัปดาห์)
- Upload flow: presigned URL, ตรวจ prefix key, ขนาด/ประเภทไฟล์, avatar 2MB / อื่น 5MB
- หน้าแก้ไขโปรไฟล์ช่าง + ตั้งเวลาทำงาน (mobile-first, ปุ่มใหญ่)
- Integration tests: อัปโหลดข้าม prefix คนอื่นไม่ได้, บันทึก key ปลอมไม่ได้

### M4 — Search + Public Profile

- `searchProviders` (Haversine ใน SQL, กรอง/เรียงตามหัวข้อ 7.6), ปัดพิกัด 3 ตำแหน่งทศนิยม
- หน้าค้นหา (รายการ + แผนที่ Leaflet), หน้าโปรไฟล์ช่าง `/p/[id]` (SSR + JSON-LD LocalBusiness)
- Integration tests: ผู้เยี่ยมชมค้นหาได้, ตัวกรองหมวดถูกต้อง, ไม่เห็นโปรไฟล์ลูกค้า

### M5 — Booking System

- `createBooking` ตรวจครบทุกเงื่อนไขหัวข้อ 7.2 ใน transaction เดียว, state machine หัวข้อ 7.3
  (`SELECT ... FOR UPDATE`, จับ error `23P01` → `SLOT_TAKEN`)
- `getBookingContact` (เปิดเผยเบอร์/LINE เมื่อ confirmed/in_progress/completed)
- หน้าจอง, รายการจองของลูกค้า/ช่าง, รายละเอียด+timeline
- Integration tests: ครบทุกกรณีในหัวข้อ 12 ข้อ 3–9, 13 (รวม concurrent confirm ด้วย `Promise.all`)

### M6 — Real-time Chat

- `conversations`/`messages` service, SSE endpoint พร้อม auth check, heartbeat 25s, LISTEN/NOTIFY
  singleton connection, cursor pagination (30 ข้อความ/ครั้ง), rate limit 20 ข้อความ/นาที
- หน้าแชต + รูปในแชต + สถานะอ่านแล้ว
- Integration tests: idempotent, ปลอม sender ไม่ได้, คนนอกอ่าน/ส่งไม่ได้, rate limit, mark read

### M7 — Reviews

- `createReview`/`updateReview` ตามหัวข้อ 7.7 (provider_id มาจาก booking เท่านั้น), trigger อัปเดตคะแนนช่าง
- หน้าเขียนรีวิว, แสดงรีวิวในโปรไฟล์ช่าง
- Integration tests: รีวิวก่อนเสร็จงานไม่ได้, ซ้ำไม่ได้, คนอื่นรีวิวแทนไม่ได้, ค่าเฉลี่ยอัปเดตถูก

### M8 — Polish: PWA, i18n, Dark Mode, A11y, E2E, Docs

- manifest, icons, offline page, next-intl (th default + en), dark mode (CSS variables)
- Lighthouse 90+, WCAG 2.1 AA, sitemap/robots/metadata/OG
- Playwright E2E Flow A และ Flow B (mobile viewport)
- `README.md` (ไทย: ติดตั้ง/รัน/ทดสอบ/deploy VPS + Nginx + HTTPS + SSE config)
- `docs/ARCHITECTURE.md` (ER diagram Mermaid, state machine, การคุมสิทธิ์, error codes, known limitations)
- `Dockerfile` multi-stage (Next standalone output)

ทุก milestone: commit แยกด้วย Conventional Commits, ผ่าน lint/typecheck/test ก่อนไป milestone ถัดไป,
สรุปสั้น ๆ ท้าย milestone (ทำอะไร/ไฟล์หลัก/วิธีลองใช้/ปัญหาที่เจอ) แล้วทำต่อโดยไม่ต้องรอถามถ้าไม่ติดเงื่อนไขหัวข้อ 16.4

## รอการอนุมัติ

กรุณายืนยันว่าแผนนี้โอเค หรือแจ้งจุดที่ต้องการแก้ก่อนเริ่ม M0
