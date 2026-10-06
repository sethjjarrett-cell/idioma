/* Verb endings, as data.

   These tables are the single source of truth for both the lesson and the
   drill. The drill can only ask what a table already answers, so a form
   cannot be invented on the fly and cannot be wrong in the drill while
   being right in the lesson; if a form here is wrong it is wrong in one
   visible place and is fixed in one edit.

   Regular verbs are stored as endings and built: base + ending, where the
   base is the stem for most tenses and the whole infinitive for the future
   and the conditional. Irregular verbs are written out in full rather than
   derived, because the whole point of an irregular is that the rule does
   not reach it.

   Colombian-leaning, so vosotros is left out. It is Spain's second person
   plural; ustedes covers it everywhere in Latin America. See the notes at
   the bottom for vos, which you will hear in Medellín.
*/
const VERBS = {

  /* Five persons, not six. The él column doubles as usted, which is the
     one Colombians use most with strangers. */
  persons: [
    { id: "yo",       label: "yo",                gloss: "I",                       short: "I",    subject: "I" },
    { id: "tu",       label: "tú",                gloss: "you",                     short: "you",  subject: "you" },
    { id: "el",       label: "él / ella / usted", gloss: "he, she, you (polite)",   short: "he, she", subject: "he" },
    { id: "nosotros", label: "nosotros",          gloss: "we",                      short: "we",   subject: "we" },
    { id: "ellos",    label: "ellos / ustedes",   gloss: "they, you (plural)",      short: "they", subject: "they" },
  ],

  /* base: "stem" drops the last two letters of the infinitive, "infinitive"
     keeps the lot. Future and conditional are the easy ones precisely
     because they keep it. */
  tenses: [
    {
      id: "present",
      name: "Present",
      base: "stem",
      blurb: "What is happening now, and what happens generally. Also does the job of the English “I am -ing”.",
      note: "-er and -ir are the same tense apart from one square: comemos against vivimos.",
      endings: {
        ar: { yo: "o", tu: "as", el: "a", nosotros: "amos", ellos: "an" },
        er: { yo: "o", tu: "es", el: "e", nosotros: "emos", ellos: "en" },
        ir: { yo: "o", tu: "es", el: "e", nosotros: "imos", ellos: "en" },
      },
    },
    {
      id: "preterite",
      name: "Preterite",
      base: "stem",
      blurb: "A finished action at a point in the past. I ate, I went, I said it once.",
      note: "-er and -ir take identical endings here. The yo and él forms carry the accent, and it is the accent that does the work: hablo is I speak, habló is he spoke.",
      endings: {
        ar: { yo: "é",  tu: "aste", el: "ó",   nosotros: "amos", ellos: "aron" },
        er: { yo: "í",  tu: "iste", el: "ió",  nosotros: "imos", ellos: "ieron" },
        ir: { yo: "í",  tu: "iste", el: "ió",  nosotros: "imos", ellos: "ieron" },
      },
    },
    {
      id: "imperfect",
      name: "Imperfect",
      base: "stem",
      blurb: "The past as a background: used to, was doing, kept doing. No end point in view.",
      note: "Only three verbs in the language are irregular here: ser, ir and ver.",
      endings: {
        ar: { yo: "aba", tu: "abas", el: "aba", nosotros: "ábamos", ellos: "aban" },
        er: { yo: "ía", tu: "ías", el: "ía", nosotros: "íamos", ellos: "ían" },
        ir: { yo: "ía", tu: "ías", el: "ía", nosotros: "íamos", ellos: "ían" },
      },
    },
    {
      id: "future",
      name: "Future",
      base: "infinitive",
      blurb: "Will do. Endings go on the whole infinitive, so there is nothing to chop off.",
      note: "One set of endings for all three families. Every form but nosotros carries an accent.",
      endings: {
        ar: { yo: "é", tu: "ás", el: "á", nosotros: "emos", ellos: "án" },
        er: { yo: "é", tu: "ás", el: "á", nosotros: "emos", ellos: "án" },
        ir: { yo: "é", tu: "ás", el: "á", nosotros: "emos", ellos: "án" },
      },
    },
    {
      id: "conditional",
      name: "Conditional",
      base: "infinitive",
      blurb: "Would do. Also the polite one: ¿podrías...? is softer than ¿puedes...?",
      note: "Same endings as the imperfect of -er and -ir, but stuck on the full infinitive.",
      endings: {
        ar: { yo: "ía", tu: "ías", el: "ía", nosotros: "íamos", ellos: "ían" },
        er: { yo: "ía", tu: "ías", el: "ía", nosotros: "íamos", ellos: "ían" },
        ir: { yo: "ía", tu: "ías", el: "ía", nosotros: "íamos", ellos: "ían" },
      },
    },
    {
      id: "subjunctive",
      name: "Present subjunctive",
      base: "stem",
      blurb: "For wanting, doubting, hoping and anything after ojalá or para que. Not a tense so much as a mood.",
      note: "The endings swap sides: -ar takes the -er endings and -er/-ir take the -ar ones.",
      endings: {
        ar: { yo: "e", tu: "es", el: "e", nosotros: "emos", ellos: "en" },
        er: { yo: "a", tu: "as", el: "a", nosotros: "amos", ellos: "an" },
        ir: { yo: "a", tu: "as", el: "a", nosotros: "amos", ellos: "an" },
      },
    },
  ],

  /* One worked example per family, each a word already in the bank. */
  families: [
    { id: "ar", name: "-ar verbs", example: "hablar", gloss: "to talk", note: "Much the biggest family, and the one new verbs join." },
    { id: "er", name: "-er verbs", example: "comer",  gloss: "to eat" },
    { id: "ir", name: "-ir verbs", example: "vivir",  gloss: "to live" },
  ],

  /* Written out, not derived. Only the tenses that actually misbehave are
     listed; anything absent follows the regular table for its family. */
  irregulars: [
    {
      infinitive: "ser", gloss: "to be", family: "er",
      note: "Permanent: who or what something is. Soy ingeniero. Paired against estar below, and the two are not interchangeable.",
      forms: {
        present:   { yo: "soy",  tu: "eres",   el: "es",   nosotros: "somos",   ellos: "son" },
        preterite: { yo: "fui",  tu: "fuiste", el: "fue",  nosotros: "fuimos",  ellos: "fueron" },
        imperfect: { yo: "era",  tu: "eras",   el: "era",  nosotros: "éramos", ellos: "eran" },
      },
    },
    {
      infinitive: "estar", gloss: "to be", family: "ar",
      note: "Temporary, and location. Estoy cansado, and estoy en casa. Where you are is always estar, however permanently you live there.",
      forms: {
        present:   { yo: "estoy",  tu: "estás",    el: "está",  nosotros: "estamos",    ellos: "están" },
        preterite: { yo: "estuve", tu: "estuviste", el: "estuvo", nosotros: "estuvimos", ellos: "estuvieron" },
      },
    },
    {
      infinitive: "ir", gloss: "to go", family: "ir",
      note: "Its preterite is borrowed wholesale from ser, so fui is both I went and I was; context tells them apart. Voy a + infinitive is the everyday future.",
      forms: {
        present:   { yo: "voy", tu: "vas",    el: "va",  nosotros: "vamos",  ellos: "van" },
        preterite: { yo: "fui", tu: "fuiste", el: "fue", nosotros: "fuimos", ellos: "fueron" },
        imperfect: { yo: "iba", tu: "ibas",   el: "iba", nosotros: "íbamos", ellos: "iban" },
      },
    },
    {
      infinitive: "tener", gloss: "to have", family: "er",
      note: "Also does age and hunger: tengo veinticinco años, tengo hambre. Tener que + infinitive is have to.",
      forms: {
        present:   { yo: "tengo", tu: "tienes",  el: "tiene", nosotros: "tenemos", ellos: "tienen" },
        preterite: { yo: "tuve",  tu: "tuviste", el: "tuvo",  nosotros: "tuvimos", ellos: "tuvieron" },
      },
    },
    {
      infinitive: "hacer", gloss: "to do, to make", family: "er",
      note: "Note the c to z in hizo, which keeps the sound rather than changing it.",
      forms: {
        present:   { yo: "hago", tu: "haces",   el: "hace", nosotros: "hacemos", ellos: "hacen" },
        preterite: { yo: "hice", tu: "hiciste", el: "hizo", nosotros: "hicimos", ellos: "hicieron" },
      },
    },
    {
      infinitive: "poder", gloss: "to be able to", family: "er",
      note: "o to ue in the present, everywhere except nosotros. Draw a boot round the table and the change is inside it.",
      forms: {
        present:   { yo: "puedo", tu: "puedes",  el: "puede", nosotros: "podemos", ellos: "pueden" },
        preterite: { yo: "pude",  tu: "pudiste", el: "pudo",  nosotros: "pudimos", ellos: "pudieron" },
      },
    },
    {
      infinitive: "querer", gloss: "to want", family: "er",
      note: "e to ie, same boot shape. Quise in the preterite leans towards I tried; no quise is I refused.",
      forms: {
        present:   { yo: "quiero", tu: "quieres", el: "quiere", nosotros: "queremos", ellos: "quieren" },
        preterite: { yo: "quise",  tu: "quisiste", el: "quiso", nosotros: "quisimos", ellos: "quisieron" },
      },
    },
    {
      infinitive: "venir", gloss: "to come", family: "ir",
      forms: {
        present:   { yo: "vengo", tu: "vienes",  el: "viene", nosotros: "venimos", ellos: "vienen" },
        preterite: { yo: "vine",  tu: "viniste", el: "vino",  nosotros: "vinimos", ellos: "vinieron" },
      },
    },
    {
      infinitive: "decir", gloss: "to say", family: "ir",
      note: "A j stem in the preterite swallows the i of the ellos ending: dijeron, never dijieron. Traer does the same.",
      forms: {
        present:   { yo: "digo", tu: "dices",   el: "dice", nosotros: "decimos", ellos: "dicen" },
        preterite: { yo: "dije", tu: "dijiste", el: "dijo", nosotros: "dijimos", ellos: "dijeron" },
      },
    },
    {
      infinitive: "dar", gloss: "to give", family: "ar",
      note: "Takes -er endings in the preterite, and takes no accents at all there: di, dio.",
      forms: {
        present:   { yo: "doy", tu: "das",    el: "da",  nosotros: "damos", ellos: "dan" },
        preterite: { yo: "di",  tu: "diste",  el: "dio", nosotros: "dimos", ellos: "dieron" },
      },
    },
    {
      infinitive: "saber", gloss: "to know", family: "er",
      note: "Facts, not people. Knowing a person is conocer. Sé carries an accent to keep it apart from se.",
      forms: {
        present:   { yo: "sé", tu: "sabes",   el: "sabe", nosotros: "sabemos", ellos: "saben" },
        preterite: { yo: "supe",    tu: "supiste", el: "supo", nosotros: "supimos", ellos: "supieron" },
      },
    },
    {
      infinitive: "poner", gloss: "to put", family: "er",
      forms: {
        present:   { yo: "pongo", tu: "pones",   el: "pone", nosotros: "ponemos", ellos: "ponen" },
        preterite: { yo: "puse",  tu: "pusiste", el: "puso", nosotros: "pusimos", ellos: "pusieron" },
      },
    },
    {
      infinitive: "salir", gloss: "to leave", family: "ir",
      note: "Irregular in the yo only; the preterite is entirely regular.",
      forms: {
        present:   { yo: "salgo", tu: "sales", el: "sale", nosotros: "salimos", ellos: "salen" },
      },
    },
    {
      infinitive: "traer", gloss: "to bring", family: "er",
      forms: {
        present:   { yo: "traigo", tu: "traes",    el: "trae", nosotros: "traemos", ellos: "traen" },
        preterite: { yo: "traje",  tu: "trajiste", el: "trajo", nosotros: "trajimos", ellos: "trajeron" },
      },
    },
    {
      infinitive: "dormir", gloss: "to sleep", family: "ir",
      note: "o to ue in the present, and o to u in the third persons of the preterite: durmió, durmieron.",
      forms: {
        present:   { yo: "duermo", tu: "duermes",  el: "duerme",  nosotros: "dormimos", ellos: "duermen" },
        preterite: { yo: "dormí", tu: "dormiste", el: "durmió", nosotros: "dormimos", ellos: "durmieron" },
      },
    },
    {
      infinitive: "pedir", gloss: "to order, to ask for", family: "ir",
      note: "e to i. The one you want in a restaurant.",
      forms: {
        present:   { yo: "pido", tu: "pides",    el: "pide",   nosotros: "pedimos", ellos: "piden" },
        preterite: { yo: "pedí", tu: "pediste", el: "pidió", nosotros: "pedimos", ellos: "pidieron" },
      },
    },
    {
      infinitive: "encontrar", gloss: "to find", family: "ar",
      note: "o to ue in the present. The preterite is regular.",
      forms: {
        present: { yo: "encuentro", tu: "encuentras", el: "encuentra", nosotros: "encontramos", ellos: "encuentran" },
      },
    },
    {
      infinitive: "conseguir", gloss: "to get", family: "ir",
      note: "e to i, and the u of gu is dropped before o or a, because it was only there to keep the g hard before e.",
      forms: {
        present: { yo: "consigo", tu: "consigues", el: "consigue", nosotros: "conseguimos", ellos: "consiguen" },
      },
    },
  ],

  /* The future and the conditional are the one place in Spanish where a
     handful of verbs share one irregularity: they build on a shortened stem
     instead of the infinitive, and then take the ordinary endings. tendré and
     tendría, not teneré and tenería.

     There are twelve of them and that is the lot, which is why they are a
     table rather than twelve entries in `irregulars`. Without it, conjugate
     would build teneré from the regular rule and hand back a word that does
     not exist. */
  futureStems: {
    tener: "tendr", poner: "pondr", venir: "vendr", salir: "saldr",
    valer: "valdr", poder: "podr", querer: "querr", saber: "sabr",
    haber: "habr", caber: "cabr", hacer: "har", decir: "dir",
    suponer: "supondr",
  },

  /* Stem-changing verbs. Not irregular so much as patterned: the last e or o
     of the stem changes whenever it carries the stress, which is every
     person of the present and the subjunctive except nosotros. An -ir verb
     also changes in the preterite's él and ellos, and in the subjunctive's
     nosotros, to i or u (sintió, durmamos). Without this table the rule
     builds "cerran" and "dole", which nobody has ever said. */
  stemChanges: {
    "e>ie": ["pensar", "empezar", "entender", "sentir", "cerrar", "perder", "extender", "despertar",
      "sentar", "preferir", "mentir", "querer"],
    "o>ue": ["volver", "devolver", "recordar", "doler", "mostrar", "acostar", "contar", "mover", "probar",
      "llover", "volar", "almorzar", "morir", "dormir", "encontrar", "poder"],
    "u>ue": ["jugar"],
    "e>i": ["seguir", "conseguir", "servir", "vestir", "elegir", "pedir"],
  },

  /* A yo form the rule cannot build. The subjunctive is built on it as well:
     conozco gives conozca, sigo gives siga. */
  yoForms: {
    conocer: "conozco", parecer: "parezco", nacer: "nazco", crecer: "crezco", agradecer: "agradezco",
    caer: "caigo", oír: "oigo", coger: "cojo", elegir: "elijo", seguir: "sigo", conseguir: "consigo",
    ver: "veo",
    // The g verbs: listed in full for the present, but the subjunctive
    // still needs to know: tenga, ponga, salga.
    tener: "tengo", poner: "pongo", venir: "vengo", salir: "salgo", hacer: "hago",
    decir: "digo", traer: "traigo",
  },

  /* Verbs that stress the i, so it takes an accent wherever the stem is
     stressed: confío, confíe, but confiamos. */
  stressedI: ["confiar"],

  /* A verb built on a listed irregular, which it follows form for form. */
  prefixed: { suponer: "poner" },

  /* The few forms no pattern produces, listed here rather than in
     `irregulars` because they are not worth a lesson of their own. A listed
     form wins over every rule. */
  special: {
    ver: {
      preterite: { yo: "vi", tu: "viste", el: "vio", nosotros: "vimos", ellos: "vieron" },
      imperfect: { yo: "veía", tu: "veías", el: "veía", nosotros: "veíamos", ellos: "veían" },
    },
    oír: {
      present: { yo: "oigo", tu: "oyes", el: "oye", nosotros: "oímos", ellos: "oyen" },
    },
    reír: {
      present: { yo: "río", tu: "ríes", el: "ríe", nosotros: "reímos", ellos: "ríen" },
      preterite: { yo: "reí", tu: "reíste", el: "rio", nosotros: "reímos", ellos: "rieron" },
      subjunctive: { yo: "ría", tu: "rías", el: "ría", nosotros: "riamos", ellos: "rían" },
    },
  },

  /* Short pieces that are not tables. */
  notes: [
    {
      title: "The boot",
      body: "Stem changes (o to ue, e to ie, e to i) hit every person except nosotros. Write the table out and the changed forms sit in a boot shape round the outside. Nothing changes in the infinitive, so the change is something you learn per verb and then apply by shape.",
    },
    {
      title: "The yo-go verbs",
      body: "A cluster of common verbs add a g in the yo form and are otherwise well behaved: tengo, vengo, pongo, salgo, hago, digo, traigo. Learning them as a set is quicker than learning them as seven separate irregulars.",
    },
    {
      title: "Participles",
      body: "The -ing form is -ando for -ar verbs and -iendo for -er and -ir: hablando, comiendo, viviendo. The been-done form is -ado and -ido: hablado, comido, vivido. Estoy hablando is I am talking; he hablado is I have talked.",
    },
    {
      title: "No vosotros, and vos",
      body: "Vosotros is Spain only. Latin America uses ustedes for every you-plural, polite or not, so these tables leave vosotros out. In Medellín and much of Antioquia you will hear vos instead of tú, with its own present forms (vos tenés, vos podés, vos sos). Understanding it matters more than using it; tú and usted are both understood everywhere.",
    },
    {
      title: "The accent pairs",
      body: "A handful of very common words come in pairs that differ by one accent and nothing else, and the accent is the whole meaning. si is if, sí is yes. tu is your, tú is you. el is the, él is he. mi is my, mí is me. se is the reflexive, sé is I know. mas is but in old writing, más is more. The question words take one when they are asking: qué, cuándo, cómo, dónde, cuánto, and por qué as two words against porque, because. This app strips accents before it marks your answer, so you will not be failed for missing one on a phone keyboard, but the pairs are worth knowing on sight because the accent is how you tell which word you are reading.",
    },
    {
      title: "Whose: mi, tu, su",
      body: "Possessives agree with the thing owned, not the owner: mi carro, mis carros, tu casa, tus casas. Both tu and su mean your. Tu is the your that goes with tú, su is the your that goes with usted, and su is also his, her and their. Colombia uses usted far more than most of Latin America, so su is the safer default with anyone you have just met. Neither takes an accent: tu is your, tú is you. Su doing four jobs at once means su carro is ambiguous on its own, and when it matters you say el carro de ella instead. Nuestro is the odd one out and agrees in gender as well: nuestro carro, nuestra casa.",
    },
    {
      title: "Preterite against imperfect",
      body: "The commonest tangle in Spanish. Preterite is a finished event, imperfect is a state or a habit. Comí a la una is I ate at one; comía a la una is I used to eat at one. When a story has both, the imperfect sets the scene and the preterite is what happened.",
    },
  ],
};

