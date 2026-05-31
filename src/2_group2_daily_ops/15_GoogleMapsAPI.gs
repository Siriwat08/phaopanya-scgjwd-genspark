/**
 * VERSION: 5.4.001
 * FILE: 15_GoogleMapsAPI.gs
 * LMDS V5.4 — Google Maps API Service (Hybrid Cache)
 * ===================================================
 * PURPOSE:
 *   ให้บริการ Geocoding (ที่อยู่ → พิกัด) และ Reverse Geocoding (พิกัด → ที่อยู่)
 *   พร้อมระบบแคช 3 ชั้น: RAM Cache → Sheet Cache → Google Maps API
 *   รองรับการดึงข้อมูลจังหวัด/อำเภอจากพิกัด เพื่อใช้ในระบบ Enrichment
 * ===================================================
 * CHANGELOG:
 *   v5.4.001 (2026-05-24) — Single Writer Pattern:
 *     - [REVIEW] clearMapsCache: ต้องตรวจสอบ bug — keys จาก sheet อาจไม่ตรงกับ CacheService keys
 *   v5.4.000 (2026-05-23):
 *     - [UPGRADE] Version bump to 5.4.000
 *   v5.2.010:
 *     - [UPGRADE] อัปเกรดระบบเป็น 5.2.010
 *   v5.2.009:
 *     - [FIX] clearMapsCache: ดึงรายชื่อ Cache Key จากชีตก่อนลบ เพื่อลบ CacheService ได้ถูกต้อง
 *   v5.2.003:
 *     - [FIX] geocodeAddress: Normalize address ก่อน Hash + break ใน if(OK)
 *     - [FIX] reverseGeocode: เพิ่ม .setRegion('TH') + Cache รองรับ province/district
 *     - [FIX] getRouteDistanceKm: guard routes + legs ก่อนใช้
 *     - [FIX] Sheet Cache: ใช้ MAPS_CACHE_IDX constants จาก 01_Config.gs + คืน province/district
 * ===================================================
 * DEPENDENCIES:
 *   REQUIRES (Load Order):
 *     - 01_Config.gs          (SHEET.MAPS_CACHE, AI_CONFIG, APP_CONST, MAPS_CACHE_IDX)
 *     - 02_Schema.gs          (SCHEMA[SHEET.MAPS_CACHE])
 *     - 14_Utils.gs           (generateMd5Hash, isValidLatLng, parseLatLng)
 *     - 03_SetupSheets.gs     (logError, logInfo)
 *   CALLS (Invokes):
 *     - (Google Maps API via Maps.newGeocoder / Maps.newDirectionFinder)
 *   EXPORTS TO:
 *     - 08_GeoService.gs       (geocodeAddress, reverseGeocode)
 *     - 07_PlaceService.gs     (geocodeAddress — Geo enrichment)
 *     - 00_App.gs              (clearMapsCache — menu)
 *   SHEETS ACCESSED:
 *     - SHEET.MAPS_CACHE       (Read+Write: 3-layer cache, geocode/reverse results)
 * ===================================================
 * ARCHITECTURE:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  15_GoogleMapsAPI.gs (Maps Service + Hybrid Cache)          │
 *   │  ├── geocodeAddress()   — Address → LatLng (3-layer cache) │
 *   │  │   ├── ชั้น 1: RAM Cache (CacheService)                    │
 *   │  │   ├── ชั้น 2: Sheet Cache (MAPS_CACHE)                   │
 *   │  │   └── ชั้น 3: Google Maps API + retry                    │
 *   │  ├── reverseGeocode()  — LatLng → Address (3-layer cache) │
 *   │  ├── getRouteDistanceKm() — Road distance between 2 points │
 *   │  ├── getFromSheetCache_()  — Read MAPS_CACHE               │
 *   │  ├── saveToSheetCache_()   — Write MAPS_CACHE              │
 *   │  └── clearMapsCache()      — Clear all cache layers        │
 *   └─────────────────────────────────────────────────────────────┘
 * ===================================================
 */

// ============================================================
// SECTION 1: MAPS_CACHE indexes live in 01_Config.gs
// ============================================================

// ใช้ MAPS_CACHE_IDX จาก 01_Config.gs เพื่อให้ index ทุกชีตอยู่ที่เดียวกันตาม LMDS Rule 3

// ============================================================
// SECTION 2: geocodeAddress — Address → LatLng
// ============================================================

/**
 * geocodeAddress — แปลงที่อยู่เป็นพิกัด GPS
 * [FIX v003] Normalize address ก่อน Hash
 * [FIX v003] break อยู่ใน if(OK) ป้องกัน break แม้ API ล้มเหลว
 */
