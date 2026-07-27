# Adresparser & KVK (mock → live)

## Huidige staat

- **KVK:** client/server validatie op precies 8 cijfers (`kvkNumberSchema` in `@merkwacht/validation`).
- **Adres:** `POST /api/v1/organization/parse-address` splitst heuristisch NL-achtige regels en vult mock `lat`/`lng` in `organization_profiles.parsed_address_json`.
- Geen calls naar Google Maps Geocoding of het KVK Handelsregister.

## Latere koppelingen

| Behoefte | Voorstel |
|----------|----------|
| Adres → coördinaten + componenten | Google Maps Geocoding of PDOK Locatieserver (NL) |
| KVK autocorrect / bedrijfsnaam | KVK API (zoeken op nummer/naam) |
| UI-kaart | Embed Maps op basis van lat/lng |

Sla provider-responses op in `parsed_address_json` zodat de UI niet van de provider afhangt.
