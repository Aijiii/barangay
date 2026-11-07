# Barangay Complaint & Report System - Local (localStorage) Version

No Firebase, no setup, **no resident login**. Unzip the folder and **double-click `index.html`**.
Residents land straight on the report form. Only barangay officials log in.

> Data is saved in the browser you use. A report made on a phone will NOT show on a computer.
> Two tabs of the SAME browser update each other live (resident page in one tab, admin in another).
> The admin password is visible in `storage.js`. Use this for demos and learning only.
> GitHub only shows these files. To use the system, open `index.html` from your computer
> (or turn on GitHub Pages in the repo Settings > Pages).

## Files (keep them all in ONE folder)
`index.html`, `admin-login.html`, `admin-dashboard.html`, `style.css`, `storage.js`, `resident.js`, `admin.js`

## Pages
The left sidebar has three items: **Report an Incident**, **Track My Report** (both on `index.html`) and **Barangay Admin** (`admin-login.html`). On phones the sidebar hides behind the ☰ button.

## Light / dark mode
- The **Light mode / Dark mode** button is in the sidebar (top bar on phones). The choice is remembered in the browser.
- The first time, it follows the device setting (light or dark).
- Light mode uses a soft **pearl white** instead of pure white.

## Report form keyboard shortcuts
| Key | What it does |
|---|---|
| **Enter** in Full name / Contact number / Location | Checks the field, then moves to the next one |
| **Enter** on Type of concern | Confirms the choice and moves on |
| **Enter** in Description | Moves to **Add Photo** (**Shift + Enter** = new line). Press Enter there to browse, or Tab to Submit Report |

- An empty or invalid required field shows a red message and the cursor goes back to it.
- Pressing Enter in an earlier field never submits the form by accident.

## Incident Photos
- Up to **3 photos** per report (JPG, JPEG, PNG or WebP, **5 MB** each). Click **Add Photo** or drag and drop images onto the box.
- Each photo shows a live preview with a small **X** to remove it. The counter shows `0 / 3 photos`.
- Photos are shrunk automatically so they fit in browser storage. Residents see them in **Track My Report**; officials see them in the report dialog (click a photo to open it full size).

## Try it
1. Open `index.html`, fill in the form (use Enter to move), and submit. Note the report number.
2. Open `admin-login.html` in a **second tab** (same browser). Login: `admin` / `admin123`.
3. Submit another report in the first tab: it appears in the admin tab by itself.
4. In the admin tab click **Update**, change the status and add remarks. The first tab updates by itself.

## How residents follow their report (no account)
- Reports sent from this browser are listed under **Track My Reports**.
- A resident can also type a report number (like `BRG-20261106-K4Q9`) into **Find Report**.

## Where to edit things
| I want to change... | Edit this file |
|---|---|
| Admin username / password | `storage.js` (top, `CONFIG`) |
| Concern types, statuses | `storage.js` (`CONCERN_TYPES`, `STATUSES`) |
| How data is saved / loaded, theme toggle | `storage.js` |
| Home page form, Enter-key navigation, Track My Reports | `resident.js` (`initFormNav`) |
| Admin table, search, update behavior | `admin.js` |
| Sidebar menu links (names, order, icons) | the `<aside class="sidebar">` block at the top of each `.html` file |
| Light colors (pearl white) / dark colors | `style.css`, top: `:root` (light) and `:root[data-theme="dark"]` (dark) |
| Sidebar width / phone menu | `style.css`, `--sidebar-w` |
| Page text and form fields | the three `.html` files |

If you add or rename a form field in an HTML file, add the same `id` in the matching `.js` file
(and in the `FIELDS` list inside `initFormNav` if it should be part of the Enter-key order).

## Reset all data
Open the browser's developer tools (F12) > Application > Local Storage, and delete keys starting with `bc_`.

## Want it to work across devices?
That needs a shared online database. See the Firebase version (`barangay-complaint-system` folder), which still has resident login.
