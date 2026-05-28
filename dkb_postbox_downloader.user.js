// ==UserScript==
// @name         DKB Postbox Downloader
// @namespace    https://github.com/norschel/DKB-Postbox-Downloader
// @version      1.1.0
// @description  Lädt Dokumente aus dem DKB-Postfach herunter. Konfigurierbar über ein Panel mit Quellen- und Datumsfilter.
// @author       norschel
// @match        https://banking.dkb.de/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  const BASE_URL = 'https://banking.dkb.de/api/documentstorage';
  const PANEL_ID = 'dkbdl-panel';
  const BTN_ID   = 'dkbdl-btn';

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    #${BTN_ID} {
      position: fixed !important;
      top: 24px !important;
      right: 24px !important;
      z-index: 2147483647 !important;
      background: #2e7d32 !important;
      color: #fff !important;
      border: none !important;
      border-radius: 8px !important;
      padding: 10px 16px !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      box-shadow: 0 2px 8px rgba(0,0,0,.35) !important;
      font-family: sans-serif !important;
      line-height: 1.4 !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      margin: 0 !important;
      width: auto !important;
      height: auto !important;
      text-transform: none !important;
      pointer-events: auto !important;
    }
    #${BTN_ID}:hover { background: #1b5e20 !important; }

    #${PANEL_ID} {
      position: fixed;
      top: 70px;
      right: 24px;
      z-index: 2147483645;
      width: 360px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.22);
      font-family: sans-serif;
      font-size: 14px;
      color: #222;
      display: none;
      flex-direction: column;
      max-height: calc(100vh - 110px);
      overflow: hidden;
    }
    #${PANEL_ID}.dkbdl-open { display: flex; }

    .dkbdl-header {
      background: #1976d2;
      color: #fff;
      padding: 14px 16px;
      font-size: 15px;
      font-weight: 700;
      border-radius: 12px 12px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .dkbdl-close-btn {
      background: none;
      border: none;
      color: #fff;
      font-size: 18px;
      cursor: pointer;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .dkbdl-close-btn:hover { background: rgba(255,255,255,.2); }

    .dkbdl-body {
      padding: 16px;
      overflow-y: auto;
      flex: 1;
    }

    .dkbdl-section-title {
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: #777;
      margin: 16px 0 8px;
    }
    .dkbdl-section-title:first-child { margin-top: 0; }

    .dkbdl-check-row {
      display: flex;
      align-items: center;
      margin: 5px 0;
    }
    .dkbdl-check-row label {
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dkbdl-check-row input[type=checkbox] {
      width: 15px;
      height: 15px;
      cursor: pointer;
      flex-shrink: 0;
    }
    .dkbdl-check-row.dkbdl-all-row label { font-weight: 600; }

    .dkbdl-divider {
      height: 1px;
      background: #eee;
      margin: 14px 0;
    }

    .dkbdl-date-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 4px;
    }
    .dkbdl-date-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .dkbdl-date-field span {
      font-size: 12px;
      color: #666;
      font-weight: 600;
    }
    .dkbdl-date-field input[type=date] {
      border: 1px solid #ccc;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 13px;
      font-family: inherit;
      width: 100%;
      box-sizing: border-box;
      color: #222;
    }
    .dkbdl-date-field input[type=date]:focus {
      outline: 2px solid #1976d2;
      border-color: transparent;
    }

    .dkbdl-log {
      margin-top: 12px;
      background: #f5f5f5;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 11px;
      font-family: monospace;
      color: #333;
      max-height: 130px;
      overflow-y: auto;
      display: none;
    }
    .dkbdl-log.dkbdl-log-visible { display: block; }
    .dkbdl-log-line { margin: 2px 0; white-space: pre-wrap; word-break: break-all; }
    .dkbdl-log-error { color: #c62828; }
    .dkbdl-log-warn  { color: #e65100; }
    .dkbdl-log-ok    { color: #2e7d32; font-weight: 600; }

    .dkbdl-status {
      font-size: 12px;
      color: #666;
      margin-top: 8px;
      min-height: 16px;
    }

    .dkbdl-footer {
      padding: 12px 16px;
      border-top: 1px solid #eee;
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    .dkbdl-start-btn {
      flex: 1;
      background: #1976d2;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .dkbdl-start-btn:hover:not(:disabled) { background: #1565c0; }
    .dkbdl-start-btn:disabled { background: #90a4ae; cursor: not-allowed; }
    .dkbdl-cancel-btn {
      background: #fce4e4;
      color: #c62828;
      border: 1px solid #ef9a9a;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 14px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 600;
    }
    .dkbdl-cancel-btn:hover { background: #ffcdd2; }
  `;
  styleEl.id = 'dkbdl-style';
  function ensureStyle() {
    if (!document.getElementById('dkbdl-style')) {
      (document.head || document.documentElement).appendChild(styleEl);
    }
  }
  ensureStyle();

  // ---------------------------------------------------------------------------
  // Build panel DOM
  // ---------------------------------------------------------------------------
  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'DKB Postbox Downloader');
    panel.innerHTML = `
      <div class="dkbdl-header">
        <span>📥 DKB Postbox Downloader</span>
        <button class="dkbdl-close-btn" id="dkbdl-close-btn" title="Schließen" aria-label="Schließen">✕</button>
      </div>
      <div class="dkbdl-body">

        <div class="dkbdl-section-title">Quellen</div>

        <div class="dkbdl-check-row dkbdl-all-row">
          <label>
            <input type="checkbox" id="dkbdl-all" checked>
            Alle
          </label>
        </div>
        <div class="dkbdl-check-row">
          <label>
            <input type="checkbox" id="dkbdl-inbox" checked>
            Posteingang
          </label>
        </div>
        <div class="dkbdl-check-row">
          <label>
            <input type="checkbox" id="dkbdl-archive" checked>
            Modernes Archiv
          </label>
        </div>
        <div class="dkbdl-check-row">
          <label>
            <input type="checkbox" id="dkbdl-legacy-docs" checked>
            Legacy-Dokumente
          </label>
        </div>
        <div class="dkbdl-check-row">
          <label>
            <input type="checkbox" id="dkbdl-legacy-folders" checked>
            Legacy-Ordnerarchiv
          </label>
        </div>

        <div class="dkbdl-divider"></div>
        <div class="dkbdl-section-title">Zeitraum</div>

        <div class="dkbdl-date-grid">
          <div class="dkbdl-date-field">
            <span>Von</span>
            <input type="date" id="dkbdl-start-date" aria-label="Startdatum">
          </div>
          <div class="dkbdl-date-field">
            <span>Bis</span>
            <input type="date" id="dkbdl-end-date" aria-label="Enddatum">
          </div>
        </div>

        <div id="dkbdl-log" class="dkbdl-log" role="log" aria-live="polite"></div>
        <div id="dkbdl-status" class="dkbdl-status"></div>

      </div>
      <div class="dkbdl-footer">
        <button class="dkbdl-start-btn" id="dkbdl-start-btn">▶ Download starten</button>
        <button class="dkbdl-cancel-btn" id="dkbdl-cancel-btn" style="display:none">✕ Abbrechen</button>
      </div>
    `;
    return panel;
  }

  // ---------------------------------------------------------------------------
  // Log / status helpers
  // ---------------------------------------------------------------------------
  function logLine(text, type) {
    const log = document.getElementById('dkbdl-log');
    if (log) {
      const div = document.createElement('div');
      div.className = 'dkbdl-log-line' + (type ? ` dkbdl-log-${type}` : '');
      div.textContent = text;
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
    }
    if (type === 'error') console.error('[DKB]', text);
    else if (type === 'warn') console.warn('[DKB]', text);
    else console.log('[DKB]', text);
  }

  function clearLog() {
    const log = document.getElementById('dkbdl-log');
    if (log) log.innerHTML = '';
  }

  function showLog(visible) {
    const log = document.getElementById('dkbdl-log');
    if (log) log.classList.toggle('dkbdl-log-visible', visible);
  }

  function setStatus(text) {
    const el = document.getElementById('dkbdl-status');
    if (el) el.textContent = text;
  }

  // ---------------------------------------------------------------------------
  // Inject UI into page
  // ---------------------------------------------------------------------------
  function injectUI() {
    // Floating toggle button
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.textContent = '📥 DKB Download';
    btn.setAttribute('aria-haspopup', 'dialog');
    document.body.appendChild(btn);

    // Panel
    const panel = buildPanel();
    document.body.appendChild(panel);

    // "Alle" checkbox ↔ individual source checkboxes
    const allCb = panel.querySelector('#dkbdl-all');
    const sourceCbs = ['dkbdl-inbox', 'dkbdl-archive', 'dkbdl-legacy-docs', 'dkbdl-legacy-folders']
      .map(id => panel.querySelector(`#${id}`));

    function syncAllCheckbox() {
      const checkedCount = sourceCbs.filter(c => c.checked).length;
      allCb.checked       = checkedCount === sourceCbs.length;
      allCb.indeterminate = checkedCount > 0 && checkedCount < sourceCbs.length;
    }

    allCb.addEventListener('change', () => {
      sourceCbs.forEach(cb => { cb.checked = allCb.checked; });
    });
    sourceCbs.forEach(cb => cb.addEventListener('change', syncAllCheckbox));

    // Toggle panel on button click
    btn.addEventListener('click', () => {
      panel.classList.toggle('dkbdl-open');
    });

    // Close button
    panel.querySelector('#dkbdl-close-btn').addEventListener('click', () => {
      panel.classList.remove('dkbdl-open');
    });

    // Close panel on Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && panel.classList.contains('dkbdl-open')) {
        panel.classList.remove('dkbdl-open');
      }
    });

    // Download button
    const startBtn  = panel.querySelector('#dkbdl-start-btn');
    const cancelBtn = panel.querySelector('#dkbdl-cancel-btn');
    let abortController = null;

    startBtn.addEventListener('click', async () => {
      const config = {
        includeInbox:           panel.querySelector('#dkbdl-inbox').checked,
        includeArchive:         panel.querySelector('#dkbdl-archive').checked,
        includeLegacyDocuments: panel.querySelector('#dkbdl-legacy-docs').checked,
        includeLegacyFolders:   panel.querySelector('#dkbdl-legacy-folders').checked,
        startDate: panel.querySelector('#dkbdl-start-date').value || '',
        endDate:   panel.querySelector('#dkbdl-end-date').value   || '',
      };

      if (!config.includeInbox && !config.includeArchive &&
          !config.includeLegacyDocuments && !config.includeLegacyFolders) {
        setStatus('⚠ Bitte mindestens eine Quelle auswählen.');
        return;
      }

      startBtn.disabled = true;
      cancelBtn.style.display = '';
      clearLog();
      showLog(true);
      setStatus('');

      abortController = new AbortController();

      try {
        await startDownload(config, abortController.signal);
      } catch (err) {
        if (err.name === 'AbortError') {
          logLine('Download wurde abgebrochen.', 'warn');
          setStatus('Download abgebrochen.');
        } else {
          logLine(`Fehler: ${err.message}`, 'error');
          setStatus('Fehler beim Download.');
        }
      } finally {
        startBtn.disabled = false;
        cancelBtn.style.display = 'none';
        abortController = null;
      }
    });

    cancelBtn.addEventListener('click', () => {
      if (abortController) abortController.abort();
    });
  }

  // ---------------------------------------------------------------------------
  // Date range helper
  // ---------------------------------------------------------------------------
  function isInDateRange(dateStr, startDate, endDate) {
    if (!dateStr) return true;
    if (startDate && dateStr < startDate) return false;
    if (endDate   && dateStr > endDate)   return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Helpers – ported from dkb_download_devtools.js
  // ---------------------------------------------------------------------------

  /** Maps documentType values to human-readable prefix names. */
  const DOCTYPE_MAPPING = {
    bankAccountStatement:     'Kontoauszuege',
    creditCardStatement:      'Kreditkartenabrechnungen',
    dwpRevenueStatement:      'Wertpapierdokumente',
    dwpOrderStatement:        'Wertpapierdokumente',
    dwpDepotStatement:        'Wertpapierdokumente',
    exAnteCostInformation:    'Wertpapierdokumente',
    dwpCorporateActionNotice: 'Wertpapierdokumente',
  };

  /** Replicates dkb-robo's get_valid_filename() sanitisation. */
  function getValidFilename(name) {
    let s = String(name).replace(/[^\w\-\.]/gu, ' ').trim();
    const dotIdx   = s.lastIndexOf('.');
    const stem     = dotIdx > 0 ? s.slice(0, dotIdx) : s;
    const ext      = dotIdx > 0 ? s.slice(dotIdx)    : '';
    const safeStem = stem.split(/\s+/).filter(Boolean).join('_');
    return safeStem ? safeStem + ext : `unnamed_${Date.now()}.pdf`;
  }

  /** Normalise legacy api.dkb.de host to banking.dkb.de. */
  function fixLinkUrl(url) {
    return url.replace('https://api.dkb.de/documentstorage/', BASE_URL + '/');
  }

  /** Return category label for a documentType string. */
  function getCategory(documentType) {
    return DOCTYPE_MAPPING[documentType] || documentType || 'Sonstige';
  }

  /** Derive the best ISO date string from document metadata. */
  function getDate(metadata) {
    if (!metadata) return new Date().toISOString().slice(0, 10);
    if (metadata.statementDate)     return metadata.statementDate.slice(0, 10);
    if (metadata.statementDateTime) return metadata.statementDateTime.slice(0, 10);
    if (metadata.creationDate)      return metadata.creationDate.slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  }

  /** Build the local filename for a document. */
  function buildFilename(docAttrs) {
    const metadata = docAttrs.metadata || {};
    let name = docAttrs.fileName || '';
    if (metadata.dwpDocumentId && metadata.subject) {
      name = metadata.subject || name;
    }
    if (docAttrs.contentType === 'application/pdf' && !name.endsWith('.pdf')) {
      name = `${name}.pdf`;
    }
    return getValidFilename(name);
  }

  /** Trigger a browser download from a Blob. */
  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement('a'), {
      href:     url,
      download: filename,
      style:    'display:none',
    });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---------------------------------------------------------------------------
  // API helpers – ported from dkb_download_devtools.js
  // ---------------------------------------------------------------------------

  async function fetchAllPages(firstUrl, label, signal) {
    let all = [];
    let url = firstUrl;
    while (url) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const resp = await fetch(url, { credentials: 'include', signal });
      if (!resp.ok) {
        logLine(`${label}: HTTP ${resp.status} – wird übersprungen.`, 'warn');
        return null;
      }
      const json = await resp.json();
      all = all.concat(json.data || []);
      url = json.links?.next ? fixLinkUrl(json.links.next) : null;
    }
    return all;
  }

  async function fetchMessages(archived, signal) {
    const label = archived ? 'Archiv-Nachrichten' : 'Posteingangs-Nachrichten';
    if (archived) {
      const r1 = await fetchAllPages(`${BASE_URL}/messages?filter[archived]=true`, label, signal);
      if (r1 !== null) return r1;
      const r2 = await fetchAllPages(`${BASE_URL}/archive/messages`, `${label} (Fallback)`, signal);
      if (r2 !== null) return r2;
      logLine('Kein Archiv-Nachrichten-Endpunkt gefunden – wird übersprungen.', 'warn');
      return [];
    }
    const r = await fetchAllPages(`${BASE_URL}/messages`, label, signal);
    if (r === null) throw new Error('/messages-Endpunkt nicht erreichbar');
    return r;
  }

  async function fetchDocuments(archived, signal) {
    const label = archived ? 'Archiv-Dokumente' : 'Posteingangs-Dokumente';
    if (archived) {
      const r1 = await fetchAllPages(
        `${BASE_URL}/documents?filter[archived]=true&page[limit]=1000`, label, signal);
      if (r1 !== null) return r1;
      const r2 = await fetchAllPages(
        `${BASE_URL}/archive/documents?page[limit]=1000`, `${label} (Fallback)`, signal);
      if (r2 !== null) return r2;
      logLine('Kein Archiv-Dokumente-Endpunkt gefunden – wird übersprungen.', 'warn');
      return [];
    }
    const r = await fetchAllPages(`${BASE_URL}/documents?page[limit]=1000`, label, signal);
    if (r === null) throw new Error('/documents-Endpunkt nicht erreichbar');
    return r;
  }

  async function fetchFolderList(signal) {
    const resp = await fetch(`${BASE_URL}/folders`, { credentials: 'include', signal });
    if (!resp.ok) {
      logLine(`/folders: HTTP ${resp.status} – Legacy-Ordnerarchiv wird übersprungen.`, 'warn');
      return [];
    }
    const json = await resp.json();
    if (Array.isArray(json.data)) return json.data;
    if (json.data && Array.isArray(json.data.attributes?.subfolders))
      return json.data.attributes.subfolders;
    if (Array.isArray(json)) return json;
    return [];
  }

  async function fetchFolderContents(folderId, folderPath, signal) {
    const PAGE_LIMIT = 200;
    let offset = 0;
    let allFiles = [];

    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const url = `${BASE_URL}/folders/${folderId}?page%5Blimit%5D=${PAGE_LIMIT}&page%5Boffset%5D=${offset}`;
      const resp = await fetch(url, { credentials: 'include', signal });
      if (!resp.ok) {
        logLine(`/folders/${folderId} (Offset ${offset}): HTTP ${resp.status} – übersprungen.`, 'warn');
        break;
      }
      const json = await resp.json();
      const attrs = (json.data && json.data.attributes) || {};
      const files = attrs.files || [];

      allFiles = allFiles.concat(files.map(f => ({
        id:           f.id,
        subject:      f.subject || '',
        fileName:     f.fileName || '',
        creationDate: f.creationDate || '',
        folderPath,
      })));

      // Recurse into subfolders (only on the first page to avoid re-processing).
      if (offset === 0 && Array.isArray(attrs.subfolders)) {
        for (const sub of attrs.subfolders) {
          const subId   = sub.id   || String(sub);
          const subName = sub.name || sub.attributes?.name || subId;
          const subPath = `${folderPath}/${subName}`;
          logLine(`  Unterordner: ${subPath}`);
          const subFiles = await fetchFolderContents(subId, subPath, signal);
          allFiles = allFiles.concat(subFiles);
        }
      }

      if (files.length < PAGE_LIMIT) break;
      offset += PAGE_LIMIT;
    }

    return allFiles;
  }

  async function fetchAllLegacyFolderFiles(signal) {
    const folders = await fetchFolderList(signal);
    if (folders.length === 0) return [];

    logLine(`Legacy-Ordner gefunden: ${folders.length}`);
    let allFiles = [];

    for (const folder of folders) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const folderId   = folder.id   || String(folder);
      const folderName = folder.name || folder.attributes?.name || folderId;
      logLine(`Lese Legacy-Ordner: ${folderName}`);
      const files = await fetchFolderContents(folderId, folderName, signal);
      logLine(`  → ${files.length} Datei(en)`);
      allFiles = allFiles.concat(files);
    }

    return allFiles;
  }

  async function fetchLegacyDocumentList(signal) {
    const r = await fetchAllPages(`${BASE_URL}/legacy-documents`, 'legacy-documents', signal);
    if (r === null) {
      logLine('/legacy-documents nicht verfügbar – wird übersprungen.', 'warn');
      return [];
    }
    return r;
  }

  async function fetchLegacyDocumentBlob(id, signal) {
    const resp = await fetch(`${BASE_URL}/legacy-documents/${id}`, { credentials: 'include', signal });
    if (!resp.ok) {
      logLine(`  ✗ HTTP ${resp.status} – legacy-document ${id}`, 'warn');
      return null;
    }
    const json = await resp.json();
    const attrs = (json.data && json.data.attributes) || {};
    const base64Content = attrs.content || '';
    const contentType   = attrs.contentType || 'application/pdf';

    const binary = atob(base64Content);
    const bytes  = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
    return new Blob([bytes], { type: contentType });
  }

  // ---------------------------------------------------------------------------
  // Main download orchestration
  // ---------------------------------------------------------------------------
  async function startDownload(config, signal) {
    logLine('Starte Download …');

    const dateInfo = (config.startDate || config.endDate)
      ? ` | Zeitraum: ${config.startDate || '∞'} – ${config.endDate || '∞'}`
      : '';
    logLine(`Konfiguration: ${[
      config.includeInbox           ? 'Posteingang'       : null,
      config.includeArchive         ? 'Archiv'            : null,
      config.includeLegacyDocuments ? 'Legacy-Dokumente'  : null,
      config.includeLegacyFolders   ? 'Legacy-Ordner'     : null,
    ].filter(Boolean).join(', ')}${dateInfo}`);

    // ------------------------------------------------------------------
    // 1. Fetch inbox + archive metadata
    // ------------------------------------------------------------------
    let inboxMessages = [], inboxDocs = [];
    if (config.includeInbox) {
      try {
        [inboxMessages, inboxDocs] = await Promise.all([
          fetchMessages(false, signal),
          fetchDocuments(false, signal),
        ]);
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        logLine(`Fehler beim Laden des Posteingangs: ${err.message}`, 'error');
        return;
      }
    }

    let archiveMessages = [], archiveDocs = [];
    if (config.includeArchive) {
      [archiveMessages, archiveDocs] = await Promise.all([
        fetchMessages(true, signal),
        fetchDocuments(true, signal),
      ]);
    }

    logLine(`Posteingang: ${inboxMessages.length} Nachricht(en), ${inboxDocs.length} Dokument(e).`);
    logLine(`Archiv: ${archiveMessages.length} Nachricht(en), ${archiveDocs.length} Dokument(e).`);

    const msgMap = {};
    for (const m of inboxMessages)   msgMap[m.id] = { ...m.attributes, _archived: false };
    for (const m of archiveMessages) msgMap[m.id] = { ...m.attributes, _archived: true  };

    const docMap = new Map();
    for (const d of inboxDocs)   docMap.set(d.id, { doc: d, fromArchive: false });
    for (const d of archiveDocs) {
      if (!docMap.has(d.id)) docMap.set(d.id, { doc: d, fromArchive: true });
    }

    const allDocuments = [...docMap.values()];
    logLine(`Gesamt Postfach + Archiv: ${allDocuments.length} Dokument(e) gefunden.`);

    let countOk = 0, countFailed = 0, countSkipped = 0;

    // ------------------------------------------------------------------
    // 2. Download regular postbox + modern archive
    // ------------------------------------------------------------------
    for (let i = 0; i < allDocuments.length; i++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const { doc, fromArchive } = allDocuments[i];
      const docAttrs = doc.attributes || {};
      const msgAttrs = msgMap[doc.id] || {};
      const metadata = docAttrs.metadata || {};

      const isArchived = msgAttrs._archived || fromArchive || msgAttrs.archived === true;
      const category   = getCategory(msgAttrs.documentType);
      const date       = getDate(metadata);

      if (!isInDateRange(date, config.startDate, config.endDate)) {
        countSkipped++;
        continue;
      }

      const fname    = buildFilename(docAttrs);
      const prefix   = isArchived ? `Archiv_${category}` : category;
      const fullName = `${prefix}_${date}_${fname}`;

      const docLink = fixLinkUrl((doc.links || {}).self || '');
      if (!docLink) {
        logLine(`[${i + 1}/${allDocuments.length}] Kein Download-Link für ${doc.id} – übersprungen.`, 'warn');
        countFailed++;
        continue;
      }

      logLine(`[${i + 1}/${allDocuments.length}] ${fullName}`);
      setStatus(`Lade Dokument ${i + 1} von ${allDocuments.length} …`);

      try {
        const resp = await fetch(docLink, {
          credentials: 'include',
          headers: { Accept: docAttrs.contentType || 'application/pdf' },
          signal,
        });

        if (!resp.ok) {
          logLine(`  ✗ HTTP ${resp.status} – übersprungen.`, 'warn');
          countFailed++;
        } else {
          const blob = await resp.blob();
          triggerDownload(blob, fullName);
          countOk++;
          await sleep(600);
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        logLine(`  ✗ Fehler: ${err.message}`, 'error');
        countFailed++;
      }
    }

    // ------------------------------------------------------------------
    // 3. Download legacy documents (/legacy-documents, base64 JSON)
    // ------------------------------------------------------------------
    const downloadedIds = new Set(allDocuments.map(({ doc }) => doc.id));

    if (config.includeLegacyDocuments) {
      logLine('Lade Liste der Legacy-Dokumente …');
      const legacyDocs = await fetchLegacyDocumentList(signal);
      logLine(`Legacy-Dokumente gefunden: ${legacyDocs.length}`);

      for (let i = 0; i < legacyDocs.length; i++) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const doc      = legacyDocs[i];
        const docAttrs = doc.attributes || {};

        if (downloadedIds.has(doc.id)) {
          countSkipped++;
          continue;
        }

        const date = docAttrs.creationDate
          ? docAttrs.creationDate.slice(0, 10)
          : new Date().toISOString().slice(0, 10);

        if (!isInDateRange(date, config.startDate, config.endDate)) {
          countSkipped++;
          continue;
        }

        let fname = getValidFilename(docAttrs.fileName || doc.id);
        if (docAttrs.contentType === 'application/pdf' && !fname.toLowerCase().endsWith('.pdf')) {
          fname += '.pdf';
        }
        const fullName = `LegacyDoc_${date}_${fname}`;

        logLine(`[legacy-doc ${i + 1}/${legacyDocs.length}] ${fullName}`);
        setStatus(`Lade Legacy-Dokument ${i + 1} von ${legacyDocs.length} …`);

        try {
          const blob = await fetchLegacyDocumentBlob(doc.id, signal);
          if (blob) {
            triggerDownload(blob, fullName);
            downloadedIds.add(doc.id);
            countOk++;
            await sleep(600);
          } else {
            countFailed++;
          }
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          logLine(`  ✗ Fehler: ${err.message}`, 'error');
          countFailed++;
        }
      }
    }

    // ------------------------------------------------------------------
    // 4. Download legacy folder archive
    // ------------------------------------------------------------------
    if (config.includeLegacyFolders) {
      logLine('Lade Legacy-Ordnerarchiv …');
      const legacyFiles = await fetchAllLegacyFolderFiles(signal);
      logLine(`Legacy-Ordner-Dateien gefunden: ${legacyFiles.length}`);

      const GENERIC_FILENAMES = new Set(['sbpk.pdf', 'document.pdf', 'dokument.pdf']);

      for (let i = 0; i < legacyFiles.length; i++) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const file = legacyFiles[i];

        if (downloadedIds.has(file.id)) {
          countSkipped++;
          continue;
        }

        const date = file.creationDate
          ? file.creationDate.slice(0, 10)
          : new Date().toISOString().slice(0, 10);

        if (!isInDateRange(date, config.startDate, config.endDate)) {
          countSkipped++;
          continue;
        }

        const fnLower    = file.fileName.toLowerCase();
        const useSubject = file.subject && (
          GENERIC_FILENAMES.has(fnLower) || file.fileName.length < 10
        );
        const baseName = useSubject ? file.subject : file.fileName;
        let fname = getValidFilename(baseName);
        if (!fname.toLowerCase().endsWith('.pdf')) fname += '.pdf';

        const folderPrefix = getValidFilename(file.folderPath).replace(/\./g, '_');
        const fullName     = `Legacy_${folderPrefix}_${date}_${fname}`;

        logLine(`[legacy-folder ${i + 1}/${legacyFiles.length}] ${fullName}`);
        setStatus(`Lade Legacy-Ordner-Datei ${i + 1} von ${legacyFiles.length} …`);

        try {
          const blob = await fetchLegacyDocumentBlob(file.id, signal);
          if (blob) {
            triggerDownload(blob, fullName);
            downloadedIds.add(file.id);
            countOk++;
            await sleep(600);
          } else {
            countFailed++;
          }
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          logLine(`  ✗ Fehler: ${err.message}`, 'error');
          countFailed++;
        }
      }
    }

    // ------------------------------------------------------------------
    // 5. Summary
    // ------------------------------------------------------------------
    const summary = `Fertig. ✓ ${countOk} heruntergeladen, ✗ ${countFailed} fehlgeschlagen, ⏭ ${countSkipped} übersprungen.`;
    logLine(summary, 'ok');
    setStatus(summary);
  }

  // ---------------------------------------------------------------------------
  // Bootstrap – robust against SPA re-renders that may remove our elements
  // ---------------------------------------------------------------------------
  function ensureUI() {
    if (!document.body) return;
    ensureStyle();
    if (!document.getElementById(BTN_ID) || !document.getElementById(PANEL_ID)) {
      // Remove any leftover stragglers before re-injecting.
      document.getElementById(BTN_ID)?.remove();
      document.getElementById(PANEL_ID)?.remove();
      try {
        injectUI();
        console.log('[DKB] UI injected.');
      } catch (e) {
        console.error('[DKB] Failed to inject UI:', e);
      }
    }
  }

  function bootstrap() {
    ensureUI();
    // Re-inject if the SPA replaces body contents.
    const observer = new MutationObserver(() => ensureUI());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    // Safety net: periodic check in case MutationObserver misses something.
    setInterval(ensureUI, 2000);
  }

  if (document.body) {
    bootstrap();
  } else {
    document.addEventListener('DOMContentLoaded', bootstrap);
    // Fallback if DOMContentLoaded already fired or is delayed.
    window.addEventListener('load', bootstrap);
  }
})();
