/**
 * VERSION: 5.4.001
 * FILE: 21_AliasService.gs
 * LMDS V5.4 — Hybrid Alias Architecture (Global M_ALIAS + Entity-Specific Views)
 * ===================================================
 * PURPOSE:
 *   จัดการตารางกลาง M_ALIAS — เชื่อมโยงชื่อสกปรก/ย่อ/ผิด → master_uuid → พิกัด
 *   เป็น Single Source of Truth สำหรับ Alias Resolution ที่ Group 2 ใช้ค้นหา
 *   ⚠️ Auto Pipeline ไม่เขียน M_ALIAS ที่นี่ — เขียนที่ autoEnrichAliasesFromFactBatch_() เท่านั้น
 * ===================================================
 * CHANGELOG:
 *   v5.4.001 (2026-05-24) — Single Writer Pattern:
 *     - [REMOVE] syncAliasToEntityTable_(): ลบฟังก์ชัน sync ย้อน เพราะทำให้เกิด circular dependency
 *     - [REMOVE] createGlobalAlias(): ลบ syncAliasToEntityTable_() call — เขียนแค่ M_ALIAS
 *     - [UPDATE] createGlobalAlias(): ใช้สำหรับ Migration/Admin เท่านั้น (ไม่ใช่ auto pipeline)
 *   v5.4.000 (2026-05-23):
 *     - [ADD] Hybrid Alias Architecture: M_ALIAS ตารางกลาง + entity-specific cached views
 *     - [ADD] assignMasterUuidIfMissing(): ตรวจสอบและเพิ่ม master_uuid ให้ทุกแถวใน M_PERSON/M_PLACE
 *     - [ADD] MIGRATION_HybridAliasSystem(): ย้ายข้อมูลจาก M_PERSON_ALIAS/M_PLACE_ALIAS → M_ALIAS
 *     - [ADD] populateAliasFromSCGRawData_(): ดึงชื่อปลายทางจากชีต SCG ดิบ → M_ALIAS
 *     - [ADD] fastLookupByShipToName(): ค้นหาพิกัดจาก ShipToName เท่านั้น (Fast Track สำหรับ Daily Job)
 *     - [ADD] loadGlobalAliasesMap_() / loadGlobalAliasReverseIndex_(): Cached loaders
 *     - [ADD] resolveMasterUuidViaGlobalAlias(): Variant → masterUuid lookup
 *     - [ADD] UUID ↔ Entity ID converters (convertUuidToPersonId, etc.)
 * ===================================================
 * DEPENDENCIES:
 *   REQUIRES (Load Order):
 *     - 01_Config.gs          (SHEET.M_ALIAS, ALIAS_IDX.*, AI_CONFIG)
 *     - 02_Schema.gs          (SCHEMA[SHEET.M_ALIAS], SCHEMA[SHEET.M_PERSON], SCHEMA[SHEET.M_PLACE])
 *     - 03_SetupSheets.gs     (logInfo, logWarn, logError, logDebug)
 *     - 05_NormalizeService.gs (normalizeForCompare)
 *     - 14_Utils.gs           (generateShortId)
 *   CALLS (Invokes):
 *     - loadAllPersons_()                 → 06_PersonService.gs (UUID converters)
 *     - loadAllPlaces_()                  → 07_PlaceService.gs (UUID converters)
 *     - getDestsByPersonId()              → 09_DestinationService.gs (fastLookupByShipToName)
 *     - getDestsByPlaceId()               → 09_DestinationService.gs (fastLookupByShipToName)
 *   EXPORTS TO:
 *     - 06_PersonService.gs   (resolveMasterUuidViaGlobalAlias, convertUuidToPersonId)
 *     - 07_PlaceService.gs    (resolveMasterUuidViaGlobalAlias, convertUuidToPlaceId)
 *     - 10_MatchEngine.gs     (convertPersonIdToUuid — in legacy Migration code)
 *     - 17_SearchService.gs   (fastLookupByShipToName — Group 2 Fast Track)
 *   SHEETS ACCESSED:
 *     - SHEET.M_ALIAS         (Read+Write: Global alias table — ⚠️ Single Writer = autoEnrich)
 *     - SHEET.M_PERSON        (Read: UUID ↔ personId conversion)
 *     - SHEET.M_PLACE         (Read: UUID ↔ placeId conversion)
 *     - SHEET.M_PERSON_ALIAS  (Read: Migration source, dedup check)
 *     - SHEET.M_PLACE_ALIAS   (Read: Migration source, dedup check)
 *     - SHEET.SOURCE          (Read: SCG Raw data → populateAliasFromSCGRawData_)
 *     - SHEET.FACT_DELIVERY   (Read: populateAliasFromFactDelivery_)
 * ===================================================
 * ARCHITECTURE:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  21_AliasService.gs (Hybrid Alias — Read Path + Migration)  │
 *   │  │                                                          │
 *   │  │  ⚠️ WRITE PATH: autoEnrichAliasesFromFactBatch_() ONLY   │
 *   │  │     (this file does NOT auto-write M_ALIAS in pipeline)  │
 *   │  │                                                          │
 *   │  ├── [Read Path — Group 2 Fast Track]                      │
 *   │  │   ├── fastLookupByShipToName()                           │
 *   │  │   │   └── M_ALIAS → masterUuid → entityId → dest → lat,lng│
 *   │  │   ├── loadGlobalAliasReverseIndex_() (variant → masterUuid)│
 *   │  │   └── resolveMasterUuidViaGlobalAlias() (Person/Place)   │
 *   │  │                                                          │
 *   │  ├── [Read Path — Group 1 Candidate Search]                │
 *   │  │   └── loadGlobalAliasesMap_() (uuid → variants[])        │
 *   │  │                                                          │
 *   │  ├── [Write Path — Migration/Admin ONLY]                   │
 *   │  │   ├── createGlobalAlias() — Append to M_ALIAS (no sync) │
 *   │  │   ├── MIGRATION_HybridAliasSystem() — 5-step migration  │
 *   │  │   ├── populateAliasFromSCGRawData_()                    │
 *   │  │   └── populateAliasFromFactDelivery_()                  │
 *   │  │                                                          │
 *   │  └── [Utilities]                                           │
 *   │      ├── UUID ↔ Entity ID converters (4 functions)         │
 *   │      ├── assignMasterUuidIfMissing()                       │
 *   │      └── generateUUID()                                    │
 *   └─────────────────────────────────────────────────────────────┘
 * ===================================================
 */

