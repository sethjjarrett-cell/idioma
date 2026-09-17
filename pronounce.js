/* Pronunciation, worked out rather than stored.

   Spanish spelling is very close to deterministic: with a handful of rules
   you can go from the written word to the sound, which is exactly what
   English cannot do. So there is no table of pronunciations here, and no
   per-word data to keep in step with the bank. Give it a word, including
   one typed in this morning, and it works the sound out.

   The output is a plain English respelling with the stressed syllable in
   capitals, because that is what a learner can actually read out loud.
   IPA would be more precise and less use.

   It does not try to be a phonetician. The rr is written rr and left to
   the note to explain, the Spanish d between vowels is not softened, and
   regional habits (aspirated s on the coast, ll as zh in the Southern Cone)
   are out of scope. Colombian, unaspirated, seseo throughout.
*/

const VOWELS = "aeiouáéíóúü";
const STRONG = "aeoáéó";      // an accented weak vowel also behaves as strong
const ACCENTED = "áéíóú";

const isVowel = (c) => VOWELS.includes(c);
/* i and u glide onto a neighbouring vowel; a, e, o do not, and an accent on
   an i or a u cancels the glide, which is the whole job of the accent in
   día and país. */
const isWeak = (c) => c === "i" || c === "u" || c === "ü";

/* Clusters that never split across a syllable break: a stop or f followed
   by l or r, and the three digraphs that are single letters in Spanish. */
const INSEPARABLE = ["pr", "br", "tr", "dr", "cr", "gr", "fr",
                     "pl", "bl", "cl", "gl", "fl", "ch", "ll", "rr",
                     // qu and the silent gu are one consonant apiece, so a
                     // break must not fall inside them: iz-quier-da.
                     "qu", "gu"];

/* Split a word into syllables. Consonants between two vowels go with the
   following vowel; two consonants split, unless they are inseparable;
   three or more leave only the last one or two to the following syllable. */
function syllables(word) {
  const w = word.toLowerCase();
  if (!w) return [];

  // Walk the word as nuclei (a vowel or a run of vowels that glide together)
  // and the consonant runs between them.
  const parts = [];
  let i = 0;
  let consonants = "";
  while (i < w.length) {
    // The u of qu, and of gu before e or i, is silent. It belongs to the
    // consonant, not to a syllable of its own, or qué comes out as two.
    if (w[i] === "q" && w[i + 1] === "u") { consonants += "qu"; i += 2; continue; }
    if (w[i] === "g" && w[i + 1] === "u" && "eéií".includes(w[i + 2] || "")) {
      consonants += "gu"; i += 2; continue;
    }
    if (!isVowel(w[i])) { consonants += w[i]; i++; continue; }
    let nucleus = w[i];
    i++;
    while (i < w.length && isVowel(w[i])) {
      const prev = nucleus[nucleus.length - 1];
      const next = w[i];
      // A glide needs an unaccented weak vowel on one side. Two strong
      // vowels are two syllables, and an accent on the weak one cancels
      // the glide, which is the whole job of the accent in día and país.
      // An accent on a strong vowel only marks stress: -ción stays one.
      const glides = (isWeak(prev) && !ACCENTED.includes(prev))
        || (isWeak(next) && !ACCENTED.includes(next));
      if (!glides) break;
      nucleus += next;
      i++;
    }
    parts.push({ onset: consonants, nucleus });
    consonants = "";
  }
  if (!parts.length) return [w];

  const out = parts.map((p) => p.nucleus);
  let tail = consonants;   // whatever trailed off the end

  // Hand each consonant run to the syllables either side of it.
  for (let k = 1; k < parts.length; k++) {
    const run = parts[k].onset;
    let keep;            // stays with the previous syllable
    let give;            // starts this one
    if (run.length <= 1) { keep = ""; give = run; }
    else if (INSEPARABLE.includes(run.slice(-2))) { keep = run.slice(0, -2); give = run.slice(-2); }
    else { keep = run.slice(0, -1); give = run.slice(-1); }
    out[k - 1] += keep;
    out[k] = give + out[k];
  }
  out[0] = parts[0].onset + out[0];
  out[out.length - 1] += tail;
  return out;
}

