CR O SS-VALI D AT IO N R EPO R T 

แผนการปรับรั ปรุงโค้ด LMDS V5.4 

ฉบับละเอียด — 7 ข้อที่ต้องแก้ไข/เพิ่มเติม พร้อร้ มโค้ดก่อน-หลัง และขั้นขั้ ตอนทีละ Step 

ระบบ: Logistics Master Data System (LMDS) V5.4.001 แพลตฟอร์มร์ : Google Apps Script (22 ไฟล์) 

วันที่จัดทำ : 25 พฤษภาคม 2569 

ตรวจสอบโดย: Super Z (AI Principal Engineer) อ้างอิง: กฎ 15 ข้อ LMDS \+ lmds-supreme-engineer skill  
สารบัญ 

1\. สรุปภาพรวม — 7 ข้อข้ ที่ต้องแก้ไข 

2\. FIX-01: Single Writer Pattern Violation (BUG-C1) 3\. FIX-02: MIGRATION ขาด Time Guard (BUG-C4) 4\. FIX-03: Hardcode Index ใน 18\_ServiceSCG.gs 5\. FIX-04: Fake Function Call — autoInstallSmartNav\_() 6\. FIX-05: ฟังก์ชันซ้ำ — loadCachedGeoRows\_() 

7\. FIX-06: ฟังก์ชัน Utility ซ้ำ — safeAlert\_ / safeUiAlert\_ 8\. FIX-07: autoEnrichAliasesFromFactBatch\_ ยาวเกิน 265 บรรทัด 9\. ลำ ดับความสำ คัญและแผนการดำ เนินงาน 

10\. Checklist สำ หรับตรวจสอบหลังแก้ไข  
1\. สรุปภาพรวม — 7 ข้อที่ต้องแก้ไข 

จากการ Cross-Validation โดย 5 ระบบ AI (Claude, Genspark, Zai, Minimax, Gemini) และการตรวจสอบยืนยันโดย Super Z พบว่ามี 7 ข้อที่เป็นจริง และต้องดำ เนินการแก้ไขทั้งหมด รายการเหล่านี้ละเมิดกฎการเขียนโค้ด LMDS ข้อต่างๆ และอาจ ก่อให้เกิดปัญหาร้ายแรงในการทำ งานจริงของระบบ 

สรุป 7 ข้อที่ต้องแก้ไข 

รหัส ปัญหา กฎที่ละเมิด ความเสี่ยง 

FIX 01 

FIX 02 

FIX 03 

FIX 04   
Single Writer Pattern Violation — 

populateAliasFromSCGRawData\_() ใน Pipeline อัตโนมัติ 

MIGRATION\_HybridAliasSystem() ขาด Time Guard \+ Checkpoint 

Hardcode Index — r\[28\], r\[14\], r\[16\], r\[2\], r\[9\] ใน 18\_ServiceSCG.gs 

Fake Function Call — autoInstallSmartNav\_() ไม่มี นิยาม   
ข้อ 8 (Namespace), Single Writer 

ข้อ 5 (Checkpoint & Resume) 

ข้อ 3 (No Hardcode Index) 

ข้อ 7 (No Fake 

Function Calls) 

CRITICAL 

CRITICAL HIGH 

HIGH 

FIX   
ฟังก์ชันซ้ำ — loadCachedGeoRows\_() ใน 2 ไฟล์ ข้อ 8 (Namespace 05 

Collision) 

FIX   
Utility ซ้ำ — safeAlert\_() / safeUiAlert\_() ทำ หน้าที่เดียวกัน ข้อ 8 (Namespace 06 

Collision) 

FIX   
autoEnrichAliasesFromFactBatch\_() ยาว 265 บรรทัด ข้อ 1 (Clean Code), ข้อ 07 

2 (Single Resp.)   
MEDIUM MEDIUM LOW  
2\. FIX-01: Single Writer Pattern Violation (BUG-C1) 

CRITICAL 

2.1 รายละเอียดปัญหา 

กฎที่ละเมิด: Single Writer Pattern \+ ข้อ 8 (Namespace Collision Prevention) 

ไฟล์ที่เกี่ยวข้อง: 18\_ServiceSCG.gs (ผู้เรียก), 21\_AliasService.gs (ผู้ถูกเรียก), 10\_MatchEngine.gs (Single Writer ที่ถูกต้อง) 

ความเสี่ยง: ข้อมูล M\_ALIAS ถูกเขียนจาก 2 จุดใน Pipeline อัตโนมัติ ทำ ให้เกิด Race Condition, ข้อมูลซ้ำ ซ้อซ้ น, และ Cache Inconsistency 

ตามสถาปัตยกรรม Hybrid Alias ของ LMDS V5.4 กำ หนดว่า M\_ALIAS ใน Pipeline อัตโนมัติต้องถูกเขียนจากจุดเดียว เท่านั้น คือ autoEnrichAliasesFromFactBatch\_() ใน 10\_MatchEngine.gs แต่ปัจจุบัน 18\_ServiceSCG.gs เรียก populateAliasFromSCGRawData\_() หลังจากดึงข้อมูล SCG ซึ่งซึ่เขียน M\_ALIAS โดยตรงผ่าน createGlobalAlias() — เป็นการ ละเมิด Single Writer Pattern 

2.2 โค้ดปัจจุบัน (ผิด) 

ไฟล์: 18\_ SERVICESCG.GS บรรทัด 199-208 

// ปัจจุบัน: เรียก populateAliasFromSCGRawData\_() ใน Pipeline อัตโนมัติ 

applyMasterCoordinatesToDailyJob(); 

// \[NEW v5.4.000\] ดึงชื่อปลายทางจากข้อมูล SCG ใหม่ → M\_ALIAS 