// ============================================================
// SECTION 1: createGlobalAlias — สร้าง Alias ในตารางกลาง M_ALIAS
// ============================================================

/**
 * createGlobalAlias — สร้าง Alias ใน M_ALIAS (สำหรับ Migration/Admin เท่านั้น)
 * ⚠️ Auto Pipeline ใช้ autoEnrichAliasesFromFactBatch_() แทน — ไม่เรียกฟังก์ชันนี้
 * @param {string} masterUuid - UUID v4 ของ master entity
 * @param {string} variantName - ชื่อที่เขียนผิด/ย่อ/สกปรก
 * @param {string} entityType - 'PERSON' หรือ 'PLACE'
 * @param {number} confidence - 0-100
 * @param {string} source - 'AI'/'HUMAN'/'AUTO'/'MERGE'/'MIGRATION'/'SCG_RAW'
 * @return {string|null} aliasId หรือ null ถ้าซ้ำ
 */
function createGlobalAlias(masterUuid, variantName, entityType, confidence, source) {
  const createdIds = createGlobalAliasesBatch_([{
    masterUuid: masterUuid,
    variantName: variantName,
    entityType: entityType,
    confidence: confidence,
    source: source
  }]);
  return createdIds.length > 0 ? createdIds[0] : null;
}

/**
 * createGlobalAliasesBatch_ — สร้าง M_ALIAS แบบ batch สำหรับ Migration/Admin เท่านั้น
 * ลด appendRow/setValue ในลูป และล้าง cache เพียงครั้งเดียวต่อ batch
 * @param {Object[]} requests [{masterUuid, variantName, entityType, confidence, source}]
 * @return {string[]} aliasIds ที่สร้างสำเร็จ
 */
function createGlobalAliasesBatch_(requests) {
  if (!requests || requests.length === 0) return [];

  const existingMap = loadGlobalAliasesMap_();
  const pendingKeys = {};
  const rows = [];
  const aliasIds = [];
  const now = new Date();

  requests.forEach(function(req) {
    if (!req || !req.masterUuid || !req.variantName || !req.entityType) return;

    const cleanVariant = normalizeForCompare(req.variantName);
    if (!cleanVariant || cleanVariant.length < 2) return;

    const normalizedType = String(req.entityType).toUpperCase();
    const uidKey = normalizedType + '_' + req.masterUuid;
    if (existingMap[uidKey] && existingMap[uidKey].includes(cleanVariant)) return;

    const dedupKey = uidKey + '|' + cleanVariant;
    if (pendingKeys[dedupKey]) return;
    pendingKeys[dedupKey] = true;

    const aliasId = generateShortId('A');
    rows.push(buildGlobalAliasRow_(
      aliasId,
      req.masterUuid,
      req.variantName,
      normalizedType,
      req.confidence,
      req.source,
      now
    ));
    aliasIds.push(aliasId);
  });

  appendGlobalAliasRows_(rows);
  if (rows.length > 0) {
    CacheService.getScriptCache().remove('M_GLOBAL_ALIAS_ALL');
    CacheService.getScriptCache().remove('M_GLOBAL_ALIAS_REVERSE');
    logDebug('AliasService', 'createGlobalAliasesBatch_: wrote ' + rows.length + ' aliases');
  }
  return aliasIds;
}

