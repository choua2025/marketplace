# Architecture — ช่างดี (ChangDee)

## ER Diagram

```mermaid
erDiagram
    user ||--|| profiles : "1:1 (Better Auth)"
    profiles ||--o| profile_contacts : "1:1"
    profiles ||--o| provider_profiles : "1:1, ถ้าเป็นช่าง"
    provider_profiles ||--o{ provider_categories : ""
    categories ||--o{ provider_categories : ""
    provider_profiles ||--o{ portfolio_items : ""
    provider_profiles ||--o{ availability_rules : ""
    profiles ||--o{ bookings : "customer_id"
    provider_profiles ||--o{ bookings : "provider_id"
    categories ||--o{ bookings : ""
    bookings ||--o| reviews : "1:1 ต่อการจอง"
    profiles ||--o{ conversations : "customer_id"
    provider_profiles ||--o{ conversations : "provider_id"
    conversations ||--o{ messages : ""
    profiles ||--o{ messages : "sender_id"

    user {
        text id PK
        text email
        text phone_number
    }
    profiles {
        text id PK "= user.id"
        role role "customer | provider | admin"
        varchar full_name
        text avatar_key
        locale locale "th | en"
    }
    profile_contacts {
        text id PK "= profiles.id"
        varchar phone
        varchar line_id
    }
    provider_profiles {
        text id PK "= profiles.id"
        varchar display_name
        numeric base_price
        price_unit price_unit "job | hour | day"
        numeric latitude
        numeric longitude
        integer service_radius_km
        boolean is_active
        boolean is_verified
        numeric rating_avg
        integer rating_count
        integer completed_jobs
    }
    categories {
        smallint id PK
        varchar slug
        varchar name_th
        varchar name_en
    }
    provider_categories {
        text provider_id PK,FK
        smallint category_id PK,FK
    }
    portfolio_items {
        uuid id PK
        text provider_id FK
        text image_key
    }
    availability_rules {
        uuid id PK
        text provider_id FK
        smallint weekday "0=อาทิตย์"
        time start_time
        time end_time
    }
    bookings {
        uuid id PK
        text customer_id FK
        text provider_id FK
        smallint category_id FK
        booking_status status
        timestamptz start_at
        timestamptz end_at
        text_array photo_keys
    }
    reviews {
        uuid id PK
        uuid booking_id FK "unique"
        text customer_id FK
        text provider_id FK
        smallint rating "1-5"
    }
    conversations {
        uuid id PK
        text customer_id FK
        text provider_id FK
        timestamptz last_message_at
    }
    messages {
        bigint id PK "cursor สำหรับ infinite scroll"
        uuid conversation_id FK
        text sender_id FK
        varchar body
        text image_key
        timestamptz read_at
    }
```

`user`/`session`/`account`/`verification` เป็นตารางที่ Better Auth จัดการเอง (ไม่แสดงรายละเอียดในแผนภาพนี้)
ดูได้ที่ `src/server/db/auth-schema.ts`

## State Machine: การจอง (`bookings.status`)

```mermaid
stateDiagram-v2
    [*] --> pending: createBooking (ลูกค้า)
    pending --> confirmed: ช่างยืนยัน
    confirmed --> in_progress: ช่างเริ่มงาน
    in_progress --> completed: ช่างกดเสร็จ
    pending --> cancelled: ทั้งสองฝ่ายยกเลิก
    confirmed --> cancelled: ทั้งสองฝ่ายยกเลิก
    completed --> [*]
    cancelled --> [*]
```

กฎสำคัญ (`src/server/services/booking.ts`):

- เปลี่ยนสถานะได้ทางเดียวผ่าน `updateBookingStatus` เท่านั้น ไม่มีทางย้อนกลับ
- ล็อก row ด้วย `SELECT ... FOR UPDATE` ก่อนตรวจสถานะเสมอ (ป้องกัน race ระหว่างสองคำขอพร้อมกัน)
- ยืนยัน (`confirmed`) ชนกับงานอื่นของช่างคนเดียวกันได้ -- DB exclusion constraint `no_double_booking`
  (`EXCLUDE USING gist`) จะปฏิเสธด้วย error code `23P01` ซึ่ง service แปลงเป็น `SLOT_TAKEN`
