# LMDS V5.4.001 (Hybrid Alias Architecture)

**Logistics Master Data System — Google Apps Script + Google Sheets**

---

## ภาพรวมระบบ

LMDS คือระบบ Master Data สำหรับงานขนส่งที่รับข้อมูลดิบจากงานประจำวัน (SCG API) ทำความสะอาดข้อมูล (Data Cleansing) จับคู่กับฐาน Master (Master Matching) และบันทึกผลเชิงธุรกรรมลง `FACT_DELIVERY` เพื่อให้ทีมปฏิบัติการใช้งานได้อย่างต่อเนื่องและตรวจสอบย้อนหลังได้

จุดเด่นสำคัญของ LMDS คือการเป็นทั้ง **Master Data Repository** และ **Matching Engine** ในระบบเดียวกัน โดยระบบออกแบบมาเพื่อรับมือกับข้อมูลขนส่งที่คุณภาพไม่สม่ำเสมอ อาจมีการพิมพ์ผิด ชื่อไม่ตรงกัน ที่อยู่ไม่ครบ หรือข้อมูลซ้ำซ้อน ระบบจะทำการ Normalize ข้อมูลเหล่านั้น จับคู่กับ Master ที่มีอยู่ และตัดสินใจว่าจะสร้างรายการใหม่ จับคู่อัตโนมัติ หรือส่งเข้าคิวตรวจสอบโดยมนุษย์ (Human-in-the-loop) ตามความเหมาะสม

---

## ข้อมูลเวอร์ชัน

| รายการ | ค่า |
|--------|-----|
| **App Version** | 5.4.001 |
| **Schema Version** | 5.4.001 |
| **App Name** | LMDS V5.4 |
| **Platform** | Google Apps Script + Google Sheets |
| **Core Engine** | MatchEngine V5.4 with Hybrid Alias Architecture |

---

## สถาปัตยกรรมหลัก

### The Trinity Framework

ระบบ LMDS ใช้ตรรกะ **"Trinity Framework"** — การมีอยู่ของการจัดส่ง 1 ชิ้น จะผูกกันด้วย 3 เสาหลัก:

| เสา | บทบาท | ตาราง |
|-----|--------|--------|
| **WHO** | ระบุตัวตนบุคคล | `M_PERSON` |
| **WHERE-Address** | ระบุสถานที่ตามที่อยู่ | `M_PLACE` |
| **WHERE-Coordinate** | ระบุพิกัด GPS | `M_GEO_POINT` |

และ **ตาราง Intersection** `M_DESTINATION` สร้าง Object Map: `Person_ID + Place_ID + Geo_ID = 1 Destination Node`

### Hybrid Alias Architecture (V5.4 ใหม่)

ระบบจัดการชื่อแฝงแบบคู่ ที่รองรับทั้ง Entity-specific Alias (Local) และ Global Alias Ledger:

- **Local Alias**: `M_PERSON_ALIAS`, `M_PLACE_ALIAS`
- **Global Alias Ledger**: `M_ALIAS` — ตารางกลางจัดการ alias ข้ามโดเมน
- **Cross-domain Identity**: `master_uuid` (UUID v4) ใน `M_PERSON` และ `M_PLACE`
- **Runtime Fast-path**: variant name → M_ALIAS → `master_uuid` → `person_id`/`place_id`
- **Single Writer Pattern**: `autoEnrichAliasesFromFactBatch_()` ใน `10_MatchEngine.gs` เป็นจุดเขียน M_ALIAS จุดเดียวใน Pipeline อัตโนมัติ

---

## โครงสร้างข้อมูลหลัก

### Master Tables

| ตาราง | คอลัมน์ | คำอธิบาย |
|--------|---------|----------|
| `M_PERSON` | 10 | ข้อมูลบุคคลหลัก + `master_uuid` |
| `M_PERSON_ALIAS` | 6 | Alias ระดับ Local สำหรับบุคคล |
| `M_PLACE` | 14 | ข้อมูลสถานที่หลัก + ที่อยู่ Enrich + `master_uuid` |
| `M_PLACE_ALIAS` | 6 | Alias ระดับ Local สำหรับสถานที่ |
| `M_ALIAS` | 8 | Global Alias Ledger (ข้ามโดเมน) |
| `M_GEO_POINT` | 14 | จุดพิกัด GPS + Grid-based Proximity |
| `M_DESTINATION` | 11 | Trinity Intersection (Person+Place+Geo) |

### Transaction / Operations

