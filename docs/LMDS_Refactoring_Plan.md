L O G I S T I C S M A S T E R D A T A S Y S T E M 

**LMDS Refactoring Plan** แผนปรับปรุงโค้ดที่ซ้ำ ซ้อนและไม่ปฏิบัติตามกฎ 15 ข้อ 

วิเคราะห์จากโค้ดจริง 22 ไฟล์ .gs • อ้างอิง กฎการเขียขีนโค้ด LMDS.md \+ กฎการเขียขีนโค้ด.md วันที่: 26 พฤษภาคม 2569  
**สารบัญ** 

1\. สรุปผลการวิเคราะห์ 

2\. Function ยาวเกิน 100 บรรทัด (14 ฟังก์ชัน) 3\. autoEnrichAliasesFromFactBatch\_ (266 บรรทัด) 4\. Function ที่ทำ หลายหน้าที่ (12 ฟังก์ชัน) 5\. Duplicate Code Patterns (9 รูปแบบ) 6\. Constants กระจายนอก 01\_Config.gs 7\. ลำ ดับความสำ คัญและแผนดำ เนินการ  
**1\. สรุปผลการวิเคราะห์** 

วิเคราะห์โค้ดจริงทั้ง 22 ไฟล์ .gs ในโปรเจกต์ LMDS โดยอ้างอิงกฎ 15 ข้อข้ จาก กฎการเขียนโค้ด LMDS.md และ กฎการเขียนโค้ด.md ทุกข้อข้ กล่าวอ้างมีหลักฐานจาก grep จริงเท่านั้น ไม่มีการอ้างอิงจากบทสนทนาเก่า 

**14** 

Function ยาวเกิน 100 บรรทัด 

**ไฟล์ที่มีปัญหามากที่สุด:**   
**12** 

Function ทำ หลาย หน้าที่   
**9** 

Duplicate Code Patterns   
**46** 

Constants กระจาย นอก Config 

**ไฟล์ Function ยาว Multi-Resp Constants รวม** 10\_MatchEngine.gs 3 3 11 **17** 12\_ReviewService.gs 1 1 5 **7** 18\_ServiceSCG.gs 1 1 4 **6** 00\_App.gs 1 1 3 5 15\_GoogleMapsAPI.gs 0 0 7 7 05\_NormalizeService.gs 1 0 5 6  
**2\. Function ยาวเกิน 100 บรรทัด** 

กฎข้อข้ 1 (Clean Code) ระบุว่าฟังก์ชันควรมีความยาวไม่เกิน 30 บรรทัด และกฎข้อข้ 1.1 อนุญาตให้ยาวเกินได้ หากได้รับอนุมัติ แต่จากการ grep พบ 14 ฟังก์ชันที่ยาวเกิน 100 บรรทัด ซึ่งเกินขีดขีจำ กัดอย่างมีนัยสำ คัญ 

**\# ไฟล์ Function บรรทัด จำ นวน** 1 10\_MatchEngine.gs autoEnrichAliasesFromFactBatch\_ 238-503 **266** 2 12\_ReviewService.gs applyReviewDecision 194-397 **204** 3 18\_ServiceSCG.gs fetchDataFromSCGJWD 66-224 159 4 00\_App.gs diagnoseSystemState 639-778 140 5 21\_AliasService.gs MIGRATION\_HybridAliasSystem 452-587 136 6 17\_SearchService.gs runLookupEnrichment 250-376 127 7 13\_ReportService.gs buildFullQualityReport 74-194 121 8 17\_SearchService.gs findBestGeoByPersonPlace 78-196 119 9 19\_Hardening.gs generatePersonAliasesFromHistory 188-301 114 10 05\_NormalizeService.gs normalizePersonNameFull 162-272 111 11 11\_TransactionService.gs upsertFactDelivery 68-178 111 12 07\_PlaceService.gs getEnrichedGeoData 324-431 108 13 10\_MatchEngine.gs executeDecision 652-758 107 14 10\_MatchEngine.gs makeMatchDecision 546-646 101 

