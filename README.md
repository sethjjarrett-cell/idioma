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
styles.css      the theme, one token block; mobile down to a phone
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

## The look

Bright, rounded and chunky, in the manner of the big language apps, but
orange rather than green. Fat corner radii, all-caps buttons sitting on a
solid slab of darker colour that the press squashes flat, and a verdict block
that takes the colour of the answer — green, amber or red — so how the answer
went is the shape of the screen before it is words.

The wordmark is the word, set plainly. An earlier draft boxed half of it in
an orange chip, which turned out to be a well-known logo for something that
is not a Spanish trainer.

Every colour is a custom property at the top of `styles.css`, so retuning the
whole theme is one block. The dark scheme at the bottom of the file is nothing
but a token swap, in warm browns so the orange still belongs; it follows the
system setting.

The mascot is a fox called Zorro, which is what a Spanish speaker would call
him. He is one inline `<symbol>` near the top of `index.html`, stamped out
with `<use>`, and he has three faces: idle, right and wrong. The faces are
`<g>` groups whose opacity reads a custom property, and custom properties
inherit into the shadow tree a `<use>` builds, so switching his expression is
one CSS line and no extra markup:

```css
.card.correct .verdict .fox { --fox-idle: 0; --fox-happy: 1; }
```

`app.js` puts a `correct` or `wrong` class on the card and knows nothing else
about how any of this is drawn.

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

#### Almost

Three verdicts, not two. Typing `a glass of water` when the answer is
`glass of water` is not right, but calling it wrong is a lie about how close
it was, so it comes back amber:

| What was typed | Verdict | Why |
|---|---|---|
| `glass of water` | Correct | |
| `mesa` for `la mesa` | Correct | Spanish article, free in either direction |
| `a glass of water` | Almost | an article the answer does not have |
| `walk` for `to walk` | Almost | the infinitive apart |
| `huger` for `hunger` | Almost | a letter out |
| `kitchen` for `bathroom` | Wrong | a different word |

The card shows the answer's own words with the correction over the top: what
was added struck through, what was left out underlined, and a misspelt word
carrying a mark on the letters to look at. Marked three ways rather than by
colour alone, because colour alone tells a colour-blind reader nothing.

An amber answer **holds** the word: no level up, no level down, and the
streak stands rather than breaking. "Type it again" reopens the box for
another go, and a second go can only improve the card — get it right and it
counts as a correct answer for that card, get it wrong again and it is still
amber. So a near miss costs nothing but the retype, which is the point: the
learner sees what was off and types the right thing before moving on.

The English articles are flagged rather than waved through because they are
not nothing: `a glass of water` is `un vaso de agua` and `glass of water` is
not. The Spanish ones stay free, because the bank is not consistent about
them and the article is not the form being tested.

Amber is where a single-letter slip lands when typo tolerance is off, which
is what makes that toggle worth having: off no longer means harsh, it means
make me retype it.

#### Overrides, and re-grading a card

"I was right" appears on anything short of a clean pass. Grading always works
from a snapshot of the word's progress taken when the card was drawn, so
overriding, or fixing a near miss, lands on exactly the progress that answer
would have produced first time — no doubled counts, and a streak the card
broke comes back intact rather than restarting.

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
node tests/test-engine.mjs      # 74 assertions, no dependencies
```

Covers the bands, level movement, the two-in-a-row boundary rule, the floor
and ceiling, the selection weighting, every answer-checking rule, which near
misses go amber and which stay wrong, the correction diff down to the letter,
what an amber answer does and does not do to a word, card building in all
three bands including the no-sentence fallback, and round selection.

`tests/test-ui.mjs`, `test-ui2.mjs` and `test-ui3.mjs` drive the real page in
a browser and need Playwright installed, which the app itself does not.
Between them they cover a full round from `file://`, persistence across a
reload, adding a word, the Manage filters, a real cloze card, the override, an
export and import round trip, a rejected junk file, an iPhone viewport with no
horizontal overflow, and the whole amber path: the near miss, the correction
shown on the card, the second go that is also wrong not making things worse,
and the second go that is right earning the level without counting the card
twice.

## Not built, by request

Full interval scheduler with due dates, audio and text to speech, conjugation
drills, multiple languages, cloud sync. The seams are left clean: scheduling
lives entirely in `selectionWeight` and `pickRound`, so a due-date scheduler
replaces those two functions and nothing else.