if (typeof populateAliasFromSCGRawData\_ \=== 'function') { 

try { 

populateAliasFromSCGRawData\_(); // ❌ ละเมิด Single Writer — เขียน M\_ALIAS นอก autoEnrich } catch (aliasErr) { 

logWarn('ServiceSCG', 'populateAliasFromSCGRawData\_ ล้มเหลว: ' \+ aliasErr.message); 

} 

} 

2.3 โค้ดที่แก้ไขแล้ว (ถูกต้อง) 

แนวทาง: ย้ายการเรียก populateAliasFromSCGRawData\_() ออกจาก Pipeline อัตโนมัติ (18\_ServiceSCG) และให้ SCG Names ถูกเพิ่มเข้า M\_ALIAS ผ่าน autoEnrichAliasesFromFactBatch\_() แทน — ซึ่งซึ่จะเกิดขึ้นโดยอัตโนมัติเมื่อ Match Engine ประมวลผล FACT\_DELIVERY อยู่แล้ว หากต้องการเพิ่ม Alias จาก SCG ดิบทันที ให้ย้ายไปเป็นเมนู Admin แทน ไฟล์: 18\_ SERVICESCG.GS — ลบกา รเรียก POPULATEALIASFROMSCGRAWDATA\_ () ออก 

// แก้ไข: ไม่เรียก populateAliasFromSCGRawData\_() ใน Pipeline อัตโนมัติ 

applyMasterCoordinatesToDailyJob(); 

// \[REMOVED v5.4.002\] ลบ populateAliasFromSCGRawData\_() ออกจาก Pipeline 

// เหตุผล: ละเมิด Single Writer Pattern — M\_ALIAS ต้องเขียนที่ autoEnrich เท่านั้น  
// ชื่อจาก SCG จะถูกเพิ่มเข้า M\_ALIAS อัตโนมัติผ่าน autoEnrichAliasesFromFactBatch\_() // หากต้องการดึง Alias จาก SCG ดิบทันที → ใช้เมนู "ดึงชื่อจาก SCG ดิบ → M\_ALIAS" แทน 

buildOwnerSummary(); 

buildShipmentSummary(); 

2.4 ขั้นขั้ ตอนการแก้ไข 

ลบการเรียก populateAliasFromSCGRawData\_() ออกจาก fetchDataFromSCGJWD() ใน 1   
18\_ServiceSCG.gs (บรรทัด 201-208) 

ตรวจสอบ autoEnrichAliasesFromFactBatch\_() ใน 10\_MatchEngine.gs ว่ารองรับการเพิ่ม Alias จาก 2   
ShipToName ใน FACT\_DELIVERY อยู่แล้ว — ซึ่งซึ่รองรับแล้วในบรรทัด 316-384 

อัปเดต Dependency Comment ในหัวไฟล์ 18\_ServiceSCG.gs — ลบ populateAliasFromSCGRawData\_ 3   
ออกจาก CALLS 

ทดสอบ: รัน fetchDataFromSCGJWD() → ตรวจสอบว่า M\_ALIAS ยังได้รับข้อมูลผ่าน autoEnrich หลังรัน Match 4  
Engine 

2.5 ผลกระทบ 

การแก้ไขนี้จะทำ ให้ Alias จาก SCG ถูกเพิ่มล่าช้าช้ขึ้นเล็กน้อย (หลังรัน Match Engine แทนที่จะเป็นทันทีหลังดึงข้อมูล SCG) แต่รับ ประกันความสมบูรณ์ของข้อมูล M\_ALIAS เนื่องจากมีจุดเขียนเดียว ลดความเสี่ยง Race Condition และ Cache Inconsistency อย่างมีนัยสำ คัญ ผู้ใช้ที่ช้ ที่ต้องการ Alias ทันทีสามารถใช้เช้มนู "ดึงชื่อชื่จาก SCG ดิบ" ซึ่งซึ่อยู่ในเมนู ระบบ & ตั้งตั้ ค่า อยู่ แล้ว   
3\. FIX-02: MIGRATION ขาด Time Guard \+ Checkpoint (BUG-C4) CRITICAL 

3.1 รายละเอียดปัญหา 

กฎที่ละเมิด: ข้อ 5 (Checkpoint & Resume) 

ไฟล์: 21\_AliasService.gs — MIGRATION\_HybridAliasSystem() บรรทัด 451-547 

ความเสี่ยง: GAS มี Time Limit 6 นาที — MIGRATION ที่ประมวลผลมากกว่า 5,000 แถวจะ Timeout กลางคัน โดย ไม่มีจุดบันทึก ทำ ให้ต้องเริ่มใหม่ตั้งตั้ แต่แถวแรกทุกครั้งรั้ 

ฟังก์ชันชั MIGRATION\_HybridAliasSystem() มี 5 ขั้นขั้ ตอนหลัก แต่ละขั้นขั้ ตอนมีการวนลูป forEach() และเรียก createGlobalAlias() ซึ่งซึ่ทำ appendRow() ทีละแถว (ละเมิดข้อ 4 ด้วย) โดยไม่มี Time Guard ตรวจสอบเวลา และไม่มี Checkpoint บันทึกตำ แหน่งปัจจุบัน 

3.2 โค้ดที่แก้ไขแล้ว — เพิ่มพิ่ Time Guard \+ Batch Write \+ Checkpoint 

เนื่องจากฟังก์ชันชั ยาวมาก จะแสดงเฉพาะส่วนที่แก้ไขสำ คัญ: 

เพิ่ม CONSTANTS ที่หัวไฟล์ 21\_ALIASSERVICE.GS 