หมายเหตุ: normalizePersonNameFull ได้รับอนุญาตให้คงความยาว \~65 บรรทัดตามกฎข้อ 1.1 แต่ปัจจุบันขยายเป็น 111 บรรทัด ซึ่งเกินที่อนุมัติไว้  
**3\. Refactor \#1: autoEnrichAliasesFromFactBatch\_ (266 บรรทัด)**  
**Refactor \#1: autoEnrichAliasesFromFactBatch\_ CRIT ICAL** ไฟล์: 10\_MatchEngine.gs:238-503 • กฎที่ละเมิด: ข้อ 1, ข้อ 2, ข้อ 4   
**ปัญหา:** 

ฟังก์ชันยาว 266 บรรทัด (เกินกฎข้อข้ 1 ถึง 8.9 เท่า) 

ทำ หลายหน้าที่: โหลด reference data \+ สร้าง dedup sets \+ สร้าง person alias rows \+ สร้าง place alias rows \+ batch write 3 ชีต \+ log 

เป็น Single Writer ของ M\_ALIAS — การแก้ไขมีความเสี่ยสี่งสูงสู 

**ขั้นตอนปัจจุบัน (5 ขั้นตอน):** 

**ขั้นตอน บรรทัด หน้าที่** 

Step 1 242- 269 

Step 2 271- 307 

Step 3a+3b 324- 383 

Step 3c+3d 394- 449   
โหลด personMap \+ placeMap จาก cached loaders 

สร้าง dedup Sets (existingPersonAliasSet, existingPlaceAliasSet, existingGlobalAliasSet) 

สร้าง PERSON canonical \+ variant alias rows 

สร้าง PLACE canonical \+ variant alias rows 

Step 

4a+4b+4c   
455- 487   
Batch write M\_ALIAS \+ M\_PERSON\_ALIAS \+ M\_PLACE\_ALIAS 

Step 5 489- 502   
Log ผลลัพธ์ 

**ขั้นตอนการแก้ (แยกเป็น 5 helper functions):** 

/ 1\. แยก: สร้าง dedup sets (\~35 บรรทัด) 

function buildAliasDedupSets\_() { 

var existingPersonAliasSet \= new Set(); 

var existingPlaceAliasSet \= new Set(); 

var existingGlobalAliasSet \= new Set(); 

/ . โหลดจาก M\_PERSON\_ALIAS, M\_PLACE\_ALIAS, M\_ALIAS 

return { existingPersonAliasSet, existingPlaceAliasSet, existingGlobalAliasSet }; } 

/ 2\. แยก: สร้าง PERSON alias rows (\~55 บรรทัด) 

function buildPersonAliasRows\_(factBatch, personMap, dedupSets) { . }  
/ 3\. แยก: สร้าง PLACE alias rows (\~50 บรรทัด) 

function buildPlaceAliasRows\_(factBatch, placeMap, dedupSets) { . } 

/ 4\. แยก: Batch write 3 ชีต (\~30 บรรทัด) 

function batchWriteAliasSheets\_(globalRows, personRows, placeRows) { . } 

/ 5\. Main: orchestrator (\~40 บรรทัด) 

function autoEnrichAliasesFromFactBatch\_(factBatch) { 

if (\!factBatch | \!factBatch.length) return; 

var personMap \= PersonService.loadAllPersons() .; 

var placeMap \= PlaceService.loadAllPlaces() .; 

var dedupSets \= buildAliasDedupSets\_(); 

var personRows \= buildPersonAliasRows\_(factBatch, personMap, dedupSets); var placeRows \= buildPlaceAliasRows\_(factBatch, placeMap, dedupSets); batchWriteAliasSheets\_(personRows.global, personRows.person, placeRows.place); logInfo('Aliases created: .'); 

}  
**4\. Function ที่ทำ หลายหน้าที่ (Multi-Responsibility)** กฎข้อข้ 2 (Single Responsibility): ฟังก์ชันเดียว \= 1 หน้าที่ ถ้าต้องใช้คำ ว่า "และ" อธิบาย \= ละเมิดกฎ 

