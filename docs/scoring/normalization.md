# Mark Name Normalization

`packages/normalization` turns raw mark text (as entered by a trademark
applicant, with all its inconsistent capitalization, punctuation, and
spacing) into a stable set of representations that the rest of the scoring
pipeline can compare reliably.

## Why normalization is needed

Trademark text as published by registers is messy: `"Coca-Cola®"`,
`"COCA COLA"`, `"Coca  Cola"`, and `"Coca-Cola B.V."` should all be
recognized as textually very close, but naive string comparison would treat
punctuation, whitespace, casing, and diacritics as meaningful differences.

## `NormalizedMarkRepresentations`

```ts
interface NormalizedMarkRepresentations {
  original: string;
  normalized: string;      // lowercased, diacritics folded, punctuation stripped, whitespace collapsed
  foldedAscii: string;     // normalized with all non-ASCII letters transliterated (e.g. "ë" -> "e")
  tokens: string[];        // normalized, split on whitespace, empty tokens removed
  significantTokens: string[]; // tokens with common corporate suffixes/stopwords removed
  length: number;          // character length of `normalized`
}
```

- `original` is retained for display and audit purposes — never mutate or
  discard the source text.
- `normalized` is the primary field used for textual similarity and as the
  input to phonetic generation.
- `foldedAscii` supports cross-locale comparison (e.g. a mark registered with
  `"ø"` vs. one written with `"o"`).
- `significantTokens` strips a small, explicit list of legal-entity and
  generic stopwords (e.g. `"bv"`, `"nv"`, `"gmbh"`, `"the"`, `"de"`, `"het"`)
  so that e.g. `"Acme B.V."` and `"Acme"` are recognized as the same mark
  core. This list is intentionally conservative — it must never strip a
  token that could plausibly be part of a distinctive mark.

## `normalizeMarkName`

```ts
function normalizeMarkName(input: string): NormalizedMarkRepresentations;
```

Normalization steps, applied in order:

1. **Unicode normalization (NFKD)** — decompose combined characters (e.g.
   `"é"` → `"e"` + combining acute accent) so diacritics can be stripped
   deterministically.
2. **Diacritic stripping** — remove combining marks, leaving base Latin
   letters (`"café"` → `"cafe"`).
3. **Case folding** — lowercase using locale-independent rules.
4. **Punctuation stripping** — remove characters that are not letters,
   digits, or whitespace (handles `®`, `™`, `.`, `,`, `-`, `'`, etc.), except
   that internal hyphens between letters are first replaced with a space
   rather than deleted outright, so `"Coca-Cola"` becomes `"coca cola"`
   rather than `"cocacola"` — this preserves tokenization while still
   folding punctuation-only differences.
5. **Whitespace collapsing** — collapse runs of whitespace to a single
   space and trim.
6. **Tokenization** — split on whitespace to produce `tokens`.
7. **Stopword/suffix filtering** — remove known legal-entity suffixes and
   generic stopwords from `tokens` to produce `significantTokens`.

Normalization is intentionally **pure and synchronous** — no I/O, no
locale-data downloads at runtime — so it can run identically in the worker,
the API (for live validation/preview), and tests.

## What normalization deliberately does *not* do

- It does not perform stemming or lemmatization (e.g. it will not equate
  `"running"` and `"run"`) — that level of linguistic processing is out of
  scope and risks false-positive collisions between unrelated marks.
- It does not attempt transliteration between scripts (e.g. Cyrillic to
  Latin) in v1.
- It does not remove numbers, since numbers can be a distinctive part of a
  mark (e.g. `"4711"`).

## Interaction with phonetics and scoring

`normalizeMarkName`'s output feeds directly into
[`packages/phonetics`](./phonetics.md) (phonetic codes are generated from
`normalized`, not `original`) and into `packages/scoring`'s
`textualSimilarity` component, which computes a normalized edit-distance
score plus a token-overlap (Jaccard-style) score over `significantTokens`,
combined into a single `0..1` value before weighting.
