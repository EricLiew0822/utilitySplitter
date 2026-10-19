/**
 * Integrated Electricity and Water Bill Calculator - Frontend Engine
 */

// Clean blank initial state with zero prefilled values
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
  ]
};

// Preset reference dataset accessible via the "Load Sample Data" button
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
  ]
};

const STORAGE_KEY = "utility_calculator_user_data";
const HISTORY_KEY = "utility_calculator_bill_history";
const THEME_KEY = "utility_calculator_theme";

let appState = normalizeState(loadSavedState() || JSON.parse(JSON.stringify(SAMPLE_REFERENCE_STATE)));
let billHistory = loadBillHistory();

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
const elBtnAddRoom = document.getElementById("btnAddRoom");
const elBtnResetAll = document.getElementById("btnResetAll");
const elBtnLoadSample = document.getElementById("btnLoadSample");
const elBtnRollForward = document.getElementById("btnRollForward");
const elBtnCopyReport = document.getElementById("btnCopyReport");
const elBtnOpenPdf = document.getElementById("btnOpenPdf");
const elBtnShareWa = document.getElementById("btnShareWa");
const elBtnDownloadImg = document.getElementById("btnDownloadImg");
const elBtnSaveHistory = document.getElementById("btnSaveHistory");
const elBtnClearHistory = document.getElementById("btnClearHistory");
const elBtnThemeToggle = document.getElementById("btnThemeToggle");
const elThemeIcon = document.getElementById("themeIcon");
const elPdfPreviewWrapper = document.getElementById("pdfPreviewWrapper");

// History & Backup Elements
const elHistoryListContainer = document.getElementById("historyListContainer");
const elHistoryCountBadge = document.getElementById("historyCountBadge");
const elHistoryChartCard = document.getElementById("historyChartCard");
const elHistoryAvgBadge = document.getElementById("historyAvgBadge");
const elHistoryTrendCanvas = document.getElementById("historyTrendChart");
const elBtnExportHistoryJson = document.getElementById("btnExportHistoryJson");
const elBtnImportHistoryJson = document.getElementById("btnImportHistoryJson");
const elInputImportHistoryFile = document.getElementById("inputImportHistoryFile");
let historyChartInstance = null;

// Miniature PDF Preview Elements
const elMiniDocPeriod = document.getElementById("miniDocPeriod");
const elMiniDocRate = document.getElementById("miniDocRate");
const elMiniDocGrid = document.getElementById("miniDocGrid");
const elMiniDocWater = document.getElementById("miniDocWater");
const elMiniDocBalance = document.getElementById("miniDocBalance");
const elMiniTenantRows = document.getElementById("miniTenantRows");

// Display Elements
const elDispUnitRate = document.getElementById("dispUnitRate");
const elDispNetElectric = document.getElementById("dispNetElectric");
const elDispCommonPerPerson = document.getElementById("dispCommonPerPerson");
const elDispCommonKwh = document.getElementById("dispCommonKwh");
const elDispWaterPerPerson = document.getElementById("dispWaterPerPerson");
const elDispTotalTenants = document.getElementById("dispTotalTenants");
const elTenantTableBody = document.getElementById("tenantTableBody");
const elDispCollected = document.getElementById("dispCollected");
const elDispActual = document.getElementById("dispActual");
const elDispBalance = document.getElementById("dispBalance");
const elToast = document.getElementById("toast");

let latestFormattedReport = "";
let latestSummaryMetrics = null;

// --- Initialization ---
function init() {
  initTheme();
  bindFormInputs();
  renderRooms();
  renderHistoryList();
  attachEventListeners();
  recalculate();
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
      if (r.tenants.length === 0) {
        r.tenants = [""];
      }
    });
  }
  return state;
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "light";
  document.documentElement.setAttribute("data-bs-theme", savedTheme);
  updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
  if (!elThemeIcon) return;
  elThemeIcon.className = theme === "dark" ? "bi bi-sun-fill text-warning" : "bi bi-moon-stars";
}

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

  toggleManualRate();
}

