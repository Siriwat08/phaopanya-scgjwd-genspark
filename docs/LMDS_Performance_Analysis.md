**LMDS V5.4** 

**Performance Analysis Report** 

Logistics Master Data System 

Google Apps Script Performance Audit 

: 2026-05-26 

: 22  .gs 

: grep   
1\.  (Executive Summary) 

2\.  

3\.  Performance 

3.1 Loop  Spreadsheet API 

3.2 Migration  Time Guard 

3.3 N+1 Query / Nested Loop 

3.4 Cache Size Limits 

4\.  Time Guard Coverage 

5\.  

**1\.**  

 LMDS V5.4  22   grep  

()  Performance  14  : 

|   |   |  |
| ----- | ----- | :---- |
| CRITICAL  | 2  |  Timeout  —  |
| HIGH  | 6  |  Timeout  (\>500 ) —  |
| MEDIUM  | 6  |  Timeout —  |

:  —  updateStats (Person/Place/Geo)  

getValue() \+ setValue()  (3 API calls/update)  DestinationService  batch write  (FIX v5.4.002)  3   MatchEngine 

 updateStats  API calls  

: applyAllPendingDecisions()  MIGRATION\_HybridAliasSystem()  

Time Guard  (migration )  API calls  (setValue/appendRow  loop)  Timeout  

**2\.**  

 Performance  14   

 code snippet 

| \#  |   |   |   |  |
| :---: | ----- | :---- | ----- | :---- |
| 1  | setValue()  for loop — getFromSheetCache\_ 15\_GoogleMapsAPI.gs  |  | HIGH  | Timeout (N API calls/) |

| \#  |   |   |   |  |
| :---: | ----- | ----- | ----- | :---- |
| 2  | setValue() 5  |  review decision — applyReviewDecision 12\_ReviewService.gs  | HIGH  | Timeout (5x API calls) |
| 3  | updatePersonStats: getValue() \+ setValue() \= 3 API calls/ |  06\_PersonService.gs  | HIGH  | Quota exceed (3 calls/update) |
| 4  | updatePlaceStats: getValue() \+ setValue() \= 3 API calls/ |  07\_PlaceService.gs  | HIGH  | Quota exceed (3 calls/update) |
| 5  | updateGeoStats: getValue() \+ setValue() \= 3 API calls/ |  08\_GeoService.gs  | HIGH  | Quota exceed (3 calls/update) |
| 6  | appendRow()  Migration — createGlobalAlias  |  21\_AliasService.gs  | CRITICAL  | Timeout (N appendRow calls) |
| 7  | applyAllPendingDecisions:  |  Time Guard12\_ReviewService.gs  | CRITICAL  | Timeout ( Time Guard) |
| 8  | generatePersonAliasesFromHistory:  |  Time Guard \+ createGlobalAlias  loop 19\_Hardening.gs  | HIGH  | Timeout ( Time Guard) |
| 9  | populateAliasFromSCGRawData\_: nested loop substring matching O(N x M) 21\_AliasService.gs  |  | HIGH  | Timeout (nested loop) |
| 10  | populateAliasFromFactDelivery\_: createGlobalAlias  |  21\_AliasService.gs  | MEDIUM  | Quota exceed (N calls) |
| 11  | Cache Size: TH\_GEO\_POSTCODE chunk  |  100KB/value 16\_GeoDictionaryBuilder.gs | MEDIUM  | Cache miss (over 100KB) |
| 12  | findFactRowByInvoice\_: linear scan O(N)  |  11\_TransactionService.gs  | MEDIUM  |  (linear scan) |
| 13  | updateDestinationStats: getValue() 1  |  09\_DestinationService.gs  | MEDIUM  | 1 extra API call |
| 14  | resolveMasterUuidViaGlobalAlias: nested loop O(K x V) 21\_AliasService.gs  |  | MEDIUM  |  (nested loop) |
| 15  | onEdit Smart Navigation: 3 API calls  |  00\_App.gs  | MEDIUM  | API calls  |

**3\.  Performance** 

