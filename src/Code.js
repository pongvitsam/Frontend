// Web app + API backend
const SHEET_ID = '1-bTU1X8fgcSGOBWWQHVYdwrFgGddciORQvPuYtqzCk4';
const DRIVE_FOLDER_ID = '1UU2U11ve_75YQbs0WiP0WzaVQK5ZVwS6';
const CACHE_TTL_INITIAL_SEC = 900;
const CACHE_TTL_APPS_SEC = 300;
const CACHE_TTL_ADMIN_SEC = 120;
const CACHE_TTL_SETTINGS_SEC = 600;
const CACHE_KEY_INITIAL = 'appInitialDataV2';
const CACHE_KEY_APPS = 'appsDataV2';
const CACHE_KEY_ADMIN = 'adminDashboardV2';
const CACHE_KEY_SETTINGS = 'settingsMapV2';

let SS_MEMO_ = null;

function getSpreadsheet_() {
  if (!SS_MEMO_) SS_MEMO_ = SpreadsheetApp.openById(SHEET_ID);
  return SS_MEMO_;
}

function invalidateAppCaches_() {
  const cache = CacheService.getScriptCache();
  cache.remove(CACHE_KEY_INITIAL);
  cache.remove(CACHE_KEY_APPS);
  cache.remove(CACHE_KEY_ADMIN);
  cache.remove(CACHE_KEY_SETTINGS);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** หน้าเว็บหลัก — GitHub Pages (โหลดเร็ว) */
var PAGES_URL = 'https://pongvitsam.github.io/Frontend/';

function redirectToPages_() {
  return HtmlService.createHtmlOutputFromFile('Redirect')
    .setTitle('ย้ายไปหน้าเว็บใหม่')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}


function doGet(e) {
  var params = (e && e.parameter) || {};
  if (params.page === 'bridge') {
    return HtmlService.createHtmlOutputFromFile('Bridge')
      .setTitle('GAS Bridge')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (params.action) {
    return handleApiRequest_(params);
  }
  // ?gas=1 เปิด UI บน GAS โดยตรง (สำรอง)
  if (params.gas === '1' || params.legacy === '1') {
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('กองบริการธุรกิจจัดการพลังงาน')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }
  return redirectToPages_();
}

function invokeApiAction_(action, args) {
  args = args || [];
  switch (action) {
    case 'getInitialData':
      return getInitialData();
    case 'getAdminDashboardData':
      return getAdminDashboardData();
    case 'verifyLogin':
      return verifyLogin(args[0], args[1]);
    case 'recordClick':
      recordClick(args[0], args[1]);
      return true;
    case 'updateBanner':
      return updateBanner(args[0], args[1]);
    case 'deleteProject':
      return deleteProject(args[0]);
    case 'reorderApps':
      return reorderApps(args[0]);
    case 'uploadImage':
      return uploadImage(args[0]);
    case 'saveProject':
      return saveProject(args[0], args[1] || null);
    case 'setSettingImage':
      return setSettingImage(args[0], args[1]);
    case 'updateBackgroundImage':
      return updateBackgroundImage(args[0]);
    case 'updateLogoImage':
      return updateLogoImage(args[0]);
    default:
      throw new Error('Unknown action: ' + action);
  }
}

function formatApiResponse_(payload, callback, htmlCallback) {
  var body = JSON.stringify(payload);
  if (!callback) {
    return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
  }
  if (htmlCallback) {
    var safeCb = String(callback).replace(/[^\w$._-]/g, '');
    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><body><script>try{parent.postMessage({type:"gas-form-post",callback:"' +
        safeCb +
        '",response:JSON.parse(' +
        JSON.stringify(body) +
        ')},"*");}catch(e){}</script></body></html>'
    ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return ContentService.createTextOutput(callback + '(' + body + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function handleApiRequest_(params) {
  var args = [];
  if (params.args) {
    try {
      args = JSON.parse(params.args);
    } catch (err) {
      args = [];
    }
  }
  var payload;
  try {
    payload = { ok: true, data: invokeApiAction_(params.action, args) };
  } catch (err) {
    payload = { ok: false, error: String(err.message || err) };
  }
  return formatApiResponse_(payload, params.callback, false);
}

function doPost(e) {
  var params = {};
  if (e && e.postData && e.postData.contents) {
    try {
      params = JSON.parse(e.postData.contents);
    } catch (err) {
      params = (e && e.parameter) || {};
    }
  } else {
    params = (e && e.parameter) || {};
  }
  var args = params.args;
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch (err2) {
      args = [];
    }
  }
  if (!Array.isArray(args)) args = [];
  if (params.fileData) {
    try {
      var filePayload = JSON.parse(params.fileData);
      if (params.action === 'uploadImage') {
        args = [filePayload];
      } else if (params.action === 'saveProject' && args.length) {
        args[1] = filePayload;
      }
    } catch (fileErr) {}
  }
  var payload;
  try {
    payload = { ok: true, data: invokeApiAction_(params.action, args) };
  } catch (err3) {
    payload = { ok: false, error: String(err3.message || err3) };
  }
  return formatApiResponse_(payload, params.callback, true);
}

// ---------------- API & Functions ----------------

// ---------------- API & Functions ----------------

function getInitialData() {
  const cache = CacheService.getScriptCache();
  const cachedData = cache.get(CACHE_KEY_INITIAL);
  const email = Session.getActiveUser().getEmail() || "ผู้ใช้งานทั่วไป";

  // 1. ถ้ามี Cache อยู่แล้ว ให้ดึงมาใช้เลย (เร็วมาก < 0.2 วินาที)
  if (cachedData) {
    const data = JSON.parse(cachedData);
    data.email = email; // อัปเดตอีเมลผู้ใช้ปัจจุบัน
    return data;
  }

  const lock = LockService.getScriptLock();
  const locked = lock.tryLock(1500);
  try {
    const secondCheck = cache.get(CACHE_KEY_INITIAL);
    if (secondCheck) {
      const data = JSON.parse(secondCheck);
      data.email = email;
      return data;
    }
    const settingsMap = getSettingsMap_();
    const apps = getApps();

    const result = {
      email: email,
      apps: apps,
      bgImage: settingsMap['BackgroundImage'] || '',
      logoImage: settingsMap['LogoImage'] || '',
      bannerText: settingsMap['BannerText'] || '',
      bannerVisible: settingsMap['BannerVisible'] || ''
    };

    cache.put(CACHE_KEY_INITIAL, JSON.stringify(result), CACHE_TTL_INITIAL_SEC);
    return result;
  } finally {
    if (locked) lock.releaseLock();
  }
}

// สร้างฟังก์ชันสำหรับล้าง Cache เมื่อ Admin อัปเดตข้อมูล
function clearAppCache() {
  invalidateAppCaches_();
}

function getSettingsMap_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEY_SETTINGS);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }
  const sheet = getSpreadsheet_().getSheetByName('Settings');
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const values = sheet.getRange(1, 1, lastRow, 2).getValues();
  const map = {};
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] !== '') map[values[i][0]] = values[i][1];
  }
  cache.put(CACHE_KEY_SETTINGS, JSON.stringify(map), CACHE_TTL_SETTINGS_SEC);
  return map;
}

function saveSettingValue(key, value) {
  const sheet = getSpreadsheet_().getSheetByName('Settings');
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const data = sheet.getRange(1, 1, lastRow, 2).getValues();
  let found = false;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      found = true;
      break;
    }
  }
  if (!found) sheet.appendRow([key, value]);
}

