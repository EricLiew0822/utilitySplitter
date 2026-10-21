/**
 * UtilitySplit — 4-Page Integrated House Utility Bill Calculator Engine
 * Syncs Calculator & Splitter, Bill History & Trends, Tenant & Room Directory, and Guide.
 */

const DEFAULT_STATE = {
  electricDate: "",
  waterStartDate: "",
  waterEndDate: "",
  electricAmount: "",
  prevBalance: "",
  totalKwh: "",
  waterAmount: "",
  rateMode: "ceil",
  manualRate: "",
  rooms: [
    { id: "room_1", name: "", prevMeter: "", currMeter: "", tenants: [""] }
  ],
  tenantMeta: {}
};

const SAMPLE_REFERENCE_STATE = {
  electricDate: "2026-08-12",
  waterStartDate: "2026-05-01",
  waterEndDate: "2026-07-31",
  electricAmount: 157.15,
  prevBalance: 2.42,
  totalKwh: 477.0,
  waterAmount: 7.0,
  rateMode: "ceil",
  manualRate: 0.33,
  rooms: [
    { id: "room_1", name: "Master", prevMeter: 5574, currMeter: 5774, tenants: ["Bryan", "Lim"] },
    { id: "room_2", name: "Middle", prevMeter: 4693, currMeter: 4693, tenants: ["Eric"] },
    { id: "room_3", name: "Small", prevMeter: 4255, currMeter: 4312, tenants: ["Honger"] }
  ],
  tenantMeta: {
    "Bryan": { phone: "+60 12-491 8820", method: "DuitNow QR", paid: true },
    "Lim": { phone: "+60 16-832 9401", method: "Maybank Instant", paid: true },
    "Eric": { phone: "+60 17-219 0455", method: "Touch 'n Go eWallet", paid: false },
    "Honger": { phone: "+60 19-332 5012", method: "DuitNow QR", paid: true }
  }
};

const STORAGE_KEY = "utility_calculator_user_data";
const HISTORY_KEY = "utility_calculator_bill_history";

let appState = normalizeState(loadSavedState() || JSON.parse(JSON.stringify(SAMPLE_REFERENCE_STATE)));
let billHistory = loadBillHistory();
let historyChartInstance = null;
let latestFormattedReport = "";
let latestSummaryMetrics = null;

// --- DOM Elements ---
const elElectricDate = document.getElementById("electricDate");
const elWaterStartDate = document.getElementById("waterStartDate");
const elWaterEndDate = document.getElementById("waterEndDate");
const elElectricAmount = document.getElementById("electricAmount");
const elPrevBalance = document.getElementById("prevBalance");
const elTotalKwh = document.getElementById("totalKwh");
const elWaterAmount = document.getElementById("waterAmount");
const elRateMode = document.getElementById("rateMode");
const elManualRate = document.getElementById("manualRate");
const elManualRateGroup = document.getElementById("manualRateGroup");
const elRoomsContainer = document.getElementById("roomsContainer");

// Action Buttons
const elBtnAddRoom = document.getElementById("btnAddRoom");
const elBtnResetAll = document.getElementById("btnResetAll");
const elBtnLoadSample = document.getElementById("btnLoadSample");
const elBtnRollForward = document.getElementById("btnRollForward");
const elBtnHeaderSample = document.getElementById("btnHeaderSample");
const elBtnHeaderPdf = document.getElementById("btnHeaderPdf");
const elBtnHeaderRollForward = document.getElementById("btnHeaderRollForward");
const elBtnCopyReport = document.getElementById("btnCopyReport");
const elBtnShareWa = document.getElementById("btnShareWa");
const elBtnOpenPdf = document.getElementById("btnOpenPdf");
const elBtnDownloadImg = document.getElementById("btnDownloadImg");
const elBtnSaveHistory = document.getElementById("btnSaveHistory");
const elPdfPreviewWrapper = document.getElementById("pdfPreviewWrapper");

// Display Elements (Page 1)
const elDispCycleHeader = document.getElementById("dispCycleHeader");
const elDispHeaderOccupancyPill = document.getElementById("dispHeaderOccupancyPill");
const elKpiElectricRm = document.getElementById("kpiElectricRm");
const elKpiElectricKwh = document.getElementById("kpiElectricKwh");
const elKpiWaterRm = document.getElementById("kpiWaterRm");
const elKpiWaterPerPax = document.getElementById("kpiWaterPerPax");
const elKpiPrevCarry = document.getElementById("kpiPrevCarry");
const elDispNetElectric = document.getElementById("dispNetElectric");
const elDispUnitRate = document.getElementById("dispUnitRate");
const elKpiRateModeLabel = document.getElementById("kpiRateModeLabel");
const elKpiNextSurplus = document.getElementById("kpiNextSurplus");
const elBannerRateText = document.getElementById("bannerRateText");
const elDispCommonKwh = document.getElementById("dispCommonKwh");
const elDispCommonPerPerson = document.getElementById("dispCommonPerPerson");
const elDispWaterPerPerson = document.getElementById("dispWaterPerPerson");
const elDispTotalTenants = document.getElementById("dispTotalTenants");
const elTenantTableBody = document.getElementById("tenantTableBody");
const elDispCollected = document.getElementById("dispCollected");
const elDispActual = document.getElementById("dispActual");
const elDispBalance = document.getElementById("dispBalance");
const elWaLivePreviewBox = document.getElementById("waLivePreviewBox");

// Residual Allocation Bar Elements
const elDispResidualHeader = document.getElementById("dispResidualHeader");
const elGridAllocationBar = document.getElementById("gridAllocationBar");
const elGridAllocationLegend = document.getElementById("gridAllocationLegend");
const elDispResidualFormula = document.getElementById("dispResidualFormula");

// Mini PDF Preview Elements
const elMiniDocPeriod = document.getElementById("miniDocPeriod");
const elMiniDocRate = document.getElementById("miniDocRate");
const elMiniDocGrid = document.getElementById("miniDocGrid");
const elMiniDocWater = document.getElementById("miniDocWater");
const elMiniDocBalance = document.getElementById("miniDocBalance");
const elMiniTenantRows = document.getElementById("miniTenantRows");

// Toast
const elToast = document.getElementById("toast");

// --- Initialization ---
function init() {
  initNavigation();
  bindFormInputs();
  renderRooms();
  attachEventListeners();
  recalculate();
  initGuideSimulator();
}

function normalizeState(state) {
  if (!state || typeof state !== "object") {
    return JSON.parse(JSON.stringify(SAMPLE_REFERENCE_STATE));
  }
  if (!Array.isArray(state.rooms) || state.rooms.length === 0) {
    state.rooms = [{ id: "room_1", name: "", prevMeter: "", currMeter: "", tenants: [""] }];
  } else {
    state.rooms.forEach(r => {
      if (typeof r.tenants === "string") {
        r.tenants = r.tenants.split(",").map(t => t.trim());
      } else if (Array.isArray(r.tenants)) {
        r.tenants = r.tenants.map(t => (typeof t === "object" && t !== null ? (t.name || "") : String(t || "")));
      } else {
        r.tenants = [""];
      }
      if (r.tenants.length === 0) r.tenants = [""];
    });
  }
  if (!state.tenantMeta || typeof state.tenantMeta !== "object") {
    state.tenantMeta = {};
  }
  return state;
}

function getTenantMeta(name) {
  const key = (name || "").trim();
  if (!key) return { phone: "+60 12-000 0000", method: "DuitNow QR", paid: false };
  if (!appState.tenantMeta[key]) {
    appState.tenantMeta[key] = {
      phone: "+60 12-345 6789",
      method: "DuitNow QR",
      paid: false
    };
  }
  return appState.tenantMeta[key];
}

// --- 4-Page SPA Navigation ---
function initNavigation() {
  const navBtns = document.querySelectorAll("[data-nav]");
  navBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const target = btn.getAttribute("data-nav");
      switchPage(target);
    });
  });
}

