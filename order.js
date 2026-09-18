/* The order words are taught in.

   The bank is not a list to be worked through alphabetically. A learner who
   meets vaso de agua before tener has been badly served, so this file says
   what comes first: roughly commonest and most useful first, in groups that
   read as a curriculum rather than as a ranking.

   Position in this array is the word's rank. A word not listed is taught
   last, which makes an unlisted word obvious rather than silently random, and
   tests/test-order.mjs fails if the bank holds one.

   This is judgement, not a corpus count. It is informed by how Spanish
   frequency lists generally run and by what a learner actually needs in order
   to say anything at all, but no word here was counted. Re-order anything
   that is in the wrong place; it is one array and moving a word is a cut and
   paste.

   The engine never reads this file. app.js turns it into a rank function and
   hands that to pickRound, which is why engine.js still knows nothing about
   any particular language.
*/
const TEACHING_ORDER = [
  /* The first words. Nothing can be said without these. Two verbs for to be, the ones that carry every other sentence, and the joins. */
  "ser", "estar", "tener", "hacer", "ir", "poder", "querer", "de", "en",
  "a", "no", "y", "que", "si-cond", "o", "pero", "porque", "hay", "muy",
  "mas", "mucho", "yo", "tu", "el-pron", "ella", "nosotros", "ustedes",
  "usted", "con",

  /* Getting through a conversation. Enough to greet someone, ask for something and get out again. */
  "hola", "gracias", "por-favor", "perdon", "adios", "buenos-dias",
  "que-tal", "como", "por-supuesto", "de-nada", "hasta-luego",
  "con-permiso", "bien", "mal", "despacio",

  /* Asking. The question words open more doors than any amount of vocabulary. */
  "donde", "cuando", "quien", "por-que", "cuanto", "cuantos",
  "a-que-hora", "cuanto-tiempo", "cada-cuanto", "por-cuanto-tiempo",
  "cuanto-cuesta", "algo-mas", "que-quieres", "adonde",

  /* The verbs you will reach for hourly */
  "decir", "ver", "dar", "saber", "venir", "salir", "llegar", "hablar",
  "comer", "beber", "vivir", "necesitar", "pensar", "creer", "gustar",
  "pedir", "esperar", "poner", "llevar", "dejar", "pasar", "quedar",

  /* Pointing at things */
  "esto", "eso", "este", "ese", "aqui", "alli", "cerca", "lejos",
  "arriba", "abajo", "afuera", "adentro", "enfrente", "izquierda",
  "derecha", "lo", "se", "me", "te", "le", "nos", "su", "mi", "nuestro",

  /* Time */
  "hoy", "manana", "ayer", "ahora", "dia", "noche", "semana", "mes",
  "ano", "hora", "minuto", "tiempo", "vez", "tarde", "temprano",
  "siempre", "nunca",
  "ya", "todavia", "antes", "despues", "proximo", "pasado", "lunes",
  "martes", "miercoles", "jueves", "viernes", "sabado", "domingo",

  /* Numbers */
  "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho",
  "nueve", "diez", "veinte", "cien", "mil", "primero", "ultimo", "medio",

  /* People */
  "hombre", "mujer", "gente", "persona", "amigo", "familia", "nino",
  "nina", "madre", "padre", "hijo", "hermano", "hermana", "senor",
  "senora", "esposo", "novio", "abuelo", "vecino", "ellos",

  /* Food, drink and the table */
  "agua", "comida", "pan", "almuerzo", "desayuno", "cena", "carne",
  "pollo", "arroz", "huevo", "fruta", "leche", "cerveza", "jugo", "sal",
  "azucar", "sopa", "plato", "mesa", "vaso-de-agua", "copa-vino", "tinto",
  "tocineta", "hambre", "cocinar",

  /* Money and shopping */
  "dinero", "plata", "precio", "cuenta", "tienda", "mercado", "caro",
  "barato", "comprar", "vender", "pagar", "cambio", "con-tarjeta",
  "en-efectivo", "siguiente-en-la-fila", "pinta",

  /* Out in the world */
  "casa", "calle", "ciudad", "centro", "pais", "mundo", "lugar",
  "camino", "salida", "carro", "bus", "taxi", "avion", "viaje", "hotel",
  "aeropuerto", "maleta", "boleto", "caminar", "viajar", "playa",
  "montana", "rio",

  /* At home */
  "puerta", "ventana", "llave", "cama", "silla", "cocina", "habitacion",
  "dormitorio", "bano", "ropa", "luz", "caneca", "bolsa", "alquilar",
  "dormir",

  /* Describing */
  "bueno", "malo", "grande", "pequeno", "nuevo", "viejo", "joven",
  "bonito", "feo", "facil", "dificil", "rapido", "lento", "caliente",
  "frio", "limpio", "sucio", "largo", "corto", "alto", "bajo", "fuerte",
  "debil", "lleno", "abierto", "cerrado", "listo", "mismo", "diferente",
  "mejor", "peor", "importante", "posible", "seguro", "pleno",

  /* Colours */
  "rojo", "verde", "azul", "negro", "blanco", "amarillo",

  /* How you are */
  "feliz", "triste", "cansado", "contento", "enojado", "preocupado",
  "nervioso", "aburrido", "enfermo",

  /* The body, and what hurts */
  "cabeza", "mano", "ojo", "pie", "dolor", "doler", "medico",

  /* Work and study */
  "trabajo", "trabajar", "estudiar", "oficina", "empresa", "reunion",
  "jefe", "clase", "palabra", "pregunta", "problema", "cosa", "aprender",

  /* More verbs */
  "empezar", "terminar", "seguir", "volver", "parecer", "sentir",
  "entender", "escribir", "leer", "escuchar", "mirar", "abrir", "cerrar",
  "ayudar", "jugar", "correr", "buscar", "encontrar", "conseguir", "usar",
  "tocar", "deber", "traer", "prestar", "intentar", "ganar", "perder",
  "cambiar", "mandar", "preguntar", "contestar", "olvidar", "recordar",
  "llorar", "reir", "coger", "extender", "aguardar", "llamando",

  /* Weather and the outdoors */
  "clima", "lluvia", "sol", "arbol", "perro", "gato",

  /* The smaller joins */
  "tambien", "tampoco", "poco", "menos", "tanto", "solo", "asi", "claro",
  "entonces", "asimismo", "aunque", "mientras", "sin", "sobre",
  "entre", "hasta", "durante", "desde", "para", "por", "otro", "cada",
  "alguna", "alguien", "nada", "nadie", "todo", "tal-vez", "algo", "casi",

  /* Set phrases */
  "hay-un", "dime", "buena-suerte", "vale-la-pena", "placer", "punto",

  /* Things you will name every day. The commonest concrete nouns after the first round of them. */
  "libro", "favor", "verdad", "momento", "parte", "lado", "idea", "plan",
  "espanol",
  "razon", "caso", "numero", "edad",

  /* School, work and paperwork */
  "profesor", "estudiante", "colegio", "escuela", "examen", "tarea",
  "respuesta", "opinion", "decision", "consejo", "papel", "lista",
  "biblioteca", "abogado", "puesto",

  /* Getting about */
  "tren", "autobus", "estacion", "barco", "bicicleta", "caballo",
  "pueblo", "edificio", "sitio", "parque", "jardin", "banco",
  "restaurante", "hospital", "extranjero", "vuelta",

  /* Family and the people in it */
  "mama", "papa", "esposa", "novia", "hija", "chico", "amiga", "bebe",
  "doctor",

  /* The body, and being well */
  "corazon", "cara", "boca", "pelo", "oido", "salud", "sueno",

  /* Feelings, and what goes wrong */
  "amor", "miedo", "suerte", "culpa", "cuidado", "peligro", "odio",
  "muerte", "guerra", "error", "falta", "ruido",

  /* Music, film and sport */
  "musica", "cancion", "pelicula", "television", "foto", "guitarra",
  "piano", "juego", "futbol", "tenis", "fiesta", "cumpleanos", "regalo",
  "cine", "equipo",

  /* Words and languages */
  "idioma", "ingles", "frase", "diccionario", "historia", "secreto",

  /* Phones, clocks and screens */
  "telefono", "camara", "radio", "reloj",

  /* Clothes and things you carry */
  "camisa", "vestido", "zapato", "sombrero", "caja",

  /* Weather, food and the outdoors */
  "cafe", "manzana", "fuego", "aire", "cielo", "nieve", "calor", "verano",
  "suelo",

  /* Describing more precisely */
  "interesante", "inteligente", "divertido", "entretenido", "peligroso",
  "loco", "rico", "libre", "unico", "cierto", "ocupado", "perdido",
  "equivocado", "duro", "extrano", "suficiente",

  /* The last of the small words */
  "bastante", "apenas", "jamas", "completamente", "ojala", "anoche",
  "futuro", "dentro", "alla", "realidad", "situacion", "manera", "forma",
  "asunto", "atencion", "exito", "recuerdo",
];

/* id to position, built once. Anything unlisted sorts last. */
const RANK = new Map(TEACHING_ORDER.map((id, i) => [id, i]));
const rankOf = (id) => (RANK.has(id) ? RANK.get(id) : Number.MAX_SAFE_INTEGER);

window.TeachingOrder = { TEACHING_ORDER, rankOf };
