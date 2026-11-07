// ============================================================
//  admin.js  -  Admin side.
//  Used by admin-login.html and admin-dashboard.html.
//  Needs storage.js to be loaded first.
//  Admin username/password are set in storage.js (CONFIG).
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

    let reports = [];
    let current = null;                // report open in the dialog
    let currentPhotos = [];            // its pictures
    let firstLoad = true;
    let knownIds = {};
    const newIds = {};                 // reports that arrived while this page was open

    const dialog = $("reportDialog");
    const searchBox = $("searchBox");
    const statusFilter = $("statusFilter");
    const typeFilter = $("typeFilter");

    $("adminEmailLabel").textContent = BC.adminName();
    $("adminApp").hidden = false;

    BC.STATUSES.forEach(function (s) {
      statusFilter.add(new Option(s, s));
      $("uStatus").add(new Option(s, s));
    });
    BC.CONCERN_TYPES.forEach(function (t) { typeFilter.add(new Option(t, t)); });

    $("adminLogoutBtn").addEventListener("click", function () {
      BC.logoutAdmin();
      location.replace("admin-login.html");
    });

    // ---------- Load + refresh ----------
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

      $("livePill").textContent = "Live · updated " + new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      updateStats();
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

    document.querySelectorAll(".stat").forEach(function (btn) {
      btn.addEventListener("click", function () {
        statusFilter.value = btn.dataset.filter;
        renderTable();
      });
    });

    // ---------- Search + filters ----------
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
      const s = searchBox.value.trim().toLowerCase();
      return reports.filter(function (r) {
        if (statusFilter.value && r.status !== statusFilter.value) return false;
        if (typeFilter.value && r.type !== typeFilter.value) return false;
        if (!s) return true;
        return [r.reportNo, r.residentName, r.location, r.type, r.contact, r.description].some(function (v) {
          return String(v || "").toLowerCase().indexOf(s) >= 0;
        });
      });
    }

    // ---------- Table ----------
    function renderTable() {
      const rows = filteredReports();
      $("countLine").textContent = "Showing " + rows.length + " of " + reports.length + " report" + (reports.length === 1 ? "" : "s");

      if (!rows.length) {
        $("reportRows").innerHTML = '<tr><td colspan="7" class="empty">' +
          (reports.length ? "No reports match your search or filters." : "No reports yet. New reports will appear here automatically.") + "</td></tr>";
        return;
      }

      $("reportRows").innerHTML = rows.map(function (r) {
        return '' +
          '<tr class="' + (newIds[r.id] ? "row-new" : "") + '">' +
            '<td data-label="Report ID"><strong>' + BC.esc(r.reportNo) + '</strong></td>' +
            '<td data-label="Resident">' + BC.esc(r.residentName) + '</td>' +
            '<td data-label="Concern Type">' + BC.esc(r.type) + '</td>' +
            '<td data-label="Location">' + BC.esc(r.location) + '</td>' +
            '<td data-label="Date Submitted">' + BC.esc(BC.fmtDate(r.createdAt)) + '</td>' +
            '<td data-label="Status">' + BC.statusBadge(r.status) + '</td>' +
            '<td data-label="Action" class="actions">' +
              '<button class="btn btn-sm btn-outline" type="button" data-act="view" data-id="' + BC.esc(r.id) + '">View</button> ' +
              '<button class="btn btn-sm" type="button" data-act="update" data-id="' + BC.esc(r.id) + '">Update</button>' +
            '</td>' +
          '</tr>';
      }).join("");
    }

    $("reportRows").addEventListener("click", function (e) {
      const btn = e.target.closest("button[data-id]");
      if (btn) openReport(btn.dataset.id, btn.dataset.act === "update");
    });

    // ---------- Report dialog ----------
    function openReport(id, focusUpdate) {
      const r = reports.find(function (x) { return x.id === id; });
      if (!r) return;
      current = r;

      $("dlgTitle").textContent = r.reportNo;
      $("dlgBadge").innerHTML = BC.statusBadge(r.status);
      $("dResident").textContent = r.residentName || "";
      $("dContact").textContent = r.contact || "";
      $("dType").textContent = r.type || "";
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

      $("uStatus").value = r.status;
      $("uRemarks").value = r.remarks || "";

      const history = (r.history || []).slice().reverse();
      $("dHistory").innerHTML = history.length
        ? history.map(function (h) {
            return '<li>' + BC.statusBadge(h.status) + '<div class="when">' + BC.esc(BC.fmtDate(h.at)) + ' &middot; ' + BC.esc(h.by || "") + '</div>' +
              (h.remarks ? '<p class="note">' + BC.esc(h.remarks) + '</p>' : '') + '</li>';
          }).join("")
        : '<li class="muted">No history yet.</li>';

      dialog.showModal();
      dialog.querySelector(".modal-body").scrollTop = 0;
      if (focusUpdate) $("uStatus").focus();
    }

    // Open a photo full size
    function openPhoto(e) {
      const img = e.target.closest("img[data-photo]");
      if (img) BC.openImage(currentPhotos[Number(img.dataset.photo)]);
    }
    $("dPhotos").addEventListener("click", openPhoto);
    $("dPhotos").addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPhoto(e); } });

    $("dlgClose").addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });

    // ---------- Save status + remarks ----------
    $("updateForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!current) return;
      const status = $("uStatus").value;
      const remarks = $("uRemarks").value.trim();
      if (status === current.status && remarks === (current.remarks || "")) {
        return BC.toast("Nothing changed yet.", "info");
      }
      const res = BC.updateReport(current.id, status, remarks, BC.adminName());
      if (res.error) return BC.toast(res.error, "error");
      BC.toast(current.reportNo + " updated to " + status + ".", "success");
      dialog.close();
      refresh();
    });

    refresh();
    BC.onChange(refresh);   // a resident (in another tab) added a report
  }
})();