function switchPage(pageKey) {
  const pages = ["calculator", "history", "directory", "guide"];
  pages.forEach(p => {
    const view = document.getElementById(`view-${p}`);
    if (view) {
      if (p === pageKey) {
        view.classList.remove("hidden");
      } else {
        view.classList.add("hidden");
      }
    }
  });

  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    const navTarget = btn.getAttribute("data-nav");
    if (navTarget === pageKey) {
      btn.classList.add("active", "text-primary");
      btn.classList.remove("text-on-surface-variant");
    } else {
      btn.classList.remove("active", "text-primary");
      btn.classList.add("text-on-surface-variant");
    }
  });

  if (pageKey === "history") {
    renderHistoryPage();
  } else if (pageKey === "directory") {
    renderDirectoryPage();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- Form Binding & Listeners ---
function bindFormInputs() {
  if (elElectricDate) elElectricDate.value = appState.electricDate || "";
  if (elWaterStartDate) elWaterStartDate.value = appState.waterStartDate || "";
  if (elWaterEndDate) elWaterEndDate.value = appState.waterEndDate || "";
  elElectricAmount.value = (appState.electricAmount !== null && appState.electricAmount !== undefined) ? appState.electricAmount : "";
  elPrevBalance.value = (appState.prevBalance !== null && appState.prevBalance !== undefined) ? appState.prevBalance : "";
  elTotalKwh.value = (appState.totalKwh !== null && appState.totalKwh !== undefined) ? appState.totalKwh : "";
  elWaterAmount.value = (appState.waterAmount !== null && appState.waterAmount !== undefined) ? appState.waterAmount : "";
  elRateMode.value = appState.rateMode || "ceil";
  elManualRate.value = (appState.manualRate !== null && appState.manualRate !== undefined) ? appState.manualRate : "";
  syncStrategyButtons(appState.rateMode || "ceil");
}

function syncStrategyButtons(mode) {
  document.querySelectorAll(".strategy-btn").forEach(btn => {
    const s = btn.getAttribute("data-strategy");
    if (s === mode) {
      btn.classList.add("bg-primary", "text-white", "shadow-sm");
      btn.classList.remove("bg-white", "text-on-surface-variant");
    } else {
      btn.classList.remove("bg-primary", "text-white", "shadow-sm");
      btn.classList.add("bg-white", "text-on-surface-variant");
    }
  });
  if (mode === "manual") {
    elManualRateGroup.classList.remove("hidden");
  } else {
    elManualRateGroup.classList.add("hidden");
  }
}

function attachEventListeners() {
  const inputs = [
    elElectricDate, elWaterStartDate, elWaterEndDate,
    elElectricAmount, elPrevBalance, elTotalKwh, elWaterAmount, elManualRate
  ];

  inputs.forEach(input => {
    if (input) {
      input.addEventListener("input", () => {
        saveInputState();
        recalculate();
      });
      input.addEventListener("change", () => {
        saveInputState();
        recalculate();
      });
    }
  });

  document.querySelectorAll(".strategy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const strategy = btn.getAttribute("data-strategy");
      elRateMode.value = strategy;
      syncStrategyButtons(strategy);
      saveInputState();
      recalculate();
    });
  });

  if (elBtnAddRoom) {
    elBtnAddRoom.addEventListener("click", addNewRoom);
  }

  const btnDirAddRoom = document.getElementById("btnDirAddRoom");
  if (btnDirAddRoom) {
    btnDirAddRoom.addEventListener("click", () => {
      addNewRoom();
      switchPage("calculator");
      showToast("Added new room! Configure its meter readings here.");
    });
  }

  const btnDirGoCalc = document.getElementById("btnDirGoCalc");
  if (btnDirGoCalc) {
    btnDirGoCalc.addEventListener("click", () => switchPage("calculator"));
  }

  const btnDirBroadcastWa = document.getElementById("btnDirBroadcastWa");
  if (btnDirBroadcastWa) {
    btnDirBroadcastWa.addEventListener("click", shareViaWhatsApp);
  }

  if (elBtnResetAll) elBtnResetAll.addEventListener("click", resetAllInputs);

  const loadSampleHandler = () => {
    appState = normalizeState(JSON.parse(JSON.stringify(SAMPLE_REFERENCE_STATE)));
    bindFormInputs();
    renderRooms();
    saveInputState();
    recalculate();
    showToast("Loaded sample bill data!");
  };
  if (elBtnLoadSample) elBtnLoadSample.addEventListener("click", loadSampleHandler);
  if (elBtnHeaderSample) elBtnHeaderSample.addEventListener("click", loadSampleHandler);

  if (elBtnRollForward) elBtnRollForward.addEventListener("click", rollForwardNextMonth);
  if (elBtnHeaderRollForward) elBtnHeaderRollForward.addEventListener("click", rollForwardNextMonth);

  if (elBtnCopyReport) elBtnCopyReport.addEventListener("click", copyReportToClipboard);
  if (elBtnShareWa) elBtnShareWa.addEventListener("click", shareViaWhatsApp);
  if (elBtnDownloadImg) elBtnDownloadImg.addEventListener("click", downloadBreakdownImage);

  const openPdfHandler = () => {
    saveInputState();
    window.open("invoice.html", "_blank");
  };
  if (elBtnOpenPdf) elBtnOpenPdf.addEventListener("click", openPdfHandler);
  if (elBtnHeaderPdf) elBtnHeaderPdf.addEventListener("click", openPdfHandler);
  if (elPdfPreviewWrapper) elPdfPreviewWrapper.addEventListener("click", openPdfHandler);

  const saveHistHandler = () => {
    saveCurrentBillToHistory();
    showToast("Saved current statement to Bill History!");
  };
  if (elBtnSaveHistory) elBtnSaveHistory.addEventListener("click", saveHistHandler);
  const btnSaveCurrentFromHistory = document.getElementById("btnSaveCurrentFromHistory");
  if (btnSaveCurrentFromHistory) btnSaveCurrentFromHistory.addEventListener("click", saveHistHandler);

  // History Page Listeners
  const btnExportJson = document.getElementById("btnExportHistoryJson");
  if (btnExportJson) btnExportJson.addEventListener("click", exportHistoryToJson);

  const btnImportJson = document.getElementById("btnImportHistoryJson");
  const inputImportFile = document.getElementById("inputImportHistoryFile");
  if (btnImportJson && inputImportFile) {
    btnImportJson.addEventListener("click", () => inputImportFile.click());
    inputImportFile.addEventListener("change", importHistoryFromJson);
  }

  const btnClearHistory = document.getElementById("btnClearHistory");
  if (btnClearHistory) {
    btnClearHistory.addEventListener("click", () => {
      if (confirm("Are you sure you want to clear all saved bill history?")) {
        billHistory = [];
        localStorage.setItem(HISTORY_KEY, JSON.stringify(billHistory));
        renderHistoryPage();
        updateHistoryBadge();
        showToast("Cleared all saved bill history.");
      }
    });
  }

  const historySearchInput = document.getElementById("historySearchInput");
  if (historySearchInput) {
    historySearchInput.addEventListener("input", () => renderHistoryPage());
  }

  const btnPrintCharter = document.getElementById("btnPrintCharter");
  if (btnPrintCharter) {
    btnPrintCharter.addEventListener("click", () => window.print());
  }
}

function addNewRoom() {
  const newId = "room_" + Date.now();
  appState.rooms.push({
    id: newId,
    name: "",
    prevMeter: "",
    currMeter: "",
    tenants: [""]
  });
  renderRooms();
  saveInputState();
  recalculate();
}

function resetAllInputs() {
  if (confirm("Are you sure you want to reset all input values to blank?")) {
    appState = normalizeState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    bindFormInputs();
    renderRooms();
    recalculate();
    showToast("All input values have been reset to blank.");
  }
}

function saveInputState() {
  appState.electricDate = elElectricDate ? elElectricDate.value : "";
  appState.waterStartDate = elWaterStartDate ? elWaterStartDate.value : "";
  appState.waterEndDate = elWaterEndDate ? elWaterEndDate.value : "";
  appState.electricAmount = elElectricAmount.value !== "" ? parseFloat(elElectricAmount.value) : "";
  appState.prevBalance = elPrevBalance.value !== "" ? parseFloat(elPrevBalance.value) : "";
  appState.totalKwh = elTotalKwh.value !== "" ? parseFloat(elTotalKwh.value) : "";
  appState.waterAmount = elWaterAmount.value !== "" ? parseFloat(elWaterAmount.value) : "";
  appState.rateMode = elRateMode.value;
  appState.manualRate = elManualRate.value !== "" ? parseFloat(elManualRate.value) : "";

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.warn("Could not persist state:", e);
  }
}

function loadSavedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

// --- Room Rendering (Page 1) ---
function renderRooms() {
  elRoomsContainer.innerHTML = "";
  const sampleNames = ["Master", "Middle", "Small", "Studio", "Room 5"];
  const sampleTenants = ["Bryan", "Lim", "Eric", "Honger", "Alex"];

  appState.rooms.forEach((room, roomIndex) => {
    const roomEl = document.createElement("div");
    roomEl.className = "p-4 rounded-xl bg-surface-container-low border border-outline-variant space-y-3 transition-all";

    const prevVal = parseFloat(room.prevMeter) || 0;
    const currVal = parseFloat(room.currMeter) || 0;
    const kwhUsed = Math.max(0, currVal - prevVal);

    const tenantInputsHtml = room.tenants.map((tName, tIndex) => {
      const placeholderTenant = sampleTenants[tIndex % sampleTenants.length] || `Tenant ${tIndex + 1}`;
      return `
        <div class="flex items-center gap-1.5 tenant-input-row" data-tindex="${tIndex}">
          <div class="relative flex-1">
            <span class="material-symbols-outlined text-[16px] text-on-surface-variant absolute left-2.5 top-2">person</span>
            <input type="text" class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-outline-variant text-xs font-medium tenant-name-input focus:outline-none focus:ring-2 focus:ring-primary" value="${escapeHtml(tName || '')}" placeholder="e.g. ${placeholderTenant}" />
          </div>
          ${room.tenants.length > 1 ? `<button type="button" class="px-2 py-1.5 rounded-lg bg-white border border-error-container text-error hover:bg-error-container text-xs btn-remove-tenant" title="Remove Tenant"><span class="material-symbols-outlined text-[16px]">close</span></button>` : ''}
        </div>
      `;
    }).join("");

    const placeholderRoomName = sampleNames[roomIndex % sampleNames.length] || `Room ${roomIndex + 1}`;

    roomEl.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 flex-1">
          <div class="w-7 h-7 rounded-lg bg-primary text-white font-mono font-bold text-xs flex items-center justify-center">${roomIndex + 1}</div>
          <input type="text" class="px-2.5 py-1 rounded-lg bg-white border border-outline-variant font-headline font-bold text-sm text-primary-dark room-name-input w-48 focus:outline-none focus:ring-2 focus:ring-primary" value="${escapeHtml(room.name || '')}" placeholder="e.g. ${placeholderRoomName}" data-field="name" />
        </div>
        ${appState.rooms.length > 1 ? `<button type="button" class="p-1.5 rounded-lg bg-white border border-error-container text-error hover:bg-error-container btn-remove-room" title="Remove Room"><span class="material-symbols-outlined text-[16px]">delete</span></button>` : ''}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label class="block text-[11px] font-semibold text-on-surface-variant mb-1">Previous Meter (kWh)</label>
          <input type="number" step="1" class="w-full px-3 py-1.5 rounded-lg bg-white border border-outline-variant font-mono text-xs font-semibold room-meter-input" value="${(room.prevMeter !== '' && room.prevMeter !== null && room.prevMeter !== undefined) ? room.prevMeter : ''}" placeholder="0" data-field="prevMeter" />
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-on-surface-variant mb-1">Current Meter (kWh)</label>
          <input type="number" step="1" class="w-full px-3 py-1.5 rounded-lg bg-white border border-outline-variant font-mono text-xs font-bold text-primary room-meter-input" value="${(room.currMeter !== '' && room.currMeter !== null && room.currMeter !== undefined) ? room.currMeter : ''}" placeholder="0" data-field="currMeter" />
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-on-surface-variant mb-1">Net Room AC Usage</label>
          <div class="px-3 py-1.5 rounded-lg bg-primary-fixed border border-outline-variant font-mono text-xs font-bold text-primary-dark text-center room-kwh-badge">${kwhUsed.toFixed(0)} kWh</div>
        </div>
      </div>

      <div class="pt-2 border-t border-outline-variant">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[11px] font-semibold text-on-surface-variant">Room Occupants (${room.tenants.length}):</span>
          <button type="button" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-outline-variant text-primary font-bold text-[11px] hover:bg-primary-fixed btn-add-tenant">
            <span class="material-symbols-outlined text-[14px]">person_add</span> Add Tenant
          </button>
        </div>
        <div class="flex flex-col gap-2">
          ${tenantInputsHtml}
        </div>
      </div>
    `;

    // Bind Room Inputs
    roomEl.querySelectorAll(".room-meter-input, .room-name-input").forEach(input => {
      input.addEventListener("input", (e) => {
        const field = e.target.dataset.field;
        const val = e.target.value;
        if (field === "prevMeter" || field === "currMeter") {
          room[field] = val !== "" ? parseFloat(val) : "";
          const badge = roomEl.querySelector(".room-kwh-badge");
          const p = parseFloat(room.prevMeter) || 0;
          const c = parseFloat(room.currMeter) || 0;
          if (badge) badge.textContent = `${Math.max(0, c - p).toFixed(0)} kWh`;
        } else {
          room[field] = val;
        }
        saveInputState();
        recalculate();
      });
    });

    const removeRoomBtn = roomEl.querySelector(".btn-remove-room");
    if (removeRoomBtn) {
      removeRoomBtn.addEventListener("click", () => {
        appState.rooms.splice(roomIndex, 1);
        renderRooms();
        saveInputState();
        recalculate();
      });
    }

    roomEl.querySelector(".btn-add-tenant").addEventListener("click", () => {
      room.tenants.push("");
      renderRooms();
      saveInputState();
      recalculate();
    });

    roomEl.querySelectorAll(".tenant-input-row").forEach(row => {
      const tIdx = parseInt(row.dataset.tindex, 10);
      row.querySelector(".tenant-name-input").addEventListener("input", (e) => {
        room.tenants[tIdx] = e.target.value;
        saveInputState();
        recalculate();
      });
      const remBtn = row.querySelector(".btn-remove-tenant");
      if (remBtn) {
        remBtn.addEventListener("click", () => {
          room.tenants.splice(tIdx, 1);
          renderRooms();
          saveInputState();
          recalculate();
        });
      }
    });

    elRoomsContainer.appendChild(roomEl);
  });
}

// --- Core Calculation Engine ---
function recalculate() {
  const electricAmount = parseFloat(elElectricAmount.value) || 0;
  const prevBalance = parseFloat(elPrevBalance.value) || 0;
  const totalKwh = parseFloat(elTotalKwh.value) || 0;
  const waterAmount = parseFloat(elWaterAmount.value) || 0;
  const rateMode = elRateMode.value || "ceil";
  const manualRate = parseFloat(elManualRate.value) || 0;

  // 1. Effective Unit Rate
  const netElectric = Math.max(0, electricAmount - prevBalance);
  const rawRate = totalKwh > 0 ? netElectric / totalKwh : 0;

  let unitRate = 0;
  if (rateMode === "manual") {
    unitRate = manualRate;
  } else if (rateMode === "exact") {
    unitRate = rawRate;
  } else {
    unitRate = Math.ceil(rawRate * 100) / 100;
  }

  // 2. Parse Rooms & Tenants
  let totalHeadcount = 0;
  let totalRoomKwh = 0;
  const roomCalculations = [];

  appState.rooms.forEach((r, idx) => {
    const p = (r.prevMeter !== "" && r.prevMeter !== null && r.prevMeter !== undefined) ? parseFloat(r.prevMeter) : 0;
    const c = (r.currMeter !== "" && r.currMeter !== null && r.currMeter !== undefined) ? parseFloat(r.currMeter) : 0;
    const kwh = Math.max(0, c - p);
    totalRoomKwh += kwh;

    const validTenants = Array.isArray(r.tenants)
      ? r.tenants.map(t => String(t || "").trim()).filter(Boolean)
      : [];
    const tenantCount = validTenants.length > 0 ? validTenants.length : 1;
    totalHeadcount += validTenants.length;

    const roomCost = kwh * unitRate;
    const perTenantAc = tenantCount > 0 ? roomCost / tenantCount : 0;

    roomCalculations.push({
      id: r.id,
      name: (r.name && r.name.trim()) ? r.name.trim() : `Room ${idx + 1}`,
      prevMeter: p,
      currMeter: c,
      kwh,
      roomCost,
      tenantCount,
      tenants: validTenants.length > 0 ? validTenants : ["(No Tenant)"],
      perTenantAc
    });
  });

  if (totalHeadcount === 0) totalHeadcount = 1;

  // 3. Common Area & Water Equal Split
  const commonKwh = Math.max(0, totalKwh - totalRoomKwh);
  const commonCostPerPerson = totalHeadcount > 0 ? (commonKwh * unitRate) / totalHeadcount : 0;
  const waterCostPerPerson = totalHeadcount > 0 ? waterAmount / totalHeadcount : 0;

  const tenantRows = [];
  roomCalculations.forEach(r => {
    r.tenants.forEach(tName => {
      const common = commonCostPerPerson;
      const roomAc = r.perTenantAc;
      const water = waterCostPerPerson;
      const total = common + roomAc + water;
      const meta = getTenantMeta(tName);

      tenantRows.push({
        tenant: tName,
        room: r.name,
        roomPax: r.tenants.length,
        roomKwhShare: r.kwh / r.tenants.length,
        common,
        roomAc,
        water,
        total,
        paid: !!meta.paid
      });
    });
  });

  const totalCollected = tenantRows.reduce((sum, t) => sum + round2(t.total), 0);
  const actualPayable = electricAmount + waterAmount;
  const nextMonthBalance = Math.max(0, totalCollected - actualPayable);

  const electricFormattedDate = formatElectricDate(elElectricDate ? elElectricDate.value : "");
  const waterFormattedPeriod = formatWaterPeriod(
    elWaterStartDate ? elWaterStartDate.value : "",
    elWaterEndDate ? elWaterEndDate.value : ""
  );

  // 4. Update Top KPIs & Page 1 Displays
  const rateDecimals = rateMode === "exact" ? 4 : 2;
  if (elDispCycleHeader) elDispCycleHeader.textContent = `Billing Cycle: ${electricFormattedDate}`;
  if (elDispHeaderOccupancyPill) elDispHeaderOccupancyPill.innerHTML = `<span class="material-symbols-outlined text-[15px] text-primary">home</span> ${roomCalculations.length} Rooms • ${totalHeadcount} Occupants`;

  if (elKpiElectricRm) elKpiElectricRm.textContent = `RM ${electricAmount.toFixed(2)}`;
  if (elKpiElectricKwh) elKpiElectricKwh.textContent = `${totalKwh.toFixed(0)} kWh`;
  if (elKpiWaterRm) elKpiWaterRm.textContent = `RM ${waterAmount.toFixed(2)}`;
  if (elKpiWaterPerPax) elKpiWaterPerPax.textContent = `${totalHeadcount} Pax • RM ${round2(waterCostPerPerson).toFixed(2)} / pax`;
  if (elKpiPrevCarry) elKpiPrevCarry.textContent = `-RM ${prevBalance.toFixed(2)}`;
  if (elDispNetElectric) elDispNetElectric.textContent = `Net: RM ${netElectric.toFixed(2)} (raw: ${rawRate.toFixed(4)})`;
  if (elDispUnitRate) elDispUnitRate.textContent = `RM ${unitRate.toFixed(rateDecimals)}/kWh`;
  if (elKpiRateModeLabel) {
    elKpiRateModeLabel.textContent = rateMode === "manual" ? "Manual Fixed Rate" : (rateMode === "exact" ? "Exact Decimal Rate" : "Ceil / Round Up Active");
  }
  if (elKpiNextSurplus) elKpiNextSurplus.textContent = `+RM ${nextMonthBalance.toFixed(2)}`;

  if (elBannerRateText) elBannerRateText.textContent = `Rate: RM ${unitRate.toFixed(rateDecimals)}/kWh`;
  if (elDispCommonKwh) elDispCommonKwh.textContent = `Common: ${commonKwh.toFixed(0)} kWh / ${totalHeadcount} pax`;
  if (elDispCommonPerPerson) elDispCommonPerPerson.textContent = `RM ${round2(commonCostPerPerson).toFixed(2)}`;
  if (elDispWaterPerPerson) elDispWaterPerPerson.textContent = `RM ${round2(waterCostPerPerson).toFixed(2)}`;
  if (elDispTotalTenants) elDispTotalTenants.textContent = `${totalHeadcount} Active Residents`;

  // Render Sub-Meter vs Common Residual Bar
  renderResidualAllocationBar(roomCalculations, commonKwh, totalKwh, totalHeadcount);

  // Render Settlement Table Rows with Interactive Paid/Unpaid Status
  elTenantTableBody.innerHTML = "";
  tenantRows.forEach(t => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-surface-container-low/50 transition-colors";
    const statusBadge = t.paid
      ? `<button type="button" class="toggle-paid-btn px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-mono text-[11px] font-bold" data-tenant="${escapeHtml(t.tenant)}">Paid ✓</button>`
      : `<button type="button" class="toggle-paid-btn px-2.5 py-0.5 rounded-full bg-surface-container-highest text-primary-dark font-mono text-[11px] font-semibold" data-tenant="${escapeHtml(t.tenant)}">Unpaid</button>`;

    tr.innerHTML = `
      <td class="py-3 px-3 font-bold text-primary-dark">${escapeHtml(t.tenant)}</td>
      <td class="py-3 px-2 text-center"><span class="px-2 py-0.5 rounded bg-surface-container-low border border-outline-variant text-[11px] font-semibold">${escapeHtml(t.room)}</span></td>
      <td class="py-3 px-2 text-right font-mono">RM ${round2(t.common).toFixed(2)}</td>
      <td class="py-3 px-2 text-right font-mono text-primary font-semibold">RM ${round2(t.roomAc).toFixed(2)}</td>
      <td class="py-3 px-2 text-right font-mono text-secondary">RM ${round2(t.water).toFixed(2)}</td>
      <td class="py-3 px-3 text-right"><span class="font-mono font-extrabold px-2.5 py-1 rounded bg-amber-100 text-amber-900 border border-amber-300">RM ${round2(t.total).toFixed(2)}</span></td>
      <td class="py-3 px-2 text-center">${statusBadge}</td>
    `;
    elTenantTableBody.appendChild(tr);
  });

  elTenantTableBody.querySelectorAll(".toggle-paid-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tName = btn.getAttribute("data-tenant");
      const meta = getTenantMeta(tName);
      meta.paid = !meta.paid;
      saveInputState();
      recalculate();
    });
  });

  elDispCollected.textContent = `RM ${totalCollected.toFixed(2)}`;
  elDispActual.textContent = `RM ${actualPayable.toFixed(2)}`;
  elDispBalance.textContent = `RM ${nextMonthBalance.toFixed(2)}`;

  // Update Miniature PDF Preview
  if (elMiniDocPeriod) elMiniDocPeriod.textContent = electricFormattedDate;
  if (elMiniDocRate) elMiniDocRate.textContent = `RM ${unitRate.toFixed(rateDecimals)}/kWh`;
  if (elMiniDocGrid) elMiniDocGrid.textContent = `${totalKwh.toFixed(0)} kWh`;
  if (elMiniDocWater) elMiniDocWater.textContent = `RM ${round2(waterCostPerPerson).toFixed(2)}/pax`;
  if (elMiniDocBalance) elMiniDocBalance.textContent = `RM ${nextMonthBalance.toFixed(2)}`;

  if (elMiniTenantRows) {
    elMiniTenantRows.innerHTML = "";
    tenantRows.forEach(t => {
      const row = document.createElement("div");
      row.className = "flex justify-between py-1.5 px-2 text-xs";
      row.innerHTML = `
        <span class="font-semibold text-on-surface w-1/2">${escapeHtml(t.tenant)}</span>
        <span class="text-on-surface-variant w-1/4">${escapeHtml(t.room)}</span>
        <span class="font-mono font-bold text-primary w-1/4 text-right">RM ${round2(t.total).toFixed(2)}</span>
      `;
      elMiniTenantRows.appendChild(row);
    });
  }

  latestSummaryMetrics = {
    electricPeriod: electricFormattedDate,
    waterPeriod: waterFormattedPeriod,
    electricAmount,
    prevBalance,
    totalKwh,
    waterAmount,
    unitRate,
    rawRate,
    commonKwh,
    commonCostPerPerson,
    waterCostPerPerson,
    totalHeadcount,
    roomCalculations,
    tenantRows,
    totalCollected,
    actualPayable,
    nextMonthBalance
  };

  generateFormattedReport(latestSummaryMetrics);
  if (elWaLivePreviewBox) elWaLivePreviewBox.textContent = latestFormattedReport;
  updateHistoryBadge();
}

function renderResidualAllocationBar(roomCalculations, commonKwh, totalKwh, totalHeadcount) {
  if (!elGridAllocationBar || !elGridAllocationLegend) return;
  const colors = ["#0d47a1", "#1976d2", "#42a5f5", "#64b5f6", "#008378"];
  const safeTotal = totalKwh > 0 ? totalKwh : 1;
  const roomSum = roomCalculations.reduce((s, r) => s + r.kwh, 0);

  if (elDispResidualHeader) elDispResidualHeader.textContent = `${commonKwh.toFixed(0)} kWh Unmetered Common`;
  if (elDispResidualFormula) {
    elDispResidualFormula.textContent = `Residual formula: ${totalKwh.toFixed(0)} kWh (Main Grid) − ${roomSum.toFixed(0)} kWh (Total AC Sub-meters) = ${commonKwh.toFixed(0)} kWh shared equally across ${totalHeadcount} tenants.`;
  }

  let barsHtml = "";
  let legendHtml = "";

  roomCalculations.forEach((r, idx) => {
    const pct = Math.min(100, Math.max(0, (r.kwh / safeTotal) * 100));
    const color = colors[idx % colors.length];
    barsHtml += `<div class="h-full transition-all duration-300" style="width: ${pct.toFixed(1)}%; background-color: ${color};" title="${escapeHtml(r.name)} (${r.kwh.toFixed(0)} kWh)"></div>`;
    legendHtml += `<span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full inline-block" style="background-color: ${color};"></span>${escapeHtml(r.name)} (${r.kwh.toFixed(0)} kWh)</span>`;
  });

  const commonPct = Math.min(100, Math.max(0, (commonKwh / safeTotal) * 100));
  barsHtml += `<div class="h-full transition-all duration-300" style="width: ${commonPct.toFixed(1)}%; background-color: #bbdefb;" title="Common Area (${commonKwh.toFixed(0)} kWh)"></div>`;
  legendHtml += `<span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full inline-block" style="background-color: #90caf9;"></span>Common Area (${commonKwh.toFixed(0)} kWh)</span>`;

  elGridAllocationBar.innerHTML = barsHtml;
  elGridAllocationLegend.innerHTML = legendHtml;
}

