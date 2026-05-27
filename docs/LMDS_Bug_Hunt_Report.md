LMDS Bug Hunt Report 

Critical & High Priority Analysis 

Logistics Master Data System (LMDS) V5.4 

Google Apps Script \- 22 Files \- 206 Functions 

| Category  | Result  | Details |
| ----- | :---: | ----- |
| BUG-01: Phantom Function Calls  | PASS | 0 phantom calls found. All 206 functions resolve correctly. |
| BUG-02: Duplicate Function Names  | PASS | 0 duplicates. All 206 function names are unique across 22 files. |
| BUG-03: Hardcoded Array Indexes  | HIGH | 8 violations \+ 2 systemic gaps (missing  SYS\_LOG\_IDX, misplaced MC\_\* constants) |
| BUG-04: Single Writer Violation  | CRITICAL | 6 violations. Root cause: createGlobalAlias() uses appendRow() bypassing Single Writer |
| BUG-05: Missing Time Guard  | CRITICAL | 9 functions lack Time Guard. 7 are direct menu entry points risking 6-min timeout |
| BUG-06: Row-by-Row Writes  | HIGH | 3 loop violations \+ 4 serial-write patterns (3-5 API calls per row instead of 1 batch) |
| BUG-07: Missing Try-Catch  | HIGH | 17 of 22 entry points lack try-catch. 2 destructive operations unprotected. |

Ancillary Findings 

Dead Code: 13 functions defined but never called (e.g., geocodeAddress, reverseGeocode, saveCheckpoint\_, loadCheckpoint\_). Stale Dependency Comment: 19\_Hardening.gs:29 references loadAllFacts\_() which does not exist.  
BUG-01: Phantom Function Calls 

Phantom function calls occur when code invokes a function that has no definition anywhere in the project, causing a ReferenceError at runtime. According to Rule 7 (Zero Hallucination), calling undefined functions is strictly forbidden. 

Result: PASS \- No Phantom Calls Found 

After exhaustive analysis of all 22 .gs files, every function that is called has a matching definition. The project contains 206 globally-scoped function declarations, and all 22 menu entry points (.addItem() references), all ScriptApp.newTrigger() references, and all 17 typeof-guarded calls resolve correctly to existing function definitions. 

Menu Entry Points (22 functions \- all verified) 

| Function  | Defined In |
| ----- | ----- |
| runFullPipeline  | 00\_App.gs:375 |
| fetchDataFromSCGJWD  | 18\_ServiceSCG.gs:66 |
| runMatchEngine  | 10\_MatchEngine.gs:85 |
| applyAllPendingDecisions  | 12\_ReviewService.gs:154 |
| MIGRATION\_HybridAliasSystem  | 21\_AliasService.gs:452 |
| generatePersonAliasesFromHistory  | 19\_Hardening.gs:188 |
| clearAllSCGSheets\_UI  | 18\_ServiceSCG.gs:376 |
| setupAllSheets  | 03\_SetupSheets.gs:64 |

Dead Code (Defined but Never Called)

| Function  | File:Line  | Notes |
| ----- | ----- | ----- |
| geocodeAddress()  | 15\_GoogleMapsAPI.gs:82  | Exported but never called |
| reverseGeocode()  | 15\_GoogleMapsAPI.gs:160  | Exported but never called |
| saveCheckpoint\_()  | 10\_MatchEngine.gs:834  | Checkpoint removed but function kept |
| loadCheckpoint\_()  | 10\_MatchEngine.gs:847  | Checkpoint removed but function kept |
| fixMissingSyncStatus()  | 19\_Hardening.gs:129  | Never called |
| fuzzyMatchAddress()  | 07\_PlaceService.gs:491  | Never called |

BUG-02: Duplicate Function Names (Global Scope Collision) 

In Google Apps Script, all .gs files share the same global scope. If two files define a function with the same name, the last one loaded silently overrides the first, causing unpredictable behavior. Rule 8 (Namespace Collision Prevention) requires using Object Namespace or Prefix patterns to avoid this. 