/* Build one form. Regular verbs are stem plus ending; an irregular that
   lists the form wins over the rule, and one that does not falls back to
   its family's table with the patterns below applied: stem changes, an odd
   yo form, the spelling that keeps a sound (busqué, llegué, empecé, cojo)
   and the y between vowels (leyó). Returns null when the tense has no
   entry, which is how the drill knows not to ask.

   A reflexive infinitive is conjugated without its se: levantarse gives
   levanto, and the pronoun is the learner's to add. */
function conjugate(infinitive, tenseId, personId) {
  if (/se$/.test(infinitive) && infinitive.length > 4 && /[aeií]r$/.test(infinitive.slice(0, -2))) {
    return conjugate(infinitive.slice(0, -2), tenseId, personId);
  }
  const tense = VERBS.tenses.find((t) => t.id === tenseId);
  if (!tense) return null;

  const irregular = VERBS.irregulars.find((v) => v.infinitive === infinitive);
  const listed = irregular && irregular.forms[tenseId] && irregular.forms[tenseId][personId];
  if (listed) return listed;
  const special = VERBS.special[infinitive];
  if (special && special[tenseId] && special[tenseId][personId]) return special[tenseId][personId];

  const root = VERBS.prefixed[infinitive];
  if (root) {
    const prefix = infinitive.slice(0, -root.length);
    const form = conjugate(root, tenseId, personId);
    // supondré, but supón would need its accent moved; no tense here has one.
    return form ? prefix + form : null;
  }

  const family = infinitive.slice(-2).replace("í", "i");
  const endings = tense.endings[family];
  if (!endings || !endings[personId]) return null;
  const ending = endings[personId];

  /* The future and the conditional build on the infinitive, or on one of
     the shortened stems. An accented infinitive loses the accent: oiré. */
  if (tense.base === "infinitive") {
    const base = VERBS.futureStems[infinitive] || infinitive.replace("í", "i");
    return base + ending;
  }

  let stem = infinitive.slice(0, -2);
  const change = Object.keys(VERBS.stemChanges).find((k) => VERBS.stemChanges[k].includes(infinitive));
  const stressed = personId !== "nosotros";
  const yo = VERBS.yoForms[infinitive];

  if (tenseId === "present") {
    if (personId === "yo" && yo) return yo;
    if (change && stressed) stem = changeStem(stem, change);
    if (stressed && VERBS.stressedI.includes(infinitive)) stem = stem.replace(/i$/, "í");
    return stem + ending;
  }

  if (tenseId === "subjunctive") {
    // Built on the yo form, which is already spelt right: siga, conozca.
    if (yo) return yo.slice(0, -1) + ending;
    if (change && stressed) {
      stem = changeStem(stem, change);
    } else if (change && family === "ir") {
      stem = changeStem(stem, change === "o>ue" ? "o>u" : "e>i");
    }
    if (stressed && VERBS.stressedI.includes(infinitive)) stem = stem.replace(/i$/, "í");
    return spell(stem, ending, family);
  }

  if (tenseId === "preterite") {
    // -ir stem changers, in the third person: sintió, durmieron, siguió.
    if (change && family === "ir" && (personId === "el" || personId === "ellos")) {
      stem = changeStem(stem, change === "o>ue" ? "o>u" : "e>i");
    }
    // A stem ending in a vowel: leyó, cayeron, creíste.
    if (family !== "ar" && /[aeo]$/.test(stem)) {
      const y = { yo: "í", tu: "íste", el: "yó", nosotros: "ímos", ellos: "yeron" };
      return stem + y[personId];
    }
    return personId === "yo" && family === "ar" ? spell(stem, ending, family) : stem + ending;
  }

  return stem + ending;
}