function generateFormattedReport(data) {
  const roomKwhString = data.roomCalculations.map(r => `${r.kwh.toFixed(0)}`).join(" – ");

  const lines = [
    `*Electric Bill ${data.electricPeriod}*`,
    `(RM (${data.electricAmount.toFixed(2)} - ${data.prevBalance.toFixed(2)}) / ${data.totalKwh.toFixed(0)} kWh) = ${data.rawRate.toFixed(4)} ≈ RM ${data.unitRate.toFixed(2)} per kWh\n`,
    `*Common Usage (${data.totalKwh.toFixed(0)} – ${roomKwhString} = ${data.commonKwh.toFixed(0)} kWh)*`,
    `(${data.commonKwh.toFixed(0)} kWh × RM${data.unitRate.toFixed(2)}) / ${data.totalHeadcount} = *RM ${round2(data.commonCostPerPerson).toFixed(2)}*\n`,
    `*Water Bill for ${data.waterPeriod}*`,
    `RM (${data.waterAmount.toFixed(2)} / ${data.totalHeadcount}) = *RM ${round2(data.waterCostPerPerson).toFixed(2)}*\n`
  ];

  data.roomCalculations.forEach(r => {
    lines.push(`------*${r.name}*------`);
    lines.push(`AC Usage: (${r.currMeter.toFixed(0)} - ${r.prevMeter.toFixed(0)}) kWh = ${r.kwh.toFixed(0)} kWh`);
    lines.push(`(${r.kwh.toFixed(0)} * ${data.unitRate.toFixed(2)}) = RM ${r.roomCost.toFixed(2)} / ${r.tenants.length} ≈ RM ${r.perTenantAc.toFixed(2)} per person\n`);

    r.tenants.forEach(t => {
      const row = data.tenantRows.find(item => item.tenant === t && item.room === r.name);
      if (row) {
        lines.push(`${padRight(t, 8)} : RM (${round2(row.common).toFixed(2)} + ${round2(row.roomAc).toFixed(2)} + ${round2(row.water).toFixed(2)}) ≈ *RM ${round2(row.total).toFixed(2)}*`);
      }
    });
    lines.push("");
  });

  const sumParts = data.tenantRows.map(t => `${round2(t.total).toFixed(2)}`).join(" + ");
  lines.push(`Total : RM (${sumParts}) = ${data.totalCollected.toFixed(2)}`);
  lines.push(`Actual : RM ${data.actualPayable.toFixed(2)}`);
  lines.push(`Collected : RM ${data.totalCollected.toFixed(2)}`);
  lines.push(`\n*Balance : RM ${data.nextMonthBalance.toFixed(2)}* ➔ *use for next month bill deduction before calculation.*`);

  latestFormattedReport = lines.join("\n");
}

