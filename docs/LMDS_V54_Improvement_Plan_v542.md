LMDS 

Location Master Data System 

แผนการปรับปรุงโค้ด V5.4 

Bug Fix \+ Architecture Improvement \+ Business Flow Alignment v5.4.002 

วันที่: 26 พฤษภาคม 2569 

สถานะ: แก้ไขเสร็จสมบูรณ์ — พร้อมนำ ไปใช้งาน 

Cross-Validated by: Claude 100% | Genspark 90% | Zai 75%  
1\. Business Flow: กลุ่ม 1 vs กลุ่ม 2 

หลักการสำ คัญ: ระบบ LMDS แบ่งเป็น 2 กลุ่มหลักที่ทำ งานแยกกันอย่างชัดเจน — กลุ่ม 1 เป็นฝ่าย "เตรียมพิกัด" (Write) และกลุ่ม 2 เป็นฝ่าย "เรียกใช้พิกัด" (Read) ห้ามสลับบทบาทเด็ดขาด 

กลุ่ม 1: ฝ่ายเรียนรู้และทำ ความสะอาดข้อมูล 

SCG ดิบ 

(ชีต 

SCGนครหลวงJWDภูมิภาค)   
→Normalize 

(Module 05\)→Match Engine (Module 10\) 

\+ M\_PLACE→M\_ALIAS (Single Writer)   
M\_PERSON   
autoEnrichAliasesFromFactBatch\_()→M\_DESTINATION (พิกัดแท้ 100%) 

หน้าที่: รับข้อมูลดิบจากงานที่จบแล้ว → ทำ ความสะอาด → สร้าง Master Data พิกัดที่แม่นยำ 100% โดยอ้างอิง LatLong จากคนขับรถ (เชื่อถือได้) 

ชีตที่เกี่ยวข้อง: SCGนครหลวงJWDภูมิภาค, SYS\_TH\_GEO, M\_PERSON, M\_PLACE, M\_GEO\_POINT, M\_DESTINATION, M\_ALIAS 

กลุ่ม 2: ฝ่ายดึงข้อมูลทำ งานประจำ วัน 

ตารางงาน 

SCG API   
(fetchDataFromSCGJWD)→ M\_DESTINATION   
ประจำ วัน 

(ShipToName \= Index 10\)   
→ค้นหา M\_ALIAS (fastLookupByShipToName) 

(อ่านพิกัดแท้)→เติม LatLong\_Actual   
ในตารางงานประจำ วัน 

หน้าที่: ดึงงานใหม่จาก SCG API → ค้นหา ShipToName ใน M\_ALIAS → ดึง LatLong แท้มาเติมใน LatLong\_Actual 

ชีตที่เกี่ยวข้อง: Input, ตารางงานประจำ วัน, ข้อมูลพนักงาน, สรุป\_Shipment, สรุป\_เจ้าของสินค้า 

ข้อยืนยัน: คอลัมน์ที่น์ ที่เข้ากระบวนการค้นหาพิกัดคือ SHIP\_TO\_NAME (DATA\_IDX \= 10\) ไม่ใช่ SoldToName — เพราะ ShipToName คือจุดหมายปลายทางที่แท้จริงของการ จัดส่ง 

ข้อยืนยัน: โค้ดดึงข้อมูล SCG API (fetchDataFromSCGJWD) สมบูรณ์แล้ว — ห้าม แก้หรือตัดทิ้งทิ้  
2\. สรุปการแก้ไข Bug (v5.4.002) 

ID ระดับ ปัญหา การแก้ไข ไฟล์ สถานะ 

C1 Critical Single Writer Violation: 

populateAliasFromSCGRawData\_() 

ถูกเรียกจาก Group 2 

(fetchDataFromSCGJWD) เขียน 

M\_ALIAS โดยไม่ได้รับอนุญาต 

C4 Critical MIGRATION\_HybridAliasSystem() ไม่มี Time Guard — ข้อมูลเกิน 5000 แถว 

จะ Timeout (GAS จำ กัด 6 นาที) 

F1 High Fake Call: 