// Checkpoint keys สำ หรับ Migration 

var MIGRATION\_CHECKPOINT\_KEY \= 'MIGRATION\_ALIAS\_STEP'; 

var MIGRATION\_TIME\_LIMIT\_SEC \= 5 \* 60; // 5 นาที (เผื่อ 1 นาที) 

แก้ไข MIGRATION\_HYBRIDALIASSYSTEM() — เพิ่ม TIME GUARD \+ CHECKPOINT 

function MIGRATION\_HybridAliasSystem() { 

var ui \= SpreadsheetApp.getUi(); 

var confirmation \= ui.alert( 

'Migration: Hybrid Alias System', 

'ระบบจะดำ เนินการดังนี้:\\n' \+ 

'1. ตรวจสอบและเพิ่ม master\_uuid\\n' \+ 

'2. ย้าย M\_PERSON\_ALIAS → M\_ALIAS\\n' \+ 

'3. ย้าย M\_PLACE\_ALIAS → M\_ALIAS\\n' \+ 

'4. ดึงชื่อจากชีต SCG ดิบ → M\_ALIAS\\n' \+ 

'5. ดึงชื่อจาก FACT\_DELIVERY → M\_ALIAS\\n\\n' \+ 

'ระบบรองรับ Checkpoint — หาก Timeout จะรันต่อได้\\n\\n' \+ 

'พร้อมดำ เนินการหรือไม่?', 

ui.ButtonSet.YES\_NO 

); 

if (confirmation \!== ui.Button.YES) return; 

var ss \= SpreadsheetApp.getActiveSpreadsheet(); 

var startTime \= Date.now(); 

var state \= loadMigrationCheckpoint\_(); 

// Step 1: ตรวจสอบ master\_uuid (ทำ เฉพาะครั้งแรก)  
if (state.step \<= 1\) { 

logInfo('AliasService', 'Step 1: ตรวจสอบ master\_uuid...'); 

var uuidFixed \= assignMasterUuidIfMissing(); 

logInfo('AliasService', 'เพิ่ม master\_uuid ให้ ' \+ uuidFixed \+ ' entities'); CacheService.getScriptCache().removeAll( 

\['M\_PERSON\_ALL','M\_PLACE\_ALL','M\_GLOBAL\_ALIAS\_ALL','M\_GLOBAL\_ALIAS\_REVERSE'\] ); 

saveMigrationCheckpoint\_(2, 0); // ไป Step 2 

} 

// Step 2: ย้าย M\_PERSON\_ALIAS → M\_ALIAS (Batch \+ Time Guard) if (state.step \<= 2\) { 

logInfo('AliasService', 'Step 2: ย้าย M\_PERSON\_ALIAS → M\_ALIAS...'); var personAliasSheet \= ss.getSheetByName(SHEET.M\_PERSON\_ALIAS); if (personAliasSheet && personAliasSheet.getLastRow() \> 1\) { var paData \= personAliasSheet.getRange(2, 1, 

personAliasSheet.getLastRow() \- 1, SCHEMA\[SHEET.M\_PERSON\_ALIAS\].length ).getValues(); 

var batchRows \= \[\]; 

for (var i \= state.rowIndex; i \< paData.length; i++) { 

// Time Guard ทุก 50 แถว 

if (i % 50 \=== 0 && hasTimePassed\_(startTime, MIGRATION\_TIME\_LIMIT\_SEC)) { saveMigrationCheckpoint\_(2, i); 

logInfo('AliasService', 'Checkpoint Step 2 ที่แถว ' \+ i); 

ui.alert('⏰ Migration ใกล้ Timeout\\n\\n' \+ 

'Step 2 แถวที่ ' \+ i \+ '/' \+ paData.length \+ 

'\\nรันใหม่เพื่อดำ เนินการต่อ'); 

return; 

} 

var r \= paData\[i\]; 

if (\!r\[PERSON\_ALIAS\_IDX.ACTIVE\_FLAG\]) continue; 

var personId \= String(r\[PERSON\_ALIAS\_IDX.PERSON\_ID\] || ''); 

var aliasName \= String(r\[PERSON\_ALIAS\_IDX.ALIAS\_NAME\] || ''); var matchScore \= Number(r\[PERSON\_ALIAS\_IDX.MATCH\_SCORE\] || 100); if (\!personId || \!aliasName) continue; 

var masterUuid \= convertPersonIdToUuid(personId); 

if (masterUuid) { 

batchRows.push(\[generateShortId('A'), masterUuid, aliasName, 'PERSON', matchScore, 'V52\_LEGACY\_MIGRATION', new Date(), true\]); } 

// Batch write ทุก 100 แถว 

if (batchRows.length \>= 100\) { 

batchAppendToAliasSheet\_(batchRows); 

batchRows \= \[\]; 

} 

} 

if (batchRows.length \> 0\) batchAppendToAliasSheet\_(batchRows); } 

saveMigrationCheckpoint\_(3, 0); 

}  
// Step 3-5: โครงสร้างคล้ายกัน — เพิ่ม Time Guard \+ Batch 

// ... (โครงสร้างเดียวกันกับ Step 2\) 

// เสร็จสิ้น — ลบ Checkpoint 

clearMigrationCheckpoint\_(); 

logInfo('AliasService', 'Migration เสร็จสิ้น'); 

} 

// Helper: Batch append to M\_ALIAS 

function batchAppendToAliasSheet\_(rows) { 

var ss \= SpreadsheetApp.getActiveSpreadsheet(); 

var sheet \= ss.getSheetByName(SHEET.M\_ALIAS); 

if (\!sheet || rows.length \=== 0\) return; 

sheet.getRange(sheet.getLastRow() \+ 1, 1, rows.length, rows\[0\].length) .setValues(rows); 

CacheService.getScriptCache().remove('M\_GLOBAL\_ALIAS\_ALL'); CacheService.getScriptCache().remove('M\_GLOBAL\_ALIAS\_REVERSE'); } 

