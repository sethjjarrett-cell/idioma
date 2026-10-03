/* The sentence ladder: short things to say, in the order the words arrive.

   The 902 sentences in seed.js and vocab.js were each written to show off one
   word, so they use whatever other vocabulary was to hand. That makes them
   fine examples and a poor ladder: measured against the teaching order, only
   ten of them are fully within reach after fifty words, and twenty-eight
   after a hundred. Sentence practice that starts there is sentence practice
   you cannot start.

   So these are written the other way round: from the earliest words outwards,
   short first, and each one is a pattern rather than a curiosity. Together
   with the bank's own sentences, which take over as the vocabulary grows,
   they are what the sentence rounds draw on.

   No stage numbers and no declared prerequisites. Which words an item needs
   is worked out from the Spanish itself, against the same bank the rest of
   the app uses, so an item appears exactly when its words have been met and a
   typo in one of them shows up as a test failure rather than as a sentence
   that never comes up. Articles and the conjunction que are free: you cannot
   write Spanish without them and they are not vocabulary anyone needs tested.

   `note` is for the pattern, not the words. It shows the first few times an
   item comes up and then gets out of the way.
*/

window.PHRASES = {
  items: [
    /* --- ser and estar, which is where every beginner starts and stalls --- */
    { id: "p001", es: "¿Dónde estás?", en: "Where are you?" },
    { id: "p002", es: "Estoy bien, gracias.", en: "I am well, thank you." },
    { id: "p003", es: "No estoy bien.", en: "I am not well." },
    { id: "p004", es: "¿Dónde está?", en: "Where is it?" },
    { id: "p005", es: "Está muy bien.", en: "It is very good." },
    { id: "p006", es: "No está aquí.", en: "He is not here.",
      note: "Spanish drops the subject: the ending already says who." },
    { id: "p007", es: "Estoy aquí.", en: "I am here." },
    { id: "p008", es: "Soy de aquí.", en: "I am from here.",
      note: "ser for where you are from, estar for where you are now." },
    { id: "p009", es: "No soy de aquí.", en: "I am not from here." },
    { id: "p010", es: "¿Quién es?", en: "Who is it?" },
    { id: "p011", es: "¿Qué es esto?", en: "What is this?" },
    { id: "p012", es: "Eso es todo.", en: "That is all." },
    { id: "p013", es: "Somos amigos.", en: "We are friends." },
    { id: "p014", es: "Ella es mi hermana.", en: "She is my sister." },
    { id: "p015", es: "Él es mi amigo.", en: "He is my friend." },
    { id: "p016", es: "Estoy cansado.", en: "I am tired.",
      note: "estar for how you are today; ser would mean it is your character." },
    { id: "p017", es: "Estoy muy feliz.", en: "I am very happy." },
    { id: "p018", es: "La comida está fría.", en: "The food is cold." },
    { id: "p019", es: "El agua está muy caliente.", en: "The water is very hot." },

    /* --- tener, and the things Spanish has that English is --- */
    { id: "p020", es: "Tengo hambre.", en: "I am hungry.",
      note: "Hunger is something you have in Spanish, not something you are." },
    { id: "p021", es: "¿Tienes hambre?", en: "Are you hungry?" },
    { id: "p022", es: "Tengo dos hermanos.", en: "I have two brothers." },
    { id: "p023", es: "No tengo dinero.", en: "I have no money." },
    { id: "p024", es: "¿Tienes agua?", en: "Do you have any water?" },
    { id: "p025", es: "Tengo que ir.", en: "I have to go.",
      note: "tener que and then the infinitive is how you say have to." },
    { id: "p026", es: "Tenemos que ir.", en: "We have to go." },
    { id: "p027", es: "Tengo que trabajar.", en: "I have to work." },
    { id: "p028", es: "¿Tienes que trabajar hoy?", en: "Do you have to work today?" },

    /* --- wanting, being able, needing --- */
    { id: "p029", es: "Quiero comer.", en: "I want to eat." },
    { id: "p030", es: "No quiero comer.", en: "I do not want to eat." },
    { id: "p031", es: "¿Quieres comer algo?", en: "Do you want to eat something?" },
    { id: "p032", es: "Quiero ir a la playa.", en: "I want to go to the beach." },
    { id: "p033", es: "¿Puedo ir?", en: "Can I go?" },
    { id: "p034", es: "No puedo ir hoy.", en: "I cannot go today." },
    { id: "p035", es: "¿Puedes hablar más despacio?", en: "Can you talk more slowly?" },
    { id: "p036", es: "Necesito agua.", en: "I need some water." },
    { id: "p037", es: "Necesito un médico.", en: "I need a doctor." },
    { id: "p038", es: "¿Qué necesitas?", en: "What do you need?" },

    /* --- ir, and the future you can build with it --- */
    { id: "p039", es: "¿Adónde vas?", en: "Where are you going?" },
    { id: "p040", es: "Voy a comer.", en: "I am going to eat.",
      note: "ir a and then the infinitive is the everyday future tense." },
    { id: "p041", es: "Vamos a comer.", en: "We are going to eat." },
    { id: "p042", es: "Voy a trabajar mañana.", en: "I am going to work tomorrow." },
    { id: "p043", es: "No voy a ir.", en: "I am not going to go." },
    { id: "p044", es: "Vamos a la playa.", en: "We are going to the beach." },
    { id: "p045", es: "Voy a casa.", en: "I am going home." },

    /* --- hay, which has no subject and needs none --- */
    { id: "p046", es: "¿Hay agua?", en: "Is there any water?",
      note: "hay is there is and there are, and never changes." },
    { id: "p047", es: "No hay.", en: "There is not any." },
    { id: "p048", es: "Hay mucha gente.", en: "There are a lot of people." },
    { id: "p049", es: "¿Hay un baño aquí?", en: "Is there a toilet here?" },
    { id: "p050", es: "No hay más.", en: "There is no more." },

    /* --- asking things --- */
    { id: "p051", es: "¿Qué quieres?", en: "What do you want?" },
    { id: "p052", es: "¿Qué dices?", en: "What are you saying?" },
    { id: "p053", es: "¿Cuánto cuesta?", en: "How much does it cost?" },
    { id: "p054", es: "¿A qué hora?", en: "At what time?" },
    { id: "p055", es: "¿Cuándo vas?", en: "When are you going?" },
    { id: "p056", es: "¿Por qué no?", en: "Why not?" },
    { id: "p057", es: "¿Por qué no vienes?", en: "Why are you not coming?" },
    { id: "p058", es: "¿Cómo se dice?", en: "How do you say it?" },
    { id: "p059", es: "¿Dónde está el baño?", en: "Where is the toilet?" },
    { id: "p060", es: "¿Cuántos años tienes?", en: "How old are you?",
      note: "Literally how many years do you have." },

    /* --- saying no, and saying it twice --- */
    { id: "p061", es: "No sé.", en: "I do not know." },
    { id: "p062", es: "No sé dónde está.", en: "I do not know where it is." },
    { id: "p063", es: "No sé qué decir.", en: "I do not know what to say." },
    { id: "p064", es: "No quiero nada.", en: "I do not want anything.",
      note: "Two negatives are correct here, not a mistake: no plus nada." },
    { id: "p065", es: "No hay nada.", en: "There is nothing." },
    { id: "p066", es: "Nunca voy.", en: "I never go." },

    /* --- me gusta, which is backwards and has to be met head on --- */
    { id: "p067", es: "Me gusta.", en: "I like it.",
      note: "Backwards: it pleases me. What is liked is the subject." },
    { id: "p068", es: "No me gusta.", en: "I do not like it." },
    { id: "p069", es: "Me gusta el pan.", en: "I like bread." },
    { id: "p070", es: "¿Te gusta?", en: "Do you like it?" },
    { id: "p071", es: "Me gusta mucho.", en: "I like it a lot." },

    /* --- getting through a day --- */
    { id: "p072", es: "Hola, ¿qué tal?", en: "Hello, how are things?" },
    { id: "p073", es: "Mucho gusto.", en: "Pleased to meet you." },
    { id: "p074", es: "Hasta luego.", en: "See you later." },
    { id: "p075", es: "Con permiso.", en: "Excuse me." },
    { id: "p076", es: "Perdón, no entiendo.", en: "Sorry, I do not understand." },
    { id: "p077", es: "Más despacio, por favor.", en: "More slowly, please." },
    { id: "p078", es: "Un momento, por favor.", en: "One moment, please." },
    { id: "p079", es: "Muchas gracias.", en: "Thank you very much." },
    { id: "p080", es: "De nada.", en: "You are welcome." },

    /* --- paying for things --- */
    { id: "p081", es: "La cuenta, por favor.", en: "The bill, please." },
    { id: "p082", es: "¿Cuánto es todo?", en: "How much is it all?" },
    { id: "p083", es: "Es muy caro.", en: "It is very expensive." },
    { id: "p084", es: "¿Puedo pagar con tarjeta?", en: "Can I pay by card?" },
    { id: "p085", es: "Quiero comprar dos.", en: "I want to buy two." },

    /* --- getting somewhere --- */
    { id: "p086", es: "¿Está lejos?", en: "Is it far?" },
    { id: "p087", es: "Está muy cerca.", en: "It is very near." },
    { id: "p088", es: "¿Dónde está el hotel?", en: "Where is the hotel?" },
    { id: "p089", es: "Voy al aeropuerto.", en: "I am going to the airport.",
      note: "a plus el contracts to al. Always." },
    { id: "p090", es: "¿Cómo llego al centro?", en: "How do I get to the centre?" },
    { id: "p091", es: "Necesito un taxi.", en: "I need a taxi." },

    /* --- two clauses, which is where it starts sounding like speech --- */
    { id: "p092", es: "Creo que sí.", en: "I think so.",
      note: "creo que, and then the whole clause. The que is not optional." },
    { id: "p093", es: "Creo que no.", en: "I do not think so." },
    { id: "p094", es: "Quiero ir pero no puedo.", en: "I want to go but I cannot." },
    { id: "p095", es: "No voy porque estoy cansado.", en: "I am not going because I am tired." },
    { id: "p096", es: "Si puedes, vamos.", en: "If you can, let us go." },
    { id: "p097", es: "Espero que estés bien.", en: "I hope you are well." },
    { id: "p098", es: "Dice que no hay.", en: "He says there is not any." },

    /* --- the second word list: a day in Colombia, start to finish --- */
    { id: "p099", es: "Me levanto a las seis.", en: "I get up at six.",
      note: "Daily routine verbs take me, te, se: you get yourself up." },
    { id: "p100", es: "Me ducho y me visto.", en: "I have a shower and get dressed." },
    { id: "p101", es: "¿Ya desayunaste?", en: "Have you had breakfast yet?" },
    { id: "p102", es: "Desayuno arepa con huevo.", en: "I have an arepa with egg for breakfast." },
    { id: "p103", es: "¿Me regala un tinto, por favor?", en: "Could I have a coffee, please?",
      note: "Colombian: regalar is to give as a present, but here you still pay." },
    { id: "p104", es: "Un jugo de naranja sin hielo.", en: "An orange juice without ice." },
    { id: "p105", es: "¿Qué me recomienda?", en: "What do you recommend?" },
    { id: "p106", es: "Quiero el pescado con arroz.", en: "I would like the fish with rice." },
    { id: "p107", es: "Todo estuvo delicioso.", en: "Everything was delicious." },
    { id: "p108", es: "¿Me trae la cuenta, por favor?", en: "Could you bring me the bill, please?" },
    { id: "p109", es: "Un café para llevar.", en: "A coffee to take away." },
    { id: "p110", es: "Tengo mucha sed.", en: "I am very thirsty.",
      note: "Thirst and hunger are had, not been: tengo sed, tengo hambre." },

    /* --- getting around --- */
    { id: "p111", es: "¿Dónde queda la parada del bus?", en: "Where is the bus stop?",
      note: "For where a place is, Colombians say queda more than está." },
    { id: "p112", es: "Siga derecho dos cuadras.", en: "Keep going straight on for two blocks." },
    { id: "p113", es: "Dobla a la izquierda en la esquina.", en: "Turn left at the corner." },
    { id: "p114", es: "¿Cuánto vale el pasaje?", en: "How much is the fare?" },
    { id: "p115", es: "Me bajo en la próxima.", en: "I am getting off at the next one." },
    { id: "p116", es: "¿Me deja aquí, por favor?", en: "Can you drop me here, please?" },
    { id: "p117", es: "Hay mucho tráfico hoy.", en: "There is a lot of traffic today." },
    { id: "p118", es: "Hay un trancón muy grande.", en: "There is a huge traffic jam." },
    { id: "p119", es: "Mi vuelo sale mañana temprano.", en: "My flight leaves early tomorrow." },
    { id: "p120", es: "No encuentro mi pasaporte.", en: "I cannot find my passport." },

    /* --- at home --- */
    { id: "p121", es: "La leche está en la nevera.", en: "The milk is in the fridge." },
    { id: "p122", es: "La ducha no tiene agua caliente.", en: "The shower has no hot water." },
    { id: "p123", es: "¿Puedes apagar la luz?", en: "Can you turn off the light?" },
    { id: "p124", es: "Tengo que lavar la ropa.", en: "I have to wash the clothes." },
    { id: "p125", es: "El celular no funciona.", en: "The phone is not working." },
    { id: "p126", es: "¿Cuál es la contraseña?", en: "What is the password?" },
    { id: "p127", es: "Necesito cargar el celular.", en: "I need to charge my phone." },
    { id: "p128", es: "Voy a sacar la basura.", en: "I am going to take the rubbish out." },

    /* --- people --- */
    { id: "p129", es: "¿Cómo te llamas?", en: "What is your name?" },
    { id: "p130", es: "Me llamo Ana. Mucho gusto.", en: "My name is Ana. Nice to meet you." },
    { id: "p131", es: "¿De dónde eres?", en: "Where are you from?" },
    { id: "p132", es: "¿Dónde vives?", en: "Where do you live?" },
    { id: "p133", es: "¿A qué te dedicas?", en: "What do you do?" },
    { id: "p134", es: "Soy ingeniero.", en: "I am an engineer.",
      note: "No article before a job: soy ingeniero, not soy un ingeniero." },
    { id: "p135", es: "¿Cuántos años tienes?", en: "How old are you?" },
    { id: "p136", es: "Mis padres viven muy lejos.", en: "My parents live a long way away." },
    { id: "p137", es: "Mi hermano mayor tiene dos hijos.", en: "My older brother has two children." },
    { id: "p138", es: "¿Conoces a mi novia?", en: "Do you know my girlfriend?",
      note: "a before a person who is the object. It has no English equivalent." },

    /* --- how you are --- */
    { id: "p139", es: "Me siento mal.", en: "I do not feel well." },
    { id: "p140", es: "Tengo dolor de cabeza.", en: "I have a headache.",
      note: "Literally I have pain of head. dolor de estómago, dolor de espalda work the same way." },
    { id: "p141", es: "Creo que tengo gripa.", en: "I think I have the flu." },
    { id: "p142", es: "Necesito ir al médico.", en: "I need to go to the doctor." },
    { id: "p143", es: "¿Hay una droguería cerca?", en: "Is there a chemist's nearby?" },
    { id: "p144", es: "Estoy muy emocionado.", en: "I am very excited." },
    { id: "p145", es: "Estoy harto de la lluvia.", en: "I am fed up with the rain." },
    { id: "p146", es: "No te preocupes.", en: "Do not worry." },

    /* --- plans and small talk --- */
    { id: "p147", es: "¿Qué vas a hacer el fin de semana?", en: "What are you doing at the weekend?" },
    { id: "p148", es: "Vamos a bailar esta noche.", en: "We are going dancing tonight." },
    { id: "p149", es: "Me encanta esta canción.", en: "I love this song.",
      note: "encantar works like gustar: the song delights me." },
    { id: "p150", es: "¿Quieres venir conmigo?", en: "Do you want to come with me?" },
    { id: "p151", es: "Me parece bien.", en: "Sounds good to me." },
    { id: "p152", es: "Hoy hace mucho calor.", en: "It is very hot today.",
      note: "Weather uses hacer: hace calor, hace frío." },
    { id: "p153", es: "Está nublado, va a llover.", en: "It is cloudy, it is going to rain." },
    { id: "p154", es: "Nos vemos pronto.", en: "See you soon." },
    { id: "p155", es: "Gracias por todo.", en: "Thanks for everything." },
    { id: "p156", es: "¿Cómo se dice esto en español?", en: "How do you say this in Spanish?" },
    { id: "p157", es: "Estoy aprendiendo español.", en: "I am learning Spanish." },
    { id: "p158", es: "Más despacio, por favor.", en: "More slowly, please." },
    { id: "p159", es: "Perdón, no entiendo.", en: "Sorry, I do not understand." },
    { id: "p160", es: "¿Me puede ayudar?", en: "Can you help me?" },
  ],
};
