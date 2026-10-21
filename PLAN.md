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

ถ้าข้อใดข้างต้นไม่ตรงกับที่ผู้ใช้ต้องการ แจ้งได้ก่อนอนุมัติแผนนี้

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