function attachEventListeners() {
  const inputs = [
    elElectricDate, elWaterStartDate, elWaterEndDate, elElectricAmount,
    elPrevBalance, elTotalKwh, elWaterAmount, elManualRate
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

  elRateMode.addEventListener("change", () => {
    toggleManualRate();
    saveInputState();
    recalculate();
  });

  elBtnAddRoom.addEventListener("click", () => {
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
  });

  if (elBtnResetAll) {
    elBtnResetAll.addEventListener("click", resetAllInputs);
  }

  elBtnLoadSample.addEventListener("click", () => {
    appState = normalizeState(JSON.parse(JSON.stringify(SAMPLE_REFERENCE_STATE)));
    bindFormInputs();
    renderRooms();
    saveInputState();
    recalculate();
    showToast("Loaded sample bill data!");
  });

  elBtnRollForward.addEventListener("click", rollForwardNextMonth);

  if (elBtnCopyReport) {
    elBtnCopyReport.addEventListener("click", copyReportToClipboard);
  }

  if (elBtnShareWa) {
    elBtnShareWa.addEventListener("click", shareViaWhatsApp);
  }

  if (elBtnDownloadImg) {
    elBtnDownloadImg.addEventListener("click", downloadBreakdownImage);
  }

  if (elBtnSaveHistory) {
    elBtnSaveHistory.addEventListener("click", () => {
      saveCurrentBillToHistory();
      showToast("Saved bill statement to History!");
    });
  }

  if (elBtnClearHistory) {
    elBtnClearHistory.addEventListener("click", () => {
      if (confirm("Clear all saved bill history?")) {
        billHistory = [];
        localStorage.setItem(HISTORY_KEY, JSON.stringify(billHistory));
        renderHistoryList();
        showToast("Bill history cleared.");
      }
    });
  }

  if (elBtnExportHistoryJson) {
    elBtnExportHistoryJson.addEventListener("click", exportHistoryToJson);
  }

  if (elBtnImportHistoryJson && elInputImportHistoryFile) {
    elBtnImportHistoryJson.addEventListener("click", () => {
      elInputImportHistoryFile.click();
    });

    elInputImportHistoryFile.addEventListener("change", importHistoryFromJson);
  }

  if (elBtnThemeToggle) {
    elBtnThemeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-bs-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-bs-theme", next);
      localStorage.setItem(THEME_KEY, next);
      updateThemeIcon(next);
      renderHistoryChart();
    });
  }

  if (elBtnOpenPdf) {
    elBtnOpenPdf.addEventListener("click", () => {
      saveInputState();
      window.open("invoice.html", "_blank");
    });
  }

  if (elPdfPreviewWrapper) {
    elPdfPreviewWrapper.addEventListener("click", () => {
      saveInputState();
      window.open("invoice.html", "_blank");
    });
  }
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

function toggleManualRate() {
  if (elRateMode.value === "manual") {
    elManualRateGroup.classList.remove("hidden");
  } else {
    elManualRateGroup.classList.add("hidden");
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
    if (!saved) {
      return JSON.parse(JSON.stringify(SAMPLE_REFERENCE_STATE));
    }
    return JSON.parse(saved);
  } catch (e) {
    return JSON.parse(JSON.stringify(SAMPLE_REFERENCE_STATE));
  }
}

// --- Bill History, Chart & JSON Backup Management ---
function loadBillHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCurrentBillToHistory() {
  if (!latestSummaryMetrics) return;
  const entry = {
    id: "hist_" + Date.now(),
    savedAt: new Date().toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" }),
    periodLabel: formatElectricDate(appState.electricDate),
    totalCollected: latestSummaryMetrics.totalCollected,
    actualPayable: latestSummaryMetrics.actualPayable,
    nextMonthBalance: latestSummaryMetrics.nextMonthBalance,
    totalKwh: latestSummaryMetrics.totalKwh,
    unitRate: latestSummaryMetrics.unitRate,
    stateSnapshot: JSON.parse(JSON.stringify(appState))
  };
  billHistory.unshift(entry);
  if (billHistory.length > 24) billHistory.pop();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(billHistory));
  renderHistoryList();
}

