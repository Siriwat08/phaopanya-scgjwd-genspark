**Cross-Validation Report** 

LMDS V5.4.001 — 5 AI vs Code Reality 

ตรวจสอบทุกข้อกล่าวอ้างว่าถูกหรือผิด โดยอ้างอิงโค้ดจริงใน Repository เปรียบเทียบผลจาก Claude / Genspark / Zai / Minimax / Gemini 

**4 Critical Issues Confirmed 1 Claim Corrected** 

ระบบ: Logistics Master Data System (LMDS) V5.4.001 

จำ นวนไฟล์: 22 .gs files (00\_App.gs — 21\_AliasService.gs) วันที่วิเคราะห์: 2026-05-25 

ผู้วิเคราะห์: Super Z (Independent Verification)  
สารบัญ 

1\. Verdict Matrix — ประเด็นหลัก 10 จุด (ตรวจกับโค้ดจริง) 2\. Verdict Score Board — คะแนน AI แต่ละรายการ 3\. Critical Findings — ยืนยันจากโค้ดจริง 

4\. Claim Correction — ข้อที่รายงานเดิมพลาด 5\. Additional Findings — สิ่งที่ Super Z พบเพิ่มเติม 6\. คำ แนะนำ จาก Super Z  
**1\. Verdict Matrix —** ประเด็นหลัก **10** จุด 

ตารางด้านล่างตรวจสอบทุกข้อกล่าวอ้างกับโค้ดจริงใน Repository ณ commit ล่าสุด 

**\#** ประเด็น **Claude Genspark Zai Minimax Gemini** ผลตัดสินจากโค้ดจริง 

**1**autoInstallSmartNav\_() ไม่มีใน codebase   
(กฎ 7\)พบ พบ พบ ไม่พบ ไม่พบ **2** loadCachedGeoRows\_() ซ้ำ 2 ไฟล์ พบ พบ พบ ไม่พบ ไม่พบ 

**3**updatePersonStats/PlaceStats/GeoStats()   
ใช้ setValue row-by-row**Critical** พบ พบ พบ คลุมเครือ 

**4**MIGRATION\_HybridAliasSystem() ไม่มี Time   
Guard**Critical** พบ ไม่พบ ไม่พบ ไม่พบ **5** 18\_ServiceSCG.gs hardcode index r\[28\] พบ พบ พบ พบ **PASS** 

**6**Single Writer violation ( populateAlias ใน   
SCG)**BUG-C1** ไม่พบ ไม่พบ ไม่พบ ไม่พบ 

**7** safeAlert\_() ซ้ำ 2 ไฟล์ (namespace) **Low-4** ไม่พบ ไม่พบ ไม่พบ ไม่พบ **8** No Fake Calls \= PASS (Gemini/Minimax) ไม่เห็นด้วยไม่เห็น   
**Claude/Genspark/Zai** ถูก — Grep ยืนยันมีแค่ call site ใน 00\_App.gs:89 ไม่มี definition ใดๆ 

**Claude/Genspark/Zai** ถูก — พบใน 

16\_GeoDictionaryBuilder.gs:322 และ 07\_PlaceService.gs:638 (อ่านต่างกัน: 16 vs 4 คอลัมน์\!) 

**Claude/Genspark/Zai/Minimax** ถูก — พบ setValue() ใน 06\_PersonService.gs:341 , 07\_PlaceService.gs:621 , 

08\_GeoService.gs:305 , 

09\_DestinationService.gs:190 

**Claude/Genspark** ถูก — อ่าน ฟังก์ชันแล้วไม่มี   
hasTimePassed\_() , 

saveCheckpoint\_() , หรือ resume logic ใดๆ 

**4** รายการถูก **/ Gemini** ผิด — พบ hardcode r\[28\] , r\[14\] , r\[16\] , r\[2\] , r\[9\] , r\[23\] , r\[24\] , r\[25\] , r\[27\] 

เฉพาะ **Claude** พบ — 

fetchDataFromSCGJWD() เรียก populateAliasFromSCGRawData\_() ที่เขียน M\_ALIAS โดยตรง ขัดกับ header ที่เขียนเอง 

**Claude** ผิด**\!** — 

13\_ReportService.gs มี 

safeUiAlert\_() ไม่ใช่ 

safeAlert\_() ชื่อต่างกัน ไม่มี namespace collision 

**Gemini/Minimax** ตัดสินผิด —   
ด้วยไม่เห็นด้วย**PASS**   
ผิด 

