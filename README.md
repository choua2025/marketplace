# ช่างดี (ChangDee)

แพลตฟอร์มสองด้าน (two-sided marketplace) เชื่อมลูกค้ากับช่างบริการในพื้นที่ -- ค้นหา จองงาน แชตแบบ
real-time และรีวิวได้ในที่เดียว

สแตกหลัก: Next.js 16 (App Router) · TypeScript · PostgreSQL 16 + Drizzle ORM · Better Auth ·
Tailwind v4 + shadcn/ui · next-intl (ไทย/English) · SSE + Postgres `LISTEN/NOTIFY` สำหรับแชต

ดู [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) สำหรับ ER diagram, state machine, การคุมสิทธิ์ และ
รายการ error code ทั้งหมด

## สารบัญ

- [ติดตั้งและรันบนเครื่อง dev](#ติดตั้งและรันบนเครื่อง-dev)
- [คำสั่งที่ใช้บ่อย](#คำสั่งที่ใช้บ่อย)
- [การทดสอบ](#การทดสอบ)
- [Deploy บน VPS](#deploy-บน-vps)

## ติดตั้งและรันบนเครื่อง dev

### สิ่งที่ต้องมี

- Node.js 24+
- pnpm 12+ (`corepack enable` จะติดตั้งเวอร์ชันที่ตรงกับ `packageManager` ใน `package.json` ให้)
- Docker + Docker Compose (สำหรับ PostgreSQL และ storage ฝั่ง dev)

### ขั้นตอน

1. ติดตั้ง dependencies

   ```bash
   pnpm install
   ```

2. คัดลอก `.env.example` เป็น `.env` แล้วเติมค่า โดยเฉพาะ `BETTER_AUTH_SECRET`
   (สร้างด้วย `openssl rand -hex 32`) -- ค่าอื่นๆใน `.env.example` ใช้ได้ทันทีสำหรับ dev บนเครื่อง
   (เป็นค่า dev-only ที่ตั้งไว้ให้ตรงกับ `docker-compose.yml` และสคริปต์ bootstrap ของ Garage)

   ```bash
   cp .env.example .env
   ```

3. เปิด PostgreSQL + Garage (S3-compatible storage สำหรับ dev)

   ```bash
   docker compose up -d
   ```

   รอจนทั้งสอง service เป็น `healthy` (`docker compose ps`) -- compose จะรันสคริปต์สร้าง least-privilege
   role 2 ตัวในฐานข้อมูลและสร้าง bucket ให้อัตโนมัติในครั้งแรก

4. รัน migration แล้ว seed ข้อมูลตัวอย่าง

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

5. เริ่มเซิร์ฟเวอร์ dev

   ```bash
   pnpm dev
   ```

   เปิด http://localhost:3000 (หรือพอร์ตที่ตรงกับ `APP_URL`/`BETTER_AUTH_URL` ใน `.env` -- Better Auth
   จะปฏิเสธ request ที่มี origin ไม่ตรงกับค่านี้)

### บัญชีตัวอย่างสำหรับ dev

Seed สร้างบัญชีไว้ให้ (`NODE_ENV=development` เท่านั้นที่เปิดให้ล็อกอินด้วยอีเมล/รหัสผ่านตรงๆ
ในหน้า `/login` -- โหมด production ใช้เบอร์โทร + OTP หรือ Google เท่านั้น):

| บทบาท  | อีเมล                         | รหัสผ่าน      |
| ------ | ----------------------------- | ------------- |
| ลูกค้า | `customer1@changdee.test`     | `password123` |
| ลูกค้า | `customer2@changdee.test`     | `password123` |
| ช่าง   | `provider1..10@changdee.test` | `password123` |

## คำสั่งที่ใช้บ่อย

| คำสั่ง             | ใช้ทำอะไร                                               |
| ------------------ | ------------------------------------------------------- |
| `pnpm dev`         | เซิร์ฟเวอร์ dev (Turbopack)                             |
| `pnpm build`       | build สำหรับ production (standalone output)             |
| `pnpm start`       | รันผลลัพธ์จาก `pnpm build`                              |
| `pnpm lint`        | ESLint                                                  |
| `pnpm typecheck`   | สร้าง route types แล้วตรวจ TypeScript                   |
| `pnpm test`        | Integration + unit tests (Vitest, ต้องมี Postgres จริง) |
| `pnpm test:e2e`    | E2E (Playwright, ต้องมี dev server รันอยู่ก่อน)         |
| `pnpm db:generate` | สร้าง migration ใหม่จาก schema ที่เปลี่ยน (drizzle-kit) |
| `pnpm db:migrate`  | รัน migration ที่ยังไม่รัน                              |
| `pnpm db:seed`     | เติมข้อมูลตัวอย่าง (รันซ้ำได้โดยไม่ error)              |
| `pnpm db:reset`    | ล้างข้อมูลทุกตารางด้วย `TRUNCATE ... CASCADE`           |

## การทดสอบ

### Integration tests (Vitest)

ต้องมี PostgreSQL จริงรันอยู่ (`docker compose up -d`) -- ทดสอบจะเชื่อมฐานข้อมูล `changdee_test`
แยกจาก dev และล้างข้อมูลทุกตารางก่อนแต่ละ test:

```bash
pnpm test
```

### E2E (Playwright)

ต้องมี dev server รันอยู่ก่อน (`pnpm dev`) และฐานข้อมูล dev มีข้อมูล seed แล้ว (`pnpm db:seed`) --
Flow A/B ใช้บัญชีตัวอย่างข้างบนจริง ไม่ mock ใดๆ:

```bash
pnpm test:e2e
```

ทดสอบรันทีละไฟล์ (ไม่ parallel) เพราะทั้งสอง flow ใช้ dev server และฐานข้อมูลเดียวกัน และ Better Auth
จำกัดการเข้าสู่ระบบไว้ที่ 3 ครั้ง/10 วินาที/IP (ตัวช่วยล็อกอินในเทสต์จะรอแล้วลองใหม่ให้อัตโนมัติถ้าชน
ขีดจำกัดนี้ -- เป็นพฤติกรรมที่ถูกต้องของระบบ ไม่ใช่บั๊ก)

ถ้า `pnpm db:reset && pnpm db:seed` ถูกรันระหว่างทดสอบซ้ำหลายรอบติดกัน ข้อมูลจะกลับมาสะอาดเหมือนรอบแรก
เสมอ

## Deploy บน VPS

ภาพรวม: 1 VPS รัน container ของแอป (Next.js standalone) + PostgreSQL + S3-compatible storage (หรือใช้
Cloudflare R2/AWS S3 ของจริงแทนก็ได้ -- โค้ดเหมือนกันทุกจุด เปลี่ยนแค่ env) อยู่หลัง Nginx ที่ทำ
TLS termination

**สำคัญ:** แอปต้องรันแบบ long-running server (ไม่ใช่ serverless/edge function) เพราะ SSE
(`/api/conversations/[id]/stream`) และ Postgres `LISTEN/NOTIFY` connection ต้องค้างไว้ตลอดอายุของ
request

### 1. Build และรัน image

```bash
docker build -t changdee .
docker run -d --name changdee \
  -p 3000:3000 \
  --env-file .env.production \
  changdee
```

`.env.production` ต้องมีค่าจริงของทุกตัวแปรใน `.env.example` -- `DATABASE_APP_URL` ต้องชี้ไปที่
PostgreSQL จริง (role สิทธิ์ต่ำ `changdee_app`, DML เท่านั้น) และ `S3_ENDPOINT`/`S3_*` ต้องชี้ไปที่
Cloudflare R2, AWS S3 หรือ Garage ที่รันแยกไว้สำหรับ production

ค่า `BETTER_AUTH_SECRET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` ที่เห็นใน Dockerfile เป็นแค่
placeholder สำหรับให้ `next build` ผ่าน schema validation เท่านั้น -- ค่าจริงมาจาก `--env-file` ตอน
`docker run` เสมอ ไม่ได้ฝังอยู่ใน image

### 2. Migration (รันครั้งเดียวก่อนเปิดใช้งาน หรือทุกครั้งที่ deploy เวอร์ชันใหม่)

รันจากเครื่องที่เข้าถึง `DATABASE_URL` (role เจ้าของ, สิทธิ์ DDL) ได้ -- ไม่ต้องรันจาก container ของแอป:

```bash
DATABASE_URL=postgres://changdee_owner:...@db-host:5432/changdee pnpm db:migrate
```

### 3. Nginx (reverse proxy + TLS + การตั้งค่าให้ SSE ทำงานได้)

SSE ต้องปิด buffering ไม่งั้น Nginx จะรอ Response เต็มก่อนส่งต่อ ทำให้ real-time ไม่ real-time:

```nginx
server {
    listen 443 ssl;
    server_name changdee.example.com;

    ssl_certificate     /etc/letsencrypt/live/changdee.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/changdee.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE endpoint: ปิด buffering/caching ทั้งหมด และยืดเวลา read timeout ออกไป
    # เพราะ connection นี้ค้างไว้นานเป็นนาทีโดยตั้งใจ (heartbeat ทุก 25 วิ)
    location /api/conversations/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 1h;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name changdee.example.com;
    return 301 https://$host$request_uri;
}
```

ออก TLS certificate ด้วย Let's Encrypt (`certbot --nginx -d changdee.example.com`) แล้ว reload Nginx

### 4. ตรวจสอบหลัง deploy

- `GET /` ต้องตอบ 200 และมี security header ครบ (`curl -I https://changdee.example.com/` ดู
  `Content-Security-Policy`, `X-Frame-Options` เป็นต้น -- มาจาก `src/proxy.ts`)
- เปิดสองแท็บ ล็อกอินเป็นลูกค้า/ช่างคนละคน แชตกันดูว่าข้อความมาแบบ real-time ไม่ต้อง refresh
  (ยืนยันว่า Nginx ไม่ได้ buffer การตอบกลับของ SSE)
- `pnpm db:seed` รันจากเครื่อง deploy ได้ (ชี้ `DATABASE_URL` ไปที่ DB จริง) ถ้าต้องการข้อมูลตัวอย่าง
  สำหรับ staging -- **ห้ามรันกับฐานข้อมูล production จริงที่มีผู้ใช้แล้ว**
