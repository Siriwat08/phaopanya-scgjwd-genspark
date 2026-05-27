**LMDS Code Review** 

**15 Rules Compliance Report** 

Logistics Master Data System V5.4 

Google Apps Script \- 22 Files Analysis 

| Status  | Count  | Rules |
| :---- | :---- | :---- |
| PASS  | 5  | 6, 10, 11, 14, 15 |
| PARTIAL  | 4  | 1, 7, 8, 13 |
| FAIL  | 6  | 2, 3, 4, 5, 9, 12 |

Generated: 2026-05-26 | Reference: /gate kaa rian koed LMDS.md, /lip gaat rian koed.md  
 1: Clean Code (, ) 3  2: Single Responsibility (1  \= 1 ) 3  3: No Hardcode Index () 4  4: Batch Operations ( setValue ) 5  5: Checkpoint & Resume (Time Guard) 5  6: Document Dependencies ( dependencies) 6  7: No Fake Function Calls () 6  8: Namespace Collision () 7  9: No Global State () 7  10: Lock Library Version 8  11: Separate HTML Files 8  12: Error Handling (try-catch ) 8  13: Logging with Context (logError  stack trace) 9  14: Structured File Names (XX\_Component.gs) 10  15: Full Files Only () 10  15  10  
 1: Clean Code (, 

) 

: PARTIAL 

 1  30   camelCase  

 camelCase   

 50   pure transformation 

 50 : 

| File  | Function  | Lines  | Assessment |
| ----- | :---- | ----- | :---- |
| 10\_MatchEngine.gs  | autoEnrichAliasesFromFactBatch\_()  | 265  | Longest \- 3 sheets enrichment |
| 12\_ReviewService.gs  | applyReviewDecision()  | 203  | 4-case switch \+ CRUD |
| 18\_ServiceSCG.gs  | fetchDataFromSCGJWD()  | 158  | API fetch \+ flatten \+ aggregation |
| 00\_App.gs  | diagnoseSystemState()  | 139  | Multi-sheet diagnostic |
| 21\_AliasService.gs  | MIGRATION\_HybridAliasSystem()  | 135  | 5-step migration |
| 17\_SearchService.gs  | runLookupEnrichment()  | 126  | Batch loop \+ color coding |
| 10\_MatchEngine.gs  | executeDecision()  | 106  | 3-case decision \+ FACT write |
| 07\_PlaceService.gs  | getEnrichedGeoData()  | 107  | 4-level geo enrichment |
| 17\_SearchService.gs  | findBestGeoByPersonPlace()  | 118  | Multi-tier search |
| 10\_MatchEngine.gs  | makeMatchDecision()  | 100  | 8-rule decision engine |
| 00\_App.gs  | handleSelectionChange\_()  | 96  | Smart Navigation logic |
| 10\_MatchEngine.gs  | runMatchEngine()  | 92  | Main loop \+ time guard |
| 21\_AliasService.gs  | populateAliasFromSCGRawData\_()  | 86  | Loop \+ createGlobalAlias |

: normalizePersonNameFull() (\~65 ) \- pure transformation function  

 7  

:  100   helper functions  autoEnrichAliasesFromFactBatch\_  

 loadAliasData\_(), enrichPersonAliases\_(), enrichPlaceAliases\_() 

 2: Single Responsibility (1  \= 1 ) 

: FAIL  
 2   "" 

  100  1 

 2  

| File  | Function |  |
| ----- | :---- | :---- |
| 10\_MatchEngine.gs:2 38 | autoEnrichAliasesFromFactBatc h\_() |  persons \+ places \+ aliases \+ place aliases \+ enrich person aliases \+ enrich place aliases \+ batch write x3 |
| 12\_ReviewService.gs: 194 | applyReviewDecision() |  review row \+ lookup source \+ create person \+ create place \+ create geo \+ create destination \+ update review status |
| 18\_ServiceSCG.gs:66  | fetchDataFromSCGJWD() |  API \+ parse response \+ flatten data \+  aggregate shop \+ write sheet \+ build summary |
| 00\_App.gs:639  | diagnoseSystemState() |  5+ sheets \+  statistics \+  HTML \+   alert |

 3: No Hardcode Index 

