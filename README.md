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
index.html      the five screens
styles.css      the theme, one token block; mobile down to a phone
seed.js         the supplied vocabulary and sentence bank, verbatim
order.js        the order words are taught in
senses.js       one line per word that shares an English meaning with another
vocab.js        the generated bank: 404 more words, 802 more sentences
topics.js       which context each word belongs to
tools/bank/     the batches vocab.js is built from, and the builder
tools/tatoeba/  importers for Tatoeba sentences and Wiktionary glosses
tools/sync/     the forty-line server, and how to deploy it once
verbs.js        the ending tables, and the one function that reads them
pronounce.js    Spanish spelling to an English respelling; no data, all rules
engine.js       levels, bands, card selection, answer checking; no DOM
store.js        localStorage, plus Export and Import
sync.js         the merge, and the two calls that move one JSON blob
app.js          UI wiring; asks the engine for a card and draws the answer
tests/          see below
```

`topics.js`, `verbs.js` and `pronounce.js` are each free of the DOM and of
each other, and `tests/test-data.mjs` checks all three without a browser.

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

A screen-printed film poster left in the sun: sandy paper, olive drab, burnt
orange and brick. The structure underneath is unchanged from the version
before it — fat corner radii, all-caps buttons sitting on a slab of darker
colour that the press squashes flat, a verdict block that bleeds to the card
edges and takes the colour of the answer. Only the palette and the fox moved.

Every colour is a custom property at the top of `styles.css`, and every one of
them was **checked rather than chosen by eye**, because a muted desert palette
is exactly how you ship something unreadable. Ten foreground-on-background
pairs per scheme against WCAG AA; the two that failed on the first pass, the
muted grey against the page and the label on an accent button, were solved for
rather than nudged until they looked alright. Both schemes now clear every
pair, the tightest with 5% to spare.

### Paper by default, dark by choice

Paper is the default whatever the operating system prefers. Dark is the
poster's own dark half — olive drab behind, sand in front — and is a choice
made in the menu, not a setting inherited from elsewhere. There is
deliberately no `prefers-color-scheme` rule; the tokens hang off a
`data-theme` attribute instead.

Two details that are the whole reason it feels right:

The attribute is set by a four-line script in the `<head>`, before the
stylesheet has anything to say. Doing it in `app.js`, which loads at the end
of the body, would give anyone who picked dark a white flash on every single
load.

The choice lives in its own `localStorage` key and is **not** part of the
synced state. Which theme suits a phone at night is not which theme suits a
laptop at noon, and since the sync merge lets the younger save win the
settings, putting it there would have two devices overwriting each other's
answer every time they met.

Dark is still otherwise nothing but a token swap, with one exception: the
fox's ear tips are the only dark part of him that sits outside the orange, so
on an olive background they get lifted or the ears lose their points.

The wordmark and the section headings are set in Georgia, which is on
effectively every machine. The poster's display face is a western slab nobody
has installed, and used sparingly a warm old serif reads period without
costing legibility where it matters. The paper grain is an inline SVG
turbulence filter at 5% rather than an image, so nothing is downloaded.

### The fox

Zorro, redrawn after the *Fantastic Mr Fox* poster: a broad flat head, the
dark angular brows that do as much work as anything else in saying which fox
this is, dark ear tips, green-grey eyes set wide, a large pale muzzle, and a
suit.

He is one inline `<symbol>` stamped out with `<use>`, and his three faces are
groups whose opacity reads a custom property; custom properties inherit into
the shadow tree a `<use>` builds, so an expression change is one CSS line and
no extra markup:

```css
.card.correct .verdict .fox { --fox-idle: 0; --fox-happy: 1; }
```

Two things about drawing him are worth writing down, because both were got
wrong first:

**The muzzle line decides the species.** The pale field has to start *below*
the eyes and rise only a little between them. A first attempt had it rising to
a point above the eyes, which swallowed the face and turned him into a dog.

**A bust does not fit a square frame by accident.** The head is scaled to 0.88
and lifted so the chin lands on the collar, done with a transform rather than
by rewriting every path, so the geometry that was drawn stays the geometry in
the file. Before that the coat was a tan bar he appeared to be standing
behind.

The whiskers and the suit are in a group behind `--fox-detail`, which
`.fox-sm` sets to zero: at 32px in a header a clean head reads better than
either, and a tan bar is all the suit can ever be at that size.

## The bank

Two sources, loaded together and merged by `store.js`:

| | words | sentences |
|---|---|---|
| `seed.js`, as supplied | 130 | 100 |
| `vocab.js`, generated for this app | 404 | 802 |
| **total** | **534** | **902** |

`seed.js` is untouched and stays that way. `vocab.js` holds the rest: the
common words the seed did not reach, each with an example sentence, plus
sentences for the 30 seeded words that arrived without one. **Every word in
the bank now has at least one sentence**, so nothing falls back out of cloze
for want of one, and the "Cloze, no sentence" filter is empty.

Every generated word carries its own `topic`, so `topics.js` only has to file
the seed. A word added through the Manage screen carries one too.

### Where the later words and sentences came from

The first 261 generated words were written by hand. The rest came through
`tools/tatoeba/`, which pulls example sentences from
[Tatoeba](https://tatoeba.org) (CC-BY 2.0 FR) and word meanings and genders
from [Wiktionary](https://en.wiktionary.org) (CC-BY-SA, via kaikki.org).
Attribution is in the app under the menu as well as here, because both
licences ask for it.

The importers propose; a person decides. That is not a formality. Ranking
Tatoeba tokens by frequency and looking each up in Wiktionary first produced
`es` glossed "plural of e", `tenia` as "tapeworm" and `la` as a musical note.
And no filter can settle a noun-verb homograph: *vino* is wine and he came,
*suelo* is the floor and I usually. Of 143 curated words, 16 came back with an
example using the wrong sense and were rewritten by hand. Expect about one in
ten, and read every line.

Tatoeba's Spanish also leans towards Spain — *coche* outnumbers *carro* six to
one, vosotros forms outnumber *ustedes* two to one — so the importer drops
vosotros and a list of peninsular words rather than importing them. Its
English is mildly American; the handful of instances are normalised to British
spelling on the way in. `tools/tatoeba/README.md` has the counts.

### What the checks can and cannot tell you

`tools/bank/build.mjs` refuses to write a bank that is structurally wrong: an
id or a word used twice, a missing field, an unknown topic, a sentence with no
braced form or no English. One check is worth calling out — a generated word
is rejected if it *folds* to the same string as a seeded one, because accents
and punctuation are stripped before an answer is compared, which makes `¿qué?`
and `que` the same card and only one of them answerable. Three words were
caught by that and turned into extra sentences on the words that already
existed, which is where the difference between them actually shows.

None of that can tell you whether a translation is right. The Spanish has been
written with care, is Colombian-leaning, and has **not** been read by a native
speaker. Treat a surprising word or a stilted sentence as a bug worth fixing
rather than as gospel; `vocab.js` is as hand-editable as `seed.js`.

Adding more is a `.jsonl` batch and a rebuild: see `tools/bank/README.md`.
That build step is for authoring the data, not for running the app, which
still has none.

## Topics

Every word is filed under a context: food and drink, out and about, where
things are, at home, paying and shopping, small talk, asking questions, days
and time, describing things, everyday verbs, little words, people and family,
body and health, numbers and amounts, travel and transport, work and study,
weather and nature, feelings. Eighteen of them, each with between five and
sixty-odd words.
The Topics screen shows each one with how far through it you are and a button
that runs a round drawn from that topic alone. Nothing else changes: same
levels, same bands, same selection weighting, smaller pool.

The filing is kept out of `seed.js` deliberately. That file is the supplied
bank, verbatim, and a word's topic is a judgement rather than a fact about the
word, so it lives where it can be argued with separately. `tests/test-data.mjs`
fails if a word is filed twice or not at all, which is what stops a word added
to the bank from quietly vanishing off this screen.

There is still no Sport topic, and no clothes, animals or technology, because
the first tranche of generated words went to the commonest vocabulary rather
than to filling categories. Topics are built from what is in the bank rather
than from a list of subjects that ought to exist; the next tranche adds the
words and the topics together.

## Verb endings

The Lessons screen carries the ending tables: three families, six tenses
(present, preterite, imperfect, future, conditional, present subjunctive),
five persons. Latin American, so no vosotros; there is a note on vos, which
you will hear in Medellín. Each tense opens to a table built against real
verbs rather than shown as bare endings, with the stem greyed and the ending
in colour, because `-o -as -a` is hard to hold on to and `hablo hablas habla`
is not. Eighteen irregular verbs are written out in full underneath.

Those tables are also the drill. "Practise this table" turns a tense into
cards: the verb and the person are the prompt, the answer is read straight out
of `verbs.js`. A drill can only ask what the lesson already teaches, so a form
cannot be right in one place and wrong in the other, and a wrong form is wrong
in exactly one editable spot.

**A drill does not move any word's level.** A word's level means how well that
word is known; diluting it with endings drilled off a table would make it mean
nothing, so drills report a score and touch no progress at all.

## Pronunciation

Spanish spelling is near enough deterministic, so `pronounce.js` works the
sound out rather than storing it: there is no pronunciation data to keep in
step with the bank, and a word typed in this morning gets the same treatment
as a seeded one. It syllabifies, finds the stress, and returns a plain English
respelling with the stressed syllable in capitals — `habitación` to
`ah-bee-tah-SYOHN`, `jueves` to `HWEH-behs`. IPA would be more precise and
less use.

It only shows up where the spelling would mislead an English reader. `MEH-sah`
under mesa is noise; `HWEH-behs` under jueves is the point. The Lessons screen
has the rules behind it, each with examples from the bank.

It is a respeller, not a phonetician: the rr is written `rr` and left to the
note, the soft Spanish d between vowels is not marked, and regional habits
(the coastal aspirated s, the Southern Cone ll) are out of scope. Colombian,
seseo throughout.

## What you meet, and when

A bank of 534 words is not something to be handed all at once, and it is not
much use in alphabetical order either. Two rules decide what comes next, and
between them they are the whole of the progression:

**Commonest first.** `order.js` is a single array listing every word in the
order it is taught, grouped so it reads as a curriculum rather than a ranking:
the first words, getting through a conversation, asking, the verbs you will
reach for hourly, and so on down to the set phrases. New words are taken
strictly in that order, so the first five you ever meet are *ser, estar,
tener, hacer, ir* rather than five drawn out of a hat. It is judgement, not a
corpus count, and re-ordering it is a cut and paste. A test fails if the bank
holds a word the list does not place.

**Only as many as you can carry.** A word counts as *settling* until it is out
of the recognition band, which is to say until you can produce it rather than
merely recognise it. While twenty words are still settling, no new one is
introduced at all. Below that, a round takes on up to five.

That is enough to give a sensible shape without a schedule or a calendar
anywhere near it:

| round | cards | new |
|---|---|---|
| 1 | 5 | 5 |
| 2 | 10 | 5 |
| 3 onwards | 15 | 5, then fewer as the load builds |
| once twenty are settling | 15 | 0, until some come good |

The first round is five words, not fifteen you have never seen. Nothing tops a
short round back up out of the unseen pile, which is the point.

It also paces itself to how you are actually doing, because settling is what
frees a slot. Simulated over sixty rounds:

| getting right | new words met | per round |
|---|---|---|
| 90% | 107 | 1.8 |
| 70% | 68 | 1.1 |
| 50% | 39 | 0.7 |

Struggling slows the intake without ever stopping it for good; doing well
speeds it up. Both numbers are checked in `tests/test-order.mjs` rather than
asserted here and hoped for.

Two constants in `engine.js` tune it: `MAX_NEW_PER_ROUND` (5) and
`LEARNING_CAP` (20). Raise the cap for a faster, more crowded ride.

The Practice screen says where you are and what is about to happen — how many
words are met, how many are settling, and how many new ones this round will
bring, or why it will bring none.

## Meeting a word before being tested on it

A word you have never seen cannot be tested, only guessed at, so the first
time it comes up it is **shown** rather than asked: the word, what it means,
how to say it where that is not obvious, its note, and an example sentence
with the word still in place rather than blanked out. One button, Got it.
Testing starts the next time it comes round.

An introduction is not an answer. It marks the word met, so it is not
introduced twice, and touches nothing else: no level, no streak, no right or
wrong count, and it stays out of the round's accuracy. A round made entirely
of introductions reports how many words were met and says plainly that
nothing was tested.

How many new words a round may take on is the progression rule above; whether
they are shown first or tested straight away is this toggle in the menu.
Turning it off does not change the pacing, only what the card looks like.

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
those words, and the Add-a-sentence picker puts them at the top. Every word in
the bank now has a sentence, so that filter comes up empty and the fallback
should never fire; it stays because a word you add yourself will need one.

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
| `hunegr` for `hunger` | Almost | two letters swapped counts as one slip |
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

Distance is Damerau rather than plain Levenshtein, so a swapped pair of
letters costs one edit instead of two. Typing `hunegr` is one slip of the
fingers and is judged as one; plain Levenshtein calls it two and drops it over
the threshold into Wrong.

#### Overrides, and re-grading a card

"I was right" appears on anything short of a clean pass. Grading always works
from a snapshot of the word's progress taken when the card was drawn, so
overriding, or fixing a near miss, lands on exactly the progress that answer
would have produced first time — no doubled counts, and a streak the card
broke comes back intact rather than restarting.

## Syncing a phone and a laptop

Optional, off until you set it up, and the app is unchanged if you never do.
There is no account: one JSON blob under one secret code.

It costs so little because the shape was already there. The whole of a
learner's progress is a single serialisable object with a timestamp, because
Export needed that anyway, so syncing is *put the blob somewhere both devices
can reach, and merge on the way in*. No schema, no migration, no login. The
server is forty lines and two routes.

Set-up is one command; see `tools/sync/README.md`. Then paste the URL and the
code into the `⋯` menu on both devices. Syncing happens on load, at the end of
every round, and on the button.

### How two devices agree

localStorage stays the primary store. Sync is something that happens to it
afterwards, and the merge lives in `sync.js`:

| | |
|---|---|
| A word's progress | whichever device **touched it last** wins |
| Words you added | union; on the same id, the younger save wins |
| Settings | the younger save wins |
| Rounds done | the higher of the two, never the sum |

"Touched last" rather than "further along" is the important one. Taking the
higher level would quietly undo every wrong answer, because a level that went
down went down for a reason. And a disable counts as a touch, which is why a
progress row carries `changedAt` as well as `lastSeen`: without it, disabling
a word on the laptop would be switched back on by a phone that had merely
practised it more recently.

Merging is safe to repeat. Merging the same pair twice, or a state with
itself, changes nothing, which is what lets it run on every page load without
keeping any history.

The merge is the only part of this that can lose someone's work, so it is a
pure function of two states and `tests/test-sync.mjs` puts 28 assertions
through it. `tests/test-ui6.mjs` then runs two browsers against a real server
and checks the paths that matter more than the happy one: a level that went
down staying down, a word added on one device arriving on the other, two
devices writing at the same moment, the server unreachable, the server
returning 500, and turning it off again.

### What can go wrong, and what happens

Nothing here is allowed to block a card. Offline, endpoint down, wrong code,
private browsing with no storage: each one leaves the app working exactly as
it does with no sync at all, and says what happened in the menu. A clash with
another device returns the newer version so the client can merge it and retry,
once.

The code is 110 bits from `crypto.getRandomValues` and it *is* the
authorisation — it names an unguessable box rather than unlocking a named
account. So **anyone you give the code to has your progress**, and the app
says so where you set it up. Nothing personal is in the blob: no name, no
email, just which Spanish words you know.

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
node tests/test-engine.mjs      # 121 assertions, no dependencies
```

