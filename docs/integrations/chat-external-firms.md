# Merkrechtenchat: platform (A) → externe kantoren (B)

## Nu (pad A)

- Feature flag `merkrechten_chat` op abonnementen (vanaf **Pro** in de default catalogus).
- Customer UI: `/app/chat`.
- Platform inbox: `/platform/chat` (`/api/platform/org/chat/...`).
- Tabellen: `support_threads`, `support_participants`, `support_messages`.
- `support_participant_type`: `customer_user` | `platform_operator` | **`external_firm`** (gereserveerd).

## Later (pad B)

1. Tabel `external_firms` (naam, contact, actief).
2. Uitnodigingsflow: platform koppelt een firm aan een thread of workspace.
3. Firm-login (aparte identity of magic link) met alleen toegang tot toegewezen threads.
4. Participant-rijen met `participant_type = external_firm` + `external_firm_id`.
5. Notificaties naar firm én klant bij nieuwe berichten.

Geen herbouw van thread/message-schema nodig — alleen identity + autorisatie uitbreiden.