function geocodeAddress(address) {
  if (!address || String(address).trim().length < 5) return null;

  // [FIX v003] Normalize ก่อน Hash → "บางนา กรุงเทพ" = "บางนา,กรุงเทพ"
  const normalizedAddr = String(address).trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const cacheKey = 'GEO_' + generateMd5Hash(normalizedAddr);

  // ชั้น 1: RAM Cache
  const ramCache  = CacheService.getScriptCache();
  const ramCached = ramCache.get(cacheKey);
  if (ramCached) {
    try { return JSON.parse(ramCached); } catch(e) {}
  }

  // ชั้น 2: Sheet Cache
  const sheetResult = getFromSheetCache_(cacheKey);
  if (sheetResult) {
    ramCache.put(cacheKey, JSON.stringify(sheetResult), AI_CONFIG.CACHE_TTL_SEC);
    return sheetResult;
  }

  // ชั้น 3: Maps API
  let result  = null;
  let retries = 0;

  while (retries < APP_CONST.MAX_RETRIES) {
    try {
      const geoResult = Maps.newGeocoder()
                            .setLanguage('th')
                            .setRegion('TH')
                            .geocode(String(address).trim());

      // [FIX v003] break อยู่ใน if(OK) → ถ้า status ไม่ OK จะ continue retry
      if (geoResult.status === 'OK' && geoResult.results.length > 0) {
        const loc        = geoResult.results[0].geometry.location;
        const components = geoResult.results[0].address_components || [];
        result = {
          lat:          loc.lat,
          lng:          loc.lng,
          resolvedAddr: geoResult.results[0].formatted_address || '',
          province:     extractAddrComponent_(components, 'administrative_area_level_1'),
          district:     extractAddrComponent_(components, 'administrative_area_level_2'),
        };
        break; // [FIX v003] break อยู่ใน if(OK) เท่านั้น
      }
      // ถ้า status ไม่ OK → retries++ แล้ว retry ต่อ
      retries++;
      if (retries < APP_CONST.MAX_RETRIES) Utilities.sleep(1000 * retries);

    } catch (apiErr) {
      retries++;
      if (retries < APP_CONST.MAX_RETRIES) {
        Utilities.sleep(1000 * retries);
      } else {
        logError('MapsAPI', `geocodeAddress ล้มเหลว: ${apiErr.message}`);
      }
    }
  }

  if (result) {
    ramCache.put(cacheKey, JSON.stringify(result), AI_CONFIG.CACHE_TTL_SEC);
    saveToSheetCache_(cacheKey, String(address).trim(), result);
  }

  return result;
}

// ============================================================
// SECTION 3: reverseGeocode — LatLng → Address
// ============================================================

/**
 * reverseGeocode — แปลงพิกัด GPS เป็นที่อยู่
 * [FIX v003] เพิ่ม .setRegion('TH')
 * [FIX v003] Cache schema รองรับ province/district
 */
function reverseGeocode(lat, lng) {
  if (!isValidLatLng(lat, lng)) return null;

  const cacheKey  = 'RGEO_' + generateMd5Hash(`${lat},${lng}`);
  const ramCache  = CacheService.getScriptCache();
  const ramCached = ramCache.get(cacheKey);
  if (ramCached) {
    try { return JSON.parse(ramCached); } catch(e) {}
  }

  const sheetResult = getFromSheetCache_(cacheKey);
  if (sheetResult) {
    ramCache.put(cacheKey, JSON.stringify(sheetResult), AI_CONFIG.CACHE_TTL_SEC);
    return sheetResult;
  }

  let result  = null;
  let retries = 0;

  while (retries < APP_CONST.MAX_RETRIES) {
    try {
      // [FIX v003] เพิ่ม .setRegion('TH') ป้องกัน format ต่างประเทศ
      const geoResult = Maps.newGeocoder()
                            .setLanguage('th')
                            .setRegion('TH')
                            .reverseGeocode(lat, lng);

      if (geoResult.status === 'OK' && geoResult.results.length > 0) {
        const components = geoResult.results[0].address_components || [];
        result = {
          resolvedAddr: geoResult.results[0].formatted_address || '',
          province:     extractAddrComponent_(components, 'administrative_area_level_1'),
          district:     extractAddrComponent_(components, 'administrative_area_level_2'),
          lat:          lat,
          lng:          lng,
        };
        break;
      }
      retries++;
      if (retries < APP_CONST.MAX_RETRIES) Utilities.sleep(1000 * retries);

    } catch (apiErr) {
      retries++;
      if (retries < APP_CONST.MAX_RETRIES) {
        Utilities.sleep(1000 * retries);
      } else {
        logError('MapsAPI', `reverseGeocode ล้มเหลว: ${apiErr.message}`);
      }
    }
  }

  if (result) {
    ramCache.put(cacheKey, JSON.stringify(result), AI_CONFIG.CACHE_TTL_SEC);
    saveToSheetCache_(cacheKey, `${lat},${lng}`, result);
  }

  return result;
}

/**
 * extractAddrComponent_ — ดึงค่าจาก Address Component
 */
function extractAddrComponent_(components, typeName) {
  const comp = components.find(c => c.types && c.types.includes(typeName));
  if (!comp) return '';
  // ใช้ long_name ก่อน fallback short_name
  return comp.long_name || comp.short_name || '';
}

// ============================================================
// SECTION 4: getRouteDistanceKm
// ============================================================