**Refactor \#2: applyReviewDecision (204 บรรทัด) HIGH** ไฟล์: 12\_ReviewService.gs:194-397 

ที่ผ่านมามีหน้าที่หลายอย่าง: \[1\] หา row ใน Q\_REVIEW \[2\] ระบุ reviewer \[3\] จัดการ CREATE\_NEW \[4\] จัดการ MERGE\_TO\_CANDIDATE \[5\] จัดการ ESCALATE \[6\] จัดการ IGNORE \[7\] อัปเดต review status (ซ้ำ 4 ครั้งในแต่ละ case) 

**แยกเป็น:** 

findReviewRow\_() — หา target row ใน Q\_REVIEW 

handleCreateNewDecision\_() — จัดการ CREATE\_NEW case 

updateReviewRowStatus\_() — อัปเดต status (DRY up 4 บล็อกที่ซ้ำ กัน) 

Main: orchestrator เรียก helper ตาม decision type 

**Refactor \#3: fetchDataFromSCGJWD (159 บรรทัด) HIGH** ไฟล์: 18\_ServiceSCG.gs:66-224   
ทำ หลายหน้าที่: \[1\] อ่าน Cookie \+ ShipmentNos \[2\] เรียก SCG API \[3\] แปลง JSON เป็น flat rows \[4\] Aggregate shop-level data \[5\] เขียขีน Daily Job sheet \[6\] เรียก downstream functions 

flattenSCGResponse\_() — แปลง JSON response เป็น flat rows 

aggregateShopData\_() — รวมข้อข้ มูลระดับร้านค้า 

writeDailyJobSheet\_() — เขียขีนข้อข้ มูลลงชีต \+ format  
**Refactor \#4: MIGRATION\_HybridAliasSystem (136 บรรทัด) MEDIUM** ไฟล์: 21\_AliasService.gs:452-587   
ทำ หลายหน้าที่: \[1\] ยืนยันกับผู้ใช้ \[2\] กำ หนด master\_uuid \[3\] ล้าง cache \[4\] Migrate M\_PERSON\_ALIAS \[5\] Migrate M\_PLACE\_ALIAS \[6\] เรียก populateAlias \[7\] แสดงผล 

ข้อข้ 4 และ 5 มีโครงสร้างเหมือนกันแทบทุกประการ — ต่างกันแค่ sheet name, index constants, entity type 

migrateEntityAliases\_(entityType, sheetName, idxConstants) — รวมข้อข้ 4+5 เป็น parameterized function 

Main: orchestrator เรียก migrateEntityAliases\_('PERSON', .) และ migrateEntityAliases\_('PLACE', .) 

**Refactor \#5: executeDecision (107 บรรทัด) MEDIUM** 

ไฟล์: 10\_MatchEngine.gs:652-758 

ทำ หลายหน้าที่: \[1\] Geo enrichment \[2\] สร้าง GeoPoint \[3\] AUTO\_MATCH branch \[4\] CREATE\_NEW branch \[5\] REVIEW branch \[6\] upsertFactDelivery 

executeAutoMatch\_() — จัดการ AUTO\_MATCH branch 

executeCreateNew\_() — จัดการ CREATE\_NEW branch 

executeReview\_() — จัดการ REVIEW branch  
**Refactor \#6: ฟังก์ชันอื่น ๆ ที่ทำ หลายหน้าที่ MEDIUM** 

**ฟังก์ชัน ไฟล์:บรรทัด หน้าที่ที่ควรแยก** 

diagnoseSystemState 00\_App.gs:639 validateSheetsAndSchema\_(), auditSourceData\_(), 

auditSysLogErrors\_() 

buildFullQualityReport 13\_ReportService.gs:74 countFactMatchStatuses\_() 

upsertFactDelivery 11\_TransactionService.gs:68 resolveGeoLatLng\_(), formatDeliveryDateTime\_(), 

buildFactRow\_() 