| ตาราง | คอลัมน์ | คำอธิบาย |
|--------|---------|----------|
| `FACT_DELIVERY` | 32 | ตารางธุรกรรมหลัก ผูกกับทุก Entity |
| `Q_REVIEW` | 22 | คิวรอตรวจสอบ Human-in-the-loop |
| `ตารางงานประจำวัน` | 29 | ข้อมูลงานรายวันจาก SCG API |
| `SCGนครหลวงJWDภูมิภาค` | 37 | Landing Sheet ข้อมูลดิบจาก SCG |

### System Tables

| ตาราง | คอลัมน์ | คำอธิบาย |
|--------|---------|----------|
| `SYS_CONFIG` | 4 | ตั้งค่าระบบ (API Key, Parameters) |
| `SYS_LOG` | 6 | บันทึกประวัติการทำงาน (Auto-clean at 5,000 rows) |
| `SYS_TH_GEO` | 16 | ฐานข้อมูลภูมิศาสตร์ไทย (7,537 รายการ) |
| `MAPS_CACHE` | 10 | แคชผลลัพธ์ Google Maps API |
| `RPT_DATA_QUALITY` | 8 | รายงานคุณภาพข้อมูล |

### Daily Operations Sheets

| ตาราง | คอลัมน์ | คำอธิบาย |
|--------|---------|----------|
| `Input` | 2 | ฟอร์มใส่ Cookie + ShipmentNos |
| `ข้อมูลพนักงาน` | 8 | ข้อมูลพนักงานขับรถ |
| `สรุป_เจ้าของสินค้า` | 6 | สรุปตาม SoldToName |
| `สรุป_Shipment` | 7 | สรุปตาม ShipmentNo+Truck |

---

## รายการไฟล์ในโปรเจกต์

| # | ไฟล์ | หน้าที่หลัก |
|---|------|-----------|
| 00 | `00_App.gs` | จุดเริ่มระบบ — Custom Menu, Pipeline Orchestration, Smart Navigation |
| 01 | `01_Config.gs` | ค่าคงที่ทั้งหมด — Sheet Names, Column Indices, AI Thresholds, Cache |
| 02 | `02_Schema.gs` | Schema ทุกชีต — Header Definitions, Validation |
| 03 | `03_SetupSheets.gs` | สร้างชีตทั้งหมด — Auto-repair, Logging System (SYS_LOG) |
| 04 | `04_SourceRepository.gs` | อ่าน/กรองข้อมูลดิบ — Caching, Sync Status Update |
| 05 | `05_NormalizeService.gs` | ทำความสะอาดข้อมูล — 80+ Thai Prefixes, Phone/Doc Extraction |
| 06 | `06_PersonService.gs` | Person CRUD — 5-strategy Candidate Search, Scoring |
| 07 | `07_PlaceService.gs` | Place CRUD — 4-level Address Enrichment, Branch Matching |
| 08 | `08_GeoService.gs` | Geo CRUD — Grid-based Proximity (3×3), Tiered Spatial |
| 09 | `09_DestinationService.gs` | Destination CRUD — Trinity Intersection |
| 10 | `10_MatchEngine.gs` | หัวใจ Pipeline — 8 Rules Matrix, Single Writer M_ALIAS |
| 11 | `11_TransactionService.gs` | FACT_DELIVERY — Upsert, Invoice Lookup |
| 12 | `12_ReviewService.gs` | Review Queue — Human-in-the-loop, Decision Application |
| 13 | `13_ReportService.gs` | รายงานคุณภาพ — Match Rates, Master Counts |
| 14 | `14_Utils.gs` | ไลบรารีใช้ร่วม — Dice, Levenshtein, Haversine, Gemini AI, Retry |
| 15 | `15_GoogleMapsAPI.gs` | Geocoding — 3-layer Cache (RAM → Sheet → API) |
| 16 | `16_GeoDictionaryBuilder.gs` | พจนานุกรมไทย — Postcode Lookup, Fuzzy Matching |
| 17 | `17_SearchService.gs` | สะพาน Group 2→1 — 6-tier Search for Daily Job |
| 18 | `18_ServiceSCG.gs` | SCG API — Fetch, Flatten, Aggregate, Summaries |
| 19 | `19_Hardening.gs` | ระบบป้องกัน — Preflight Audit, Duplicate Detection |
| 20 | `20_ThGeoService.gs` | Thai Geo Extraction — 3-tier Dictionary Search |
| 21 | `21_AliasService.gs` | Hybrid Alias — Fast Track Lookup, Migration, UUID Management |

---

## การติดตั้ง (First-time Setup)

