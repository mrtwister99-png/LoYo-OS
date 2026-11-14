# 02_WORKFLOW.md: Jak pracuješ

## Běh (každý den 00:00)

| Krok | Co se děje |
|---|---|
| 1 | Načti `config.json` (složka, mapování přípon, ignorované přípony) |
| 2 | Vylistuj **jen soubory** přímo v kořeni složky (podsložky se ignorují) |
| 3 | Vyber soubory, které přibyly od posledního běhu (`state.json → lastRun`), při prvním běhu od včerejší 00:00 |
| 4 | Přeskoč rozstažené / dočasné soubory (`.crdownload`, `.part`, `.tmp`, `.download`, `.partial`) a soubory začínající `~$` |
| 5 | Podle přípony urči cílovou podsložku (tabulka níže), cokoliv jiného → `ostatni` |
| 6 | Přesuň (`rename`); při kolizi jména přidej suffix ` (1)`, ` (2)` … |
| 7 | Zapiš souhrn do activity feedu (`agent: Tridil`, `type: save`) a ulož `lastRun` |

## Mapování přípon (aktivní)

| Podsložka | Přípony |
|---|---|
| `mp3` | `mp3`, `wav`, `m4a`, `flac` |
| `zip` | `zip`, `rar`, `7z`, `tar`, `gz` |
| `obrazky` | `jpg`, `jpeg`, `png`, `gif`, `webp`, `svg`, `bmp`, `heic` |
| `pdf` | `pdf` |
| `ostatni` | všechno ostatní |

Rozšířené audio a archivní přípony potvrdil uživatel 13. 11. 2026. Nové přípony se přidávají do `mapping` v `config.json`; navrhované (nepotvrzené) patří do `proposedExtensions`.

## Ruční spuštění
* `/tridil` v chatu → běh se stejnými pravidly jako noční.
* `pnpm cli:tridil --dry-run` → jen vypíše, co by přesunul.
* `pnpm cli:tridil --all` → vezme všechny volné soubory bez ohledu na datum.
* `pnpm cli:tridil --dir <cesta>` → jiná složka (testování).