// --- PAGE 2: BILL HISTORY & TRENDS ---
function loadBillHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function updateHistoryBadge() {
  const badge = document.getElementById("navHistoryCount");
  if (badge) badge.textContent = billHistory.length;
}

function saveCurrentBillToHistory() {
  if (!latestSummaryMetrics) return;
  const entry = {
    id: "hist_" + Date.now(),
    savedAt: new Date().toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" }),
    periodLabel: latestSummaryMetrics.electricPeriod,
    electricAmount: latestSummaryMetrics.electricAmount,
    waterAmount: latestSummaryMetrics.waterAmount,
    totalCollected: latestSummaryMetrics.totalCollected,
    actualPayable: latestSummaryMetrics.actualPayable,
    nextMonthBalance: latestSummaryMetrics.nextMonthBalance,
    totalKwh: latestSummaryMetrics.totalKwh,
    unitRate: latestSummaryMetrics.unitRate,
    totalHeadcount: latestSummaryMetrics.totalHeadcount,
    stateSnapshot: JSON.parse(JSON.stringify(appState))
  };
  billHistory.unshift(entry);
  if (billHistory.length > 24) billHistory.pop();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(billHistory));
  updateHistoryBadge();
  renderHistoryPage();
}

function renderHistoryPage() {
  updateHistoryBadge();

  const records = billHistory.length > 0 ? billHistory : (latestSummaryMetrics ? [{
    id: "live_preview",
    savedAt: "Active Unsaved Cycle",
    periodLabel: latestSummaryMetrics.electricPeriod,
    electricAmount: latestSummaryMetrics.electricAmount,
    waterAmount: latestSummaryMetrics.waterAmount,
    totalCollected: latestSummaryMetrics.totalCollected,
    actualPayable: latestSummaryMetrics.actualPayable,
    nextMonthBalance: latestSummaryMetrics.nextMonthBalance,
    totalKwh: latestSummaryMetrics.totalKwh,
    unitRate: latestSummaryMetrics.unitRate,
    totalHeadcount: latestSummaryMetrics.totalHeadcount,
    stateSnapshot: appState
  }] : []);

  const avgBill = records.length > 0 ? records.reduce((s, r) => s + (r.actualPayable || 0), 0) / records.length : 0;
  const avgKwh = records.length > 0 ? records.reduce((s, r) => s + (r.totalKwh || 0), 0) / records.length : 0;

  const elAvgBill = document.getElementById("histMetricAvgBill");
  const elAvgKwh = document.getElementById("histMetricAvgKwh");
  const elCount = document.getElementById("histMetricCount");
  const elCarry = document.getElementById("histMetricCarryover");
  const elPeakRoom = document.getElementById("histMetricPeakRoom");
  const elPeakKwh = document.getElementById("histMetricPeakKwh");

  if (elAvgBill) elAvgBill.textContent = `RM ${avgBill.toFixed(2)}`;
  if (elAvgKwh) elAvgKwh.textContent = `${avgKwh.toFixed(0)} kWh avg`;
  if (elCount) elCount.textContent = `${billHistory.length} Saved`;
  if (elCarry && latestSummaryMetrics) elCarry.textContent = `+RM ${latestSummaryMetrics.nextMonthBalance.toFixed(2)}`;

  // Peak AC room & Load Bars
  if (latestSummaryMetrics && latestSummaryMetrics.roomCalculations.length > 0) {
    const sortedRooms = [...latestSummaryMetrics.roomCalculations].sort((a, b) => b.kwh - a.kwh);
    if (elPeakRoom) elPeakRoom.textContent = sortedRooms[0].name;
    if (elPeakKwh) elPeakKwh.textContent = `${sortedRooms[0].kwh.toFixed(0)} kWh AC`;

    const roomLoadContainer = document.getElementById("histRoomLoadList");
    if (roomLoadContainer) {
      const totalSubKwh = latestSummaryMetrics.roomCalculations.reduce((s, r) => s + r.kwh, 0) || 1;
      roomLoadContainer.innerHTML = latestSummaryMetrics.roomCalculations.map(r => {
        const pct = Math.round((r.kwh / totalSubKwh) * 100);
        return `
          <div>
            <div class="flex justify-between items-baseline mb-1 text-xs">
              <span class="font-bold text-primary-dark">${escapeHtml(r.name)} (${escapeHtml(r.tenants.join(", "))})</span>
              <span class="font-mono font-semibold text-primary">${r.kwh.toFixed(0)} kWh <span class="text-on-surface-variant font-normal">(${pct}%)</span></span>
            </div>
            <div class="w-full bg-surface-container-low rounded-full h-2.5 overflow-hidden border border-outline-variant">
              <div class="bg-primary h-full rounded-full" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  // Render Chart.js
  renderHistoryTrendChart(records);

  // Render Archive Table
  const tbody = document.getElementById("historyArchiveTableBody");
  const searchVal = (document.getElementById("historySearchInput")?.value || "").toLowerCase();
  if (tbody) {
    if (billHistory.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="py-8 text-center text-on-surface-variant">
            No archived bills yet. Click <strong>"Archive Current Calculation"</strong> above or <strong>"Save to History"</strong> on the Calculator tab to log monthly records.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = "";
      billHistory.forEach((item, idx) => {
        if (searchVal && !String(item.periodLabel).toLowerCase().includes(searchVal)) return;
        const tr = document.createElement("tr");
        tr.className = "hover:bg-surface-container-low/50 transition-colors";
        tr.innerHTML = `
          <td class="py-3 px-4">
            <span class="font-bold text-primary-dark block">${escapeHtml(item.periodLabel)}</span>
            <span class="font-mono text-[11px] text-on-surface-variant">Saved: ${escapeHtml(item.savedAt)}</span>
          </td>
          <td class="py-3 px-4 font-mono">
            <strong class="text-on-surface">RM ${(item.electricAmount || 0).toFixed(2)}</strong>
            <span class="block text-[11px] text-on-surface-variant">${(item.totalKwh || 0).toFixed(0)} kWh</span>
          </td>
          <td class="py-3 px-4 font-mono">RM ${(item.waterAmount || 0).toFixed(2)}</td>
          <td class="py-3 px-4 font-mono text-primary font-semibold">RM ${(item.unitRate || 0).toFixed(2)}/kWh</td>
          <td class="py-3 px-4 text-center font-mono">${item.totalHeadcount || 1} Pax</td>
          <td class="py-3 px-4 font-mono text-tertiary font-bold">+RM ${(item.nextMonthBalance || 0).toFixed(2)}</td>
          <td class="py-3 px-4 text-right font-mono font-bold text-primary-dark">RM ${(item.totalCollected || 0).toFixed(2)}</td>
          <td class="py-3 px-4 text-right">
            <div class="inline-flex items-center gap-1">
              <button type="button" class="p-1.5 rounded-lg bg-primary-fixed text-primary hover:bg-primary hover:text-white transition-all btn-hist-restore" data-idx="${idx}" title="Restore this bill into Calculator">
                <span class="material-symbols-outlined text-[16px]">restore</span>
              </button>
              <button type="button" class="p-1.5 rounded-lg bg-error-container text-error hover:opacity-80 transition-all btn-hist-delete" data-idx="${idx}" title="Delete record">
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll(".btn-hist-restore").forEach(btn => {
        btn.addEventListener("click", () => {
          const i = parseInt(btn.getAttribute("data-idx"), 10);
          const rec = billHistory[i];
          if (rec && rec.stateSnapshot) {
            appState = normalizeState(JSON.parse(JSON.stringify(rec.stateSnapshot)));
            bindFormInputs();
            renderRooms();
            saveInputState();
            recalculate();
            switchPage("calculator");
            showToast(`Restored bill: ${rec.periodLabel}`);
          }
        });
      });

      tbody.querySelectorAll(".btn-hist-delete").forEach(btn => {
        btn.addEventListener("click", () => {
          const i = parseInt(btn.getAttribute("data-idx"), 10);
          billHistory.splice(i, 1);
          localStorage.setItem(HISTORY_KEY, JSON.stringify(billHistory));
          renderHistoryPage();
          showToast("Deleted history record.");
        });
      });
    }
  }

  // Storage Quota Display
  const quotaEl = document.getElementById("dispStorageQuota");
  if (quotaEl) {
    const bytes = new Blob([localStorage.getItem(STORAGE_KEY) || "", localStorage.getItem(HISTORY_KEY) || ""]).size;
    quotaEl.textContent = `${(bytes / 1024).toFixed(2)} KB`;
  }
}

function renderHistoryTrendChart(records) {
  const canvas = document.getElementById("historyTrendChart");
  if (!canvas || typeof Chart === "undefined") return;

  const chronological = [...records].slice(0, 8).reverse();
  const labels = chronological.map(r => r.periodLabel || "Cycle");
  const rmData = chronological.map(r => round2(r.actualPayable || 0));
  const kwhData = chronological.map(r => Math.round(r.totalKwh || 0));

  if (historyChartInstance) {
    historyChartInstance.destroy();
  }

  historyChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Total Bill (RM)",
          data: rmData,
          backgroundColor: "rgba(25, 118, 210, 0.8)",
          borderColor: "#0d47a1",
          borderWidth: 1,
          borderRadius: 6,
          yAxisID: "yRm",
          order: 2
        },
        {
          type: "line",
          label: "Grid Usage (kWh)",
          data: kwhData,
          borderColor: "#008378",
          backgroundColor: "#008378",
          borderWidth: 2.5,
          pointRadius: 4,
          tension: 0.3,
          yAxisID: "yKwh",
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        yRm: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          ticks: { callback: v => `RM ${v}` }
        },
        yKwh: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { callback: v => `${v} kWh` }
        }
      }
    }
  });
}

