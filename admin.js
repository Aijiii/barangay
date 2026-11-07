// ============================================================
//  admin.js  -  Admin side.
//  Used by admin-login.html and admin-dashboard.html.
//  Needs storage.js to be loaded first.
//  Admin username/password are set in storage.js (CONFIG).
//
//  The dashboard code is split into small sections:
//    1. State + setup        5. Delete (single + bulk, with confirmation)
//    2. Live search/filters  6. Batch status updater
//    3. Table rendering      7. Export (CSV / PDF)
//    4. Row selection        8. Details modal + update form
// ============================================================

(function () {
  const $ = function (id) { return document.getElementById(id); };
  const page = document.body.dataset.page;
  BC.initNav();

  if (page === "admin-login") initLogin();
  if (page === "admin-dashboard") initDashboard();

  // ============================================================
  //  ADMIN LOGIN
  // ============================================================
  function initLogin() {
    const msg = $("adminMsg");
    if (BC.isAdmin()) {
      location.replace("admin-dashboard.html");
      return;
    }
    $("adminLoginForm").addEventListener("submit", function (e) {
      e.preventDefault();
      const username = $("adminUser").value;
      const password = $("adminPassword").value;
      if (!username || !password) {
        msg.textContent = "Please enter your username and password.";
        msg.className = "alert alert-error";
        msg.hidden = false;
        return;
      }
      const res = BC.loginAdmin(username, password);
      if (res.error) {
        msg.textContent = res.error;
        msg.className = "alert alert-error";
        msg.hidden = false;
        return;
      }
      location.replace("admin-dashboard.html");
    });
  }

  // ============================================================
  //  ADMIN DASHBOARD
  // ============================================================
  function initDashboard() {
    if (!BC.isAdmin()) {
      location.replace("admin-login.html");
      return;
    }

    // ---------- 1. State + setup ----------
    let reports = [];                  // every report in storage
    let visible = [];                  // the reports currently shown in the table (after search/filters)
    let current = null;                // report open in the details dialog
    let currentPhotos = [];            // its pictures
    let pendingDelete = [];            // reports waiting for "Confirm Delete"
    let firstLoad = true;
    const knownIds = {};
    const newIds = {};                 // reports that arrived while this page was open
    const selected = new Set();        // ids of the ticked rows

    const dialog = $("reportDialog");
    const confirmDialog = $("confirmDialog");
    const rowsEl = $("reportRows");
    const searchBox = $("searchBox");
    const statusFilter = $("statusFilter");
    const typeFilter = $("typeFilter");

    $("adminEmailLabel").textContent = BC.adminName();
    $("adminApp").hidden = false;

    BC.STATUSES.forEach(function (s) {
      statusFilter.add(new Option(s, s));
      $("uStatus").add(new Option(s, s));
      $("bulkStatus").add(new Option(s, s));
    });
    BC.CONCERN_TYPES.forEach(function (t) { typeFilter.add(new Option(t, t)); });

    $("adminLogoutBtn").addEventListener("click", function () {
      BC.logoutAdmin();
      location.replace("admin-login.html");
    });

    // Reload from storage and redraw everything
    function refresh() {
      reports = BC.getReports();

      // Announce reports that showed up since the last refresh
      reports.forEach(function (r) {
        if (!firstLoad && !knownIds[r.id]) {
          newIds[r.id] = true;
          setTimeout(function () { delete newIds[r.id]; }, 6000);
          BC.toast("New report: " + r.type + " (" + r.reportNo + ")", "success", 8000);
        }
        knownIds[r.id] = true;
      });
      firstLoad = false;

      // Forget ticked rows that no longer exist
      const existing = new Set(reports.map(function (r) { return r.id; }));
      Array.from(selected).forEach(function (id) { if (!existing.has(id)) selected.delete(id); });

      $("livePill").textContent = "Live · updated " + new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      updateStats();
      fillOfficerList();
      renderTable();
    }

    function updateStats() {
      function count(s) { return reports.filter(function (r) { return r.status === s; }).length; }
      $("statTotal").textContent = reports.length;
      $("statSubmitted").textContent = count("SUBMITTED");
      $("statReview").textContent = count("UNDER REVIEW");
      $("statProgress").textContent = count("IN PROGRESS");
      $("statResolved").textContent = count("RESOLVED");
    }

    // Suggest officers that were already used on other reports
    function fillOfficerList() {
      const base = ["Barangay Captain", "Barangay Kagawad", "Barangay Tanod", "Barangay Secretary", "SK Chairperson"];
      const used = reports.map(function (r) { return r.assignedTo; }).filter(Boolean);
      const all = Array.from(new Set(used.concat(base)));
      $("officerList").innerHTML = all.map(function (n) { return '<option value="' + BC.esc(n) + '"></option>'; }).join("");
    }

    document.querySelectorAll(".stat").forEach(function (btn) {
      btn.addEventListener("click", function () {
        statusFilter.value = btn.dataset.filter;
        renderTable();
      });
    });

    // ---------- 2. Live search + filters ----------
    // Searches report ID, name, category, location, officer, status and the description keywords.
    [searchBox, statusFilter, typeFilter].forEach(function (el) {
      el.addEventListener("input", renderTable);
      el.addEventListener("change", renderTable);
    });
    $("clearFilters").addEventListener("click", function () {
      searchBox.value = "";
      statusFilter.value = "";
      typeFilter.value = "";
      renderTable();
    });

    function filteredReports() {
      const words = searchBox.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      return reports.filter(function (r) {
        if (statusFilter.value && r.status !== statusFilter.value) return false;
        if (typeFilter.value && r.type !== typeFilter.value) return false;
        if (!words.length) return true;
        const hay = [r.reportNo, r.residentName, r.location, r.type, r.contact, r.description, r.assignedTo, r.status]
          .map(function (v) { return String(v || "").toLowerCase(); }).join(" | ");
        return words.every(function (w) { return hay.indexOf(w) >= 0; });   // every typed word must match
      });
    }

    // ---------- 3. Table rendering ----------
    const ICON_TRASH = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

    function renderTable() {
      visible = filteredReports();

      // Only rows you can see can stay ticked (so bulk actions never touch hidden rows)
      const shown = new Set(visible.map(function (r) { return r.id; }));
      Array.from(selected).forEach(function (id) { if (!shown.has(id)) selected.delete(id); });

      $("countLine").textContent = "Showing " + visible.length + " of " + reports.length + " report" + (reports.length === 1 ? "" : "s");

      if (!visible.length) {
        rowsEl.innerHTML = '<tr><td colspan="8" class="empty">' +
          (reports.length ? "No reports match your search or filters." : "No reports yet. New reports will appear here automatically.") + "</td></tr>";
        updateSelectionUI();
        return;
      }

      rowsEl.innerHTML = visible.map(function (r) {
        const id = BC.esc(r.id);
        const isSel = selected.has(r.id);
        return '' +
          '<tr data-id="' + id + '" class="' + (newIds[r.id] ? "row-new " : "") + (isSel ? "is-selected" : "") + '">' +
            '<td data-label="Select" class="col-check"><input type="checkbox" class="row-check" data-id="' + id + '"' + (isSel ? " checked" : "") + ' aria-label="Select report ' + BC.esc(r.reportNo) + '"></td>' +
            '<td data-label="Report ID"><button type="button" class="id-link" data-act="view" data-id="' + id + '" title="Open details and history">' + BC.esc(r.reportNo) + '</button></td>' +
            '<td data-label="Resident">' + BC.esc(r.residentName) + '</td>' +
            '<td data-label="Concern Type">' + BC.esc(r.type) + '</td>' +
            '<td data-label="Location">' + BC.esc(r.location) + '</td>' +
            '<td data-label="Date Submitted">' + BC.esc(BC.fmtDate(r.createdAt)) + '</td>' +
            '<td data-label="Status">' + BC.statusBadge(r.status) + '</td>' +
            '<td data-label="Action" class="actions">' +
              '<button class="btn btn-sm btn-outline" type="button" data-act="view" data-id="' + id + '">View</button> ' +
              '<button class="btn btn-sm" type="button" data-act="update" data-id="' + id + '">Update</button> ' +
              '<button class="icon-action" type="button" data-act="delete" data-id="' + id + '" aria-label="Delete report ' + BC.esc(r.reportNo) + '" title="Delete report">' + ICON_TRASH + '</button>' +
            '</td>' +
          '</tr>';
      }).join("");
      updateSelectionUI();
    }

    // One click handler for every button in the table
    rowsEl.addEventListener("click", function (e) {
      const btn = e.target.closest("button[data-id]");
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === "delete") askDelete([btn.dataset.id]);
      else openReport(btn.dataset.id, act === "update");
    });

    // ---------- 4. Row selection (checkboxes) ----------
    rowsEl.addEventListener("change", function (e) {
      const cb = e.target.closest(".row-check");
      if (!cb) return;
      if (cb.checked) selected.add(cb.dataset.id); else selected.delete(cb.dataset.id);
      cb.closest("tr").classList.toggle("is-selected", cb.checked);
      updateSelectionUI();
    });

    // "Select all" ticks / unticks every row that is currently shown
    $("selectAll").addEventListener("change", function () {
      const on = $("selectAll").checked;
      visible.forEach(function (r) { if (on) selected.add(r.id); else selected.delete(r.id); });
      rowsEl.querySelectorAll(".row-check").forEach(function (cb) {
        cb.checked = on;
        cb.closest("tr").classList.toggle("is-selected", on);
      });
      updateSelectionUI();
    });

    // Updates the bulk bar, the counter and the "select all" box
    function updateSelectionUI() {
      const n = selected.size;
      const all = $("selectAll");
      all.disabled = !visible.length;
      all.checked = n > 0 && n === visible.length;
      all.indeterminate = n > 0 && n < visible.length;

      $("bulkBar").classList.toggle("has-selection", n > 0);
      $("bulkCount").textContent = n ? n + " report" + (n === 1 ? "" : "s") + " selected" : "Tick rows to use bulk actions";
      $("bulkDelete").disabled = !n;
      $("bulkApply").disabled = !n || !$("bulkStatus").value;
      $("bulkStatus").disabled = !n;
    }
    $("bulkStatus").addEventListener("change", updateSelectionUI);

    // ---------- 5. Delete (single + bulk) ----------
    // Step 1: ask. Nothing is deleted until "Confirm Delete" is pressed.
    function askDelete(ids) {
      pendingDelete = ids.map(function (id) {
        return reports.find(function (r) { return r.id === id; });
      }).filter(Boolean);
      if (!pendingDelete.length) return;

      $("confirmText").textContent = pendingDelete.length === 1
        ? "Are you sure you want to delete report " + pendingDelete[0].reportNo + "? This action cannot be undone."
        : "Are you sure you want to delete these " + pendingDelete.length + " selected reports? This action cannot be undone.";
      $("confirmTitle").textContent = pendingDelete.length === 1 ? "Delete report?" : "Delete " + pendingDelete.length + " reports?";
      confirmDialog.showModal();
      $("confirmCancel").focus();             // the safe choice is focused first
    }

    $("bulkDelete").addEventListener("click", function () { askDelete(Array.from(selected)); });
    $("confirmCancel").addEventListener("click", function () { pendingDelete = []; confirmDialog.close(); });
    confirmDialog.addEventListener("click", function (e) { if (e.target === confirmDialog) confirmDialog.close(); });
    confirmDialog.addEventListener("close", function () { if (!$("confirmOk").dataset.busy) pendingDelete = []; });

    // Step 2: delete for real (fade the rows out, then remove them from storage)
    $("confirmOk").addEventListener("click", function () {
      const list = pendingDelete.slice();
      if (!list.length) return confirmDialog.close();
      $("confirmOk").dataset.busy = "1";
      confirmDialog.close();
      delete $("confirmOk").dataset.busy;
      pendingDelete = [];

      const ids = list.map(function (r) { return r.id; });
      const idSet = new Set(ids);
      rowsEl.querySelectorAll("tr[data-id]").forEach(function (tr) {
        if (idSet.has(tr.dataset.id)) tr.classList.add("row-removing");     // smooth fade-out
      });

      setTimeout(function () {
        const res = BC.deleteReports(ids);
        if (res.error) return BC.toast(res.error, "error");
        ids.forEach(function (id) { selected.delete(id); });
        if (current && idSet.has(current.id)) { dialog.close(); current = null; }
        BC.toast(list.length === 1
          ? "Report " + list[0].reportNo + " deleted successfully."
          : list.length + " reports deleted successfully.", "success");
        refresh();
      }, 320);
    });

    // ---------- 6. Batch status updater ----------
    $("bulkApply").addEventListener("click", function () {
      const status = $("bulkStatus").value;
      const ids = Array.from(selected);
      if (!status || !ids.length) return;
      const res = BC.bulkUpdateStatus(ids, status, "Status changed in a bulk update.", BC.adminName());
      if (res.error) return BC.toast(res.error, "error");
      BC.toast(res.changed
        ? res.changed + " report" + (res.changed === 1 ? "" : "s") + " set to " + status + "."
        : "The selected reports already have the status " + status + ".", res.changed ? "success" : "info");
      selected.clear();
      $("bulkStatus").value = "";
      refresh();
    });

    // ---------- 7. Export (CSV / PDF) ----------
    // Both exports use exactly the rows that are visible in the table right now.
    const exportBtn = $("exportBtn");
    const exportMenu = $("exportMenu");
    function toggleExportMenu(open) {
      exportMenu.hidden = !open;
      exportBtn.setAttribute("aria-expanded", String(open));
    }
    exportBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleExportMenu(exportMenu.hidden); });
    document.addEventListener("click", function (e) { if (!exportMenu.contains(e.target)) toggleExportMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") toggleExportMenu(false); });

    // One CSV cell: quotes escaped, line breaks removed, and a leading = + - @ neutralised
    // so a spreadsheet never runs text typed by a resident as a formula.
    function csvCell(value) {
      let s = String(value == null ? "" : value).replace(/\r?\n/g, " ");
      if (/^[=+\-@\t]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    }

    function exportCsv() {
      toggleExportMenu(false);
      if (!visible.length) return BC.toast("There are no records to export.", "error");
      const head = ["Report ID", "Resident", "Contact", "Concern Type", "Location", "Description", "Status",
                    "Assigned Officer", "Remarks", "Photos", "Date Submitted", "Last Updated"];
      const lines = [head.map(csvCell).join(",")];
      visible.forEach(function (r) {
        lines.push([
          r.reportNo, r.residentName, r.contact, r.type, r.location, r.description, r.status,
          r.assignedTo || "", r.remarks || "", BC.getPhotos(r).length, BC.fmtDate(r.createdAt), BC.fmtDate(r.updatedAt)
        ].map(csvCell).join(","));
      });
      // "﻿" lets Excel read accents / Filipino characters correctly
      const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const d = new Date();
      const stamp = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "barangay-reports-" + stamp + ".csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      BC.toast(visible.length + " record" + (visible.length === 1 ? "" : "s") + " exported to CSV.", "success");
    }

    // PDF: opens the browser's print window with a clean table (choose "Save as PDF" as the printer)
    function exportPdf() {
      toggleExportMenu(false);
      if (!visible.length) return BC.toast("There are no records to export.", "error");
      $("printHead").textContent = "Barangay Complaint & Report System - Incident Records (" + visible.length + ") - " +
        new Date().toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" });
      window.print();
    }
    $("exportCsv").addEventListener("click", exportCsv);
    $("exportPdf").addEventListener("click", exportPdf);

    // ---------- 8. Details modal + update form ----------
    function openReport(id, focusUpdate) {
      const r = reports.find(function (x) { return x.id === id; });
      if (!r) return;
      current = r;

      $("dlgTitle").textContent = r.reportNo;
      $("dlgBadge").innerHTML = BC.statusBadge(r.status);
      $("dResident").textContent = r.residentName || "";
      $("dContact").textContent = r.contact || "";
      $("dType").textContent = r.type || "";
      $("dOfficer").textContent = r.assignedTo || "Not assigned yet";
      $("dLocation").textContent = r.location || "";
      $("dCreated").textContent = BC.fmtDate(r.createdAt);
      $("dUpdated").textContent = BC.fmtDate(r.updatedAt);
      $("dDescription").textContent = r.description || "";

      // All photos the resident attached (click one to open it full size)
      currentPhotos = BC.getPhotos(r);
      $("dPhotoWrap").hidden = !currentPhotos.length;
      $("dPhotos").innerHTML = currentPhotos.map(function (p, i) {
        return '<img src="' + BC.esc(p) + '" alt="Photo evidence ' + (i + 1) + '" title="Click to open" data-photo="' + i + '" tabindex="0" role="button">';
      }).join("");

      // Map preview: loaded only when asked (it needs internet and contacts Google)
      $("mapFrame").hidden = true;
      $("mapFrame").src = "about:blank";
      $("mapShow").hidden = false;
      $("mapLink").href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(r.location || "");

      $("uStatus").value = r.status;
      $("uOfficer").value = r.assignedTo || "";
      $("uRemarks").value = r.remarks || "";

      // Timeline: newest first
      const history = (r.history || []).slice().reverse();
      $("dHistory").innerHTML = history.length
        ? history.map(function (h) {
            return '<li>' + BC.statusBadge(h.status) + '<div class="when">' + BC.esc(BC.fmtDate(h.at)) + ' &middot; ' + BC.esc(h.by || "") + '</div>' +
              (h.officer ? '<p class="note"><strong>Assigned officer:</strong> ' + BC.esc(h.officer) + '</p>' : '') +
              (h.remarks ? '<p class="note">' + BC.esc(h.remarks) + '</p>' : '') + '</li>';
          }).join("")
        : '<li class="muted">No history yet.</li>';

      dialog.showModal();
      dialog.querySelector(".modal-body").scrollTop = 0;
      if (focusUpdate) $("uStatus").focus();
    }

    $("mapShow").addEventListener("click", function () {
      if (!current) return;
      $("mapFrame").src = "https://maps.google.com/maps?q=" + encodeURIComponent(current.location || "") + "&z=16&output=embed";
      $("mapFrame").hidden = false;
      $("mapShow").hidden = true;
    });

    // Open a photo full size
    function openPhoto(e) {
      const img = e.target.closest("img[data-photo]");
      if (img) BC.openImage(currentPhotos[Number(img.dataset.photo)]);
    }
    $("dPhotos").addEventListener("click", openPhoto);
    $("dPhotos").addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPhoto(e); } });

    $("dlgClose").addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener("close", function () { $("mapFrame").src = "about:blank"; });   // stop loading the map

    // Save status + officer + remarks
    $("updateForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!current) return;
      const status = $("uStatus").value;
      const remarks = $("uRemarks").value.trim();
      const officer = $("uOfficer").value.trim();
      if (status === current.status && remarks === (current.remarks || "") && officer === (current.assignedTo || "")) {
        return BC.toast("Nothing changed yet.", "info");
      }
      const res = BC.updateReport(current.id, status, remarks, BC.adminName(), officer);
      if (res.error) return BC.toast(res.error, "error");
      BC.toast(current.reportNo + " updated.", "success");
      dialog.close();
      refresh();
    });

    refresh();
    BC.onChange(refresh);   // a resident (in another tab) added a report
  }
})();