Result: PASS \- No Duplicates Found 

Comprehensive scan found all 206 top-level function declarations across 22 files are unique. No global scope collisions exist. The development team has maintained clean function naming hygiene with no silent override risk. Near-miss pairs (e.g., haversineDistance vs haversineDistanceM vs haversineDistanceKm) are intentionally distinct and do not collide.  
BUG-03: Hardcoded Array Indexes 

Rule 3 (No Hardcode Index) explicitly forbids using numeric indexes directly (e.g., row\[7\], col \=== 11\) in favor of named constants from 01\_Config.gs. When the sheet structure changes (columns added/reordered), hardcoded indexes silently point to wrong data, causing bugs that are extremely difficult to trace. 

8 Confirmed Violations 

V1: row\[1\] \- REVIEW\_IDX.ISSUE\_TYPE not used 

File: 10\_MatchEngine.gs:205 

const issueType \= String(row\[1\] || '').trim(); // index 1 \= issue\_type 

Should be: row\[REVIEW\_IDX.ISSUE\_TYPE\] \- The constant REVIEW\_IDX.ISSUE\_TYPE \= 1 already  exists in 01\_Config.gs:247. If the ISSUE\_TYPE column position changes, the coloring logic will  silently read the wrong field and apply incorrect row highlighting to the Q\_REVIEW sheet. 

V2-V4: r\[3\], e\[2\], e\[4\] \- SYS\_LOG columns without SYS\_LOG\_IDX 

File: 00\_App.gs:752, 757, 758 

const errors \= logData.filter(r \=\> String(r\[3\]).trim() \=== 'ERROR').slice(-5); 

const mod \= String(e\[2\] || '').substring(0, 20); 

const msg \= String(e\[4\] || '').substring(0, 80); 

Systemic Gap: SYS\_LOG\_IDX constant set does not exist in 01\_Config.gs, despite  SCHEMA.SYS\_LOG being defined in 02\_Schema.gs:225-232 with 6 columns. r\[3\] should be  SYS\_LOG\_IDX.LEVEL, e\[2\] should be SYS\_LOG\_IDX.MODULE, e\[4\] should be  SYS\_LOG\_IDX.MESSAGE. This is a systemic gap affecting all SYS\_LOG data access in the  diagnostic function. 

V5-V7: Hardcoded column numbers 2, 3, 18 in getRange 

File: 18\_ServiceSCG.gs:199, 200, 201 

dataSheet.getRange(2, 2, allFlatData.length, 1).setNumberFormat("dd/mm/yyyy"); 

dataSheet.getRange(2, 3, allFlatData.length, 1).setNumberFormat("@"); 

dataSheet.getRange(2, 18, allFlatData.length, 1).setNumberFormat("@"); 

Should be: DATA\_IDX.PLAN\_DELIVERY \+ 1 (=2), DATA\_IDX.INVOICE\_NO \+ 1 (=3),  DATA\_IDX.DELIVERY\_NO \+ 1 (=18). All DATA\_IDX constants exist in 01\_Config.gs. If column order  changes, the wrong columns get date/text formatted, corrupting data display silently. 

V8: Hardcoded column count 6 in setValues 

File: 19\_Hardening.gs:278 

aliasSheet.getRange(aliasSheet.getLastRow() \+ 1, 1, newAliasRows.length, 6).setValues(newAliasRows); Should be: SCHEMA\[SHEET.M\_PERSON\_ALIAS\].length instead of hardcoded 6\. If a column is added  to M\_PERSON\_ALIAS, this write will silently truncate data, losing the last column(s) without any   
error. 

2 Systemic Gaps