findBestGeoByPersonPlace 17\_SearchService.gs:78 tryTier0\_() ถึง tryTierE\_()(7 ระดับ cascade) 

runLookupEnrichment 17\_SearchService.gs:250 mapResultToOutput\_(), batchWriteLookupResults\_() 

generatePersonAliasesFromHistory 19\_Hardening.gs:188 loadPersonAliasContext\_(), computeNewAliases\_(), 

writeGlobalAliasesBatch\_() 

getEnrichedGeoData 07\_PlaceService.gs:324 tryGeoLevel0\_() ถึง tryGeoLevel3\_() (4 ระดับ cascade)  
**5\. Duplicate Code Patterns (9 รูปแบบ)** 

กฎข้อข้ 8 (Namespace) และกฎข้อข้ 4 (Batch Operations): โค้ดที่ซ้ำ กันทำ ให้บำ รุงรักษายาก แก้ไขที่เดียวต้อง แก้หลายที่  
**Duplicate \#1: Cache Read Pattern (8 จุด) HIGH** รูปแบบ CacheService.getScriptCache() \+ cache.get \+ JSON.parse ซ้ำ ใน 6 ไฟล์ 8 จุด: 

**ไฟล์ บรรทัด ฟังก์ชัน** 

06\_PersonService.gs 424-426 loadAllPersons\_ 06\_PersonService.gs 458-460 loadAllAliases\_ 07\_PlaceService.gs 644-646 loadAllPlaces\_ 

07\_PlaceService.gs 680-682 loadAllPlaceAliases\_ 08\_GeoService.gs 323-325 loadAllGeos\_ 09\_DestinationService.gs 268-270 loadAllDestinations\_ 16\_GeoDictionaryBuilder.gs 390 loadGeoDict\_ 16\_GeoDictionaryBuilder.gs 399 loadGeoDictKeys\_ 

/ สร้าง utility function ใน 14\_Utils.gs 

function cachedLoad\_(cacheKey, loaderFn) { 

var cache \= CacheService.getScriptCache(); 

var cached \= cache.get(cacheKey); 

if (cached) { 

try { return JSON.parse(cached); } 

catch(e) { \* fallback to reload / } 

} 

var data \= loaderFn(); 

try { cache.put(cacheKey, JSON.stringify(data), 300); } catch(e) {} 

return data; 

} 

/ ตัวอย่างการใช้ (แทนที่ 8 จุด) 

function loadAllPersons\_() { 

return cachedLoad\_(CACHE\_KEY\_PERSON, function() { 

return readSheetData\_(SHEET.M\_PERSON); 

}); 

}  
**Duplicate \#2: Stats Update Pattern (3 จุด — เกือบเหมือนกัน) HIGH** 

ฟังก์ชัน updatePersonStats, updatePlaceStats, updateGeoStats มีโครงสร้างเหมือนกันแทบ ทุกประการ: 

1\. Get sheet by name 

2\. Read ID column, loop to find targetRow 

3\. setValue(lastSeenCol, new Date()) 

4\. getValue(usageCountCol), increment, setValue 

5\. Invalidate cache 

**ไฟล์ บรรทัด ฟังก์ชัน** 

06\_PersonService.gs 314-351 updatePersonStats 07\_PlaceService.gs 595-629 updatePlaceStats 08\_GeoService.gs 280-315 updateGeoStats 

/ สร้าง generic utility 

function updateEntityStats\_(sheetName, idIdx, idValue, 

lastSeenIdx, usageCountIdx, cacheKey) { 

var sheet \= SpreadsheetApp.getActiveSpreadsheet() 

.getSheetByName(sheetName); 

var ids \= sheet.getRange(2, idIdx \+ 1, 

sheet.getLastRow() \- 1, 1).getValues(); 

for (var i \= 0; i \< ids.length; i \+) { 

if (ids\[i\]\[0\] \= idValue) { 

sheet.getRange(i \+ 2, lastSeenIdx \+ 1\) 

.setValue(new Date()); 

var count \= sheet.getRange(i \+ 2, usageCountIdx \+ 1\) 

.getValue(); 

sheet.getRange(i \+ 2, usageCountIdx \+ 1\) 

.setValue((count | 0\) \+ 1); 

break; 

} 

} 

CacheService.getScriptCache().remove(cacheKey); 

}  
**Duplicate \#3: Cache Invalidation (8+ จุด \+ ซ้ำ ซ้อน) MEDIUM** 