function buildGlobalAliasRow_(aliasId, masterUuid, variantName, entityType, confidence, source, createdAt) {
  const row = [];
  row[ALIAS_IDX.ALIAS_ID]     = aliasId;
  row[ALIAS_IDX.MASTER_UUID]  = masterUuid;
  row[ALIAS_IDX.VARIANT_NAME] = variantName;
  row[ALIAS_IDX.ENTITY_TYPE]  = entityType;
  row[ALIAS_IDX.CONFIDENCE]   = confidence == null ? 100 : confidence;
  row[ALIAS_IDX.SOURCE]       = source || 'MANUAL';
  row[ALIAS_IDX.CREATED_AT]   = createdAt || new Date();
  row[ALIAS_IDX.ACTIVE_FLAG]  = true;
  return row;
}

function appendGlobalAliasRows_(rows) {
  if (!rows || rows.length === 0) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET.M_ALIAS);
  if (!sheet) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, SCHEMA[SHEET.M_ALIAS].length)
       .setValues(rows);
}

function ensureAliasMigrationTime_(startTime, stepName) {
  const safetyMs = 30000;
  const timeLimitMs = Math.max(60000, (AI_CONFIG.TIME_LIMIT_MS || 300000) - safetyMs);
  if (new Date() - startTime > timeLimitMs) {
    throw new Error('Time Guard: หยุดที่ ' + stepName + ' เพื่อป้องกัน GAS timeout — กรุณารันใหม่ต่อภายหลัง');
  }
}


// ============================================================
// SECTION 2: loadGlobalAliasesMap_ — โหลดข้อมูล M_ALIAS ทั้งหมดเข้า RAM
// ============================================================

/**
 * loadGlobalAliasesMap_ — โหลด M_ALIAS เป็น Map: { "PERSON_uuid": ["variant1","variant2"] }
 * ใช้ CacheService เพื่อลดการอ่านชีต
 * @return {Object} aliasMap
 */
function loadGlobalAliasesMap_() {
  const cacheKey = 'M_GLOBAL_ALIAS_ALL';
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET.M_ALIAS);
  const resultObj = {};

  if (!sheet || sheet.getLastRow() < 2) return resultObj;

  const schemaLen = SCHEMA[SHEET.M_ALIAS].length;
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, schemaLen).getValues();
  data.forEach(function(row) {
    if (row[ALIAS_IDX.ACTIVE_FLAG] !== true) return;
    var masterId = String(row[ALIAS_IDX.MASTER_UUID] || '');
    var eType = String(row[ALIAS_IDX.ENTITY_TYPE] || '');
    var cleanName = normalizeForCompare(row[ALIAS_IDX.VARIANT_NAME]);
    if (!masterId || !eType || !cleanName) return;

    var dictKey = eType + '_' + masterId;
    if (!resultObj[dictKey]) resultObj[dictKey] = [];
    resultObj[dictKey].push(cleanName);
  });

  try { cache.put(cacheKey, JSON.stringify(resultObj), AI_CONFIG.CACHE_TTL_SEC); } catch (e) {}
  return resultObj;
}

// ============================================================
// SECTION 3: loadGlobalAliasReverseIndex_ — ค้นหา variant → masterUuid
// ============================================================

/**
 * loadGlobalAliasReverseIndex_ — สร้าง reverse index: { "normalized_variant": [{masterUuid, entityType}] }
 * ใช้สำหรับค้นหาจาก ShipToName เท่านั้น (Fast Track)
 * @return {Object} reverseIndex
 */
function loadGlobalAliasReverseIndex_() {
  const cacheKey = 'M_GLOBAL_ALIAS_REVERSE';
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET.M_ALIAS);
  const reverseIndex = {};

  if (!sheet || sheet.getLastRow() < 2) return reverseIndex;

  const schemaLen = SCHEMA[SHEET.M_ALIAS].length;
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, schemaLen).getValues();
  data.forEach(function(row) {
    if (row[ALIAS_IDX.ACTIVE_FLAG] !== true) return;
    var masterUuid = String(row[ALIAS_IDX.MASTER_UUID] || '');
    var eType = String(row[ALIAS_IDX.ENTITY_TYPE] || '');
    var cleanName = normalizeForCompare(row[ALIAS_IDX.VARIANT_NAME]);
    if (!masterUuid || !eType || !cleanName) return;

    if (!reverseIndex[cleanName]) reverseIndex[cleanName] = [];
    reverseIndex[cleanName].push({ masterUuid: masterUuid, entityType: eType });
  });

  try { cache.put(cacheKey, JSON.stringify(reverseIndex), AI_CONFIG.CACHE_TTL_SEC); } catch (e) {}
  return reverseIndex;
}

