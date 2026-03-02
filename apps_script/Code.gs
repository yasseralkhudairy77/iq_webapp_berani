/**
 * Recruitment Test Suite - Google Apps Script Web App
 * Deploy as Web App, then set URL into frontend (berani_sheet_endpoint_v1).
 */

const CONFIG = {
  SPREADSHEET_ID: "PASTE_SPREADSHEET_ID_DI_SINI",
  STRICT_TOKEN: false,
  SHEET: {
    NO_TOKEN: "NO_TOKEN",
    IQ: "IQ",
    PAULI: "PAULI_KRAEPLIN",
    TYPING: "TYPING_TEST",
    DISC: "DISC",
    WORKING_STYLE: "WORKING_STYLE",
  },
  BLOCKED_STATUS: ["USED", "LOCKED", "CLOSED", "INVALID", "EXPIRED"],
};

function doGet() {
  return json_({
    status: "ok",
    service: "recruitment-test-suite-webapp",
    now: new Date().toISOString(),
  });
}

function doPost(e) {
  try {
    const req = parseRequest_(e);
    const action = lower_(req.action || "submit");

    if (action === "validate") return json_(handleValidate_(req));
    if (action === "submit") return json_(handleSubmit_(req));

    return json_({ status: "error", message: "Unknown action: " + action });
  } catch (err) {
    return json_({
      status: "error",
      message: err && err.message ? err.message : String(err),
    });
  }
}

function handleValidate_(req) {
  const token = normalizeToken_(req.token);
  if (!token) return { status: "ok", valid: false, message: "Token wajib diisi." };

  const ss = openSpreadsheet_();
  const ws = getSheet_(ss, CONFIG.SHEET.NO_TOKEN);
  const found = findRowByToken_(ws, token);

  if (!found) {
    if (CONFIG.STRICT_TOKEN) {
      return { status: "ok", valid: false, message: "Token tidak terdaftar." };
    }
    return {
      status: "ok",
      valid: true,
      token: token,
      message: "Token belum terdaftar, akan dibuat saat submit IQ.",
    };
  }

  const status = upper_(safeStr_(found.record.status));
  if (CONFIG.BLOCKED_STATUS.indexOf(status) >= 0) {
    return {
      status: "ok",
      valid: false,
      token: found.record.token || token,
      message: "Token tidak aktif: " + status,
      record: found.record,
    };
  }

  return {
    status: "ok",
    valid: true,
    token: found.record.token || token,
    record: found.record,
  };
}

function handleSubmit_(req) {
  const payload = req.payload || {};
  const moduleName = normalizeModule_(req.module || payload.module);
  const token = normalizeToken_(req.token || payload.token || payload.candidate && payload.candidate.token);
  if (!token) throw new Error("Token wajib diisi.");

  const ss = openSpreadsheet_();

  if (moduleName === "iq") return submitIQ_(ss, token, payload);
  if (moduleName === "pauli" || moduleName === "pauli_kraeplin") return submitPauli_(ss, token, payload);
  if (moduleName === "typing") return submitTyping_(ss, token, payload);
  if (moduleName === "disc") return submitDisc_(ss, token, payload);
  if (moduleName === "working_style") return submitWorkingStyle_(ss, token, payload);

  throw new Error("Module tidak dikenali: " + moduleName);
}

function submitIQ_(ss, token, p) {
  const noToken = getSheet_(ss, CONFIG.SHEET.NO_TOKEN);
  const iq = getSheet_(ss, CONFIG.SHEET.IQ);

  const name = safeStr_(p.name || p.nama);
  const phone = safeStr_(p.phone || p.nohp);
  const position = safeStr_(p.position || p.role);

  upsertNoToken_(noToken, {
    token: token,
    name: name,
    phone: phone,
    email: "",
    position: position,
    source: "IQ_TEST",
    createdAt: new Date(),
    status: "NEW",
  });

  appendByHeaders_(iq, {
    token: token,
    startedAt: parseDateOrRaw_(p.startedAt),
    endedAt: parseDateOrRaw_(p.endedAt),
    durationSec: toNum_(p.durationSec),
    correct: toNum_(p.correct),
    total: toNum_(p.total),
    percent: toNum_(p.percent),
    iqEstimate: toNum_(p.iqEstimate),
    iqCategory: safeStr_(p.iqCategory),
    scoreBand: safeStr_(p.scoreBand),
    answered: toNum_(p.answered),
    unanswered: toNum_(p.unanswered),
    flagged: toNum_(p.flagged || p.flaggedCount),
  });

  return { status: "ok", module: "iq", token: token };
}

