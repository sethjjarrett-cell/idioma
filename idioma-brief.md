# Idioma — build brief

A personal Spanish vocabulary trainer. Single user, runs locally, no accounts, no backend, no external APIs. Colombian-leaning Latin American Spanish. Think Anki with a nicer interface, my words only, and example sentences at the top end.

Two seed files ship alongside this brief: `vocabulary.json` and `sentences.json`. Load them on first run. All copy, comments and identifiers in British English. No em dashes anywhere in UI text or comments; use commas or semicolons.

## Stack and persistence

Single-page web app. Plain HTML/CSS/JS or a light React setup, your call, but keep it one project I can open and extend by hand. No build step I have to babysit if avoidable.

All progress lives in `localStorage` under one key. Provide Export and Import buttons that dump/restore the full state as a JSON file, so I can back it up and hand-edit. Never lose progress on a reload.

## Data model

`vocabulary.json` word: `{ id, es, es_alt[], en[], pos, note }`. `es` plus `es_alt[]` are all accepted Spanish answers; `en[]` are all accepted English answers.

`sentences.json` item: `{ id, wordId, es, answer, en }`. The target surface form in `es` is wrapped in `{curly braces}`; `answer` is the exact string to type.

Per-word progress (localStorage): `{ level, correctStreak, totalCorrect, totalWrong, lastSeen, timesSeen, enabled }`. Level starts at 1.

## Mastery engine (v1 — every number below a named, tunable constant)

Levels 1 to 10, allowed to climb past 10 internally for scheduling.

- Correct: level +1. Wrong: level −1, floored at 1 (a word never drops to zero).
- Two correct in a row required to cross a band boundary (leaving L3 into L4, and leaving L7 into L8).

Band decides direction and format:

- **L1 to L3** — show Spanish, type the English (recognition).
- **L4 to L7** — show English, type the Spanish (production).
- **L8 to L10** — show a sentence from `sentences.json` for that word with the target blanked, type the missing word (cloze). If a word has no sentence, fall back to L4-7 style and flag it in the manage screen so I can add one.

Selection (this is the spaced-repetition part, do not skip it): pick the next card by a weight that combines **lower level** (higher weight) **and longer time since `lastSeen`** (higher weight). So a high-level word seen recently rarely shows; a high-level word not seen for a while resurfaces. Even L10 words keep a small non-zero weight so they recur occasionally for retention. A simple formula is fine, for example `weight = (11 − min(level,10)) + timeSinceLastSeenFactor`, tuned so it feels right. Do not use fixed Anki-style due dates in v1.

## Answer checking

- Case-insensitive and accent-insensitive for matching (á matches a, ñ matches n, ¿¡ ignored), so typing on a phone without accents still passes. **Always display the correctly accented form on reveal** so I still learn it.
- Trim whitespace. Accept any listed answer (`en[]` one direction, `es` + `es_alt[]` the other).
- A leading article (el/la/un/una) is optional, accepted with or without.
- Auto-grade, but show an "I was right" override for edge cases the checker misses (it adjusts the last result).
- Optional typo tolerance (Levenshtein distance 1). Default **off**, behind a settings toggle.

## UI

- **Practice**: card front shows the prompt (word or sentence). I type, submit, then see: correct/incorrect, the accented answer, and the word's `note` if it has one. Notes carry real dialect warnings (for example "un tinto = black coffee in Colombia", "coger is vulgar in Mexico/Argentina"), so surface them clearly.
- Run in rounds (default 15 cards). End-of-round summary: accuracy, words that levelled up, words that dropped.
- **Manage**: list every word with its level and band. Add a new word (`es`, `en`, `pos`, `note`), edit one, disable one. Adding words is core, I will do it often. Same for adding sentences (same JSON shape), so the bank grows.
- **Progress**: count of words in each band, current streaks, total learned.

## Out of scope for v1 (leave clean seams, do not build yet)

Full interval scheduler with due dates; audio/text-to-speech; conjugation drills; multiple languages; any cloud sync. These are the refine-later pile.

## Content note

Do not auto-generate Spanish. Use the supplied bank as the single source of truth; I will extend it. The seed data already has the earlier errors corrected and is Colombian-leaning throughout.
