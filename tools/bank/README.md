# Where vocab.js comes from

`vocab.js` is generated from the `.jsonl` batches in this folder:

```bash
node tools/bank/build.mjs
```

One JSON object per line, one word per object, with its example sentence
attached. The builder merges the batches, checks them, and writes
`../../vocab.js`.

This is a build step for **authoring the data**, not for running the app. The
app still has none: `index.html` opens by double-clicking and loads `vocab.js`
with an ordinary script tag, exactly as it loads `seed.js`.

## The checks

The build refuses to write a file that is structurally wrong, which is most of
what a machine can settle about vocabulary:

- an id or a Spanish word used twice, here or in `seed.js`
- a word that folds to the same string as a seeded one, because accents and
  punctuation are stripped before an answer is compared, so `¿qué?` and `que`
  are the same card and only one of them can be answered
- a missing field, or a topic that `topics.js` does not define
- a sentence with none or several braced forms, or no English

It also prints, without failing, any braced form that shares no stem with its
word. Those are nearly always irregular verbs (`hacer` to `hago`) and want an
eye rather than a fix.

None of this can tell you whether a translation is right. See the note at the
top of `vocab.js`.

## Adding more

Add a numbered `.jsonl` file and rebuild. A row with `"sentenceOnly": true`
and a `wordId` adds a sentence to a word that already exists instead of a new
word, which is how the seeded words that arrived without one got theirs.

**Hand edits to `vocab.js` are lost on the next rebuild.** Either edit the
batches and rebuild, or delete this folder and treat `vocab.js` as the source
from then on, the way `seed.js` already is.