function submitPauli_(ss, token, p) {
  const ws = getSheet_(ss, CONFIG.SHEET.PAULI);

  const totalAttempt = toNum_(p.total);
  const correct = toNum_(p.benar || p.correct);
  const wrong = toNum_(p.salah || p.wrong);
  const acc = toNum_(p.akurasi || p.accuracyPct);
  const speed = toNum_(p.speedAvg || p.speedPerMin);
  const durationSec = toNum_(p.durationSec) || (toNum_(p.durasiMenit) ? toNum_(p.durasiMenit) * 60 : "");
  const consistencyPct = p.consistencyPct !== undefined && p.consistencyPct !== null
    ? toNum_(p.consistencyPct)
    : estimateConsistencyPctFromSd_(toNum_(p.sd));
  const pauliScore = p.pauliScore !== undefined && p.pauliScore !== null
    ? toNum_(p.pauliScore)
    : calcPauliScore_(acc, speed, consistencyPct);
  const pauliCategory = safeStr_(p.pauliCategory) || scoreCategory_(pauliScore);

  appendByHeaders_(ws, {
    token: token,
    startedAt: parseDateOrRaw_(p.startedAt || p.submittedAt),
    endedAt: parseDateOrRaw_(p.endedAt || new Date().toISOString()),
    durationSec: durationSec,
    totalAttempt: totalAttempt,
    correct: correct,
    wrong: wrong,
    accuracyPct: acc,
    speedPerMin: speed,
    consistencyPct: consistencyPct,
    pauliScore: pauliScore,
    pauliCategory: pauliCategory,
  });

  return { status: "ok", module: "pauli_kraeplin", token: token };
}

function submitTyping_(ss, token, p) {
  const ws = getSheet_(ss, CONFIG.SHEET.TYPING);

  const durationSec = toNum_(p.durationSec) || (toNum_(p.durationMinutes) ? toNum_(p.durationMinutes) * 60 : "");
  const wordsTyped = toNum_(p.total || p.wordsTyped);
  const errors = toNum_(p.salah || p.errors);
  const grossWPM = toNum_(p.grossWPM || p.wpm);
  const netWPM = p.netWPM !== undefined && p.netWPM !== null ? toNum_(p.netWPM) : grossWPM;
  const accuracyPct = toNum_(p.akurasi || p.accuracyPct);
  const typingCategory = safeStr_(p.typingCategory) || typingCategory_(netWPM, accuracyPct);

  appendByHeaders_(ws, {
    token: token,
    startedAt: parseDateOrRaw_(p.startedAt || p.submittedAt),
    endedAt: parseDateOrRaw_(p.endedAt || new Date().toISOString()),
    durationSec: durationSec,
    wordsTyped: wordsTyped,
    errors: errors,
    grossWPM: grossWPM,
    netWPM: netWPM,
    accuracyPct: accuracyPct,
    typingCategory: typingCategory,
  });

  return { status: "ok", module: "typing", token: token };
}

function submitDisc_(ss, token, p) {
  const ws = getSheet_(ss, CONFIG.SHEET.DISC);

  const d = toNum_(p.norm_D || p.D_score);
  const i = toNum_(p.norm_I || p.I_score);
  const s = toNum_(p.norm_S || p.S_score);
  const c = toNum_(p.norm_C || p.C_score);
  const discType = safeStr_(p.primary || p.discType) || topLabel_({ D: d, I: i, S: s, C: c });
  const discSummary = safeStr_(p.discSummary) || discSummary_(discType);

  appendByHeaders_(ws, {
    token: token,
    D_score: d,
    I_score: i,
    S_score: s,
    C_score: c,
    discType: discType,
    discSummary: discSummary,
  });

  return { status: "ok", module: "disc", token: token };
}

function submitWorkingStyle_(ss, token, p) {
  const ws = getSheet_(ss, CONFIG.SHEET.WORKING_STYLE);
  const scores = p.scores_avg_1_to_5 || {};

  const analytical = toPctFromLikert5_(scores.analytical);
  const structured = toPctFromLikert5_(scores.structure);
  const collaborative = toPctFromLikert5_(scores.collaboration);
  const adaptive = toPctFromLikert5_(scores.adaptability);
  const dominantStyle = topLabel_({
    Analytical: analytical,
    Structured: structured,
    Collaborative: collaborative,
    Adaptive: adaptive,
  });
  const styleSummary = workingStyleSummary_(dominantStyle);

  appendByHeaders_(ws, {
    token: token,
    analytical: analytical,
    structured: structured,
    collaborative: collaborative,
    adaptive: adaptive,
    dominantStyle: dominantStyle,
    styleSummary: styleSummary,
  });

  return { status: "ok", module: "working_style", token: token };
}

function upsertNoToken_(sheet, data) {
  const found = findRowByToken_(sheet, data.token);
  const headers = readHeaders_(sheet);
  const row = headers.map(function (h) { return data[h] !== undefined ? data[h] : ""; });

  if (found) {
    const existing = sheet.getRange(found.row, 1, 1, headers.length).getValues()[0];
    const merged = headers.map(function (h, idx) {
      const incoming = data[h];
      if (incoming === undefined || incoming === null || incoming === "") return existing[idx];
      return incoming;
    });
    sheet.getRange(found.row, 1, 1, headers.length).setValues([merged]);
  } else {
    sheet.appendRow(row);
  }
}

