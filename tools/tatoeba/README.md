# Where the sentences and the glosses come from

Two importers. Neither writes into the repo: they propose, and a person reads
what they propose and decides. A corpus can tell you a sentence is short and
common. It cannot tell you it is a good thing to put in front of a learner,
and this session's run is the proof — see **What it gets wrong** below.

## Getting the data

Not committed: it is hundreds of megabytes and it is not ours to redistribute.

```bash
CACHE=/tmp/idioma-cache            # or set IDIOMA_CACHE
mkdir -p $CACHE/tat $CACHE/kaikki

# Tatoeba: sentences, and the links between translations. CC-BY 2.0 FR.
cd $CACHE/tat
curl -O https://downloads.tatoeba.org/exports/per_language/spa/spa_sentences.tsv.bz2
curl -O https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2
curl -O https://downloads.tatoeba.org/exports/per_language/spa/spa-eng_links.tsv.bz2
bunzip2 -k *.bz2
mv spa_sentences.tsv spa.tsv; mv eng_sentences.tsv eng.tsv; mv spa-eng_links.tsv spa-eng.tsv

# Wiktionary, machine-readable via kaikki.org. CC-BY-SA.
cd $CACHE/kaikki
for pos in noun adj adv; do
  curl -o $pos.jsonl \
    https://kaikki.org/dictionary/Spanish/pos-$pos/kaikki.org-dictionary-Spanish-by-pos-$pos.jsonl
done
```

Verbs are also available from kaikki, at 730MB, most of it conjugation tables.
`verbs.js` covers the tenses by hand instead.

## Running them

```bash
node tools/tatoeba/propose.mjs sentences    # extra examples for words we have
node tools/tatoeba/propose.mjs words 200    # candidate new words, commonest first
node tools/tatoeba/attach.mjs list.txt      # examples for a curated list
```

`attach.mjs` takes `id|es|en|pos|topic|note` a line: the English, the topic and
the note are yours, the sentence is the corpus's. That split is the point. Its
output goes in `tools/bank/` as a numbered batch and then through
`tools/bank/build.mjs`.

## The filter

Of 283,395 Spanish-English pairs, 197,864 survive. Rejected: too long, proper
nouns, digits, awkward punctuation, no end punctuation, and two that matter
here — **vosotros forms**, which are Spain's second person plural and not used
in Latin America, and **peninsular vocabulary**, because a sentence saying
*coche* contradicts the card teaching *carro*.

That last one is not a hunch. Counted over all 442,006 Spanish sentences:
coche 2,271 against carro 388; conducir 477 against manejar 169; gafas 304
against lentes 154; vosotros forms 2,650 against ustedes 1,366. Tatoeba's
Spanish leans hard towards Spain, so it needs filtering rather than importing.

Sentences are then ranked by how much of the rest of the sentence is already
in the bank, so an example teaches one new thing instead of four.

## What it gets wrong

**Word discovery is not trustworthy on its own.** Ranking Tatoeba tokens by
frequency and looking each up in Wiktionary produced, in its first form,
`es` glossed "plural of e", `tenia` as "tapeworm" and `la` as a musical note.
Two fixes got most of it: count with the accents left on, because stripping
them conflates *inglés* with *ingles* and *tenía* with *tenia*; and reject any
gloss reading "plural of", "feminine of" or "misspelling of", since Wiktionary
has an entry for every inflected form and they dominate a frequency list.

**What no filter fixes is the noun-verb homograph.** Spanish is full of words
that are both: *vino* is wine and he came, *suelo* is the floor and I usually,
*odio* is hatred and I hate. Without tagging the sentence there is no way to
know which sense is in it. A reflexive pronoun in front of the target is
caught, which handles *me baño*, and the rest is caught by reading. Of 143
curated words, 16 came back with an example using the wrong sense and were
written by hand instead. Expect roughly one in ten.

So: use it for sentences, use it for candidates, and read every line before it
goes in the bank.

## Attribution

Required by both licences, and in `index.html` under the menu as well as here.
Sentences from [Tatoeba](https://tatoeba.org) under CC-BY 2.0 FR. Word
meanings and genders from [Wiktionary](https://en.wiktionary.org) under
CC-BY-SA, via [kaikki.org](https://kaikki.org).