function updateBanner(text, isVisible) {
  const sheet = getSpreadsheet_().getSheetByName('Settings');
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const data = sheet.getRange(1, 1, lastRow, 2).getValues();
  let textRow = -1;
  let visibleRow = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === 'BannerText') textRow = i + 1;
    if (data[i][0] === 'BannerVisible') visibleRow = i + 1;
  }
  if (textRow > 0) sheet.getRange(textRow, 2).setValue(text);
  else sheet.appendRow(['BannerText', text]);
  if (visibleRow > 0) sheet.getRange(visibleRow, 2).setValue(isVisible);
  else sheet.appendRow(['BannerVisible', isVisible]);
  clearAppCache(); // <--- เพิ่มคำสั่งล้างคุกกี้ตรงนี้
  return true;
}

function mapAppRow_(row, index) {
  return {
    id: row[0],
    name: row[1],
    url: row[2],
    imageUrl: row[3],
    status: row[4],
    clicks: row[5] || 0,
    sortOrder: row[6] !== '' && row[6] != null ? Number(row[6]) : (index + 1) * 10,
  };
}

function sortAppsByOrder_(apps) {
  return apps.slice().sort(function (a, b) {
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });
}

function getApps() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEY_APPS);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length && parsed[0].sortOrder != null) {
        return sortAppsByOrder_(parsed);
      }
    } catch (e) {}
  }
  const sheet = getSpreadsheet_().getSheetByName('Apps');
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const colCount = Math.max(sheet.getLastColumn(), 7);
  const data = sheet.getRange(1, 1, lastRow, colCount).getValues();
  data.shift();
  const apps = data.map(function (row, i) { return mapAppRow_(row, i); });
  const sorted = sortAppsByOrder_(apps);
  cache.put(CACHE_KEY_APPS, JSON.stringify(sorted), CACHE_TTL_APPS_SEC);
  return sorted;
}

