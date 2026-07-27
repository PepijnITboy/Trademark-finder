# Juridische taal & verplichte disclaimers

Merkwacht is een **signaleringsdienst**, geen juridisch advieskantoor en geen
merkengemachtigde. Dit document is bindend voor alle klantgerichte teksten:
UI-copy, e-mailnotificaties, exports (PDF/CSV), marketingmateriaal, en elke
AI-gegenereerde tekst die aan een klant wordt getoond.

## Kernprincipe

> Merkwacht signaleert mogelijke overeenkomsten tussen merken op basis van
> geautomatiseerde analyse. Merkwacht geeft geen juridisch advies, beoordeelt
> niet of er daadwerkelijk sprake is van inbreuk of verwarringsgevaar in
> juridische zin, en onderneemt zelf geen actie (zoals het indienen van een
> oppositie) namens de klant.

Elke tekst die aan deze regel tornt — expliciet of impliciet — mag niet de
deur uit, ook niet in interne concepten die per ongeluk gepubliceerd zouden
kunnen worden.

## Verplichte disclaimer

De volgende (of een functioneel identieke) tekst moet zichtbaar zijn:

1. Onderaan elk klantdashboard-scherm dat `trademark_match`-resultaten toont.
2. In elke e-mailnotificatie die een match of oppositietermijn meldt.
3. Op elke PDF/CSV-export.

```
LEGAL_DISCLAIMER_NL:

"Merkwacht signaleert automatisch gedetecteerde overeenkomsten tussen
merken op basis van openbare registergegevens. Deze signalering vormt geen
juridisch advies en geen juridische beoordeling van inbreuk of
verwarringsgevaar. Raadpleeg een merkengemachtigde of advocaat voordat u
actie onderneemt, waaronder het al dan niet indienen van een oppositie."
```

Deze exacte tekst is vastgelegd als `LEGAL_DISCLAIMER_NL` in
`packages/domain/src/legal.ts` zodat er precies één bron van waarheid is —
UI, e-mail, en exports importeren deze constante in plaats van de tekst te
herschrijven.

## Verboden woorden en frasen

De volgende bewoordingen mogen **nooit** gebruikt worden in klantgerichte
teksten (UI, e-mail, exports, AI-gegenereerde samenvattingen), omdat ze
suggereren dat Merkwacht een juridisch oordeel velt of namens de klant
handelt:

| Verboden | Waarom | Gebruik in plaats daarvan |
| --- | --- | --- |
| "inbreuk" (als vaststelling, bijv. "dit is een inbreuk") | Suggereert een juridische vaststelling die alleen een rechter/bevoegde instantie kan doen | "mogelijke overeenkomst", "signalering" |
| "u moet opposeren" / "wij adviseren oppositie" | Suggereert juridisch advies | "de oppositietermijn verloopt op [datum] — raadpleeg uw gemachtigde" |
| "wij dienen de oppositie voor u in" / "wij nemen actie" | Merkwacht onderneemt zelf geen juridische stappen | "u (of uw gemachtigde) kunt vóór [datum] een oppositie indienen" |
| "gegarandeerd" / "100% zeker" (over een match of risico) | Scoring is een signaal, geen zekerheid | "hoge signaleringsscore", "sterke overeenkomst gedetecteerd" |
| "juridisch advies" (als omschrijving van wat Merkwacht levert) | Expliciet in strijd met het kernprincipe | "signalering", "analyse", "detectie" |
| "verwarringsgevaar" (als vaststelling, bijv. "er is verwarringsgevaar") | Verwarringsgevaar is een juridisch toetsingscriterium, geen feit dat software vaststelt | "risico op verwarring lijkt aanwezig op basis van de score", altijd met verwijzing naar de score, nooit als kale bewering |
| "wij garanderen dat u het merk mag gebruiken/registreren" | Geen enkele score kan dit garanderen | (nooit een garantie-uitspraak doen over registreerbaarheid) |

## Toegestane, aanbevolen bewoordingen

- "Mogelijke overeenkomst gedetecteerd tussen [merk A] en [merk B]."
- "Signaleringsscore: 82/100 — zie score-opbouw voor details."
- "De oppositietermijn voor deze aanvraag verloopt op [datum]."
- "Dit is een geautomatiseerde signalering, geen juridisch advies."
- "Raadpleeg een merkengemachtigde of advocaat voor een juridische
  beoordeling."

## AI-gegenereerde tekst

Elke tekst die via de [AI-laag](../scoring/ai-layer.md) wordt gegenereerd en
aan een klant wordt getoond (bijv. een `rationale`-veld) moet:

1. Nooit rechtstreeks ongefilterd aan een klant getoond worden zonder dat de
   verboden-woordenlijst hierboven is toegepast (een lint/validatiestap over
   AI-output wordt aanbevolen: weiger of herschrijf output die verboden
   termen bevat).
2. Nooit een aanbeveling voor een specifieke juridische actie bevatten.
3. Altijd behandeld worden als *onderdeel van de signalering*, niet als een
   op zichzelf staand advies.

## Review-proces

Nieuwe klantgerichte tekst (UI-strings, e-mailtemplates, exportlayouts)
moet, vóór productierelease, getoetst worden aan dit document. Bij twijfel:
kies de meest terughoudende formulering en verwijs naar een externe
juridische professional.