// Helper: Checkpoint functions 

function saveMigrationCheckpoint\_(step, rowIndex) { 

PropertiesService.getScriptProperties().setProperty( 

MIGRATION\_CHECKPOINT\_KEY, 

JSON.stringify({ step: step, rowIndex: rowIndex }) 

); 

} 

function loadMigrationCheckpoint\_() { 

var raw \= PropertiesService.getScriptProperties() 

.getProperty(MIGRATION\_CHECKPOINT\_KEY); 

if (raw) { try { return JSON.parse(raw); } catch(e) {} } 

return { step: 1, rowIndex: 0 }; 

} 

function clearMigrationCheckpoint\_() { 

PropertiesService.getScriptProperties() 

.deleteProperty(MIGRATION\_CHECKPOINT\_KEY); 

} 

function hasTimePassed\_(startTime, limitSec) { 

return (Date.now() \- startTime) / 1000 \> limitSec; 

} 

3.3 ขั้นขั้ ตอนการแก้ไข 

เพิ่ม Constants — MIGRATION\_CHECKPOINT\_KEY, MIGRATION\_TIME\_LIMIT\_SEC ที่หัวไฟล์ 1   
21\_AliasService.gs 

เพิ่ม Helper Functions — saveMigrationCheckpoint\_, loadMigrationCheckpoint\_, 2   
clearMigrationCheckpoint\_, hasTimePassed\_, batchAppendToAliasSheet\_ 

แก้ MIGRATION\_HybridAliasSystem() — เพิ่ม Time Guard ทุก 50 แถว, Checkpoint บันทึก Step \+ 3  
RowIndex, Batch Write แทน appendRow   
ทดสอบ:รันMigrationกับข้อมูล\>1,000แถวแล้วตรวจสอบว่าCheckpointบันทึกถูกต้องและรันต่อได้จากจุดที่ 4  
ค้างไว้   
4\. FIX-03: Hardcode Index ใน 18\_ServiceSCG.gs 

HIGH 

4.1 รายละเอียดปัญหา 

กฎที่ละเมิด: ข้อ 3 (No Hardcode Index) — ห้ามใช้ตัช้ ตัวเลขตรงกับคอลัมน์ 

ไฟล์: 18\_ServiceSCG.gs บรรทัด 161-177 

ความเสี่ยง: หากเพิ่ม/ลดคอลัมน์ในชีตชีตารางงานประจำ วัน ระบบจะอ้างอิงผิดทันทีโดยไม่มี Error Message ชัดชัเจน 

4.2 โค้ดปัจจุบัน (ผิด) — มี Hardcode 8 จุด 

// บรรทัด 161-177 ใน fetchDataFromSCGJWD() 

const shopAgg \= {}; 