// --- PAGE 3: TENANT & ROOM DIRECTORY ---
function renderDirectoryPage() {
  if (!latestSummaryMetrics) recalculate();
  const data = latestSummaryMetrics;

  const elOcc = document.getElementById("dirMetricOccupancy");
  const elMeters = document.getElementById("dirMetricMeters");
  const elTotalAc = document.getElementById("dirMetricTotalAcKwh");
  const elPaidCount = document.getElementById("dirMetricPaidCount");
  const elPaidBar = document.getElementById("dirPaidProgressBar");
  const elPaidPct = document.getElementById("dirPaidPercent");
  const elAvatarStack = document.getElementById("dirAvatarStack");
  const elZonesBadge = document.getElementById("dirZonesBadge");

  const paidTenants = data.tenantRows.filter(t => t.paid);
  const paidRmSum = paidTenants.reduce((s, t) => s + round2(t.total), 0);
  const totalCount = data.tenantRows.length || 1;
  const pct = Math.round((paidTenants.length / totalCount) * 100);
  const totalAcKwh = data.roomCalculations.reduce((s, r) => s + r.kwh, 0);

  if (elOcc) elOcc.textContent = `${data.roomCalculations.length} Rooms / ${data.totalHeadcount} Tenants`;
  if (elMeters) elMeters.textContent = `${data.roomCalculations.length} Online Active`;
  if (elTotalAc) elTotalAc.textContent = `${totalAcKwh.toFixed(0)} kWh total AC`;
  if (elPaidCount) elPaidCount.textContent = `${paidTenants.length}/${data.tenantRows.length} Paid (RM ${paidRmSum.toFixed(2)})`;
  if (elPaidBar) elPaidBar.style.width = `${pct}%`;
  if (elPaidPct) elPaidPct.textContent = `${pct}%`;
  if (elZonesBadge) elZonesBadge.textContent = `${data.roomCalculations.length} zones`;

  if (elAvatarStack) {
    elAvatarStack.innerHTML = data.tenantRows.map(t => {
      const initials = t.tenant.slice(0, 2).toUpperCase();
      return `<div class="w-7 h-7 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white" title="${escapeHtml(t.tenant)}">${escapeHtml(initials)}</div>`;
    }).join("");
  }

  // Render Room Cards Grid
  const roomsGrid = document.getElementById("directoryRoomsGrid");
  if (roomsGrid) {
    roomsGrid.innerHTML = data.roomCalculations.map((r, idx) => {
      const splitRule = r.tenants.length > 1 ? `Equal 1/${r.tenants.length} Shared Room` : "100% Solo Meter";
      return `
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-outline-variant flex flex-col justify-between space-y-4">
          <div class="space-y-3">
            <div class="flex items-start justify-between">
              <div>
                <span class="px-2 py-0.5 rounded bg-primary-fixed text-primary font-mono text-[11px] font-bold border border-outline-variant">RM-0${idx + 1}</span>
                <h3 class="font-headline font-bold text-lg text-primary-dark mt-1">${escapeHtml(r.name)}</h3>
                <p class="text-xs text-on-surface-variant font-medium">${escapeHtml(r.tenants.join(" & "))}</p>
              </div>
              <span class="px-2.5 py-1 rounded-full bg-surface-container-low text-primary-dark font-mono text-xs font-bold border border-outline-variant">${r.tenants.length} PAX</span>
            </div>

            <div class="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant space-y-1">
              <div class="flex justify-between text-xs text-on-surface-variant">
                <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[15px] text-primary">ac_unit</span> AC Sub-Meter</span>
                <span class="font-mono font-bold text-primary">ID: MTR-0${idx + 1}</span>
              </div>
              <div class="flex items-baseline justify-between pt-1">
                <span class="text-xs text-on-surface-variant">Meter Reading:</span>
                <span class="font-mono text-base font-bold text-primary-dark">${r.prevMeter} → ${r.currMeter} kWh</span>
              </div>
              <div class="flex justify-between text-[11px] font-mono pt-1 text-tertiary font-semibold">
                <span>Cycle Usage: +${r.kwh.toFixed(0)} kWh</span>
                <span>AC Cost: RM ${r.roomCost.toFixed(2)}</span>
              </div>
            </div>

            <div class="flex justify-between text-xs">
              <span class="text-on-surface-variant">Split Rule:</span>
              <strong class="text-primary-dark">${splitRule}</strong>
            </div>
          </div>

          <button type="button" class="w-full py-2 px-3 rounded-xl bg-primary text-white hover:bg-primary-dark font-semibold text-xs flex items-center justify-center gap-1.5 dir-wa-room-btn" data-room="${escapeHtml(r.name)}">
            <span class="material-symbols-outlined text-[16px]">chat</span>
            <span>Send Room Bill via WhatsApp</span>
          </button>
        </div>
      `;
    }).join("");

    roomsGrid.querySelectorAll(".dir-wa-room-btn").forEach(btn => {
      btn.addEventListener("click", shareViaWhatsApp);
    });
  }

  // Render Tenant Directory Ledger Table
  const ledgerBody = document.getElementById("directoryLedgerTableBody");
  if (ledgerBody) {
    ledgerBody.innerHTML = "";
    const methods = ["DuitNow QR", "Touch 'n Go eWallet", "Bank Transfer"];

    data.tenantRows.forEach(t => {
      const meta = getTenantMeta(t.tenant);
      const initials = t.tenant.slice(0, 2).toUpperCase();
      const tr = document.createElement("tr");
      tr.className = "hover:bg-surface-container-low/40 transition-colors";

      const methodOptions = methods.map(m => `<option value="${m}" ${meta.method === m ? "selected" : ""}>${m}</option>`).join("");

      tr.innerHTML = `
        <td class="py-3 px-4">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full bg-primary text-white font-bold text-xs flex items-center justify-center">${escapeHtml(initials)}</div>
            <div>
              <strong class="text-primary-dark block">${escapeHtml(t.tenant)}</strong>
              <span class="text-[11px] text-on-surface-variant">${escapeHtml(t.room)}</span>
            </div>
          </div>
        </td>
        <td class="py-3 px-3">
          <input type="text" class="px-2.5 py-1 rounded-lg bg-surface-container-low border border-outline-variant font-mono text-xs w-40 dir-phone-input" data-tenant="${escapeHtml(t.tenant)}" value="${escapeHtml(meta.phone)}" />
        </td>
        <td class="py-3 px-3">
          <select class="px-2.5 py-1 rounded-lg bg-surface-container-low border border-outline-variant font-mono text-xs dir-method-select" data-tenant="${escapeHtml(t.tenant)}">
            ${methodOptions}
          </select>
        </td>
        <td class="py-3 px-3 font-mono">${t.roomKwhShare.toFixed(1)} kWh (RM ${round2(t.roomAc).toFixed(2)})</td>
        <td class="py-3 px-3 text-right font-mono font-bold text-primary-dark">RM ${round2(t.total).toFixed(2)}</td>
        <td class="py-3 px-3 text-center">
          <button type="button" class="dir-status-btn px-3 py-1 rounded-full font-mono text-xs font-bold ${meta.paid ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-error-container text-on-error-container'}" data-tenant="${escapeHtml(t.tenant)}">
            ${meta.paid ? 'Paid ✓' : 'Pending'}
          </button>
        </td>
      `;
      ledgerBody.appendChild(tr);
    });

    ledgerBody.querySelectorAll(".dir-phone-input").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const meta = getTenantMeta(e.target.getAttribute("data-tenant"));
        meta.phone = e.target.value;
        saveInputState();
      });
    });

    ledgerBody.querySelectorAll(".dir-method-select").forEach(sel => {
      sel.addEventListener("change", (e) => {
        const meta = getTenantMeta(e.target.getAttribute("data-tenant"));
        meta.method = e.target.value;
        saveInputState();
      });
    });

    ledgerBody.querySelectorAll(".dir-status-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const meta = getTenantMeta(btn.getAttribute("data-tenant"));
        meta.paid = !meta.paid;
        saveInputState();
        recalculate();
        renderDirectoryPage();
      });
    });
  }
}