Covers the bands, level movement, the two-in-a-row boundary rule, the floor
and ceiling, the selection weighting, every answer-checking rule, which near
misses go amber and which stay wrong, the correction diff down to the letter,
what an amber answer does and does not do to a word, card building in all
three bands including the no-sentence fallback, and round selection. It also
covers the lapse counter: that a near miss costs nothing, that three misses
make a sticking point, that a sticking point is taught again rather than
asked and comes up twice as often, that being shown it is not the same as
learning it, that three right answers in a row clear it, and that progress
saved before any of this existed still loads and starts counting.

`tests/test-bank.mjs` loads both banks the way the app does and checks that
nothing is duplicated between them, that every generated word is complete and
has a sentence whose braced form matches, that every word in the bank builds a
card in all three bands, and that the respeller has something to say about all
534 of them.

`tests/test-senses.mjs` is about the 52 English prompts in this bank that
have more than one right Spanish answer. It works the collision groups out
from the bank itself rather than reading them from `store.js`, so a bug in the
grouping shows up as a disagreement instead of being agreed with, then holds
the line: every word in a group carries a tag, no two tags in a group are the
same, no tag contains its own answer or merely repeats the prompt, and typing
the sibling word grades amber with the sense named rather than red or "a
letter out".

`tests/test-ui.mjs` through `test-ui8.mjs` drive the real page in
a browser and need Playwright installed, which the app itself does not.
Between them they cover a full round from `file://`, persistence across a
reload, adding a word, the Manage filters, a real cloze card, the override, an
export and import round trip, a rejected junk file, an iPhone viewport with no
horizontal overflow, and the whole amber path: the near miss, the correction
shown on the card, the second go that is also wrong not making things worse,
and the second go that is right earning the level without counting the card
twice. `test-ui4.mjs` covers the topic screens, checks that a topic round
really is drawn from that topic alone, opens the lesson tables, runs a
conjugation drill and confirms it leaves every word's progress untouched.
`test-ui5.mjs` covers the introduction: that the first card of a fresh bank is
shown rather than asked, that Got it marks the word met without moving it,
that the same word is tested the next time, that the five-new cap bites once
there are met words to draw on, and that the setting turns it off.
`test-ui6.mjs` stands up a server implementing the same two routes as the real
one and runs two browser contexts against it as a phone and a laptop.
`test-ui7.mjs` opens the page with the operating system set to dark and checks
it comes up on paper anyway, that choosing dark sticks across a reload, that
the attribute is set in the head rather than by `app.js`, and that the choice
does not reach the synced settings. `test-ui8.mjs` covers the three things
that only exist with a browser running them: a new word taught and then asked
as the very next card, a word past the lapse threshold being taught again and
appearing in the Sticking points table, and an ambiguous English prompt
carrying its sense tag with the sibling answer graded amber.

## Not built, by request

Full interval scheduler with due dates, audio and text to speech, multiple
languages, cloud sync. Conjugation drills were on this list and are now built,
at the asking; they are deliberately kept out of the word mastery model. The seams are left clean: scheduling
lives entirely in `selectionWeight` and `pickRound`, so a due-date scheduler
replaces those two functions and nothing else.