- ยกเลิกต้องระบุเหตุผล (`cancel_reason`) เสมอ
- เมื่อถึง `completed` จะเพิ่ม `provider_profiles.completed_jobs` ในทรานแซกชันเดียวกัน

## การคุมสิทธิ์ (Authorization)

หลักการหลัก (SPEC.md หัวข้อ 5): **ทุก service function รับ `actor: Actor | null` เป็นพารามิเตอร์แรก
และตรวจสิทธิ์เองข้างใน** -- ไม่มี middleware กลางที่คุมสิทธิ์แทน เพื่อให้เห็นกฎทั้งหมดของแต่ละ
operation อยู่ที่เดียว

```mermaid
flowchart LR
    A[Server Action / Route Handler] -->|"getActor() จาก session"| B[Actor | null]
    B --> C["Service function(actor, input)"]
    C --> D{"ตรวจ role/ownership ข้างใน"}
    D -->|ผ่าน| E["Drizzle query (parameterized)"]
    D -->|ไม่ผ่าน| F["throw AppError(code)"]
```

- **UI ไม่เรียก Drizzle ตรงๆ** -- ESLint (`no-restricted-imports`) บังคับว่า `@/server/db/*` import
  ได้แค่จาก `src/server/**`
- **`role` ไม่รับจาก client โดยตรง** -- `profiles.role` ตั้งค่าเริ่มต้นเป็น `customer` เสมอผ่าน
  Better Auth hook (`databaseHooks.user.create.after`), เปลี่ยนเป็นช่างได้เฉพาะผ่าน `becomeProvider`
- **ซ่อนการมีอยู่ของข้อมูลที่ไม่เกี่ยวกับตัวเอง** -- คนนอกที่ไม่ใช่คู่กรณีของ booking/conversation ได้
  `BOOKING_NOT_FOUND`/`NOT_FOUND` เสมอ ไม่ใช่ `FORBIDDEN` (ไม่บอกว่ามีรายการอยู่จริงแต่ไม่มีสิทธิ์)
- **ข้อมูลติดต่อ (เบอร์/LINE)** เปิดเผยได้เฉพาะผ่าน `getBookingContact` เมื่อ booking ถึงสถานะ
  `confirmed` ขึ้นไปเท่านั้น
- **Rate limiting แบบ in-memory ต่อ process** (`src/server/lib/rate-limit.ts`) -- เพียงพอเพราะแอป deploy
  เป็น single long-running container ไม่ scale แนวนอนใน MVP (ดู PLAN.md ข้อ 5)

## Real-time Chat

```mermaid
sequenceDiagram
    participant A as Browser A (ลูกค้า)
    participant S as Next.js Server
    participant DB as PostgreSQL
    participant B as Browser B (ช่าง)

    A->>S: POST sendMessageAction (Server Action)
    S->>DB: INSERT INTO messages
    DB->>DB: trigger notify_new_message()
    DB-->>S: pg_notify('chat_<conversationId>', messageId)
    S->>S: pg-listener.ts (1 connection ต่อ process) รับ NOTIFY
    S-->>B: SSE event (ดึงข้อความจริงผ่าน service ก่อนส่ง)
    Note over S,B: NOTIFY payload มีแค่ message id เท่านั้น<br/>ไม่ส่งเนื้อหาข้อความผ่าน Postgres เลย
```

- Endpoint: `GET /api/conversations/[id]/stream` -- ตรวจสิทธิ์ (เป็นคู่สนทนาจริง) ก่อนเปิด stream
  เท่านั้น ไม่ตรวจซ้ำทุกข้อความ (ปลอดภัยเพราะ channel ผูกกับ conversation นั้นโดยตรง)
- Heartbeat ทุก 25 วินาที กันไม่ให้ proxy/browser ตัด connection ที่ไม่มีข้อมูลไหลนาน
- จำกัด 20 ข้อความ/นาที/ผู้ใช้ (`RATE_LIMITED`)

## Error Codes