รูปแบบ CacheService.getScriptCache().remove(key) กระจายใน 8+ จุด และ M\_GLOBAL\_ALIAS cache invalidation ซ้ำ ใน 2 ไฟล์: 

10\_MatchEngine.gs:461-462 

21\_AliasService.gs:131-132 

สร้าง invalidateCache\_( .keys) utility ใน 14\_Utils.gs และเรียกจากทุกที่ที่ต้องการล้าง cache 

**Duplicate \#4: Review Status Update (ซ้ำ 4 ครั้งในไฟล์เดียว) MEDIUM** 

ใน 12\_ReviewService.gs บล็อกอัปเดต review status ซ้ำ กัน 4 ครั้งในแต่ละ switch case (บรรทัด 343-347, 365-369, 374-377, 383-386) 

แยกเป็น updateReviewRowStatus\_(sheet, targetRow, status, reviewer, now, decisionVal, note?)  
**Duplicate \#5-9: รูปแบบอื่น ๆ MEDIUM** 

**\# รูปแบบจำ นวน**   
**จุดไฟล์ที่พบ** 

5 Cache Write (cache.put \+ JSON.stringify) 6+ 06, 07, 08, 09, 21 

6 Sheet Data Load (getSheetByName \+ getRange \+ getValues)   
25+ 12 ไฟล์ 

7 Required Sheets List(ซ้ำ ใน 00\_App.gs) 2 00\_App.gs:516, 00\_App.gs:651 

8 haversineDistance wrapper (ไม่จำ เป็น) 1 08\_GeoService.gs:395 → เรียก 14\_Utils.gs:183 

9 Sync Status Check pattern 3 00\_App.gs:461, 00\_App.gs:703, 19\_Hardening.gs:108  
**6\. Constants กระจายนอก 01\_Config.gs** 

กฎข้อข้ 3 (No Hardcode Index) และกฎข้อข้ 9 (No Global State): constants ทั้งหมดควรอยู่ใน 01\_Config.gs 

**6.1 Index Constants ที่ควรย้าย** 

**MAPS\_CACHE\_IDX (7 constants) ใน 15\_GoogleMapsAPI.gs HIGH** 

**Constant บรรทัด ค่า** MC\_KEY 65 0 MC\_LAT 66 2 MC\_LNG 67 3 MC\_ADDR 68 4 MC\_HIT 69 7 MC\_PROV 70 8 MC\_DIST 71 9 

ย้ายไป 01\_Config.gs เป็น MAPS\_CACHE\_IDX \= { KEY: 0, LAT: 2, LNG: 3, ADDR: 4, HIT: 7, PROV: 8, DIST: 9 }  
**Cache Key \+ Column Constants ในไฟล์อื่น MEDIUM** 

**Constant ไฟล์:บรรทัด ค่า** 

CACHE\_KEY\_SOURCE 04\_SourceRepository.gs:65 'SOURCE\_ROWS\_V3' CACHE\_KEY\_INVOICES 04\_SourceRepository.gs:66 'PROCESSED\_INVOICES\_V3' SRC\_READ\_COLS 04\_SourceRepository.gs:70 37 

GEO\_GRID\_SIZE 08\_GeoService.gs:63 0.01 

**6.2 Dictionary Constants ที่ควรย้าย** 

**5 Dictionary Constants ใน 05\_NormalizeService.gs MEDIUM** 

**Constant บรรทัด ประเภท** 

PERSON\_PREFIX\_LIST 70 Dictionary: คำ นำ หน้าชื่อ 