autoInstallSmartNav\_() ถูกเรียก 

ใน onOpen() แต่ไม่มี function นี้ — try 

catch กลืน error เงียบ 

H1 High Hardcode Index: r\[28\] , r\[14\] , r\[16\] , r\[2\] , r\[9\] , r\[23\] , 

r\[24\] , r\[25\] , r\[27\] ใน 

shopAgg logic 

D1 High Duplicate Function: 

loadCachedGeoRows\_() มี 2 เวอร์ชัน 

— 07\_PlaceService (4 คอลัมน์เน์ก่า) 

เขียนทับ 16\_GeoDictBuilder (16 คอลัมน์ 

ใหม่) 

P1 Medium Performance: 

updateDestinationStats() ใช้ 

row-by-row setValue() 3 ครั้งรั้ (3 

API calls ต่อ 1 แถว)   
ลบการเรียก 

populateAliasFromSCGRawData\_() ออกจาก fetchDataFromSCGJWD() — Group 2 ห้ามเขียน M\_ALIAS เด็ดขาด ให้ใช้เมนู Migration/Admin แทน 

เพิ่ม Time Guard (5 นาที) ตรวจทุก 50 แถวใน forEach loop → เปลี่ยนเป็น for loop เพื่อ break ได้ \+ แจ้งเตือน Timeout พร้อมวิธีแก้ 

สร้าง autoInstallSmartNav\_() ที่ ถูกต้อง — ตรวจว่ามี trigger อยู่แล้วหรือ ไม่ ถ้าไม่มีค่อยติดตั้งตั้แบบเงียบ (ไม่ถามผู้ ใช้) 

แทนที่ด้วย DATA\_IDX.SHOP\_KEY , DATA\_IDX.QTY , 

DATA\_IDX.WEIGHT , 

DATA\_IDX.INVOICE\_NO , 

DATA\_IDX.SOLD\_TO\_NAME , 

DATA\_IDX.TOT\_QTY , 

DATA\_IDX.TOT\_WEIGHT , 

DATA\_IDX.SCAN\_INV , 

DATA\_IDX.OWNER\_LABEL 

ลบ loadCachedGeoRows\_() เวอร์ชัน เก่าออกจาก 07\_PlaceService.gs — ให้ ใช้ของ 16\_GeoDictionaryBuilder.gs แทน (รองรับ searchKey, postalKey, 

noteType, noteScope) 

เปลี่ยนเป็น batch setValues() — อ่าน 3 คอลัมน์ → แก้ใน RAM → เขียนที เดียว (ลดจาก 3+1 API calls → 1+1)   
18\_ServiceSCG.gs Done 

21\_AliasService.gs Done 00\_App.gs Done 18\_ServiceSCG.gs Done 

07\_PlaceService.gs Done 09\_DestinationService.gs Done   
C2 Medium Consolidate: safeAlert\_() (16\_GeoDictBuilder) \+ 

safeUiAlert\_() (13\_ReportService) 

ทำ หน้าที่เดียวกันแต่คนละชื่อ   
สร้าง safeUiAlert\_() ใน 

14\_Utils.gs (Single Source of Truth) — safeAlert\_() ใน 16\_GeoDictBuilder เปลี่ยนเป็น wrapper เรียก safeUiAlert\_()   
14\_Utils.gs 

16\_GeoDictBuilder.gs   
Done  
3\. รายละเอียดการแก้ไข 

3.1 BUG-C1: Single Writer Violation (Critical) 

สถานะ: แก้ไขแล้ว | ไฟล์: 18\_ServiceSCG.gs 

ปัญหา: ใน fetchDataFromSCGJWD() (Group 2 Commander) มีการเรียก 

populateAliasFromSCGRawData\_() ซึ่งซึ่ เขียนข้อมูลลง M\_ALIAS ผ่าน createGlobalAlias() การกระทำ นี้ละเมิด Single Writer Pattern เพราะ M\_ALIAS ถูกกำ หนดให้เขียนที่ autoEnrichAliasesFromFactBatch\_() (Module 10\) เท่านั้น นอกจากนี้ยังละเมิดขอบเขตกลุ่ม เพราะ Group 2 ไม่ควรเขียน Master Data ของ Group 1 