| Gap  | Issue  | Affected Code |
| ----- | ----- | ----- |
| Missing SYS\_LOG\_I DX | 01\_Config.gs has IDX for 13 sheets but not SYS\_LOG. SCHEMA.SYS\_LOG exists in  02\_Schema.gs:225-232. | 00\_App.gs:752, 757, 758 |
| MC\_\* constants in wrong file | 15\_GoogleMapsAPI.gs:65-71 defines MC\_KEY, MC\_LAT, MC\_LNG locally instead of  MAPS\_CACHE\_IDX in 01\_Config.gs. | 15\_GoogleMapsAPI.gs:65-71 |

BUG-04: Single Writer Pattern Violation 

The Single Writer Pattern dictates that only one function (the "designated writer") should write to a given sheet. For M\_ALIAS, the designated writer is autoEnrichAliasesFromFactBatch\_() in 10\_MatchEngine.gs. Any other function writing to M\_ALIAS violates this pattern, risking data corruption, duplicate entries, and race conditions. 

Designated Writer (No Violation) 

Function: autoEnrichAliasesFromFactBatch\_() in 10\_MatchEngine.gs:238-503. This function uses  batch setValues() with proper deduplication and is called from runMatchEngine() which has Time  Guard protection. 

Previously Fixed Violation (Confirmed Resolved) 

fetchDataFromSCGJWD() in 18\_ServiceSCG.gs previously called populateAliasFromSCGRawData\_()  in v5.4.001, which was the most critical violation because Group 2 (Daily Ops) wrote to M\_ALIAS  during the auto pipeline. This was FIXED in v5.4.002 \- lines 206-210 now show the removal with  explicit comment. The existing SCG API Fetch code must NOT be modified. 

6 Active Violations 

| \#  | Function  | File:Line  | Mechanism  | Trigger  | Severity |
| :---: | ----- | ----- | ----- | ----- | :---: |
| Roo  t | createGlobalAlias() | 21\_AliasService.g s:115 | sheet.appendRow() | Called by all  below | CRITICAL |
| V1 | generatePersonAliasesFr omHistory() | 19\_Hardening.gs: 283 | createGlobalAlias()  in loop | Menu  | HIGH |
| V2 | populateAliasFromSCGRa wData\_() | 21\_AliasService.g s:678 | createGlobalAlias()  in loop | Menu / Migratio n | HIGH |
| V3 | populateAliasFromFactDel ivery\_() | 21\_AliasService.g s:725 | createGlobalAlias()  in loop | Migration  | MEDIUM |
| V4  | mergePersonRecords() | 06\_PersonService. gs:406 | createGlobalAlias()  direct | Admin merge  | LOW |
| V5 | MIGRATION\_HybridAliasS ystem() | 21\_AliasService.g s:505+ | createGlobalAlias()  x4 steps | Menu / Migratio n | HIGH |

Root Cause: createGlobalAlias() at 21\_AliasService.gs:115 

sheet.appendRow(\[ 

aliasId, masterUuid, variantName, entityType, 

confidence || 100, source || 'MANUAL', now, true 

\]);  
This function is the root enabler for all 5 downstream violations. It uses slow appendRow() instead of batch setValues(), and its dedup relies on loadGlobalAliasesMap\_() which may be stale. Every function that needs to write to M\_ALIAS calls createGlobalAlias() individually, creating row-by-row writes in loops.  
BUG-05: Missing Time Guard 

Rule 5 (Resumable State) requires that every script processing more than 1,000 rows must implement a Time Guard mechanism: checking elapsed time every 100 rows, saving checkpoint progress to PropertiesService, and being able to resume from the last checkpoint. GAS has a hard 6-minute execution timeout \- scripts that exceed this are killed with no warning, wasting all processing done. 

Functions WITH Time Guard (Baseline) 

| Function  | File  | Mechanism |
| ----- | ----- | ----- |
| runMatchEngine  | 10\_MatchEngine.gs:85,124 | startTime, timeLimit, check every row,  installAutoResume\_() |
| runLookupEnrichment  | 17\_SearchService.gs:250,278  | startTime, timeLimit, check every row |
| MIGRATION\_HybridAliasSyste m | 21\_AliasService.gs:452,471 | startTime, timeLimit, check every 50 rows (Steps 2-3 only) |

