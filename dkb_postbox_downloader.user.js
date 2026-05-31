// ==UserScript==
// @name         DKB Postbox Downloader
// @namespace    https://github.com/norschel/DKB-Postbox-Downloader
// @version      1.2.0
// @description  Lädt Dokumente aus dem DKB-Postfach herunter. Mit Filter, ZIP-Export, Dark-Mode, i18n, Dry-Run und „nur neue seit letztem Lauf".
// @description:en Downloads documents from the DKB online banking inbox. With filters, ZIP export, dark mode, i18n, dry run and "only new since last run".
// @author       norschel
// @match        https://banking.dkb.de/*
// @homepageURL  https://github.com/norschel/DKB-Postbox-Downloader
// @supportURL   https://github.com/norschel/DKB-Postbox-Downloader/issues
// @updateURL    https://raw.githubusercontent.com/norschel/DKB-Postbox-Downloader/main/dkb_postbox_downloader.user.js
// @downloadURL  https://raw.githubusercontent.com/norschel/DKB-Postbox-Downloader/main/dkb_postbox_downloader.user.js
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_notification
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @run-at       document-end
// @noframes
// ==/UserScript==

/* global JSZip */

(function () {
  'use strict';

  // ===========================================================================
  // Module: Constants
  // ===========================================================================
  const BASE_URL = 'https://banking.dkb.de/api/documentstorage';
  const PANEL_ID = 'dkbdl-panel';
  const BTN_ID = 'dkbdl-btn';
  const TOAST_ID = 'dkbdl-toast';
  const STORAGE_PREFIX = 'dkbdl.v1.';

  const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3, none: 4 };

  // ===========================================================================
  // Module: Storage (GM_* with localStorage fallback)
  // ===========================================================================
  const Storage = (() => {
    const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
    function get(key, def) {
      try {
        if (hasGM) {
          const v = GM_getValue(STORAGE_PREFIX + key, undefined);
          return v === undefined ? def : v;
        }
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        return raw === null ? def : JSON.parse(raw);
      } catch (_) {
        return def;
      }
    }
    function set(key, value) {
      try {
        if (hasGM) {
          GM_setValue(STORAGE_PREFIX + key, value);
        } else {
          localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
        }
      } catch (_) {
        /* noop */
      }
    }
    return { get, set };
  })();

  // ===========================================================================
  // Module: i18n
  // ===========================================================================
  const I18n = (() => {
    const dicts = {
      de: {
        title: '📥 DKB Postbox Downloader',
        toggle: '📥 DKB Download',
        close: 'Schließen',
        sources: 'Quellen',
        all: 'Alle',
        inbox: 'Posteingang',
        archive: 'Modernes Archiv',
        legacyDocs: 'Legacy-Dokumente',
        legacyFolders: 'Legacy-Ordnerarchiv',
        period: 'Zeitraum',
        from: 'Von',
        to: 'Bis',
        categories: 'Kategorien',
        catKontoauszuege: 'Kontoauszüge',
        catKreditkarte: 'Kreditkartenabrechnungen',
        catWertpapier: 'Wertpapierdokumente',
        catOther: 'Sonstige / unbekannt',
        options: 'Optionen',
        onlyNew: 'Nur neue Dokumente seit letztem Lauf',
        onlyNewHelp: 'Überspringt Dokumente, die bereits in einem früheren Lauf heruntergeladen wurden.',
        dryRun: 'Trockenlauf (Dry Run)',
        dryRunHelp: 'Listet auf, was heruntergeladen würde, ohne tatsächlich Dateien zu speichern.',
        zipMode: 'Als ZIP herunterladen',
        zipModeHelp: 'Sammelt alle Dokumente in einer einzigen ZIP-Datei.',
        settings: 'Einstellungen',
        language: 'Sprache',
        theme: 'Design',
        themeLight: 'Hell',
        themeDark: 'Dunkel',
        themeAuto: 'Automatisch',
        logLevel: 'Log-Level',
        resetState: 'Verlauf der heruntergeladenen Dokumente zurücksetzen',
        stateInfo: (n, when) =>
          n > 0
            ? `Verlauf: ${n} Dokument(e), letzter Lauf ${when}`
            : 'Verlauf: noch kein Lauf gespeichert.',
        start: '▶ Download starten',
        pause: '⏸ Pause',
        resume: '▶ Fortsetzen',
        cancel: '✕ Abbrechen',
        chooseSource: '⚠ Bitte mindestens eine Quelle auswählen.',
        starting: 'Starte Download …',
        aborted: 'Download wurde abgebrochen.',
        abortedStatus: 'Download abgebrochen.',
        paused: 'Pausiert …',
        errorPrefix: 'Fehler',
        errorStatus: 'Fehler beim Download.',
        progress: (i, n) => `Lade Dokument ${i} von ${n} …`,
        progressLegacyDoc: (i, n) => `Lade Legacy-Dokument ${i} von ${n} …`,
        progressLegacyFolder: (i, n) => `Lade Legacy-Ordner-Datei ${i} von ${n} …`,
        zipping: 'Erzeuge ZIP-Datei …',
        zipReady: (name) => `ZIP fertig: ${name}`,
        summary: (ok, fail, skipped) =>
          `Fertig. ✓ ${ok} heruntergeladen, ✗ ${fail} fehlgeschlagen, ⏭ ${skipped} übersprungen.`,
        summaryDry: (ok, skipped) =>
          `Trockenlauf fertig. ▶ ${ok} würden heruntergeladen, ⏭ ${skipped} übersprungen.`,
        notificationTitle: 'DKB Postbox Downloader',
        stateReset: 'Verlauf zurückgesetzt.',
      },
      en: {
        title: '📥 DKB Postbox Downloader',
        toggle: '📥 DKB Download',
        close: 'Close',
        sources: 'Sources',
        all: 'All',
        inbox: 'Inbox',
        archive: 'Modern archive',
        legacyDocs: 'Legacy documents',
        legacyFolders: 'Legacy folder archive',
        period: 'Date range',
        from: 'From',
        to: 'To',
        categories: 'Categories',
        catKontoauszuege: 'Account statements',
        catKreditkarte: 'Credit card statements',
        catWertpapier: 'Securities documents',
        catOther: 'Other / unknown',
        options: 'Options',
        onlyNew: 'Only new documents since last run',
        onlyNewHelp: 'Skips documents that were already downloaded in a previous run.',
        dryRun: 'Dry run',
        dryRunHelp: 'Lists what would be downloaded without actually saving files.',
        zipMode: 'Download as ZIP',
        zipModeHelp: 'Bundles all documents into a single ZIP file.',
        settings: 'Settings',
        language: 'Language',
        theme: 'Theme',
        themeLight: 'Light',
        themeDark: 'Dark',
        themeAuto: 'Automatic',
        logLevel: 'Log level',
        resetState: 'Reset history of downloaded documents',
        stateInfo: (n, when) =>
          n > 0
            ? `History: ${n} document(s), last run ${when}`
            : 'History: no previous run stored.',
        start: '▶ Start download',
        pause: '⏸ Pause',
        resume: '▶ Resume',
        cancel: '✕ Cancel',
        chooseSource: '⚠ Please select at least one source.',
        starting: 'Starting download …',
        aborted: 'Download was cancelled.',
        abortedStatus: 'Download cancelled.',
        paused: 'Paused …',
        errorPrefix: 'Error',
        errorStatus: 'Error during download.',
        progress: (i, n) => `Downloading document ${i} of ${n} …`,
        progressLegacyDoc: (i, n) => `Downloading legacy document ${i} of ${n} …`,
        progressLegacyFolder: (i, n) => `Downloading legacy folder file ${i} of ${n} …`,
        zipping: 'Building ZIP file …',
        zipReady: (name) => `ZIP ready: ${name}`,
        summary: (ok, fail, skipped) =>
          `Done. ✓ ${ok} downloaded, ✗ ${fail} failed, ⏭ ${skipped} skipped.`,
        summaryDry: (ok, skipped) =>
          `Dry run done. ▶ ${ok} would be downloaded, ⏭ ${skipped} skipped.`,
        notificationTitle: 'DKB Postbox Downloader',
        stateReset: 'History cleared.',
      },
    };
    let current = Storage.get('lang', null);
    if (!current) {
      const nav = (navigator.language || 'de').toLowerCase();
      current = nav.startsWith('de') ? 'de' : 'en';
    }
    function set(lang) {
      if (dicts[lang]) {
        current = lang;
        Storage.set('lang', lang);
      }
    }
    function get() {
      return current;
    }
    function t(key, ...args) {
      const dict = dicts[current] || dicts.de;
      const v = dict[key];
      if (typeof v === 'function') return v(...args);
      if (typeof v === 'string') return v;
      return key;
    }
    function languages() {
      return Object.keys(dicts);
    }
    return { set, get, t, languages };
  })();

  // ===========================================================================
  // Module: Logger
  // ===========================================================================
  const Logger = (() => {
    let level = LOG_LEVELS[Storage.get('logLevel', 'info')] ?? LOG_LEVELS.info;
    let logEl = null;
    function setEl(el) {
      logEl = el;
    }
    function setLevel(name) {
      if (Object.prototype.hasOwnProperty.call(LOG_LEVELS, name)) {
        level = LOG_LEVELS[name];
        Storage.set('logLevel', name);
      }
    }
    function getLevelName() {
      return Object.keys(LOG_LEVELS).find((k) => LOG_LEVELS[k] === level) || 'info';
    }
    function logAt(lvlName, type, text) {
      if (LOG_LEVELS[lvlName] < level) return;
      if (logEl) {
        const div = document.createElement('div');
        div.className = 'dkbdl-log-line' + (type ? ` dkbdl-log-${type}` : '');
        div.textContent = text;
        logEl.appendChild(div);
        logEl.scrollTop = logEl.scrollHeight;
      }
      if (lvlName === 'error') console.error('[DKB]', text);
      else if (lvlName === 'warn') console.warn('[DKB]', text);
      else if (lvlName === 'debug') console.debug('[DKB]', text);
      else console.log('[DKB]', text);
    }
    return {
      setEl,
      setLevel,
      getLevelName,
      debug: (t) => logAt('debug', '', t),
      info: (t) => logAt('info', '', t),
      ok: (t) => logAt('info', 'ok', t),
      warn: (t) => logAt('warn', 'warn', t),
      error: (t) => logAt('error', 'error', t),
      clear: () => {
        if (logEl) logEl.innerHTML = '';
      },
    };
  })();

  // ===========================================================================
  // Module: Theme
  // ===========================================================================
  const Theme = (() => {
    let current = Storage.get('theme', 'auto'); // 'light' | 'dark' | 'auto'
    function effective() {
      if (current === 'auto') {
        const mql = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
        return mql && mql.matches ? 'dark' : 'light';
      }
      return current;
    }
    function apply() {
      const panel = document.getElementById(PANEL_ID);
      const eff = effective();
      if (panel) {
        panel.classList.toggle('dkbdl-dark', eff === 'dark');
        panel.classList.toggle('dkbdl-light', eff === 'light');
      }
    }
    function set(v) {
      if (v === 'light' || v === 'dark' || v === 'auto') {
        current = v;
        Storage.set('theme', v);
        apply();
      }
    }
    function get() {
      return current;
    }
    if (window.matchMedia) {
      try {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
      } catch (_) {
        /* Safari < 14 */
      }
    }
    return { set, get, apply };
  })();

  // ===========================================================================
  // Module: PersistedDocs (history of downloaded document IDs)
  // ===========================================================================
  const PersistedDocs = (() => {
    const MAX = 20000;
    function getIds() {
      const arr = Storage.get('downloadedIds', []);
      return new Set(Array.isArray(arr) ? arr : []);
    }
    function add(ids) {
      const set = getIds();
      for (const id of ids) set.add(id);
      let arr = Array.from(set);
      if (arr.length > MAX) arr = arr.slice(arr.length - MAX);
      Storage.set('downloadedIds', arr);
    }
    function getLastRun() {
      return Storage.get('lastRunAt', '') || '';
    }
    function setLastRun(iso) {
      Storage.set('lastRunAt', iso);
    }
    function reset() {
      Storage.set('downloadedIds', []);
      Storage.set('lastRunAt', '');
    }
    function count() {
      return getIds().size;
    }
    return { getIds, add, getLastRun, setLastRun, reset, count };
  })();

  // ===========================================================================
  // Module: Toast
  // ===========================================================================
  const Toast = (() => {
    function show(text, type) {
      let el = document.getElementById(TOAST_ID);
      if (!el) {
        el = document.createElement('div');
        el.id = TOAST_ID;
        document.body.appendChild(el);
      }
      el.textContent = text;
      el.className = 'dkbdl-toast-visible' + (type ? ` dkbdl-toast-${type}` : '');
      clearTimeout(el._hideTimer);
      el._hideTimer = setTimeout(() => {
        el.className = '';
      }, 5000);
    }
    function notify(text) {
      try {
        if (typeof GM_notification === 'function') {
          GM_notification({
            title: I18n.t('notificationTitle'),
            text,
            timeout: 8000,
            silent: false,
          });
          return;
        }
      } catch (_) {
        /* fallthrough */
      }
      show(text, 'ok');
    }
    return { show, notify };
  })();

  // ===========================================================================
  // Module: Styles
  // ===========================================================================
  const STYLE_CSS = `
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
      width: 380px;
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

    /* Dark theme */
    #${PANEL_ID}.dkbdl-dark { background: #1e1e1e; color: #e6e6e6; }
    #${PANEL_ID}.dkbdl-dark .dkbdl-header { background: #0d47a1; }
    #${PANEL_ID}.dkbdl-dark .dkbdl-section-title { color: #aaa; }
    #${PANEL_ID}.dkbdl-dark .dkbdl-divider { background: #333; }
    #${PANEL_ID}.dkbdl-dark .dkbdl-footer { border-top-color: #333; background: #1e1e1e; }
    #${PANEL_ID}.dkbdl-dark .dkbdl-log { background: #111; color: #ddd; }
    #${PANEL_ID}.dkbdl-dark input[type=date],
    #${PANEL_ID}.dkbdl-dark select {
      background: #2a2a2a; color: #e6e6e6; border-color: #444;
    }
    #${PANEL_ID}.dkbdl-dark .dkbdl-progress { background: #2a2a2a; }
    #${PANEL_ID}.dkbdl-dark .dkbdl-help { color: #aaa; }

    .dkbdl-header {
      background: #1976d2;
      color: #fff;
      padding: 12px 14px;
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

    .dkbdl-body { padding: 14px; overflow-y: auto; flex: 1; }

    .dkbdl-section-title {
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: #777;
      margin: 14px 0 6px;
    }
    .dkbdl-section-title:first-child { margin-top: 0; }

    .dkbdl-check-row { display: flex; align-items: center; margin: 4px 0; }
    .dkbdl-check-row label {
      cursor: pointer; user-select: none; display: flex; align-items: center; gap: 8px;
    }
    .dkbdl-check-row input[type=checkbox] {
      width: 15px; height: 15px; cursor: pointer; flex-shrink: 0;
    }
    .dkbdl-check-row.dkbdl-all-row label { font-weight: 600; }
    .dkbdl-help { font-size: 11px; color: #777; margin: 2px 0 6px 23px; }

    .dkbdl-divider { height: 1px; background: #eee; margin: 12px 0; }

    .dkbdl-date-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px;
    }
    .dkbdl-date-field { display: flex; flex-direction: column; gap: 4px; }
    .dkbdl-date-field span { font-size: 12px; color: #666; font-weight: 600; }
    .dkbdl-date-field input[type=date],
    .dkbdl-settings-grid select {
      border: 1px solid #ccc; border-radius: 6px; padding: 6px 8px;
      font-size: 13px; font-family: inherit; width: 100%; box-sizing: border-box; color: inherit;
      background: #fff;
    }
    .dkbdl-date-field input[type=date]:focus,
    .dkbdl-settings-grid select:focus {
      outline: 2px solid #1976d2; border-color: transparent;
    }

    .dkbdl-settings-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    }
    .dkbdl-settings-field { display: flex; flex-direction: column; gap: 4px; }
    .dkbdl-settings-field span { font-size: 12px; color: #666; font-weight: 600; }

    .dkbdl-link-btn {
      background: none; border: none; color: #1976d2; cursor: pointer;
      padding: 0; font: inherit; text-decoration: underline; margin-top: 6px;
    }
    #${PANEL_ID}.dkbdl-dark .dkbdl-link-btn { color: #82b1ff; }
    .dkbdl-state-info { font-size: 11px; color: #777; margin-top: 4px; }

    .dkbdl-log {
      margin-top: 10px;
      background: #f5f5f5;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 11px;
      font-family: monospace;
      color: #333;
      max-height: 140px;
      overflow-y: auto;
      display: none;
    }
    .dkbdl-log.dkbdl-log-visible { display: block; }
    .dkbdl-log-line { margin: 2px 0; white-space: pre-wrap; word-break: break-all; }
    .dkbdl-log-error { color: #c62828; }
    .dkbdl-log-warn  { color: #e65100; }
    .dkbdl-log-ok    { color: #2e7d32; font-weight: 600; }

    .dkbdl-progress-wrap { margin-top: 10px; }
    .dkbdl-progress {
      width: 100%; height: 10px; background: #eee; border-radius: 5px; overflow: hidden;
    }
    .dkbdl-progress-bar {
      height: 100%; width: 0%; background: linear-gradient(90deg,#1976d2,#42a5f5);
      transition: width .15s ease;
    }
    .dkbdl-counters {
      margin-top: 6px; font-size: 12px; display: flex; gap: 10px; flex-wrap: wrap;
      color: inherit;
    }
    .dkbdl-status { font-size: 12px; color: #666; margin-top: 6px; min-height: 16px; }
    #${PANEL_ID}.dkbdl-dark .dkbdl-status,
    #${PANEL_ID}.dkbdl-dark .dkbdl-date-field span,
    #${PANEL_ID}.dkbdl-dark .dkbdl-settings-field span,
    #${PANEL_ID}.dkbdl-dark .dkbdl-state-info { color: #bbb; }

    .dkbdl-footer {
      padding: 10px 14px; border-top: 1px solid #eee;
      display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap;
    }
    .dkbdl-start-btn {
      flex: 1 1 100%; background: #1976d2; color: #fff; border: none; border-radius: 8px;
      padding: 10px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit;
    }
    .dkbdl-start-btn:hover:not(:disabled) { background: #1565c0; }
    .dkbdl-start-btn:disabled { background: #90a4ae; cursor: not-allowed; }
    .dkbdl-pause-btn, .dkbdl-cancel-btn {
      flex: 1; border-radius: 8px; padding: 9px 10px; font-size: 13px;
      cursor: pointer; font-family: inherit; font-weight: 600;
    }
    .dkbdl-pause-btn { background: #fff3e0; color: #e65100; border: 1px solid #ffb74d; }
    .dkbdl-pause-btn:hover { background: #ffe0b2; }
    .dkbdl-cancel-btn { background: #fce4e4; color: #c62828; border: 1px solid #ef9a9a; }
    .dkbdl-cancel-btn:hover { background: #ffcdd2; }

    #${TOAST_ID} {
      position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%);
      background: #323232; color: #fff; padding: 10px 16px; border-radius: 6px;
      font-family: sans-serif; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,.3);
      z-index: 2147483647; opacity: 0; pointer-events: none;
      transition: opacity .25s ease;
    }
    #${TOAST_ID}.dkbdl-toast-visible { opacity: 1; }
    #${TOAST_ID}.dkbdl-toast-ok { background: #2e7d32; }
    #${TOAST_ID}.dkbdl-toast-error { background: #c62828; }
    #${TOAST_ID}.dkbdl-toast-warn { background: #e65100; }
  `;

  function ensureStyle() {
    if (document.getElementById('dkbdl-style')) return;
    try {
      if (typeof GM_addStyle === 'function') {
        const injected = GM_addStyle(STYLE_CSS);
        if (injected && injected.setAttribute) injected.id = 'dkbdl-style';
        return;
      }
    } catch (_) {
      /* fall through */
    }
    const el = document.createElement('style');
    el.id = 'dkbdl-style';
    el.textContent = STYLE_CSS;
    (document.head || document.documentElement).appendChild(el);
  }

  // ===========================================================================
  // Module: Domain helpers (filenames, dates, categories)
  // ===========================================================================
  const DOCTYPE_MAPPING = {
    bankAccountStatement: 'Kontoauszuege',
    creditCardStatement: 'Kreditkartenabrechnungen',
    dwpRevenueStatement: 'Wertpapierdokumente',
    dwpOrderStatement: 'Wertpapierdokumente',
    dwpDepotStatement: 'Wertpapierdokumente',
    exAnteCostInformation: 'Wertpapierdokumente',
    dwpCorporateActionNotice: 'Wertpapierdokumente',
  };

  /** Maps internal category key (used in filter UI) to category strings. */
  const CATEGORY_KEYS = {
    Kontoauszuege: 'catKontoauszuege',
    Kreditkartenabrechnungen: 'catKreditkarte',
    Wertpapierdokumente: 'catWertpapier',
    __other__: 'catOther',
  };

  function getCategory(documentType) {
    return DOCTYPE_MAPPING[documentType] || documentType || 'Sonstige';
  }

  /** Returns the key under which a category is filtered (group buckets). */
  function categoryFilterKey(category) {
    if (CATEGORY_KEYS[category]) return category;
    return '__other__';
  }

  function getValidFilename(name) {
    let s = String(name).replace(/[^\w\-.]/gu, ' ').trim();
    const dotIdx = s.lastIndexOf('.');
    const stem = dotIdx > 0 ? s.slice(0, dotIdx) : s;
    const ext = dotIdx > 0 ? s.slice(dotIdx) : '';
    const safeStem = stem.split(/\s+/).filter(Boolean).join('_');
    return safeStem ? safeStem + ext : `unnamed_${Date.now()}.pdf`;
  }

  function fixLinkUrl(url) {
    return url.replace('https://api.dkb.de/documentstorage/', BASE_URL + '/');
  }

  function getDate(metadata) {
    if (!metadata) return new Date().toISOString().slice(0, 10);
    if (metadata.statementDate) return metadata.statementDate.slice(0, 10);
    if (metadata.statementDateTime) return metadata.statementDateTime.slice(0, 10);
    if (metadata.creationDate) return metadata.creationDate.slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  }

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

  function isInDateRange(dateStr, startDate, endDate) {
    if (!dateStr) return true;
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: filename,
      style: 'display:none',
    });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  // ===========================================================================
  // Module: PauseController
  // ===========================================================================
  class PauseController {
    constructor() {
      this._paused = false;
      this._waiters = [];
    }
    pause() {
      this._paused = true;
    }
    resume() {
      this._paused = false;
      const w = this._waiters.splice(0);
      w.forEach((fn) => fn());
    }
    isPaused() {
      return this._paused;
    }
    async wait(signal) {
      if (!this._paused) return;
      Logger.info(I18n.t('paused'));
      await new Promise((resolve, reject) => {
        const onAbort = () => {
          this._waiters = this._waiters.filter((fn) => fn !== resolveFn);
          reject(new DOMException('Aborted', 'AbortError'));
        };
        const resolveFn = () => {
          if (signal) signal.removeEventListener('abort', onAbort);
          resolve();
        };
        this._waiters.push(resolveFn);
        if (signal) signal.addEventListener('abort', onAbort, { once: true });
      });
    }
  }

  // ===========================================================================
  // Module: API client
  // ===========================================================================
  const Api = (() => {
    async function fetchAllPages(firstUrl, label, signal) {
      let all = [];
      let url = firstUrl;
      while (url) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const resp = await fetch(url, { credentials: 'include', signal });
        if (!resp.ok) {
          Logger.warn(`${label}: HTTP ${resp.status} – wird übersprungen.`);
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
        const r1 = await fetchAllPages(
          `${BASE_URL}/messages?filter[archived]=true`,
          label,
          signal
        );
        if (r1 !== null) return r1;
        const r2 = await fetchAllPages(
          `${BASE_URL}/archive/messages`,
          `${label} (Fallback)`,
          signal
        );
        if (r2 !== null) return r2;
        Logger.warn('Kein Archiv-Nachrichten-Endpunkt gefunden – wird übersprungen.');
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
          `${BASE_URL}/documents?filter[archived]=true&page[limit]=1000`,
          label,
          signal
        );
        if (r1 !== null) return r1;
        const r2 = await fetchAllPages(
          `${BASE_URL}/archive/documents?page[limit]=1000`,
          `${label} (Fallback)`,
          signal
        );
        if (r2 !== null) return r2;
        Logger.warn('Kein Archiv-Dokumente-Endpunkt gefunden – wird übersprungen.');
        return [];
      }
      const r = await fetchAllPages(`${BASE_URL}/documents?page[limit]=1000`, label, signal);
      if (r === null) throw new Error('/documents-Endpunkt nicht erreichbar');
      return r;
    }

    async function fetchFolderList(signal) {
      const resp = await fetch(`${BASE_URL}/folders`, { credentials: 'include', signal });
      if (!resp.ok) {
        Logger.warn(`/folders: HTTP ${resp.status} – Legacy-Ordnerarchiv wird übersprungen.`);
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

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const url = `${BASE_URL}/folders/${folderId}?page%5Blimit%5D=${PAGE_LIMIT}&page%5Boffset%5D=${offset}`;
        const resp = await fetch(url, { credentials: 'include', signal });
        if (!resp.ok) {
          Logger.warn(`/folders/${folderId} (Offset ${offset}): HTTP ${resp.status} – übersprungen.`);
          break;
        }
        const json = await resp.json();
        const attrs = (json.data && json.data.attributes) || {};
        const files = attrs.files || [];

        allFiles = allFiles.concat(
          files.map((f) => ({
            id: f.id,
            subject: f.subject || '',
            fileName: f.fileName || '',
            creationDate: f.creationDate || '',
            folderPath,
          }))
        );

        if (offset === 0 && Array.isArray(attrs.subfolders)) {
          for (const sub of attrs.subfolders) {
            const subId = sub.id || String(sub);
            const subName = sub.name || sub.attributes?.name || subId;
            const subPath = `${folderPath}/${subName}`;
            Logger.debug(`  Unterordner: ${subPath}`);
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

      Logger.info(`Legacy-Ordner gefunden: ${folders.length}`);
      let allFiles = [];

      for (const folder of folders) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const folderId = folder.id || String(folder);
        const folderName = folder.name || folder.attributes?.name || folderId;
        Logger.info(`Lese Legacy-Ordner: ${folderName}`);
        const files = await fetchFolderContents(folderId, folderName, signal);
        Logger.debug(`  → ${files.length} Datei(en)`);
        allFiles = allFiles.concat(files);
      }

      return allFiles;
    }

    async function fetchLegacyDocumentList(signal) {
      const r = await fetchAllPages(`${BASE_URL}/legacy-documents`, 'legacy-documents', signal);
      if (r === null) {
        Logger.warn('/legacy-documents nicht verfügbar – wird übersprungen.');
        return [];
      }
      return r;
    }

    async function fetchLegacyDocumentBlob(id, signal) {
      const resp = await fetch(`${BASE_URL}/legacy-documents/${id}`, {
        credentials: 'include',
        signal,
      });
      if (!resp.ok) {
        Logger.warn(`  ✗ HTTP ${resp.status} – legacy-document ${id}`);
        return null;
      }
      const json = await resp.json();
      const attrs = (json.data && json.data.attributes) || {};
      const base64Content = attrs.content || '';
      const contentType = attrs.contentType || 'application/pdf';

      const binary = atob(base64Content);
      const bytes = new Uint8Array(binary.length);
      for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
      return new Blob([bytes], { type: contentType });
    }

    return {
      fetchMessages,
      fetchDocuments,
      fetchAllLegacyFolderFiles,
      fetchLegacyDocumentList,
      fetchLegacyDocumentBlob,
    };
  })();

  // ===========================================================================
  // Module: Progress
  // ===========================================================================
  const Progress = (() => {
    let barEl = null;
    let countersEl = null;
    let statusEl = null;
    let total = 0;
    let counts = { ok: 0, failed: 0, skipped: 0, done: 0 };
    function bind(bar, counters, status) {
      barEl = bar;
      countersEl = counters;
      statusEl = status;
    }
    function reset(t) {
      total = t || 0;
      counts = { ok: 0, failed: 0, skipped: 0, done: 0 };
      render();
    }
    function addToTotal(n) {
      total += n;
      render();
    }
    function tick(kind) {
      if (kind === 'ok') counts.ok++;
      else if (kind === 'failed') counts.failed++;
      else if (kind === 'skipped') counts.skipped++;
      counts.done = counts.ok + counts.failed + counts.skipped;
      render();
    }
    function setStatus(text) {
      if (statusEl) statusEl.textContent = text || '';
    }
    function render() {
      if (barEl) {
        const pct = total > 0 ? Math.min(100, Math.round((counts.done / total) * 100)) : 0;
        barEl.style.width = pct + '%';
      }
      if (countersEl) {
        countersEl.textContent =
          `✓ ${counts.ok}  ✗ ${counts.failed}  ⏭ ${counts.skipped}  /  ${total}`;
      }
    }
    function getCounts() {
      return { ...counts };
    }
    return { bind, reset, addToTotal, tick, setStatus, getCounts };
  })();

  // ===========================================================================
  // Module: Download orchestration
  // ===========================================================================
  const GENERIC_FILENAMES = new Set(['sbpk.pdf', 'document.pdf', 'dokument.pdf']);

  /** Build the list of all candidate downloads (without fetching blobs). */
  function buildCandidates(inputs) {
    const items = [];
    const { allDocuments, msgMap, legacyDocs, legacyFiles, config, persistedIds } = inputs;

    function inSelectedCategories(category) {
      if (!config.categoryFilter) return true;
      const k = categoryFilterKey(category);
      return !!config.categoryFilter[k];
    }
    function notSkippedByHistory(id) {
      if (!config.onlyNew) return true;
      return !persistedIds.has(id);
    }

    for (const { doc, fromArchive } of allDocuments) {
      const docAttrs = doc.attributes || {};
      const msgAttrs = msgMap[doc.id] || {};
      const metadata = docAttrs.metadata || {};
      const isArchived = msgAttrs._archived || fromArchive || msgAttrs.archived === true;
      const category = getCategory(msgAttrs.documentType);
      const date = getDate(metadata);

      const skip = !isInDateRange(date, config.startDate, config.endDate)
        || !inSelectedCategories(category)
        || !notSkippedByHistory(doc.id);

      const fname = buildFilename(docAttrs);
      const prefix = isArchived ? `Archiv_${category}` : category;
      const fullName = `${prefix}_${date}_${fname}`;
      const docLink = fixLinkUrl((doc.links || {}).self || '');

      items.push({
        kind: 'main',
        id: doc.id,
        fullName,
        skip,
        date,
        category,
        docAttrs,
        docLink,
      });
    }

    for (const doc of legacyDocs) {
      const docAttrs = doc.attributes || {};
      const date = docAttrs.creationDate
        ? docAttrs.creationDate.slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const category = 'Sonstige';
      let fname = getValidFilename(docAttrs.fileName || doc.id);
      if (docAttrs.contentType === 'application/pdf' && !fname.toLowerCase().endsWith('.pdf')) {
        fname += '.pdf';
      }
      const skip = !isInDateRange(date, config.startDate, config.endDate)
        || !inSelectedCategories(category)
        || !notSkippedByHistory(doc.id);
      items.push({
        kind: 'legacy-doc',
        id: doc.id,
        fullName: `LegacyDoc_${date}_${fname}`,
        skip,
        date,
        category,
      });
    }

    for (const file of legacyFiles) {
      const date = file.creationDate
        ? file.creationDate.slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const fnLower = (file.fileName || '').toLowerCase();
      const useSubject =
        file.subject && (GENERIC_FILENAMES.has(fnLower) || (file.fileName || '').length < 10);
      const baseName = useSubject ? file.subject : file.fileName;
      let fname = getValidFilename(baseName || file.id);
      if (!fname.toLowerCase().endsWith('.pdf')) fname += '.pdf';
      const folderPrefix = getValidFilename(file.folderPath || '').replace(/\./g, '_');
      const category = 'Sonstige';
      const skip = !isInDateRange(date, config.startDate, config.endDate)
        || !inSelectedCategories(category)
        || !notSkippedByHistory(file.id);
      items.push({
        kind: 'legacy-folder',
        id: file.id,
        fullName: `Legacy_${folderPrefix}_${date}_${fname}`,
        skip,
        date,
        category,
      });
    }

    return items;
  }

  async function startDownload(config, signal, pauser) {
    Logger.info(I18n.t('starting'));

    const dateInfo =
      config.startDate || config.endDate
        ? ` | Zeitraum: ${config.startDate || '∞'} – ${config.endDate || '∞'}`
        : '';
    Logger.info(
      `Konfiguration: ${[
        config.includeInbox ? 'Posteingang' : null,
        config.includeArchive ? 'Archiv' : null,
        config.includeLegacyDocuments ? 'Legacy-Dokumente' : null,
        config.includeLegacyFolders ? 'Legacy-Ordner' : null,
        config.dryRun ? 'Dry-Run' : null,
        config.zipMode ? 'ZIP' : null,
        config.onlyNew ? 'NurNeu' : null,
      ]
        .filter(Boolean)
        .join(', ')}${dateInfo}`
    );

    let inboxMessages = [], inboxDocs = [];
    if (config.includeInbox) {
      try {
        [inboxMessages, inboxDocs] = await Promise.all([
          Api.fetchMessages(false, signal),
          Api.fetchDocuments(false, signal),
        ]);
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        Logger.error(`Fehler beim Laden des Posteingangs: ${err.message}`);
        return;
      }
    }

    let archiveMessages = [], archiveDocs = [];
    if (config.includeArchive) {
      [archiveMessages, archiveDocs] = await Promise.all([
        Api.fetchMessages(true, signal),
        Api.fetchDocuments(true, signal),
      ]);
    }

    Logger.info(
      `Posteingang: ${inboxMessages.length} Nachricht(en), ${inboxDocs.length} Dokument(e).`
    );
    Logger.info(
      `Archiv: ${archiveMessages.length} Nachricht(en), ${archiveDocs.length} Dokument(e).`
    );

    const msgMap = {};
    for (const m of inboxMessages) msgMap[m.id] = { ...m.attributes, _archived: false };
    for (const m of archiveMessages) msgMap[m.id] = { ...m.attributes, _archived: true };

    const docMap = new Map();
    for (const d of inboxDocs) docMap.set(d.id, { doc: d, fromArchive: false });
    for (const d of archiveDocs) {
      if (!docMap.has(d.id)) docMap.set(d.id, { doc: d, fromArchive: true });
    }
    const allDocuments = [...docMap.values()];

    let legacyDocs = [];
    if (config.includeLegacyDocuments) {
      Logger.info('Lade Liste der Legacy-Dokumente …');
      legacyDocs = await Api.fetchLegacyDocumentList(signal);
      Logger.info(`Legacy-Dokumente gefunden: ${legacyDocs.length}`);
    }
    let legacyFiles = [];
    if (config.includeLegacyFolders) {
      Logger.info('Lade Legacy-Ordnerarchiv …');
      legacyFiles = await Api.fetchAllLegacyFolderFiles(signal);
      Logger.info(`Legacy-Ordner-Dateien gefunden: ${legacyFiles.length}`);
    }

    const persistedIds = PersistedDocs.getIds();
    const candidates = buildCandidates({
      allDocuments,
      msgMap,
      legacyDocs,
      legacyFiles,
      config,
      persistedIds,
    });

    const downloadable = candidates.filter((c) => !c.skip);
    const skippedUpfront = candidates.length - downloadable.length;
    Progress.reset(downloadable.length);
    // Count up-front skips immediately.
    for (let i = 0; i < skippedUpfront; i++) Progress.tick('skipped');
    // But re-render once total is set:
    // (tick already increments and renders; we keep skipped visible in counters)
    Logger.info(`Geplant: ${downloadable.length} Download(s), übersprungen vorab: ${skippedUpfront}.`);

    const newlyDownloadedIds = [];
    const zip = config.zipMode && !config.dryRun ? new JSZip() : null;

    async function handleBlob(item, blob) {
      if (!blob) {
        Progress.tick('failed');
        return;
      }
      if (zip) {
        zip.file(item.fullName, blob);
      } else if (!config.dryRun) {
        triggerDownload(blob, item.fullName);
        await sleep(300);
      }
      newlyDownloadedIds.push(item.id);
      Progress.tick('ok');
    }

    for (let i = 0; i < downloadable.length; i++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      await pauser.wait(signal);

      const item = downloadable[i];
      const progressLabel =
        item.kind === 'legacy-doc'
          ? I18n.t('progressLegacyDoc', i + 1, downloadable.length)
          : item.kind === 'legacy-folder'
          ? I18n.t('progressLegacyFolder', i + 1, downloadable.length)
          : I18n.t('progress', i + 1, downloadable.length);
      Progress.setStatus(progressLabel);
      Logger.info(`[${i + 1}/${downloadable.length}] ${item.fullName}`);

      if (config.dryRun) {
        newlyDownloadedIds.push(item.id);
        Progress.tick('ok');
        continue;
      }

      try {
        if (item.kind === 'main') {
          if (!item.docLink) {
            Logger.warn(`  ✗ Kein Download-Link für ${item.id}`);
            Progress.tick('failed');
            continue;
          }
          const resp = await fetch(item.docLink, {
            credentials: 'include',
            headers: { Accept: item.docAttrs.contentType || 'application/pdf' },
            signal,
          });
          if (!resp.ok) {
            Logger.warn(`  ✗ HTTP ${resp.status} – übersprungen.`);
            Progress.tick('failed');
            continue;
          }
          const blob = await resp.blob();
          await handleBlob(item, blob);
        } else {
          const blob = await Api.fetchLegacyDocumentBlob(item.id, signal);
          await handleBlob(item, blob);
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        Logger.error(`  ✗ Fehler: ${err.message}`);
        Progress.tick('failed');
      }
    }

    if (zip && zip.files && Object.keys(zip.files).length > 0) {
      Progress.setStatus(I18n.t('zipping'));
      Logger.info(I18n.t('zipping'));
      const zipName = `dkb-postbox_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.zip`;
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      triggerDownload(blob, zipName);
      Logger.ok(I18n.t('zipReady', zipName));
    }

    // Persist state (only on real runs, not dry runs).
    if (!config.dryRun && newlyDownloadedIds.length > 0) {
      PersistedDocs.add(newlyDownloadedIds);
      PersistedDocs.setLastRun(new Date().toISOString());
    }

    const c = Progress.getCounts();
    const summary = config.dryRun
      ? I18n.t('summaryDry', c.ok, c.skipped)
      : I18n.t('summary', c.ok, c.failed, c.skipped);
    Logger.ok(summary);
    Progress.setStatus(summary);
    Toast.notify(summary);
  }

  // ===========================================================================
  // Module: UI
  // ===========================================================================
  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'DKB Postbox Downloader');
    panel.innerHTML = `
      <div class="dkbdl-header">
        <span data-i18n="title"></span>
        <button class="dkbdl-close-btn" id="dkbdl-close-btn"></button>
      </div>
      <div class="dkbdl-body">

        <div class="dkbdl-section-title" data-i18n="sources"></div>
        <div class="dkbdl-check-row dkbdl-all-row">
          <label><input type="checkbox" id="dkbdl-all" checked> <span data-i18n="all"></span></label>
        </div>
        <div class="dkbdl-check-row">
          <label><input type="checkbox" id="dkbdl-inbox" checked> <span data-i18n="inbox"></span></label>
        </div>
        <div class="dkbdl-check-row">
          <label><input type="checkbox" id="dkbdl-archive" checked> <span data-i18n="archive"></span></label>
        </div>
        <div class="dkbdl-check-row">
          <label><input type="checkbox" id="dkbdl-legacy-docs" checked> <span data-i18n="legacyDocs"></span></label>
        </div>
        <div class="dkbdl-check-row">
          <label><input type="checkbox" id="dkbdl-legacy-folders" checked> <span data-i18n="legacyFolders"></span></label>
        </div>

        <div class="dkbdl-divider"></div>
        <div class="dkbdl-section-title" data-i18n="period"></div>
        <div class="dkbdl-date-grid">
          <div class="dkbdl-date-field">
            <span data-i18n="from"></span>
            <input type="date" id="dkbdl-start-date">
          </div>
          <div class="dkbdl-date-field">
            <span data-i18n="to"></span>
            <input type="date" id="dkbdl-end-date">
          </div>
        </div>

        <div class="dkbdl-divider"></div>
        <div class="dkbdl-section-title" data-i18n="categories"></div>
        <div class="dkbdl-check-row">
          <label><input type="checkbox" id="dkbdl-cat-Kontoauszuege" checked> <span data-i18n="catKontoauszuege"></span></label>
        </div>
        <div class="dkbdl-check-row">
          <label><input type="checkbox" id="dkbdl-cat-Kreditkartenabrechnungen" checked> <span data-i18n="catKreditkarte"></span></label>
        </div>
        <div class="dkbdl-check-row">
          <label><input type="checkbox" id="dkbdl-cat-Wertpapierdokumente" checked> <span data-i18n="catWertpapier"></span></label>
        </div>
        <div class="dkbdl-check-row">
          <label><input type="checkbox" id="dkbdl-cat-__other__" checked> <span data-i18n="catOther"></span></label>
        </div>

        <div class="dkbdl-divider"></div>
        <div class="dkbdl-section-title" data-i18n="options"></div>
        <div class="dkbdl-check-row">
          <label><input type="checkbox" id="dkbdl-only-new"> <span data-i18n="onlyNew"></span></label>
        </div>
        <div class="dkbdl-help" data-i18n="onlyNewHelp"></div>
        <div class="dkbdl-check-row">
          <label><input type="checkbox" id="dkbdl-dry-run"> <span data-i18n="dryRun"></span></label>
        </div>
        <div class="dkbdl-help" data-i18n="dryRunHelp"></div>
        <div class="dkbdl-check-row">
          <label><input type="checkbox" id="dkbdl-zip-mode"> <span data-i18n="zipMode"></span></label>
        </div>
        <div class="dkbdl-help" data-i18n="zipModeHelp"></div>
        <div class="dkbdl-state-info" id="dkbdl-state-info"></div>
        <button type="button" class="dkbdl-link-btn" id="dkbdl-reset-state" data-i18n="resetState"></button>

        <div class="dkbdl-divider"></div>
        <div class="dkbdl-section-title" data-i18n="settings"></div>
        <div class="dkbdl-settings-grid">
          <div class="dkbdl-settings-field">
            <span data-i18n="language"></span>
            <select id="dkbdl-lang"></select>
          </div>
          <div class="dkbdl-settings-field">
            <span data-i18n="theme"></span>
            <select id="dkbdl-theme">
              <option value="auto" data-i18n="themeAuto"></option>
              <option value="light" data-i18n="themeLight"></option>
              <option value="dark" data-i18n="themeDark"></option>
            </select>
          </div>
          <div class="dkbdl-settings-field">
            <span data-i18n="logLevel"></span>
            <select id="dkbdl-log-level">
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
              <option value="none">none</option>
            </select>
          </div>
        </div>

        <div class="dkbdl-progress-wrap">
          <div class="dkbdl-progress"><div class="dkbdl-progress-bar" id="dkbdl-progress-bar"></div></div>
          <div class="dkbdl-counters" id="dkbdl-counters"></div>
        </div>

        <div id="dkbdl-log" class="dkbdl-log" role="log" aria-live="polite"></div>
        <div id="dkbdl-status" class="dkbdl-status"></div>
      </div>
      <div class="dkbdl-footer">
        <button class="dkbdl-start-btn" id="dkbdl-start-btn"></button>
        <button class="dkbdl-pause-btn" id="dkbdl-pause-btn" style="display:none"></button>
        <button class="dkbdl-cancel-btn" id="dkbdl-cancel-btn" style="display:none"></button>
      </div>
    `;
    return panel;
  }

  /** Apply translations to all data-i18n elements in the panel. */
  function applyTranslations(panel) {
    panel.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      el.textContent = I18n.t(key);
    });
    const closeBtn = panel.querySelector('#dkbdl-close-btn');
    if (closeBtn) {
      closeBtn.textContent = '✕';
      closeBtn.title = I18n.t('close');
      closeBtn.setAttribute('aria-label', I18n.t('close'));
    }
    const startBtn = panel.querySelector('#dkbdl-start-btn');
    if (startBtn) startBtn.textContent = I18n.t('start');
    const cancelBtn = panel.querySelector('#dkbdl-cancel-btn');
    if (cancelBtn) cancelBtn.textContent = I18n.t('cancel');
    const pauseBtn = panel.querySelector('#dkbdl-pause-btn');
    if (pauseBtn) pauseBtn.textContent = I18n.t('pause');
    const toggle = document.getElementById(BTN_ID);
    if (toggle) toggle.textContent = I18n.t('toggle');
    refreshStateInfo();
  }

  function refreshStateInfo() {
    const el = document.getElementById('dkbdl-state-info');
    if (!el) return;
    const n = PersistedDocs.count();
    const when = PersistedDocs.getLastRun();
    const formatted = when ? new Date(when).toLocaleString() : '–';
    el.textContent = I18n.t('stateInfo', n, formatted);
  }

  function injectUI() {
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.textContent = I18n.t('toggle');
    btn.setAttribute('aria-haspopup', 'dialog');
    document.body.appendChild(btn);

    const panel = buildPanel();
    document.body.appendChild(panel);

    Logger.setEl(panel.querySelector('#dkbdl-log'));
    Progress.bind(
      panel.querySelector('#dkbdl-progress-bar'),
      panel.querySelector('#dkbdl-counters'),
      panel.querySelector('#dkbdl-status')
    );

    // Source 'All' wiring
    const allCb = panel.querySelector('#dkbdl-all');
    const sourceCbs = ['dkbdl-inbox', 'dkbdl-archive', 'dkbdl-legacy-docs', 'dkbdl-legacy-folders']
      .map((id) => panel.querySelector(`#${id}`));
    function syncAllCheckbox() {
      const checkedCount = sourceCbs.filter((c) => c.checked).length;
      allCb.checked = checkedCount === sourceCbs.length;
      allCb.indeterminate = checkedCount > 0 && checkedCount < sourceCbs.length;
    }
    allCb.addEventListener('change', () => {
      sourceCbs.forEach((cb) => {
        cb.checked = allCb.checked;
      });
    });
    sourceCbs.forEach((cb) => cb.addEventListener('change', syncAllCheckbox));

    // Settings dropdowns
    const langSel = panel.querySelector('#dkbdl-lang');
    I18n.languages().forEach((lang) => {
      const o = document.createElement('option');
      o.value = lang;
      o.textContent = lang.toUpperCase();
      langSel.appendChild(o);
    });
    langSel.value = I18n.get();
    langSel.addEventListener('change', () => {
      I18n.set(langSel.value);
      applyTranslations(panel);
    });

    const themeSel = panel.querySelector('#dkbdl-theme');
    themeSel.value = Theme.get();
    themeSel.addEventListener('change', () => {
      Theme.set(themeSel.value);
    });

    const logSel = panel.querySelector('#dkbdl-log-level');
    logSel.value = Logger.getLevelName();
    logSel.addEventListener('change', () => {
      Logger.setLevel(logSel.value);
    });

    // Restore option toggles
    const onlyNewCb = panel.querySelector('#dkbdl-only-new');
    onlyNewCb.checked = !!Storage.get('opt.onlyNew', false);
    onlyNewCb.addEventListener('change', () => Storage.set('opt.onlyNew', onlyNewCb.checked));

    const dryRunCb = panel.querySelector('#dkbdl-dry-run');
    dryRunCb.checked = !!Storage.get('opt.dryRun', false);
    dryRunCb.addEventListener('change', () => Storage.set('opt.dryRun', dryRunCb.checked));

    const zipCb = panel.querySelector('#dkbdl-zip-mode');
    zipCb.checked = !!Storage.get('opt.zipMode', false);
    zipCb.addEventListener('change', () => Storage.set('opt.zipMode', zipCb.checked));

    // Reset history
    panel.querySelector('#dkbdl-reset-state').addEventListener('click', () => {
      PersistedDocs.reset();
      refreshStateInfo();
      Toast.show(I18n.t('stateReset'), 'ok');
    });

    // Panel open/close
    btn.addEventListener('click', () => panel.classList.toggle('dkbdl-open'));
    panel.querySelector('#dkbdl-close-btn').addEventListener('click', () => {
      panel.classList.remove('dkbdl-open');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('dkbdl-open')) {
        panel.classList.remove('dkbdl-open');
      }
    });

    // Run controls
    const startBtn = panel.querySelector('#dkbdl-start-btn');
    const cancelBtn = panel.querySelector('#dkbdl-cancel-btn');
    const pauseBtn = panel.querySelector('#dkbdl-pause-btn');
    let abortController = null;
    let pauser = null;

    startBtn.addEventListener('click', async () => {
      const config = {
        includeInbox: panel.querySelector('#dkbdl-inbox').checked,
        includeArchive: panel.querySelector('#dkbdl-archive').checked,
        includeLegacyDocuments: panel.querySelector('#dkbdl-legacy-docs').checked,
        includeLegacyFolders: panel.querySelector('#dkbdl-legacy-folders').checked,
        startDate: panel.querySelector('#dkbdl-start-date').value || '',
        endDate: panel.querySelector('#dkbdl-end-date').value || '',
        onlyNew: onlyNewCb.checked,
        dryRun: dryRunCb.checked,
        zipMode: zipCb.checked,
        categoryFilter: {
          Kontoauszuege: panel.querySelector('#dkbdl-cat-Kontoauszuege').checked,
          Kreditkartenabrechnungen: panel.querySelector('#dkbdl-cat-Kreditkartenabrechnungen')
            .checked,
          Wertpapierdokumente: panel.querySelector('#dkbdl-cat-Wertpapierdokumente').checked,
          __other__: panel.querySelector('#dkbdl-cat-__other__').checked,
        },
      };

      if (
        !config.includeInbox &&
        !config.includeArchive &&
        !config.includeLegacyDocuments &&
        !config.includeLegacyFolders
      ) {
        Progress.setStatus(I18n.t('chooseSource'));
        Toast.show(I18n.t('chooseSource'), 'warn');
        return;
      }

      startBtn.disabled = true;
      cancelBtn.style.display = '';
      pauseBtn.style.display = '';
      pauseBtn.textContent = I18n.t('pause');
      Logger.clear();
      const logEl = panel.querySelector('#dkbdl-log');
      if (logEl) logEl.classList.add('dkbdl-log-visible');
      Progress.setStatus('');
      Progress.reset(0);

      abortController = new AbortController();
      pauser = new PauseController();

      try {
        await startDownload(config, abortController.signal, pauser);
      } catch (err) {
        if (err.name === 'AbortError') {
          Logger.warn(I18n.t('aborted'));
          Progress.setStatus(I18n.t('abortedStatus'));
          Toast.show(I18n.t('abortedStatus'), 'warn');
        } else {
          Logger.error(`${I18n.t('errorPrefix')}: ${err.message}`);
          Progress.setStatus(I18n.t('errorStatus'));
          Toast.show(I18n.t('errorStatus'), 'error');
        }
      } finally {
        startBtn.disabled = false;
        cancelBtn.style.display = 'none';
        pauseBtn.style.display = 'none';
        abortController = null;
        pauser = null;
        refreshStateInfo();
      }
    });

    pauseBtn.addEventListener('click', () => {
      if (!pauser) return;
      if (pauser.isPaused()) {
        pauser.resume();
        pauseBtn.textContent = I18n.t('pause');
      } else {
        pauser.pause();
        pauseBtn.textContent = I18n.t('resume');
      }
    });

    cancelBtn.addEventListener('click', () => {
      if (pauser && pauser.isPaused()) pauser.resume();
      if (abortController) abortController.abort();
    });

    applyTranslations(panel);
    Theme.apply();
    refreshStateInfo();
  }

  // ===========================================================================
  // Module: Bootstrap
  // ===========================================================================
  function ensureUI() {
    if (!document.body) return;
    ensureStyle();
    if (!document.getElementById(BTN_ID) || !document.getElementById(PANEL_ID)) {
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
    console.log('[DKB] bootstrap()', {
      hasBody: !!document.body,
      readyState: document.readyState,
    });
    try {
      ensureUI();
    } catch (e) {
      console.error('[DKB] ensureUI threw', e);
    }
    const observer = new MutationObserver(() => ensureUI());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(ensureUI, 2000);
  }

  try {
    console.log('[DKB] userscript loaded', {
      url: location.href,
      readyState: document.readyState,
      hasGMaddStyle: typeof GM_addStyle === 'function',
      hasJSZip: typeof JSZip !== 'undefined',
    });
  } catch (_) {
    /* noop */
  }

  window.addEventListener('error', (e) => {
    if (e && e.filename && e.filename.indexOf('dkb_postbox_downloader') !== -1) {
      console.error('[DKB] uncaught error', e.message, e.error);
    }
  });

  if (document.body) {
    bootstrap();
  } else {
    document.addEventListener('DOMContentLoaded', bootstrap);
    window.addEventListener('load', bootstrap);
  }
})();
