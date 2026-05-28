# DKB-Postbox-Downloader

Ein JavaScript-Snippet für die Chrome-Entwicklerkonsole, das alle Dokumente aus dem DKB-Online-Banking (Postfach, Archiv und Legacy-Archiv) automatisch herunterlädt.

## Voraussetzungen

- Google Chrome (oder ein anderer Chromium-basierter Browser)
- Aktiver DKB-Online-Banking-Zugang unter [banking.dkb.de](https://banking.dkb.de)

## Verwendung

1. Melde dich unter [banking.dkb.de](https://banking.dkb.de) an.
2. Öffne die Entwicklertools mit `F12` und wechsle zum Tab **Console**.
3. Kopiere den gesamten Inhalt der Datei [`dkb_download_devtools.js`](dkb_download_devtools.js).
4. Füge das Script in die Konsole ein und bestätige mit `Enter`.
5. Die Dokumente werden automatisch in den Standard-Download-Ordner des Browsers gespeichert.

> **Hinweis:** Manche Browser fragen ab dem zweiten automatischen Download nach einer Erlaubnis für „mehrere Dateien herunterladen". Diese Anfrage muss einmalig bestätigt werden.

## Konfiguration

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
