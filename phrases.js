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
  ],
};