9 Functions Missing Time Guard

| Priority  | Function  | File:Line  | Entry Point  | Risk |
| :---: | ----- | ----- | :---: | ----- |
| CRITICAL | populateAliasFromSCGRa wData\_() | 21\_AliasService.g s:599 | Yes (Menu) | O(n2) substring \+ appendRow per iteration. \>500 names \= timeout |
| CRITICAL | populateAliasFromFactDel ivery\_() | 21\_AliasService.g s:695 | Internal  (Migration) | appendRow per unique name.  MIGRATION check is BEFORE call, not inside |
| CRITICAL | generatePersonAliasesFr omHistory() | 19\_Hardening.gs: 188 | Yes (Menu) | 3 data loads \+ createGlobalAlias loop. 500 aliases \= timeout |
| HIGH | applyAllPendingDecisions () | 12\_ReviewService. gs:154 | Yes (Menu) | \~10 sheet I/O per review row. 30+ rows \= timeout |
| HIGH  | fetchDataFromSCGJWD() | 18\_ServiceSCG.gs: 66 | Yes (Menu) | API processing loops have no time check (heavy lookup delegates) |
| MEDIUM  | populateGeoMetadata() | 20\_ThGeoService. gs:102 | Yes (Menu) | SYS\_TH\_GEO 3000-10000+ rows, in-memory .map() \+ batch write |
| MEDIUM  | buildGeoDictionary() | 16\_GeoDictionary Builder.gs:75 | Yes (Menu) | Same SYS\_TH\_GEO data, read-heavy \+ cache writes |
| LOW | assignMasterUuidIfMissin g() | 21\_AliasService.g s:397 | Yes (Menu) | Lightweight UUID gen \+ 2 batch writes. Low timeout risk |
| LOW | autoEnrichAliasesFromFa ctBatch\_() | 10\_MatchEngine.g s:238 | Internal | Relies on caller time guard. Small batch size mitigates risk |

Critical Architecture Issue 

MIGRATION\_HybridAliasSystem() has Time Guards in Steps 2-3, but Steps 4-5 delegate to populateAliasFromSCGRawData\_() and populateAliasFromFactDelivery\_() which have NO internal Time Guard. The Migration checks time BEFORE calling these functions, but once called they run to completion with no checkpoint. If either function takes more than 2-3 minutes (easily possible with 500+ names), the entire script will timeout with no recovery.  
BUG-06: Row-by-Row Write Operations 

Rule 4 (Safe Batching) strictly forbids using getValue(), setValue(), setBackground(), or appendRow() inside loops. Each call is a separate Sheets API round-trip; in a loop of N iterations, this generates N API calls instead of 1 batch operation. With GAS 6-minute timeout, row-by-row writes in large loops guarantee timeout failure. 

3 Loop Violations 

V1: getValue() \+ setBackground() in for loop 

File: 03\_SetupSheets.gs:476-480 | Severity: HIGH 

