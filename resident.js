// ============================================================
//  resident.js  -  the public home page (index.html): the two sidebar
//  views (Report an Incident, Track My Report).
//  Residents do NOT log in: they fill in the form, submit, and
//  follow their reports below.
//  Needs storage.js to be loaded first.
//
//  Also contains:
//   - the Incident Photos uploader (up to 3 images, live preview,
//     drag & drop)                                -> "INCIDENT PHOTOS"
//   - the form's keyboard navigation (Enter = next field) and
//     validation                                  -> initFormNav()
// ============================================================

(function () {
  const $ = function (id) { return document.getElementById(id); };
  BC.initNav();

  const known = {};        // report id -> last seen status/remarks (to announce changes)
  let firstRender = true;

  // ---------- Sidebar views: "Report an Incident" / "Track My Report" ----------
  function showView() {
    const view = location.hash === "#track" ? "track" : "report";
    $("submit").hidden = view !== "report";
    $("my-reports").hidden = view !== "track";
    document.querySelectorAll("[data-view]").forEach(function (a) {
      a.classList.toggle("active", a.dataset.view === view);
    });
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", showView);
  showView();

  // Fill the "type of concern" dropdown
  BC.CONCERN_TYPES.forEach(function (t) { $("type").add(new Option(t, t)); });

  // ============================================================
  //  INCIDENT PHOTOS  (up to 3 images, live preview, drag & drop)
  // ============================================================
  const MAX_PHOTOS = 3;
  const MAX_BYTES = 5 * 1024 * 1024;                       // 5 MB per image
  const OK_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const OK_EXT = /\.(jpe?g|png|webp)$/i;

  const photoInput = $("photo");
  const photoDrop = $("photoDrop");
  const photoSlots = $("photoSlots");
  const photoErr = $("photoError");

  let photos = [];          // [{ src: "data:image/jpeg;base64,...", name: "x.jpg" }]
  let pending = 0;          // photos that are still being processed
  let errTimer = null;

  const SVG_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  const ICON_PLUS = SVG_OPEN + '<path d="M12 5v14M5 12h14"/></svg>';
  const ICON_IMAGE = SVG_OPEN + '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  function showPhotoError(text) {
    photoErr.textContent = text;
    photoErr.hidden = false;
    clearTimeout(errTimer);
    errTimer = setTimeout(clearPhotoError, 8000);
  }
  function clearPhotoError() {
    clearTimeout(errTimer);
    photoErr.hidden = true;
    photoErr.textContent = "";
  }

  // Draw the three slots + the counter from the `photos` list
  function renderPhotos() {
    const n = photos.length;
    photoSlots.innerHTML = [0, 1, 2].map(function (i) {
      if (i < n) {
        return '<div class="photo-slot is-filled">' +
                 '<img src="' + BC.esc(photos[i].src) + '" alt="Incident photo ' + (i + 1) + '">' +
                 '<button type="button" class="photo-remove" data-remove="' + i + '" aria-label="Remove photo ' + (i + 1) + '" title="Remove">' + ICON_X + '</button>' +
               '</div>';
      }
      if (i === n) {
        return '<button type="button" class="photo-slot photo-add" id="addPhotoBtn">' + ICON_PLUS + '<span>Add Photo</span></button>';
      }
      return '<div class="photo-slot photo-empty" aria-hidden="true">' + ICON_IMAGE + '</div>';
    }).join("");
    $("photoCount").textContent = n + " / " + MAX_PHOTOS + " photos";
  }

  // Returns an error message, or "" when the file is fine
  function checkFile(file) {
    const typeOk = OK_TYPES.indexOf(String(file.type).toLowerCase()) >= 0 || (!file.type && OK_EXT.test(file.name));
    if (!typeOk || !OK_EXT.test(file.name)) {
      return '"' + file.name + '" is not supported. Please use a JPG, JPEG, PNG or WebP image.';
    }
    if (file.size > MAX_BYTES) {
      return '"' + file.name + '" is too large (' + (file.size / 1048576).toFixed(1) + ' MB). Each photo can be 5 MB at most.';
    }
    if (file.size === 0) return '"' + file.name + '" is empty.';
    return "";
  }

  // Add one or many files (from the file picker or drag & drop). Resolves to how many were added.
  async function addFiles(fileList) {
    const files = Array.prototype.slice.call(fileList || []);   // copy now: the input is cleared afterwards
    if (!files.length) return 0;
    clearPhotoError();
    const problems = [];
    let added = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (photos.length + pending >= MAX_PHOTOS) {
        problems.push("You can add up to " + MAX_PHOTOS + " photos only. Remove one to add another.");
        break;
      }
      const bad = checkFile(file);
      if (bad) { problems.push(bad); continue; }

      pending++;
      try {
        const src = await BC.compressImage(file);       // shrunk JPEG so it fits in browser storage
        photos.push({ src: src, name: file.name });
        added++;
        renderPhotos();                                 // live preview right away
      } catch (err) {
        problems.push('"' + file.name + '" could not be read as an image.');
      } finally {
        pending--;
      }
    }
    if (problems.length) showPhotoError(problems.join(" "));
    return added;
  }

  // After adding: keep the cursor on "Add Photo" (or on Submit when all 3 slots are used)
  function refocusAfterAdd(added) {
    if (!added) return;
    const next = $("addPhotoBtn") || $("submitBtn");
    next.focus({ preventScroll: true });
  }

  function clearPhotos() {
    photos = [];
    clearPhotoError();
    renderPhotos();
  }

  // Click: "Add Photo" opens the file picker, X removes a photo
  photoSlots.addEventListener("click", function (e) {
    const rm = e.target.closest("[data-remove]");
    if (rm) {
      photos.splice(Number(rm.dataset.remove), 1);
      clearPhotoError();
      renderPhotos();
      ($("addPhotoBtn") || $("submitBtn")).focus({ preventScroll: true });
      return;
    }
    if (e.target.closest("#addPhotoBtn")) {
      if (photos.length + pending >= MAX_PHOTOS) return showPhotoError("You can add up to " + MAX_PHOTOS + " photos only.");
      photoInput.click();
    }
  });

  // File picker
  photoInput.addEventListener("change", function () {
    const job = addFiles(photoInput.files);
    photoInput.value = "";                  // so the same file can be picked again later
    job.then(refocusAfterAdd);
  });

  // Drag & drop onto the upload area
  function hasFiles(e) {
    return !!(e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") >= 0);
  }
  let dragDepth = 0;
  photoDrop.addEventListener("dragenter", function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    photoDrop.classList.add("is-dragging");
  });
  photoDrop.addEventListener("dragover", function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  photoDrop.addEventListener("dragleave", function (e) {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) photoDrop.classList.remove("is-dragging");
  });
  photoDrop.addEventListener("drop", function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    photoDrop.classList.remove("is-dragging");
    addFiles(e.dataTransfer.files).then(refocusAfterAdd);
  });
  // A file dropped OUTSIDE the box must not make the browser leave the page
  ["dragover", "drop"].forEach(function (name) {
    window.addEventListener(name, function (e) {
      if (hasFiles(e) && !photoDrop.contains(e.target)) e.preventDefault();
    });
  });

  renderPhotos();

  // ---------- The form always starts blank ----------
  // Nothing from a previous report is kept: stop the browser re-filling the
  // name / number and wipe anything it restores.
  $("fullName").setAttribute("autocomplete", "off");
  $("contact").setAttribute("autocomplete", "off");
  function blankForm() {
    $("reportForm").reset();
    clearPhotos();
  }
  blankForm();
  window.addEventListener("pageshow", function (e) { if (e.persisted) blankForm(); });

  // ============================================================
  //  FORM NAVIGATION + VALIDATION
  //  Enter moves to the next field, an empty required field shows an
  //  error and returns the cursor to it. Enter in Description moves to
  //  "Add Photo" (Enter there opens the file picker); Tab goes on to
  //  Submit Report. This MUST run before the submit handler below is
  //  added, so it can block a submit with missing fields.
  // ============================================================
  function initFormNav() {
    const form = $("reportForm");
    const errBox = $("formError");
    const okBox = $("successMsg");
    const submitBtn = $("submitBtn");

    // Field order (top to bottom). Change this list if you add fields.
    const FIELDS = [
      { id: "fullName",    label: "full name",               required: true },
      { id: "contact",     label: "contact number",          required: true },
      { id: "type",        label: "type of concern",         required: true },
      { id: "location",    label: "location of the problem", required: true },
      { id: "description", label: "description",             required: true }
    ].map(function (f) { f.el = $(f.id); return f; })
     .filter(function (f) { return f.el; });

    function problemWith(f) {
      const v = (f.el.value || "").trim();
      if (f.required && !v) {
        return f.el.tagName === "SELECT"
          ? "Please select the " + f.label + "."
          : "Please fill in the " + f.label + ".";
      }
      if (f.id === "contact" &&
          (!/^[0-9+\-\s()]{7,30}$/.test(v) || v.replace(/\D/g, "").length < 7)) {
        return "Please enter a valid contact number (numbers only, for example 0917 123 4567).";
      }
      return "";
    }

    function clearErrors() {
      errBox.hidden = true;
      FIELDS.forEach(function (f) {
        f.el.classList.remove("field-invalid");
        f.el.removeAttribute("aria-invalid");
      });
    }

    // Move the cursor to a field with a smooth scroll
    function goTo(el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el.tagName === "INPUT" && el.type !== "file" && el.select) el.select();
    }

    function fail(f, message) {
      clearErrors();
      okBox.hidden = true;
      errBox.textContent = message;
      errBox.hidden = false;
      f.el.classList.add("field-invalid");
      f.el.setAttribute("aria-invalid", "true");
      goTo(f.el);
    }

    // Check fields 0..count-1 in order. On the first problem: show the
    // message, put the cursor in that field and return false.
    function validateUpTo(count) {
      for (let i = 0; i < count; i++) {
        const msg = problemWith(FIELDS[i]);
        if (msg) { fail(FIELDS[i], msg); return false; }
      }
      return true;
    }

    FIELDS.forEach(function (f, i) {
      // Phone keyboards show "Next" instead of a plain return key
      if (f.el.tagName === "INPUT") f.el.setAttribute("enterkeyhint", "next");

      f.el.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" || e.isComposing) return;
        if (f.el.tagName === "TEXTAREA" && e.shiftKey) return;   // Shift+Enter = new line

        e.preventDefault();                       // never submit by accident

        if (!validateUpTo(i + 1)) return;         // earlier fields must be OK too
        clearErrors();

        if (i < FIELDS.length - 1) {
          goTo(FIELDS[i + 1].el);                 // next field
        } else {
          // After the Description: the photo section (optional), or Submit when all 3 photos are in
          const add = $("addPhotoBtn");
          if (add) goTo(add); else submitBtn.click();
        }
      });

      // Remove the red outline as soon as the resident fixes the field
      f.el.addEventListener("input", function () {
        f.el.classList.remove("field-invalid");
        f.el.removeAttribute("aria-invalid");
      });
      f.el.addEventListener("change", function () {
        f.el.classList.remove("field-invalid");
        f.el.removeAttribute("aria-invalid");
      });
    });

    // Clicking "Submit Report" is checked the same way
    form.addEventListener("submit", function (e) {
      if (!validateUpTo(FIELDS.length)) {
        e.preventDefault();
        e.stopImmediatePropagation();   // the submit handler below will not run
      } else {
        clearErrors();
      }
    });

    // Start on the first field (computers only, so phones don't pop the keyboard)
    if (location.hash !== "#track" && window.matchMedia("(min-width: 901px)").matches) {
      FIELDS[0].el.focus({ preventScroll: true });
    }
  }
  initFormNav();

  // ---------- Submit a report ----------
  $("reportForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const ok = $("successMsg");
    const bad = $("formError");
    ok.hidden = true;
    bad.hidden = true;

    const fullName = $("fullName").value.trim();
    const contact = $("contact").value.trim();
    const type = $("type").value;
    const place = $("location").value.trim();
    const description = $("description").value.trim();

    function showError(text) {
      bad.textContent = text;
      bad.hidden = false;
      bad.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (!fullName || !contact || !type || !place || !description) return showError("Please fill in all the required fields.");
    if (!/^[0-9+\-\s()]{7,30}$/.test(contact) || contact.replace(/\D/g, "").length < 7) {
      return showError("Please enter a valid contact number (numbers only, for example 0917 123 4567).");
    }
    if (pending > 0) return showError("Please wait a moment: your photos are still loading.");

    const btn = $("submitBtn");
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Submitting...";

    try {
      const res = BC.addReport({
        residentName: fullName, contact: contact, type: type,
        location: place, description: description,
        photos: photos.map(function (p) { return p.src; })
      });
      if (res.error) return showError(res.error);

      $("successNo").textContent = "Report No.: " + res.report.reportNo + " (keep this number to look up your report later)";
      ok.hidden = false;
      ok.scrollIntoView({ behavior: "smooth", block: "center" });

      // Clear EVERY field and photo so the form is ready for a new report
      $("reportForm").reset();
      clearPhotos();
      document.querySelectorAll("#reportForm .field-invalid").forEach(function (el) {
        el.classList.remove("field-invalid");
        el.removeAttribute("aria-invalid");
      });
      // On computers, put the cursor back in the first box (not on phones: it would pop the keyboard)
      if (window.matchMedia("(min-width: 901px)").matches) $("fullName").focus({ preventScroll: true });
      render();
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });

  // ---------- Look up a report by number ----------
  $("trackBtn").addEventListener("click", lookup);
  $("trackNo").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); lookup(); }
  });

  function lookup() {
    const msg = $("trackMsg");
    msg.hidden = true;
    $("trackResult").innerHTML = "";
    const no = $("trackNo").value.trim();
    if (!no) {
      msg.textContent = "Type your report number first.";
      msg.hidden = false;
      return;
    }
    const r = BC.findByReportNo(no);
    if (!r) {
      msg.textContent = "No report found with that number in this browser. Check the number and try again.";
      msg.hidden = false;
      return;
    }
    BC.rememberReport(r.id);      // keep it in the list below
    $("trackNo").value = "";
    render();
  }

  // ---------- My reports ----------
  function render() {
    const reports = BC.getMyReports();

    // Tell the resident when an official changes something.
    reports.forEach(function (r) {
      const prev = known[r.id];
      if (!firstRender && prev && (prev.status !== r.status || prev.remarks !== (r.remarks || ""))) {
        BC.toast("Update on " + r.reportNo + ": now " + r.status, "success");
      }
      known[r.id] = { status: r.status, remarks: r.remarks || "" };
    });
    firstRender = false;

    const counts = {};
    BC.STATUSES.forEach(function (s) { counts[s] = 0; });
    reports.forEach(function (r) { if (counts[r.status] !== undefined) counts[r.status]++; });
    $("miniStats").innerHTML = reports.length
      ? "<span>Total: " + reports.length + "</span>" + BC.STATUSES.map(function (s) { return "<span>" + BC.esc(s) + ": " + counts[s] + "</span>"; }).join("")
      : "";

    $("reportList").innerHTML = reports.length
      ? reports.map(reportCard).join("")
      : '<p class="empty">No reports yet. Use the form above to send your first one.</p>';
  }

  function reportCard(r) {
    const pics = BC.getPhotos(r);
    const history = (r.history || []).slice().reverse();
    return '' +
      '<article class="card report">' +
        '<div class="report-head"><span class="id">' + BC.esc(r.reportNo) + '</span>' + BC.statusBadge(r.status) + '</div>' +
        '<div class="report-meta">' +
          '<span><strong>' + BC.esc(r.type) + '</strong></span>' +
          '<span>Location: ' + BC.esc(r.location) + '</span>' +
          '<span>Submitted: ' + BC.esc(BC.fmtDate(r.createdAt)) + '</span>' +
        '</div>' +
        '<p class="desc">' + BC.esc(r.description) + '</p>' +
        (pics.length
          ? '<div class="photo-gallery">' + pics.map(function (p, i) {
              return '<img src="' + BC.esc(p) + '" alt="Photo evidence ' + (i + 1) + '" title="Click to open" data-photo="' + i + '" data-rid="' + BC.esc(r.id) + '">';
            }).join("") + '</div>'
          : '') +
        '<p class="small muted">' + BC.esc(BC.STATUS_INFO[r.status] || "") + '</p>' +
        (r.remarks ? '<div class="remarks-box"><strong>Latest remarks from barangay officials</strong>' + BC.esc(r.remarks) + '</div>' : '') +
        (history.length ?
          '<details class="history"><summary>Status timeline (' + history.length + ')</summary><ol class="timeline">' +
          history.map(function (h) {
            return '<li>' + BC.statusBadge(h.status) + '<div class="when">' + BC.esc(BC.fmtDate(h.at)) + '</div>' +
              (h.remarks ? '<p class="note">' + BC.esc(h.remarks) + '</p>' : '') + '</li>';
          }).join("") + '</ol></details>' : '') +
      '</article>';
  }

  // Click a photo in "Track My Report" to open it full size
  $("reportList").addEventListener("click", function (e) {
    const img = e.target.closest("img[data-photo]");
    if (!img) return;
    const r = BC.getMyReports().find(function (x) { return x.id === img.dataset.rid; });
    if (r) BC.openImage(BC.getPhotos(r)[Number(img.dataset.photo)]);
  });

  render();
  BC.onChange(render);   // another tab (the admin) changed something
})();
