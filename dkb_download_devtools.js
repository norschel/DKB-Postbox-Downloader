/**
 * DKB Postbox + Archive + Legacy Documents – Chrome DevTools Document Downloader
 *
 * How to use:
 *   1. Log in to https://banking.dkb.de in Chrome.
 *   2. Open DevTools (F12) and switch to the "Console" tab.
 *   3. Optionally edit the CONFIG block below to select which sources to download.
 *   4. Paste this entire script and press Enter.
 *
 * The script downloads documents from up to four sources to your browser's
 * default download folder:
 *
 *   1. Regular postbox (Posteingang)
 *      GET /api/documentstorage/messages
 *      GET /api/documentstorage/documents?page[limit]=1000
 *
 *   2. Modern archive (Archivierte Dokumente)
 *      GET /api/documentstorage/messages?filter[archived]=true   (or /archive/messages)
 *      GET /api/documentstorage/documents?filter[archived]=true  (or /archive/documents)
 *
 *   3. Legacy documents (legacy-documents endpoint – returns base64-encoded JSON)
 *      GET /api/documentstorage/legacy-documents                 – document list
 *      GET /api/documentstorage/legacy-documents/{id}            – individual file
 *        → data.attributes.content   (base64-encoded file bytes)
 *        → data.attributes.fileName / contentType
 *
 *   4. Legacy folder archive (Archiv im Archiv – "legacyMailboxFolderContent")
 *      GET /api/documentstorage/folders                          – folder list
 *      GET /api/documentstorage/folders/{id}?page[limit]=200&page[offset]=N
 *        → data.attributes.files[]   – files in this folder
 *        → data.attributes.subfolders[] – nested folders (fetched recursively)
 *      GET /api/documentstorage/legacy-documents/{fileId}        – actual file (base64 JSON)
 *
 * Filenames follow the pattern:
 *   <prefix>_<date>_<filename>
 * Legacy folder files use: Legacy_<FolderName>_<date>_<filename>
 */
