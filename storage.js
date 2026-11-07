// ============================================================
//  storage.js  -  the "database" (localStorage) + shared helpers.
//  Loaded FIRST on every page. Edit the CONFIG block below to
//  change the admin login.
//
//  IMPORTANT: localStorage lives inside ONE browser on ONE device.
//  Reports do NOT travel between a phone and a computer. Two tabs
//  of the same browser DO update each other live.
//  Residents do NOT log in. Only the admin has a login (CONFIG below),
//  and its password is visible in this file - this is a demo, not secure.
// ============================================================

(function () {
  // ---------- CONFIG (edit me) ----------
  const CONFIG = {
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "admin123"
  };

  const KEYS = {
    reports: "bc_reports",
    myReports: "bc_my_reports",       // ids of reports sent from THIS browser
    lastContact: "bc_last_contact",   // remembers the resident's name + number for next time
    adminSession: "bc_session_admin"
  };

  const STATUSES = ["SUBMITTED", "UNDER REVIEW", "IN PROGRESS", "RESOLVED"];

  const STATUS_INFO = {
    "SUBMITTED": "The resident has successfully sent the report.",
    "UNDER REVIEW": "A barangay official is reviewing the report.",
    "IN PROGRESS": "Barangay personnel are addressing the concern.",
    "RESOLVED": "The reported concern has been addressed."
  };

  const CONCERN_TYPES = [
    "Improper Garbage Disposal",
    "Clogged Drainage",
    "Damaged Road",
    "Flooding",
    "Noise Complaint",
    "Other Concerns"
  ];

  // ---------- low-level storage ----------
  function read(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false; // storage full or blocked
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function makeReportNo() {
    const d = new Date();
    const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "X");
    return "BRG-" + ymd + "-" + rand;
  }

  // ---------- this browser's own reports (no resident login) ----------
  function getMyIds() {
    return read(KEYS.myReports, []);
  }

  function rememberReport(id) {
    const ids = getMyIds();
    if (ids.indexOf(id) < 0) {
      ids.unshift(id);
      write(KEYS.myReports, ids);
    }
  }

  function getMyReports() {
    const ids = getMyIds();
    return getReports().filter(function (r) { return ids.indexOf(r.id) >= 0; });
  }

  // Lets a resident look up a report by its number, e.g. BRG-20261106-K4Q9
  function findByReportNo(no) {
    const n = String(no || "").trim().toUpperCase();
    return getReports().find(function (r) { return r.reportNo === n; }) || null;
  }

  function getLastContact() {
    return read(KEYS.lastContact, { fullName: "", contact: "" });
  }

  function saveLastContact(fullName, contact) {
    write(KEYS.lastContact, { fullName: fullName, contact: contact });
  }

  // ---------- admin ----------
  function loginAdmin(username, password) {
    if (username.trim() === CONFIG.ADMIN_USERNAME && password === CONFIG.ADMIN_PASSWORD) {
      write(KEYS.adminSession, { username: CONFIG.ADMIN_USERNAME, at: Date.now() });
      return { ok: true };
    }
    return { error: "Incorrect admin username or password." };
  }

  function isAdmin() {
    return !!read(KEYS.adminSession, null);
  }

  function adminName() {
    const s = read(KEYS.adminSession, null);
    return s ? s.username : "";
  }

  function logoutAdmin() {
    localStorage.removeItem(KEYS.adminSession);
  }

  // ---------- reports ----------
  function getReports() {
    return read(KEYS.reports, []).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  }

  function addReport(r) {
    const reports = read(KEYS.reports, []);
    const now = new Date().toISOString();
    const photos = getPhotos({ photos: r.photos, photo: r.photo }).slice(0, 3);
    const report = {
      id: uid(),
      reportNo: makeReportNo(),
      residentName: r.residentName,
      contact: r.contact,
      type: r.type,
      location: r.location,
      description: r.description,
      photos: photos,                 // up to 3 pictures (data URLs)
      photo: photos[0] || "",         // first picture, kept for older code / old reports
      status: "SUBMITTED",
      remarks: "",
      history: [{ status: "SUBMITTED", remarks: "Report received.", at: now, by: "Resident" }],
      createdAt: now,
      updatedAt: now
    };
    reports.push(report);
    if (!write(KEYS.reports, reports)) {
      return { error: "Browser storage is full. Try again with fewer photos (or none), or clear old reports." };
    }
    rememberReport(report.id);
    return { report: report };
  }

  function updateReport(id, status, remarks, by) {
    const reports = read(KEYS.reports, []);
    const r = reports.find((x) => x.id === id);
    if (!r) return { error: "Report not found." };
    const now = new Date().toISOString();
    r.status = status;
    r.remarks = remarks;
    r.updatedAt = now;
    r.history = r.history || [];
    r.history.push({ status: status, remarks: remarks, at: now, by: by || "Admin" });
    if (!write(KEYS.reports, reports)) return { error: "Could not save the update." };
    return { report: r };
  }

  // Runs your function whenever ANOTHER tab of this browser changes the data.
  function onChange(callback) {
    window.addEventListener("storage", function (e) {
      if (e.key === KEYS.reports || e.key === null) callback();
    });
  }

  // ---------- small helpers ----------
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtDate(iso) {
    const d = iso ? new Date(iso) : null;
    if (!d || isNaN(d)) return "";
    return d.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
  }

  function statusBadge(status) {
    const s = STATUSES.indexOf(status) >= 0 ? status : "SUBMITTED";
    return '<span class="badge badge-' + s.toLowerCase().replace(/\s+/g, "-") + '">' + esc(s) + "</span>";
  }

  function safePhoto(src) {
    return typeof src === "string" && src.indexOf("data:image/") === 0 ? src : "";
  }

  // All pictures of a report as a clean list (works for new reports AND old ones with a single `photo`)
  function getPhotos(r) {
    const list = r && Array.isArray(r.photos) && r.photos.length ? r.photos : (r && r.photo ? [r.photo] : []);
    return list.map(safePhoto).filter(Boolean);
  }

  // Opens a saved picture full size in a new tab (browsers block direct links to data: images)
  function openImage(src) {
    const s = safePhoto(src);
    if (!s) return;
    try {
      const parts = s.split(",");
      const mime = parts[0].match(/data:(.*?);/)[1];
      const bin = atob(parts[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      window.open(url, "_blank", "noopener");
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    } catch (e) { /* ignore */ }
  }

  function toast(message, type, ms) {
    let wrap = document.getElementById("toasts");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "toasts";
      wrap.className = "toast-wrap";
      wrap.setAttribute("aria-live", "polite");
      document.body.appendChild(wrap);
    }
    const t = document.createElement("div");
    t.className = "toast toast-" + (type || "info");
    t.textContent = message;
    wrap.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || 6000);
  }

  // ---------- Light / dark theme ----------
  // The theme is saved in localStorage ("bc_theme") and applied as
  // <html data-theme="light|dark">. Every button with data-theme-toggle switches it.
  const THEME_KEY = "bc_theme";

  function currentTheme() {
    let t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (t === "dark" || t === "light") return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    const SUN = SVG + '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    const MOON = SVG + '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      const icon = btn.querySelector(".theme-icon");
      // One-color line icon that shows what you get when you click it
      if (icon) icon.innerHTML = theme === "dark" ? SUN : MOON;
      const text = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
      btn.setAttribute("aria-label", text);
      btn.setAttribute("title", text);
      btn.setAttribute("aria-pressed", String(theme === "dark"));
    });
  }

  function initTheme() {
    applyTheme(currentTheme());
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const next = currentTheme() === "dark" ? "light" : "dark";
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
        applyTheme(next);
      });
    });
    // Keep other open tabs in step
    window.addEventListener("storage", function (e) {
      if (e.key === THEME_KEY) applyTheme(currentTheme());
    });
  }

  // Opens / closes the sidebar on small screens (the menu button in the top bar).
  // Also switches on the light / dark toggle buttons.
  function initNav() {
    initTheme();
    const toggle = document.getElementById("navToggle");
    const overlay = document.getElementById("navOverlay");
    const side = document.getElementById("sidebar");
    if (!toggle || !side) return;
    function close() {
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    }
    toggle.addEventListener("click", function () {
      const open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    if (overlay) overlay.addEventListener("click", close);
    side.addEventListener("click", function (e) { if (e.target.closest("a")) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  // Shrinks a photo to a small JPEG "data URL" so it fits in localStorage (~5 MB total).
  function compressImage(file, maxSize, quality) {
    maxSize = maxSize || 800;
    quality = quality || 0.6;
    return new Promise(function (resolve, reject) {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";                       // PNG / WebP with transparency would turn black as JPEG
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("That file is not a valid image."));
      };
      img.src = url;
    });
  }

  // Everything other files can use lives on window.BC
  window.BC = {
    CONFIG: CONFIG, STATUSES: STATUSES, STATUS_INFO: STATUS_INFO, CONCERN_TYPES: CONCERN_TYPES,
    getMyReports: getMyReports, findByReportNo: findByReportNo, rememberReport: rememberReport,
    getLastContact: getLastContact, saveLastContact: saveLastContact,
    loginAdmin: loginAdmin, isAdmin: isAdmin, adminName: adminName, logoutAdmin: logoutAdmin,
    getReports: getReports, addReport: addReport, updateReport: updateReport, onChange: onChange,
    esc: esc, fmtDate: fmtDate, statusBadge: statusBadge, safePhoto: safePhoto, getPhotos: getPhotos, openImage: openImage,
    toast: toast, initNav: initNav, compressImage: compressImage
  };
})();