() 

: FAIL 

 3   row\[7\], col \=== 11  constant object  

01\_Config.gs   3   gray area (single-column 

read  r\[0\] ) 

: 

| File:Line  | Code |  |
| :---- | :---- | :---- |
| 10\_MatchEngine.gs:2 05 | row\[1\] // index 1 \= issue\_type  | row\[REVIEW\_IDX.ISSUE\_TYPE\] |
| 00\_App.gs:752  | r\[3\] // SYS\_LOG level  | r\[SYS\_LOG\_IDX.LEVEL\] () |
| 00\_App.gs:757-758  | e\[2\], e\[4\] // module, message | e\[SYS\_LOG\_IDX.MODULE\],  e\[SYS\_LOG\_IDX.MESSAGE\] |

:  r\[0\]  single-column getRange()  statusData.filter(r \=\!r\[0\])  

  multi-column array  hardcode index 

:  SYS\_LOG\_IDX constant  01\_Config.gs  3   
 4: Batch Operations ( setValue 

) 

: FAIL 

 4  getValue()/setValue()/appendRow()   getValues()/setValues()  batch 

  5   appendRow()  createGlobalAlias() 

| File:Line  | Code  | Impact |
| :---- | :---- | :---- |
| 12\_ReviewService.gs: 343-347 | 5x setValue()  1 switch case x4 cases \= 17 API calls/review |  \-  decision  17 API calls   4 |
| 08\_GeoService.gs:30 5-307 | setValue(new Date()) \+ getValue() \+ setValue(curr+1) |  \- 3 API calls  1 |
| 07\_PlaceService.gs:6 21-623 | setValue(new Date()) \+ getValue() \+ setValue(curr+1) |  \-  |
| 06\_PersonService.gs: 341-345 | setValue(new Date()) \+ getValue() \+ setValue(curr+1) |  \-  |
| 06\_PersonService.gs: 395-398 | 2x setValue()  (STATUS \+  NOTE) |  \- 2 calls  1 |
| 21\_AliasService.gs:1 15 | appendRow()  createGlobalAlias() |  \-  calls  migration |

: (1) applyReviewDecision: batch setValues()  5  (2) updateStats  

functions:  setValues()  lastSeen \+ usageCount (3) createGlobalAlias:  batch  

mode  array  aliases  setValues()  

 5: Checkpoint & Resume (Time Guard) 

: FAIL 

 5  ( 1,000 )  Time Guard  Checkpoint/Resume logic 

 7  Time Guard

| Function  | File:Line  | Time Guard  | Checkpoint |
| ----- | :---- | :---- | :---- |
| runMatchEngine() | 10\_MatchEngine.gs:8 5 | YES  | YES |
| MIGRATION\_HybridAliasSystem() | 21\_AliasService.gs:4 52 | YES  | NO |
| runLookupEnrichment() | 17\_SearchService.gs: 250 | YES  | NO |

| populateAliasFromSCGRawData\_() | 21\_AliasService.gs:5 99 | NO  | NO |
| ----- | ----- | :---- | :---- |
| populateAliasFromFactDelivery\_() | 21\_AliasService.gs:6 95 | NO  | NO |
| autoEnrichAliasesFromFactBatch \_() | 10\_MatchEngine.gs:2 38 | NO  | NO |
| applyAllPendingDecisions() | 12\_ReviewService.gs: 154 | NO  | NO |
| buildGeoDictionary() | 16\_GeoDictionaryBuil der.gs:75 | NO  | NO |
| generatePersonAliasesFromHisto ry() | 19\_Hardening.gs:188  | NO  | NO |

 6: Document Dependencies 

( dependencies) 

: PASS 

 6  comment  dependencies  22  

DEPENDENCIES header comment   2  dependency 

 dependencies comment: 

\- 14\_Utils.gs:27 \-  CALLS: getGeminiApiKey()   callGeminiAPI()  PropertiesService   getGeminiApiKey() 

\- 19\_Hardening.gs:29 \-  loadAllFacts\_  

 7: No Fake Function Calls 

