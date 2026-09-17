/* Topics: which context each word belongs to.

   Kept out of seed.js on purpose. That file is the supplied bank, verbatim,
   and stays that way; this is a second opinion laid over the top of it, so
   the two can be re-read and argued with separately. A word's topic is a
   judgement, not a fact about the word, and judgements belong where they
   can be edited without touching the source data.

   Every seed word appears exactly once below. tests/test-topics.mjs fails
   if that stops being true, so a word added to seed.js without a home here
   is caught rather than quietly dropping out of the Topics screen.

   To add a topic, add an entry. To move a word, move its id. Words added
   through the Manage screen carry their own topic field and do not need
   listing here.
*/
const TOPICS = [
  {
    id: "food",
    name: "Food and drink",
    blurb: "Ordering, eating, and the coffee vocabulary you will use daily.",
    words: ["comida", "agua", "tinto", "tocineta", "plato", "mesa", "hambre",
            "vaso-de-agua", "copa-vino", "pinta", "comer", "beber", "pedir",
            "algo-mas"],
  },
  {
    id: "out",
    name: "Out and about",
    blurb: "Streets, directions and the verbs of going somewhere.",
    words: ["calle", "camino", "salida", "izquierda", "derecha", "viajar",
            "caminar", "llegar", "salir", "ir", "venir", "a-que-hora"],
  },
  {
    id: "where",
    name: "Where things are",
    blurb: "Here, there, near, far: the words that answer ¿dónde?",
    words: ["aqui", "alli", "cerca", "lejos", "arriba", "abajo", "afuera",
            "adentro", "enfrente"],
  },
  {
    id: "home",
    name: "At home",
    blurb: "Rooms, furniture and renting somewhere to sleep.",
    words: ["habitacion", "dormitorio", "bano", "cama", "caneca", "bolsa",
            "alquilar", "dormir", "vivir"],
  },
  {
    id: "paying",
    name: "Paying and shopping",
    blurb: "Asking the price, saying how you are paying, queueing.",
    words: ["cuanto-cuesta", "con-tarjeta", "en-efectivo", "cambio",
            "siguiente-en-la-fila", "cuanto", "cuantos", "prestar", "punto"],
  },
  {
    id: "smalltalk",
    name: "Small talk",
    blurb: "The set phrases that carry most of a short conversation.",
    words: ["hasta-luego", "buena-suerte", "de-nada", "dime", "por-supuesto",
            "que-quieres", "hay-un", "hablar", "decir", "placer"],
  },
  {
    id: "questions",
    name: "Asking questions",
    blurb: "The question words, which unlock far more than their number suggests.",
    words: ["quien", "que", "donde", "cuando", "por-que", "como",
            "cada-cuanto", "cuanto-tiempo", "por-cuanto-tiempo"],
  },
  {
    id: "time",
    name: "Days and time",
    blurb: "The week, and talking about when something happens.",
    words: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado",
            "domingo", "vez", "esperar", "entonces"],
  },
  {
    id: "describing",
    name: "Describing things",
    blurb: "Adjectives, and the two words for full that are not interchangeable.",
    words: ["abierto", "cerrado", "cansado", "feliz", "triste", "fuerte",
            "debil", "mismo", "diferente", "mejor", "peor", "listo", "pleno",
            "lleno", "casi"],
  },
  {
    id: "verbs",
    name: "Everyday verbs",
    blurb: "The workhorses. Most of these are irregular, which is why they are common.",
    words: ["ser", "estar", "hacer", "tener", "poder", "querer", "saber",
            "deber", "poner", "dar", "traer", "tocar", "usar", "buscar",
            "encontrar", "conseguir", "necesitar", "aprender", "trabajar",
            "extender", "coger", "llamando"],
  },
  {
    id: "glue",
    name: "Little words",
    blurb: "Pronouns, possessives and prepositions. Dull, and in every sentence.",
    words: ["nosotros", "esto", "eso", "nuestro", "mi", "tu", "alguna",
            "desde", "para", "por", "asimismo"],
  },
];

window.TOPICS = TOPICS;