SORTED\_PREFIX\_LIST 101 Derived: เรียงตามความยาว COMPANY\_SUFFIX\_LIST 109 Dictionary: สกุลบริษัท 

CHAIN\_STORE\_LIST 118 Dictionary: ชื่อร้านค้าห่วงโซ่ DELIVERY\_NOTE\_LIST 125 Dictionary: หมายเหตุการจัดส่ง 

ย้ายไป 01\_Config.gs ในส่วส่ น NORMALIZE\_CONFIG หรือสร้าง NORMALIZE\_DICT object **6.3 Hardcoded Sheet Names**  
**2 ชื่อชีตที่ hardcoded แทนใช้ SHEET constant HIGH** 

**ไฟล์:บรรทัด โค้ด ควรใช้** 

18\_ServiceSCG.gs:304 getSheetByName("สรุป\_เจ้าของสินค้า") SHEET.OWNER\_SUMMARY 18\_ServiceSCG.gs:353 getSheetByName("สรุป\_Shipment") SHEET.SHIPMENT\_SUM 

หมายเหตุ: SHEET.OWNER\_SUMMARY และ SHEET.SHIPMENT\_SUM มีอยู่แล้วใน 01\_Config.gs แต่ไม่ถูกใช้ 

**6.4 Hardcoded Status/Action Strings** 

**12 จุดที่ใช้ string hardcoded แทน constants MEDIUM** 

**ไฟล์:บรรทัด String ควรเป็น constant** 10\_MatchEngine.gs:561 'REVIEW' DECISION.REVIEW 10\_MatchEngine.gs:635 'CREATE\_NEW' DECISION.CREATE\_NEW 10\_MatchEngine.gs:569 'INVALID\_LATLNG' REASON.INVALID\_LATLNG 12\_ReviewService.gs:340 'REVIEW\_APPROVED' REASON.REVIEW\_APPROVED 12\_ReviewService.gs:343 'Done' REVIEW\_STATUS.DONE 12\_ReviewService.gs:374 'Escalated' REVIEW\_STATUS.ESCALATED 18\_ServiceSCG.gs:253 \["BETTERBE","SCG EXPRESS",...\] EPOD\_OWNERS 10\_MatchEngine.gs:219 'ERROR' SYNC\_STATUS.ERROR 

**6.5 Magic Numbers**  
**11 จุดที่ใช้ตัวเลข hardcoded LOW** 

**ไฟล์:บรรทัด ค่า ควรเป็น** 

10\_MatchEngine.gs:594-597 0.5, 0.3, 0.2 MATCH\_WEIGHT\_FULL 10\_MatchEngine.gs:609-611 0.60, 0.25, 0.15 MATCH\_WEIGHT\_PARTIAL 10\_MatchEngine.gs:578,587 50 CONFIDENCE.LOW 10\_MatchEngine.gs:608 95 CONFIDENCE.CAP 12\_ReviewService.gs:340 95 CONFIDENCE.REVIEW\_APPROVED 14\_Utils.gs:300 'gemini-1.5-flash' AI\_CONFIG.MODEL (ซ้ำ \!) 14\_Utils.gs:311-314 0.1, 1, 1, 2048 AI\_CONFIG ที่มีอยู่แล้ว 18\_ServiceSCG.gs:71 10000 APP\_CONST.LOCK\_TIMEOUT\_MS  
**7\. ลำ ดับความสำ คัญและแผนดำ เนินการ** จัดลำ ดับตามผลกระทบต่อระบบ — ด่วนที่สุดสุ ก่อน: 

**Phase 1: ด่วน (สัปดาห์ที่ 1-2)** 

**ลำ ดับ งาน ไฟล์ เหตุผล** 

P1-1 ย้าย MAPS\_CACHE\_IDX ไป 01\_Config.gs   
15\_GoogleMapsAPI.gs, 01\_Config.gs   
7 index constants ผิดกฎข้อ 3 เสี่ยงพังเมื่อคอลัมน์เปลี่ยน 