/**
 * getRouteDistanceKm — ระยะทางบนถนนจริง
 * [FIX v003] guard legs ก่อนใช้
 * [NOTE] ใช้ Maps Directions API Quota สูง — อย่ารันใน Loop
 */
function getRouteDistanceKm(originAddr, destAddr) {
  try {
    const directions = Maps.newDirectionFinder()
      .setOrigin(originAddr)
      .setDestination(destAddr)
      .setMode(Maps.DirectionFinder.Mode.DRIVING)
      .getDirections();

    if (directions.status !== 'OK') return -1;

    // [FIX v003] guard routes + legs ก่อนใช้
    const routes = directions.routes;
    if (!routes || routes.length === 0) return -1;

    const legs = routes[0].legs;
    if (!legs || legs.length === 0) return -1;

    const totalMeters = legs.reduce((sum, leg) => sum + (leg.distance.value || 0), 0);
    return Math.round(totalMeters / 100) / 10;

  } catch (err) {
    logError('MapsAPI', `getRouteDistanceKm ล้มเหลว: ${err.message}`);
    return -1;
  }
}

// ============================================================
// SECTION 5: Sheet Cache — Persistent Storage
// ============================================================

/**
 * getFromSheetCache_ — ดึงข้อมูลจาก MAPS_CACHE Sheet
 * [FIX v5.4.002] ใช้ MAPS_CACHE_IDX constants จาก 01_Config.gs แทน module-level MC_* constants
 * [FIX v003] คืน province + district ด้วย
 */
function getFromSheetCache_(cacheKey) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET.MAPS_CACHE);
  if (!sheet || sheet.getLastRow() < 2) return null;

  const totalCols = SCHEMA[SHEET.MAPS_CACHE].length; // 10 cols (v003)
  const data      = sheet.getRange(2, 1, sheet.getLastRow() - 1, totalCols)
                         .getValues();

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][MAPS_CACHE_IDX.CACHE_KEY]).trim() !== cacheKey) continue;

    // [FIX v5.4.003] Keep cache lookup read-only; hit count writes are intentionally
    // skipped here to avoid Spreadsheet writes inside high-frequency lookup loops.

    // [FIX v003] คืน province + district ด้วย
    return {
      lat:          Number(data[i][MAPS_CACHE_IDX.LAT])              || 0,
      lng:          Number(data[i][MAPS_CACHE_IDX.LNG])              || 0,
      resolvedAddr: String(data[i][MAPS_CACHE_IDX.RESOLVED_ADDRESS]) || '',
      province:     String(data[i][MAPS_CACHE_IDX.PROVINCE])         || '',
      district:     String(data[i][MAPS_CACHE_IDX.DISTRICT])         || '',
    };
  }
  return null;
}

/**
 * saveToSheetCache_ — บันทึกผลลง MAPS_CACHE Sheet
 * [FIX v003] เพิ่ม province + district ใน row
 */
function saveToSheetCache_(cacheKey, inputAddr, result) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET.MAPS_CACHE);
    if (!sheet) return;

    const row = [];
    row[MAPS_CACHE_IDX.CACHE_KEY]        = cacheKey;
    row[MAPS_CACHE_IDX.ADDRESS_INPUT]    = inputAddr;
    row[MAPS_CACHE_IDX.LAT]              = result.lat          || 0;
    row[MAPS_CACHE_IDX.LNG]              = result.lng          || 0;
    row[MAPS_CACHE_IDX.RESOLVED_ADDRESS] = result.resolvedAddr || '';
    row[MAPS_CACHE_IDX.SOURCE]           = 'maps_api';
    row[MAPS_CACHE_IDX.CREATED_AT]       = new Date();
    row[MAPS_CACHE_IDX.HIT_COUNT]        = 1;
    row[MAPS_CACHE_IDX.PROVINCE]         = result.province     || '';
    row[MAPS_CACHE_IDX.DISTRICT]         = result.district     || '';

    sheet.getRange(sheet.getLastRow() + 1, 1, 1, SCHEMA[SHEET.MAPS_CACHE].length)
         .setValues([row]);
  } catch (err) {
    logError('MapsAPI', `saveToSheetCache_ ล้มเหลว: ${err.message}`);
  }
}

/**
 * clearMapsCache — ล้าง MAPS_CACHE Sheet และ RAM Cache ทั้งหมด
 */
function clearMapsCache() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET.MAPS_CACHE);

  if (sheet && sheet.getLastRow() > 1) {
    // [FIX v5.2.009] ดึงรายชื่อ Cache Key ทั้งหมดจากชีตก่อนลบ เพื่อนำไปลบใน CacheService ได้ถูกต้อง
    const keys = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(r => String(r[0] || '').trim()).filter(Boolean);
    if (keys.length > 0) {
      // ลบทีละ 200 keys เพื่อไม่ให้เกิน limit ของ CacheService.removeAll
      const cache = CacheService.getScriptCache();
      for (let i = 0; i < keys.length; i += 200) {
        cache.removeAll(keys.slice(i, i + 200));
      }
    }
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }

  logInfo('MapsAPI', 'ล้าง MAPS_CACHE เรียบร้อย');
}