การแก้ไข: ลบบล็อกการเรียก populateAliasFromSCGRawData\_() ออกจาก fetchDataFromSCGJWD() ทั้งทั้หมด พร้อมคอมเมนต์อธิบายเหตุผล ผู้ใช้ที่ต้องการดึงชื่อจาก SCG ดิบ → M\_ALIAS สามารถใช้เมนู "ระบบ \> ดึงชื่อจาก SCG ดิบ → M\_ALIAS" ได้ตามปกติ 

3.2 BUG-C4: Time Guard Missing (Critical) 

สถานะ: แก้ไขแล้ว | ไฟล์: 21\_AliasService.gs 

ปัญหา: MIGRATION\_HybridAliasSystem() ใช้ forEach() loop ที่ไม่สามารถหยุดกลางคันได้ หาก ข้อมูลมากกว่า 5000 แถว จะทำ ให้ GAS Timeout (จำ กัด 6 นาที) โดยไม่มีกลไกป้องกัน 

การแก้ไข: (1) เปลี่ยน forEach() เป็น for loop เพื่อให้ break ได้ (2) เพิ่ม Time Guard ตรวจทุก 50 แถว หากเกิน 5 นาทีจะหยุดพร้อมแจ้งเตือน (3) ตรวจเวลาก่อนเริ่ม Step 4 และ Step 5 (4) แจ้ง เตือน Timeout พร้อมคำ แนะนำ ให้รันอีกครั้งรั้ 

3.3 Fake Call: autoInstallSmartNav\_() 

สถานะ: แก้ไขแล้ว | ไฟล์: 00\_App.gs 

ปัญหา: ใน onOpen() มีการเรียก autoInstallSmartNav\_() แต่ไม่มี function นี้อยู่ในระบบ ทำ ให้ try-catch กลืน error เงียบ ฟังก์ชันที่มีอยู่คือ installSmartNavTrigger() แต่อันนั้นถามผู้ใช้ก่อนติด ตั้งตั้ (ไม่เหมาะกับ onOpen) 

การแก้ไข: สร้าง autoInstallSmartNav\_() ขึ้นขึ้ มาใหม่ — ตรวจสอบว่ามี Smart Navigation trigger อยู่แล้วหรือไม่ ถ้าไม่มีจึงติดตั้งตั้แบบเงียบ (silent install) โดยไม่ถามผู้ใช้ แยกจาก installSmartNavTrigger() ที่ยังคงไว้สำ หรับการติดตั้งตั้แบบแมนนวล 

3.4 Hardcode Index **→** DATA\_IDX.\* 

สถานะ: แก้ไขแล้ว | ไฟล์: 18\_ServiceSCG.gs 

ปัญหา: ในส่วน shopAgg ของ fetchDataFromSCGJWD() ใช้ตัวเลข index ตรงๆ (hardcode) แทนชื่อ คงที่ เช่น r\[28\] r\[14\] r\[16\] ทำ ให้อ่านยากและเสี่ยงผิดพลาดหากมีการเปลี่ยนแปลงโครงสร้าง คอลัมน์ 

เดิม (Hardcode) ใหม่ (Named Constant) ความหมาย r\[28\] r\[DATA\_IDX.SHOP\_KEY\] รหัสร้านค้า  
r\[14\] r\[DATA\_IDX.QTY\] จำ นวนสินค้า r\[16\] r\[DATA\_IDX.WEIGHT\] น้ำ หนักสินค้า r\[2\] r\[DATA\_IDX.INVOICE\_NO\] เลขที่ Invoice r\[9\] r\[DATA\_IDX.SOLD\_TO\_NAME\] ชื่อเจ้าของสินค้า 