function renderHistoryList() {
  if (!elHistoryListContainer || !elHistoryCountBadge) return;
  elHistoryCountBadge.textContent = billHistory.length;

  renderHistoryChart();

  if (billHistory.length === 0) {
    elHistoryListContainer.innerHTML = `
      <div class="text-center text-muted py-5">
        <i class="bi bi-journal-x fs-1 d-block mb-2"></i>
        <p class="small mb-0">No saved bills yet. Click <strong>"Save to History"</strong> or <strong>"Roll Forward"</strong> to archive a monthly statement and unlock trend charts.</p>
      </div>
    `;
    return;
  }

  elHistoryListContainer.innerHTML = "";
  billHistory.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card border shadow-sm p-3";
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start mb-2">
        <div>
          <strong class="text-primary d-block small">${escapeHtml(item.periodLabel)}</strong>
          <span class="extra-small text-muted">Saved: ${escapeHtml(item.savedAt)}</span>
        </div>
        <span class="badge bg-warning text-dark extra-small">Carryover: RM ${(item.nextMonthBalance || 0).toFixed(2)}</span>
      </div>
      <div class="row g-1 extra-small text-secondary mb-2 bg-light p-2 rounded border">
        <div class="col-6">Incurred: <strong class="text-dark">RM ${(item.actualPayable || 0).toFixed(2)}</strong></div>
        <div class="col-6">Collected: <strong class="text-dark">RM ${(item.totalCollected || 0).toFixed(2)}</strong></div>
        <div class="col-6">Grid: <strong>${(item.totalKwh || 0).toFixed(0)} kWh</strong></div>
        <div class="col-6">Rate: <strong>RM ${(item.unitRate || 0).toFixed(2)}/kWh</strong></div>
      </div>
      <div class="d-flex gap-2">
        <button type="button" class="btn btn-sm btn-primary flex-grow-1 btn-load-hist" data-idx="${index}">
          <i class="bi bi-box-arrow-in-down-left me-1"></i> Restore Bill
        </button>
        <button type="button" class="btn btn-sm btn-outline-danger btn-del-hist" data-idx="${index}" title="Delete record">
          <i class="bi bi-trash3"></i>
        </button>
      </div>
    `;

    card.querySelector(".btn-load-hist").addEventListener("click", () => {
      appState = normalizeState(JSON.parse(JSON.stringify(item.stateSnapshot)));
      bindFormInputs();
      renderRooms();
      saveInputState();
      recalculate();
      showToast(`Restored bill: ${item.periodLabel}`);
    });

    card.querySelector(".btn-del-hist").addEventListener("click", () => {
      billHistory.splice(index, 1);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(billHistory));
      renderHistoryList();
    });

    elHistoryListContainer.appendChild(card);
  });
}

function renderHistoryChart() {
  if (!elHistoryChartCard || !elHistoryTrendCanvas || typeof Chart === "undefined") return;

  if (billHistory.length === 0) {
    elHistoryChartCard.classList.add("hidden");
    if (historyChartInstance) {
      historyChartInstance.destroy();
      historyChartInstance = null;
    }
    return;
  }

  elHistoryChartCard.classList.remove("hidden");

  const chronological = [...billHistory].slice(0, 8).reverse();

  const labels = chronological.map(item => {
    const raw = item.periodLabel || "Bill";
    const parts = raw.split(" ");
    if (parts.length === 3) {
      return `${parts[1].slice(0, 3)} '${parts[2].slice(-2)}`;
    }
    return raw.length > 10 ? raw.slice(0, 10) : raw;
  });

  const rmValues = chronological.map(item => round2(item.actualPayable || 0));
  const kwhValues = chronological.map(item => Math.round(item.totalKwh || 0));

  const avgRm = rmValues.reduce((sum, val) => sum + val, 0) / rmValues.length;
  if (elHistoryAvgBadge) {
    elHistoryAvgBadge.textContent = `Avg: RM ${avgRm.toFixed(2)}/mo`;
  }

  const isDark = document.documentElement.getAttribute("data-bs-theme") === "dark";
  const textColor = isDark ? "#cbd5e1" : "#64748b";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.06)";

  if (historyChartInstance) {
    historyChartInstance.destroy();
  }

  historyChartInstance = new Chart(elHistoryTrendCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Total Bill (RM)",
          data: rmValues,
          backgroundColor: "rgba(37, 99, 235, 0.75)",
          borderColor: "#2563eb",
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: "yRm",
          order: 2
        },
        {
          type: "line",
          label: "Grid Usage (kWh)",
          data: kwhValues,
          borderColor: "#f59e0b",
          backgroundColor: "#f59e0b",
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          yAxisID: "yKwh",
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: {
            color: textColor,
            boxWidth: 10,
            font: { size: 10, family: "'Inter', sans-serif" }
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.yAxisID === "yRm") {
                return ` Total Bill: RM ${Number(ctx.raw).toFixed(2)}`;
              }
              return ` Grid Usage: ${ctx.raw} kWh`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 10 } },
          grid: { display: false }
        },
        yRm: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          ticks: {
            color: "#2563eb",
            font: { size: 10 },
            callback: (val) => `RM${val}`
          },
          grid: { color: gridColor }
        },
        yKwh: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          ticks: {
            color: "#d97706",
            font: { size: 10 },
            callback: (val) => `${val}kWh`
          },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