/* Change the last e, o or u of a stem: piens, vuelv, jueg, sigu. */
function changeStem(stem, change) {
  const [from, to] = change.split(">");
  const at = stem.lastIndexOf(from);
  return at < 0 ? stem : stem.slice(0, at) + to + stem.slice(at + 1);
}

/* Keep the consonant's sound when the ending changes the vowel after it:
   c before e is qu (busque), g before e is gu (llegue), z before e is c
   (empiece), g before a or o is j (coja), and gu before a or o is g (siga). */
function spell(stem, ending, family) {
  const front = /^[eé]/.test(ending);
  if (front && family === "ar") {
    if (/c$/.test(stem)) return stem.slice(0, -1) + "qu" + ending;
    if (/g$/.test(stem)) return stem + "u" + ending;
    if (/z$/.test(stem)) return stem.slice(0, -1) + "c" + ending;
  }
  if (!front && family !== "ar") {
    if (/gu$/.test(stem)) return stem.slice(0, -1) + ending;
    if (/[^u]g$/.test(stem)) return stem.slice(0, -1) + "j" + ending;
  }
  return stem + ending;
}

/* The English the form actually means, for the drill card.

   "hablar, yo, present" is only a question if you already know what yo does to
   a verb, which is the thing being learned. "I talk" is the question everybody
   can read, and it is the point of the ending.

   Built rather than stored, because it is mechanical in four of the six
   tenses: will and would and used to just sit in front of the plain form, and
   the present needs nothing but a third-person s. The preterite would need
   English past tenses, which are irregular in their own right and not worth a
   second table, and the subjunctive has no clean English at all, so both
   return null and the card falls back to naming the person. */