// ============================================================
// SECTION 4: resolveMasterUuidViaGlobalAlias — ค้นหาจาก variant name
// ============================================================

/**
 * resolveMasterUuidViaGlobalAlias — ค้นหา masterUuid จาก variant name
 * ใช้โดย findPersonCandidates() และ findPlaceCandidates()
 * @param {string} queryName - ชื่อที่ต้องการค้นหา
 * @param {string} entityType - 'PERSON' หรือ 'PLACE'
 * @return {Object|null} { masterUuid, score } หรือ null
 */
function resolveMasterUuidViaGlobalAlias(queryName, entityType) {
  var cleanQ = normalizeForCompare(queryName);
  if (!cleanQ || cleanQ.length < 2) return { masterUuid: null, score: 0 };

  var aliasesMap = loadGlobalAliasesMap_();
  var bestMatch = null;
  var bestScore = 0;

  for (var dictKey in aliasesMap) {
    if (!dictKey.startsWith(entityType + '_')) continue;
    var variants = aliasesMap[dictKey];

    for (var i = 0; i < variants.length; i++) {
      var v = variants[i];
      var score = 0;

      if (v === cleanQ) {
        score = 100; // Exact match
      } else if (v.length >= 4 && cleanQ.includes(v)) {
        score = 95; // Substring match
      } else if (cleanQ.length >= 4 && v.includes(cleanQ)) {
        score = 90; // Reverse substring match
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = dictKey.replace(entityType + '_', '');
      }
    }
    if (bestScore === 100) break; // พบ exact match แล้ว ไม่ต้องหาต่อ
  }

  return { masterUuid: bestMatch, score: bestScore };
}

// ============================================================
// SECTION 5: fastLookupByShipToName — Fast Track สำหรับ Daily Job
// ============================================================

/**
 * fastLookupByShipToName — ค้นหาพิกัดจาก ShipToName เท่านั้น (Fast Track)
 * ใช้สำหรับชีตตารางงานประจำวัน ที่ค้นหาด้วย ShipToName → M_ALIAS → masterUuid → destination → lat,lng
 * ไม่ต้องผ่าน resolvePerson หรือ resolvePlace ที่หนัก
 * @param {string} shipToName - ชื่อปลายทางจากคอลัมน์ ShipToName
 * @return {Object|null} { lat, lng, destId, status, confidence, reason } หรือ null
 */
function fastLookupByShipToName(shipToName) {
  if (!shipToName) return null;
  var cleanName = normalizeForCompare(shipToName);
  if (!cleanName || cleanName.length < 2) return null;

  // 1. ค้นหาจาก M_ALIAS reverse index (O(1) lookup)
  var reverseIndex = loadGlobalAliasReverseIndex_();
  var matches = reverseIndex[cleanName];

  if (!matches || matches.length === 0) {
    // 2. Fallback: ลองค้นหาแบบ substring
    for (var key in reverseIndex) {
      if (key.length >= 4 && (cleanName.includes(key) || key.includes(cleanName))) {
        matches = reverseIndex[key];
        break;
      }
    }
  }

  if (!matches || matches.length === 0) return null;

  // 3. แปลง masterUuid → entityId → destination → coordinates
  // ลองทุก match ที่เจอ เอาอันแรกที่มีพิกัด
  for (var i = 0; i < matches.length; i++) {
    var match = matches[i];
    var entityId = null;
    var dests = [];

    if (match.entityType === 'PERSON') {
      entityId = convertUuidToPersonId(match.masterUuid);
      if (entityId) {
        dests = getDestsByPersonId(entityId);
      }
    } else if (match.entityType === 'PLACE') {
      entityId = convertUuidToPlaceId(match.masterUuid);
      if (entityId) {
        dests = getDestsByPlaceId(entityId);
      }
    }

    if (dests.length > 0) {
      // Sort by usageCount descending
      dests.sort(function(a, b) { return (b.usageCount || 0) - (a.usageCount || 0); });
      var topDest = dests[0];
      return {
        lat: topDest.lat,
        lng: topDest.lng,
        destId: topDest.destId,
        status: 'FOUND_ALIAS_FAST',
        confidence: 90,
        reason: 'M_ALIAS Fast Track: ' + match.entityType + ' via "' + shipToName + '"'
      };
    }
  }

  return null;
}