function exportHistoryToJson() {
  const backupPayload = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    currentState: appState,
    billHistory: billHistory
  };

  const jsonString = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  const dateStamp = new Date().toISOString().split("T")[0];
  link.href = url;
  link.download = `utility-splitter-backup-${dateStamp}.json`;
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

      if (!importedHistory && !parsed.currentState) {
        showToast("Invalid backup JSON format.");
        return;
      }

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

      renderHistoryList();
      showToast("Successfully imported backup data!");
    } catch (err) {
      console.error("Failed to import JSON:", err);
      showToast("Error reading JSON backup file.");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file);
}

// --- Date Formatting Helpers ---
function formatElectricDate(dateStr) {
  if (!dateStr) return "Current Period";
  try {
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts.map(Number);
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return dateStr;
    const monthName = date.toLocaleDateString("en-US", { month: "long" });
    return `${day} ${monthName} ${year}`;
  } catch (e) {
    return dateStr;
  }
}

function formatWaterPeriod(startStr, endStr) {
  if (!startStr && !endStr) return "Current Period";
  try {
    if (startStr && !endStr) {
      const [y, m, d] = startStr.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    if (startStr && endStr) {
      const [y1, m1, d1] = startStr.split("-").map(Number);
      const [y2, m2, d2] = endStr.split("-").map(Number);
      const date1 = new Date(y1, m1 - 1, d1);
      const date2 = new Date(y2, m2 - 1, d2);
      const mName1 = date1.toLocaleDateString("en-US", { month: "long" });
      const mName2 = date2.toLocaleDateString("en-US", { month: "long" });

      if (y1 === y2) {
        if (m1 === m2) return `${mName1} ${y1}`;
        return `${mName1} to ${mName2} ${y1}`;
      }
      return `${mName1} ${y1} to ${mName2} ${y2}`;
    }
    return "Current Period";
  } catch (e) {
    return `${startStr} to ${endStr}`;
  }
}

// --- Room Rendering ---
function renderRooms() {
  elRoomsContainer.innerHTML = "";

  if (!appState.rooms || appState.rooms.length === 0) {
    appState.rooms = [{ id: "room_1", name: "", prevMeter: "", currMeter: "", tenants: [""] }];
  }

  const sampleNames = ["Master", "Middle", "Small", "Studio", "Room 5"];
  const sampleTenantExamples = ["Bryan", "Lim", "Eric", "Honger", "Alex"];

  appState.rooms.forEach((room, roomIndex) => {
    const roomEl = document.createElement("div");
    roomEl.className = "card border shadow-sm room-card";
    roomEl.dataset.id = room.id;

    const prevVal = (room.prevMeter !== "" && room.prevMeter !== null && room.prevMeter !== undefined) ? parseFloat(room.prevMeter) : 0;
    const currVal = (room.currMeter !== "" && room.currMeter !== null && room.currMeter !== undefined) ? parseFloat(room.currMeter) : 0;
    const kwhUsed = Math.max(0, currVal - prevVal);

    if (!Array.isArray(room.tenants) || room.tenants.length === 0) {
      room.tenants = [""];
    }

    let tenantInputsHtml = room.tenants.map((tName, tIndex) => {
      const placeholderTenant = sampleTenantExamples[tIndex % sampleTenantExamples.length] || `Tenant ${tIndex + 1}`;
      return `
        <div class="input-group input-group-sm tenant-input-row" data-tindex="${tIndex}">
          <span class="input-group-text bg-light text-muted"><i class="bi bi-person"></i></span>
          <input type="text" class="form-control tenant-name-input" value="${escapeHtml(tName || '')}" placeholder="e.g. ${placeholderTenant}" />
          ${room.tenants.length > 1 ? `<button type="button" class="btn btn-outline-danger btn-remove-tenant" title="Remove Tenant"><i class="bi bi-x"></i></button>` : ''}
        </div>
      `;
    }).join("");

    const placeholderRoomName = sampleNames[roomIndex % sampleNames.length] || `Room ${roomIndex + 1}`;

    roomEl.innerHTML = `
      <div class="card-header bg-light d-flex justify-content-between align-items-center py-2 px-3">
        <div class="d-flex align-items-center gap-2 flex-grow-1 me-2">
          <i class="bi bi-door-open text-primary"></i>
          <input type="text" class="form-control form-control-sm fw-bold border-0 bg-transparent room-name-input" value="${escapeHtml(room.name || '')}" placeholder="e.g. ${placeholderRoomName}" data-field="name" style="max-width: 200px;" />
        </div>
        ${appState.rooms.length > 1 ? `<button type="button" class="btn btn-sm btn-outline-danger btn-remove-room" title="Remove Room"><i class="bi bi-trash3"></i></button>` : ''}
      </div>
      <div class="card-body p-3">
        <div class="row g-2 align-items-end mb-3">
          <div class="col-sm-4 col-12">
            <label class="form-label extra-small fw-semibold text-secondary mb-1">Previous Meter</label>
            <input type="number" step="1" class="form-control form-control-sm room-meter-input" value="${(room.prevMeter !== '' && room.prevMeter !== null && room.prevMeter !== undefined) ? room.prevMeter : ''}" placeholder="0" data-field="prevMeter" />
          </div>
          <div class="col-sm-4 col-12">
            <label class="form-label extra-small fw-semibold text-secondary mb-1">Current Meter</label>
            <input type="number" step="1" class="form-control form-control-sm room-meter-input" value="${(room.currMeter !== '' && room.currMeter !== null && room.currMeter !== undefined) ? room.currMeter : ''}" placeholder="0" data-field="currMeter" />
          </div>
          <div class="col-sm-4 col-12">
            <label class="form-label extra-small fw-semibold text-secondary mb-1">Room AC Usage</label>
            <div class="badge bg-primary-subtle text-primary border border-primary-subtle d-block py-2 text-center fw-bold room-kwh-badge">${kwhUsed.toFixed(0)} kWh</div>
          </div>
        </div>
        <div class="border-top pt-2 mt-2">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="extra-small fw-semibold text-secondary">Room Occupants (${room.tenants.length}):</span>
            <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2 btn-add-tenant" style="font-size: 0.75rem;"><i class="bi bi-plus"></i> Add Tenant</button>
          </div>
          <div class="d-flex flex-column gap-2">
            ${tenantInputsHtml}
          </div>
        </div>
      </div>
    `;

    // Room name & meter inputs
    const roomInputs = roomEl.querySelectorAll(".room-meter-input, .room-name-input");
    roomInputs.forEach(input => {
      input.addEventListener("input", (e) => {
        const field = e.target.dataset.field;
        const val = e.target.value;
        if (field === "prevMeter" || field === "currMeter") {
          room[field] = val !== "" ? parseFloat(val) : "";
          const kwhBadge = roomEl.querySelector(".room-kwh-badge");
          const p = parseFloat(room.prevMeter) || 0;
          const c = parseFloat(room.currMeter) || 0;
          const updatedKwh = Math.max(0, c - p);
          if (kwhBadge) kwhBadge.textContent = `${updatedKwh.toFixed(0)} kWh`;
        } else {
          room[field] = val;
        }
        saveInputState();
        recalculate();
      });
    });

    // Remove room button
    const removeRoomBtn = roomEl.querySelector(".btn-remove-room");
    if (removeRoomBtn) {
      removeRoomBtn.addEventListener("click", () => {
        appState.rooms.splice(roomIndex, 1);
        renderRooms();
        saveInputState();
        recalculate();
      });
    }

    // Add Tenant button
    const addTenantBtn = roomEl.querySelector(".btn-add-tenant");
    addTenantBtn.addEventListener("click", () => {
      room.tenants.push("");
      renderRooms();
      saveInputState();
      recalculate();
    });

    // Tenant name inputs & remove buttons
    const tenantRows = roomEl.querySelectorAll(".tenant-input-row");
    tenantRows.forEach(row => {
      const tIdx = parseInt(row.dataset.tindex, 10);
      const nameInput = row.querySelector(".tenant-name-input");
      nameInput.addEventListener("input", (e) => {
        room.tenants[tIdx] = e.target.value;
        saveInputState();
        recalculate();
      });

      const removeTBtn = row.querySelector(".btn-remove-tenant");
      if (removeTBtn) {
        removeTBtn.addEventListener("click", () => {
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

// --- Calculation Engine ---
function recalculate() {
  const electricAmount = parseFloat(elElectricAmount.value) || 0;
  const prevBalance = parseFloat(elPrevBalance.value) || 0;
  const totalKwh = parseFloat(elTotalKwh.value) || 0;
  const waterAmount = parseFloat(elWaterAmount.value) || 0;
  const rateMode = elRateMode.value;
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

  // 2. Parse Tenants and Room Usages
  let totalHeadcount = 0;
  let totalRoomKwh = 0;
  const roomCalculations = [];

  appState.rooms.forEach(r => {
    const p = (r.prevMeter !== "" && r.prevMeter !== null && r.prevMeter !== undefined) ? parseFloat(r.prevMeter) : 0;
    const c = (r.currMeter !== "" && r.currMeter !== null && r.currMeter !== undefined) ? parseFloat(r.currMeter) : 0;
    const kwh = Math.max(0, c - p);
    totalRoomKwh += kwh;

    const validTenants = Array.isArray(r.tenants)
      ? r.tenants.map(t => (typeof t === "object" && t !== null ? (t.name || "") : String(t || "")).trim()).filter(Boolean)
      : [];
    const tenantCount = validTenants.length > 0 ? validTenants.length : 1;
    totalHeadcount += validTenants.length;

    const roomCost = kwh * unitRate;
    const perTenantAc = tenantCount > 0 ? roomCost / tenantCount : 0;

    roomCalculations.push({
      id: r.id,
      name: r.name || "Unnamed Room",
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

  // 3. Common Area & Water Calculations
  const commonKwh = Math.max(0, totalKwh - totalRoomKwh);
  const commonCostPerPerson = totalHeadcount > 0 ? (commonKwh * unitRate) / totalHeadcount : 0;
  const waterCostPerPerson = totalHeadcount > 0 ? waterAmount / totalHeadcount : 0;

  // Individual Tenant Rows
  const tenantRows = [];
  roomCalculations.forEach(r => {
    r.tenants.forEach(tName => {
      const roomAc = r.perTenantAc;
      const common = commonCostPerPerson;
      const water = waterCostPerPerson;
      const total = common + roomAc + water;

      tenantRows.push({
        tenant: tName,
        room: r.name,
        common,
        roomAc,
        water,
        total
      });
    });
  });

  const totalCollected = tenantRows.reduce((sum, t) => sum + round2(t.total), 0);
  const actualPayable = electricAmount + waterAmount;
  const nextMonthBalance = Math.max(0, totalCollected - actualPayable);

  // 4. Update UI Displays
  const rateDecimals = rateMode === "exact" ? 4 : 2;
  elDispUnitRate.innerHTML = `RM ${unitRate.toFixed(rateDecimals)}<span class="fs-6 text-muted">/kWh</span>`;
  elDispNetElectric.textContent = `Net: RM ${netElectric.toFixed(2)} (raw: ${rawRate.toFixed(4)})`;
  elDispCommonPerPerson.textContent = `RM ${round2(commonCostPerPerson).toFixed(2)}`;
  elDispCommonKwh.textContent = `${commonKwh.toFixed(0)} kWh / ${totalHeadcount} pax`;
  elDispWaterPerPerson.textContent = `RM ${round2(waterCostPerPerson).toFixed(2)}`;
  elDispTotalTenants.textContent = `${totalHeadcount} Total Tenants`;

  // Render Table Rows
  elTenantTableBody.innerHTML = "";
  tenantRows.forEach(t => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="ps-3 text-start"><strong>${escapeHtml(t.tenant)}</strong></td>
      <td class="text-center"><span class="badge bg-light text-secondary border">${escapeHtml(t.room)}</span></td>
      <td class="text-center">RM ${round2(t.common).toFixed(2)}</td>
      <td class="text-center">RM ${round2(t.roomAc).toFixed(2)}</td>
      <td class="text-center">RM ${round2(t.water).toFixed(2)}</td>
      <td class="text-end pe-3"><span class="tenant-total-badge">RM ${round2(t.total).toFixed(2)}</span></td>
    `;
    elTenantTableBody.appendChild(tr);
  });

  elDispCollected.textContent = `RM ${totalCollected.toFixed(2)}`;
  elDispActual.textContent = `RM ${actualPayable.toFixed(2)}`;
  elDispBalance.textContent = `RM ${nextMonthBalance.toFixed(2)}`;

  // Update Live Miniature PDF Preview
  const electricFormattedDate = formatElectricDate(elElectricDate ? elElectricDate.value : "");
  const waterFormattedPeriod = formatWaterPeriod(
    elWaterStartDate ? elWaterStartDate.value : "",
    elWaterEndDate ? elWaterEndDate.value : ""
  );

  if (elMiniDocPeriod) elMiniDocPeriod.textContent = electricFormattedDate;
  if (elMiniDocRate) elMiniDocRate.textContent = `RM ${unitRate.toFixed(rateDecimals)}/kWh`;
  if (elMiniDocGrid) elMiniDocGrid.textContent = `${totalKwh.toFixed(0)} kWh`;
  if (elMiniDocWater) elMiniDocWater.textContent = `RM ${round2(waterCostPerPerson).toFixed(2)}/pax`;
  if (elMiniDocBalance) elMiniDocBalance.textContent = `RM ${nextMonthBalance.toFixed(2)}`;

  if (elMiniTenantRows) {
    elMiniTenantRows.innerHTML = "";
    tenantRows.forEach(t => {
      const row = document.createElement("div");
      row.className = "d-flex justify-content-between p-2 border-bottom extra-small";
      row.innerHTML = `
        <span class="w-50 fw-semibold text-dark">${escapeHtml(t.tenant)}</span>
        <span class="w-25 text-muted">${escapeHtml(t.room)}</span>
        <span class="w-25 text-end fw-bold text-primary">RM ${round2(t.total).toFixed(2)}</span>
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

  // 5. Generate Formatted WhatsApp Text for Copy & Share Functions
  generateFormattedReport(latestSummaryMetrics);
}

function generateFormattedReport(data) {
  const roomKwhString = data.roomCalculations.map(r => `${r.kwh.toFixed(0)}`).join(" – ");

  const lines = [
    `*Electric Bill ${data.electricPeriod}*`,
    `(RM (${data.electricAmount.toFixed(2)}- ${data.prevBalance.toFixed(2)}) / ${data.totalKwh.toFixed(0)} kWh) = ${data.rawRate.toFixed(4)} ≈ RM ${data.unitRate.toFixed(2)} per kWh\n`,
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

function rollForwardNextMonth() {
  const currentBalance = parseFloat(elDispBalance.textContent.replace("RM", "").trim()) || 0;
  const balanceMsg = currentBalance > 0 
    ? `- Previous Balance deduction will be set to RM ${currentBalance.toFixed(2)}`
    : `- No balance to carry down (Prev. Balance set to RM 0.00)`;
  
  if (confirm(`Roll forward to next month?\n\n- Current bill will be automatically archived to Bill History\n${balanceMsg}\n- Room Previous Meters updated to current readings\n- Electric bill, Water bill, Total Grid Usage, and Current Meter readings cleared for new input!`)) {
    saveCurrentBillToHistory();

    if (currentBalance > 0) {
      appState.prevBalance = currentBalance.toFixed(2);
    } else {
      appState.prevBalance = "";
    }
    elPrevBalance.placeholder = "0.00";

    // Clear new month usage inputs
    appState.electricAmount = "";
    appState.waterAmount = "";
    appState.totalKwh = "";

    // Shift previous meter readings and clear current meter readings
    appState.rooms.forEach(r => {
      if (r.currMeter !== "" && r.currMeter !== null && r.currMeter !== undefined) {
        r.prevMeter = r.currMeter;
      }
      r.currMeter = "";
    });

    bindFormInputs();
    renderRooms();
    saveInputState();
    recalculate();
    showToast("Archived bill & rolled forward to next month!");
  }
}

function shareViaWhatsApp() {
  if (!latestFormattedReport) {
    showToast("No report data available to share.");
    return;
  }
  const encoded = encodeURIComponent(latestFormattedReport);
  window.open(`https://wa.me/?text=${encoded}`, "_blank");
}

function downloadBreakdownImage() {
  const target = document.getElementById("captureBreakdownCard");
  if (!target || typeof html2canvas === "undefined") {
    showToast("Image export library is still loading.");
    return;
  }
  showToast("Generating PNG image...");
  html2canvas(target, { scale: 2, backgroundColor: "#ffffff" }).then(canvas => {
    const link = document.createElement("a");
    const periodSlug = (elElectricDate && elElectricDate.value) ? elElectricDate.value : "statement";
    link.download = `utility-bill-${periodSlug}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    showToast("Downloaded PNG breakdown image!");
  }).catch(() => {
    showToast("Failed to generate image.");
  });
}

function copyReportToClipboard() {
  const text = latestFormattedReport;
  if (!text) {
    showToast("No report data available to copy.");
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    showToast("Report copied to clipboard!");
  }).catch(() => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    showToast("Report copied to clipboard!");
  });
}

function round2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function padRight(str, len) {
  return str.padEnd(len, " ");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(msg) {
  elToast.textContent = msg;
  elToast.classList.add("show");
  setTimeout(() => {
    elToast.classList.remove("show");
  }, 2500);
}

// Run on load
document.addEventListener("DOMContentLoaded", init);