r\[23\] r\[DATA\_IDX.TOT\_QTY\] จำ นวนรวมของร้าน r\[24\] r\[DATA\_IDX.TOT\_WEIGHT\] น้ำ หนักรวมของร้าน r\[25\] r\[DATA\_IDX.SCAN\_INV\] จำ นวน Invoice ต้องสแกน r\[27\] r\[DATA\_IDX.OWNER\_LABEL\] ป้ายชื่อเจ้าของสินค้า  
3.5 Duplicate Function: loadCachedGeoRows\_() สถานะ: แก้ไขแล้ว | ไฟล์: 07\_PlaceService.gs 

ปัญหา: loadCachedGeoRows\_() มีอยู่ 2 เวอร์ชัน — เวอร์ชันใน 07\_PlaceService.gs อ่านเพียง 4 คอลัมน์ (postcode, subDistrict, district, province) ส่วนเวอร์ชันใน 16\_GeoDictionaryBuilder.gs อ่าน ครบ 16 คอลัมน์ (เพิ่ม searchKey, postalKey, noteType, noteScope) เนื่องจาก GAS มี global scope ฟังก์ชันที่โหลดทีหลังจะเขียนทับตัวก่อนหน้า ทำ ให้เวอร์ชันที่ได้ไม่แน่นอนขึ้นขึ้ อยู่กับลำ ดับการโหลด 

การแก้ไข: ลบ loadCachedGeoRows\_() เวอร์ชันเก่าออกจาก 07\_PlaceService.gs และคงไว้เฉพาะ เวอร์ชัน 16 คอลัมน์ใน์น 16\_GeoDictionaryBuilder.gs ซึ่งซึ่ เป็น canonical version 

3.6 Performance: updateDestinationStats() 

สถานะ: แก้ไขแล้ว | ไฟล์: 09\_DestinationService.gs 

ปัญหา: เดิมใช้ setValue() แยก 3 ครั้งรั้ (lastSeen, usageCount, deliveryDate) ทำ ให้มี 3-4 API calls ต่อการอัปเดต 1 แถว — เมื่อ Match Engine ประมวลผลหลายร้อยแถวจะช้ามาก 

การแก้ไข: เปลี่ยนเป็น batch write — อ่านทั้งทั้ 3 คอลัมน์มน์ าแก้ไขใน RAM แล้วเขียนกลับทีเดียวด้วย setValues(\[rowData\]) ลดจาก 3-4 API calls เหลือ 1-2 calls ต่อแถว 

3.7 Consolidate: safeAlert\_ \+ safeUiAlert\_ 

สถานะ: แก้ไขแล้ว | ไฟล์: 14\_Utils.gs 

ปัญหา: safeAlert\_() (16\_GeoDictionaryBuilder) และ safeUiAlert\_() (13\_ReportService) ทำ หน้าที่เดียวกัน — แสดง alert แบบ trigger-safe แต่อยู่คนละไฟล์ ซ้ำ ซ้อน 

การแก้ไข: สร้าง safeUiAlert\_() ใน 14\_Utils.gs เป็น Single Source of Truth พร้อมรองรับ พารามิเตอร์ title (optional) — safeAlert\_() ใน 16\_GeoDictionaryBuilder.gs เปลี่ยนเป็น wrapper เรียก safeUiAlert\_() เพื่อ backward compatibility 

4\. Architecture Rule Summary 

Rule คำ อธิบาย 

Single Writer Pattern M\_ALIAS เขียนที่ autoEnrichAliasesFromFactBatch\_() (Module 10\) เท่านั้น — ห้ามเรียก createGlobalAlias() ใน auto pipeline 

Group Boundary Rule Group 2 (Daily Ops) \= READ only สำ หรับ M\_ALIAS/M\_DESTINATION — ห้ามเขียน กลุ่ม 1 \= WRITE เท่านั้น 

Search Key \= ShipToName คอลัมน์ที่น์ ที่ใช้ค้นหาพิกัดคือ SHIP\_TO\_NAME (Index 10\) ไม่ใช่ SoldToName — ShipToName \= จุดหมายปลายทางจริง 

No Hardcode Index ใช้ DATA\_IDX.\* เสมอ ห้ามใช้ r\[28\] หรือตัวเลขตรงๆ 

