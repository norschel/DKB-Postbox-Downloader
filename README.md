# DKB-Postbox-Downloader

Lädt alle Dokumente aus dem DKB-Online-Banking (Postfach, Archiv und Legacy-Archiv) automatisch herunter. Verfügbar als **Tampermonkey-Script** (empfohlen) und als **DevTools-Snippet**.

## Tampermonkey-Script (empfohlen)

### Voraussetzungen

- Browser mit [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, …)
- Aktiver DKB-Online-Banking-Zugang unter [banking.dkb.de](https://banking.dkb.de)

### Installation

1. Installiere die [Tampermonkey-Erweiterung](https://www.tampermonkey.net/) für deinen Browser.
2. **Wichtig (Chrome/Edge/Brave und andere Chromium-basierte Browser ab Manifest V3):** Damit Tampermonkey Userscripts überhaupt ausführen darf, müssen zwei Einstellungen aktiv sein. Ohne sie wird das Script auf der DKB-Seite stillschweigend nicht geladen (es erscheinen weder Button noch Konsolen-Logs). Details siehe [offizielle Tampermonkey-FAQ Q209](https://www.tampermonkey.net/faq.php?q=Q209#Q209).
   - **Entwicklermodus aktivieren** unter `chrome://extensions` bzw. `edge://extensions` (Schalter „Entwicklermodus" / „Developer mode" oben rechts).
   - **„Allow User Scripts" / „Benutzerskripte zulassen"** für die Tampermonkey-Erweiterung aktivieren: auf der Seite `chrome://extensions` bzw. `edge://extensions` bei Tampermonkey auf „Details" klicken und die Option „Allow User Scripts" einschalten.
   - Anschließend Browser-Tab neu laden.
3. Öffne das Tampermonkey-Dashboard und lege ein neues Script an.
4. Kopiere den Inhalt von [`dkb_postbox_downloader.user.js`](dkb_postbox_downloader.user.js) in den Editor und speichere.
5. Auf [banking.dkb.de](https://banking.dkb.de) prüfen: Klick auf das Tampermonkey-Symbol in der Toolbar muss das Script unter „Auf dieser Seite ausgeführt" anzeigen. Falls nicht, fehlt meist eine der Einstellungen aus Schritt 2.

### Verwendung

1. Melde dich unter [banking.dkb.de](https://banking.dkb.de) an.
2. Klicke auf den Button **📥 DKB Download** unten rechts im Browser.
3. Konfiguriere die gewünschten Optionen im Panel:
   - **Quellen** – wähle einzelne Quellen oder alle auf einmal.
   - **Zeitraum** – optional Start- und/oder Enddatum setzen, um nur Dokumente aus einem bestimmten Zeitraum herunterzuladen.
4. Klicke auf **▶ Download starten**.
5. Dokumente werden im Standard-Download-Ordner gespeichert. Im Panel wird der Fortschritt angezeigt.

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