() 

: PARTIAL 

 7   phantom function calls 

 definition   dead functions () 5 

| Function  | File:Line |  |
| :---- | :---- | :---- |
| getGeminiApiKey()  | 01\_Config.gs:516  | Defined but never called |
| safeUiAlert\_Report\_()  | 13\_ReportService.gs:221  | Dead wrapper \- never called |
| fixMissingSyncStatus()  | 19\_Hardening.gs:129  | Not wired to menu |

| getRouteDistanceKm()  | 15\_GoogleMapsAPI.gs:238  | Never called |
| :---- | :---- | :---- |
| findNearbyGeos()  | 08\_GeoService.gs:371  | Never called |

 8: Namespace Collision 

() 

: PARTIAL 

 8   GAS  Global Scope 

 (142 top-level functions ) 

 wrapper/deprecated  

: 

\- safeAlert\_()  16\_GeoDictionaryBuilder.gs:469 \- wrapper  safeUiAlert\_()  14\_Utils.gs:434 \- 

\- safeUiAlert\_Report\_()  13\_ReportService.gs:221 \- dead wrapper  

\- haversineDistance()  08\_GeoService.gs:395 \- public alias  haversineDistanceM()  14\_Utils.gs:183 \-  

:  safeAlert\_() wrapper  safeUiAlert\_Report\_()   safeUiAlert\_()  

 9: No Global State 

() 

: FAIL 

 9  01\_Config.gs   global   

14 global declarations  4  01\_Config.gs  02\_Schema.gs

| File  | Declaration |  |
| ----- | :---- | ----- |
| 04\_SourceRepository. gs:65-70 | CACHE\_KEY\_SOURCE, CACHE\_KEY\_INVOICES, SRC\_READ\_COLS | Cache keys \+ column count (3) |
| 05\_NormalizeService. gs:70-141 | PERSON\_PREFIX\_LIST, SORTED\_PREFIX\_LIST, COMPANY\_SUFFIX\_LIST, CHAIN\_STORE\_LIST, DELIVERY\_NOTE\_LIST, PHONE\_PATTERN,  DOC\_NO\_PATTERN, REF\_NO\_PATTERN | Dictionary lists \+ regex (8) |
| 08\_GeoService.gs:63  | GEO\_GRID\_SIZE \= 0.01  | Grid size constant (1) |
| 15\_GoogleMapsAPI.g s:65-71 | MC\_KEY, MC\_LAT, MC\_LNG, MC\_ADDR, MC\_HIT, MC\_PROV, MC\_DIST | Column index aliases (7) |

: (1) CACHE\_KEY\_\*, GEO\_GRID\_SIZE, MC\_\*  01\_Config.gs (2) PREFIX\_LIST,  SUFFIX\_LIST   local constants  normalizePersonNameFull()  01\_Config.gs 

 10: Lock Library Version 

: PASS 

 10  Library   HEAD  HEAD version reference 

 HEAD version   import Library   

HEAD version 

 11: Separate HTML Files 

: PASS 

 11  HTML  .html  hardcode HTML  .gs  HTML tags  .gs 

 hardcode HTML   HTML   showVersionInfo()  

diagnoseSystemState()  

 12: Error Handling (try-catch ) 

: FAIL 

 12  try-catch  26   5 

 try-catch  (19% compliance rate) 

 try-catch (5/26): 

\- runFullPipeline (00\_App.gs) \-  safeRun() wrapper 

\- runMatchEngine (10\_MatchEngine.gs) \-  try-catch \+ finally 

\- fetchDataFromSCGJWD (18\_ServiceSCG.gs) \-  try-catch \+ finally 

\- setupAllSheets (03\_SetupSheets.gs) \-  try-catch 

\- resetSourceSyncStatus (14\_Utils.gs) \-  try-catch 

 try-catch (21/26): 

\- applyMasterCoordinatesToDailyJob (18\_ServiceSCG.gs:273) 

\- runLoadSource (04\_SourceRepository.gs:80) 

\- runNormalize (05\_NormalizeService.gs:152) 

\- openReviewQueue (00\_App.gs:492) 

