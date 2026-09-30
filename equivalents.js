/* Other ways of saying the same thing, which the card should accept.

   A production card shows the English and wants the Spanish, and the bank
   holds exactly one Spanish word per entry. But "how are you" is ¿qué tal?
   and ¿cómo estás? and ¿qué más?, and a learner who types the second one has
   answered the question correctly and been told they are wrong. That is the
   app being wrong, not them, and it is the fastest way to stop trusting it.

   So both sides get a list of alternatives. `es` is accepted on production and
   cloze cards, `en` on recognition cards, and neither is shown: the reveal
   still gives the word the card is teaching, because otherwise the prompt
   "pretty, nice, lovely, beautiful, good-looking" hands over the answer from
   the other direction.

   Three sources, in order of how sure they are:

     - what the bank's own notes already say. "Comenzar is the same thing",
       "Everyday Colombian is mamá", "Sitio means the same". Those were written
       as advice and never reached the grader, which was the actual bug.
     - the other countries. coche and auto are not what anybody says in
       Colombia, and they are still correct Spanish; being marked wrong for
       typing one is not teaching anybody anything.
     - the obvious English synonyms for glosses that picked one of several.

   A word with its own bank entry is deliberately not listed here: dinero and
   plata are both words to learn, the card says which sense it wants, and
   typing the other one is answered by the sense rule rather than this one.

   This list will never be complete, which is what the override is for: say I
   was right once and the app remembers, for that word, for good.
*/

window.EQUIVALENTS = {
  /* --- greetings and the phrases you use every day --- */
  "que-tal": { es: ["¿cómo estás?", "¿cómo está?", "¿qué más?", "¿cómo te va?", "¿cómo va todo?"] },
  hola: { es: ["buenas"], en: ["hi there"] },
  adios: { es: ["chao", "chau", "hasta luego", "nos vemos"] },
  "hasta-luego": { es: ["nos vemos", "chao", "hasta pronto"], en: ["see you", "bye"] },
  "de-nada": { es: ["con gusto", "no hay de qué", "con mucho gusto"], en: ["not at all", "no problem"] },
  "buenos-dias": { es: ["buen día"], en: ["good day"] },
  "por-favor": { en: ["if you please"] },
  gracias: { es: ["muchas gracias"], en: ["thanks a lot", "thank you very much"] },
  perdon: { es: ["disculpe", "disculpa", "perdone"], en: ["pardon", "pardon me", "sorry about that"] },
  "con-permiso": { es: ["permiso"], en: ["may I get past", "coming through"] },
  "por-supuesto": { es: ["claro que sí", "desde luego"], en: ["certainly", "naturally"] },
  "algo-mas": { en: ["something else", "was there anything else"] },

  /* --- what the notes already said --- */
  madre: { es: ["mamá"], en: ["mum", "mummy"] },
  padre: { es: ["papá"], en: ["dad", "daddy"] },
  esposo: { es: ["marido"] },
  esposa: { es: ["mujer"] },
  empezar: { es: ["comenzar"], en: ["to commence"] },
  entender: { es: ["comprender"] },
  mandar: { es: ["enviar"] },
  contestar: { es: ["responder"], en: ["to respond"] },
  intentar: { es: ["tratar de", "tratar"] },
  todavia: { es: ["aún"] },
  "tal-vez": { es: ["quizás", "quizá", "a lo mejor", "puede ser"] },
  solo: { es: ["solamente"], en: ["merely", "simply"] },
  boleto: { es: ["tiquete", "pasaje", "billete"] },
  pequeno: { es: ["chiquito"], en: ["tiny", "wee"] },
  enojado: { es: ["bravo", "molesto"], en: ["cross", "annoyed", "mad"] },
  idioma: { es: ["lengua"] },
  necesitar: { en: ["to require"] },
  aprender: { en: ["to learn about"] },

  /* --- correct Spanish from other countries --- */
  carro: { es: ["coche", "auto", "automóvil"] },
  jugo: { es: ["zumo"] },
  papa: { es: ["patata"] },
  caneca: { es: ["basurero", "papelera", "cubo de basura"] },
  tienda: { es: ["almacén"] },
  bus: { es: ["buseta"] },

  /* --- English glosses that picked one of several --- */
  bonito: { en: ["beautiful", "good looking", "attractive"] },
  feo: { en: ["horrible", "unpleasant"] },
  grande: { en: ["huge", "enormous"] },
  rapido: { en: ["swift", "speedy"] },
  lento: { en: ["sluggish"] },
  contento: { en: ["glad", "content"] },
  triste: { en: ["unhappy", "down"] },
  cansado: { en: ["worn out", "exhausted"] },
  enfermo: { en: ["unwell", "poorly"] },
  barato: { en: ["inexpensive"] },
  caro: { en: ["dear", "pricey"] },
  dificil: { en: ["tough", "tricky"] },
  facil: { en: ["simple", "straightforward"] },
  importante: { en: ["significant"] },
  bueno: { en: ["nice", "fine"] },
  malo: { en: ["poor", "awful"] },
  viejo: { en: ["elderly", "ancient"] },
  joven: { en: ["youthful"] },
  limpio: { en: ["tidy"] },
  sucio: { en: ["filthy", "grubby"] },
  lleno: { en: ["filled"] },
  seguro: { en: ["certain", "confident"] },
  listo: { en: ["prepared"] },
  trabajo: { en: ["a job"] },
  habitacion: { en: ["bedroom"] },
  plata: { en: ["cash"] },
  dinero: { en: ["cash"] },
  comida: { en: ["a meal"] },
  cena: { en: ["evening meal"] },
  mercado: { en: ["marketplace"] },
  calle: { en: ["road"] },
  camino: { en: ["track", "route"] },
  gente: { en: ["folk"] },
  nino: { en: ["kid", "little boy"] },
  nina: { en: ["little girl"] },
  amigo: { en: ["mate", "pal"] },
  jefe: { en: ["manager"] },
  reunion: { en: ["a meeting"] },
  problema: { en: ["an issue", "trouble"] },
  cosa: { en: ["object"] },
  lugar: { en: ["spot"] },
  ayudar: { en: ["to give a hand"] },
  hablar: { en: ["to have a word"] },
  mirar: { en: ["to have a look"] },
  terminar: { en: ["to be over"] },
  llegar: { en: ["to get there", "to turn up"] },
  salir: { en: ["to head out"] },
  quedar: { en: ["to remain"] },
  comprar: { en: ["to get"] },
  olvidar: { en: ["to leave behind"] },
  llorar: { en: ["to weep"] },
  dormir: { en: ["to be asleep"] },
  correr: { en: ["to go running"] },
  caminar: { en: ["to go on foot"] },
};