const ENGLISH_IRREGULAR = {
  be: { I: "am", you: "are", he: "is", we: "are", they: "are" },
  have: { he: "has" },
};

function thirdPerson(verb) {
  if (/(s|sh|ch|x|z|o)$/.test(verb)) return verb + "es";
  if (/[^aeiou]y$/.test(verb)) return verb.slice(0, -1) + "ies";
  return verb + "s";
}

function englishPhrase(gloss, personId, tenseId) {
  const person = VERBS.persons.find((p) => p.id === personId);
  if (!person || !gloss) return null;

  // One gloss, not three: "to do, to make" asks for one English sentence.
  const first = String(gloss).split(",")[0].trim().replace(/^to\s+/, "");
  if (!first) return null;
  const [head, ...rest] = first.split(/\s+/);
  const tail = rest.length ? " " + rest.join(" ") : "";
  const subject = person.subject;

  if (tenseId === "future") return `${subject} will ${first}`;
  if (tenseId === "conditional") return `${subject} would ${first}`;
  if (tenseId === "imperfect") return `${subject} used to ${first}`;
  if (tenseId !== "present") return null;

  const irregular = ENGLISH_IRREGULAR[head];
  if (irregular && irregular[subject]) return `${subject} ${irregular[subject]}${tail}`;
  if (subject === "he") return `he ${thirdPerson(head)}${tail}`;
  return `${subject} ${first}`;
}

/* Whether the tables can vouch for a form, as against merely produce one.

   A verb with an irregular entry is irregular somewhere, and the entry only
   lists the tenses somebody checked. For the tenses it does not list, the
   regular rule is a guess: right for tener in the imperfect, wrong for hacer
   in the preterite. The Lessons screen only ever shows what is listed, so it
   never sees the difference; anything generating forms in bulk does, and
   should ask this first. */
function isVouchedFor(infinitive, tenseId) {
  const irregular = VERBS.irregulars.find((v) => v.infinitive === infinitive);
  if (!irregular) return true;                       // regular: the rule is the truth
  if (irregular.forms[tenseId]) return true;         // checked by hand
  const tense = VERBS.tenses.find((t) => t.id === tenseId);
  // The future and the conditional are covered for everyone by the stem table.
  return !!(tense && tense.base === "infinitive");
}

window.Verbs = { VERBS, conjugate, isVouchedFor, englishPhrase };