**3.1 Loop  Spreadsheet API** 

 4 (Safe Batching)  getValue()/setValue()/appendRow()   getValues()/setValues()  batch   updateStats  Person/Place/Geo  setValue()  (3 API calls/update)  DestinationService 

 batch write   ( applyReviewDecision)  setValue() 5  

**Performance Issue \#1** HIGH 

**setValue()  for loop — getFromSheetCache\_** 

: 15\_GoogleMapsAPI.gs:282-287 

:  getFromSheetCache\_()  for loop  key  MAPS\_CACHE sheet  setValue()  hit\_count  cache hit  \= 1 Spreadsheet API call 

: Timeout / Quota exceed 

:  updates  array  setValues()  batch  loop  RAM cache (Map/Object)  sheet-based cache 

: 

15\_GoogleMapsAPI.gs:282-287 

for (let i \= 0; i \< data.length; i++) { 

if (String(data\[i\]\[MC\_KEY\]).trim() \!== cacheKey) continue; 

sheet.getRange(i \+ 2, MC\_HIT \+ 1\)  
.setValue(Number(data\[i\]\[MC\_HIT\] || 0\) \+ 1); // API call  

return { ... }; 

} 

**Performance Issue \#2** HIGH 

**setValue() 5  review decision — applyReviewDecision** : 12\_ReviewService.gs:343-347, 365-368, 374-377, 383-386 

:  applyReviewDecision()  setValue() 5  (STATUS, REVIEWER, REVIEWED\_AT, DECISION, NOTE)  decision   applyAllPendingDecisions()  N  \= 5N API calls 

: Timeout (5N API calls) 

:  5 setValue()  setValues()  batch   array \[\[status, reviewer, reviewedAt, decision, note\]\]  sheet.getRange(row, col, 1, 5).setValues(\[\[...\]\]) 

: 

12\_ReviewService.gs:343-347 

sheet.getRange(targetRow, REVIEW\_IDX.STATUS \+ 1).setValue('Done'); 

sheet.getRange(targetRow, REVIEW\_IDX.REVIEWER \+ 1).setValue(reviewer); 

sheet.getRange(targetRow, REVIEW\_IDX.REVIEWED\_AT \+ 1).setValue(now); 

sheet.getRange(targetRow, REVIEW\_IDX.DECISION \+ 1).setValue(decisionVal); 

sheet.getRange(targetRow, REVIEW\_IDX.NOTE \+ 1).setValue('Resolved (Created New)'); 

**Performance Issue \#3** HIGH 

