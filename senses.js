/* Sense tags: the one line that makes an ambiguous prompt answerable.

   Fifty-two English prompts in this bank have more than one right Spanish
   answer. "to be" is ser and estar. "for" is para, por and durante. Shown on
   its own, such a prompt is not a question, it is a coin toss, and marking
   the other answer wrong teaches the learner that the app is broken rather
   than that the words differ.

   So every word in a colliding group carries a short tag, shown under the
   prompt on a production card. The tag says which of the two is wanted
   without giving away a letter of it: "to be" plus "identity, permanence"
   has exactly one answer, and so does "to be" plus "state, mood, location".

   Rules the tags follow, and test-senses.mjs enforces:
     - every word that shares an English sense with another has one
     - no two words in the same group have the same tag
     - a tag never contains the answer, or the prompt back at you

   Keyed by word id, because that is what survives an edit to the spelling.
   A word with no ambiguity needs no entry, which is most of the bank.
*/

window.SENSES = {
  /* to be */
  ser: "identity, permanence",
  estar: "state, mood, location",

  /* for, to, at, from, on, in */
  para: "purpose, destination",
  por: "cause, exchange, through",
  durante: "over a length of time",
  a: "motion towards, or the time",
  en: "a place: in, on, at",
  sobre: "on top of, or about",
  de: "of, and possession",
  desde: "from a starting point",

  /* this, that */
  esto: "the thing, on its own",
  este: "before a noun",
  eso: "the thing, on its own",
  ese: "before a noun",

  /* people, and who owns what */
  tu: "for someone you are close to",
  su: "usted's, or his, her, their",
  ella: "the person, not the owner",
  usted: "one person, polite",
  ustedes: "more than one person",
  te: "the object of tú",
  nosotros: "we, the subject",
  nos: "us, the object",

  /* yes-or-no words that pull in two directions */
  nada: "with no before the verb",
  algo: "in a positive sentence",
  nunca: "plain",
  jamas: "emphatic",
  ya: "already, or by now",
  ahora: "at this moment",
  tambien: "too, agreeing",
  asimismo: "formal, likewise",
  claro: "everyday agreement",
  "por-supuesto": "the fuller, formal phrase",
  entonces: "therefore, then",
  asi: "in this way",
  solo: "only, nothing more",
  apenas: "barely, hardly",
  unico: "the one and only",
  suficiente: "enough of something",
  bastante: "quite a lot",

  /* describing */
  feliz: "happy as a person is",
  contento: "pleased right now",
  dificil: "not easy",
  duro: "tough, not soft",
  lleno: "a full container",
  pleno: "at the height of",
  corto: "short in length",
  bajo: "short in height",
  poco: "not much of something",
  pequeno: "small in size",
  ultimo: "the final one",
  pasado: "last as in previous",
  mal: "badly, the adverb",
  equivocado: "mistaken, with estar",
  seguro: "certain, or safe",

  /* things and places */
  bolsa: "a carrier bag",
  maleta: "a suitcase",
  dinero: "the standard word",
  plata: "everyday Colombian",
  lugar: "a place in general",
  sitio: "a spot or a site",
  ciudad: "a city",
  pueblo: "a village or small town",
  colegio: "school up to eighteen",
  escuela: "primary school",
  trabajo: "work in general",
  puesto: "a post, or a stall",
  empresa: "a company",
  asunto: "a matter or affair",
  medico: "the profession",
  doctor: "how you address one",
  bus: "everyday Colombian",
  autobus: "the fuller word",
  camino: "a road or route",
  manera: "a manner or method",
  forma: "a shape, or a means",
  vez: "an occasion",
  hora: "the clock time",
  tiempo: "duration, how much of it",
  nino: "a child",
  chico: "a lad",
  amigo: "a man",
  amiga: "a woman",
  adentro: "indoors",
  dentro: "within, as in within an hour",

  /* doing */
  conseguir: "managing to obtain something",
  coger: "to grab or catch",
  llevar: "to take away, to wear",
  salir: "to go out, to depart",
  dejar: "to leave behind, to let",
  pedir: "ordering food, or requesting",
  mandar: "to send, or to command",
  pensar: "to reason, to consider",
  creer: "believing something is so",
  esperar: "to wait, or to hope",
  aguardar: "formal, to await",
  ver: "seeing, not choosing to look",
  mirar: "to look on purpose",

  /* phrases */
  perdon: "apologising, or interrupting",
  "con-permiso": "asking to pass",
  "cuanto-tiempo": "how much time",
  "por-cuanto-tiempo": "over what period",
};