// --- PAGE 4: INTERACTIVE GUIDE SANDBOX ---
function initGuideSimulator() {
  const simInputs = document.querySelectorAll(".sim-input");
  simInputs.forEach(inp => inp.addEventListener("input", runGuideSimulator));

  document.querySelectorAll(".sim-preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const preset = btn.getAttribute("data-sim-preset");
      if (preset === "standard") {
        document.getElementById("simBillTotal").value = "184.50";
        document.getElementById("simTotalKwh").value = "520";
        document.getElementById("simCarryover").value = "0.84";
        document.getElementById("simR1").value = "145";
        document.getElementById("simR2").value = "115";
        document.getElementById("simR3").value = "40";
      } else if (preset === "heavy") {
        document.getElementById("simBillTotal").value = "340.20";
        document.getElementById("simTotalKwh").value = "820";
        document.getElementById("simCarryover").value = "1.20";
        document.getElementById("simR1").value = "290";
        document.getElementById("simR2").value = "240";
        document.getElementById("simR3").value = "90";
      } else if (preset === "away") {
        document.getElementById("simBillTotal").value = "130.00";
        document.getElementById("simTotalKwh").value = "380";
        document.getElementById("simCarryover").value = "2.10";
        document.getElementById("simR1").value = "160";
        document.getElementById("simR2").value = "0";
        document.getElementById("simR3").value = "50";
      }
      runGuideSimulator();
    });
  });

  runGuideSimulator();
}