### ขั้นตอนที่ 1: ผูก Apps Script กับ Google Spreadsheet

1. เปิด Google Spreadsheet ที่ต้องการใช้งาน
2. ไปที่ **Extensions → Apps Script**
3. คัดลอกไฟล์ `.gs` ทั้ง 22 ไฟล์ไปวางใน Script Editor (หรือใช้ clasp push)
4. ตรวจสอบว่าไฟล์ทั้งหมดอยู่ในลำดับที่ถูกต้อง (00-21)

### ขั้นตอนที่ 2: ตั้งค่า API Key

1. เปิดเมนู **LMDS V5.4** → **ตั้งค่าระบบ**
2. ใส่ Gemini API Key (รูปแบบ `AIza...`)
3. กดบันทึก

### ขั้นตอนที่ 3: สร้างชีตทั้งหมด

1. เปิดเมนู **LMDS V5.4** → **สร้างชีตทั้งหมด**
2. รอจนกว่าระบบจะสร้างชีตครบทั้งหมด (รวมถึง Header + Dropdown + Default Config)
3. ตรวจสอบว่ามีชีตครบ 18 ชีต

### ขั้นตอนที่ 4: เติมข้อมูล SYS_TH_GEO

1. นำเข้าข้อมูลภูมิศาสตร์ไทย (7,537 รายการ) ลงชีต `SYS_TH_GEO`
2. รันเมนู **เตรียม Geo Dictionary** เพื่อสร้าง Metadata columns (search_key, postal_key ฯลฯ)

### ขั้นตอนที่ 5: ทดสอบ Pipeline

1. ใส่ Cookie และ ShipmentNos ในชีต `Input`
2. รันเมนู **ดึงข้อมูล SCG** เพื่อดึงข้อมูลดิบ
3. รันเมนู **Run Full Pipeline** เพื่อทดสอบ 1 รอบ
4. ตรวจสอบผลใน `FACT_DELIVERY` และ `Q_REVIEW`

### ขั้นตอนที่ 6: (ถ้าย้ายระบบ) รัน Hybrid Alias Migration

1. รันเมนู **Hybrid Alias Migration** ใน `21_AliasService.gs`
2. ตรวจสอบจำนวน Alias ที่สร้างในแต่ละขั้น
3. ดูรายละเอียดเพิ่มเติมที่ `BLUEPRINT LMDS Architecture.md` หัวข้อ 15

---

## การใช้งานหลัก

### เมนูหลัก (LMDS V5.4)

| เมนู | ฟังก์ชัน | คำอธิบาย |
|------|----------|----------|
| **ดึงข้อมูล SCG** | `fetchDataFromSCGJWD()` | ดึงข้อมูลงานรายวันจาก SCG API → ชีตรายวัน + สรุป |
| **Run Full Pipeline** | `runFullPipeline()` | ประมวลผลข้อมูลดิบ → Master + FACT_DELIVERY |
| **ตรวจ Q_REVIEW** | `openReviewQueue()` | เปิดชีต Q_REVIEW สำหรับ Human-in-the-loop |
| **ดึงข้อมูล SCG** | `fetchDataFromSCGJWD()` | ดึงข้อมูลจาก SCG API ผ่าน Cookie |

### เมนูระบบ

| เมนู | ฟังก์ชัน | คำอธิบาย |
|------|----------|----------|
| **ตั้งค่าระบบ** | `setupEnvironment()` | ตั้งค่า Gemini API Key |
| **สร้างชีตทั้งหมด** | `setupAllSheets()` | สร้าง/ซ่อมแซมชีตทั้งหมด |
| **ตรวจสอบระบบ** | `checkSystemIntegrity()` | ตรวจ 18 ชีต + API Key |
| **วินิจฉัยระบบ** | `diagnoseSystemState()` | วินิจฉัยแบบละเอียด |
| **แสดงเวอร์ชัน** | `showVersionInfo()` | แสดงเวอร์ชันทุกโมดูล |

### เมนูรายงาน

| เมนู | ฟังก์ชัน | คำอธิบาย |
|------|----------|----------|
| **รายงานคุณภาพข้อมูล** | `buildFullQualityReport()` | สร้างรายงาน RPT_DATA_QUALITY |
| **จัดลำดับความสำคัญ** | `highlightHighPriorityReviews()` | ระบายสี Q_REVIEW ตาม Priority |

### เมนูขั้นสูง