/* Which syllable carries the stress. A written accent settles it; failing
   that, a word ending in a vowel, n or s is stressed on the second last
   syllable and everything else on the last. That rule and its exceptions
   are the only reason Spanish writes accents at all. */
function stressedIndex(sylls) {
  for (let k = 0; k < sylls.length; k++) {
    if ([...sylls[k]].some((c) => ACCENTED.includes(c))) return k;
  }
  if (sylls.length < 2) return 0;
  const last = sylls[sylls.length - 1];
  const final = last[last.length - 1];
  return "aeiouáéíóúns".includes(final)
    ? sylls.length - 2
    : sylls.length - 1;
}

/* Letters to sounds, longest match first so the digraphs win. `next` is the
   letter after the match, which is what decides c, g and qu. */
const SOUNDS = [
  ["ch", () => "ch"],
  ["ll", () => "y"],
  ["rr", () => "rr"],
  ["qu", () => "k"],                                   // the u is silent
  // gu does three things: the u is silent before e and i, glides as a w
  // before a and o, and is an ordinary vowel when it ends the syllable.
  ["gu", (n) => (!n ? "goo" : "eéií".includes(n) ? "g" : "aáoó".includes(n) ? "gw" : "goo")],
  ["gü", () => "gw"],                             // the diaeresis puts it back
  ["c", (n) => (n && "eéií".includes(n) ? "s" : "k")],
  ["g", (n) => (n && "eéií".includes(n) ? "h" : "g")],
  ["z", () => "s"],
  ["j", () => "h"],
  ["ñ", () => "ny"],
  ["h", () => ""],                                     // always silent
  ["v", () => "b"],
  ["x", () => "ks"],
  ["y", (n) => (n ? "y" : "ee")],                      // a vowel at the end of a word
  ["á", () => "ah"], ["é", () => "eh"], ["í", () => "ee"],
  ["ó", () => "oh"], ["ú", () => "oo"], ["ü", () => "oo"],
  ["a", () => "ah"], ["e", () => "eh"], ["i", () => "ee"],
  ["o", () => "oh"], ["u", () => "oo"],
];

/* Weak vowel plus another vowel is one sound, not two: ie is yeh, ue is weh.
   Written out rather than derived because the English spellings are not
   regular enough to build. */
const GLIDES = {
  ia: "yah", ie: "yeh", io: "yoh", iu: "yoo",
  ua: "wah", ue: "weh", ui: "wee", uo: "woh",
  ai: "eye", ay: "eye", ei: "ay", ey: "ay",
  oi: "oy", oy: "oy", au: "ow", eu: "eh-oo", uy: "wee",
  "iá": "yah", "ié": "yeh", "ió": "yoh",
  "uá": "wah", "ué": "weh",
};

function respellSyllable(syl) {
  let out = "";
  let i = 0;
  while (i < syl.length) {
    const pair = syl.slice(i, i + 2);
    // y counts as a vowel here: hay is one sound, not ah-ee.
    if (GLIDES[pair] && isVowel(syl[i]) && (isVowel(syl[i + 1]) || syl[i + 1] === "y")) {
      out += GLIDES[pair];
      i += 2;
      continue;
    }
    const rule = SOUNDS.find(([letters]) => syl.startsWith(letters, i));
    if (rule) {
      out += rule[1](syl[i + rule[0].length] || "");
      i += rule[0].length;
    } else {
      out += syl[i];
      i++;
    }
  }
  return out;
}