API Fetch \= Immutable โค้ดดึงข้อมูล SCG API ( fetchDataFromSCGJWD ) สมบูรณ์แล้ว — ห้าม แก้ไขหรือตัดทิ้งทิ้ 

Time Guard Mandatory ทุก loop ที่ประมวลผลมากกว่า 100 แถว ต้องมี Time Guard ตรวจทุก 50 แถว  
No Fake Calls ทุก function ที่ถูกเรียกต้องมีนิยาม ห้ามเรียก function ที่ไม่มีอยู่ แม้จะมี try catch ครอบ 

Batch Over Row-by-Row ใช้ setValues() (batch) แทน setValue() (row-by-row) เสมอเมื่อ เป็นไปได้  
5\. ไฟล์ที่ถูกแก้ไข (v5.4.002) 

\# ไฟล์ Version การเปลี่ยนแปลง 

1 00\_App.gs v5.4.002 \+autoInstallSmartNav\_() — แก้ Fake Call bug 

2 07\_PlaceService.gs v5.4.002 \-loadCachedGeoRows\_() duplicate — ย้ายไป ใช้ของ 16 

3 09\_DestinationService.gs v5.4.002 updateDestinationStats() batch write (Performance) 

4 13\_ReportService.gs v5.4.002 safeUiAlert\_() → delegate to 14\_Utils 

5 14\_Utils.gs v5.4.002 \+safeUiAlert\_() — consolidated trigger-safe alert 

6 16\_GeoDictionaryBuilder.gs v5.4.002 safeAlert\_() → wrapper to safeUiAlert\_() 

7 18\_ServiceSCG.gs v5.4.002 \-populateAliasFromSCGRawData\_() call (C1) \+ DATA\_IDX.\* (H1) 

8 21\_AliasService.gs v5.4.002 MIGRATION\_HybridAliasSystem() \+Time Guard (C4) 

6\. ไฟล์ที่ไม่ถูกแก้ไข (Intentionally Preserved) 

หมายเหตุ: ไฟล์ต่อไปนี้ไม่ถูกแก้ไขโดยเจตนา — โค้ดเดิมทำ งานถูกต้องและสมบูรณ์ แล้ว 

ไฟล์ เหตุผลที่ไม่แก้ 

01\_Config.gs CONFIG และ IDX constants ถูกต้องครบถ้วน — ไม่ต้องแก้ 

17\_SearchService.gs runLookupEnrichment() มี Time Guard และ Batch Write อยู่แล้ว — ใช้ ShipToName (DATA\_IDX=10) ถูกต้อง 

10\_MatchEngine.gs autoEnrichAliasesFromFactBatch\_() เป็น Single Writer ที่ถูกต้อง — ไม่ต้อง แก้ 

20\_ThGeoService.gs เรียก loadCachedGeoRows\_() จาก 16 ซึ่งซึ่ ยังใช้ได้ปกติ — ไม่ต้องแก้ 7\. คำ แนะนำ การ Deploy 

1\. Backup: สำ รองข้อมูล Spreadsheet ก่อนนำ โค้ดใหม่ไปใช้ 

2\. Deploy Order: แทนที่ไฟล์ตามลำ ดับเลขไฟล์ (00 → 01 → ... → 21\) 

3\. Test C1: รัน fetchDataFromSCGJWD() → ตรวจว่า M\_ALIAS ไม่ถูกเขียนเพิ่ม (เฉพาะ READ) 4\. Test C4: รัน MIGRATION\_HybridAliasSystem() → ตรวจว่ามี Time Guard แจ้งเตือนเมื่อข้อมูล เยอะ 

5\. Test F1: เปิด Spreadsheet ใหม่ → ตรวจว่า Smart Navigation trigger ติดตั้งตั้อัตโนมัติ 6\. Test H1: รัน fetchDataFromSCGJWD() → ตรวจว่า ShopKey, TOT\_QTY ฯลฯ แสดงผลถูกต้อง  
7\. Verify: รัน "ตรวจสอบ System Integrity" → ต้องผ่านทุกอย่าง