allFlatData.forEach(r \=\> { 

const key \= r\[28\]; // ❌ Hardcode — ควรใช้ DATA\_IDX.SHOP\_KEY 

if (\!shopAgg\[key\]) shopAgg\[key\] \= { qty: 0, weight: 0, invoices: new Set(), epod: 0 }; shopAgg\[key\].qty \+= Number(r\[14\]) || 0; // ❌ Hardcode — ควรใช้ DATA\_IDX.QTY shopAgg\[key\].weight \+= Number(r\[16\]) || 0; // ❌ Hardcode — ควรใช้ DATA\_IDX.WEIGHT shopAgg\[key\].invoices.add(r\[2\]); // ❌ Hardcode — ควรใช้ DATA\_IDX.INVOICE\_NO if (checkIsEPOD(r\[9\], r\[2\])) shopAgg\[key\].epod++; // ❌ r\[9\] → DATA\_IDX.SOLD\_TO\_NAME }); 

allFlatData.forEach(r \=\> { 

const agg \= shopAgg\[r\[28\]\]; // ❌ Hardcode 

const scanInv \= agg.invoices.size \- agg.epod; 

r\[23\] \= agg.qty; // ❌ Hardcode — ควรใช้ DATA\_IDX.TOT\_QTY 

r\[24\] \= Number(agg.weight.toFixed(2)); // ❌ Hardcode — ควรใช้ DATA\_IDX.TOT\_WEIGHT r\[25\] \= scanInv; // ❌ Hardcode — ควรใช้ DATA\_IDX.SCAN\_INV 

r\[27\] \= \`${r\[9\]} / รวม ${scanInv} บิล\`; // ❌ Hardcode — DATA\_IDX.OWNER\_LABEL 

}); 

4.3 โค้ดที่แก้ไขแล้ว (ถูกต้อง) 

// ใช้ DATA\_IDX constants จาก 01\_Config.gs 

const shopAgg \= {}; 

allFlatData.forEach(r \=\> { 

const key \= r\[DATA\_IDX.SHOP\_KEY\]; 

if (\!shopAgg\[key\]) shopAgg\[key\] \= { qty: 0, weight: 0, invoices: new Set(), epod: 0 }; shopAgg\[key\].qty \+= Number(r\[DATA\_IDX.QTY\]) || 0; 

shopAgg\[key\].weight \+= Number(r\[DATA\_IDX.WEIGHT\]) || 0; 

shopAgg\[key\].invoices.add(r\[DATA\_IDX.INVOICE\_NO\]); 

if (checkIsEPOD(r\[DATA\_IDX.SOLD\_TO\_NAME\], r\[DATA\_IDX.INVOICE\_NO\])) shopAgg\[key\].epod++; }); 

allFlatData.forEach(r \=\> { 

const agg \= shopAgg\[r\[DATA\_IDX.SHOP\_KEY\]\];  
const scanInv \= agg.invoices.size \- agg.epod; 

r\[DATA\_IDX.TOT\_QTY\] \= agg.qty; 

r\[DATA\_IDX.TOT\_WEIGHT\] \= Number(agg.weight.toFixed(2)); 

r\[DATA\_IDX.SCAN\_INV\] \= scanInv; 

r\[DATA\_IDX.OWNER\_LABEL\] \= \`${r\[DATA\_IDX.SOLD\_TO\_NAME\]} / รวม ${scanInv} บิล\`; }); 

4.4 ขั้นขั้ ตอนการแก้ไข 

ตรวจสอบ DATA\_IDX ใน 01\_Config.gs ว่ามีครบทุกคีย์ที่ต้องใช้:ช้ SHOP\_KEY, QTY, WEIGHT, INVOICE\_NO,   
1 

SOLD\_TO\_NAME, TOT\_QTY, TOT\_WEIGHT, SCAN\_INV, OWNER\_LABEL — มีครบแล้วทุกคีย์ 

2 แทนที่ Hardcode ทั้ง 8 จุดด้วย DATA\_IDX constants ตามตารางด้านล่าง 3 ทดสอบ: รัน fetchDataFromSCGJWD() → ตรวจสอบชีตชีตารางงานประจำ วันว่าข้อมูลถูกต้อง

Hardcode ค่า DATA\_IDX Constant r\[28\] ShopKey DATA\_IDX.SHOP\_KEY r\[14\] ItemQuantity DATA\_IDX.QTY r\[16\] ItemWeight DATA\_IDX.WEIGHT r\[2\] InvoiceNo DATA\_IDX.INVOICE\_NO r\[9\] SoldToName DATA\_IDX.SOLD\_TO\_NAME r\[23\] TotQty DATA\_IDX.TOT\_QTY r\[24\] TotWeight DATA\_IDX.TOT\_WEIGHT r\[25\] ScanInv DATA\_IDX.SCAN\_INV r\[27\] OwnerLabel DATA\_IDX.OWNER\_LABEL   
5\. FIX-04: Fake Function Call — autoInstallSmartNav\_() HIGH 

5.1 รายละเอียดปัญหา 

กฎที่ละเมิด: ข้อ 7 (No Fake Function Calls) — ห้ามเรียกฟังก์ชันชัที่ไม่มีจริงในโปรเจกต์ 

ไฟล์: 00\_App.gs บรรทัด 89 

ความเสี่ยง: ฟังก์ชันชันี้ไม่มีนิยามในโปรเจกต์ แม้จะมี try-catch ครอบไว้จึงไม่ Error แต่เป็น "Dead Code" ที่ทำ ให้เข้าใจ ผิดว่า Smart Navigation ติดตั้งตั้ อัตโนมัติ (ซึ่งซึ่ไม่ได้ทำ ) 

5.2 โค้ดปัจจุบัน (ผิด) 

// 00\_App.gs บรรทัด 89 

try { autoInstallSmartNav\_(); } catch (\_) {} 

// ❌ autoInstallSmartNav\_() ไม่มีนิยามในโปรเจกต์ — Fake Call 

5.3 โค้ดที่แก้ไขแล้ว (ถูกต้อง) 

มี 2 ทางเลือก: 

ทางเลือก A: ลบออก (แนะนำ ) 

// \[FIX v5.4.002\] ลบ autoInstallSmartNav\_() — ฟังก์ชันนี้ไม่มีนิยาม (Fake Call) 

// Smart Navigation ติดตั้งผ่านเมนู "ติดตั้ง Smart Navigation" เท่านั้น 

// ผู้ใช้ต้องติดตั้งเองจากเมนู → ระบบ & ตั้งค่า → ติดตั้ง Smart Navigation 

ทางเลือก B: สร้างฟังก์ชันจริง (ถ้าต้องการ Auto-Install) 

/\*\* 

\* autoInstallSmartNav\_ — ตรวจสอบและติดตั้ง Smart Navigation อัตโนมัติ 

\* ตรวจว่ามี Installable Trigger สำ หรับ handleSelectionChange\_ แล้วหรือยัง 

\* ถ้ายัง → ติดตั้งอัตโนมัติ 

\*/ 

function autoInstallSmartNav\_() { 

var triggers \= ScriptApp.getProjectTriggers(); 

var hasSmartNav \= triggers.some(function(t) { 

return t.getHandlerFunction() \=== 'handleSelectionChange\_'; 

}); 

if (\!hasSmartNav) { 

ScriptApp.newTrigger('handleSelectionChange\_') 

.forSpreadsheet(SpreadsheetApp.getActive()) 

.onSelectionChange() 

.create();  
logInfo('App', 'autoInstallSmartNav: ติดตั้ง Smart Navigation อัตโนมัติ'); } 

} 

5.4 ขั้นขั้ ตอนการแก้ไข 

เลือกทางเลือก A หรือ B — หากไม่ต้องการ Auto-Install ให้ลบบรรทัดนั้นนั้ ออก (ทางเลือก A) หากต้องการ Auto   
1 

Install ให้สร้างฟังก์ชันชั จริง (ทางเลือก B) 

2 อัปเดต Comment ใน onOpen() อธิบายว่าทำ ไมจึงเลือกทางเลือกนั้นนั้ 

3 ทดสอบ: เปิด Spreadsheet → ตรวจสอบว่าไม่มี Error ใน Stackdriver Log และเมนูทำ งานปกติ

6\. FIX-05: ฟังฟั ก์ชันซ้ำ — loadCachedGeoRows\_() 

MEDIUM 

6.1 รายละเอียดปัญหา 

กฎที่ละเมิด: ข้อ 8 (Namespace Collision Prevention) — ห้ามตั้งตั้ ชื่อชื่ฟังก์ชันชั ซ้ำ กันในไฟล์ต่างๆ ไฟล์: 16\_GeoDictionaryBuilder.gs (บรรทัด 322\) และ 07\_PlaceService.gs (บรรทัด 638\) ความเสี่ยง: GAS รวม Global Scope — ฟังก์ชันชัที่โหลดทีหลังจะเขียนทับฟังก์ชันชั ก่อนหน้า ปัจจุบัน 07\_PlaceService.gs โหลดทีหลังแต่อ่านเพียง 4 คอลัมน์ ทำ ให้ 20\_ThGeoService.gs ซึ่งซึ่ต้องการ 16 คอลัมน์ได้ข้อมูล ไม่ครบ 

6.2 โค้ดปัจจุบัน — ฟังก์ชันชั ซ้ำ 2 แห่ง 

// 16\_GeoDictionaryBuilder.gs (บรรทัด 322\) — อ่าน 16 คอลัมน์ 

function loadCachedGeoRows\_() { 

if (\_GLOBAL\_GEO\_DICT\_CACHE) return \_GLOBAL\_GEO\_DICT\_CACHE; 

const data \= sheet.getRange(2, 1, sheet.getLastRow() \- 1, 

SCHEMA\[SHEET.SYS\_TH\_GEO\].length).getValues(); // ✅ 16 คอลัมน์ 

// ... map เป็น object 8 properties 

} 

// 07\_PlaceService.gs (บรรทัด 638\) — อ่าน 4 คอลัมน์ 

function loadCachedGeoRows\_() { 

if (\_GLOBAL\_GEO\_DICT\_CACHE) return \_GLOBAL\_GEO\_DICT\_CACHE; 

const data \= sheet.getRange(2, 1, sheet.getLastRow() \- 1, 4).getValues(); // ❌ 4 คอลัมน์ // ... map เป็น object 4 properties 

} 

6.3 โค้ดที่แก้ไขแล้ว   
แนวทาง: ลบ loadCachedGeoRows\_() ออกจาก 07\_PlaceService.gs แล้วให้ทุกไฟล์ใช้เช้วอร์ชันชั จาก 16\_GeoDictionaryBuilder.gs (ซึ่งซึ่อ่าน 16 คอลัมน์ครบถ้วน) 

// 07\_PlaceService.gs — ลบ loadCachedGeoRows\_() ออกทั้งฟังก์ชัน 

// \[FIX v5.4.002\] ลบฟังก์ชันซ้ำ — ใช้ loadCachedGeoRows\_() จาก 16\_GeoDictionaryBuilder.gs // ไฟล์ 07\_PlaceService.gs อ้างอิง loadCachedGeoRows\_ จาก 16\_GeoDictionaryBuilder.gs // (ระบุใน DEPENDENCIES comment ที่หัวไฟล์) 

อัปเดต DEPENDENCIES ใน 07\_PLACESERVICE.GS 

// ⚠️ Dependencies: 

// \- 16\_GeoDictionaryBuilder (loadCachedGeoRows\_) ← เพิ่มบรรทัดนี้ 

6.4 ขั้นขั้ ตอนการแก้ไข 

1 ลบ loadCachedGeoRows\_() ทั้งฟังก์ชันชั ออกจาก 07\_PlaceService.gs (บรรทัด 636-654) 

อัปเดต DEPENDENCIES ในหัวไฟล์ 07\_PlaceService.gs — เพิ่ม loadCachedGeoRows\_ → 2   
16\_GeoDictionaryBuilder.gs 

ตรวจสอบ ว่าไม่มีไฟล์อื่นที่เรียก loadCachedGeoRows\_() และคาดหวังผลลัพธ์ 4 คอลัมน์ (มีเฉพาะใน 3   
07\_PlaceService เอง) 

4 ทดสอบ: รัน lookupPostcodeByArea() → ตรวจสอบว่าข้อมูล Geo ครบ 8 properties  
7\. FIX-06: ฟังฟั ก์ชัน Utility ซ้ำ — safeAlert\_ / safeUiAlert\_ MEDIUM 

7.1 รายละเอียดปัญหา 

กฎที่ละเมิด: ข้อ 8 (Namespace Collision Prevention) — ฟังก์ชันชัทำ หน้าที่เดียวกันแต่ชื่อชื่ต่างกัน ไฟล์: 16\_GeoDictionaryBuilder.gs ( safeAlert\_ ) และ 13\_ReportService.gs ( safeUiAlert\_ ) ความเสี่ยง: การตั้งตั้ ชื่อชื่ไม่เป็นมาตรฐานทำ ให้ยากต่อการบำ รุงรักษา และหากมีไฟล์ที่ 3 ต้องการฟังก์ชันชันี้จะต้องเขียนซ้ำ อีก 

7.2 โค้ดปัจจุบัน — ฟังก์ชันชัเดียวกัน ชื่อชื่ต่างกัน 

// 16\_GeoDictionaryBuilder.gs (บรรทัด 465\) 

function safeAlert\_(message) { 

try { SpreadsheetApp.getUi().alert(message); } 

catch (e) { logInfo('GeoDictBuilder', \`\[UI Message\] ${message}\`); } 

} 

// 13\_ReportService.gs (บรรทัด 221\) 

function safeUiAlert\_(message) { 

try { SpreadsheetApp.getUi().alert(message); } 

catch (e) { logInfo('ReportService', \`\[UI Message\] ${message.substring(0, 100)}...\`); } } 

7.3 โค้ดที่แก้ไขแล้ว — ย้ายไป 14\_Utils.gs เป็นฟังก์ชันชั กลาง 

// 14\_Utils.gs — เพิ่มฟังก์ชันกลาง 

/\*\* 

\* safeAlert\_ — แสดง UI Alert อย่างปลอดภัย (Trigger-safe) 

\* ถ้ารันจาก Trigger ที่ไม่มี UI context → log แทน 

\* @param {string} message \- ข้อความที่จะแสดง 

\* @param {string} \[source\] \- ชื่อโมดูลที่เรียก (สำ หรับ log) 

\*/ 

function safeAlert\_(message, source) { 

try { 

SpreadsheetApp.getUi().alert(message); 

} catch (e) { 

var src \= source || 'System'; 

var msg \= message.length \> 200 ? message.substring(0, 200\) \+ '...' : message; 

logInfo(src, '\[UI Message\] ' \+ msg); 

} 

} 

// 16\_GeoDictionaryBuilder.gs — ลบ safeAlert\_() ออก และเรียกจาก 14\_Utils.gs 

// (เรียก safeAlert\_() ได้เลยเพราะ GAS Global Scope) 

// 13\_ReportService.gs — เปลี่ยนชื่อ safeUiAlert\_ → เรียก safeAlert\_ จาก 14\_Utils.gs  
// แทนที่: 

// safeUiAlert\_(msg) 

// เป็น: 

// safeAlert\_(msg, 'ReportService') 

7.4 ขั้นขั้ ตอนการแก้ไข 

1 เพิ่ม safeAlert\_() ใน 14\_Utils.gs พร้อม parameter source สำ หรับระบุโมดูลที่เรียก 2 ลบ safeAlert\_() ออกจาก 16\_GeoDictionaryBuilder.gs (บรรทัด 465-467) 

เปลี่ยน safeUiAlert\_() เป็น safeAlert\_() ใน 13\_ReportService.gs — แทนที่ทุกจุดที่เรียก safeUiAlert\_(msg) 3   
เป็น safeAlert\_(msg, 'ReportService') 

4 ลบ safeUiAlert\_() ออกจาก 13\_ReportService.gs 5 อัปเดต DEPENDENCIES ทั้ง 2 ไฟล์ — เพิ่ม safeAlert\_ → 14\_Utils.gs  
8\. FIX-07: autoEnrichAliasesFromFactBatch\_ ยาวเกิน 265 บรรทัด LOW 

8.1 รายละเอียดปัญหา 

กฎที่ละเมิด: ข้อ 1 (Clean Code — ฟังก์ชันชั ยาวไม่เกิน 30-50 บรรทัด), ข้อ 2 (Single Responsibility) ไฟล์: 10\_MatchEngine.gs — autoEnrichAliasesFromFactBatch\_() บรรทัด 238-503 (265 บรรทัด) ความเสี่ยง: ยากต่อการอ่าน ทำ ความเข้าใจ และ Debug แม้จะเป็น pure transformation function ก็ตาม 

ฟังก์ชันชันี้ทำ งาน 5 หน้าที่หลัก: (1) โหลด Person Map (2) โหลด Place Map (3) โหลด Alias Dedup Sets (4) สะสมแถวใหม่ จาก factBatch (5) Batch Write ทั้ง 3 ชีตชี ซึ่งซึ่ละเมิดกฎข้อ 2 (1 ฟังก์ชันชั \= 1 หน้าที่) 

8.2 โครงสร้าร้งที่แก้ไขแล้ว — แยกเป็น 4 Sub-functions 

/\*\* 

\* autoEnrichAliasesFromFactBatch\_ — \[REWRITE v5.4.002\] Single Writer Pattern 

\* แยกเป็น sub-functions เพื่อให้อ่านง่ายและ debug ง่าย 

\*/ 

function autoEnrichAliasesFromFactBatch\_(factBatch) { 

if (\!factBatch || factBatch.length \=== 0\) return; 

// 1\. โหลดข้อมูลอ้างอิง 

var refs \= loadEnrichReferenceData\_(); 

// 2\. สะสมแถวใหม่ 

var newRows \= collectNewAliasRows\_(factBatch, refs); 

// 3\. Batch Write ทั้ง 3 ชีต 

batchWriteAliasRows\_(newRows); 

// 4\. Log 

logEnrichResult\_(newRows); 

} 

/\*\* Sub-function 1: โหลด Person Map, Place Map, Dedup Sets \*/ 

function loadEnrichReferenceData\_() { 

// \~50 บรรทัด — โหลด allPersons, allPlaces, existingAliasSets 

// คืน { personMap, placeMap, existingPersonAliasSet, 

// existingPlaceAliasSet, existingGlobalAliasSet, mAliasSheet } 

} 

/\*\* Sub-function 2: สะสมแถวใหม่จาก factBatch \*/ 

function collectNewAliasRows\_(factBatch, refs) { 

// \~80 บรรทัด — วนลูป factBatch สร้าง newGlobalAliasRows, 

// newPersonAliasRows, newPlaceAliasRows 

// คืน { newGlobalAliasRows, newPersonAliasRows, newPlaceAliasRows } 

}  
/\*\* Sub-function 3: Batch Write ทั้ง 3 ชีต \*/ 

function batchWriteAliasRows\_(newRows) { 

// \~30 บรรทัด — setValues ทั้ง 3 ชีต \+ invalidate cache 

} 

/\*\* Sub-function 4: Log ผลลัพธ์ \*/ 

function logEnrichResult\_(newRows) { 

// \~10 บรรทัด 

} 

8.3 ขั้นขั้ ตอนการแก้ไข 

1 สร้าง loadEnrichReferenceData\_() — ย้ายส่วนโหลดข้อมูลอ้างอิง (บรรทัด 243-307) มาไว้ที่นี่ 2 สร้าง collectNewAliasRows\_() — ย้ายส่วนสะสมแถวใหม่ (บรรทัด 309-451) มาไว้ที่นี่ 3 สร้าง batchWriteAliasRows\_() — ย้ายส่วนเขียนชีตชี (บรรทัด 453-487) มาไว้ที่นี่ 4 สร้าง logEnrichResult\_() — ย้ายส่วน log (บรรทัด 489-503) มาไว้ที่นี่ 

5 แก้ autoEnrichAliasesFromFactBatch\_() — เรียก 4 sub-functions ตามลำ ดับ 

ทดสอบ: รัน Full Pipeline → ตรวจสอบว่า M\_ALIAS, M\_PERSON\_ALIAS, M\_PLACE\_ALIAS ได้รับข้อมูลถูกต้อง 6  
เหมือนเดิม   
9\. ลำ ดับความสำ คัญและแผนการดำ เนินงาน 

แนะนำ ให้ดำ เนินการแก้ไขตามลำ ดับความสำ คัญดังนี้ เพื่อลดความเสี่ยงสูงสุดก่อน และค่อยๆ ปรับปรุงคุณภาพโค้ด: 

ลำ ดับ รหัส ปัญหา ความเสี่ยงเวลา   
ประมาณไฟล์ที่แก้ 

1 FIX 01   
Single Writer Violation CRITICAL 15 นาที 18\_ServiceSCG.gs 

2 FIX 02   
MIGRATION ขาด Time Guard   
CRITICAL 45 นาที 21\_AliasService.gs 

3 FIX 03 

4 FIX 04   
Hardcode Index HIGH 10 นาที 18\_ServiceSCG.gs Fake Function Call HIGH 10 นาที 00\_App.gs 

5 FIX 05   
ฟังก์ชันซ้ำ 

loadCachedGeoRows\_   
MEDIUM 15 นาที 07\_PlaceService.gs 

6 FIX 06 

7 FIX 07   
Utility ซ้ำ safeAlert\_ MEDIUM 15 นาที 14\_Utils.gs, 13\_ReportService.gs, 16\_GeoDictionaryBuilder.gs 

ฟังก์ชันยาวเกิน 265 บรรทัด LOW 30 นาที 10\_MatchEngine.gs 

รวมเวลาประมาณ: 2 ชั่วชั่โมง 20 นาที (รวมทดสอบ) 

ไฟล์ที่ต้องแก้ไข: 6 ไฟล์ (00\_App, 07\_PlaceService, 10\_MatchEngine, 13\_ReportService, 14\_Utils, 16\_GeoDictionaryBuilder, 18\_ServiceSCG, 21\_AliasService) 

เวอร์ชันถัดไป: V5.4.002 

10\. Checklist สำ หรับรั ตรวจสอบหลังแก้ไข 

หลังจากดำ เนินการแก้ไขทั้ง 7 ข้อแล้ว ให้ตรวจสอบตาม Checklist นี้ทุกรายการ: 

Functional Testing 

☐ รัน fetchDataFromSCGJWD() — ข้อมูล SCG ดึงมาได้ปกติ ไม่มี Error 

☐ รัน Full Pipeline — M\_ALIAS ได้รับ Alias จาก autoEnrich เท่านั้นนั้ (ไม่มีจุดเขียนอื่น) ☐ รัน MIGRATION\_HybridAliasSystem() — มี Time Guard \+ Checkpoint ทำ งานถูกต้อง  
☐ หยุด Migration กลางคัน → รันใหม่ → ดำ เนินการต่อจากจุดที่ค้างไว้ได้ 

☐ ตรวจสอบชีตชีตารางงานประจำ วัน — ข้อมูล TOT\_QTY, TOT\_WEIGHT, SCAN\_INV, OWNER\_LABEL ถูกต้อง ☐ เปิด Spreadsheet — ไม่มี Error ใน Stackdriver Log จาก autoInstallSmartNav\_ 

☐ รัน lookupPostcodeByArea() — ข้อมูล Geo ครบ 8 properties (ไม่ใช่ 4\) 

☐ รัน buildFullQualityReport() — แสดง Alert ได้ปกติ (safeAlert\_ ทำ งาน) 

☐ รัน buildGeoDictionary() — แสดง Alert ได้ปกติ (safeAlert\_ ทำ งาน) 

Code Quality (15 กฎ) 

☐ ข้อ 3 — ไม่มี hardcode index เหลืออยู่ใน 18\_ServiceSCG.gs 

☐ ข้อ 4 — MIGRATION ใช้ batch setValues() แทน appendRow() ในลูป 

☐ ข้อ 5 — MIGRATION มี Time Guard \+ Checkpoint \+ Resume 

☐ ข้อ 6 — ทุกไฟล์ที่แก้มี DEPENDENCIES comment อัปเดตแล้ว 

☐ ข้อ 7 — ไม่มี Fake Function Call เหลืออยู่ 

☐ ข้อ 8 — ไม่มีฟังก์ชันชั ชื่อชื่ซ้ำ ข้ามไฟล์

เอกสารฉบับนี้จัดทำ โดย Super Z (AI Principal Engineer) โดยอ้างอิงจากกฎการเขียนโค้ด LMDS 15 ข้อ, lmds-supreme-engineer skill, และ การ Cross-Validation โดย 5 ระบบ AI 

เวอร์ชัน: V5.4.002-draft | วันที่: 25 พฤษภาคม 2569 