for (let col \= 2; col \<= lastCol; col++) { 

const cell \= sheet.getRange(1, col); 

const val \= String(cell.getValue()).trim(); // getValue() IN LOOP 

if (val \=== 'Shipment\_No' || val \=== '') { 

cell.clearContent().setFontWeight('normal').setBackground(null); // setBackground() IN LOOP } 

} 

Impact: Up to 2N API calls where N \= number of columns. With lastCol=30, this generates up to 60  separate API calls instead of 2 batch calls. Fix: Batch-read all headers with  getRange(1,1,1,lastCol).getValues(), then use getRangeList() for clearing. 

V2: setValue() in for loop (cache hit update) 

File: 15\_GoogleMapsAPI.gs:286-287 | Severity: LOW 

sheet.getRange(i \+ 2, MC\_HIT \+ 1).setValue(Number(data\[i\]\[MC\_HIT\] || 0\) \+ 1); // setValue() IN LOOP return { ... }; // immediate return after 

Impact: Only 1 API call per function invocation (returns immediately after). Structurally violates Rule  4 but runtime impact is minimal. 

V3: setValue() x2 in mergePersonRecords loop 

File: 06\_PersonService.gs:395-397 | Severity: LOW 

sheet.getRange(targetRow, statCol \+ 1).setValue(APP\_CONST.STATUS\_MERGED); 

sheet.getRange(targetRow, noteCol \+ 1).setValue('Merged → ' \+ targetId); 

Impact: 2 API calls per merge (followed by break). Should be 1 batch setValues() call. Pattern: read  both columns, update, write once. 

4 Serial-Write Patterns (High Impact)

| \#  | File:Line  | Pattern | API Call  s | Should Be |
| :---: | ----- | ----- | :---: | ----- |
| SW  1 | 12\_ReviewService.gs:343-3 47 | 5 x setValue() per review decision  | 5 | 1 batch setValues () |

| SW  2 | 06\_PersonService.gs:341-3 45 | setValue \+ getValue \+ setValue stats pattern | 3  | 1-2 batch calls |
| :---: | ----- | :---- | :---: | :---- |
| SW  3 | 07\_PlaceService.gs:621-62 3 | Same 3-call stats pattern as SW2  | 3  | 1-2 batch calls |
| SW  4 | 08\_GeoService.gs:305-307 | Same 3-call stats pattern as  SW2/SW3 | 3  | 1-2 batch calls |

Note: 09\_DestinationService.gs already demonstrates the correct batch pattern (updateDestinationStats with setValues()). The same fix should be applied to the 3 sibling stats-update functions (SW2, SW3, SW4) for consistency.  
BUG-07: Entry Points Without Try-Catch 

Rule 12 (Error Handling per Entry Point) requires that every function called from the menu must have try-catch with logError including stack trace. Without error handling, exceptions propagate as raw GAS error popups with no logging, making debugging impossible and leaving admin with no record of failures in SYS\_LOG. 

5 Compliant Entry Points (Have try-catch) 

| Function  | File:Line  | Evidence |
| ----- | ----- | ----- |
| runFullPipeline  | 00\_App.gs:375  | try { safeRun(...) } finally { lock.releaseLock() } |
| runMatchEngine  | 10\_MatchEngine.gs:85  | try { ... } catch (rowErr) { logError(...) } |
| fetchDataFromSCGJWD  | 18\_ServiceSCG.gs:66  | try { ... } catch (err) { ... } |
| setupAllSheets  | 03\_SetupSheets.gs:64  | try { ... } catch (err) { logError(...) } |
| resetSourceSyncStatus  | 14\_Utils.gs:134  | try { ... } catch (err) { logError(...) } |

17 Non-Compliant Entry Points

| Priority  | Function  | File:Line  | Menu Label  | Risk |
| :---: | ----- | ----- | ----- | ----- |
| CRITICAL | MIGRATION\_HybridAlia sSystem | 21\_AliasService.g s:452 | Migration: Hybrid  Alias | Multi-step migration modifies 5+ sheets. Failure \=  inconsistent DB |
| CRITICAL  | clearAllSCGSheets\_UI | 18\_ServiceSCG.gs: 376 | Delete all data | Destructive deleteRows() with no try-catch. Partial delete  possible |
| HIGH | generatePersonAliases FromHistory | 19\_Hardening.gs: 188 | Create Alias from  FACT | Multiple reads \+ batch write. No error handling |
| HIGH | assignMasterUuidIfMis sing | 21\_AliasService.g s:397 | Verify Master UUID | Modifies M\_PERSON, M\_PLACE with no try-catch |
| HIGH | populateAliasFromSCG RawData\_ | 21\_AliasService.g s:599 | Import SCG names to M\_ALIAS | Reads 3 sheets, creates  aliases, no error handling |
| HIGH  | populateGeoMetadata | 20\_ThGeoService. gs:102 | Fill geo metadata  (16 cols) | Reads/writes entire  SYS\_TH\_GEO, no try-catch |
| HIGH  | buildGeoDictionary | 16\_GeoDictionary Builder.gs:75 | Update geo  database | Main body unprotected, only cache.put has inner try-catch |
| MEDIUM | applyAllPendingDecisio ns | 12\_ReviewService. gs:154 | Run all selected  commands | Inner per-row try-catch but outer body unprotected |
| MEDIUM  | runLoadSource | 04\_SourceReposit ory.gs:80 | Step 1: Load raw  data | throw new Error on missing  sheet \- raw GAS popup |

| MEDIUM  | buildFullQualityReport | 13\_ReportService. gs:74 | Data Quality Report | Multiple getRange/getValues \+ appendRow, no try-catch |
| :---: | ----- | :---- | ----- | :---- |
| MEDIUM | applyMasterCoordinate sToDailyJob | 18\_ServiceSCG.gs: 273 | Match coordinates today | Delegates to runLookupEnrichme nt() without wrapping |
| MEDIUM  | runPreflightAudit | 19\_Hardening.gs: 73 | Preflight Audit | Iterates all sheets, no error  handling |
| MEDIUM | detectDoubleProcessin g | 19\_Hardening.gs: 158 | Detect Duplicates | Reads FACT\_DELIVERY, no error handling |
| MEDIUM  | installSmartNavTrigger  | 00\_App.gs:198 | Install Smart  Navigation | Trigger operations can fail  (permissions, quota) |
| LOW | invalidateAllGlobalCach es | 01\_Config.gs:75  | Clear Cache | Trivial, but no catch on  invalidateXxxCache\_() |
| LOW  | openReviewQueue  | 00\_App.gs:492  | Open Review Queue  | Simple navigation, minimal risk |
| LOW  | diagnoseSystemState  | 00\_App.gs:639  | Diagnostic | Read-only diagnostic, minimal risk |

Recommended Fix Pattern 

function myEntryPoint() { 

try { 

// ... existing logic ... 

} catch (err) { 

logError('MyEntryPoint', err.message \+ '\\n' \+ err.stack); 

SpreadsheetApp.getUi().alert('Error: ' \+ err.message); 

} 

} 

Alternatively, wrap with the existing safeRun() utility from 00\_App.gs:360, which provides standardized error handling, logging, and lock management for all entry points.  
Summary: Priority Fix Order 

| Priorit  y | Bug  | Function(s)  | Impact  | Effort |
| :---: | ----- | ----- | ----- | :---: |
| P0 | BUG-04: Single Writer | createGlobalAlias() | 6 violations. Root cause  appendRow() bypass | Medium |
| P0 | BUG-05: Time  Guard | populateAliasFromSCGRawData\_, populateAliasFromFactDelivery\_, generatePersonAliasesFromHist ory | 7 menu entry points risk 6-min timeout | Medium |
| P1 | BUG-07: Try-Cat ch | MIGRATION\_HybridAliasSystem, clearAllSCGSheets\_UI, \+ 15 others | 2 destructive ops unprotected, 15 silent failures | Low |
| P1 | BUG-03: Hardc ode Index | 00\_App.gs, 10\_MatchEngine.gs, 18\_ServiceSCG.gs,  19\_Hardening.gs | 8 violations \+ 2 gaps. Silent wrong-data on column reorder | Low |
| P2 | BUG-06: Row-b y-Row | 03\_SetupSheets.gs,  12\_ReviewService.gs,  Person/Place/GeoService stats | 3 loop violations \+ 4 serial  patterns | Low |

Constraints 

1\. The existing SCG API Fetch code in 18\_ServiceSCG.gs must NOT be modified \- it is confirmed working correctly. 

2\. SHIP\_TO\_NAME (Index 10\) is the target column for cleansing/search operations, not SoldToName. 

3\. Group 1 (Cleansing & Master DB) prepares coordinates; Group 2 (Daily Ops & Search) consumes  coordinates. Never swap their roles.