// ============================================================
// SECTION 6: [REMOVED v5.4.001] syncAliasToEntityTable_ — ลบแล้ว
// ============================================================
// ไม่ต้อง sync จาก M_ALIAS → M_PERSON_ALIAS/M_PLACE_ALIAS อีกต่อไป
// เพราะทำให้เกิด circular dependency:
//   createGlobalAlias() → syncAliasToEntityTable_() → createPersonAlias() → createGlobalAlias()
//
// ตอนนี้ M_PERSON_ALIAS + M_PLACE_ALIAS เขียนที่ autoEnrichAliasesFromFactBatch_() เท่านั้น
// ============================================================

// ============================================================
// SECTION 7: UUID ↔ Entity ID Converters
// ============================================================

/**
 * convertUuidToPersonId — แปลง masterUuid → personId
 */
function convertUuidToPersonId(masterUuid) {
  if (!masterUuid) return null;
  var allPersons = loadAllPersons_();
  var hit = allPersons.find(function(p) { return p.masterUuid === masterUuid; });
  return hit ? hit.personId : null;
}

/**
 * convertUuidToPlaceId — แปลง masterUuid → placeId
 */
function convertUuidToPlaceId(masterUuid) {
  if (!masterUuid) return null;
  var allPlaces = loadAllPlaces_();
  var hit = allPlaces.find(function(p) { return p.masterUuid === masterUuid; });
  return hit ? hit.placeId : null;
}

/**
 * convertPersonIdToUuid — แปลง personId → masterUuid
 */
function convertPersonIdToUuid(personId) {
  if (!personId) return null;
  var allPersons = loadAllPersons_();
  var hit = allPersons.find(function(p) { return p.personId === personId; });
  return hit ? hit.masterUuid : null;
}

/**
 * convertPlaceIdToUuid — แปลง placeId → masterUuid
 */
function convertPlaceIdToUuid(placeId) {
  if (!placeId) return null;
  var allPlaces = loadAllPlaces_();
  var hit = allPlaces.find(function(p) { return p.placeId === placeId; });
  return hit ? hit.masterUuid : null;
}

// ============================================================
// SECTION 8: assignMasterUuidIfMissing — ตรวจสอบและเพิ่ม UUID ให้ทุก entity
// ============================================================

/**
 * assignMasterUuidIfMissing — ตรวจสอบว่าทุกแถวใน M_PERSON และ M_PLACE มี master_uuid แล้ว
 * ถ้ายังไม่มี → สร้าง UUID v4 ให้อัตโนมัติ
 * ควรรันหลังจาก setup sheets หรือก่อน migration
 */
function assignMasterUuidIfMissing() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fixedTotal = 0;

  [SHEET.M_PERSON, SHEET.M_PLACE].forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    // หาตำแหน่งคอลัมน์ master_uuid จาก header
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var mUuidColIdx = headers.indexOf('master_uuid');
    if (mUuidColIdx === -1) {
      logWarn('AliasService', sheetName + ': ไม่พบคอลัมน์ master_uuid ใน header — ข้าม');
      return;
    }

    var lr = sheet.getLastRow();
    if (lr < 2) return;

    var uuidColRange = sheet.getRange(2, mUuidColIdx + 1, lr - 1, 1);
    var uidData = uuidColRange.getValues();
    var fixedCount = 0;

    for (var i = 0; i < uidData.length; i++) {
      if (!uidData[i][0]) {
        uidData[i][0] = Utilities.getUuid();
        fixedCount++;
      }
    }

    if (fixedCount > 0) {
      uuidColRange.setValues(uidData);
      logInfo('AliasService', sheetName + ': มอบ master_uuid ให้ ' + fixedCount + ' แถวที่ยังไม่มี');
    }
    fixedTotal += fixedCount;
  });

  // ล้าง Cache เพื่อให้ loader เห็นข้อมูลใหม่
  if (fixedTotal > 0) {
    invalidateAllGlobalCaches();
  }

  return fixedTotal;
}

// ============================================================
// SECTION 9: MIGRATION — ย้ายข้อมูลจาก Entity Alias → M_ALIAS
// ============================================================

/**
 * MIGRATION_HybridAliasSystem — ย้ายข้อมูลจาก M_PERSON_ALIAS และ M_PLACE_ALIAS ไปยัง M_ALIAS
 * และเพิ่ม master_uuid ให้ทุก entity ที่ยังไม่มี
 * เรียกจากเมนู: ระบบ > 🔄 Migration: Hybrid Alias System
 */