/* The whole thing: hyphenated syllables, the stressed one in capitals. */
function respell(text) {
  return String(text ?? "")
    .split(/(\s+)/)
    .map((chunk) => {
      const word = chunk.replace(/[^A-Za-zÀ-ſ]/g, "");
      if (!word) return chunk.trim() ? "" : chunk;
      const sylls = syllables(word);
      // Nothing to point at in a word of one syllable, so leave it alone.
      const stress = sylls.length > 1 ? stressedIndex(sylls) : -1;
      return sylls
        .map((s, k) => (k === stress ? respellSyllable(s).toUpperCase() : respellSyllable(s)))
        .filter(Boolean)
        .join("-");
    })
    .join("")
    .trim();
}

/* Is this a word an English reader would get wrong on sight? No point
   putting "MEH-sah" under mesa; every point putting "HWEH-behs" under
   jueves. Anything with a letter that does not say what it looks like. */
const TRICKY = /ll|rr|ñ|j|z|h|v|qu|gü|[cg][eiéí]|gu[eiéí]|x|y\b/i;
function isTricky(text) {
  return TRICKY.test(String(text ?? "").toLowerCase());
}

/* The lesson. Examples are all words from the bank, so the rule is read
   against something already being learned. */
const RULES = [
  { letters: "j", says: "h, from the back of the throat",
    examples: [["jueves", "Thursday"], ["trabajar", "to work"], ["mujer", "woman"]],
    note: "Harder than an English h; closer to the ch in Scottish loch." },
  { letters: "g before e or i", says: "the same throaty h",
    examples: [["coger", "to get"], ["conseguir", "to get"]],
    note: "Everywhere else g is hard, as in gato." },
  { letters: "gu before e or i", says: "a hard g; the u is silent",
    examples: [["conseguir", "to get"], ["siguiente", "next"]],
    note: "The u is only there to protect the g. When it does need saying it gets two dots: güe, güi." },
  { letters: "ll", says: "y",
    examples: [["llegar", "to arrive"], ["calle", "street"], ["lleno", "full"]],
    note: "In Argentina and Uruguay this is a zh or sh sound. In Colombia it is a plain y." },
  { letters: "ñ", says: "ny, as in canyon",
    examples: [["baño", "bathroom"], ["año", "year"]],
    note: "A different letter from n, not a decorated one. It has its own place in the alphabet." },
  { letters: "h", says: "nothing at all",
    examples: [["hambre", "hunger"], ["hacer", "to do"], ["hay", "there is"]],
    note: "Silent without exception. The only h sound in Spanish is written j or g." },
  { letters: "c before e or i, and z", says: "s",
    examples: [["cerca", "near"], ["cerrado", "closed"], ["vez", "time"], ["izquierda", "left"]],
    note: "This is seseo, and it is all of Latin America. In most of Spain these are a th sound instead." },
  { letters: "c elsewhere, and qu", says: "k",
    examples: [["cama", "bed"], ["¿qué?", "what"], ["querer", "to want"]],
    note: "The u in qu is silent, always." },
  { letters: "v", says: "b",
    examples: [["vivir", "to live"], ["viajar", "to travel"], ["vaso", "glass"]],
    note: "b and v are the same sound in Spanish. Spanish speakers spelling out loud say be larga and ve corta to tell them apart." },
  { letters: "rr, and r starting a word", says: "a rolled r",
    examples: [["cerrado", "closed"], ["arriba", "up"], ["rojo", "red"]],
    note: "A single r between vowels is a quick tap instead, much like the tt in American water." },
  { letters: "the five vowels", says: "ah, eh, ee, oh, oo",
    examples: [["mesa", "table"], ["tinto", "black coffee"], ["mucho", "a lot"]],
    note: "One sound each, every time, however fast the word goes. This is the single biggest difference from English and the easiest win." },
];

const STRESS_NOTE = {
  title: "Where the stress falls",
  body: "Two rules cover almost everything. A word ending in a vowel, n or s is stressed on the second last syllable: MEH-sah, HWEH-behs. Anything else is stressed on the last: seh-NYOR, ehs-pah-NYOL. A written accent means the word breaks those rules and the accent shows where the stress actually goes, which is why habitación has one and habitaciones does not need one.",
};

window.Pronounce = { syllables, stressedIndex, respell, isTricky, RULES, STRESS_NOTE };