| เมนู | ฟังก์ชัน | คำอธิบาย |
|------|----------|----------|
| **ตรวจ Preflight** | `runPreflightAudit()` | ตรวจสอบก่อนรัน Pipeline |
| **ตรวจ Invoice ซ้ำ** | `detectDoubleProcessing()` | ตรวจ Invoice ซ้ำใน FACT |
| **สร้าง Alias จากประวัติ** | `generatePersonAliasesFromHistory()` | สร้าง Alias จาก FACT_DELIVERY |
| **รีเซ็ต Sync Status** | `resetSourceSyncStatus()` | รีเซ็ต SYNC_STATUS ทั้งหมดเป็น PENDING |
| **ล้าง Maps Cache** | `clearMapsCache()` | ล้างแคช Google Maps API |

### การใช้งานประจำวัน (Workflow)

1. **ดึงข้อมูล SCG**: ใส่ Cookie + ShipmentNos → กดดึงข้อมูล
2. **Run Full Pipeline**: ประมวลผลข้อมูลเข้า Master + FACT_DELIVERY
3. **ตรวจ Q_REVIEW**: ดูเคสกำกวม → เลือก Decision (CREATE_NEW / MERGE / IGNORE / ESCALATE)
4. **รายงานคุณภาพ**: ตรวจสอบ Match Rate และ Master Data สถิติ

### Smart Navigation

เมื่อคลิกที่ Candidate ID ใน Q_REVIEW ระบบจะนำทางไปยังชีตที่เกี่ยวข้องอัตโนมัติ:
- Person ID → M_PERSON
- Place ID → M_PLACE
- Geo ID → M_GEO_POINT
- TX ID → FACT_DELIVERY

---

## กลไกการจับคู่ (Matching)

### Person Candidate Search (5 กลยุทธ์)

1. **M_ALIAS Fast Path** — ค้นหาใน Global Alias Ledger → master_uuid → personId
2. **Phone Match** — จับคู่ด้วยเบอร์โทร (score=95)
3. **Alias Match** — ค้นหาใน M_PERSON_ALIAS
4. **Phonetic/Name Match** — Thai Phonetic Key + Dice Coefficient
5. **Note Search (Deep Match)** — ค้นหาในคอลัมน์ Note

### Place Candidate Search (4 กลยุทธ์)

1. **M_ALIAS Fast Path** — ค้นหาใน Global Alias Ledger → master_uuid → placeId
2. **Alias Match** — ค้นหาใน M_PLACE_ALIAS
3. **Phonetic/Name Match** — Thai Phonetic Key + Dice Coefficient
4. **Note Search** — ค้นหาในคอลัมน์ Note

### Geo Proximity Search

- Grid-based 3×3 Pre-filter (`GEO_GRID_SIZE = 0.01` ≈ 1.1 km)
- Haversine Distance คำนวณระยะทางจริง
- Tiered Classification: ≤50m FOUND / 51-79m NEARBY_YELLOW / 80-100m NEARBY_ORANGE / >100m NOT_FOUND

### Match Engine Rules (8 กฎ)

| กฎ | Action | เงื่อนไข |
|----|--------|---------|
| INVALID_LATLNG | REVIEW_INVALID | พิกัดหาย |
| LOW_QUALITY | REVIEW | ข้อมูลคุณภาพต่ำ |
| GEO_PROVINCE_CONFLICT | REVIEW | จังหวัดไม่ตรง |
| NEARBY_PENDING | ตามระยะ | Tiered Spatial (50/80/100m) |
| FULL_MATCH | AUTO_MATCH | ตรงทั้ง 3 เสา |
| GEO_ANCHOR | AUTO_MATCH | เจอ Geo+Person เดิม |
| FUZZY_MATCH | AUTO_MATCH | Score ≥ 90 |
| ALL_NEW_WITH_GEO | CREATE_NEW | ทุกอย่างใหม่ มีพิกัด |

### Scoring Thresholds

| Score | Action | สี |
|-------|--------|-----|
| ≥ 90 | AUTO_MATCH | เขียว `#b6d7a8` |
| 70-89 | REVIEW | เหลือง `#ffe599` |
| < 50 | NOT_FOUND | แดง `#f4cccc` |

---

## กลไกการทำงานของ Pipeline

```
รับข้อมูลดิบ (SourceRepository)
    │
    ▼
Normalize (NormalizeService + ThGeoService)
    │   - 7-step Person Normalization
    │   - 4-step Place Normalization
    │   - 4-level Address Enrichment
    ▼
Resolve Person / Place / Geo
    │   - Multi-strategy Candidate Search
    │   - Grid-based Proximity Search
    ▼
Match Engine Decision (8 Rules)
    │
    ├──→ AUTO_MATCH → FACT_DELIVERY
    ├──→ CREATE_NEW → Master ใหม่ + FACT_DELIVERY
    └──→ REVIEW → Q_REVIEW (Human-in-the-loop)
            │
            ▼
    Auto-enrich Aliases (M_ALIAS + Entity Alias)
```