(async function dkbDownloadAll() {
  'use strict';

  const BASE_URL = 'https://banking.dkb.de/api/documentstorage';

  // ---------------------------------------------------------------------------
  // Configuration – edit these flags to choose which sources to download.
  // ---------------------------------------------------------------------------
  const CONFIG = {
    /** Regular postbox (Posteingang). Almost always true. */
    includeInbox:           true,
    /** Modern archive (Archivierte Dokumente). */
    includeArchive:         true,
    /** Legacy documents via /legacy-documents (base64 JSON response). */
    includeLegacyDocuments: true,
    /** Legacy folder archive via /folders (older "Archiv im Archiv"). */
    includeLegacyFolders:   true,
  };

  /** Maps documentType values to human-readable folder/prefix names. */
  const DOCTYPE_MAPPING = {
    bankAccountStatement:     'Kontoauszuege',
    creditCardStatement:      'Kreditkartenabrechnungen',
    dwpRevenueStatement:      'Wertpapierdokumente',
    dwpOrderStatement:        'Wertpapierdokumente',
    dwpDepotStatement:        'Wertpapierdokumente',
    exAnteCostInformation:    'Wertpapierdokumente',
    dwpCorporateActionNotice: 'Wertpapierdokumente',
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Replicates dkb-robo's get_valid_filename() sanitisation. */
  function getValidFilename(name) {
    let s = String(name).replace(/[^\w\-\.]/gu, ' ').trim();
    const dotIdx   = s.lastIndexOf('.');
    const stem     = dotIdx > 0 ? s.slice(0, dotIdx) : s;
    const ext      = dotIdx > 0 ? s.slice(dotIdx)    : '';
    const safeStem = stem.split(/\s+/).filter(Boolean).join('_');
    return safeStem ? safeStem + ext : `unnamed_${Date.now()}.pdf`;
  }

  /**
   * Mirrors PostBox.__fix_link_url():
   * normalise legacy api.dkb.de host to banking.dkb.de.
   */
  function fixLinkUrl(url) {
    return url.replace('https://api.dkb.de/documentstorage/', BASE_URL + '/');
  }

  /** Return category label for a documentType string. */
  function getCategory(documentType) {
    return DOCTYPE_MAPPING[documentType] || documentType || 'Sonstige';
  }

  /**
   * Derive the best ISO date string from document metadata.
   * Mirrors PostboxItem.date() in postbox.py.
   */
  function getDate(metadata) {
    if (!metadata) return new Date().toISOString().slice(0, 10);
    if (metadata.statementDate)     return metadata.statementDate.slice(0, 10);
    if (metadata.statementDateTime) return metadata.statementDateTime.slice(0, 10);
    if (metadata.creationDate)      return metadata.creationDate.slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Build the local filename for a document.
   * Mirrors PostboxItem.filename() in postbox.py.
   */
  function buildFilename(docAttrs) {
    const metadata = docAttrs.metadata || {};
    let name = docAttrs.fileName || '';
    // Depot-related files only contain the document id as the fileName;
    // use the subject from metadata instead (same logic as dkb-robo).
    if (metadata.dwpDocumentId && metadata.subject) {
      name = metadata.subject || name;
    }
    if (docAttrs.contentType === 'application/pdf' && !name.endsWith('.pdf')) {
      name = `${name}.pdf`;
    }
    return getValidFilename(name);
  }

  /** Trigger a browser download from a Blob without opening a new tab. */
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

  /** Simple async sleep. */
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---------------------------------------------------------------------------
  // API fetching
  // ---------------------------------------------------------------------------

  /**
   * Fetch all pages of a JSON:API list endpoint.
   * Returns the combined data array, or an empty array if the endpoint responds
   * with a non-2xx status (logged as a warning rather than a hard error so that
   * optional/fallback endpoints can fail gracefully).
   */
  async function fetchAllPages(firstUrl, label) {
    let all = [];
    let url = firstUrl;
    while (url) {
      const resp = await fetch(url, { credentials: 'include' });
      if (!resp.ok) {
        console.warn(`[DKB] ${label}: HTTP ${resp.status} – skipping.`);
        return null;   // null signals "endpoint not available"
      }
      const json = await resp.json();
      all = all.concat(json.data || []);
      url = json.links?.next ? fixLinkUrl(json.links.next) : null;
    }
    return all;
  }

  /**
   * Fetch messages for one "scope" (inbox or archive).
   * Tries candidate URLs in order and returns the first successful result.
   */
  async function fetchMessages(archived) {
    const label = archived ? 'archive messages' : 'inbox messages';
    if (archived) {
      // Candidate 1: filter parameter (most common JSON:API pattern)
      const r1 = await fetchAllPages(`${BASE_URL}/messages?filter[archived]=true`, label);
      if (r1 !== null) return r1;
      // Candidate 2: dedicated /archive sub-path
      const r2 = await fetchAllPages(`${BASE_URL}/archive/messages`, label + ' (fallback)');
      if (r2 !== null) return r2;
      console.warn('[DKB] Could not find an archive messages endpoint. Archived messages will be skipped.');
      return [];
    }
    // Inbox: the plain endpoint used by dkb-robo
    const r = await fetchAllPages(`${BASE_URL}/messages`, label);
    if (r === null) throw new Error('/messages endpoint failed');
    return r;
  }

  /**
   * Fetch documents for one "scope" (inbox or archive).
   * Tries candidate URLs in order and returns the first successful result.
   */
  async function fetchDocuments(archived) {
    const label = archived ? 'archive documents' : 'inbox documents';
    if (archived) {
      const r1 = await fetchAllPages(
        `${BASE_URL}/documents?filter[archived]=true&page[limit]=1000`, label);
      if (r1 !== null) return r1;
      const r2 = await fetchAllPages(
        `${BASE_URL}/archive/documents?page[limit]=1000`, label + ' (fallback)');
      if (r2 !== null) return r2;
      console.warn('[DKB] Could not find an archive documents endpoint. Archived documents will be skipped.');
      return [];
    }
    // Inbox: mirrors the page[limit]=1000 call in PostBox.fetch_items()
    const r = await fetchAllPages(`${BASE_URL}/documents?page[limit]=1000`, label);
    if (r === null) throw new Error('/documents endpoint failed');
    return r;
  }

  // ---------------------------------------------------------------------------
  // API fetching – legacy folder archive
  // ---------------------------------------------------------------------------

  /**
   * Fetch the top-level folder list.
   * Returns an array of folder objects with at least { id, name } each.
   * Returns [] if the endpoint is not available.
   */
  async function fetchFolderList() {
    const resp = await fetch(`${BASE_URL}/folders`, { credentials: 'include' });
    if (!resp.ok) {
      console.warn(`[DKB] /folders: HTTP ${resp.status} – legacy folder archive will be skipped.`);
      return [];
    }
    const json = await resp.json();
    // The listing may return either a JSON:API array or a single wrapper object.
    // Handle both shapes.
    if (Array.isArray(json.data)) return json.data;
    if (json.data && Array.isArray(json.data.attributes && json.data.attributes.subfolders))
      return json.data.attributes.subfolders;
    // Fallback: try top-level array
    if (Array.isArray(json)) return json;
    return [];
  }

  /**
   * Fetch all files from a single folder using offset-based pagination.
   * Also recursively fetches any subfolders listed in the response.
   *
   * Returns an array of plain objects:
   *   { id, subject, fileName, creationDate, folderPath }
   */
  async function fetchFolderContents(folderId, folderPath) {
    const PAGE_LIMIT = 200;
    let offset = 0;
    let allFiles = [];

    while (true) {
      const url = `${BASE_URL}/folders/${folderId}?page%5Blimit%5D=${PAGE_LIMIT}&page%5Boffset%5D=${offset}`;
      const resp = await fetch(url, { credentials: 'include' });
      if (!resp.ok) {
        console.warn(`[DKB] /folders/${folderId} (offset ${offset}): HTTP ${resp.status} – skipping.`);
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

      // Recurse into subfolders (only on the first page to avoid re-processing)
      if (offset === 0 && Array.isArray(attrs.subfolders)) {
        for (const sub of attrs.subfolders) {
          const subId   = sub.id   || String(sub);
          const subName = sub.name || sub.attributes?.name || subId;
          const subPath = `${folderPath}/${subName}`;
          console.log(`[DKB]   Subfolder: ${subPath}`);
          const subFiles = await fetchFolderContents(subId, subPath);
          allFiles = allFiles.concat(subFiles);
        }
      }

      // Stop if this page was not full (no more data).
      if (files.length < PAGE_LIMIT) break;
      offset += PAGE_LIMIT;
    }

    return allFiles;
  }

  /**
   * Discover all legacy archive folders and collect every file across all of them.
   * Returns an array of { id, subject, fileName, creationDate, folderPath }.
   */
  async function fetchAllLegacyFolderFiles() {
    const folders = await fetchFolderList();
    if (folders.length === 0) return [];

    console.log(`[DKB] Legacy folders found: ${folders.length}`);
    let allFiles = [];

    for (const folder of folders) {
      const folderId   = folder.id   || String(folder);
      const folderName = folder.name || (folder.attributes && folder.attributes.name) || folderId;
      console.log(`[DKB] Fetching legacy folder: ${folderName} (${folderId})`);
      const files = await fetchFolderContents(folderId, folderName);
      console.log(`[DKB]   → ${files.length} file(s)`);
      allFiles = allFiles.concat(files);
    }

    return allFiles;
  }

  // ---------------------------------------------------------------------------
  // API fetching – /legacy-documents endpoint
  // ---------------------------------------------------------------------------

  /**
   * Fetch all entries from the /legacy-documents list endpoint.
   * Each entry has { id, links.self, attributes.fileName, attributes.contentType, ... }.
   * Returns an empty array if the endpoint is not available.
   */
  async function fetchLegacyDocumentList() {
    const r = await fetchAllPages(`${BASE_URL}/legacy-documents`, 'legacy-documents');
    if (r === null) {
      console.warn('[DKB] /legacy-documents endpoint not available – skipping.');
      return [];
    }
    return r;
  }

  /**
   * Download a single legacy document by fetching /legacy-documents/{id}.
   * The response is JSON with base64-encoded file content:
   *   { data: { attributes: { content: "<base64>", contentType: "...", fileName: "..." } } }
   * Returns a Blob, or null on error.
   */
  async function fetchLegacyDocumentBlob(id) {
    const resp = await fetch(`${BASE_URL}/legacy-documents/${id}`, { credentials: 'include' });
    if (!resp.ok) {
      console.warn(`[DKB]   ✗ HTTP ${resp.status} fetching legacy-document ${id}`);
      return null;
    }
    const json = await resp.json();
    const attrs = (json.data && json.data.attributes) || {};
    const base64Content = attrs.content || '';
    const contentType   = attrs.contentType || 'application/pdf';

    // Decode base64 → Uint8Array → Blob
    const binary = atob(base64Content);
    const bytes  = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
    return new Blob([bytes], { type: contentType });
  }

  // ---------------------------------------------------------------------------
  // Main
  // ---------------------------------------------------------------------------

  console.log('[DKB] Starting document downloader …');
  console.log('[DKB] Config:', JSON.stringify(CONFIG));

  // Fetch inbox documents.
  let inboxMessages = [], inboxDocs = [];
  if (CONFIG.includeInbox) {
    try {
      [inboxMessages, inboxDocs] = await Promise.all([
        fetchMessages(false),
        fetchDocuments(false),
      ]);
    } catch (err) {
      console.error('[DKB] Failed to load inbox metadata:', err);
      return;
    }
  }

  // Fetch archive documents.
  let archiveMessages = [], archiveDocs = [];
  if (CONFIG.includeArchive) {
    [archiveMessages, archiveDocs] = await Promise.all([
      fetchMessages(true),
      fetchDocuments(true),
    ]);
  }

  console.log(
    `[DKB] Inbox:   ${inboxMessages.length} message(s), ${inboxDocs.length} document(s).`
  );
  console.log(
    `[DKB] Archive: ${archiveMessages.length} message(s), ${archiveDocs.length} document(s).`
  );

  // Build a message-attribute lookup that covers both scopes.
  // Archive messages are tagged so we can label them in filenames.
  const msgMap = {};
  for (const m of inboxMessages)   msgMap[m.id] = { ...m.attributes, _archived: false };
  for (const m of archiveMessages) msgMap[m.id] = { ...m.attributes, _archived: true  };

  // Merge document lists; deduplicate by id in case any doc appears in both.
  const docMap = new Map();
  for (const d of inboxDocs)   docMap.set(d.id, { doc: d, fromArchive: false });
  for (const d of archiveDocs) {
    if (!docMap.has(d.id)) docMap.set(d.id, { doc: d, fromArchive: true });
  }

  const allDocuments = [...docMap.values()];
  console.log(`[DKB] Total postbox + archive documents to download: ${allDocuments.length}`);

  let countOk = 0, countFailed = 0;

  // ------------------------------------------------------------------
  // Download: regular postbox + modern archive
  // ------------------------------------------------------------------
  for (let i = 0; i < allDocuments.length; i++) {
    const { doc, fromArchive } = allDocuments[i];
    const docAttrs = doc.attributes || {};
    const msgAttrs = msgMap[doc.id] || {};
    const metadata = docAttrs.metadata || {};

    // Determine whether this document is archived (from API flag or endpoint origin).
    const isArchived = msgAttrs._archived || fromArchive || msgAttrs.archived === true;

    const category = getCategory(msgAttrs.documentType);
    const date     = getDate(metadata);
    const fname    = buildFilename(docAttrs);
    const prefix   = isArchived ? `Archiv_${category}` : category;
    const fullName = `${prefix}_${date}_${fname}`;

    const docLink = fixLinkUrl((doc.links || {}).self || '');
    if (!docLink) {
      console.warn(`[DKB] [${i + 1}/${allDocuments.length}] No download link for ${doc.id} – skipping.`);
      countFailed++;
      continue;
    }

    console.log(`[DKB] [${i + 1}/${allDocuments.length}] ${fullName}`);

    try {
      const resp = await fetch(docLink, {
        credentials: 'include',
        headers: { Accept: docAttrs.contentType || 'application/pdf' },
      });

      if (!resp.ok) {
        console.warn(`[DKB]   ✗ HTTP ${resp.status} – skipping.`);
        countFailed++;
      } else {
        const blob = await resp.blob();
        triggerDownload(blob, fullName);
        countOk++;
        // Brief pause so the browser can queue each download before the next.
        await sleep(600);
      }
    } catch (err) {
      console.error(`[DKB]   ✗ Error:`, err);
      countFailed++;
    }
  }

  // ------------------------------------------------------------------
  // Download: legacy documents (/legacy-documents, base64 JSON)
  // ------------------------------------------------------------------
  // Collect IDs already downloaded above so we skip duplicates across sources.
  const downloadedIds = new Set(allDocuments.map(({ doc }) => doc.id));

  if (CONFIG.includeLegacyDocuments) {
    console.log('[DKB] Fetching legacy-documents list …');
    const legacyDocs = await fetchLegacyDocumentList();
    console.log(`[DKB] Legacy documents to download: ${legacyDocs.length}`);

    for (let i = 0; i < legacyDocs.length; i++) {
      const doc      = legacyDocs[i];
      const docAttrs = doc.attributes || {};

      if (downloadedIds.has(doc.id)) {
        console.log(`[DKB] [legacy-doc ${i + 1}/${legacyDocs.length}] Already downloaded ${doc.id} – skipping.`);
        continue;
      }

      let fname = getValidFilename(docAttrs.fileName || doc.id);
      if (docAttrs.contentType === 'application/pdf' && !fname.toLowerCase().endsWith('.pdf')) {
        fname += '.pdf';
      }
      const date     = docAttrs.creationDate ? docAttrs.creationDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
      const fullName = `LegacyDoc_${date}_${fname}`;

      console.log(`[DKB] [legacy-doc ${i + 1}/${legacyDocs.length}] ${fullName}`);

      try {
        const blob = await fetchLegacyDocumentBlob(doc.id);
        if (blob) {
          triggerDownload(blob, fullName);
          downloadedIds.add(doc.id);
          countOk++;
          await sleep(600);
        } else {
          countFailed++;
        }
      } catch (err) {
        console.error(`[DKB]   ✗ Error:`, err);
        countFailed++;
      }
    }
  }

  // ------------------------------------------------------------------
  // Download: legacy folder archive
  // ------------------------------------------------------------------
  if (CONFIG.includeLegacyFolders) {
    console.log('[DKB] Fetching legacy folder archive …');
    const legacyFiles = await fetchAllLegacyFolderFiles();
    console.log(`[DKB] Legacy folder files to download: ${legacyFiles.length}`);

    for (let i = 0; i < legacyFiles.length; i++) {
      const file = legacyFiles[i];

      if (downloadedIds.has(file.id)) {
        console.log(`[DKB] [legacy-folder ${i + 1}/${legacyFiles.length}] Already downloaded ${file.id} – skipping.`);
        continue;
      }

      // Build filename: prefer subject over fileName when fileName is generic
      // (short, no year, or matches known generic names like "SBPK.pdf").
      const GENERIC_FILENAMES = new Set(['sbpk.pdf', 'document.pdf', 'dokument.pdf']);
      const fnLower = file.fileName.toLowerCase();
      const useSubject = file.subject && (
        GENERIC_FILENAMES.has(fnLower) ||
        file.fileName.length < 10
      );
      const baseName = useSubject ? file.subject : file.fileName;
      let fname = getValidFilename(baseName);
      if (!fname.toLowerCase().endsWith('.pdf')) fname += '.pdf';

      const date        = file.creationDate ? file.creationDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
      const folderPrefix = getValidFilename(file.folderPath).replace(/\./g, '_');
      const fullName    = `Legacy_${folderPrefix}_${date}_${fname}`;

      console.log(`[DKB] [legacy-folder ${i + 1}/${legacyFiles.length}] ${fullName}`);

      try {
        // Legacy folder files are served via /legacy-documents/{id} (base64 JSON),
        // not via /documents/{id} (which returns 404 for these items).
        const blob = await fetchLegacyDocumentBlob(file.id);
        if (blob) {
          triggerDownload(blob, fullName);
          downloadedIds.add(file.id);
          countOk++;
          await sleep(600);
        } else {
          countFailed++;
        }
      } catch (err) {
        console.error(`[DKB]   ✗ Error:`, err);
        countFailed++;
      }
    }
  }

  console.log(`[DKB] Finished. ✓ ${countOk} downloaded, ✗ ${countFailed} failed.`);
})();