function appendByHeaders_(sheet, mapObj) {
  const headers = readHeaders_(sheet);
  const row = headers.map(function (h) {
    return mapObj[h] !== undefined ? mapObj[h] : "";
  });
  sheet.appendRow(row);
}

function findRowByToken_(sheet, token) {
  const t = normalizeToken_(token);
  if (!t) return null;

  const headers = readHeaders_(sheet);
  const tokenIdx = headers.indexOf("token");
  if (tokenIdx < 0) throw new Error("Header 'token' tidak ditemukan di sheet: " + sheet.getName());

  const last = sheet.getLastRow();
  if (last < 2) return null;

  const values = sheet.getRange(2, tokenIdx + 1, last - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    const candidate = normalizeToken_(values[i][0]);
    if (candidate && candidate === t) {
      const rowNo = i + 2;
      const rowVals = sheet.getRange(rowNo, 1, 1, headers.length).getValues()[0];
      return { row: rowNo, record: rowToObject_(headers, rowVals) };
    }
  }
  return null;
}

function readHeaders_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) throw new Error("Header kosong di sheet: " + sheet.getName());
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (v) {
    return safeStr_(v).trim();
  });
}

function rowToObject_(headers, row) {
  const out = {};
  for (var i = 0; i < headers.length; i++) out[headers[i]] = row[i];
  return out;
}

function openSpreadsheet_() {
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID.indexOf("PASTE_") === 0) {
    throw new Error("Isi CONFIG.SPREADSHEET_ID dulu.");
  }
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getSheet_(ss, name) {
  const ws = ss.getSheetByName(name);
  if (!ws) throw new Error("Sheet tidak ditemukan: " + name);
  return ws;
}

function parseRequest_(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    const raw = safeStr_(e.postData.contents).trim();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new Error("Body JSON tidak valid.");
    }
  }
  return e.parameter || {};
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeModule_(v) {
  return lower_(safeStr_(v).replace(/[\s-]+/g, "_"));
}

function normalizeToken_(v) {
  return upper_(safeStr_(v).trim());
}

function parseDateOrRaw_(v) {
  if (!v) return "";
  if (Object.prototype.toString.call(v) === "[object Date]") return v;
  const d = new Date(v);
  if (isNaN(d.getTime())) return safeStr_(v);
  return d;
}

function toNum_(v) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return isNaN(n) ? "" : n;
}

function toPctFromLikert5_(v) {
  const n = Number(v);
  if (isNaN(n)) return "";
  return Math.round((Math.max(1, Math.min(5, n)) / 5) * 100);
}

function calcPauliScore_(accuracyPct, speedPerMin, consistencyPct) {
  const a = Number(accuracyPct) || 0;
  const s = Number(speedPerMin) || 0;
  const c = Number(consistencyPct) || 0;
  const speedScaled = Math.min(Math.max((s / 60) * 100, 0), 100);
  return round1_((a * 0.5) + (speedScaled * 0.3) + (c * 0.2));
}

function estimateConsistencyPctFromSd_(sd) {
  const x = Number(sd);
  if (!isFinite(x)) return "";
  return Math.max(0, Math.min(100, round1_(100 - (x * 10))));
}

function typingCategory_(netWPM, accuracyPct) {
  const w = Number(netWPM) || 0;
  const a = Number(accuracyPct) || 0;
  if (w >= 50 && a >= 95) return "Excellent";
  if (w >= 40 && a >= 92) return "Good";
  if (w >= 30 && a >= 88) return "Average";
  return "Needs Improvement";
}

function scoreCategory_(score) {
  const s = Number(score) || 0;
  if (s >= 85) return "Excellent";
  if (s >= 70) return "Good";
  if (s >= 55) return "Average";
  return "Needs Improvement";
}

function discSummary_(discType) {
  const t = safeStr_(discType).toUpperCase();
  if (t === "D") return "Direct, decisive, result-oriented";
  if (t === "I") return "Persuasive, social, expressive";
  if (t === "S") return "Stable, patient, supportive";
  if (t === "C") return "Careful, analytical, detail-oriented";
  return "";
}

function workingStyleSummary_(style) {
  const s = safeStr_(style);
  if (s === "Analytical") return "Strong in logic and problem solving";
  if (s === "Structured") return "Strong in planning and consistency";
  if (s === "Collaborative") return "Strong in teamwork and communication";
  if (s === "Adaptive") return "Strong in flexibility and speed";
  return "";
}

function topLabel_(obj) {
  var bestKey = "";
  var bestVal = -Infinity;
  Object.keys(obj || {}).forEach(function (k) {
    const v = Number(obj[k]);
    if (isNaN(v)) return;
    if (v > bestVal) {
      bestVal = v;
      bestKey = k;
    }
  });
  return bestKey;
}

function round1_(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

function safeStr_(v) {
  return v === null || v === undefined ? "" : String(v);
}

function lower_(v) {
  return safeStr_(v).toLowerCase();
}

function upper_(v) {
  return safeStr_(v).toUpperCase();
}
