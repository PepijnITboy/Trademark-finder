# Meldingen (notification recipients)

Meldingsadressen leven **alleen** op organisatieniveau (`/app/organisatie?tab=meldingen`).
Per adres is er exact **één** trigger-modus:

| Mode | Betekenis |
|------|-----------|
| `threshold` | Directe melding wanneer een match ≥ X% |
| `digest` | Periodiek rapport: `DAILY` \| `WEEKLY` \| `MONTHLY` |

## Relatie tot bewaakte merken

Op **Bewakingsinstellingen** stelt u in:

- **Algemene matchdrempel** — wanneer een hit in Merkbescherming zichtbaar wordt
- Welke org-adressen dit merk dekken (read-only lijst + link naar Organisatie)

Digest-only adressen tellen **niet** mee voor de matchdrempel-gate; alleen threshold-mode adressen bepalen het maximum.

## Legacy

`organizationSettings.notificationEmail` / `digestFrequency` horen niet meer in de product-UI.
Instellingen voor locale/tijdzone staan onder Organisatie → Taal; weergave onder Organisatie → Weergave.