function reorderApps(orderedIds) {
  orderedIds = orderedIds || [];
  const sheet = getSpreadsheet_().getSheetByName('Apps');
  const lastRow = Math.max(sheet.getLastRow(), 1);
  if (lastRow < 2 || !orderedIds.length) return getApps();

  if (sheet.getLastColumn() < 7) {
    sheet.getRange(1, 7).setValue('sortOrder');
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const finder = sheet.getRange(2, 1, lastRow - 1, 1)
      .createTextFinder(String(orderedIds[i])).matchEntireCell(true);
    const hit = finder.findNext();
    if (hit) sheet.getRange(hit.getRow(), 7).setValue(i + 1);
  }

  const cache = CacheService.getScriptCache();
  cache.remove(CACHE_KEY_APPS);
  cache.remove(CACHE_KEY_INITIAL);
  return getApps();
}

function hashPassword(password) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  let txtHash = '';
  for (let i = 0; i < rawHash.length; i++) {
    let hashVal = rawHash[i];
    if (hashVal < 0) hashVal += 256; 
    if (hashVal.toString(16).length == 1) txtHash += '0';
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

function verifyLogin(username, password) {
  const sheet = getSpreadsheet_().getSheetByName('Settings');
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const data = sheet.getRange(1, 1, lastRow, 2).getValues();
  const hashedInput = hashPassword(password);
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username && data[i][1] === hashedInput) return true;
  }
  return false;
}

function recordClick(appId, appName) {
  const email = Session.getActiveUser().getEmail() || "ผู้ใช้งานทั่วไป";
  const timestamp = new Date();
  
  const ss = getSpreadsheet_();
  const logSheet = ss.getSheetByName('Logs');
  logSheet.appendRow([timestamp, email, appId, appName]);
  
  const appSheet = ss.getSheetByName('Apps');
  const finder = appSheet.getRange(2, 1, Math.max(appSheet.getLastRow() - 1, 0), 1).createTextFinder(String(appId)).matchEntireCell(true);
  const hit = finder.findNext();
  if (hit) {
    const rowNo = hit.getRow();
    const current = Number(appSheet.getRange(rowNo, 6).getValue()) || 0;
    appSheet.getRange(rowNo, 6).setValue(current + 1);
  }
}

function uploadImageToDrive_(fileData, thumbSize) {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const blob = Utilities.newBlob(Utilities.base64Decode(fileData.data), fileData.mimeType, fileData.name);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=' + (thumbSize || 'w480');
}

function uploadImage(fileData) {
  if (!fileData || !fileData.data) throw new Error('ไม่มีไฟล์รูปภาพ');
  return uploadImageToDrive_(fileData, fileData.thumbSize || 'w480');
}

function setSettingImage(key, imageUrl) {
  saveSettingValue(key, imageUrl);
  const cache = CacheService.getScriptCache();
  cache.remove(CACHE_KEY_INITIAL);
  cache.remove(CACHE_KEY_SETTINGS);
  return imageUrl;
}

// อัปโหลดรูปลง Drive และบันทึกใน Settings
function updateSettingImage(key, fileData) {
  let imageUrl = '';
  if (fileData && fileData.data) {
    imageUrl = uploadImageToDrive_(fileData, 'w800');
  }
  return setSettingImage(key, imageUrl);
}

function updateBackgroundImage(fileData) { return updateSettingImage('BackgroundImage', fileData); }
function updateLogoImage(fileData) { return updateSettingImage('LogoImage', fileData); }