P1-2 แก้ hardcoded sheet names 18\_ServiceSCG.gs:304,353 SHEET constants มีอยู่แล้วแต่ ไม่ใช้ ผิดกฎข้อ 3 

P1-3 สร้าง cachedLoad\_() \+ cachedStore\_() utilities 

P1-4 สร้าง updateEntityStats\_() utility   
14\_Utils.gs \+ 6 ไฟล์ ลด duplicate code 8+ จุด เพิ่ม cache consistency 

14\_Utils.gs \+ 3 ไฟล์ รวม 3 ฟังก์ชันเกือบเหมือนกัน เป็น 1 

**Phase 2: ปานกลาง (สัปดาห์ที่ 3-4)**  
**ลำ ดับ งาน ไฟล์ เหตุผล** 

P2-1 แยก autoEnrichAliasesFromFactBatch\_ เป็น 5 helpers 

P2-2 แยก applyReviewDecision เป็น 3 

helpers 

P2-3 แยก fetchDataFromSCGJWD เป็น 3 helpers 

P2-4 ย้าย dictionary constants ไป 

01\_Config.gs 

P2-5 สร้าง DECISION, REASON, 

REVIEW\_STATUS constants 

**Phase 3: ปรับปรุง (สัปดาห์ที่ 5-6)**  
10\_MatchEngine.gs 266 บรรทัด ใหญ่ที่สุด ผิด กฎข้อ 1+2 

12\_ReviewService.gs 204 บรรทัด \+ review status ซ้ำ 4 ครั้ง 

18\_ServiceSCG.gs 159 บรรทัด ทำ 6 หน้าที่ (SCG API Fetch code ห้าม 

แก้ — แยกส่วนอื่นเท่านั้น) 

05\_NormalizeService.gs 5 dictionary constants ผิด กฎข้อ 9 

01\_Config.gs \+ 2 ไฟล์ 12 hardcoded strings ผิด กฎข้อ 3   
**ลำ ดับ งาน ไฟล์ เหตุผล** 

P3-1 แยก executeDecision เป็น 3 branch helpers 

P3-2 รวม migratePersonAliases\_ \+ 

migratePlaceAliases\_ 

P3-3 แยก findBestGeoByPersonPlace เป็น tier helpers 

P3-4 แยก getEnrichedGeoData เป็น level helpers 

P3-5 ลบ haversineDistance wrapper ใน 08\_GeoService.gs 

P3-6 ย้าย match weight \+ confidence constants 

P3-7 แก้ Gemini API config ที่ซ้ำ กับ 

AI\_CONFIG 

P3-8 รวม requiredSheets arrays ใน 

00\_App.gs 

**ข้อจำ กัดกัที่ต้องระวัง**   
10\_MatchEngine.gs 107 บรรทัด 3 branch แยกกัน 

21\_AliasService.gs โครงสร้างเหมือนกัน — parameterized function 

17\_SearchService.gs 7-level cascade ยาก test 07\_PlaceService.gs 4-level cascade 

08\_GeoService.gs ไม่จำ เป็น เรียก 

haversineDistanceM()โดยตรง 

01\_Config.gs 11 magic numbers 

14\_Utils.gs:300-314 Model, URL, params ซ้ำ AI\_CONFIG ที่มีอยู่ 

00\_App.gs 2 arrays ซ้ำ ซ้อน 

**SCG API Fetch code ห้ามแก้ไข** — ส่วส่ นที่เรียก SCG API ใน fetchDataFromSCGJWD ต้องไม่ ถูกถูแก้ไขหรือลบ แยก helper ได้เฉพาะส่วส่ นอื่น 

**Two-Group Architecture** — Group 1 (Cleansing & Master DB) กับ Group 2 (Daily Ops) ต้องแยกชัดเจน 

**SHIP\_TO\_NAME (Index 10\)** — คอลัมน์เป้าหมายสำ หรับ cleansing ไม่ใช่ SoldToName **autoEnrichAliasesFromFactBatch\_ เป็น Single Writer** — การแยกต้องรักษา Single Writer Rule ของ M\_ALIAS