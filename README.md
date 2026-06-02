# DKB-Postbox-Downloader

Lädt alle Dokumente aus dem DKB-Online-Banking (Postfach, Archiv und Legacy-Archiv) automatisch herunter. Verfügbar als **Tampermonkey-Script** (empfohlen) und als **DevTools-Snippet**.

## Tampermonkey-Script (empfohlen)

### Schnellinstallation (ein Klick)

Tampermonkey muss bereits installiert sein. Anschließend genügt ein Klick auf den folgenden Link – Tampermonkey öffnet automatisch den Installationsdialog:

[![Install with Tampermonkey](https://img.shields.io/badge/Install-Tampermonkey-00485B?logo=tampermonkey&logoColor=white)](https://raw.githubusercontent.com/norschel/DKB-Postbox-Downloader/main/dkb_postbox_downloader.user.js)

Direktlink: <https://raw.githubusercontent.com/norschel/DKB-Postbox-Downloader/main/dkb_postbox_downloader.user.js>

> **Automatische Updates:** Das Script enthält `@updateURL`/`@downloadURL`, die auf dieses GitHub-Repository zeigen. Tampermonkey prüft daher in regelmäßigen Abständen selbständig, ob auf `main` eine neuere Version (höhere `@version`) liegt und bietet das Update an. Manuelles Prüfen ist im Tampermonkey-Dashboard über „Auf Updates prüfen" möglich.

### Voraussetzungen

- Browser mit [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, …)
- Aktiver DKB-Online-Banking-Zugang unter [banking.dkb.de](https://banking.dkb.de)

### Installation

1. Installiere die [Tampermonkey-Erweiterung](https://www.tampermonkey.net/) für deinen Browser.
2. **Wichtig (Chrome/Edge/Brave und andere Chromium-basierte Browser ab Manifest V3):** Damit Tampermonkey Userscripts überhaupt ausführen darf, müssen zwei Einstellungen aktiv sein. Ohne sie wird das Script auf der DKB-Seite stillschweigend nicht geladen (es erscheinen weder Button noch Konsolen-Logs). Details siehe [offizielle Tampermonkey-FAQ Q209](https://www.tampermonkey.net/faq.php?q=Q209#Q209).
   - **Entwicklermodus aktivieren** unter `chrome://extensions` bzw. `edge://extensions` (Schalter „Entwicklermodus" / „Developer mode" oben rechts).
   - **„Allow User Scripts" / „Benutzerskripte zulassen"** für die Tampermonkey-Erweiterung aktivieren: auf der Seite `chrome://extensions` bzw. `edge://extensions` bei Tampermonkey auf „Details" klicken und die Option „Allow User Scripts" einschalten.
   - Anschließend Browser-Tab neu laden.
3. **Hinweis für Firefox:** In Firefox sind die obigen Manifest-V3-Schalter nicht erforderlich. Tampermonkey funktioniert dort out-of-the-box, sobald die Erweiterung installiert ist. Einzige Empfehlung: in den Tampermonkey-Einstellungen unter „Sicherheit" den Modus auf „Fragen" oder „Erlauben" für externe `@require`-Skripte (JSZip) lassen – sonst kann der ZIP-Export nicht geladen werden.
4. Öffne das Tampermonkey-Dashboard und lege ein neues Script an.
5. Kopiere den Inhalt von [`dkb_postbox_downloader.user.js`](dkb_postbox_downloader.user.js) in den Editor und speichere.
6. Auf [banking.dkb.de](https://banking.dkb.de) prüfen: Klick auf das Tampermonkey-Symbol in der Toolbar muss das Script unter „Auf dieser Seite ausgeführt" anzeigen. Falls nicht, fehlt meist eine der Einstellungen aus Schritt 2.

### Verwendung

1. Melde dich unter [banking.dkb.de](https://banking.dkb.de) an.
2. Klicke auf den Button **📥 DKB Download** oben rechts im Browser.
3. Konfiguriere die gewünschten Optionen im Panel:
   - **Quellen** – wähle einzelne Quellen oder alle auf einmal.
   - **Zeitraum** – optional Start- und/oder Enddatum setzen, um nur Dokumente aus einem bestimmten Zeitraum herunterzuladen.
   - **Kategorien** – filtere nach Dokumentart (Kontoauszüge, Kreditkartenabrechnungen, Wertpapierdokumente, Sonstige).
   - **Optionen** –
     - *Nur neue Dokumente seit letztem Lauf*: überspringt alle Dokumente, deren ID bereits in einem früheren erfolgreichen Lauf gespeichert wurde. Der Verlauf wird lokal über `GM_setValue` (bzw. `localStorage` als Fallback) persistiert; er kann jederzeit über den Link „Verlauf zurücksetzen" gelöscht werden.
     - *Trockenlauf (Dry Run)*: listet im Log auf, was heruntergeladen würde, ohne tatsächlich Dateien zu speichern oder den Verlauf zu verändern.
     - *Als ZIP herunterladen*: bündelt alle Dokumente eines Laufs in einer einzigen ZIP-Datei (`dkb-postbox_<Zeitstempel>.zip`). Praktisch, um die Browser-Rückfrage „mehrere Dateien zulassen" zu vermeiden. **Hinweis:** Der ZIP-Export ist derzeit experimentell und im Userscript per Feature-Flag (`FEATURE_ZIP_ENABLED`) deaktiviert; die Option erscheint daher nicht im Panel. Zum Aktivieren das Flag im Script auf `true` setzen.
   - **Einstellungen** – Sprache (Deutsch/English), Design (Hell/Dunkel/Automatisch nach Systempräferenz), Log-Level (`debug`/`info`/`warn`/`error`/`none`).
4. Klicke auf **▶ Download starten**.
5. Während des Laufs zeigt das Panel eine **Fortschrittsanzeige** (Balken + Zähler ✓/✗/⏭) sowie das Live-Log an. Über **⏸ Pause / ▶ Fortsetzen** lässt sich der Lauf pausieren, über **✕ Abbrechen** komplett beenden.
6. Am Ende erscheint eine **Toast-/Benachrichtigung** mit der Zusammenfassung; falls Tampermonkey eine Systembenachrichtigung zulässt, wird zusätzlich `GM_notification` verwendet.
7. Dokumente werden im Standard-Download-Ordner gespeichert (bzw. als einzelne ZIP, je nach Option).

> **Hinweis:** Manche Browser fragen ab dem zweiten automatischen Download nach einer Erlaubnis für „mehrere Dateien herunterladen". Diese Anfrage muss einmalig bestätigt werden.

---

## DevTools-Snippet

### Voraussetzungen

- Google Chrome (oder ein anderer Chromium-basierter Browser)
- Aktiver DKB-Online-Banking-Zugang unter [banking.dkb.de](https://banking.dkb.de)

### Verwendung

1. Melde dich unter [banking.dkb.de](https://banking.dkb.de) an.
2. Öffne die Entwicklertools mit `F12` und wechsle zum Tab **Console**.
3. Kopiere den gesamten Inhalt der Datei [`dkb_download_devtools.js`](dkb_download_devtools.js).
4. Füge das Script in die Konsole ein und bestätige mit `Enter`.
5. Die Dokumente werden automatisch in den Standard-Download-Ordner des Browsers gespeichert.

### Konfiguration

Am Anfang des Scripts befindet sich ein `CONFIG`-Block, mit dem gesteuert werden kann, welche Quellen heruntergeladen werden:

```js
const CONFIG = {
  /** Reguläres Postfach (Posteingang). */
  includeInbox:           true,
  /** Modernes Archiv (Archivierte Dokumente). */
  includeArchive:         true,
  /** Legacy-Dokumente über /legacy-documents (Base64-JSON-Antwort). */
  includeLegacyDocuments: true,
  /** Legacy-Ordnerarchiv über /folders (älteres „Archiv im Archiv"). */
  includeLegacyFolders:   true,
};
```

Setze einzelne Felder auf `false`, um die jeweilige Quelle zu überspringen.

## Downloadquellen

Das Script unterstützt vier Quellen:

| Quelle | API-Endpunkt | Beschreibung |
|---|---|---|
| **Posteingang** | `/api/documentstorage/messages` + `/documents` | Aktuelles, nicht archiviertes Postfach |
| **Modernes Archiv** | `/api/documentstorage/messages?filter[archived]=true` + `/documents?filter[archived]=true` | Archivierte Dokumente der neueren Archiv-Funktion |
| **Legacy-Dokumente** | `/api/documentstorage/legacy-documents` | Ältere Dokumente im Base64-JSON-Format |
| **Legacy-Ordnerarchiv** | `/api/documentstorage/folders` | Älteres „Archiv im Archiv" mit verschachtelten Ordnern |

Für Archiv-Endpunkte werden automatisch Fallback-URLs ausprobiert, falls der bevorzugte Endpunkt nicht erreichbar ist. Dokumente, die in mehreren Quellen vorkommen, werden nur einmal heruntergeladen.

## Dateinamen-Schema

Die Dateien werden nach folgendem Muster benannt:

| Quelle | Schema |
|---|---|
| Posteingang | `<Kategorie>_<Datum>_<Dateiname>` |
| Archiv | `Archiv_<Kategorie>_<Datum>_<Dateiname>` |
| Legacy-Dokumente | `LegacyDoc_<Datum>_<Dateiname>` |
| Legacy-Ordner | `Legacy_<Ordnerpfad>_<Datum>_<Dateiname>` |

Die **Kategorie** richtet sich nach dem Dokumenttyp (`documentType`) aus der DKB-API:

| documentType | Kategorie |
|---|---|
| `bankAccountStatement` | `Kontoauszuege` |
| `creditCardStatement` | `Kreditkartenabrechnungen` |
| `dwpRevenueStatement`, `dwpOrderStatement`, `dwpDepotStatement`, `exAnteCostInformation`, `dwpCorporateActionNotice` | `Wertpapierdokumente` |
| Alle anderen | Wert des `documentType`-Felds oder `Sonstige` |

## Lizenz

[MIT](LICENSE)

## Datenschutz & Sicherheit

Das Userscript läuft ausschließlich **lokal im Browser** des angemeldeten Nutzers und kommuniziert nur mit zwei Hosts:

- **`banking.dkb.de`** – ausschließlich für die in der Tabelle „Downloadquellen" dokumentierten API-Aufrufe sowie zum Herunterladen der Dokument-PDFs. Es werden ausnahmslos dieselben Endpunkte angesprochen, die auch das DKB-Webfrontend nutzt; die bestehende Browser-Session (Cookies) wird über `credentials: 'include'` mitgesendet, das Script speichert oder überträgt keine Zugangsdaten.
- **`cdnjs.cloudflare.com`** – einmaliger Abruf der JSZip-Bibliothek beim **Installieren bzw. Aktualisieren** des Scripts (über die Tampermonkey-Direktive `@require`). Zur Laufzeit auf `banking.dkb.de` wird Cloudflare nicht kontaktiert; Tampermonkey injiziert die zwischengespeicherte JSZip-Kopie lokal.

Es findet **keine Übertragung von Banking-Daten an Dritte** statt, kein Telemetrie- oder Analytics-Code ist enthalten, und es werden keine externen Schriftarten oder Icons nachgeladen. Persistente lokale Daten (zuletzt gewählte Optionen, IDs bereits heruntergeladener Dokumente, Sprach-/Design-Einstellung) werden über `GM_setValue` (bzw. `localStorage` als Fallback) **nur im Browser-Profil** des Nutzers gespeichert und können über den Link „Verlauf zurücksetzen" im Panel jederzeit gelöscht werden.

Da das Script auf einer Banking-Seite läuft, gilt: bitte ausschließlich aus diesem Repository (bzw. über die `@updateURL`) installieren und vor jedem Update den Diff in den GitHub-Commits prüfen, falls möglich. Sicherheitsmeldungen bitte über die [Issues](https://github.com/norschel/DKB-Postbox-Downloader/issues) bzw. eine private GitHub Security Advisory einreichen.

## Entwicklung

Für lokale Linter-/Formatter-Läufe steht eine optionale Node-Konfiguration bereit (nur für Beitragende, **nicht zur Laufzeit erforderlich**):

```bash
npm install
npm run lint
npm run format:check
```

Es kommen ESLint (`eslint:recommended`) und Prettier mit den im Repository hinterlegten Konfigurationsdateien zum Einsatz. Es gibt keinen Build-Schritt – das Userscript wird so, wie es im Repository liegt, von Tampermonkey ausgeführt.