// เพิ่มหรือแก้ไขโปรแกรม
function saveProject(projectData, fileData) {
  let imageUrl = projectData.imageUrl || '';
  if (fileData && fileData.data) {
    imageUrl = uploadImageToDrive_(fileData, 'w480');
  }

  const sheet = getSpreadsheet_().getSheetByName('Apps');
  const cache = CacheService.getScriptCache();
  let apps = null;
  try {
    const cached = cache.get(CACHE_KEY_APPS);
    if (cached) apps = JSON.parse(cached);
  } catch (e) {}

  if (projectData.id) {
    const lastRow = Math.max(sheet.getLastRow(), 1);
    if (lastRow >= 2) {
      const finder = sheet.getRange(2, 1, lastRow - 1, 1)
        .createTextFinder(String(projectData.id)).matchEntireCell(true);
      const hit = finder.findNext();
      if (hit) {
        const rowNo = hit.getRow();
        sheet.getRange(rowNo, 2).setValue(projectData.name);
        sheet.getRange(rowNo, 3).setValue(projectData.url);
        if (imageUrl) sheet.getRange(rowNo, 4).setValue(imageUrl);
        sheet.getRange(rowNo, 5).setValue(projectData.status);
      }
    }
    if (apps) {
      for (let i = 0; i < apps.length; i++) {
        if (apps[i].id == projectData.id) {
          apps[i].name = projectData.name;
          apps[i].url = projectData.url;
          apps[i].status = projectData.status;
          if (imageUrl) apps[i].imageUrl = imageUrl;
          break;
        }
      }
    }
  } else {
    const newId = new Date().getTime();
    let nextOrder = 10;
    if (apps && apps.length) {
      apps.forEach(function (a) {
        if ((a.sortOrder || 0) >= nextOrder) nextOrder = a.sortOrder + 10;
      });
    }
    if (sheet.getLastColumn() < 7) sheet.getRange(1, 7).setValue('sortOrder');
    sheet.appendRow([newId, projectData.name, projectData.url, imageUrl, projectData.status, 0, nextOrder]);
    if (apps) {
      apps.push({
        id: newId,
        name: projectData.name,
        url: projectData.url,
        imageUrl: imageUrl,
        status: projectData.status,
        clicks: 0,
        sortOrder: nextOrder,
      });
    }
  }

  if (!apps) apps = getApps();
  else cache.put(CACHE_KEY_APPS, JSON.stringify(sortAppsByOrder_(apps)), CACHE_TTL_APPS_SEC);
  cache.remove(CACHE_KEY_INITIAL);
  cache.remove(CACHE_KEY_ADMIN);
  return apps;
}

function getAdminDashboardData() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEY_ADMIN);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }
  const logSheet = getSpreadsheet_().getSheetByName('Logs');
  const lastRow = Math.max(logSheet.getLastRow(), 1);
  const logs = logSheet.getRange(1, 1, lastRow, 4).getValues();
  logs.shift(); 
  const formattedLogs = logs.map(row => ({
    time: Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
    email: row[1], appName: row[3]
  })).reverse().slice(0, 50); 
  const payload = { logs: formattedLogs };
  cache.put(CACHE_KEY_ADMIN, JSON.stringify(payload), CACHE_TTL_ADMIN_SEC);
  return payload;
}

// ฟังก์ชันสำหรับลบโปรเจกต์
function deleteProject(projectId) {
  const sheet = getSpreadsheet_().getSheetByName('Apps');
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const data = sheet.getRange(1, 1, lastRow, 1).getValues();
  
  // วนลูปหา ID ที่ตรงกัน (เริ่มที่ i=1 เพื่อข้าม Header)
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == projectId) {
      sheet.deleteRow(i + 1); // ลบแถว (i+1 เพราะแถวใน Sheet เริ่มที่ 1)
      break;
    }
  }
  
  clearAppCache(); // ล้างคุกกี้เพื่อให้ข้อมูลอัปเดตทันที
  return getApps(); // ส่งรายการแอพใหม่กลับไปให้หน้าเว็บ
}

function warmupAppCache() {
  getInitialData();
  getAdminDashboardData();
  return { ok: true, warmedAt: new Date() };
}

function createWarmupTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'warmupAppCache'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('warmupAppCache').timeBased().everyMinutes(10).create();
  return { ok: true };
}