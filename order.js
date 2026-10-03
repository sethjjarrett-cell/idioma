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

  /* Greetings and the phrases that get you through a first conversation. */
  "buenas-tardes", "buenas-noches", "como-estas", "mucho-gusto",
  "como-te-llamas", "de-donde-eres", "nos-vemos", "chao", "no-entiendo",
  "no-se", "lo-siento", "disculpe", "con-mucho-gusto", "me-regala",
  "cuanto-vale", "la-cuenta-por-favor", "donde-esta-el-bano",
  "que-hora-es", "mas-despacio",

  /* Asking. The question words open more doors than any amount of vocabulary. */
  "donde", "cuando", "quien", "por-que", "cuanto", "cuantos",
  "a-que-hora", "cuanto-tiempo", "cada-cuanto", "por-cuanto-tiempo",
  "cuanto-cuesta", "algo-mas", "que-quieres", "adonde",

  /* The verbs you will reach for hourly */
  "decir", "ver", "dar", "saber", "venir", "salir", "llegar", "hablar",
  "comer", "beber", "vivir", "necesitar", "pensar", "creer", "gustar",
  "pedir", "esperar", "poner", "llevar", "dejar", "pasar", "quedar",

  /* The commonest words the first lists left out. Corpus counts put every one of these in the top few hundred. */
  "tomar", "llamar", "conocer", "entrar", "llamarse", "nombre", "vida",
  "ti", "conmigo", "contigo", "les", "ellas", "nosotras", "mio", "tuyo",
  "suyo", "tan", "ni", "pues", "luego", "pronto", "igual", "otra-vez",
  "a-veces", "cual",

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

  /* The rest of the numbers you will hear at a till, and the halves and pairs. */
  "once", "doce", "trece", "catorce", "quince", "dieciseis", "diecisiete",
  "dieciocho", "diecinueve", "treinta", "cuarenta", "cincuenta", "sesenta",
  "setenta", "ochenta", "noventa", "quinientos", "millon", "segundo",
  "tercero", "mitad", "par",

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

  /* Small words, the second round: connectors, adverbs and where things are. */
  "sino", "hacia", "contra", "segun", "sin-embargo", "ademas", "incluso",
  "juntos", "aun", "quizas", "a-menudo", "de-repente", "por-lo-menos",
  "demasiado", "cualquier", "ninguno", "ambos", "varios", "aquel",
  "realmente", "probablemente", "exactamente", "finalmente", "simplemente",
  "acerca-de", "alrededor", "detras", "delante", "encima", "debajo",
  "mayor", "menor", "resto",

  /* Everyday verbs, the second round. */
  "subir", "bajar", "mostrar", "explicar", "ensenar", "recibir", "cuidar",
  "limpiar", "lavar", "cantar", "bailar", "nadar", "descansar",
  "despertarse", "levantarse", "ducharse", "vestirse", "acostarse",
  "sentarse", "preparar", "cortar", "gastar", "ahorrar", "nacer", "morir",
  "crecer", "parar", "caer", "romper", "arreglar", "importar", "encantar",
  "molestar", "interesar", "faltar", "significar", "suponer", "ocurrir",
  "decidir", "elegir", "permitir", "prometer", "confiar", "mentir",
  "perdonar", "agradecer", "amar", "abrazar", "casarse", "manejar",
  "reservar", "llenar", "apagar", "prender", "cargar", "contar", "mover",
  "mudarse", "probar", "lograr", "cumplir", "quitar", "sacar", "devolver",
  "regresar", "depender", "oir", "saludar", "visitar", "invitar",
  "compartir", "fumar", "llover", "quejarse", "mejorar", "preferir",
  "volar", "cruzar", "doblar", "celebrar", "pelear", "enamorarse",
  "servir", "funcionar", "desayunar", "almorzar", "cenar", "cobrar",
  "escalar",

  /* People, and the body when something is wrong with it. */
  "apellido", "padres", "abuela", "primo", "tio", "tia", "sobrino",
  "nieto", "pareja", "chica", "parce", "cliente", "companero", "policia",
  "mesero", "conductor", "enfermera", "ingeniero", "invitado", "dueno",
  "cuerpo", "brazo", "pierna", "espalda", "diente", "nariz", "oreja",
  "cuello", "dedo", "estomago", "piel", "sangre", "rodilla", "hombro",
  "garganta", "fiebre", "gripa", "tos", "pastilla", "drogueria", "cita",
  "accidente", "emergencia", "ayuda", "embarazada", "sed",

  /* Food, drink and eating out. */
  "pescado", "queso", "jamon", "mantequilla", "verdura", "ensalada",
  "tomate", "cebolla", "ajo", "papas-fritas", "aguacate", "platano",
  "banano", "arepa", "frijoles", "maiz", "naranja", "limon", "fresa",
  "pina", "galleta", "chocolate", "helado", "postre", "torta", "vino",
  "gaseosa", "aromatica", "tenedor", "cuchillo", "cuchara", "taza",
  "botella", "servilleta", "menu", "propina", "delicioso", "dulce",
  "salado", "picante", "hielo", "aceite", "cerdo", "res", "mariscos",
  "camaron",

  /* At home, in town and getting around. */
  "apartamento", "piso", "sala", "nevera", "estufa", "lavadora", "ducha",
  "espejo", "sofa", "escalera", "pared", "techo", "toalla", "jabon",
  "almohada", "cobija", "basura", "armario", "enchufe", "arriendo",
  "ascensor", "piscina", "barrio", "esquina", "cuadra", "semaforo",
  "plaza", "iglesia", "supermercado", "panaderia", "museo", "universidad",
  "trancon", "trafico", "parada", "metro", "pasaje", "vuelo", "pasaporte",
  "reserva", "mapa", "direccion", "norte", "sur", "oriente", "occidente",
  "puente", "carretera", "mar", "isla", "gasolina", "moto", "camion",
  "parqueadero", "turista", "guia", "cajero", "billete", "moneda",
  "tarjeta", "efectivo",

  /* Months, seasons and telling the time. */
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "septiembre", "octubre", "noviembre", "diciembre", "invierno",
  "primavera", "otono", "fin-de-semana", "mediodia", "medianoche",
  "madrugada", "rato", "siglo", "fecha", "navidad", "vacaciones",
  "festivo", "anteayer", "pasado-manana", "a-tiempo",

  /* Phones, work and money. */
  "celular", "computador", "portatil", "pantalla", "mensaje", "correo",
  "contrasena", "aplicacion", "bateria", "cargador", "internet", "sueldo",
  "contrato", "entrevista", "proyecto", "negocio", "informe", "horario",
  "turno", "carrera", "ingenieria", "energia", "impuesto", "deuda",
  "factura", "recibo", "descuento", "oferta", "gratis",

  /* Describing people and things, and how you feel. */
  "amable", "simpatico", "antipatico", "timido", "perezoso", "guapo",
  "lindo", "hermoso", "raro", "tranquilo", "emocionado", "sorprendido",
  "orgulloso", "avergonzado", "celoso", "asustado", "enamorado",
  "borracho", "agradecido", "harto", "confundido", "ancho", "delgado",
  "gordo", "pesado", "oscuro", "mojado", "seco", "suave", "vacio",
  "comodo", "anterior", "correcto", "perfecto", "increible", "genial",
  "terrible", "chevere", "gris", "morado", "rosado", "marron", "color",
  "alegria", "carino", "esperanza", "verguenza", "rabia", "estres",
  "paciencia", "sorpresa", "duda", "confianza", "paz",

  /* Weather, the outdoors, sport and clothes. */
  "tierra", "luna", "estrella", "viento", "nube", "nublado", "tormenta",
  "grado", "flor", "planta", "animal", "pajaro", "pez", "vaca", "bosque",
  "selva", "lago", "piedra", "arena", "campo", "naturaleza", "gimnasio",
  "partido", "deporte", "pelota", "concierto", "teatro", "baile", "arte",
  "serie", "noticias", "periodico", "escalada", "pantalon", "camiseta",
  "chaqueta", "saco", "falda", "medias", "chanclas", "gorra", "gafas",
  "mochila", "talla", "paraguas",

  /* Everyday expressions. */
  "encantado", "que-te-vaya-bien", "cuidate", "a-la-orden",
  "puede-repetir", "habla-ingles", "no-pasa-nada", "no-hay-problema",
  "de-acuerdo", "claro-que-si", "que-pena", "buen-provecho",
  "feliz-cumpleanos", "felicitaciones", "dios-mio", "auxilio",
  "me-robaron", "estoy-perdido", "me-siento-mal", "tengo-prisa",
  "tengo-que-irme", "hace-calor", "hace-frio", "hace-buen-tiempo",
  "que-pasa", "quiubo", "que-mas", "todo-bien", "que-bien", "que-rico",
  "me-da-igual", "tengo-ganas", "vamonos", "ya-voy", "un-momento",
  "ahora-mismo", "ahorita", "por-fin", "al-final", "en-serio",
  "por-cierto", "o-sea", "por-ejemplo", "mas-o-menos", "poco-a-poco",
  "sobre-todo", "de-verdad", "como-se-dice", "a-que-te-dedicas",
  "cuantos-anos-tienes", "estoy-aprendiendo", "hablo-un-poco",
  "bienvenido", "buen-viaje", "que-descanses", "hasta-manana",
  "me-puede-ayudar", "donde-queda", "siga-derecho", "me-deja-aqui",
  "cuanto-se-demora", "para-llevar", "que-me-recomienda", "que-pereza",
  "pilas", "de-una", "me-parece-bien", "que-opinas", "creo-que-si",
  "creo-que-no", "animo", "que-lastima", "lo-que-sea", "no-te-preocupes",
];

/* id to position, built once. Anything unlisted sorts last. */
const RANK = new Map(TEACHING_ORDER.map((id, i) => [id, i]));
const rankOf = (id) => (RANK.has(id) ? RANK.get(id) : Number.MAX_SAFE_INTEGER);

window.TeachingOrder = { TEACHING_ORDER, rankOf };