function MIGRATION_HybridAliasSystem() {
  var ui = SpreadsheetApp.getUi();
  var confirmation = ui.alert(
    '🔄 Migration: Hybrid Alias System',
    'ระบบจะดำเนินการดังนี้:\n' +
    '1. ตรวจสอบและเพิ่ม master_uuid ให้ทุก entity ที่ยังไม่มี\n' +
    '2. ย้ายข้อมูลจาก M_PERSON_ALIAS → M_ALIAS\n' +
    '3. ย้ายข้อมูลจาก M_PLACE_ALIAS → M_ALIAS\n' +
    '4. ดึงชื่อปลายทางจากชีต SCG ดิบ → M_ALIAS\n\n' +
    'ข้อมูลซ้ำจะถูกข้ามโดยอัตโนมัติ\n\n' +
    'พร้อมดำเนินการหรือไม่?',
    ui.ButtonSet.YES_NO
  );
  if (confirmation !== ui.Button.YES) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var startTime = new Date();

  try {
    logInfo('AliasService', 'Step 1: ตรวจสอบ master_uuid...');
    var uuidFixed = assignMasterUuidIfMissing();
    logInfo('AliasService', 'เพิ่ม master_uuid ให้ ' + uuidFixed + ' entities');

    CacheService.getScriptCache().removeAll(['M_PERSON_ALL', 'M_PLACE_ALL', 'M_GLOBAL_ALIAS_ALL', 'M_GLOBAL_ALIAS_REVERSE']);

    var migrateRequests = [];

    logInfo('AliasService', 'Step 2: ย้าย M_PERSON_ALIAS → M_ALIAS...');
    var personAliasSheet = ss.getSheetByName(SHEET.M_PERSON_ALIAS);
    if (personAliasSheet && personAliasSheet.getLastRow() > 1) {
      var paData = personAliasSheet.getRange(2, 1, personAliasSheet.getLastRow() - 1, SCHEMA[SHEET.M_PERSON_ALIAS].length).getValues();
      for (var i = 0; i < paData.length; i++) {
        if (i % 100 === 0) ensureAliasMigrationTime_(startTime, 'M_PERSON_ALIAS row ' + (i + 1));
        var pr = paData[i];
        if (!pr[PERSON_ALIAS_IDX.ACTIVE_FLAG]) continue;
        var personId = String(pr[PERSON_ALIAS_IDX.PERSON_ID] || '');
        var personAliasName = String(pr[PERSON_ALIAS_IDX.ALIAS_NAME] || '');
        var personMatchScore = Number(pr[PERSON_ALIAS_IDX.MATCH_SCORE] || 100);
        if (!personId || !personAliasName) continue;

        var personMasterUuid = convertPersonIdToUuid(personId);
        if (personMasterUuid) {
          migrateRequests.push({
            masterUuid: personMasterUuid,
            variantName: personAliasName,
            entityType: 'PERSON',
            confidence: personMatchScore,
            source: 'V52_LEGACY_MIGRATION'
          });
        }
      }
    }

    logInfo('AliasService', 'Step 3: ย้าย M_PLACE_ALIAS → M_ALIAS...');
    var placeAliasSheet = ss.getSheetByName(SHEET.M_PLACE_ALIAS);
    if (placeAliasSheet && placeAliasSheet.getLastRow() > 1) {
      var plData = placeAliasSheet.getRange(2, 1, placeAliasSheet.getLastRow() - 1, SCHEMA[SHEET.M_PLACE_ALIAS].length).getValues();
      for (var j = 0; j < plData.length; j++) {
        if (j % 100 === 0) ensureAliasMigrationTime_(startTime, 'M_PLACE_ALIAS row ' + (j + 1));
        var plr = plData[j];
        if (!plr[PLACE_ALIAS_IDX.ACTIVE_FLAG]) continue;
        var placeId = String(plr[PLACE_ALIAS_IDX.PLACE_ID] || '');
        var placeAliasName = String(plr[PLACE_ALIAS_IDX.ALIAS_NAME] || '');
        var placeMatchScore = Number(plr[PLACE_ALIAS_IDX.MATCH_SCORE] || 100);
        if (!placeId || !placeAliasName) continue;

        var placeMasterUuid = convertPlaceIdToUuid(placeId);
        if (placeMasterUuid) {
          migrateRequests.push({
            masterUuid: placeMasterUuid,
            variantName: placeAliasName,
            entityType: 'PLACE',
            confidence: placeMatchScore,
            source: 'V52_LEGACY_MIGRATION'
          });
        }
      }
    }

    var migrateCount = createGlobalAliasesBatch_(migrateRequests).length;

    ensureAliasMigrationTime_(startTime, 'SCG raw alias import');
    logInfo('AliasService', 'Step 4: ดึงชื่อจากชีต SCG ดิบ → M_ALIAS...');
    var scgCount = populateAliasFromSCGRawData_();

    ensureAliasMigrationTime_(startTime, 'FACT alias import');
    logInfo('AliasService', 'Step 5: ดึงชื่อจาก FACT_DELIVERY → M_ALIAS...');
    var factCount = populateAliasFromFactDelivery_();

    var elapsedSec = Math.round((new Date() - startTime) / 1000);
    var totalMigrated = migrateCount + scgCount + factCount;

    logInfo('AliasService',
      'Migration เสร็จสิ้น: UUID:' + uuidFixed +
      ' EntityAlias→M_ALIAS:' + migrateCount +
      ' SCG→M_ALIAS:' + scgCount +
      ' FACT→M_ALIAS:' + factCount +
      ' รวม:' + totalMigrated +
      ' (' + elapsedSec + 's)');

    ui.alert(
      '✅ Migration เสร็จสิ้น!\n\n' +
      '• เพิ่ม master_uuid: ' + uuidFixed + ' รายการ\n' +
      '• Entity Alias → M_ALIAS: ' + migrateCount + ' รายการ\n' +
      '• SCG Raw → M_ALIAS: ' + scgCount + ' รายการ\n' +
      '• FACT → M_ALIAS: ' + factCount + ' รายการ\n' +
      '• รวมทั้งหมด: ' + totalMigrated + ' รายการ\n' +
      '• ใช้เวลา: ' + elapsedSec + ' วินาที'
    );
  } catch (err) {
    logError('AliasService', 'MIGRATION_HybridAliasSystem ล้มเหลว: ' + err.message, err);
    ui.alert('❌ Migration หยุดทำงาน: ' + err.message);
    throw err;
  }
}


