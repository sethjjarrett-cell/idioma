/* Write it, varied: one sentence pattern, many sentences.

   The hand-written Write it sentences are good and there are a hundred and
   twenty of them, which in daily use means the same ones again and again.
   These are patterns instead: "go to the beach", "eat at home", "wait for
   the bus", each written once and then asked with a different person and a
   different time. Who it is and when is exactly what changes the ending of
   the verb, so these do the job the verb drill does, inside a sentence you
   might actually say.

     present     Basic    She goes to the beach on Sundays.
     preterite   Medium   We went to the beach on Sunday.
     going       Medium   They are going to go to the beach on Sunday.
     haveto      Medium   I have to work tomorrow.
     imperfect   Hard     You used to go to the beach every Sunday.

   The Spanish verb comes off the tables in verbs.js, and only a form the
   tables can vouch for is used, so nothing here invents a conjugation. The
   English verb is given with each pattern (go, goes, went), because English
   past tenses cannot be worked out. "You" also accepts the usted form, since
   English does not say which one it means. Everything else in a pattern is
   chosen to read right whoever is doing it: no my or your to change.

   Loaded after verbs.js; adds to WRITING.items, so levels, Mixed, the tests
   and the progress book treat these like any other Write it sentence. Ids
   are v:pattern:tense:person.

   Pattern shape:
     { id, verb, en: [base, third person, past], es: rest, enRest,
       when: { tense: [spanish, english, "mid"?] }, context, help? }
   A tense with no `when` entry is not asked; "" means no time phrase.
   "mid" puts it straight after the verb in Spanish, where mucho goes:
   Viajaba mucho a la costa, not a la costa mucho. Otherwise it goes at the
   end, and the answer with it at the start (Ayer trabajé en el centro) is
   accepted as well. */
