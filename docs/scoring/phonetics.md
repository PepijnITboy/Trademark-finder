# Phonetic Matching

`packages/phonetics` generates phonetic representations of a mark name so the
scoring pipeline can catch conflicts that look different in writing but sound
alike — a classic trademark-confusion scenario (e.g. `"Xtra"` vs. `"Extra"`,
or `"Fanta"` vs. `"Phanta"`).

## `PhoneticRepresentation`

```ts
interface PhoneticRepresentation {
  input: string;               // the normalized mark text this was generated from
  locale: 'nl' | 'en';
  code: string;                 // primary phonetic code
  alternateCode?: string;       // secondary/alternate encoding, when the algorithm produces one
}
```

Because Merkwacht operates in the Benelux (Dutch-speaking) market but many
marks are English words or invented terms that read the same across
languages, phonetic codes are generated **per locale**. A mark can therefore
have both an `nl` and an `en` `PhoneticRepresentation`, and the scoring
pipeline compares locale-matched pairs and takes the strongest signal.

## `generatePhoneticRepresentations`

```ts
function generatePhoneticRepresentations(
  normalized: string,
  locales?: readonly ('nl' | 'en')[],
): PhoneticRepresentation[];
```

v1 ships a **simple, metaphone-inspired** encoder rather than a full
Double Metaphone/Soundex port, deliberately kept small and dependency-free so
its behavior is easy to reason about and unit test. It is intentionally
labeled as a "stub" implementation to be swapped for a more sophisticated
algorithm (or an AI-assisted phonetic comparison) later without changing its
public interface.

Encoding steps (applied per locale):

1. Work on the already-normalized (lowercase, ASCII-folded) mark text.
2. Apply a small set of locale-specific digraph/letter substitution rules
   that collapse spellings that sound the same:
   - **Dutch (`nl`):** `"c"` before `a/o/u` → `"k"`; `"c"` before `e/i/y` →
     `"s"`; `"ck"` → `"k"`; `"ph"` → `"f"`; `"th"` → `"t"`; `"qu"` → `"kw"`;
     `"ij"`/`"y"` → `"i"`; `"x"` → `"ks"`; doubled consonants collapsed to
     one.
   - **English (`en`):** `"ph"` → `"f"`; `"gh"` → (silent, dropped when not
     forming another sound) ; `"ck"` → `"k"`; `"wr"` → `"r"`; `"kn"` → `"n"`;
     `"qu"` → `"kw"`; `"x"` → `"ks"`; doubled consonants collapsed to one.
3. Strip remaining vowels except a leading vowel (a coarse consonant-skeleton
   approach similar in spirit to Soundex/Metaphone), keeping the first
   character of the original token to preserve initial-sound distinctiveness.
4. Join the result into `code`. If step 2's rules were ambiguous for a given
   substring (e.g. a `"c"` at a word boundary with no following vowel
   available to disambiguate), the encoder additionally emits
   `alternateCode` using the opposite rule.

This is explicitly a heuristic, not a linguistically complete phonetic
model. It is validated by a table-driven unit test suite of known
sound-alike and known-distinct mark name pairs (see
[`docs/testing/testing-strategy.md`](../testing/testing-strategy.md)), and
the threshold for what counts as "phonetically similar enough" is tuned via
that fixture set rather than assumed.

## Scoring usage

`packages/scoring`'s `phoneticSimilarity` component compares the watched
mark's and candidate's `PhoneticRepresentation.code` (and `alternateCode`,
if present) per matching locale using a normalized edit distance, and takes
the maximum similarity across the available locale pairs. This value is also
used as one of the two pre-filtering signals described in
[`overview.md`](./overview.md#pre-filtering).