**9** No Hardcode Index \= PASS (Gemini) ไม่เห็นด้วยไม่เห็น 

ด้วยไม่เห็นด้วยไม่เห็น   
ด้วย 

**10**"22 ไฟล์ไม่ใช้ Object Namespace เลย"   
(Zai)**Overclaim**ไม่เห็น 

ด้วย**Overclaim**ไม่เห็น   
ด้วย   
**PASS** ผิด 

**PASS** ผิด 

**Prefix \= OK**   
autoInstallSmartNav\_() คือ Fake Call ชัดเจน 

**Gemini** ตัดสินผิด — มี hardcode index 9 ตำ แหน่งใน   
18\_ServiceSCG.gs 

**Zai Overclaim** — กฎข้อ 8 อนุญาตให้ใช้ Prefix แทน Object ได้ function personResolve\_() ใช้ prefix pattern ถูกต้อง  
**2\. Verdict Score Board —** คะแนน **AI** แต่ละรายการ 

คำ นวณใหม่จากผลตรวจสอบโค้ดจริง (แก้ไขจากรายงานเดิมที่ประเด็น \#7 ผิด) 

**AI** ถูก ผิด**/**พลาด **Overclaim** คะแนนรวม **Verdict** 

**Claude** 9/10 1 0 **90%** แม่นยำ ที่สุด แต่ safeAlert\_ claim ผิด 

**Genspark** 9/10 1 0 **90%** ดีมาก พลาดแค่ Single Writer 

**Zai** 8/10 1 1 **75%** ดี แต่ Overclaim เรื่อง Namespace 

**Minimax** 5/10 5 0 **50%** พลาด Critical หลายจุด รวมทั้ง "No Fake Calls \= 100%" ที่ผิดชัดเจน **Gemini** 3/10 7 0 **30%** Surface scan เท่านั้น ให้ PASS ในจุดที่ผิด 3 จุด 

หมายเหตุสำ คัญจาก **Super Z:** รายงานเดิมให้ Claude 100% แต่จริงๆ แล้วประเด็น \#7 ( safeAlert\_() ซ้ำ ) นั้น ผิด เพราะ 13\_ReportService.gs ใช้ชื่อ safeUiAlert\_() ซึ่งต่างจาก safeAlert\_() ใน 16\_GeoDictionaryBuilder.gs — ไม่มี namespace collision จริง ดังนั้นคะแนน Claude ต้อง ลดจาก 100% เหลือ 90%  
**3\. Critical Findings —** ยืนยันจากโค้ดจริง 

**3.1 CRITICAL BUG-C1: Single Writer Violation** 

**Location:** 18\_ServiceSCG.gs บรรทัด 202-208 

สิ่งที่พบ**:** fetchDataFromSCGJWD() เรียก populateAliasFromSCGRawData\_() ซึ่งเขียน M\_ALIAS โดยตรงผ่าน createGlobalAlias() ขัดกับ**:** Header ของ 21\_AliasService.gs เองเขียนไว้ชัดเจน: 

⚠️ Auto Pipeline ไม่เขียน M\_ALIAS ที่นี่ — เขียนที่ autoEnrichAliasesFromFactBatch\_() เท่านั้น 

นี่คือการละเมิด Single Writer Pattern ที่ระบบเองกำ หนดไว้ — fetchDataFromSCGJWD() เป็นส่วนหนึ่งของ auto pipeline (Group 2 Daily Ops) แต่เขียน M\_ALIAS โดยไม่ผ่านช่องทางหลัก autoEnrichAliasesFromFactBatch\_() 

ผลกระทบ**:** Race condition เมื่อ fetchDataFromSCGJWD() รันพร้อมกับ Group 1 Pipeline — Dedup Set ใน autoEnrichAliasesFromFactBatch\_() โหลด ก่อน แต่ populateAliasFromSCGRawData\_() เพิ่ม record หลัง ทำ ให้สร้าง alias ซ้ำ ได้ 

**3.2 CRITICAL BUG-C2: loadCachedGeoRows\_()** ซ้ำ **2** ไฟล์ **(**เลวร้ายกว่าที่คิด**)** 

**Location:** 16\_GeoDictionaryBuilder.gs:322 และ 07\_PlaceService.gs:638 

สิ่งที่ร้ายแรงกว่าที่รายงานเดิมบอก**:** ไม่ใช่แค่ namespace collision แต่สองเวอร์ชันอ่าน ต่างจำ นวนคอลัมน์: 

// 07\_PlaceService.gs — อ่านแค่ 4 คอลัมน์   
const data \= sheet.getRange(2, 1, sheet.getLastRow() \- 1, 4).getValues(); 

// 16\_GeoDictionaryBuilder.gs — อ่านครบ 16 คอลัมน์ตาม SCHEMA   
const data \= sheet.getRange(2, 1, ..., SCHEMA\[SHEET.SYS\_TH\_GEO\].length).getValues(); 

ถ้า GAS โหลด 07\_PlaceService.gs หลัง 16\_GeoDictionaryBuilder.gs — เวอร์ชันที่อ่าน 4 คอลัมน์จะทับเวอร์ชันที่อ่าน 16 คอลัมน์ ทำ ให้ searchKey , postalKey , noteType , noteScope หายไป — Address Enrichment จะผิดพลาด 

**3.3 CRITICAL BUG-C3: updatePersonStats/PlaceStats/GeoStats** ใช้ **setValue() row-by-row** 

**Location:** 06\_PersonService.gs:341 , 07\_PlaceService.gs:621 , 08\_GeoService.gs:305 , 09\_DestinationService.gs:190 สิ่งที่พบ**:** ทุกครั้งที่ AUTO\_MATCH เกิดขึ้นขึ้ จะเรียก Spreadsheet API 3 ครั้งต่อ entity (getValue \+ setValue x2) 

sheet.getRange(targetRow, lastSeenCol).setValue(new Date()); // API call \#1   
const currCount \= Number(sheet.getRange(targetRow, usageCountCol).getValue()) || 0; // API call \#2 sheet.getRange(targetRow, usageCountCol).setValue(currCount \+ 1); // API call \#3 

ถ้ามี 500 records ใน batch \= 4,500 API calls เฉพาะ stats update → ติด Quota ได้ง่าย ขัดกฎข้อ 4 (Safe Batching) **3.4 CRITICAL BUG-C4: MIGRATION\_HybridAliasSystem()** ไม่มี **Time Guard** 

**Location:** 21\_AliasService.gs บรรทัด 451-547 

สิ่งที่พบ**:** ฟังก์ชันวน forEach() ถึง 4 รอบ ข้ามไฟล์ ไม่มี hasTimePassed\_() , saveCheckpoint\_() , หรือ resume logic ถ้า production data เกิน 5,000 rows \= TIMEOUT แน่นอน \= ข้อมูล M\_ALIAS ค้างกึ่งกลาง ไม่มีทาง resume ได้ ขัดกฎข้อ 5 (Checkpoint & Resume)  
**4\. Claim Correction —** ข้อที่รายงานเดิมพลาด 

**4.1 CORRECTION safeAlert\_()** ซ้ำ **2** ไฟล์ **—** ไม่จริง**\!** 

รายงานเดิมกล่าว**:** safeAlert\_() ซ้ำ ใน 16\_GeoDictionaryBuilder.gs และ 13\_ReportService.gs 

ความจริงจากโค้ด**:** 

ไฟล์ ชื่อฟังก์ชัน บรรทัด ซ้ำ **?** 16\_GeoDictionaryBuilder.gs safeAlert\_() 465 — 13\_ReportService.gs safeUiAlert\_() 221 ไม่ซ้ำ **—** ชื่อต่างกัน**\!** 

ชื่อฟังก์ชันต่างกัน: safeAlert\_ vs safeUiAlert\_ — ไม่มี namespace collision ใน GAS เพราะ GAS ใช้ function name เป็น key ใน global scope โดยตรง 

อย่างไรก็ตาม**:** ยังมีปัญหาความซ้ำ ซ้อนเชิงแนวคิด (conceptual duplication) — ทั้งสองทำ หน้าที่เดียวกันคือ "แสดง alert อย่างปลอดภัยจาก trigger context" แต่ใช้ชื่อต่างกัน ควรรวมเป็นฟังก์ชันเดียวใน 14\_Utils.gs 

**4.2 CLARIFICATION updateStats() vs updatePersonStats()** 

รายงานเดิมใช้ชื่อ updateStats() ซึ่งไม่มีในโค้ดจริง ชื่อฟังก์ชันที่ถูกต้องคือ updatePersonStats() , updatePlaceStats() , updateGeoStats() — แต่ข้อ กล่าวอ้างว่า "เรียก setValue row-by-row" นั้น ถูกต้อง  
**5\. Additional Findings —** สิ่งที่ **Super Z** พบเพิ่มเติม 

ปัญหาเหล่านี้ไม่ได้ถูกกล่าวถึงในรายงาน Cross-Validation ฉบับเดิม 

**5.1 HIGH createGlobalAlias()** โหลด **M\_ALIAS** ทั้งชีตทุกครั้ง **— O(N)** ต่อ **call** 

**Location:** 21\_AliasService.gs:102 

สิ่งที่พบ**:** createGlobalAlias() เรียก loadGlobalAliasesMap\_() ทุกครั้ง แล้วล้าง cache ทุกครั้งหลังเขียน 

function createGlobalAlias(...) {   
 const existingMap \= loadGlobalAliasesMap\_(); // โหลด M\_ALIAS ทั้งหมดทุกครั้ง   
 // ... dedup check ...   
 sheet.appendRow(\[...\]); // เขียน 1 row   
 CacheService.getScriptCache().remove('M\_GLOBAL\_ALIAS\_ALL'); // ล้าง cache   
} 

เมื่อ populateAliasFromSCGRawData\_() เรียก createGlobalAlias() N ครั้ง \= N cache loads \+ N cache invalidations \= N sheet reads ถ้า cache miss → ประสิทธิภาพต่ำ มาก 

**5.2 HIGH showVersionInfo()** บอกจำ นวนไฟล์ผิด 

**Location:** 00\_App.gs:576 

สิ่งที่พบ**:** แสดง "21 files" แต่ระบบมีไฟล์ 00-21 \= **22 files** 

**5.3 HIGH Entry Points** หลายตัวไม่มี **try-catch** 

จาก menu/trigger entry points พบหลายตัวที่ไม่มี try-catch ขัดกฎข้อ 12: 

MIGRATION\_HybridAliasSystem 

applyMasterCoordinatesToDailyJob 

assignMasterUuidIfMissing 

buildFullQualityReport 

clearAllSCGSheets\_UI 

detectDoubleProcessing 

diagnoseSystemState 

generatePersonAliasesFromHistory 

installSmartNavTrigger 

populateAliasFromSCGRawData\_ 

populateGeoMetadata 

runPreflightAudit 

**5.4 MEDIUM logError()** ไม่มี **stack trace** จริง 

03\_SetupSheets.gs ฟังก์ชัน logError() รับเพียง module \+ message ไม่ได้เก็บ stack trace ทั้งที่ column สุดท้ายของ SYS\_LOG เตรียมไว้แล้ว ขัดกฎ ข้อ 13 

**5.5 MEDIUM SCG Cookie** เก็บในชีต **— Security Risk** 

18\_ServiceSCG.gs:78 อ่าน cookie จากชีต Input ซึ่งเป็น sensitive data ถ้า spreadsheet ถูก share กว้างเกินไปจะรั่วไหลได้ **5.6 MEDIUM appendRow()** ยังใช้หลายจุด  
พบ appendRow() ใน: 

03\_SetupSheets.gs:365 (writeLog\_) 

06\_PersonService.gs:284,302 (createPerson/createPersonAlias) 

07\_PlaceService.gs:568,583 (createPlace/createPlaceAlias) 

09\_DestinationService.gs:149 (createDestination) 

13\_ReportService.gs:164 (buildFullQualityReport) 

15\_GoogleMapsAPI.gs:311 (saveToSheetCache\_) 

21\_AliasService.gs:115 (createGlobalAlias) 

ไม่ใช่ทุกจุดผิด (single call \= acceptable) แต่ createGlobalAlias() ถูกเรียกใน loop ระหว่าง migration \= ขัดกฎข้อ 4  
**6\.** คำ แนะนำ จาก **Super Z** 

**6.1 Phase 0 —** แก้ทันทีก่อน **Deploy (Critical)** 

**FIX-C1:** แก้ **Single Writer Violation** 

วิธีที่แนะนำ **:** ย้าย populateAliasFromSCGRawData\_() call ออกจาก fetchDataFromSCGJWD() และให้ผู้ใช้เรียกผ่านเมนูเท่านั้น (เปลี่ยนจาก auto pipeline เป็น admin-only action) 

// 18\_ServiceSCG.gs — ลบส่วนนี้ออกจาก fetchDataFromSCGJWD()   
// \[REMOVE\] populateAliasFromSCGRawData\_() call   
// ผู้ใช้สามารถเรียกได้จากเมนู "ดึงชื่อจาก SCG ดิบ → M\_ALIAS" อยู่แล้ว 

**FIX-C2:** ลบ **Duplicate loadCachedGeoRows\_()** 

ลบ loadCachedGeoRows\_() ใน 07\_PlaceService.gs ออก ให้ใช้ version ของ 16\_GeoDictionaryBuilder.gs เพียงที่เดียว (GAS Global Scope ทำ ให้เรียก ข้ามไฟล์ได้อยู่แล้ว) 

**FIX-C3:** แก้ **Stats Update** เป็น **Batch Pattern** 

สะสม stat updates ไว้ใน memory array แล้ว batch write ท้าย batch แทนที่จะเรียก setValue() ทุก record 

**FIX-C4:** เพิ่ม **Time Guard \+ Resume** ใน **MIGRATION** 

เพิ่ม hasTimePassed\_() check ทุก 100 iterations และใช้ PropertiesService เก็บ checkpoint (MIGRATION\_STEP \+ MIGRATION\_OFFSET) เพื่อ resume ได้ 

**6.2 Phase 1 —** แก้ภายใน **Sprint (High)** 

**FIX-H1:** เพิ่ม **autoInstallSmartNav\_()** จริง หรือลบ **call** ออก 

ทางเลือก: 

1\. ลบ call ออกจาก onOpen() — ให้ผู้ใช้ติดตั้งผ่านเมนูเท่านั้น 

2\. สร้างฟังก์ชันจริงที่ตรวจ trigger เดิมก่อนติดตั้งใหม่ 

**FIX-H2:** แก้ **Hardcode Index** ใน **18\_ServiceSCG.gs** 

// แทนที่ r\[28\] → r\[DATA\_IDX.SHOP\_KEY\]   
// แทนที่ r\[14\] → r\[DATA\_IDX.ITEM\_QTY\]   
// แทนที่ r\[16\] → r\[DATA\_IDX.ITEM\_WEIGHT\]   
// ... ฯลฯ 

**FIX-H3:** เพิ่ม **try-catch** ให้ **Menu Entry Points** 

ทุกฟังก์ชันที่ถูกเรียกจากเมนูต้องมี try-catch \+ logError ตามกฎข้อ 12 

**FIX-H4:** เพิ่ม **Stack Trace** ให้ **logError()** 

แก้ logError() ให้รับ optional error object และเก็บ stack trace ลง column สุดท้ายของ SYS\_LOG 

**6.3 Phase 2 —** ปรับคุณภาพระยะกลาง **(Medium)** 

**FIX-M1:** รวม **safeAlert\_()** และ **safeUiAlert\_()** เป็นฟังก์ชันเดียว 

ย้ายไป 14\_Utils.gs ใช้ชื่อ safeUiAlert\_() และเรียกจากทุกไฟล์  
**FIX-M2:** แก้ **createGlobalAlias()** ให้ **batch write** 

เปลี่ยนจาก appendRow-per-call เป็นสะสม array แล้ว setValues() ท้าย batch 

**FIX-M3:** แก้ **showVersionInfo()** จาก **21 → 22 files** 

**FIX-M4:** พิจารณาย้าย **SCG Cookie** ไปเก็บใน **PropertiesService** 

ลดความเสี่ยง security จากการเก็บ cookie ในชีตที่อาจถูก share 

**6.4** สรุปผลกระทบ 

**Phase** จำ นวน **Fix** ผลกระทบต่อ **Production** ความเร่งด่วน Phase 0 (Critical) 4 ป้องกัน data corruption, race condition, timeout ทันที Phase 1 (High) 4 ลด API quota risk, เพิ่ม debug capability ภายใน **1** สัปดาห์ Phase 2 (Medium) 4 ปรับคุณภาพโค้ด ลด technical debt ภายใน **1** เดือน 

**Verdict** สรุปจาก **Super Z** 

**Gemini** — Surface scan เท่านั้น ให้ PASS ในจุดที่ผิด 3 จุด อย่าเชื่อถือผลนี้ในระดับ Production 

**Minimax** — อ่านโค้ดจริงบ้างแต่ไม่ลึกพอ พลาด Critical Bug 2 จุดที่สำ คัญมาก และให้ "No Fake Calls \= 100%" ที่ผิดชัดเจน **Zai** — ดีมาก แต่ Overclaim เรื่อง Namespace กฎข้อ 8 อนุญาต Prefix pattern ด้วย 

**Genspark** — ใกล้เคียงที่สุด พบ Critical issues เกือบครบ แต่พลาด Single Writer Pattern violation 

**Claude** — พบมากที่สุด รวมถึง Single Writer violation ที่ซ่อนลึก แต่มี 1 claim ผิด ( safeAlert\_ ซ้ำ ) ทำ ให้คะแนนจริงคือ 90% ไม่ใช่ 100%