(function () {
  "use strict";
  if (!window.WRITING || !window.Verbs) return;
  const V = window.Verbs;

  const PATTERNS = [
    { id: "playa", verb: "ir", en: ["go", "goes", "went"], es: "a la playa", enRest: "to the beach",
      when: { present: ["los domingos", "on Sundays"], preterite: ["el domingo", "on Sunday"],
        going: ["el domingo", "on Sunday"], imperfect: ["todos los domingos", "every Sunday"] },
      context: "Talking about weekends." },
    { id: "centro", verb: "trabajar", en: ["work", "works", "worked"], es: "en el centro", enRest: "in the centre",
      when: { present: ["", ""], preterite: ["ayer", "yesterday"], haveto: ["mañana", "tomorrow"], imperfect: ["", ""] },
      context: "Saying where people work." },
    { id: "arroz", verb: "comer", en: ["eat", "eats", "ate"], es: "arroz con pollo", enRest: "chicken and rice",
      when: { present: ["los lunes", "on Mondays"], preterite: ["anoche", "last night"], going: ["hoy", "today"],
        imperfect: ["todos los lunes", "every Monday"] },
      context: "Talking about food." },
    { id: "tinto", verb: "tomar", en: ["have", "has", "had"], es: "un tinto", enRest: "a black coffee",
      when: { present: ["por la mañana", "in the morning"], preterite: ["esta mañana", "this morning"],
        going: ["después", "later"] },
      context: "Coffee, the Colombian way." },
    { id: "mesero", verb: "hablar", en: ["speak", "speaks", "spoke"], es: "con el mesero", enRest: "to the waiter",
      when: { present: ["", ""], preterite: ["", ""], haveto: ["", ""] },
      context: "In a restaurant." },
    { id: "tarde", verb: "llegar", en: ["arrive", "arrives", "arrived"], es: "tarde", enRest: "late",
      when: { present: ["los lunes", "on Mondays"], preterite: ["ayer", "yesterday"], imperfect: ["todos los días", "every day"] },
      context: "Explaining why you are late." },
    { id: "amigos", verb: "salir", en: ["go out", "goes out", "went out"], es: "con unos amigos", enRest: "with some friends",
      when: { present: ["los viernes", "on Fridays"], preterite: ["anoche", "last night"], going: ["esta noche", "tonight"] },
      context: "Plans for the evening." },
    { id: "pan", verb: "comprar", en: ["buy", "buys", "bought"], es: "pan en la tienda", enRest: "bread at the shop",
      when: { present: ["cada mañana", "every morning"], preterite: ["esta mañana", "this morning"], haveto: ["hoy", "today"] },
      context: "Running errands." },
    { id: "espanol", verb: "estudiar", en: ["study", "studies", "studied"], es: "español", enRest: "Spanish",
      when: { present: ["por la noche", "in the evening"], preterite: ["ayer", "yesterday"], going: ["mañana", "tomorrow"],
        imperfect: ["en el colegio", "at school"] },
      context: "Learning Spanish." },
    { id: "pelicula", verb: "ver", en: ["watch", "watches", "watched"], es: "una película", enRest: "a film",
      when: { preterite: ["anoche", "last night"], going: ["esta noche", "tonight"], imperfect: ["los sábados", "on Saturdays"] },
      context: "An evening in." },
    { id: "costa", verb: "viajar", en: ["travel", "travels", "travelled"], es: "a la costa", enRest: "to the coast",
      when: { preterite: ["el año pasado", "last year"], going: ["en diciembre", "in December"], imperfect: ["mucho", "a lot", "mid"] },
      context: "Travelling in Colombia.", help: [["costa", "coast"]] },
    { id: "casa", verb: "cocinar", en: ["cook", "cooks", "cooked"], es: "en la casa", enRest: "at home",
      when: { present: ["los domingos", "on Sundays"], preterite: ["anoche", "last night"], haveto: ["hoy", "today"],
        imperfect: ["mucho", "a lot", "mid"] },
      context: "Eating in." },
    { id: "trabajo", verb: "caminar", en: ["walk", "walks", "walked"], es: "al trabajo", enRest: "to work",
      when: { present: ["todos los días", "every day"], preterite: ["ayer", "yesterday"], imperfect: ["todos los días", "every day"] },
      context: "Getting to work." },
    { id: "ejercicio", verb: "hacer", en: ["do", "does", "did"], es: "ejercicio", enRest: "exercise",
      when: { present: ["por la mañana", "in the morning"], preterite: ["ayer", "yesterday"], going: ["mañana", "tomorrow"],
        imperfect: ["mucho", "a lot", "mid"] },
      context: "Keeping fit.", help: [["ejercicio", "exercise"]] },
    { id: "dormir", verb: "dormir", en: ["sleep", "sleeps", "slept"], es: "muy bien", enRest: "very well",
      when: { present: ["", ""], preterite: ["anoche", "last night"], imperfect: ["", ""] },
      context: "How the night went." },
    { id: "tarjeta", verb: "pagar", en: ["pay", "pays", "paid"], es: "con tarjeta", enRest: "by card",
      when: { present: ["", ""], preterite: ["", ""], haveto: ["", ""] },
      context: "Paying for things." },
    { id: "fiesta", verb: "bailar", en: ["dance", "dances", "danced"], es: "en la fiesta", enRest: "at the party",
      when: { preterite: ["anoche", "last night"], going: ["esta noche", "tonight"] },
      context: "A night out." },
    { id: "periodico", verb: "leer", en: ["read", "reads", "read"], es: "el periódico", enRest: "the newspaper",
      when: { present: ["por la mañana", "in the morning"], imperfect: ["todos los días", "every day"] },
      context: "Mornings." },
    { id: "bus", verb: "esperar", en: ["wait for", "waits for", "waited for"], es: "el bus", enRest: "the bus",
      when: { present: ["aquí", "here"], preterite: ["una hora", "for an hour"], haveto: ["aquí", "here"] },
      context: "Getting about by bus." },
    { id: "vivir", verb: "vivir", en: ["live", "lives", "lived"], es: "cerca del parque", enRest: "near the park",
      when: { present: ["", ""], imperfect: ["", ""] },
      context: "Where people live." },
    { id: "volver", verb: "volver", en: ["come back", "comes back", "came back"], es: "a la casa", enRest: "home",
      when: { present: ["a las seis", "at six"], preterite: ["muy tarde", "very late"], haveto: ["temprano", "early"] },
      context: "Coming home." },
    { id: "futbol", verb: "jugar", en: ["play", "plays", "played"], es: "fútbol", enRest: "football",
      when: { present: ["los jueves", "on Thursdays"], preterite: ["el jueves", "on Thursday"],
        imperfect: ["en el colegio", "at school"] },
      context: "Sport." },
    { id: "cuenta", verb: "pedir", en: ["ask for", "asks for", "asked for"], es: "la cuenta", enRest: "the bill",
      when: { preterite: ["", ""], going: ["", ""], haveto: ["", ""] },
      context: "At the end of a meal." },
    { id: "hotel", verb: "buscar", en: ["look for", "looks for", "looked for"], es: "un hotel barato", enRest: "a cheap hotel",
      when: { preterite: ["ayer", "yesterday"], haveto: ["hoy", "today"], going: ["mañana", "tomorrow"] },
      context: "Travelling on a budget." },
    { id: "taxi", verb: "necesitar", en: ["need", "needs", "needed"], es: "un taxi", enRest: "a taxi",
      when: { present: ["", ""], preterite: ["anoche", "last night"] },
      context: "Getting a ride." },
  ];

  const TENSES = {
    present: { level: "basic", table: "present" },
    preterite: { level: "medium", table: "preterite" },
    going: { level: "medium", table: null },
    haveto: { level: "medium", table: null },
    imperfect: { level: "hard", table: "imperfect" },
  };

  // Who, in English. He and she take turns from one pattern to the next.
  const PEOPLE = [
    { id: "yo", en: "I", be: "am", have: "have" },
    { id: "tu", en: "you", be: "are", have: "have" },
    { id: "el", en: null, be: "is", have: "has", third: true },
    { id: "nosotros", en: "we", be: "are", have: "have" },
    { id: "ellos", en: "they", be: "are", have: "have" },
  ];

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const join = (...parts) => parts.filter(Boolean).join(" ");

  // The Spanish verb phrase, or null when the tables cannot vouch for it.
  function spanishVerb(verb, tense, person) {
    if (tense === "going") {
      return V.isVouchedFor("ir", "present") ? `${V.conjugate("ir", "present", person)} a ${verb}` : null;
    }
    if (tense === "haveto") {
      return V.isVouchedFor("tener", "present") ? `${V.conjugate("tener", "present", person)} que ${verb}` : null;
    }
    const table = TENSES[tense].table;
    if (!V.isVouchedFor(verb, table)) return null;
    return V.conjugate(verb, table, person) || null;
  }

  function englishVerb(en, tense, who) {
    const [base, third, past] = en;
    if (tense === "present") return who.third ? third : base;
    if (tense === "preterite") return past;
    if (tense === "going") return `${who.be} going to ${base}`;
    if (tense === "haveto") return `${who.have} to ${base}`;
    if (tense === "imperfect") return `used to ${base}`;
    return null;
  }

  const items = [];
  PATTERNS.forEach((pat, n) => {
    for (const [tense, [whenEs, whenEn, place]] of Object.entries(pat.when)) {
      for (const who of PEOPLE) {
        const verbEs = spanishVerb(pat.verb, tense, who.id);
        if (!verbEs) continue;
        const subject = who.en || (n % 2 ? "he" : "she");
        const sentences = (verb) => (place === "mid"
          ? [cap(join(verb, whenEs, pat.es)) + "."]
          : [cap(join(verb, pat.es, whenEs)) + "."].concat(whenEs ? [cap(join(whenEs, verb, pat.es)) + "."] : []));
        const [es, ...orders] = sentences(verbEs);
        const en = cap(join(subject, englishVerb(pat.en, tense, who), pat.enRest, whenEn)) + ".";
        // "You" in English is tú or usted: the usted form is just as right.
        const alt = orders.concat(who.id === "tu" ? sentences(spanishVerb(pat.verb, tense, "el")) : []);
        items.push({
          id: `v:${pat.id}:${tense}:${who.id}`, level: TENSES[tense].level,
          context: `${pat.context} Watch the ending: who, and when.`,
          en, es, alt, generated: true, ...(pat.help ? { help: pat.help } : {}),
        });
      }
    }
  });

  window.WRITING.items = window.WRITING.items.concat(items);
  window.WRITING.patterns = PATTERNS;
})();