// ============================================================
// SECTION 10: populateAliasFromSCGRawData_ — ดึงจากชีต SCG ดิบ
// ============================================================

/**
 * populateAliasFromSCGRawData_ — ดึงชื่อปลายทางจากชีต SCGนครหลวงJWDภูมิภาค
 * แล้วเข้ากระบวนการทำความสะอาด แล้วบันทึกเข้า M_ALIAS
 * นี่คือการทำงานหลักของ "ชีตSCGนครหลวงJWDภูมิภาค → ทำความสะอาด → บันทึกเข้าฐาน"
 * @return {number} จำนวน alias ที่สร้างใหม่
 */
function populateAliasFromSCGRawData_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sourceSheet = ss.getSheetByName(SHEET.SOURCE);
  var startTime = new Date();
  if (!sourceSheet || sourceSheet.getLastRow() < 2) {
    logWarn('AliasService', 'ชีต SCG ดิบ ว่างอยู่ — ข้ามการดึงข้อมูล');
    return 0;
  }

  var schemaLen = SCHEMA[SHEET.SOURCE] ? SCHEMA[SHEET.SOURCE].length : 37;
  var data = sourceSheet.getRange(2, 1, sourceSheet.getLastRow() - 1, schemaLen).getValues();

  var nameCount = {};  // { normalizeName: { rawName, count } }
  data.forEach(function(r, idx) {
    if (idx % 500 === 0) ensureAliasMigrationTime_(startTime, 'SCG raw scan row ' + (idx + 1));
    var rawPersonName = String(r[SRC_IDX.RAW_PERSON_NAME] || '').trim();
    if (!rawPersonName || rawPersonName.length < 2) return;

    var normKey = normalizeForCompare(rawPersonName);
    if (!normKey || normKey.length < 2) return;

    if (!nameCount[normKey]) {
      nameCount[normKey] = { rawName: rawPersonName, count: 0 };
    }
    nameCount[normKey].count++;
  });

  var allPersons = loadAllPersons_();
  var personNormMap = {};
  allPersons.forEach(function(p) {
    if (p.normalized && p.masterUuid) {
      personNormMap[p.normalized] = p.masterUuid;
    }
  });

  var allPlaces = loadAllPlaces_();
  var placeNormMap = {};
  allPlaces.forEach(function(p) {
    if (p.normalized && p.masterUuid) {
      placeNormMap[p.normalized] = p.masterUuid;
    }
  });

  var aliasRequests = [];
  var keys = Object.keys(nameCount);
  for (var k = 0; k < keys.length; k++) {
    if (k % 100 === 0) ensureAliasMigrationTime_(startTime, 'SCG alias match ' + (k + 1));
    var normKey = keys[k];
    var info = nameCount[normKey];
    var rawName = info.rawName;
    var matchedUuid = personNormMap[normKey];
    var matchedType = 'PERSON';

    if (!matchedUuid) {
      matchedUuid = placeNormMap[normKey];
      matchedType = 'PLACE';
    }

    if (!matchedUuid) {
      for (var pNorm in personNormMap) {
        if (pNorm.length >= 4 && (normKey.includes(pNorm) || pNorm.includes(normKey))) {
          matchedUuid = personNormMap[pNorm];
          matchedType = 'PERSON';
          break;
        }
      }
    }
    if (!matchedUuid) {
      for (var plNorm in placeNormMap) {
        if (plNorm.length >= 4 && (normKey.includes(plNorm) || plNorm.includes(normKey))) {
          matchedUuid = placeNormMap[plNorm];
          matchedType = 'PLACE';
          break;
        }
      }
    }

    if (matchedUuid) {
      aliasRequests.push({
        masterUuid: matchedUuid,
        variantName: rawName,
        entityType: matchedType,
        confidence: 90,
        source: 'SCG_RAW_IMPORT'
      });
    }
  }

  var aliasCount = createGlobalAliasesBatch_(aliasRequests).length;
  logInfo('AliasService', 'populateAliasFromSCGRawData: ดึง ' + keys.length + ' ชื่อไม่ซ้ำ → สร้าง ' + aliasCount + ' alias ใหม่');
  return aliasCount;
}


