# World register catalog

Merkwacht monitors trademarks via **per-office connectors** plus **WIPO Madrid** (international designations). There is no single free API that covers every national mark worldwide.

## Coverage (~40 catalog entries)

### Europe — regional
| Code | Register | Auth | Notes |
|------|----------|------|-------|
| BOIP | Benelux | API key (Datolite) | Deep connector — live |
| EUIPO | EU trademark | OAuth client credentials | Deep connector |
| WIPO | Madrid System | Commercial FTP daily ST.66 | Deep connector — **not** Monitor UI scrape |

### Europe — national
UKIPO, DPMA, INPI (FR), OEPM, UIBM, IPI_CH, PRH, PRV, DKPTO, NIPO, IPO_IE, INPI_PT, OEPA, UPRP, UPV_CZ, HIPO, OBI, OSIM, BPO, SIPO_HR, IPO_SK, SIPO_SI, VLS, LRPV, EPA, DRCOR, IPOMT.

NL/BE/LU are covered by **BOIP** only (no separate national connectors).

### Majors outside Europe
USPTO, CIPO, IPAU, INPI_BR, CIPC, IMPI, JPO, KIPO, IPO_IN, CNIPA.

## Depth standard
Every connector implements `healthCheck` → `configuration_required` without secrets (never fake data), `fetchPublications` with checkpoint, mapping to `CandidateApplication`, fixtures + contract tests.

## Classification
Each catalog entry has `classificationSchemeId` (default `nice_45`). See [classification.md](./classification.md).

## Platform cockpit
Continent-grouped UI under Registers: upsert API key (server-side; UI shows configured + last4), **Verbinding testen**, single switch **Register aan voor klanten**, logs, last fetch, connected org counts, disable with reason (notifies affected orgs).

### Live-gate (product rule)
1. Upsert API key → 2. Probe green → 3. Switch “Register aan voor klanten”.
Monitoring OK = `connectorStatus === live` + `enabledForWatch` + last probe `ok`.
Customer “Beschermd” and daily watch sync require monitoring OK. Turning the switch off never shows Beschermd.

### T1 registers — credentials needed
| Code | What to configure | Portal / docs |
|------|-------------------|---------------|
| BOIP | `BOIP_API_KEY` (Datolite) | Benelux Office API |
| EUIPO | OAuth `EUIPO_CLIENT_ID` / `EUIPO_CLIENT_SECRET` | EUIPO developer portal |
| USPTO | `USPTO_API_KEY` | USPTO TSDR / developer |
| WIPO | FTP user/password (`WIPO_FTP_*`) | WIPO Madrid ST.66 feed |
| UKIPO / DPMA / … | `{CODE}_API_KEY` + `{CODE}_API_BASE_URL` | National office portals |

Fixtures remain for CI (`*_USE_FIXTURES=true`). Live probe/fetch use the upserted key when present.