function runGuideSimulator() {
  const bill = parseFloat(document.getElementById("simBillTotal")?.value) || 0;
  const kwh = parseFloat(document.getElementById("simTotalKwh")?.value) || 1;
  const carry = parseFloat(document.getElementById("simCarryover")?.value) || 0;
  const r1 = parseFloat(document.getElementById("simR1")?.value) || 0;
  const r2 = parseFloat(document.getElementById("simR2")?.value) || 0;
  const r3 = parseFloat(document.getElementById("simR3")?.value) || 0;

  const net = Math.max(0, bill - carry);
  const rawRate = net / kwh;
  const ceilRate = Math.ceil(rawRate * 100) / 100;

  const commonKwh = Math.max(0, kwh - (r1 + r2 + r3));
  const commonCostEach = (commonKwh / 3) * ceilRate;

  const r1Ac = r1 * ceilRate;
  const r2Ac = r2 * ceilRate;
  const r3Ac = r3 * ceilRate;

  const r1Tot = r1Ac + commonCostEach;
  const r2Tot = r2Ac + commonCostEach;
  const r3Tot = r3Ac + commonCostEach;
  const surplus = (r1Tot + r2Tot + r3Tot) - net;

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt("simOutRateCeil", `RM ${ceilRate.toFixed(2)} / kWh`);
  setTxt("simOutRateRaw", `RM ${rawRate.toFixed(5)} / kWh`);
  setTxt("simOutR1Ac", `RM ${r1Ac.toFixed(2)}`);
  setTxt("simOutR1Com", `RM ${commonCostEach.toFixed(2)}`);
  setTxt("simOutR1Tot", `RM ${r1Tot.toFixed(2)}`);
  setTxt("simOutR2Ac", `RM ${r2Ac.toFixed(2)}`);
  setTxt("simOutR2Com", `RM ${commonCostEach.toFixed(2)}`);
  setTxt("simOutR2Tot", `RM ${r2Tot.toFixed(2)}`);
  setTxt("simOutR3Ac", `RM ${r3Ac.toFixed(2)}`);
  setTxt("simOutR3Com", `RM ${commonCostEach.toFixed(2)}`);
  setTxt("simOutR3Tot", `RM ${r3Tot.toFixed(2)}`);
  setTxt("simOutSurplus", `${surplus >= 0 ? "+" : ""}RM ${surplus.toFixed(2)} Carryover`);
}

// --- Roll Forward, Export, Backup & Helpers ---
function rollForwardNextMonth() {
  const currentBalance = latestSummaryMetrics ? latestSummaryMetrics.nextMonthBalance : 0;
  const balanceMsg = currentBalance > 0
    ? `- Previous Balance deduction set to RM ${currentBalance.toFixed(2)}`
    : `- No balance to carry down (Prev. Balance set to RM 0.00)`;

  if (confirm(`Roll forward to next month?\n\n- Current bill will be archived to Bill History\n${balanceMsg}\n- Room Previous Meters updated to current readings\n- New month usage inputs cleared for fresh entry!`)) {
    saveCurrentBillToHistory();

    appState.prevBalance = currentBalance > 0 ? currentBalance.toFixed(2) : "";
    appState.electricAmount = "";
    appState.waterAmount = "";
    appState.totalKwh = "";

    appState.rooms.forEach(r => {
      if (r.currMeter !== "" && r.currMeter !== null && r.currMeter !== undefined) {
        r.prevMeter = r.currMeter;
      }
      r.currMeter = "";
    });

    Object.keys(appState.tenantMeta || {}).forEach(k => {
      appState.tenantMeta[k].paid = false;
    });

    bindFormInputs();
    renderRooms();
    saveInputState();
    recalculate();
    showToast("Archived bill & rolled forward to next month!");
  }
}

function exportHistoryToJson() {
  const backupPayload = {
    version: "2.0",
    exportedAt: new Date().toISOString(),
    currentState: appState,
    billHistory: billHistory
  };
  const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStamp = new Date().toISOString().split("T")[0];
  link.href = url;
  link.download = `utilitysplit-backup-${dateStamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("Downloaded JSON backup file!");
}

function importHistoryFromJson(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const importedHistory = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed.billHistory) ? parsed.billHistory : null);

      if (importedHistory && importedHistory.length > 0) {
        const existingIds = new Set(billHistory.map(item => item.id));
        const newRecords = importedHistory.filter(item => item && item.id && !existingIds.has(item.id));
        billHistory = [...newRecords, ...billHistory].slice(0, 24);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(billHistory));
      }

      if (parsed.currentState && typeof parsed.currentState === "object") {
        appState = normalizeState(parsed.currentState);
        bindFormInputs();
        renderRooms();
        saveInputState();
        recalculate();
      }

      renderHistoryPage();
      showToast("Successfully imported JSON backup!");
    } catch (err) {
      showToast("Invalid JSON backup file.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function shareViaWhatsApp() {
  if (!latestFormattedReport) {
    showToast("No report data available to share.");
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(latestFormattedReport)}`, "_blank");
}

function downloadBreakdownImage() {
  const target = document.getElementById("captureBreakdownCard");
  if (!target || typeof html2canvas === "undefined") {
    showToast("Image export library is loading...");
    return;
  }
  showToast("Generating PNG receipt image...");
  html2canvas(target, { scale: 2, backgroundColor: "#ffffff" }).then(canvas => {
    const link = document.createElement("a");
    const periodSlug = (elElectricDate && elElectricDate.value) ? elElectricDate.value : "statement";
    link.download = `utility-bill-${periodSlug}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    showToast("Downloaded PNG breakdown image!");
  });
}

function copyReportToClipboard() {
  if (!latestFormattedReport) return;
  navigator.clipboard.writeText(latestFormattedReport).then(() => {
    showToast("Copied WhatsApp report to clipboard!");
  });
}

function formatElectricDate(dateStr) {
  if (!dateStr) return "Current Period";
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return dateStr;
    return `${day} ${date.toLocaleDateString("en-US", { month: "long" })} ${year}`;
  } catch (e) {
    return dateStr;
  }
}

function formatWaterPeriod(startStr, endStr) {
  if (!startStr && !endStr) return "Current Period";
  try {
    if (startStr && !endStr) {
      const [y, m, d] = startStr.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    if (startStr && endStr) {
      const [y1, m1, d1] = startStr.split("-").map(Number);
      const [y2, m2, d2] = endStr.split("-").map(Number);
      const mName1 = new Date(y1, m1 - 1, d1).toLocaleDateString("en-US", { month: "long" });
      const mName2 = new Date(y2, m2 - 1, d2).toLocaleDateString("en-US", { month: "long" });
      if (y1 === y2) {
        return m1 === m2 ? `${mName1} ${y1}` : `${mName1} to ${mName2} ${y1}`;
      }
      return `${mName1} ${y1} to ${mName2} ${y2}`;
    }
    return "Current Period";
  } catch (e) {
    return `${startStr} to ${endStr}`;
  }
}

function round2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function padRight(str, len) {
  return String(str).padEnd(len, " ");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(msg) {
  if (!elToast) return;
  elToast.textContent = msg;
  elToast.classList.add("show");
  setTimeout(() => {
    elToast.classList.remove("show");
  }, 2600);
}

document.addEventListener("DOMContentLoaded", init);