// ============================================================
// SECTION 11: populateAliasFromFactDelivery_ — ดึงจาก FACT_DELIVERY
// ============================================================

/**
 * populateAliasFromFactDelivery_ — ดึงชื่อ ShipToName ทั้งหมดจาก FACT_DELIVERY → M_ALIAS
 * @return {number} จำนวน alias ที่สร้างใหม่
 */
function populateAliasFromFactDelivery_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var factSheet = ss.getSheetByName(SHEET.FACT_DELIVERY);
  var startTime = new Date();
  if (!factSheet || factSheet.getLastRow() < 2) return 0;

  var schemaLen = SCHEMA[SHEET.FACT_DELIVERY].length;
  var data = factSheet.getRange(2, 1, factSheet.getLastRow() - 1, schemaLen).getValues();

  var nameMap = {}; // { normName: { rawName, personId, placeId } }
  data.forEach(function(r, idx) {
    if (idx % 500 === 0) ensureAliasMigrationTime_(startTime, 'FACT scan row ' + (idx + 1));
    var rawName = String(r[FACT_IDX.SHIP_TO_NAME] || '').trim();
    var personId = String(r[FACT_IDX.PERSON_ID] || '').trim();
    var placeId = String(r[FACT_IDX.PLACE_ID] || '').trim();
    if (!rawName || rawName.length < 2) return;

    var normKey = normalizeForCompare(rawName);
    if (!normKey || normKey.length < 2) return;
    if (!nameMap[normKey]) {
      nameMap[normKey] = { rawName: rawName, personId: personId, placeId: placeId };
    }
  });

  var aliasRequests = [];
  var keys = Object.keys(nameMap);
  for (var i = 0; i < keys.length; i++) {
    if (i % 100 === 0) ensureAliasMigrationTime_(startTime, 'FACT alias match ' + (i + 1));
    var info = nameMap[keys[i]];

    if (info.personId) {
      var masterUuid = convertPersonIdToUuid(info.personId);
      if (masterUuid) {
        aliasRequests.push({
          masterUuid: masterUuid,
          variantName: info.rawName,
          entityType: 'PERSON',
          confidence: 95,
          source: 'FACT_DELIVERY_IMPORT'
        });
        continue;
      }
    }

    if (info.placeId) {
      var masterUuid2 = convertPlaceIdToUuid(info.placeId);
      if (masterUuid2) {
        aliasRequests.push({
          masterUuid: masterUuid2,
          variantName: info.rawName,
          entityType: 'PLACE',
          confidence: 90,
          source: 'FACT_DELIVERY_IMPORT'
        });
      }
    }
  }

  var aliasCount = createGlobalAliasesBatch_(aliasRequests).length;
  logInfo('AliasService', 'populateAliasFromFactDelivery: ดึง ' + keys.length + ' ชื่อไม่ซ้ำ → สร้าง ' + aliasCount + ' alias ใหม่');
  return aliasCount;
}


// ============================================================
// SECTION 12: generateUUID — สร้าง UUID v4
// ============================================================

/**
 * generateUUID — สร้าง UUID v4 สำหรับ master_uuid
 * (เรียกจาก createPerson/createPlace ใน 06/07)
 */
function generateUUID() {
  return Utilities.getUuid();
}
