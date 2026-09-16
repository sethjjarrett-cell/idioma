# Idioma

A personal Spanish vocabulary trainer, built to the brief in `idioma-brief.md`.
Single user, runs locally, no accounts, no backend, no external APIs.
Colombian-leaning Latin American Spanish.

## Running it

Double-click `index.html`. That is the whole install. There is no build step,
no package manager and no server; it is plain HTML, CSS and JavaScript loaded
with ordinary script tags, so it works straight off the disk and offline.

## Files

```
index.html      the three screens
styles.css      dark theme, mobile down to a phone
seed.js         the supplied vocabulary and sentence bank, verbatim
engine.js       levels, bands, card selection, answer checking; no DOM
store.js        localStorage, plus Export and Import
app.js          UI wiring; asks the engine for a card and draws the answer
tests/          see below
```

`engine.js` holds every rule and touches no DOM, so the mastery logic can be
read and tested on its own. Every number the brief called out is a named
constant in `CONFIG` at the top of that file; nothing numeric is buried in the
logic, so retuning is a one-line edit.

### Why seed.js and not two .json files

A page opened from `file://` is not allowed to fetch a sibling `.json`, and
the brief asks for something that opens by double-clicking. `seed.js` is the
supplied JSON unchanged with an assignment on the front, so it stays
hand-editable and diffable exactly as JSON would be, and there is only ever
one copy of the bank.

## How the mastery engine works

Levels run 1 upwards. Correct moves a word up one, wrong moves it down one,
floored at 1, so a word never drops to zero. Levels may climb past 10
internally, which is what makes a well-known word keep getting rarer.

| Band | Levels | What you see | What you type |
|---|---|---|---|
| Recognition | 1 to 3 | the Spanish word | the English |
| Production | 4 to 7 | the English | the Spanish |
| Cloze | 8 and up | a sentence with the target blanked | the missing word |

Leaving a band takes two right answers in a row, at L3 into L4 and at L7 into
L8, so one lucky guess cannot promote a word into a harder format. The card
says when you are one away.

A word at cloze level with no sentence falls back to production and says so on
the card. The Manage screen has a "Cloze, no sentence" filter listing exactly
those words, and the Add-a-sentence picker puts them at the top. 31 of the 130
seeded words have no sentence yet.

### Selection

Each word gets a weight, and a round is drawn from those weights without
replacement:

```
weight = (11 - min(level, 10)) + 5 * min(1, hoursSinceLastSeen / 168)
floored at 0.5
```

The two parts are deliberately unequal. Level is worth up to 10 and recency up
to 5, so a word you keep getting wrong stays ahead of a mastered word however
long that one has been sitting; recency orders words within a level and pulls
old ones back into view, rather than overturning level altogether. A week is
the point at which the recency part is fully paid, which suits a trainer
picked up most days without punishing a few days off. The floor keeps even a
mastered word seen five minutes ago in the draw, so rounds do not collapse
onto the same dozen words. A word never seen counts as maximally overdue.

There are no fixed due dates in v1, as the brief asks.

### Answer checking

Case-insensitive and accent-insensitive, so `habitacion` passes for
`habitación` and `bano` for `baño`; `¿` and `¡` are ignored. The correctly
accented form is always what gets shown back on reveal, so the accents are
still being learned. Whitespace is trimmed, any listed answer is accepted, and
a leading `el/la/un/una` is optional in either direction.

Typo tolerance (Levenshtein distance 1) is **off** by default, behind the
toggle in the menu. When it is on and it is what let an answer through, the
card says so rather than quietly accepting a misspelling.

"I was right" appears on a wrong answer. It rewinds that card completely, the
level, the wrong count and the times-seen, then re-applies it as correct, so
an override cannot leave a doubled count behind.

## Progress and backups

Everything lives in `localStorage` under one key, `idioma.state.v1`, written
on a short debounce and again on unload, so a reload never loses anything.

**Export backup** writes the whole state as formatted JSON. **Import backup**
replaces it, validating first and refusing a bad file with a readable reason,
because the point of the file is that it can be hand-edited and a hand-edited
file is a file that can be wrong. If the stored state is ever unreadable it is
moved aside to `idioma.state.v1.broken` rather than thrown away, and the app
says so.

Words and sentences you add are kept separately from the seed rather than
copied over it, so a later edit to `seed.js` still shows through and the
backup stays small. Progress rows are only created for words you have actually
answered.

## Extending the bank

Adding words is a first-class action, on the Manage screen. Add a word with
its Spanish, alternates, English, part of speech and note; notes are where the
dialect warnings live and they are shown prominently on reveal, which is the
point of them. Add a sentence by wrapping the target form in curly braces,
`Nosotros {comemos} a la una.`; the answer is taken from the braces. Inflected
forms are intentional, the learner types the form shown.

You can also edit `seed.js` directly in any text editor.

## Tests

```bash
node tests/test-engine.mjs      # 49 assertions, no dependencies
```

Covers the bands, level movement, the two-in-a-row boundary rule, the floor
and ceiling, the selection weighting, every answer-checking rule, card
building in all three bands including the no-sentence fallback, and round
selection.

`tests/test-ui.mjs` and `tests/test-ui2.mjs` drive the real page in a browser
and need Playwright installed, which the app itself does not. Between them
they cover a full round from `file://`, persistence across a reload, adding a
word, the Manage filters, a real cloze card, the override, an export and
import round trip, a rejected junk file, and an iPhone viewport with no
horizontal overflow.

## Not built, by request

Full interval scheduler with due dates, audio and text to speech, conjugation
drills, multiple languages, cloud sync. The seams are left clean: scheduling
lives entirely in `selectionWeight` and `pickRound`, so a due-date scheduler
replaces those two functions and nothing else.
