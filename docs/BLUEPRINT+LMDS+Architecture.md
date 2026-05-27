# BLUEPRINT: LMDS Architecture V5.4.001

> เอกสารสถาปัตยกรรมระบบ LMDS (Logistics Master Data System) ฉบับเต็ม
> ร่างสถาปัตยกรรมระดับ Core-System ชี้แจ้ง Data Schema, Pipeline Mechanics, Module Specification สำหรับนักพัฒนาระบบ
> Version: 5.4.001 | Last Updated: 2026-05-24

---

## สารบัญ

1. [เป้าหมายระบบ](#1-เป้าหมายระบบ)
2. [The Trinity Framework](#2-the-trinity-framework)
3. [Hybrid Alias Architecture](#3-hybrid-alias-architecture)
4. [Layered Architecture](#4-layered-architecture)
5. [Data Model](#5-data-model)
6. [Module Specification](#6-module-specification)
7. [Global Pipeline Mechanics](#7-global-pipeline-mechanics)
8. [Match Engine — Rules Matrix](#8-match-engine--rules-matrix)
9. [Execution Flow](#9-execution-flow)
10. [Caching Strategy](#10-caching-strategy)
11. [Dependencies Matrix](#11-dependencies-matrix)
12. [Error Handling & Disaster Prevention](#12-error-handling--disaster-prevention)
13. [Configuration & Schema System](#13-configuration--schema-system)
14. [Production Notes](#14-production-notes)
15. [Migration Guide](#15-migration-guide)
16. [Single Writer Pattern (V5.4.001)](#16-single-writer-pattern-v54001)
17. [Search Service — Tier Architecture](#17-search-service--tier-architecture)

---

## 1. เป้าหมายระบบ

LMDS ออกแบบเพื่อเป็น **Master Data + Matching Engine** สำหรับข้อมูลขนส่งที่คุณภาพไม่สม่ำเสมอ โดยเน้น 3 เสาหลัก:

| เสาหลัก | คำอธิบาย | กลไกในระบบ |
|---------|----------|------------|
| **Data Quality** | ข้อมูลถูกทำความสะอาด Normalize และตรวจสอบก่อนเข้าระบบ | NormalizeService, ThGeoService, 4-level Address Enrichment |
| **Traceability** | ทุกการตัดสินใจของระบบมีหลักฐานบันทึกสำหรับตรวจสอบย้อนหลัง | `match_evidence`, `SYNC_STATUS`, `SYS_LOG`, Audit Trail |
| **Operational Continuity** | ระบบรันได้ทันทีกับข้อมูลใหม่ ไม่ต้อง Backfill ข้อมูลเก่า | Incremental Processing, Time Guard + Auto-Resume, LockService |

จุดเด่นสำคัญของ LMDS คือการเป็นทั้ง **Master Data Repository** และ **Matching Engine** ในระบบเดียวกัน ระบบออกแบบมาเพื่อรับมือกับข้อมูลขนส่งที่คุณภาพไม่สม่ำเสมอ อาจมีการพิมพ์ผิด ชื่อไม่ตรงกัน ที่อยู่ไม่ครบ หรือข้อมูลซ้ำซ้อน ระบบจะทำการ Normalize ข้อมูลเหล่านั้น จับคู่กับ Master ที่มีอยู่ และตัดสินใจว่าจะสร้างรายการใหม่ จับคู่อัตโนมัติ หรือส่งเข้าคิวตรวจสอบโดยมนุษย์ (Human-in-the-loop) ตามความเหมาะสม นอกจากนี้ยังมีระบบ Alias ที่ช่วยจดจำชื่อที่เขียนแตกต่างกันแต่หมายถึงบุคคลหรือสถานที่เดียวกัน ทำให้การจับคู่มีประสิทธิภาพสูงขึ้นเรื่อยๆ เมื่อระบบทำงานต่อเนื่อง

---

## 2. The Trinity Framework

LMDS Architecture รันด้วยตรรกะแบบแยกฐานข้อมูลเชิงสัมพันธ์ **"The Trinity Framework"**:

> การมีอยู่ของการจัดส่ง (Transaction/Fact) 1 ชิ้น จะผูกกันด้วย 3 เสาหลัก + 1 ตาราง Intersection

### 2.1 เสาหลักทั้ง 3

| เสา | ตาราง | บทบาท | กลไกหลัก |
|-----|-------|--------|----------|
| **WHO** | `M_PERSON` | ระบุตัวตนบุคคล | กรอง Phone + Note จากข้อมูล Unstructured → Identify บุคคล |
| **WHERE-Address** | `M_PLACE` | ระบุสถานที่ตามที่อยู่ | `RAW_ADDRESS` + `RESOLVED_ADDR` + `SYS_TH_GEO` 16 คอลัมน์ → ประกอบร่างที่อยู่สมบูรณ์ |
| **WHERE-Coordinate** | `M_GEO_POINT` | ระบุพิกัด GPS | แกะ Coordinate จากเช็คอิน + `GEO_RADIUS_M` → จับรัศมีขยะ (Duplicate Location Merging ≤ 50m) |

แต่ละเสาทำงานอย่างอิสระในการจับคู่และสร้างข้อมูล แต่เชื่อมโยงกันผ่านตาราง Intersection ทำให้สามารถสืบค้นข้อมูลข้ามเสาได้อย่างมีประสิทธิภาพ เช่น การค้นหาพิกัดจากชื่อบุคคล หรือการหาสถานที่ทั้งหมดที่บุคคลหนึ่งเคยรับสินค้า

### 2.2 ตาราง Intersection

`M_DESTINATION` — ตารางศูนย์กลางสร้าง **Intersection Object Map**:

```
Person_ID + Place_ID + Geo_ID = 1 Destination Node
```

Destination เป็น Object ที่เชื่อมโยงทั้ง 3 เสาเข้าด้วยกัน ทำให้สามารถอ้างอิงการจัดส่งได้อย่างชัดเจนและสมบูรณ์ หากมีการเปลี่ยนแปลงที่เสาใดเสาหนึ่ง สามารถระบุได้ทันทีว่ากระทบ Destination ใดบ้าง ตัวอย่างเช่น ถ้าบุคคล A มีพิกัดอยู่ 3 จุด (บ้าน, ออฟฟิศ, คลังสินค้า) ระบบจะสร้าง Destination 3 รายการ แต่ละรายการจะผูก Person A เข้ากับ Place และ Geo ที่แตกต่างกัน

---

## 3. Hybrid Alias Architecture

### 3.1 ภาพรวม

Hybrid Alias Architecture เป็นระบบจัดการชื่อแฝง (Alias) แบบคู่ ที่รองรับทั้ง **Entity-specific Alias** (ระดับ Local) และ **Global Alias Ledger** (ระดับ Global) โดยมี `master_uuid` เป็นกุญแจเชื่อมโยง ระบบนี้ช่วยแก้ปัญหาหลักคือ ข้อมูลขนส่งมักมีชื่อเดียวกันแต่เขียนต่างกัน เช่น "บริษัท สยาม คอนกรีต จำกัด", "สยามคอนกรีต", "Siam Concrete" ทั้งหมดหมายถึงบริษัทเดียวกัน ระบบ Alias จะจดจำชื่อทั้งหมดและเชื่อมโยงกลับไปยัง Master เดียวกัน

```
┌─────────────────────────────────────────────────────────────┐
│                    Hybrid Alias Architecture                 │
│                                                              │
│  ┌──────────────┐     ┌──────────────┐                      │
│  │ M_PERSON      │     │ M_PLACE      │                      │
│  │ person_id     │     │ place_id     │                      │
│  │ master_uuid ◄─┤     │ master_uuid ◄─┤                      │
│  └──────┬───────┘     └──────┬───────┘                      │
│         │                    │                               │
│  ┌──────▼───────┐     ┌──────▼───────┐                      │
│  │M_PERSON_ALIAS│     │M_PLACE_ALIAS │   ← Entity-specific  │
│  │ (Local)      │     │ (Local)      │                      │
│  └──────┬───────┘     └──────┬───────┘                      │
│         │                    │                               │
│         └───────┬────────────┘                               │
│                 ▼                                             │
│          ┌─────────────┐                                     │
│          │   M_ALIAS    │   ← Global Alias Ledger            │
│          │ master_uuid  │                                     │
│          │ variant_name │                                     │
│          │ entity_type  │                                     │
│          │ confidence   │                                     │
│          └─────────────┘                                     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 หลักการสำคัญ

| หลักการ | รายละเอียด |
|---------|-----------|
| **Single Writer Pattern** | `autoEnrichAliasesFromFactBatch_()` ใน `10_MatchEngine.gs` เป็นจุดเขียน M_ALIAS จุดเดียวใน Pipeline อัตโนมัติ การเขียนจากที่อื่น (Migration/Admin) ต้องผ่าน `21_AliasService.gs` เท่านั้น |
| **master_uuid เป็นกุญแจข้ามโดเมน** | `M_PERSON` และ `M_PLACE` มีคอลัมน์ `master_uuid` (UUID v4) เพื่อเชื่อมโยง Entity เดียวกันที่อาจมีหลายรูปแบบชื่อ UUID นี้ถูกสร้างตอน `createPerson()` / `createPlace()` และไม่เปลี่ยนแปลงตลอดอายุของ Entity |
| **Runtime Fast-path** | resolve global alias → `master_uuid` → map → `person_id`/`place_id` → ลด false-negative ในเคสพิมพ์ไม่ตรงมาตรฐาน เส้นทางนี้ใช้โดย `fastLookupByShipToName()` สำหรับ Group 2 ทำให้ค้นหาพิกัดจากชื่อเร็วขึ้นมากโดยไม่ต้องผ่าน resolvePerson/resolvePlace |
| **Backward Compatibility** | ระบบยังคงรองรับ `M_PERSON_ALIAS` และ `M_PLACE_ALIAS` แบบเดิม สามารถทำงานร่วมกับ Global Alias ได้ การค้นหา Candidate จะค้นในทั้ง Local Alias และ Global Alias |
| **Circular Dependency Prevention** | ลบ `syncAliasToEntityTable_()` ออกแล้ว — เดิมทีมีปัญหา `createGlobalAlias() → syncAliasToEntityTable_() → createPersonAlias() → createGlobalAlias()` วนลูปไม่รู้จบ ตอนนี้ M_PERSON_ALIAS และ M_PLACE_ALIAS เขียนที่ `autoEnrichAliasesFromFactBatch_()` เท่านั้น |

### 3.3 M_ALIAS Schema (8 คอลัมน์)

| ดัชนี | ชื่อคอลัมน์ | ประเภท | คำอธิบาย |
|-------|-----------|--------|----------|
| 0 | `alias_id` | string | รหัส Alias เช่น `A_xxxx` (สร้างด้วย `generateShortId('A')`) |
| 1 | `master_uuid` | string | UUID v4 ที่เชื่อมโยงกับ M_PERSON หรือ M_PLACE |
| 2 | `variant_name` | string | ชื่อแฝง/รูปแบบอื่นที่ใช้เรียก Entity เดียวกัน (เก็บชื่อดิบไว้ ยังไม่ normalize) |
| 3 | `entity_type` | string | `PERSON` หรือ `PLACE` — บอกว่า UUID นี้เชื่อมกับโดเมนไหน |
| 4 | `confidence` | number | ระดับความมั่นใจ (0-100) — canonical=100, PERSON variant=95, PLACE variant=90 |
| 5 | `source` | string | แหล่งที่มา เช่น `AUTO_ENRICH_FACT`, `MIGRATION`, `ADMIN_MERGE_ACT`, `SCG_RAW_IMPORT`, `FACT_DELIVERY_IMPORT` |
| 6 | `created_at` | datetime | วันเวลาที่สร้าง |
| 7 | `active_flag` | boolean | `true` (Active) หรือ `false` (Inactive) — ใช้ในการกรองตอนค้นหา |

### 3.4 Auto-Enrich กลไก

เมื่อ Pipeline ประมวลผลเสร็จ ระบบจะเขียน Alias อัตโนมัติจาก FACT_DELIVERY ผ่าน `autoEnrichAliasesFromFactBatch_()`:

1. **PERSON canonical** → M_ALIAS (confidence 100) — ชื่อสะอาดที่ได้จาก Normalize
2. **PERSON variant** (ShipToName) → M_ALIAS (confidence 95) + M_PERSON_ALIAS — ชื่อดิบที่ยังไม่ผ่านการทำความสะอาด
3. **PLACE canonical** → M_ALIAS (confidence 100) — ชื่อสถานที่สะอาด
4. **PLACE variant** (ShipToAddr) → M_ALIAS (confidence 90) + M_PLACE_ALIAS — ที่อยู่ดิบจาก SCG

ทั้งหมดใช้ Set-based dedup เพื่อป้องกันการเขียนซ้ำ — ระบบจะโหลด Alias ที่มีอยู่แล้วใน M_ALIAS, M_PERSON_ALIAS, M_PLACE_ALIAS มาสร้างเป็น Set ก่อน แล้วตรวจสอบว่าชื่อที่จะเขียนซ้ำหรือไม่ ถ้าซ้ำจะข้ามไป

### 3.5 Dedup Key Format

| ชีต | Dedup Key | ตัวอย่าง |
|------|-----------|---------|
| M_ALIAS | `ENTITY_TYPE::masterUuid::normalizedVariant` | `PERSON::a1b2c3d4::สยามคอนกรีต` |
| M_PERSON_ALIAS | `personId::normalizedVariant` | `PS1234::สยามคอนกรีต` |
| M_PLACE_ALIAS | `placeId::normalizedVariant` | `PL5678::123/45ถ.พระราม9` |

การใช้ `normalizeForCompare()` ในการสร้าง key ทำให้ชื่อที่เขียนต่างกันเล็กน้อย (เช่น ช่องว่าง, ตัวพิมพ์เล็ก/ใหญ่) ถูกจับคู่เป็น alias เดียวกัน

---

## 4. Layered Architecture

ระบบ LMDS ออกแบบด้วยสถาปัตยกรรมแบบแยกชั้น 6 ชั้นหลัก:

### Layer A: Ingestion Layer

| รายการ | รายละเอียด |
|--------|-----------|
| **โมดูล** | `04_SourceRepository.gs` |
| **แหล่งข้อมูล** | SCG API, ไฟล์รายวัน, Input จากผู้ใช้งาน |
| **Landing Sheets** | `SCGนครหลวงJWDภูมิภาค`, `ตารางงานประจำวัน`, `Input` |
| **กลไกหลัก** | อ่านเฉพาะ Record ที่ `SYNC_STATUS != SUCCESS` สร้าง Source Object ต่อ Record กรอง Invoice ที่มีอยู่แล้วใน FACT_DELIVERY แบบ Set-based lookup |
| **Caching** | `SOURCE_ROWS_V3` — Cache source rows ที่อ่านแล้ว, `PROCESSED_INVOICES_V3` — Invoice set จาก FACT |

### Layer B: Normalization Layer

| รายการ | รายละเอียด |
|--------|-----------|
| **โมดูล** | `05_NormalizeService.gs`, `20_ThGeoService.gs` |
| **งานหลัก** | ทำความสะอาดชื่อ, เบอร์โทร, ที่อยู่, จังหวัด/อำเภอ/ตำบล, รหัสไปรษณีย์ |
| **กลไกหลัก** | 7-step Person Normalization (strip prefix → extract phone → extract doc ID → clean → normalize → build phonetic key → assemble), 4-step Place Normalization, Thai Phonetic Key, 80+ คำนำหน้าชื่อไทย |
| **ผลลัพธ์** | `normalizePersonNameFull()` คืน `{ cleanName, extractedPhone, deliveryNotes[], ... }`, `normalizePlaceName()` คืน `{ cleanPlace, placeType, notes[], ... }` |
| **ขยะไม่ทิ้ง** | ข้อมูลที่สกัดได้ (เลขบัตร, เบอร์โทร, คำนำหน้า) ถูกเก็บใน `deliveryNotes[]` → คอลัมน์ `NOTE` เพื่อใช้ Deep Note Search ภายหลัง |

### Layer C: Master Resolution Layer

| รายการ | รายละเอียด |
|--------|-----------|
| **โมดูล** | `06_PersonService.gs`, `07_PlaceService.gs`, `08_GeoService.gs`, `09_DestinationService.gs`, `10_MatchEngine.gs` |
| **กลไกหลัก** | Multi-strategy Candidate Search — Person 5 กลยุทธ์ (M_ALIAS Fast Path → Phone → Alias → Phonetic → Note Search), Place 4 กลยุทธ์ (M_ALIAS Fast Path → Alias → Phonetic → Note Search), Grid-based Proximity สำหรับ Geo, Trinity Intersection สำหรับ Destination |
| **Scoring** | Person: Dice + Levenshtein + Ratio (ต่างน้ำหนักตามความยาวชื่อ), Place: Dice + Levenshtein + Exact Bonus, Phone Match = 95 คะแนนอัตโนมัติ |

### Layer D: Hybrid Alias Layer

| รายการ | รายละเอียด |
|--------|-----------|
| **โมดูล** | `21_AliasService.gs` |
| **Local Alias** | `M_PERSON_ALIAS` (6 คอลัมน์), `M_PLACE_ALIAS` (6 คอลัมน์) |
| **Global Alias** | `M_ALIAS` (8 คอลัมน์ — Global Alias Ledger) |
| **Cross-domain Identity** | `master_uuid` ใน `M_PERSON` (col 9), `M_PLACE` (col 13) |
| **Runtime Fast-path** | `fastLookupByShipToName()` — ShipToName → M_ALIAS reverse index → masterUuid → entityId → dest → lat,lng |
| **Read Path** | `loadGlobalAliasesMap_()` — uuid → variants[], `loadGlobalAliasReverseIndex_()` — variant → {masterUuid, entityType}[] |
| **Write Path** | ⚠️ Pipeline: `autoEnrichAliasesFromFactBatch_()` เท่านั้น, Admin/Migration: `createGlobalAlias()`, `MIGRATION_HybridAliasSystem()` |

### Layer E: Transaction & Review Layer

| รายการ | รายละเอียด |
|--------|-----------|
| **โมดูล** | `11_TransactionService.gs`, `12_ReviewService.gs` |
| **ธุรกรรม** | ข้อมูลลง `FACT_DELIVERY` — 32 คอลัมน์ บันทึกผลการจับคู่ทั้งหมด รวมถึง match_evidence สำหรับตรวจสอบย้อนหลัง |
| **คิวรอตรวจ** | เคสคลุมเครือเข้า `Q_REVIEW` — 22 คอลัมน์ พร้อม Candidate IDs (JSON-encoded) และ Recommendation |
| **Human Decision** | `CREATE_NEW` / `MERGE_TO_CANDIDATE` / `IGNORE` / `ESCALATE` — เลือกผ่าน Dropdown ในชีต Q_REVIEW ระบบประมวลผลทันทีผ่าน `onEdit()` trigger |
| **Color Coding** | GEO_NEARBY_YELLOW → `#fff2cc`, GEO_NEARBY_ORANGE → `#fce5cd` — ช่วยให้ผู้ตรวจสอบเห็นระดับความสำคัญของเคส |

### Layer F: Governance & Hardening Layer

| รายการ | รายละเอียด |
|--------|-----------|
| **โมดูล** | `19_Hardening.gs`, `03_SetupSheets.gs` (SYS_LOG), `13_ReportService.gs` |
| **งานหลัก** | Preflight checks (ตรวจสอบชีต, Schema, API Key ก่อนรัน), Audit Log (SYS_LOG auto-clean at 5,000 rows), Quality Reporting (RPT_DATA_QUALITY), Duplicate Detection (detectDoubleProcessing) |
| **Diagnostic** | `diagnoseSystemState()` — วินิจฉัยแบบครบวงจร: ตรวจชีต, คอลัมน์, ข้อมูลว่าง, SYNC_STATUS, SYS_LOG Errors พร้อมวิธีแก้ |

---

## 5. Data Model

### 5.1 Master Tables

#### M_PERSON (10 คอลัมน์)

| ดัชนี | ชื่อ | ประเภท | คำอธิบาย |
|-------|------|--------|----------|
| 0 | `person_id` | string | รหัสบุคคล เช่น `P_xxxx` (สร้างด้วย `generateShortId('P')`) |
| 1 | `canonical_name` | string | ชื่อมาตรฐานที่สะอาดแล้ว (ผ่าน `normalizePersonNameFull()`) |
| 2 | `normalized_name` | string | ชื่อที่ normalize แล้วสำหรับการเปรียบเทียบ (ใช้ `normalizeForCompare()`) |
| 3 | `phone` | string | เบอร์โทรที่สกัดได้ (เก็บด้วย single-quote prefix เพื่อรักษา leading zero) |
| 4 | `first_seen` | datetime | วันที่พบครั้งแรก |
| 5 | `last_seen` | datetime | วันที่พบล่าสุด (อัปเดตทุกครั้งที่ AUTO_MATCH) |
| 6 | `usage_count` | number | จำนวนครั้งที่ใช้ใน FACT (อัปเดตทุกครั้งที่ AUTO_MATCH) |
| 7 | `status` | string | `Active` / `Merged` (Merged = ถูกรวมเข้า personId อื่น) |
| 8 | `note` | string | หมายเหตุ/รหัสที่สกัดได้ (Deep Note Search) — เก็บเป็น comma-separated |
| 9 | `master_uuid` | string | UUID v4 สำหรับเชื่อมโยงข้ามโดเมน (สร้างด้วย `Utilities.getUuid()`) |

#### M_PLACE (14 คอลัมน์)

| ดัชนี | ชื่อ | ประเภท | คำอธิบาย |
|-------|------|--------|----------|
| 0 | `place_id` | string | รหัสสถานที่ เช่น `PL_xxxx` |
| 1 | `canonical_name` | string | ชื่อมาตรฐาน (ใช้ที่อยู่ที่ซ่อมแล้วจาก `getEnrichedGeoData()`) |
| 2 | `normalized_name` | string | ชื่อที่ normalize แล้วสำหรับเปรียบเทียบ |
| 3 | `place_type` | string | ประเภทสถานที่ (condo/mall/house/site/other) |
| 4 | `sub_district` | string | ตำบล/แขวง (จาก SYS_TH_GEO 100%) |
| 5 | `district` | string | อำเภอ/เขต (จาก SYS_TH_GEO 100%) |
| 6 | `province` | string | จังหวัด (จาก Whitelist 77 จังหวัด) |
| 7 | `postcode` | string | รหัสไปรษณีย์ |
| 8 | `first_seen` | datetime | วันที่พบครั้งแรก |
| 9 | `last_seen` | datetime | วันที่พบล่าสุด |
| 10 | `usage_count` | number | จำนวนครั้งที่ใช้ |
| 11 | `status` | string | `Active` / `Merged` |
| 12 | `note` | string | หมายเหตุ (เก็บ suffix, delivery note) |
| 13 | `master_uuid` | string | UUID v4 สำหรับเชื่อมโยงข้ามโดเมน |

#### M_GEO_POINT (14 คอลัมน์)

| ดัชนี | ชื่อ | ประเภท | คำอธิบาย |
|-------|------|--------|----------|
| 0 | `geo_id` | string | รหัสพิกัด เช่น `GE_xxxx` |
| 1 | `lat` | number | ละติจูด |
| 2 | `lng` | number | ลองจิจูด |
| 3 | `radius_m` | number | รัศมีรวมจุด (เมตร) — ใช้สำหรับ Tiered Spatial |
| 4 | `resolved_addr` | string | ที่อยู่ที่แก้แล้ว (จาก Google Maps หรือ Dictionary) |
| 5 | `province` | string | จังหวัด |
| 6 | `district` | string | อำเภอ/เขต |
| 7 | `source` | string | แหล่งที่มาของพิกัด (`driver`, `geocode`, `manual`) |
| 8 | `confidence` | number | ระดับความมั่นใจ |
| 9 | `first_seen` | datetime | วันที่พบครั้งแรก |
| 10 | `last_seen` | datetime | วันที่พบล่าสุด |
| 11 | `usage_count` | number | จำนวนครั้งที่ใช้ |
| 12 | `status` | string | `Active` / `Merged` |
| 13 | `extraction` | string | ข้อมูลการสกัดพิกัด |

#### M_DESTINATION (11 คอลัมน์)

| ดัชนี | ชื่อ | ประเภท | คำอธิบาย |
|-------|------|--------|----------|
| 0 | `dest_id` | string | รหัส Destination เช่น `DS_xxxx` |
| 1 | `person_id` | string | FK → M_PERSON |
| 2 | `place_id` | string | FK → M_PLACE |
| 3 | `geo_id` | string | FK → M_GEO_POINT |
| 4 | `lat` | number | ละติจูด (validated) |
| 5 | `lng` | number | ลองจิจูด (validated) |
| 6 | `route_label` | string | ป้ายกำกับเส้นทาง |
| 7 | `delivery_date` | string | วันที่จัดส่งล่าสุด |
| 8 | `usage_count` | number | จำนวนครั้งที่ใช้ |
| 9 | `last_seen` | string | วันที่พบล่าสุด |
| 10 | `status` | string | `Active` / `Merged` |

### 5.2 Alias Tables

#### M_PERSON_ALIAS (6 คอลัมน์)

| ดัชนี | ชื่อ | ประเภท | คำอธิบาย |
|-------|------|--------|----------|
| 0 | `alias_id` | string | รหัส Alias เช่น `PA_xxxx` |
| 1 | `person_id` | string | FK → M_PERSON |
| 2 | `alias_name` | string | ชื่อแฝง (เก็บชื่อดิบ) |
| 3 | `match_score` | number | คะแนนจับคู่ (95 สำหรับ auto-enrich) |
| 4 | `created_at` | datetime | วันที่สร้าง |
| 5 | `active_flag` | boolean | `true` / `false` |

#### M_PLACE_ALIAS (6 คอลัมน์)

| ดัชนี | ชื่อ | ประเภท | คำอธิบาย |
|-------|------|--------|----------|
| 0 | `alias_id` | string | รหัส Alias เช่น `PLA_xxxx` |
| 1 | `place_id` | string | FK → M_PLACE |
| 2 | `alias_name` | string | ชื่อแฝง (เก็บชื่อดิบ) |
| 3 | `match_score` | number | คะแนนจับคู่ (90 สำหรับ auto-enrich) |
| 4 | `created_at` | datetime | วันที่สร้าง |
| 5 | `active_flag` | boolean | `true` / `false` |

#### M_ALIAS — Global Alias Ledger (8 คอลัมน์)

(ดูรายละเอียดที่หัวข้อ 3.3)

### 5.3 Transaction Tables

#### FACT_DELIVERY (32 คอลัมน์)

| กลุ่ม | คอลัมน์หลัก | คำอธิบาย |
|-------|-----------|----------|
| **Identity** | `tx_id`, `invoice_no`, `shipment_no` | รหัสธุรกรรมและเอกสาร — tx_id สร้างด้วย `generateShortId('TX')` |
| **Trinity FK** | `person_id`, `place_id`, `geo_id`, `dest_id` | Foreign Key ไปยัง 3 เสา + Intersection |
| **Coordinate** | `raw_lat`, `raw_lng`, `resolved_lat`, `resolved_lng` | พิกัดจาก Master + พิกัดจริงจาก Source |
| **Match Info** | `match_status`, `match_confidence`, `match_reason`, `match_action`, `evidence` | หลักฐานการจับคู่ (Traceability) — evidence เช่น `name|geo`, `name|place|geo` |
| **Delivery** | `delivery_date`, `delivery_time`, `sold_to_name`, `ship_to_name`, `ship_to_address` | ข้อมูลการจัดส่ง |
| **Source** | `source_sheet`, `source_row`, `source_rec_id` | ตำแหน่งข้อมูลต้นทางสำหรับสืบค้นย้อนหลัง |
| **Status** | `record_status`, `created_at`, `updated_at` | สถานะและการติดตาม |

#### Q_REVIEW (22 คอลัมน์)

| กลุ่ม | คอลัมน์หลัก | คำอธิบาย |
|-------|-----------|----------|
| **Identity** | `review_id`, `invoice_no` | รหัส Review |
| **Decision** | `status`, `decision`, `priority` | สถานะ/การตัดสินใจ/ความสำคัญ (priority 1=สูงสุด, 3=ต่ำสุด) |
| **Source** | `raw_person`, `raw_place`, `raw_sys_addr`, `raw_lat`, `raw_lng` | ข้อมูลดิบจาก Source |
| **Candidates** | `cand_persons`, `cand_places`, `cand_geos`, `cand_dests` | JSON-encoded candidate IDs |
| **Recommendation** | `match_score`, `recommend` | คะแนนและคำแนะนำจากระบบ |

### 5.4 System Tables

#### SYS_LOG (6 คอลัมน์)
`timestamp`, `level` (INFO/WARN/ERROR/DEBUG), `module`, `message`, `detail`, `session_id` — Auto-clean ที่ 5,000 แถว ป้องกันชีตบวม

#### SYS_CONFIG (4 คอลัมน์)
`key`, `value`, `description`, `updated_at` — เก็บค่าที่ผู้ใช้ตั้งเอง เช่น GEMINI_API_KEY

#### SYS_TH_GEO (16 คอลัมน์)
ข้อมูลภูมิศาสตร์ไทย 7,537 รายการ — จังหวัด อำเภอ ตำบล รหัสไปรษณีย์ พร้อม metadata สำหรับค้นหา (clean, label, norm, search_key, postal_key, note_type, note_scope) เป็น Single Source of Truth สำหรับการแกะที่อยู่ภาษาไทย ค่าที่คืนจาก `getEnrichedGeoData()` ต้องตรงกับ SYS_TH_GEO 100%

#### MAPS_CACHE (10 คอลัมน์)
แคชผลลัพธ์ Google Maps API — `cache_key`, `input_addr`, `lat`, `lng`, `resolved_addr`, `province`, `district`, `hit_count`, `created_at`, `updated_at` — ป้องกันการเรียก API ซ้ำเมื่อที่อยู่เดียวกัน

### 5.5 Source Sheet

#### SCGนครหลวงJWDภูมิภาค (37 คอลัมน์)
ข้อมูลดิบจาก SCG API — ประกอบด้วย ลำดับ, ID, วันที่ส่ง, เวลา, พิกัดรวม, ชื่อคนขับ, ทะเบียนรถ, Shipment No, Invoice No, ชื่อปลายทาง, ที่อยู่ปลายทาง, ชื่อเจ้าของสินค้า, LAT, LNG, คลังสินค้า, ฯลฯ และ `SYNC_STATUS` ที่คอลัมน์ 36 (0-based) ซึ่งเป็นตัวบอกว่าแถวนั้นถูกประมวลผลแล้วหรือยัง

---

## 6. Module Specification

### 6.1 โมดูลหลัก (22 ไฟล์)

| ไฟล์ | ชื่อโมดูล | หน้าที่ | ฟังก์ชันสำคัญ |
|------|----------|--------|--------------|
| `00_App.gs` | Application Entry | จุดเริ่มระบบ, เมนู, Pipeline orchestration, Smart Navigation, Diagnostic | `runFullPipeline()`, `onEdit()`, `diagnoseSystemState()`, `handleSelectionChange_()` |
| `01_Config.gs` | System Configuration | Single Source of Truth สำหรับค่าคงที่ทั้งหมด | `validateConfig()`, `getGeminiApiKey()`, `invalidateAllGlobalCaches()` |
| `02_Schema.gs` | Sheet Schema | นิยาม Header ทุกชีต + ตรวจสอบความสม่ำเสมอ | `validateSheetHeaders()`, `validateSchemaConsistency()` |
| `03_SetupSheets.gs` | Sheet Setup & Logger | สร้างชีตทั้งหมด, auto-repair, ระบบ Logging | `setupAllSheets()`, `logInfo/Warn/Error/Debug()`, `clearOldLogs_()` |
| `04_SourceRepository.gs` | Source Data | อ่าน/กรอง/สร้าง Object จากข้อมูลดิบ | `getAllSourceRows()`, `getUnprocessedRows()`, `updateSyncStatus_()` |
| `05_NormalizeService.gs` | Normalization | ทำความสะอาดชื่อและที่อยู่ภาษาไทย | `normalizePersonNameFull()`, `normalizePlaceName()`, `buildThaiPhoneticKey()`, `normalizeForCompare()` |
| `06_PersonService.gs` | Person Master | CRUD + 5-strategy Candidate Search | `resolvePerson()`, `findPersonCandidates()`, `createPerson()`, `mergePersonRecords()`, `loadAllPersons_()` |
| `07_PlaceService.gs` | Place Master | CRUD + 4-level Address Enrichment | `resolvePlace()`, `findPlaceCandidates()`, `getEnrichedGeoData()`, `tryMatchBranch()`, `loadAllPlaces_()` |
| `08_GeoService.gs` | Geo Master | Grid-based Proximity + Tiered Spatial | `resolveGeo()`, `findGeoCandidates_()`, `haversineDistance()`, `createGeoPoint()` |
| `09_DestinationService.gs` | Destination Master | Trinity Intersection CRUD | `resolveDestination()`, `createDestination()`, `getDestsByPersonId()`, `getDestsByPersonAndPlace()` |
| `10_MatchEngine.gs` | Match Engine | หัวใจ Pipeline: 8 Rules + Single Writer M_ALIAS | `runMatchEngine()`, `processOneRow()`, `makeMatchDecision()`, `executeDecision()`, `autoEnrichAliasesFromFactBatch_()` |
| `11_TransactionService.gs` | Transaction | FACT_DELIVERY upsert | `upsertFactDelivery()`, `findFactRowByInvoice_()` |
| `12_ReviewService.gs` | Review Queue | Human-in-the-loop management | `enqueueReview()`, `applyReviewDecision()`, `applyAllPendingDecisions()` |
| `13_ReportService.gs` | Reporting | รายงานคุณภาพข้อมูล | `buildFullQualityReport()`, `highlightHighPriorityReviews()` |
| `14_Utils.gs` | Utilities | ไลบรารีใช้ร่วม — String Similarity, GPS, AI, Retry | `diceCoefficient()`, `levenshteinDistance()`, `haversineDistanceM()`, `callGeminiAPI()`, `generateShortId()`, `callSpreadsheetWithRetry()` |
| `15_GoogleMapsAPI.gs` | Maps API | Geocoding + 3-layer Cache | `geocodeAddress()`, `reverseGeocode()`, `getRouteDistanceKm()` |
| `16_GeoDictionaryBuilder.gs` | Geo Dictionary | สร้าง/จัดการพจนานุกรมภูมิศาสตร์ไทย | `buildGeoDictionary()`, `lookupByPostcode()`, `scanAddressAgainstDictionary()` |
| `17_SearchService.gs` | Search Service | สะพาน Group 2 → Group 1, Multi-tier Search | `findBestGeoByPersonPlace()`, `runLookupEnrichment()`, `lookupSingleRow()` |
| `18_ServiceSCG.gs` | SCG API | ดึงข้อมูล SCG → ชีตรายวัน | `fetchDataFromSCGJWD()`, `applyMasterCoordinatesToDailyJob()`, `buildOwnerSummary()` |
| `19_Hardening.gs` | Hardening | Preflight Audit, Duplicate Detection, Alias Generation | `runPreflightAudit()`, `detectDoubleProcessing()`, `generatePersonAliasesFromHistory()` |
| `20_ThGeoService.gs` | Thai Geo Service | สกัดภูมิศาสตร์ไทยจากที่อยู่ดิบ | `extractGeoFromAddress()`, `populateGeoMetadata()`, `lookupPostcodeByArea()` |
| `21_AliasService.gs` | Alias Service | Hybrid Alias — Read path for Group 2, Admin Write, Migration, UUID Management | `fastLookupByShipToName()`, `resolveMasterUuidViaGlobalAlias()`, `createGlobalAlias()`, `MIGRATION_HybridAliasSystem()`, `assignMasterUuidIfMissing()`, `convertUuidToPersonId()` |

### 6.2 กลยุทธ์ Candidate Search

#### Person (5 กลยุทธ์)

| ลำดับ | กลยุทธ์ | คำอธิบาย | คะแนนหากตรง |
|-------|--------|----------|-------------|
| 1 | **M_ALIAS Fast Path** | ค้นหาใน Global Alias Ledger โดยตรง → masterUuid → personId | 100 (exact), 95 (substring), 90 (reverse substring) |
| 2 | **Phone Match** | จับคู่ด้วยเบอร์โทร (ทำความสะอาดแล้ว 9+ หลัก) | 95 |
| 3 | **Alias Match** | ค้นหาใน M_PERSON_ALIAS (normalize เทียบ) | ไปต่อ scoring |
| 4 | **Phonetic/Name Match** | Thai Phonetic Key + prefix 3 ตัวอักษร + `normalizeForCompare()` | Dice + Levenshtein + Ratio |
| 5 | **Note Search (Deep Match)** | ค้นหาในคอลัมน์ Note แบบ tokenized (แตกคำ ≥2 ตัวอักษร) | ไปต่อ scoring |

หาก M_ALIAS Fast Path พบ exact match (score ≥ 95) ระบบจะ return ทันทีโดยไม่ต้องค้นหากลยุทธ์อื่น เพื่อเพิ่มความเร็วในการจับคู่

#### Place (4 กลยุทธ์)

| ลำดับ | กลยุทธ์ | คำอธิบาย | คะแนนหากตรง |
|-------|--------|----------|-------------|
| 1 | **M_ALIAS Fast Path** | ค้นหาใน Global Alias Ledger โดยตรง → masterUuid → placeId | 100/95/90 |
| 2 | **Alias Match** | ค้นหาใน M_PLACE_ALIAS | ไปต่อ scoring |
| 3 | **Phonetic/Name Match** | Thai Phonetic Key + prefix 3 ตัวอักษร | Dice + Levenshtein |
| 4 | **Note Search** | ค้นหาในคอลัมน์ Note | ไปต่อ scoring |

นอกจากนี้ยังมี **Branch Match** (`tryMatchBranch()`) สำหรับร้านค้าห่วงโซ่ — ถ้าหาชื่อไม่เจอใน Candidate ปกติ ระบบจะลองค้นหาในรายชื่อ Chain Store (เช่น 7-Eleven, Lotus's, Big C) และจับคู่ตามจังหวัด

#### Geo (Grid-based Proximity)

| ขั้น | กลไก | คำอธิบาย |
|-----|------|----------|
| 1 | Grid Key Pre-filter | `floor(lat/0.01) + floor(lng/0.01)` → ค้นหาใน 3×3 grid (GEO_GRID_SIZE = 0.01 ≈ 1.1 km) |
| 2 | Haversine Distance | คำนวณระยะทางจริงเป็นเมตรระหว่างพิกัดใหม่กับพิกัดที่มีอยู่ใน M_GEO_POINT |
| 3 | Tiered Classification | ≤50m FOUND (auto-merge), 51-79m NEARBY_YELLOW (review), 80-100m NEARBY_ORANGE (review), >100m NOT_FOUND (สร้างใหม่) |

### 6.3 Scoring Algorithm

#### Person Scoring

```
IF phone match → score = 95
ELSE IF name length ≥ 4:
  score = Dice(0.5) + Levenshtein(0.3) + Ratio(0.2)
ELSE:
  score = Dice(0.6) + Levenshtein(0.4)

IF score < SCORE_MIN_THRESHOLD (60) → score = 0
```

ชื่อที่สั้นกว่า 4 ตัวอักษรจะให้น้ำหนัก Dice Coefficient มากกว่าเพราะ Levenshtein ไม่แม่นกับชื่อสั้น ตัวอย่างเช่น "สม" กับ "สม" ให้ Dice = 1.0 แต่ Levenshtein ก็ให้ 0 ด้วยเพราะต่างกัน 0 ตัว ดังนั้นต้องถ่วงน้ำหนักให้เหมาะสม

#### Place Scoring

```
IF exact match → score = 100
ELSE:
  score = Dice(0.6) + Levenshtein(0.4)

IF score < PLACE_SCORE_MIN (55) → score = 0
```

Place ให้น้ำหนัก Dice มากกว่า Person เพราะที่อยู่มักยาวกว่าชื่อคน ทำให้ Dice Coefficient แม่นยำกว่า

---

## 7. Global Pipeline Mechanics

### Phase A: Ingestion (SourceRepository.gs)

1. อ่าน `SCGนครหวงJWDภูมิภาค` จำกัดเพดาน Caching เฉพาะ Record ที่ `SYNC_STATUS != SUCCESS`
2. Filter และสร้าง Object Context 1 Record (รวบรวม `sysAddr`, `rawPlaceName`, `rawPersonName`, `lat`, `lng`, `invoiceNo`, `deliveryDate`)
3. กรอง Invoice ที่มีอยู่แล้วใน FACT_DELIVERY (Set-based lookup เพื่อป้องกัน duplicate)
4. Auto-mark รายการที่ถูกข้ามเป็น SUCCESS — แถวที่มี Invoice ซ้ำจะถูก mark เป็น SUCCESS ทันทีโดยไม่ต้องประมวลผลซ้ำ

### Phase B: Enrichment & Extraction (NormalizeService.gs / PlaceService.gs)

1. นำ Name เข้า Normalizer สกัดเลขรหัส (`\b[0-9]{8,}\b`) หรือเบอร์โทร (`+66..`)
2. วัตถุดิบ "ขยะ" ไม่ทิ้ง — Push Array แยกด้วย Comma → คอลัมน์ `NOTE` (Context for Deep Note Search) ตัวอย่างเช่น ถ้าชื่อดิบคือ "คุณสมหมาย 0891234567" ระบบจะสกัดได้ `cleanName = "สมหมาย"`, `extractedPhone = "0891234567"`, `deliveryNotes = ["คุณ", "0891234567"]`
3. Geo Hierarchy Strategy: แกะด้วย Array Regex หรือโค้ดไปรษณีย์ → เข้า Dictionary ลำดับคือ extractGeoFromAddress (16-col Search Key) → scanAddressAgainstDictionary → Regex+Fuzzy Lookup → lookupByPostcode (Fallback สุดท้าย)
4. Fallback (Plus Code + ภูมิลำเนาแหว่ง): `lookupPlaceAdminById_()` กู้คืน Province & District จาก M_PLACE ที่เชื่อมอยู่

### Phase C: Rules Matrix Resolution (10_MatchEngine.gs)

(ดูรายละเอียดที่หัวข้อ 8)

### Phase D: Persistence Control (Checkpoint & Chunking)

1. อัด Data เข้า Array — ทุกรอบ Batches (`BATCH_SIZE = 20`):
   - สาด Record Status ผ่าน `RangeList` (A1 Notations) ลด Overhead API Data Write 15-25%
   - บันทึก FACT_DELIVERY + Q_REVIEW + M_ALIAS + M_PERSON_ALIAS + M_PLACE_ALIAS ในครั้งเดียว
2. Time Guard: นับ `Date.now()` หาก > 300,000ms (5 นาที):
   - เซ็ต Trigger Script สวมวิญญาณ Job ยิงคำสั่งตื่นภายใน 60 วิ
   - ตัวเอง Kill การทำงาน — ป้องกันอาการค้างหรือ Corrupted Caches
3. Checkpoint: SYNC_STATUS ทำหน้าที่แทน Checkpoint — แถวที่ประมวลผลแล้วจะถูก mark เป็น SUCCESS ทำให้รอบถัดไปไม่ต้องทำซ้ำ

---

## 8. Match Engine — Rules Matrix

ตารางน้ำหนักการประเมิน 8 กฎหลัก ของ `makeMatchDecision()`:

| กฎ | ชื่อ | เงื่อนไข | Action | Priority |
|----|------|---------|--------|----------|
| 1 | **INVALID_LATLNG** | พิกัดจาก Source หายไป (lat=0, lng=0 หรือว่าง) | `REVIEW` Confidence: 0 | CRITICAL |
| 2 | **LOW_QUALITY** | ข้อมูลคุณภาพต่ำ (ชื่อสั้นเกิน/ที่อยู่ไม่ครบ) | `REVIEW` | HIGH |
| 3 | **GEO_PROVINCE_CONFLICT** | จังหวัดจาก Geo (ใน Master) ไม่ตรงกับจังหวัดจากที่อยู่ (ใน Source) | `REVIEW` Confidence: 50 | HIGH |
| 3.5 | **NEARBY_PENDING** | Tiered Spatial: ≤50m AutoMerge, 51-79m Yellow, 80-100m Orange, >100m Area ใหม่ | ตามระยะ | MEDIUM |
| 4 | **FULL_MATCH** | Person + Place + Geo ตรงทั้งหมด → `AUTO_MATCH` | `AUTO_MATCH` | — |
| 5 | **GEO_ANCHOR** | เจอ Geo เดิม + Person เดิม (Place อาจใหม่) → ใช้พิกัดเดิม | `AUTO_MATCH` | — |
| 6 | **FUZZY_MATCH** | Score ≥ THRESHOLD_AUTO (90) → จับคู่อัตโนมัติ | `REVIEW` | — |
| 7 | **ALL_NEW_WITH_GEO** | ทุกอย่างใหม่ แต่มีพิกัดถูกต้อง → สร้าง Master ใหม่ทั้งหมด | `CREATE_NEW` | — |
| 8 | **DEFAULT** | ไม่เข้ากฎไหน → ส่ง Review | `REVIEW` Priority: 3 | LOW |

### Confidence Score Calculation

กฎที่ให้ `AUTO_MATCH` จะคำนวณ confidence แบบถ่วงน้ำหนัก:

- **FULL_MATCH** (Rule 4): `geo(0.5) + person(0.3) + place(0.2)`
- **GEO_ANCHOR** (Rule 5): `geo(0.60) + person/Place(0.25/0.15)`

### Color Coding ใน Q_REVIEW และ Daily Job

| Tier | สี | เงื่อนไข | Hex |
|------|-----|---------|-----|
| Tier 0 | เขียว | Exact Match / M_ALIAS Fast Track | `#b6d7a8` |
| Tier 1 | เหลือง | Fuzzy Match / Fallback Match | `#ffe599` |
| NOT_FOUND | แดง | ไม่พบใน Master | `#f4cccc` |
| SCG API | ฟ้าอ่อน | SCG API Fallback | `#cfe2f3` |
| NEARBY_YELLOW | เหลืองอ่อน | Geo ใกล้เคียง 51-79m | `#fff2cc` |
| NEARBY_ORANGE | ส้มอ่อน | Geo ใกล้เคียง 80-100m | `#fce5cd` |

---

## 9. Execution Flow

### Happy Path

```
รับข้อมูลดิบ (Ingestion — 04_SourceRepository.gs)
        │
        │  กรอง SYNC_STATUS != SUCCESS
        │  สร้าง Source Object ต่อ Record
        │  กรอง Invoice ซ้ำ (Set-based)
        ▼
Normalize (ทำความสะอาดข้อมูล — 05_NormalizeService.gs + 20_ThGeoService.gs)
        │
        │  7-step Person Normalization
        │  4-step Place Normalization
        │  4-level Address Enrichment
        ▼
Resolve Person / Place / Geo
        │
        │  5-strategy Person Search (M_ALIAS → Phone → Alias → Phonetic → Note)
        │  4-strategy Place Search (M_ALIAS → Alias → Phonetic → Note)
        │  Grid-based Geo Proximity (3×3 grid → Haversine → Tiered)
        ▼
ตัดสินใจอัตโนมัติใน Match Engine (8 Rules — 10_MatchEngine.gs)
        │
        ├──→ AUTO_MATCH → เขียนผลลง FACT_DELIVERY + อัปเดต Stats
        ├──→ CREATE_NEW → สร้าง Master ใหม่ + เขียน FACT_DELIVERY
        └──→ REVIEW → ส่งเข้า Q_REVIEW (Human-in-the-loop)
                │
                ▼
        Auto-enrich Alias จากข้อมูลจริง (autoEnrichAliasesFromFactBatch_)
                │
                │  เขียน M_ALIAS (PERSON canonical+variant, PLACE canonical+variant)
                │  เขียน M_PERSON_ALIAS (variant ≠ canonical)
                │  เขียน M_PLACE_ALIAS (variant ≠ canonical)
                │  Set-based dedup ป้องกันซ้ำ
                ▼
        Mark SYNC_STATUS = SUCCESS
```

### Human-in-the-loop (Q_REVIEW)

```
Q_REVIEW รายการรอตรวจ
        │
        ├──→ CREATE_NEW → สร้าง Master ใหม่ทั้งหมด + FACT_DELIVERY
        ├──→ MERGE_TO_CANDIDATE → รวมเข้า Master ที่มีอยู่ (สร้าง Alias + mark Merged)
        ├──→ IGNORE → ข้ามรายการนี้
        └──→ ESCALATE → ส่งต่อให้ผู้บริหารตรวจสอบ
```

การตัดสินใจทำผ่าน Dropdown ในคอลัมน์ DECISION ของ Q_REVIEW เมื่อเลือกแล้ว `onEdit()` trigger จะเรียก `applyReviewDecision()` ทันที

### Smart Navigation

เมื่อคลิก Candidate ID ใน Q_REVIEW (ผ่าน Installable Trigger):
- ถ้าเป็น Person ID (PS...) → นำทางไปยัง M_PERSON
- ถ้าเป็น Place ID (PL...) → นำทางไปยัง M_PLACE
- ถ้าเป็น Geo ID (GP...) → นำทางไปยัง M_GEO_POINT
- ถ้าเป็น Dest ID (DS...) → นำทางไปยัง M_DESTINATION
- ระบบจะถามว่าต้องการไปที่ Master หรือประวัติขนส่ง (FACT_DELIVERY)

---

## 10. Caching Strategy

### 10.1 3-Layer Cache สำหรับ Google Maps API

| Layer | กลไก | TTL | วัตถุประสงค์ |
|-------|------|-----|-------------|
| **RAM Cache** | JavaScript Object in memory (`_mapsRamCache`) | 6 ชม. | ความเร็วสูงสุด สำหรับการเรียกซ้ำในรอบเดียวกัน ป้องกันการเรียก API ซ้ำใน batch เดียวกัน |
| **Sheet Cache** | MAPS_CACHE sheet | Forever | ข้ามรอบ execution, Rate Limit Shield — แม้ script restart ข้อมูลยังอยู่ มี hit_count ติดตามการใช้งาน |
| **API** | Google Maps API | — | Fallback เมื่อไม่มีใน Cache ทั้ง 2 ชั้น — เรียกแล้วเขียนลง Cache ทันที |

### 10.2 Global Dictionary Cache

| Cache Variable | ข้อมูล | ขนาด | วัตถุประสงค์ |
|---------------|--------|------|-------------|
| `_GLOBAL_GEO_DICT_CACHE` | SYS_TH_GEO 7,537 rows | ~16 Array Models | ป้องกัน I/O DataRead Timeout — อ่านครั้งเดียวใช้ตลอด batch |
| `_GLOBAL_GEO_POINTS_CACHE` | M_GEO_POINT ทั้งหมด + GridKey | N/A | Grid-based Proximity Search — คำนวณ grid key ครั้งเดียว |

### 10.3 CacheService สำหรับ Module Caches

| Module | Cache Key | ข้อมูล | TTL |
|--------|-----------|--------|-----|
| SourceRepository | `SOURCE_ROWS_V3` | Source rows ที่อ่านแล้ว | 6 ชม. |
| SourceRepository | `PROCESSED_INVOICES_V3` | Invoice set จาก FACT | 6 ชม. |
| GeoDictionaryBuilder | `POSTCODE_MAP_V3_CHUNK_*` | Postcode map (แบ่งเป็น 350-key chunks เพื่อไม่เกิน CacheService limit) | 6 ชม. |
| AliasService | `M_GLOBAL_ALIAS_ALL` | M_ALIAS map: `{ "ENTITY_uuid": ["variant1","variant2"] }` | 6 ชม. |
| AliasService | `M_GLOBAL_ALIAS_REVERSE` | Reverse index: `{ "normalized_variant": [{masterUuid, entityType}] }` | 6 ชม. |
| PersonService | `M_PERSON_ALL` | Person data (parsed objects) | 6 ชม. |
| PlaceService | `M_PLACE_ALL` | Place data (parsed objects) | 6 ชม. |
| PersonService | `M_PERSON_ALIAS_ALL` | Person alias raw data | 6 ชม. |
| PlaceService | `M_PLACE_ALIAS_ALL` | Place alias raw data | 6 ชม. |

Cache ทั้งหมดถูกล้างเมื่อเรียก `invalidateAllGlobalCaches()` — ซึ่งถูกเรียกที่จุดเริ่มต้นของ `runFullPipeline()` เพื่อให้อ่านข้อมูลใหม่จากชีต 100%

---

## 11. Dependencies Matrix

### Cross-Module Dependencies

```
00_App ← 01_Config, 02_Schema, 04, 10, 12, 19
01_Config ← (none — root constants)
02_Schema ← 01_Config (sheet names)
03_SetupSheets ← 01_Config, 02_Schema, 14_Utils
04_SourceRepository ← 01_Config, 14_Utils, 10_MatchEngine
05_NormalizeService ← (standalone — pure computation)
06_PersonService ← 01_Config, 05_Normalize, 14_Utils, 21_AliasService
07_PlaceService ← 01_Config, 05_Normalize, 14_Utils, 16_GeoDict, 20_ThGeo, 21_AliasService
08_GeoService ← 01_Config, 14_Utils, 07_PlaceService (Plus Code fallback)
09_DestinationService ← 01_Config, 14_Utils
10_MatchEngine ← 06, 07, 08, 09, 11, 12 (core orchestrator + M_ALIAS single writer)
11_TransactionService ← 01_Config, 08_GeoService, 14_Utils
12_ReviewService ← 06, 07, 08, 09, 11, 14_Utils
13_ReportService ← 12_ReviewService
14_Utils ← 01_Config
15_GoogleMapsAPI ← 01_Config, 14_Utils
16_GeoDictionaryBuilder ← 01_Config, 05_Normalize, 14_Utils, 20_ThGeo
17_SearchService ← 05_Normalize, 06, 07, 09, 14_Utils, 21_AliasService
18_ServiceSCG ← 01_Config, 17_SearchService, 21_AliasService
19_Hardening ← 05_Normalize, 06, 14_Utils, 21_AliasService
20_ThGeoService ← 01_Config, 05_Normalize, 16_GeoDictionaryBuilder
21_AliasService ← 01_Config, 05_Normalize, 06, 07, 09, 14_Utils
```

### External Dependencies

| Service | การใช้งาน | Quota/ข้อจำกัด |
|---------|----------|---------------|
| Google Maps API | Geocoding, Reverse Geocoding, Directions | Rate Limit, ใช้ Hybrid Cache ป้องกัน — มี RAM + Sheet cache 2 ชั้น |
| SCG API | ดึงข้อมูลงานจัดส่งรายวัน | Cookie-based Auth (ใส่ในชีต Input), API URL จาก PropertiesService |
| Google Gemini AI | 1.5-flash model สำหรับ AI Reasoning (Tier E) | API Key required (`AIza...` 39 chars), `USE_AI_REASONING = false` ปิดไว้โดย default |
| Google Apps Script | Runtime ทั้งหมด | 6 min execution limit (จัดการด้วย Time Guard + Auto-Resume), Quota per day, 50,000 read/write ops/day |

---

## 12. Error Handling & Disaster Prevention

### 12.1 Audit Traits Embedded (19_Hardening.gs + Evidence Trace)

ข้อมูลมีระดับของ Security และ Integrity ดังนี้:

1. **SYNC_STATUS Tracking**: หาก SCG API หรือ Pipeline เขียนล้มเหลว คอลัมน์ `SYNC_STATUS` ต้อง Report = **"ERROR" + Background แดง** — แถวที่ ERROR จะถูกลองใหม่ในรอบถัดไปเพราะ `getUnprocessedRows()` จะกรองเฉพาะ `SYNC_STATUS != SUCCESS`
2. **Evidence Trace**: Record ลงฐาน `FACT_DELIVERY` และตาราง Master ทราบเสมอว่ารหัส ID ชิ้นนั้นมาได้ด้วยอัลกอริทึมใด เนื่องจากติดตรา `match_evidence` (เช่น `name|geo`, `name|place|geo`) ไว้ตรวจสอบ Backtrace ภายหลัง

### 12.2 Error Handling Patterns

| Pattern | กลไก | ใช้ใน |
|---------|------|-------|
| **LockService** | ป้องกัน Concurrent Write — `LockService.getScriptLock()` | `runFullPipeline()`, `runMatchEngine()` — timeout 10 วินาที |
| **Time Guard** | Kill ที่ 5 นาที + Auto-Resume Trigger | `runMatchEngine()`, `runLookupEnrichment()` — ตั้ง trigger ยิงซ้ำใน 60 วินาที |
| **Exponential Backoff** | `callSpreadsheetWithRetry()` max 3 retries | ทุกการเรียก Spreadsheet API — ป้องกัน Rate Limit Error |
| **Safe UI Alert** | `safeAlert_()`, `safeUiAlert_()` catch errors | Trigger-safe UI operations — ป้องกัน error เมื่อรันจาก trigger |
| **Log Rotation** | Auto-clean SYS_LOG at 5,000 rows | `writeLog_()` — ป้องกันชีต SYS_LOG บวมเกิน |
| **Try-catch in autoEnrich** | Alias error ไม่กระทบ FACT | `flushBatches_()` — ห่อ `autoEnrichAliasesFromFactBatch_()` ด้วย try-catch เพื่อให้ SYNC_STATUS ถูกอัปเดตแม้ alias ล้มเหลว |

### 12.3 Preflight Checks (19_Hardening.gs)

ก่อนรัน Pipeline ระบบตรวจสอบ:
- ชีตทั้งหมดมีอยู่จริง (18+ ชีต)
- Schema columns ตรงกับที่คาดไว้ (`validateSchemaConsistency()`)
- API Key ตั้งค่าแล้ว (GEMINI_API_KEY format = `AIza` + 35 chars)
- SYNC_STATUS integrity (ไม่มีค้างอยู่ในสถานะผิดปกติ)

### 12.4 Diagnostic Tool

`diagnoseSystemState()` วินิจฉัยแบบครบวงจร:
1. ตรวจสอบชีตที่จำเป็น (12+ ชีต) — แจ้งเตือนถ้าขาด
2. ตรวจสอบ Column Mismatch (SCHEMA vs ชีตจริง) — สาเหตุหลักของชีตว่าง
3. ตรวจสอบ Source Data (SYNC_STATUS, INVOICE_NO, LAT/LNG)
4. ตรวจสอบ SYS_LOG Errors ล่าสุด (5 รายการ)
5. สรุปวิธีแก้ปัญหาพร้อม action items

---

## 13. Configuration & Schema System

### 13.1 AI Configuration (01_Config.gs)

| Parameter | ค่า | คำอธิบาย |
|-----------|-----|----------|
| `THRESHOLD_AUTO` | 90 | Score ≥ 90 → Auto Match (เขียว) |
| `THRESHOLD_REVIEW` | 70 | Score 70-89 → Review (เหลือง) |
| `THRESHOLD_IGNORE` | 50 | Score < 50 → ไม่พิจารณา (แดง) |
| `SCORE_MIN_THRESHOLD` | 60 | Min score สำหรับ Person — ต่ำกว่านี้ return 0 |
| `PLACE_SCORE_MIN` | 55 | Min score สำหรับ Place — ต่ำกว่านี้ return 0 |
| `MODEL` | `gemini-1.5-flash` | Gemini Model สำหรับ AI Reasoning |
| `BATCH_SIZE` | 20 | จำนวน Record ต่อ Batch |
| `RETRIEVAL_LIMIT` | 50 | จำนวน Candidate สูงสุดที่ดึง |
| `CACHE_TTL_SEC` | 21600 | Cache TTL = 6 ชม. |
| `GEO_RADIUS_M` | 50 | รัศมีรวมจุด GPS (เมตร) — ถ้าพิกัดใหม่อยู่ในรัศมี 50m ของพิกัดเดิม ถือว่าเดียวกัน |
| `USE_AI_REASONING` | false | ปิด AI Reasoning ไว้ (Phase 2 จะลบ Tier E ออก) |
| `TIME_LIMIT_MS` | 300000 | Time Guard: 5 นาที — ครบแล้วจะตั้ง trigger ยิงซ้ำ |

### 13.2 Schema Consistency

`02_Schema.gs` นิยาม Header ทุกชีต และมี `validateSchemaConsistency()` สำหรับตรวจสอบว่า:
- จำนวนคอลัมน์ใน SCHEMA ตรงกับจำนวน key ใน IDX object
- ทุกการเปลี่ยนแปลง Schema ต้องอัปเดต `01_Config.gs` (IDX) และ `02_Schema.gs` (SCHEMA) พร้อมกัน
- `validateConfig()` ถูกเรียกทุกครั้งที่เปิด Spreadsheet (ใน `onOpen()`)

---

## 14. Production Notes

### 14.1 ข้อควรปฏิบัติ

- ระบบพร้อมรันข้อมูลใหม่แบบเต็มระบบ ไม่บังคับ Migration/Backfill ข้อมูลเก่า (ตามนโยบาย) — ข้อมูลเก่าจะคงอยู่ใน FACT_DELIVERY และ Master เดิม ส่วนข้อมูลใหม่จะถูกประมวลผลผ่าน Pipeline ปกติ
- ต้องรักษา Header Order ให้ตรง Schema เสมอ — การเปลี่ยนลำดับคอลัมน์ทำให้ข้อมูลผิดตำแหน่งเพราะระบบใช้ 0-based index ในการอ่านเขียน
- ทุกการเปลี่ยนแปลง Schema ต้องอัปเดต `01_Config.gs` และ `02_Schema.gs` พร้อมกัน — ถ้าอัปเดตอันเดียว `validateConfig()` จะโยน Error
- `autoEnrichAliasesFromFactBatch_()` เป็น Single Writer สำหรับ M_ALIAS — ห้ามเพิ่มจุดเขียนอื่นใน Pipeline ถ้าต้องการเขียน M_ALIAS จากที่อื่น ให้ใช้ `createGlobalAlias()` ใน 21_AliasService.gs (สำหรับ Admin/Migration เท่านั้น)
- ควรรัน `checkSystemIntegrity()` และ `runPreflightAudit()` ก่อนรัน Pipeline ทุกครั้ง

### 14.2 ข้อควรหลีกเลี่ยง

- ❌ ห้ามเขียน M_ALIAS จากนอก `10_MatchEngine.gs` (Pipeline) และ `21_AliasService.gs` (Admin/Migration) — เพื่อรักษา Single Writer Pattern
- ❌ ห้ามใช้ `syncAliasToEntityTable_()` — ถูกลบออกแล้ว (เคยเป็นสาเหตุ Circular Dependency: `createGlobalAlias → sync → createPersonAlias → createGlobalAlias`)
- ❌ ห้ามข้าม `validateConfig()` หลังการเปลี่ยนแปลง Config — ระบบอาจทำงานผิดพลาดโดยไม่มี Error message
- ❌ ห้ามรัน Pipeline โดยไม่ตรวจสอบ `checkSystemIntegrity()` ก่อน — อาจทำให้ข้อมูลเสียหาย
- ❌ ห้ามลบคอลัมน์ `master_uuid` ออกจาก M_PERSON (col 9) และ M_PLACE (col 13) — ระบบ Alias จะใช้งานไม่ได้

---

## 15. Migration Guide

### 15.1 การย้ายจากระบบเดิม (ไม่มี Hybrid Alias)

รันฟังก์ชัน `MIGRATION_HybridAliasSystem()` ใน `21_AliasService.gs`:

**ขั้นตอนทั้ง 5:**

1. **assignMasterUuidIfMissing()** — ตรวจสอบและกำหนด `master_uuid` ให้ M_PERSON และ M_PLACE ทุกรายการที่ยังไม่มี ใช้ `Utilities.getUuid()` สร้าง UUID v4 แบบ random ใหม่ทุกรายการ จำนวนที่เพิ่มจะถูกรายงานใน log
2. **migrate PersonAlias → M_ALIAS** — ย้ายข้อมูลจาก M_PERSON_ALIAS เข้า M_ALIAS โดยแปลง `person_id` → `master_uuid` ผ่าน `convertPersonIdToUuid()` แล้วเรียก `createGlobalAlias()` source = `V52_LEGACY_MIGRATION`
3. **migrate PlaceAlias → M_ALIAS** — ย้ายข้อมูลจาก M_PLACE_ALIAS เข้า M_ALIAS โดยแปลง `place_id` → `master_uuid` ผ่าน `convertPlaceIdToUuid()` source = `V52_LEGACY_MIGRATION`
4. **populateAliasFromSCGRawData_()** — สกัดชื่อจาก SCG Source sheet (คอลัมน์ RAW_PERSON_NAME) สร้าง Alias เพิ่ม ใช้ substring matching เพื่อจับคู่กับ Person/Place ที่มีอยู่ source = `SCG_RAW_IMPORT`
5. **populateAliasFromFactDelivery_()** — สกัด ShipToName จาก FACT_DELIVERY สร้าง Alias เพิ่ม source = `FACT_DELIVERY_IMPORT`

### 15.2 ข้อควรระวังระหว่าง Migration

- รันทีละขั้นตอน อย่าข้ามขั้น — โดยเฉพาะ Step 1 (UUID) ต้องรันก่อน Step 2-3 เพราะต้องมี `master_uuid` ก่อนถึงจะแปลง personId/placeId เป็น UUID ได้
- ตรวจสอบจำนวน Alias ที่สร้างในแต่ละขั้น — ถ้าจำนวนต่วน่าเกินไป อาจมีปัญหาในการจับคู่
- สำรองข้อมูลก่อนรัน Migration — แม้ระบบมี dedup แต่การสำรองข้อมูลเป็นแนวทางปฏิบัติที่ดี
- หลัง Migration เสร็จ รัน `validateSchemaConsistency()` เพื่อยืนยันความถูกต้อง
- รัน `invalidateAllGlobalCaches()` เพื่อล้าง Cache เก่าทั้งหมด

---

## 16. Single Writer Pattern (V5.4.001)

### 16.1 ภาพรวม

Single Writer Pattern ถูกนำมาใช้ใน V5.4.001 เพื่อแก้ปัญหา Circular Dependency และ Data Inconsistency ในระบบ Alias เดิม หลักการคือ **มีจุดเขียน M_ALIAS จุดเดียวใน Pipeline อัตโนมัติ** ทำให้สามารถควบคุมและตรวจสอบข้อมูล Alias ที่ถูกสร้างได้ทั้งหมด

### 16.2 สิ่งที่เปลี่ยนแปลง

| รายการ | ก่อน V5.4.001 | หลัง V5.4.001 |
|--------|--------------|--------------|
| `createPerson()` | เรียก `createGlobalAlias()` | ❌ ลบออก — M_ALIAS เขียนที่ autoEnrich เท่านั้น |
| `createPersonAlias()` | เรียก `createGlobalAlias()` | ❌ ลบออก — M_ALIAS เขียนที่ autoEnrich เท่านั้น |
| `createPlace()` | เรียก `createGlobalAlias()` | ❌ ลบออก — M_ALIAS เขียนที่ autoEnrich เท่านั้น |
| `createPlaceAlias()` | เรียก `createGlobalAlias()` | ❌ ลบออก — M_ALIAS เขียนที่ autoEnrich เท่านั้น |
| `mergePersonRecords()` | เรียก `createGlobalAlias()` | ✅ ยังเรียก (ADMIN_MERGE_ACT — Admin Action ปลอดภัย) |
| `syncAliasToEntityTable_()` | sync จาก M_ALIAS → Entity Alias | ❌ ลบทั้งฟังก์ชัน (เคยเป็นสาเหตุ circular) |
| `autoEnrichAliasesFromFactBatch_()` | เรียก `createGlobalAlias()` | ✅ เขียน Batch ตรงทั้ง 3 ชีตเอง |

### 16.3 กลไก autoEnrichAliasesFromFactBatch_()

```
autoEnrichAliasesFromFactBatch_(factBatch)
│
├── 1. โหลดข้อมูลอ้างอิง
│   ├── loadAllPersons_() → personMap: { personId → { canonical, normalized, masterUuid } }
│   └── loadAllPlaces_() → placeMap: { placeId → { canonical, normalized, masterUuid } }
│
├── 2. โหลด Alias ที่มีอยู่แล้ว (Dedup Sets)
│   ├── existingPersonAliasSet: "personId::normalized" (จาก M_PERSON_ALIAS)
│   ├── existingPlaceAliasSet: "placeId::normalized" (จาก M_PLACE_ALIAS)
│   └── existingGlobalAliasSet: "ENTITY_TYPE::masterUuid::normalized" (จาก M_ALIAS)
│
├── 3. สะสมแถวใหม่ (วนทุกแถวใน factBatch)
│   ├── PERSON canonical → M_ALIAS (confidence 100)
│   ├── PERSON variant (ShipToName) → M_ALIAS (confidence 95) + M_PERSON_ALIAS
│   ├── PLACE canonical → M_ALIAS (confidence 100)
│   └── PLACE variant (ShipToAddr) → M_ALIAS (confidence 90) + M_PLACE_ALIAS
│
├── 4. Batch Write ทั้ง 3 ชีต
│   ├── M_ALIAS → appendRows + clear Cache
│   ├── M_PERSON_ALIAS → appendRows + clear Cache
│   └── M_PLACE_ALIAS → appendRows + clear Cache
│
└── 5. Log สรุปจำนวน Alias ที่สร้าง
```

---

## 17. Search Service — Tier Architecture

### 17.1 ภาพรวม

`17_SearchService.gs` เป็นสะพานเชื่อม **Group 2 (ตารางงานประจำวัน)** → **Group 1 (Master Data)** โดยรับ ShipToName + ShipToAddress → ค้นหาพิกัดที่ดีที่สุด → เขียน LatLong_Actual ในชีตรายวัน พร้อมระบายสีตาม Tier

### 17.2 ลำดับการค้นหา (findBestGeoByPersonPlace)

| ลำดับ | Tier | กลยุทธ์ | Confidence | สี |
|-------|------|---------|-----------|-----|
| Step 1.5 | **Tier 0** | M_ALIAS Fast Track (`fastLookupByShipToName`) | 90 | เขียว |
| Step 2 | **Tier C** | Person anchor (`resolvePerson` → `getDestsByPersonId`) | 90 | เขียว |
| Step 3 | **Tier A** | Person + Place (`getDestsByPersonAndPlace`) | 92-98 | เขียว |
| Step 4 | **Tier B** | Place only fallback (`getDestsByPlaceId`) | 80 | เหลือง |
| Step 5 | **Tier D** | SCG API Fallback (parse latlng from API) | 50 | ฟ้าอ่อน |
| Step 6 | **Tier E** | AI Reasoning (Gemini — disabled by default) | 40 | — |
| Default | **NOT_FOUND** | ไม่พบข้อมูล | 0 | แดง |

### 17.3 Phase 2 TODO

- [ ] เขียนใหม่เป็น Tier 0 (Exact M_ALIAS ≥ 100) → Tier 1 (Fuzzy ≥ 85) → NOT_FOUND (red) — 3 Tier เท่านั้น
- [ ] ลบ Tier D (SCG Fallback) — พิกัดจาก SCG API ไม่น่าเชื่อถือ
- [ ] ลบ Tier E (AI Reasoning) — Gemini ไม่ควรเดาพิกัด
- [ ] เพิ่ม fuzzy matching ใน M_ALIAS reverse index (Dice ≥ 85)

---

*เอกสารฉบับนี้จัดทำสำหรับนักพัฒนาระบบ LMDS V5.4.001 — Logistics Master Data System with Hybrid Alias Architecture*