ทุก error code map ไปทั้ง HTTP status และข้อความ th/en ที่ `messages/th.json`/`en.json`
(`src/server/lib/errors.ts`)

| Code                         | HTTP | ความหมาย                                                 |
| ---------------------------- | ---- | -------------------------------------------------------- |
| `UNAUTHORIZED`               | 401  | ยังไม่เข้าสู่ระบบ                                        |
| `FORBIDDEN`                  | 403  | เข้าสู่ระบบแล้วแต่ไม่มีสิทธิ์ทำรายการนี้                 |
| `NOT_FOUND`                  | 404  | ไม่พบข้อมูลที่ต้องการ (ทั่วไป)                           |
| `VALIDATION_ERROR`           | 400  | ข้อมูลที่ส่งมาไม่ผ่าน Zod schema                         |
| `RATE_LIMITED`               | 429  | ทำรายการนี้บ่อยเกินไป                                    |
| `PROVIDER_UNAVAILABLE`       | 409  | ช่างไม่มีอยู่ หรือ `is_active = false`                   |
| `CATEGORY_NOT_OFFERED`       | 409  | ช่างไม่รับงานหมวดที่เลือก                                |
| `INVALID_START_TIME`         | 400  | เวลาเริ่มเร็วกว่า 1 ชม. หรือเกิน 90 วันจากนี้            |
| `OUTSIDE_WORKING_HOURS`      | 409  | เวลาที่เลือกอยู่นอกเวลาทำงานของช่าง                      |
| `TOO_MANY_PENDING_BOOKINGS`  | 409  | ลูกค้ามีคำขอ pending ครบ 5 รายการแล้ว                    |
| `BOOKING_NOT_FOUND`          | 404  | ไม่พบ booking หรือไม่ใช่คู่กรณี (ซ่อนการมีอยู่โดยตั้งใจ) |
| `INVALID_TRANSITION`         | 409  | เปลี่ยนสถานะที่ไม่อยู่ใน state machine                   |
| `CANCEL_REASON_REQUIRED`     | 400  | ยกเลิกโดยไม่ระบุเหตุผล                                   |
| `SLOT_TAKEN`                 | 409  | ยืนยันแล้วเวลาชนกับงานอื่นของช่างคนเดียวกัน              |
| `CONTACT_LOCKED`             | 403  | ยังดูเบอร์/LINE ไม่ได้ (รอ confirmed ขึ้นไป)             |
| `REVIEW_EXISTS`              | 409  | งานนี้ถูกรีวิวไปแล้ว                                     |
| `BOOKING_NOT_COMPLETED`      | 409  | รีวิวได้เฉพาะงานที่เสร็จแล้ว                             |
| `REVIEW_WINDOW_EXPIRED`      | 409  | งานเสร็จมานานเกิน 30 วัน รีวิวไม่ได้แล้ว                 |
| `REVIEW_EDIT_WINDOW_EXPIRED` | 409  | แก้ไขรีวิวได้ภายใน 7 วันหลังเขียนเท่านั้น                |
| `PORTFOLIO_FULL`             | 409  | แกลเลอรีผลงานเต็ม (สูงสุด 30 รูป)                        |

## Known Limitations

- **CSP ใช้ `'unsafe-inline'` สำหรับ script/style** ไม่ได้ทำ nonce ต่อ request -- เพียงพอสำหรับ MVP
  แต่ถ้าต้องการ CSP ที่เข้มกว่านี้ ต้องย้าย inline script (theme toggle, JSON-LD) ไปใช้ nonce ที่สร้างใน
  `src/proxy.ts`
- **Rate limiting เป็น in-memory ต่อ process** ถ้า scale เป็นหลาย container ต้องย้ายไป Redis/Postgres
- **แปล UI เป็นภาษาอังกฤษไม่ครบ 100%** โครงสร้าง i18n (routing, `[locale]` segment, การแปล error
  message) ใช้งานได้จริงแล้ว แต่ข้อความ UI ส่วนใหญ่ยังเป็นภาษาไทยแข็งอยู่ในโค้ด ยังไม่ผ่าน
  `useTranslations` ทุกจุด