\- applyAllPendingDecisions (12\_ReviewService.gs:154) 

\- buildFullQualityReport (13\_ReportService.gs:74)  
\- clearAllSCGSheets\_UI (18\_ServiceSCG.gs:376) 

\- setupEnvironment (00\_App.gs:564) 

\- buildGeoDictionary (16\_GeoDictionaryBuilder.gs:75) 

\- populateGeoMetadata (20\_ThGeoService.gs:102) 

\- generatePersonAliasesFromHistory (19\_Hardening.gs:188) 

\- MIGRATION\_HybridAliasSystem (21\_AliasService.gs:452) 

\- assignMasterUuidIfMissing (21\_AliasService.gs:397) 

\- populateAliasFromSCGRawData\_ (21\_AliasService.gs:599) 

\- runPreflightAudit (19\_Hardening.gs:73) 

\- detectDoubleProcessing (19\_Hardening.gs:158) 

\- checkSystemIntegrity (00\_App.gs:508) 

\- diagnoseSystemState (00\_App.gs:639) 

\- invalidateAllGlobalCaches (01\_Config.gs:75) 

\- showVersionInfo (00\_App.gs:592) 

\- installSmartNavTrigger (00\_App.gs:198) 

:  try-catch wrapper   helper function safeMenuCall\_(fnName,  

fn)  try-catch  

 13: Logging with Context (logError  stack trace) 

: PARTIAL 

 13  logError  context (, stack trace)  logError  module parameter 

  capture stack trace 

logError definition (03\_SetupSheets.gs:347): 

function logError(module, message) { 

 writeLog\_('ERROR', module, message); 

 console.error('\[ERROR\]\[' \+ module \+ '\] ' \+ message); 

} 

:  error.stack  new Error().stack  capture  SYS\_LOG 

:  logError  Error object  parameter  3  error.stack  column details   

SYS\_LOG  
 14: Structured File Names 

(XX\_Component.gs) 

: PASS 

 14  XX\_ComponentName.gs  22  

XX\_ComponentName.gs   00\_App.gs  21\_AliasService.gs 

 15: Full Files Only 

() 

: PASS 

 15  placeholder "...", "", ""   .gs   

placeholder   

 15 

|  |  |  |  |
| ----- | ----- | :---- | :---- |
| 1  | Clean Code  | PARTIAL  | 15 functions \> 50 lines |
| 2  | Single Responsibility  | FAIL  | 4+  |
| 3  | No Hardcode Index  | FAIL  | 3 violations \+  SYS\_LOG\_IDX |
| 4  | Batch Operations  | FAIL  | 5 sites \+ appendRow  |
| 5 | Checkpoint &   Resume | FAIL  | 7/10  Time Guard |
| 6 | Document Dependenc ies | PASS  | 2 doc errors  |
| 7 | No Fake Function  Calls | PARTIAL  | 5 dead functions |
| 8  | Namespace Collision  | PARTIAL  | 3 redundant wrappers |
| 9  | No Global State  | FAIL  | 14 globals in 4 files |
| 10  | Lock Library Version  | PASS  | No HEAD usage |
| 11  | Separate HTML  | PASS  | No hardcoded HTML |
| 12  | Error Handling  | FAIL  | 21/26 menu functions  try-catch |
| 13  | Logging with Context  | PARTIAL  | No stack trace in logError |

| 14 | Structured File  Names | PASS  | All 22 files follow pattern |
| :---: | :---- | :---- | :---- |
| 15  | Full Files Only  | PASS  | No placeholders found |

: 

1\.  12 (Error Handling) \- 21/26  try-catch \=  silent fail  Production 

2\.  5 (Checkpoint) \- 7  Time Guard \=  timeout  checkpoint 

3\.  4 (Batch Operations) \- appendRow  \+ setValue  \=  timeout 

4\.  3 (Hardcode Index) \- 3 violations \+  SYS\_LOG\_IDX 

5\.  9 (Global State) \- 14 global declarations  4  

6\.  13 (Logging) \- logError  stack trace 

7\.  1+2 (Clean Code \+ SRP) \-  