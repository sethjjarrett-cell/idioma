/* The course: units built round real situations rather than word lists.

   Each unit takes about fifteen to twenty minutes and runs the four kinds of
   practice the research keeps coming back to, in order:

     1. Learn       the unit's words, a few sentence frames, one grammar point
     2. Read        a short conversation with audio, almost all of it words you
                    have met, so it is understood rather than decoded
     3. Make it yours  a few true sentences about your own life, using the frames
     4. Say it      shadow the conversation line by line, then talk about the
                    topic three times, against a shrinking clock (60, 45, 30s)

   Frames are the point. "¿Me regala ___?" with any noun in the gap is worth
   more than ten nouns on their own, because it is the part of the sentence you
   would otherwise have to build on the spot.

   Shape:
     { id, title, es, goal,
       words:   [wordId]          the unit's vocabulary, all in the bank
       frames:  [{ es, en, examples: [[es, en]] }]   ___ marks the gap
       grammar: lessonId          one lesson from grammar.js
       dialogue: { setting, lines: [{ who, es, en }] }
       tasks:   [{ id, prompt, frame, need: [[alternatives]], models: [es] }]
       retell:  { prompt, points: [es], model } }

   `need` is what a written answer has to use for the app to say it has used
   the frame: every group must be matched by one of its alternatives, compared
   without accents or capitals. It is a nudge, not marking: the models show
   what a good answer looks like, and anything sensible is fine.

   tests/test-units.mjs checks every word id and grammar id is real and that
   each conversation is at least 95% words the bank knows, names aside.
   Colombian usage throughout. Written with care but not by a native speaker,
   so report anything that reads oddly.
*/
window.UNITS = [
  {
    id: "u1",
    title: "Meeting people",
    es: "Conocer gente",
    goal: "Say hello, give your name, where you are from, where you live and what you do, and ask the same back.",
    words: ["hola", "como-estas", "como-te-llamas", "mucho-gusto", "de-donde-eres", "llamarse", "ser", "vivir",
      "trabajar", "estudiar", "ingles", "aqui", "centro", "oficina", "tambien", "chevere"],
    frames: [
      { es: "Me llamo ___.", en: "My name is ___.",
        examples: [["Me llamo Sam.", "My name is Sam."], ["¿Cómo te llamas?", "What's your name?"]] },
      { es: "Soy ___.", en: "I'm ___ (where from, what job).",
        examples: [["Soy inglés.", "I'm English."], ["Soy ingeniero.", "I'm an engineer."]] },
      { es: "Vivo en ___.", en: "I live in ___.",
        examples: [["Vivo en el centro.", "I live in the centre."], ["Vivo aquí.", "I live here."]] },
      { es: "Trabajo en ___. / Estudio ___.", en: "I work in ___. / I study ___.",
        examples: [["Trabajo en una oficina.", "I work in an office."], ["Estudio español.", "I'm studying Spanish."]] },
      { es: "¿Y tú?", en: "And you?",
        examples: [["Muy bien, gracias. ¿Y tú?", "Very well, thanks. And you?"]] },
    ],
    grammar: "ser-estar",
    dialogue: {
      setting: "Sam meets Laura in the kitchen of a hostel in Medellín.",
      lines: [
        { who: "Laura", es: "¡Hola! ¿Cómo estás?", en: "Hi! How are you?" },
        { who: "Sam", es: "Muy bien, gracias. ¿Y tú?", en: "Very well, thanks. And you?" },
        { who: "Laura", es: "Bien, bien. ¿Cómo te llamas?", en: "Good. What's your name?" },
        { who: "Sam", es: "Me llamo Sam. ¿Y tú?", en: "My name is Sam. And you?" },
        { who: "Laura", es: "Laura. Mucho gusto.", en: "Laura. Nice to meet you." },
        { who: "Sam", es: "Igualmente. ¿Eres de aquí?", en: "Likewise. Are you from here?" },
        { who: "Laura", es: "Sí, soy de Medellín. ¿Y tú, de dónde eres?", en: "Yes, I'm from Medellín. And you, where are you from?" },
        { who: "Sam", es: "Soy inglés, pero ahora vivo aquí, en el centro.", en: "I'm English, but I live here now, in the centre." },
        { who: "Laura", es: "¡Qué chévere! ¿Y qué haces?", en: "How cool! And what do you do?" },
        { who: "Sam", es: "Soy ingeniero. Trabajo en una oficina. ¿Y tú?", en: "I'm an engineer. I work in an office. And you?" },
        { who: "Laura", es: "Yo estudio en la universidad.", en: "I study at the university." },
        { who: "Sam", es: "¡Bueno, nos vemos!", en: "Right, see you!" },
      ],
    },
    tasks: [
      { id: "name", prompt: "Introduce yourself: your name and where you are from.", frame: "Me llamo ___. Soy ___.",
        need: [["llamo"], ["soy"]], models: ["Me llamo Sam. Soy inglés.", "Hola, me llamo Sam y soy de Inglaterra."] },
      { id: "live", prompt: "Say where you live now.", frame: "Vivo en ___.",
        need: [["vivo"]], models: ["Vivo en el centro.", "Ahora vivo en Medellín, cerca del parque."] },
      { id: "work", prompt: "Say what you do: your job, or what you study.", frame: "Soy ___. / Trabajo en ___.",
        need: [["trabajo", "estudio", "soy"]], models: ["Soy ingeniero. Trabajo en una oficina.", "Estudio español."] },
      { id: "ask", prompt: "Ask someone their name and where they are from.", frame: "¿Cómo te llamas? ¿De dónde eres?",
        need: [["llamas", "llama"], ["donde"]], models: ["¿Cómo te llamas? ¿De dónde eres?", "¿Cómo se llama usted? ¿De dónde es?"] },
    ],
    retell: {
      prompt: "Introduce yourself to someone new: your name, where you are from, where you live, what you do, and ask them back.",
      points: ["Me llamo…", "Soy…", "Vivo en…", "Trabajo en… / Estudio…", "¿Y tú?"],
      model: "Hola, me llamo Sam. Soy inglés, pero ahora vivo aquí, en el centro. Soy ingeniero y trabajo en una oficina. ¿Y tú? ¿Cómo te llamas?",
    },
  },

  {
    id: "u2",
    title: "Food and drink",
    es: "Comer y tomar",
    goal: "Order in a café or restaurant, say what you want with and without, and ask for the bill.",
    words: ["me-regala", "querer", "tinto", "agua", "jugo", "cerveza", "pollo", "arroz", "con", "sin", "azucar",
      "hambre", "algo-mas", "la-cuenta-por-favor", "con-tarjeta", "en-efectivo", "rico", "mesero"],
    frames: [
      { es: "¿Me regala ___, por favor?", en: "Could I have ___, please?",
        examples: [["¿Me regala un tinto, por favor?", "Could I have a black coffee, please?"], ["¿Me regala la cuenta?", "Could I have the bill?"]] },
      { es: "Quiero ___.", en: "I'd like ___.",
        examples: [["Quiero el pollo con arroz.", "I'd like the chicken with rice."], ["Quiero un agua.", "I'd like a water."]] },
      { es: "___ con ___ / ___ sin ___", en: "___ with ___ / ___ without ___",
        examples: [["Un café con leche.", "A white coffee."], ["Un jugo sin azúcar.", "A juice without sugar."]] },
      { es: "Tengo ___.", en: "I'm ___ (hungry, thirsty).",
        examples: [["Tengo hambre.", "I'm hungry."], ["Tengo sed.", "I'm thirsty."]] },
      { es: "La cuenta, por favor.", en: "The bill, please.",
        examples: [["¿Con tarjeta o en efectivo?", "By card or cash?"]] },
    ],
    grammar: "gender",
    dialogue: {
      setting: "Lunchtime in a small restaurant. Sam orders from the waiter.",
      lines: [
        { who: "Mesero", es: "Buenas tardes. ¿Qué va a tomar?", en: "Good afternoon. What are you having to drink?" },
        { who: "Sam", es: "Buenas. ¿Me regala un jugo de naranja, por favor?", en: "Hello. Could I have an orange juice, please?" },
        { who: "Mesero", es: "¿Con azúcar o sin azúcar?", en: "With sugar or without?" },
        { who: "Sam", es: "Sin azúcar, gracias.", en: "Without, thanks." },
        { who: "Mesero", es: "Listo. ¿Y para comer?", en: "Right. And to eat?" },
        { who: "Sam", es: "Tengo mucha hambre. Quiero el pollo con arroz.", en: "I'm really hungry. I'd like the chicken with rice." },
        { who: "Mesero", es: "Muy bien. ¿Algo más?", en: "Very good. Anything else?" },
        { who: "Sam", es: "Sí, un agua también, por favor.", en: "Yes, a water as well, please." },
        { who: "Sam", es: "Disculpe, la cuenta, por favor.", en: "Excuse me, the bill, please." },
        { who: "Mesero", es: "Claro. ¿Con tarjeta o en efectivo?", en: "Of course. By card or cash?" },
        { who: "Sam", es: "Con tarjeta. Todo estuvo muy rico, gracias.", en: "By card. It was all delicious, thanks." },
        { who: "Mesero", es: "Con mucho gusto. Que le vaya bien.", en: "My pleasure. All the best." },
      ],
    },
    tasks: [
      { id: "drink", prompt: "Order a drink, the polite Colombian way.", frame: "¿Me regala ___, por favor?",
        need: [["regala"]], models: ["¿Me regala un tinto, por favor?", "¿Me regala una cerveza fría, por favor?"] },
      { id: "food", prompt: "Order something to eat that you actually like.", frame: "Quiero ___.",
        need: [["quiero", "regala"]], models: ["Quiero el pollo con arroz.", "Quiero una sopa, por favor."] },
      { id: "without", prompt: "Ask for something with or without something.", frame: "___ con ___ / ___ sin ___",
        need: [["con", "sin"]], models: ["Un café con leche, por favor.", "Un jugo sin azúcar."] },
      { id: "bill", prompt: "Ask for the bill and say how you will pay.", frame: "La cuenta, por favor. Con tarjeta.",
        need: [["cuenta"], ["tarjeta", "efectivo"]], models: ["La cuenta, por favor. Con tarjeta.", "Disculpe, ¿me regala la cuenta? Pago en efectivo."] },
    ],
    retell: {
      prompt: "Order a full meal: greet the waiter, order a drink and food, ask for something with or without, then ask for the bill.",
      points: ["Buenas tardes.", "¿Me regala…?", "Quiero…", "con… / sin…", "La cuenta, por favor."],
      model: "Buenas tardes. ¿Me regala un jugo de naranja sin azúcar, por favor? Y para comer, quiero el pollo con arroz. Gracias. … Disculpe, la cuenta, por favor. Con tarjeta.",
    },
  },

  {
    id: "u3",
    title: "Getting around",
    es: "Moverse por la ciudad",
    goal: "Ask where something is, understand simple directions, and say where you are going.",
    words: ["donde", "quedar", "hay", "cerca", "lejos", "derecha", "izquierda", "siga-derecho", "cuadra", "esquina",
      "metro", "bus", "banco", "cajero", "ir", "llegar", "caminar", "enfrente"],
    frames: [
      { es: "¿Dónde queda ___?", en: "Where is ___?",
        examples: [["¿Dónde queda el metro?", "Where's the metro?"], ["¿Dónde queda el baño?", "Where's the toilet?"]] },
      { es: "¿Hay ___ por aquí?", en: "Is there ___ round here?",
        examples: [["¿Hay un cajero por aquí?", "Is there a cash machine round here?"], ["¿Hay un supermercado cerca?", "Is there a supermarket nearby?"]] },
      { es: "¿Cómo llego a ___?", en: "How do I get to ___?",
        examples: [["¿Cómo llego al parque?", "How do I get to the park?"]] },
      { es: "Siga derecho y ___ a la derecha / izquierda.", en: "Go straight on and ___ on the right / left.",
        examples: [["Siga derecho dos cuadras.", "Go straight on two blocks."], ["Está a la izquierda.", "It's on the left."]] },
      { es: "Voy a ___.", en: "I'm going to ___.",
        examples: [["Voy al centro.", "I'm going to the centre."], ["Voy en metro.", "I'm going by metro."]] },
    ],
    grammar: "hay-esta",
    dialogue: {
      setting: "Sam stops someone in the street.",
      lines: [
        { who: "Sam", es: "Disculpe, ¿dónde queda el metro?", en: "Excuse me, where's the metro?" },
        { who: "Señora", es: "Siga derecho dos cuadras y después a la izquierda.", en: "Go straight on two blocks and then left." },
        { who: "Sam", es: "¿Está lejos?", en: "Is it far?" },
        { who: "Señora", es: "No, está muy cerca. Cinco minutos a pie.", en: "No, it's very close. Five minutes on foot." },
        { who: "Sam", es: "Perfecto. ¿Y hay un cajero por aquí?", en: "Perfect. And is there a cash machine round here?" },
        { who: "Señora", es: "Sí, hay uno en la esquina, enfrente del banco.", en: "Yes, there's one on the corner, opposite the bank." },
        { who: "Sam", es: "¿A la derecha o a la izquierda?", en: "On the right or the left?" },
        { who: "Señora", es: "A la derecha. ¿Usted adónde va?", en: "On the right. Where are you going?" },
        { who: "Sam", es: "Voy al centro, a un museo.", en: "I'm going to the centre, to a museum." },
        { who: "Señora", es: "Entonces el metro es lo mejor.", en: "Then the metro is the best thing." },
        { who: "Sam", es: "Muchas gracias, muy amable.", en: "Thank you very much, that's very kind." },
        { who: "Señora", es: "Con mucho gusto.", en: "My pleasure." },
      ],
    },
    tasks: [
      { id: "where", prompt: "Ask where two places you might need are.", frame: "¿Dónde queda ___?",
        need: [["queda", "donde"]], models: ["¿Dónde queda el baño?", "Disculpe, ¿dónde queda la estación de bus?"] },
      { id: "isthere", prompt: "Ask if there is something you need nearby.", frame: "¿Hay ___ por aquí?",
        need: [["hay"]], models: ["¿Hay un cajero por aquí?", "¿Hay un supermercado cerca?"] },
      { id: "directions", prompt: "Give directions from where you live to the nearest shop.", frame: "Siga derecho… a la derecha / izquierda.",
        need: [["derecho", "derecha", "izquierda", "cuadra", "cuadras", "esquina", "enfrente"]], models: ["Siga derecho una cuadra y la tienda está a la derecha.", "Está en la esquina, enfrente del parque."] },
      { id: "going", prompt: "Say where you are going today and how.", frame: "Voy a ___. Voy en ___.",
        need: [["voy"]], models: ["Voy al centro en metro.", "Hoy voy a la oficina en bus."] },
    ],
    retell: {
      prompt: "Explain how to get from your home to somewhere you go often: which way, how far, and how you get there.",
      points: ["Voy a…", "Siga derecho…", "a la derecha / a la izquierda", "Está cerca / lejos.", "Voy en metro / bus / a pie."],
      model: "Para llegar al parque, salgo de mi casa y sigo derecho dos cuadras. En la esquina, a la derecha, hay un banco. El parque queda enfrente. Está muy cerca: cinco minutos a pie.",
    },
  },

  {
    id: "u4",
    title: "Shopping and paying",
    es: "Comprar y pagar",
    goal: "Ask for things and prices, compare, and pay.",
    words: ["cuanto-cuesta", "tener", "caro", "barato", "precio", "talla", "camisa", "zapato", "bolsa", "plata",
      "pagar", "llevar", "descuento", "mercado", "tienda", "grande", "pequeno"],
    frames: [
      { es: "¿Cuánto cuesta ___?", en: "How much is ___?",
        examples: [["¿Cuánto cuesta esta camisa?", "How much is this shirt?"], ["¿Cuánto cuestan los zapatos?", "How much are the shoes?"]] },
      { es: "¿Tiene ___?", en: "Have you got ___?",
        examples: [["¿Tiene una talla más grande?", "Have you got a bigger size?"], ["¿Tiene bolsa?", "Have you got a bag?"]] },
      { es: "Es muy ___. ¿Tiene algo más ___?", en: "It's very ___. Have you got anything ___er?",
        examples: [["Es muy caro. ¿Tiene algo más barato?", "It's very expensive. Have you got anything cheaper?"]] },
      { es: "Me lo llevo. / Me la llevo.", en: "I'll take it.",
        examples: [["Bueno, me la llevo.", "OK, I'll take it."]] },
      { es: "¿Puedo pagar con ___?", en: "Can I pay by ___?",
        examples: [["¿Puedo pagar con tarjeta?", "Can I pay by card?"]] },
    ],
    grammar: "adjectives",
    dialogue: {
      setting: "Sam is buying a shirt at a stall in the market.",
      lines: [
        { who: "Vendedor", es: "Buenas, ¿qué necesita?", en: "Hello, what do you need?" },
        { who: "Sam", es: "Buenas. ¿Cuánto cuesta esta camisa?", en: "Hello. How much is this shirt?" },
        { who: "Vendedor", es: "Esa cuesta cincuenta mil.", en: "That one's fifty thousand." },
        { who: "Sam", es: "Uy, es un poco cara. ¿Tiene algo más barato?", en: "Ooh, it's a bit expensive. Have you got anything cheaper?" },
        { who: "Vendedor", es: "Esta azul cuesta treinta mil.", en: "This blue one is thirty thousand." },
        { who: "Sam", es: "Me gusta. ¿Tiene una talla más grande?", en: "I like it. Have you got a bigger size?" },
        { who: "Vendedor", es: "Sí, claro. Aquí está.", en: "Yes, of course. Here it is." },
        { who: "Sam", es: "Perfecto, me la llevo. ¿Puedo pagar con tarjeta?", en: "Perfect, I'll take it. Can I pay by card?" },
        { who: "Vendedor", es: "No, solo en efectivo.", en: "No, cash only." },
        { who: "Sam", es: "Bueno, no hay problema. ¿Me regala una bolsa?", en: "OK, no problem. Could I have a bag?" },
        { who: "Vendedor", es: "Claro que sí. Gracias.", en: "Of course. Thank you." },
      ],
    },
    tasks: [
      { id: "price", prompt: "Ask the price of two things you might buy.", frame: "¿Cuánto cuesta ___?",
        need: [["cuesta", "cuestan", "vale"]], models: ["¿Cuánto cuesta esta camisa?", "¿Cuánto cuestan los zapatos?"] },
      { id: "have", prompt: "Ask a shop if they have something you need.", frame: "¿Tiene ___?",
        need: [["tiene"]], models: ["¿Tiene una talla más pequeña?", "¿Tiene agua fría?"] },
      { id: "cheaper", prompt: "Say something is too expensive and ask for something cheaper.", frame: "Es muy caro. ¿Tiene algo más barato?",
        need: [["caro", "cara"], ["barato", "barata"]], models: ["Es muy caro. ¿Tiene algo más barato?", "Uy, está cara. ¿No tiene algo más barato?"] },
      { id: "pay", prompt: "Say you will take it and ask how you can pay.", frame: "Me lo llevo. ¿Puedo pagar con ___?",
        need: [["llevo"], ["pagar"]], models: ["Me lo llevo. ¿Puedo pagar con tarjeta?", "Bueno, me la llevo. ¿Puedo pagar en efectivo?"] },
    ],
    retell: {
      prompt: "Buy something at a market: ask the price, ask for something cheaper or a different size, decide, and pay.",
      points: ["¿Cuánto cuesta…?", "Es muy caro.", "¿Tiene algo más…?", "Me lo llevo.", "¿Puedo pagar con…?"],
      model: "Buenas. ¿Cuánto cuestan estos zapatos? Uy, son un poco caros. ¿Tiene algo más barato? Me gustan estos. ¿Tiene una talla más grande? Perfecto, me los llevo. ¿Puedo pagar con tarjeta?",
    },
  },

  {
    id: "u5",
    title: "Your day and plans",
    es: "El día y los planes",
    goal: "Say what you do in a day, what you have to do, what you are going to do, and make a plan.",
    words: ["ir", "tener", "gustar", "hoy", "manana", "fin-de-semana", "sabado", "domingo", "temprano", "tarde",
      "trabajar", "descansar", "playa", "cine", "fiesta", "quedar", "levantarse", "hora"],
    frames: [
      { es: "Voy a ___.", en: "I'm going to ___.",
        examples: [["Voy a descansar.", "I'm going to rest."], ["El sábado voy a ir a la playa.", "On Saturday I'm going to go to the beach."]] },
      { es: "Tengo que ___.", en: "I have to ___.",
        examples: [["Tengo que trabajar.", "I have to work."], ["Mañana tengo que salir temprano.", "Tomorrow I have to leave early."]] },
      { es: "Me gusta ___.", en: "I like ___.",
        examples: [["Me gusta leer.", "I like reading."], ["Me gusta mucho el cine.", "I really like the cinema."]] },
      { es: "A las ___.", en: "At ___ o'clock.",
        examples: [["Me levanto a las seis.", "I get up at six."], ["¿A qué hora?", "What time?"]] },
      { es: "¿Quedamos ___?", en: "Shall we meet ___?",
        examples: [["¿Quedamos el domingo?", "Shall we meet on Sunday?"], ["¿Quedamos a las ocho?", "Shall we say eight?"]] },
    ],
    grammar: "ir-a",
    dialogue: {
      setting: "Sam and Camila, a friend, on the phone on a Thursday.",
      lines: [
        { who: "Camila", es: "¡Hola, Sam! ¿Qué vas a hacer el fin de semana?", en: "Hi, Sam! What are you doing at the weekend?" },
        { who: "Sam", es: "El sábado tengo que trabajar por la mañana.", en: "On Saturday I have to work in the morning." },
        { who: "Sam", es: "Pero por la tarde voy a descansar. ¿Y tú?", en: "But in the afternoon I'm going to rest. And you?" },
        { who: "Camila", es: "El sábado por la noche voy a una fiesta. ¿Quieres venir?", en: "On Saturday night I'm going to a party. Do you want to come?" },
        { who: "Sam", es: "¡Claro! ¿A qué hora?", en: "Of course! What time?" },
        { who: "Camila", es: "A las nueve, en la casa de un amigo.", en: "At nine, at a friend's house." },
        { who: "Sam", es: "Perfecto. ¿Y el domingo?", en: "Perfect. And Sunday?" },
        { who: "Camila", es: "El domingo me gusta ir al parque temprano. ¿Quedamos?", en: "On Sunday I like going to the park early. Shall we meet?" },
        { who: "Sam", es: "Bueno, pero no muy temprano, por favor.", en: "OK, but not too early, please." },
        { who: "Camila", es: "Jaja, a las diez. ¡Nos vemos el sábado!", en: "Ha, at ten. See you on Saturday!" },
      ],
    },
    tasks: [
      { id: "routine", prompt: "Say what time you get up and what you do in the morning.", frame: "Me levanto a las ___.",
        need: [["levanto"], ["las"]], models: ["Me levanto a las siete y voy al trabajo.", "Me levanto temprano, a las seis."] },
      { id: "haveto", prompt: "Say two things you have to do this week.", frame: "Tengo que ___.",
        need: [["tengo que"]], models: ["Tengo que trabajar el lunes y tengo que comprar comida.", "Esta semana tengo que estudiar mucho."] },
      { id: "plan", prompt: "Say what you are going to do at the weekend.", frame: "El sábado voy a ___.",
        need: [["voy a", "vamos a"]], models: ["El sábado voy a ir a la playa.", "El fin de semana voy a descansar y ver una película."] },
      { id: "meet", prompt: "Invite a friend to something and suggest a time.", frame: "¿Quieres ___? ¿Quedamos a las ___?",
        need: [["quieres", "quedamos", "vamos"]], models: ["¿Quieres ir al cine el viernes? ¿Quedamos a las ocho?", "¿Vamos a la playa el domingo?"] },
    ],
    retell: {
      prompt: "Talk about your week: what you do on a normal day, what you have to do this week, and your plans for the weekend.",
      points: ["Me levanto a las…", "Tengo que…", "Me gusta…", "El sábado voy a…", "¿Quedamos…?"],
      model: "Normalmente me levanto a las siete y trabajo hasta las cinco. Esta semana tengo que trabajar mucho. Me gusta ir al parque por la tarde. El sábado voy a descansar, y el domingo voy a ir a la playa con unos amigos.",
    },
  },
];