**updatePersonStats: getValue() \+ setValue() \= 3 API calls/** : 06\_PersonService.gs:341-345 

: updatePersonStats()  setValue() 1  (last\_seen) \+ getValue() 1  (usage\_count) \+ setValue() 1  (usage\_count+1) \= 3 API calls  1 person  MatchEngine  match  

: Quota exceed (3N calls) 

:  batch write  DestinationService (FIX v5.4.002)  3   array  setValues() —  3 calls  2 calls (1 read \+ 1 write) 

: 

06\_PersonService.gs:341-345 

sheet.getRange(targetRow, lastSeenCol).setValue(new Date()); // API call \#1 

const currCount \= Number( 

sheet.getRange(targetRow, usageCountCol).getValue() // API call \#2 

) || 0; 

sheet.getRange(targetRow, usageCountCol).setValue(currCount \+ 1); // API call \#3  
**Performance Issue \#4** HIGH 

**updatePlaceStats: getValue() \+ setValue() \= 3 API calls/** : 07\_PlaceService.gs:621-623 

:  PersonStats —  setValue() \+ getValue() \+ setValue() \= 3 API calls  1 place  MatchEngine  match  

: Quota exceed (3 calls/update) 

:  batch write  DestinationService —  last\_seen \+ usage\_count   array  

: 

07\_PlaceService.gs:621-623 

sheet.getRange(targetRow, lastSeenCol).setValue(new Date()); // API call \#1 

const curr \= Number(sheet.getRange(targetRow, usageCountCol).getValue()) || 0; // API call \#2 sheet.getRange(targetRow, usageCountCol).setValue(curr \+ 1); // API call \#3 

**Performance Issue \#5** HIGH 

**updateGeoStats: getValue() \+ setValue() \= 3 API calls/** 

: 08\_GeoService.gs:305-307 

:  PersonStats/PlaceStats —  setValue() \+ getValue() \+ setValue() \= 3 API calls  1 geo point  API calls  MatchEngine  

: Quota exceed (3 calls/update) 

:  batch write  DestinationService —  last\_seen \+ usage\_count   array  

: 

08\_GeoService.gs:305-307 

sheet.getRange(targetRow, lastSeenCol).setValue(new Date()); // API call \#1 

const curr \= Number(sheet.getRange(targetRow, usageCountCol).getValue()) || 0; // API call \#2 sheet.getRange(targetRow, usageCountCol).setValue(curr \+ 1); // API call \#3 

**Performance Issue \#6** CRITICAL 

**appendRow()  Migration — createGlobalAlias**  : 21\_AliasService.gs:115 

: MIGRATION\_HybridAliasSystem  createGlobalAlias()  alias  appendRow()   alias \= 1 API call  500+ aliases  500+ API calls  (Step 2-5) 

: Timeout (500+ rows) 

:  aliases  array  sheet.getRange(lastRow+1, 1, aliases.length, cols).setValues(aliases)  batch   N API calls  1 API call  
: 

21\_AliasService.gs:115 

sheet.appendRow(\[ // API call  alias\! 

aliasId, masterUuid, variantName, entityType, 

confidence || 100, source || 'MANUAL', now, true 

\]); 

**Performance Issue \#10** MEDIUM 

**populateAliasFromFactDelivery\_: createGlobalAlias**  : 21\_AliasService.gs:718-739 

:  populateAliasFromFactDelivery\_()  createGlobalAlias()  for-in loop  appendRow()   200+  \= 200+ API calls 

: Quota exceed 

:  aliases  array  setValues()  batch  

: 

21\_AliasService.gs:725 

var result \= createGlobalAlias(masterUuid, info.rawName, 'PERSON', 95, 'FACT\_DELIVERY\_IMPORT'); // appendRow()  

**Performance Issue \#13** MEDIUM 

**updateDestinationStats: getValue() 1**  : 09\_DestinationService.gs:190 

:  FIX v5.4.002  batch write   getValue() 1  190  usage\_count   batch  1 API call  batch read/write 

: 1 API call  

:  usage\_count  rowData  getValues()  ( 198\)  getValue()   3 API calls  2 API calls (1 read \+ 1 write) 

: 

09\_DestinationService.gs:190 

const currUsageCount \= Number(sheet.getRange(targetRow, usageCountCol).getValue()) || 0; 

//  rowData ( 198\)  

**3.2 Migration / Long-Running  Time Guard** 

 5 (Resumable State)  ( 1,000 )  Checkpoint  Time Guard  100   Time Guard   Timeout  

**Performance Issue \#7** CRITICAL  
**applyAllPendingDecisions:  Time Guard** 

: 12\_ReviewService.gs:163 

:  applyAllPendingDecisions()  loop  Q\_REVIEW  Time Guard  applyReviewDecision()  setValue() 5   200+  review \= 1,000+ API calls  6  

: Timeout (6 min GAS limit) 

:  Time Guard  10  ( 5 API calls)  Auto-Resume trigger  runMatchEngine()  timeout 

: 

12\_ReviewService.gs:163 

for (let i \= 0; i \< data.length; i++) { 

//  Time Guard\! 

const status \= String(data\[i\]\[REVIEW\_IDX.STATUS\] || '').trim(); 

const decision \= String(data\[i\]\[REVIEW\_IDX.DECISION\] || '').trim(); 

// ... applyReviewDecision() → 5 setValue() calls ... 

processed++; 

} 

**Performance Issue \#8** HIGH 

**generatePersonAliasesFromHistory:  Time Guard \+ createGlobalAlias  loop** 

: 19\_Hardening.gs:237, 284-290 

:  generatePersonAliasesFromHistory()  factData.forEach()  Time Guard  createGlobalAlias()  loop ( appendRow )  FACT\_DELIVERY  1,000+   6  

: Timeout (6 min GAS limit) 

:  Time Guard  forEach  globalAliasCalls  batch write  M\_ALIAS  setValues()  createGlobalAlias()  

: 

19\_Hardening.gs:284-290 

globalAliasCalls.forEach(call \=\> { 

const result \= createGlobalAlias( // appendRow() \! 

call.masterUuid, call.variantName, call.entityType, 

call.confidence, call.source 

); 

if (result) globalAliasCount++; 

}); 

**3.3 N+1 Query / Nested Loop** 

 N+1 Query  Nested Loop   linear scan  substring matching  nested loop  O(N)  
 O(N\*M)   Map/Reverse Index  O(1)  O(log N) **Performance Issue \#9** HIGH 

**populateAliasFromSCGRawData\_: nested loop substring matching O(N x M)** : 21\_AliasService.gs:659-675 

:  populateAliasFromSCGRawData\_()  nested loop  substring matching:  normKey  nameCount  key  personNormMap/placeNormMap  500  x 1,000 entries \= 500,000 iterations  createGlobalAlias()  

: Timeout (O(N\*M) loop) 

:  reverse index (Map)  loadGlobalAliasReverseIndex\_()  lookup  O(1)  O(K)  O(N\*M)  aliases  batch write 

: 

21\_AliasService.gs:659-668 

if (\!matchedUuid) { 

for (var pNorm in personNormMap) { // O(N) loop 

if (pNorm.length \>= 4 && (normKey.includes(pNorm) || pNorm.includes(normKey))) { 

matchedUuid \= personNormMap\[pNorm\]; 

matchedType \= 'PERSON'; 

break; 

} 

} 

} 

**Performance Issue \#12** MEDIUM 

**findFactRowByInvoice\_: linear scan O(N)**  

: 11\_TransactionService.gs:200-204 

: findFactRowByInvoice\_()  for loop  invoice  linear scan   normalizeInvoiceNo()  iteration  FACT\_DELIVERY  10,000+   1 invoice \= 10,000 iterations \+ 10,000 function calls 

:  (O(N) per lookup) 

:  Map lookup : const invoiceMap \= new Map(); data.forEach((r, i) \=\> invoiceMap.set(normalizeInvoiceNo(r\[0\]), i+2));  invoiceMap.get(targetInvoice)  O(1) 

: 

11\_TransactionService.gs:200-204 

for (let i \= 0; i \< data.length; i++) { 

if (normalizeInvoiceNo(data\[i\]\[0\]) \=== targetInvoice) { 

return i \+ 2; // linear scan — O(N) 

} 

}  
**Performance Issue \#14** MEDIUM 

**resolveMasterUuidViaGlobalAlias: nested loop O(K x V)** 

: 21\_AliasService.gs:238-260 

: resolveMasterUuidViaGlobalAlias()  nested for-in loop  aliasesMap ( key  variants)  substring match  M\_ALIAS  500+ entries  entry  variants \=  iterations  1 lookup 

:  (O(K\*V) per lookup) 

:  loadGlobalAliasReverseIndex\_()  (O(1) lookup)  reverse index   fallback  substring matching  O(1) lookup  

: 

21\_AliasService.gs:238-259 

for (var dictKey in aliasesMap) { // O(K) 

if (\!dictKey.startsWith(entityType \+ '\_')) continue; 

var variants \= aliasesMap\[dictKey\]; 

for (var i \= 0; i \< variants.length; i++) { // O(V) 

var v \= variants\[i\]; 

// substring matching ... 

} 

} 

**3.4 Cache Size Limits** 

CacheService  GAS  100KB  1 value  1,000 keys   chunk size  JSON  100KB  cache.put() fail   sheet  cache 

**Performance Issue \#11** MEDIUM 

**Cache Size: TH\_GEO\_POSTCODE chunk  100KB/value** : 16\_GeoDictionaryBuilder.gs:370-384 

: savePostcodeMapToCache\_()  chunk  350 keys  CacheService limit \= 100KB/value  key  (province \+ district \+ subDistrict \+ searchKey \+ postalKey \+ noteType) JSON  100KB  cache.put() fail  (try-catch  error) 

: Cache miss  

:  JSON.stringify(chunkObj).length  cache.put()  90KB  chunk size  ( 200 keys)  cache key  

: 

16\_GeoDictionaryBuilder.gs:370-380 

const chunkSize \= 350; 

// ... 

chunkKeys.forEach(k \=\> { chunkObj\[k\] \= postcodeMap\[k\]; }); 

try {  
cache.put('TH\_GEO\_POSTCODE\_' \+ i, JSON.stringify(chunkObj), AI\_CONFIG.CACHE\_TTL\_SEC); 

//  JSON.stringify  100KB → fail  

} catch(e) { 

logWarn('GeoDictBuilder', \`Cache POSTCODE\_${i} : ${e.message}\`); 

} 

**4\.  Time Guard Coverage** 

 Time Guard   grep  

|   |   | Time Guard  | Checkpoint  | Auto-Resume |
| ----- | ----- | ----- | ----- | ----- |
| runMatchEngine()  | 10\_MatchEngine.gs:124  |  ()  |  (SYNC\_STATUS  | )  installAutoResume\_ |
| runLookupEnrichment()  | 17\_SearchService.gs:278  |  ()  |   |  |
| MIGRATION\_HybridAliasSystem()  | 21\_AliasService.gs:491,519 |  ( 50 )  |   |  |
| applyAllPendingDecisions()  | 12\_ReviewService.gs:163  |   |   |  |
| generatePersonAliasesFromHistory()  | 19\_Hardening.gs:237  |   |   |  |
| autoEnrichAliasesFromFactBatch\_()  | 21\_AliasService.gs  |   |   |  |
| populateAliasFromSCGRawData\_()  | 21\_AliasService.gs:611  |   |   |  |
| populateAliasFromFactDelivery\_()  | 21\_AliasService.gs:704  |   |   |  |

 

:  8   3  Time Guard   1  (runMatchEngine)  Auto-Resume trigger  5   Time Guard  Checkpoint  Timeout  

**5\.**  

**5.1 Priority 1 —  (CRITICAL)** 

 CRITICAL  2   loop  Timeout  

 

|  |    |  |
| ----- | ----- | :---- |
| 1  | applyAllPendingDecisions:  Time Guard \+ 5x setValue()  |  Time Guard \+ batch setValues() |
| 2  | Migration: appendRow()  alias  |  aliases \+ batch setValues() |

**5.2 Priority 2 —  (HIGH)** 

 HIGH  6   (updateStats  3 API calls)  pattern  DestinationService   helper function updateStatsBatch\_() 

 3 

|  |    |  |
| ----- | :---- | :---- |
| 3  | updatePersonStats: 3 API calls/update  | batch write  DestinationService |
| 4  | updatePlaceStats: 3 API calls/update  | batch write  DestinationService |
| 5  | updateGeoStats: 3 API calls/update  | batch write  DestinationService |
| 6  | getFromSheetCache\_: setValue() in loop  |  updates \+ batch setValues() |
| 7  | applyReviewDecision: 5x setValue()  | batch setValues() 5  |
| 8  | generatePersonAliasesFromHistory:  Time Guard  |  Time Guard \+ batch write |

**5.3 Priority 3 —  (MEDIUM)** 

 MEDIUM  6   linear scan  Map/Reverse Index  cache size    Timeout

|  |    |  |
| ----- | ----- | :---- |
| 9  | populateAliasFromSCGRawData: nested loop O(N\*M)  |  reverse index O(1) |
| 10  | populateAliasFromFactDelivery: appendRow   | batch setValues() |
| 11  | Cache: chunk 350 keys  100KB  |  size  put \+  chunk |
| 12  | findFactRowByInvoice: linear scan O(N)  |  Map lookup O(1) |
| 13  | resolveMasterUuidViaGlobalAlias: nested loop  |  reverse index  fallback |
| 14  | onEdit Smart Navigation: 3 API calls/  | cache targetIds \+ factIds |

