# package-housekeeping

Script zur Bereinigung alter GitHub Container Package Versionen in einer Organisation.

## Funktionsweise

Das Skript:

1. lädt alle Container-Packages der konfigurierten GitHub-Organisation,
2. lädt pro Package alle Versionen (paginiert),
3. löscht alle Versionen, die älter als `DAYS_TO_DELETE` Tage sind,
4. behält Versionen mit Tag `latest` immer bei.

## Voraussetzungen

- [Deno](https://deno.com/) installiert
- GitHub Personal Access Token mit Rechten auf Packages der Organisation

Empfohlene Token-Rechte:

- `read:packages`
- `delete:packages`

## Einrichtung

1. Umgebungsdatei anlegen:

```bash
cp .env.example .env
```

2. Token in `.env` setzen:

```env
GITHUB_ACCESS_TOKEN=dein_token
```

3. Optional Konfiguration in `constants.ts` anpassen:

- `GITHUB_ORG_NAME` (Standard: `pegasusspiele`)
- `DAYS_TO_DELETE` (Standard: `0`)

## Ausführung

```bash
deno task run
```

Das Task-Kommando ist in `deno.json` hinterlegt und startet:

```bash
deno run --allow-net --allow-env --env-file=.env housekeeping.ts
```

## Wichtige Hinweise

- `DAYS_TO_DELETE = 0` bedeutet: alle Versionen löschen, die nicht `latest` sind.
- Das Skript führt echte Löschungen durch (kein Dry-Run-Modus).
- Fehler beim Löschen einzelner Versionen werden geloggt, das Skript läuft danach weiter.