### Time Guard & Auto-Resume

- Pipeline มี Time Guard ที่ 300,000ms (5 นาที)
- หากใกล้หมดเวลา ระบบจะ:
  1. บันทึก Checkpoint ปัจจุบัน
  2. ตั้ง Time-based Trigger ให้ Resume ภายใน 60 วินาที
  3. Kill การทำงานปัจจุบัน
  4. Resume จาก Checkpoint ในรอบถัดไป

---

## ข้อควรระวังก่อน Production Run

### ตรวจสอบก่อนรัน

- [ ] Header ทุกชีตตรงกับ `SCHEMA` ใน `02_Schema.gs`
- [ ] `M_ALIAS` ถูกสร้างแล้วและเรียงคอลัมน์ถูกต้อง (8 คอลัมน์)
- [ ] `master_uuid` มีใน M_PERSON (col 9) และ M_PLACE (col 13)
- [ ] API Key ตั้งค่าแล้ว
- [ ] รัน `checkSystemIntegrity()` ผ่าน
- [ ] รัน `runPreflightAudit()` ผ่าน

### กฎสำคัญ

- **Single Writer Pattern**: `autoEnrichAliasesFromFactBatch_()` ใน `10_MatchEngine.gs` เป็นจุดเขียน M_ALIAS จุดเดียวใน Pipeline — ห้ามเพิ่มจุดเขียนอื่น
- **Schema + Config ต้องอัปเดตพร้อมกัน**: ทุกการเปลี่ยนแปลง Schema ต้องอัปเดต `01_Config.gs` (IDX) และ `02_Schema.gs` (SCHEMA) พร้อมกัน
- **Header Order**: ต้องรักษาลำดับ Header ให้ตรง Schema เสมอ — การเปลี่ยนลำดับคอลัมน์ทำให้ข้อมูลผิดตำแหน่ง
- **ข้อมูลใหม่ทันที**: ระบบรองรับการรันกับข้อมูลใหม่ได้ทันที ไม่บังคับ Backfill ข้อมูลเก่า

### สิ่งที่ห้ามทำ

- ❌ ห้ามเขียน M_ALIAS จากนอก `10_MatchEngine.gs` (Pipeline) และ `21_AliasService.gs` (Admin/Migration)
- ❌ ห้ามใช้ `syncAliasToEntityTable_()` — ถูกลบออกแล้ว (เคยเป็นสาเหตุ Circular Dependency)
- ❌ ห้ามข้าม `validateConfig()` หลังการเปลี่ยนแปลง Config
- ❌ ห้ามรัน Pipeline โดยไม่ตรวจสอบ `checkSystemIntegrity()` ก่อน

---

## การแก้ปัญหา (Troubleshooting)

| อาการ | สาเหตุที่เป็นไปได้ | วิธีแก้ |
|-------|-------------------|--------|
| Pipeline รันแล้วไม่มีข้อมูลใน Master | ข้อมูลดิบ SYNC_STATUS เป็น SUCCESS แล้ว | รัน **รีเซ็ต Sync Status** |
| ชีตหาย | ไม่ได้รัน Setup | รัน **สร้างชีตทั้งหมด** (auto-repair) |
| Q_REVIEW ไม่มี Dropdown | Setup ไม่สมบูรณ์ | รัน **สร้างชีตทั้งหมด** ใหม่ |
| Maps API Error | Quota หมด / ไม่มี Internet | ตรวจสอบ Log, ใช้ Cache |
| Pipeline Timeout | ข้อมูลเยอะเกิน 5 นาที | Time Guard จะ Auto-Resume อัตโนมัติ |
| Match Rate ต่ำ | Alias ไม่ครบ | รัน **สร้าง Alias จากประวัติ** |
| Invoice ซ้ำใน FACT | Bug ใน Pipeline | รัน **ตรวจ Invoice ซ้ำ** |

---

## เอกสารอ้างอิง

- **สถาปัตยกรรมเชิงลึก**: ดู `BLUEPRINT LMDS Architecture.md` สำหรับรายละเอียดครบถ้วนของสถาปัตยกรรมระบบ รวมถึง Data Model, Pipeline Mechanics, Rules Matrix, Caching Strategy และ Migration Guide
