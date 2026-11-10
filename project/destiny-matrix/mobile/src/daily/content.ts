export interface DailyTopicContent {
  readonly title: string;
  readonly question: string;
  readonly paragraphs: readonly [string, string];
  readonly action: string;
}

type LocalizedTopic = Readonly<Record<'ru' | 'en', DailyTopicContent>>;

// A finite editorial set for reflection, independent of birth dates and accounts.
// Symbolic basis: library/waite/arcana, Part II, by card name. The everyday
// situations, questions and exercises are our adaptation, not book quotations.
// The Lovers' choice and the Hanged Man's changed perspective also draw on
// library/benebell-wen/arcana/{06-lovers,12-hanged-man}.md.
// Product numbering: 8 Justice, 11 Strength, 22 Fool (Waite: XI, VIII, 0).
const topics: Readonly<Record<number, LocalizedTopic>> = {
  1: {
    ru: {
      title: 'Замысел становится делом',
      question: 'Какой небольшой шаг выражает то, что для вас важно?',
      paragraphs: [
        'Маг связывает намерение с действием: внутренний смысл получает форму через то, что человек делает. Здесь полезно спросить себя не только «могу ли я?», но и «ради чего?». Даже короткое письмо или первый набросок могут выразить важный замысел точнее, чем ещё один подробный план.',
        'Присмотритесь к средствам, которые уже доступны: время, навык, подготовленный материал, возможность задать вопрос. Необязательно собирать идеальный набор. Выберите одно действие, в котором ваши возможности встретятся с намерением; его масштаб может быть совсем небольшим.',
      ],
      action: 'Назовите свой замысел одним предложением и уделите пять минут его первому шагу.',
    },
    en: {
      title: 'Give an idea a form',
      question: 'What small step expresses something that matters to you?',
      paragraphs: [
        'The Magician connects intention with action: an inner purpose takes shape through something a person does. Alongside “Can I do this?”, there is room for “What is it for?”. A short message or a first sketch can sometimes express an important idea more clearly than another elaborate plan.',
        'Look at the means already available: a skill, a little time, prepared material, or the chance to ask a question. An ideal toolkit is unnecessary. Choose one modest action in which your purpose and your present abilities can meet.',
      ],
      action: 'Describe your intention in one sentence, then spend five minutes on a first step.',
    },
  },
  2: {
    ru: {
      title: 'Прислушаться к смыслу',
      question: 'Что стоит рассмотреть внимательнее, прежде чем отвечать?',
      paragraphs: [
        'Жрица обращает внимание на смысл, который не раскрывается с первого взгляда. Разговор, страница книги или собственная мысль могут потребовать тишины и повторного чтения. Иногда быстрый ответ закрывает вопрос раньше, чем появляется возможность действительно его понять.',
        'Впечатление заслуживает внимания, но ещё не становится доказательством. Можно заметить его, оставить место неизвестному и вернуться к тому, что сказано прямо. Такая пауза помогает различить внутренний отклик, доступные факты и вопрос, на который пока нет ответа.',
      ],
      action: 'Вернитесь к одной важной фразе. Отметьте, что в ней ясно, а что хочется уточнить.',
    },
    en: {
      title: 'Listen beneath the surface',
      question: 'What deserves a closer look before you respond?',
      paragraphs: [
        'The High Priestess draws attention to meaning that does not reveal itself at first glance. A conversation, a page, or a thought of your own may need quiet and a second reading. A quick answer can close a question before there has been time to understand it.',
        'An impression deserves attention without becoming proof. Notice it, leave room for what remains unknown, and return to what was actually said. This pause can help distinguish your inner response from available facts and from a question that still needs an answer.',
      ],
      action: 'Revisit one important sentence. Notice what is clear and what you would like to clarify.',
    },
  },
  3: {
    ru: {
      title: 'Условия для роста',
      question: 'Чему сейчас нужнее забота, чем требование результата?',
      paragraphs: [
        'Императрица связана с плодотворностью: жизнь появляется и развивается там, где её поддерживают. В повседневности этот образ можно примерить к замыслу, привычке или пространству вокруг себя. Иногда дело не в недостатке старания, а в том, что начинанию ещё нужны подходящие условия.',
        'Подумайте, какая забота будет конкретной. Освободить место для работы, подготовить материалы, дать черновику созреть, уделить внимание тому, что уже получается. Рост не всегда заметен сразу; поддерживать его можно без требования немедленно показать красивый итог.',
      ],
      action: 'Улучшите одно условие для важного начинания: место, материалы или спокойное время.',
    },
    en: {
      title: 'Make room for growth',
      question: 'What needs care before it needs a result?',
      paragraphs: [
        'The Empress is associated with the nourishment that allows life to develop. In everyday terms, this image can illuminate a project, a habit, or the space around you. Sometimes more effort is less useful than giving a beginning the conditions it needs.',
        'Consider what care would look like in practice: clearing a workspace, preparing materials, allowing a draft to develop, or noticing what already works. Growth is not always immediately visible. You can support it without asking each small effort to produce a polished result at once.',
      ],
      action: 'Improve one condition for something you are growing: its space, materials, or uninterrupted time.',
    },
  },
  4: {
    ru: {
      title: 'Опора в простых правилах',
      question: 'Какое ясное правило сделает дело легче?',
      paragraphs: [
        'Император выражает способность придавать замыслу устойчивую форму и организовывать действие. В обычном деле это может быть понятный порядок: кто за что отвечает, когда работа закончена, где проходит граница обязательства. Такая определённость освобождает внимание для самого дела.',
        'Но порядок полезен, пока служит своей задаче. Правило, которое приходится защищать только словами «так положено», стоит рассмотреть заново. Можно установить одну надёжную опору и при этом оставить место обстоятельствам, о которых вы пока не знаете.',
      ],
      action: 'Сформулируйте одно простое правило для повторяющегося дела и объясните себе, чему оно служит.',
    },
    en: {
      title: 'A structure that supports',
      question: 'Which clear rule would make a task easier?',
      paragraphs: [
        'The Emperor represents giving an intention a stable form and organising action. In an ordinary task, that might mean knowing who is responsible, when the work is finished, or where a commitment ends. Clear arrangements can leave more attention for the work itself.',
        'Structure remains useful while it serves a purpose. A rule defended only with “That is how it is done” deserves another look. You can establish one dependable boundary while leaving room for circumstances you have not yet encountered.',
      ],
      action: 'Choose one simple rule for a recurring task, and name the purpose it serves.',
    },
  },
  5: {
    ru: {
      title: 'Понять переданное знание',
      question: 'Какой полезный принцип вы хотите понять глубже?',
      paragraphs: [
        'Иерофант связан с учением, которое передают через традицию и признанный порядок. Мы получаем множество готовых способов действовать: от учителя, семьи, профессии. Они могут хранить опыт, который не нужно заново добывать в одиночку, но смысл правила легко теряется за привычной формулировкой.',
        'Выберите один знакомый принцип и попробуйте объяснить, зачем он существует. Где он помогает, а где требует уточнения? Уважение к переданному знанию совместимо с вопросами. Понимание делает правило осознанным выбором, а не только повторением услышанного.',
      ],
      action: 'Вспомните полезный совет учителя или книги. Перескажите его своими словами с одним примером.',
    },
    en: {
      title: 'Understand what you inherit',
      question: 'Which useful principle would you like to understand better?',
      paragraphs: [
        'The Hierophant concerns teaching passed through a recognised tradition. We inherit many ways of doing things from teachers, families, and professions. They can hold experience we need not acquire alone, yet a familiar instruction can outlast our understanding of its purpose.',
        'Choose one principle and consider why it exists. Where does it help, and where might it need clarification? Respect for received knowledge can include thoughtful questions. Understanding allows a rule to become a considered choice rather than simply something repeated because it was once taught.',
      ],
      action: 'Recall one useful lesson from a teacher or book. Explain it in your own words with an example.',
    },
  },
  6: {
    ru: {
      title: 'Близость в малом выборе',
      question: 'Какой выбор выражает ваше отношение к близкому человеку?',
      paragraphs: [
        'Влюблённые обращают к человеческой любви и значимой связи. В повседневности отношение становится видимым через небольшие выборы: выслушать, сказать прямо, оставить другому право ответить по-своему. Близость складывается не только из сильного чувства, но и из того, как для неё находится место.',
        'Попробуйте заметить разницу между желанием получить определённую реакцию и желанием быть внимательнее. Собственный жест можно выбрать; чужой отклик остаётся чужим. Даже простое приглашение к разговору может точнее выразить заботу, чем попытка заранее решить всё за двоих.',
      ],
      action: 'Выберите небольшой жест внимания к близкому человеку, оставив ему свободу откликнуться.',
    },
    en: {
      title: 'Choose room for closeness',
      question: 'Which small choice expresses care for someone close?',
      paragraphs: [
        'The Lovers turns attention towards human love and meaningful connection. Everyday choices make that connection visible: listening, speaking honestly, and allowing another person their own response. Closeness involves both feeling and the room we make for it in ordinary moments.',
        'Notice the difference between wanting a particular reaction and wanting to offer attention. You can choose your gesture; the other person keeps their response. A simple invitation to talk may express care more clearly than trying to decide in advance what both people should feel.',
      ],
      action: 'Offer one small gesture of attention, leaving the other person free to respond in their own way.',
    },
  },
  7: {
    ru: {
      title: 'Выбрать направление',
      question: 'Куда стоит направить усилие, прежде чем ускоряться?',
      paragraphs: [
        'Колесница связана с направленным усилием и победой на внешнем, деятельном плане. Когда задач много, легко принять скорость за продвижение. Полезно различить: вы уже движетесь к выбранной цели или просто успешно справляетесь с очередным требованием?',
        'Даже хорошо организованное движение не отвечает само по себе на вопрос о смысле цели. Остановитесь на минуту, чтобы сверить направление. Затем выберите ближайший участок пути: понятный результат, доступное действие и то, что сейчас можно оставить за пределами внимания.',
      ],
      action: 'Назовите один результат на ближайший час и отложите одну задачу, которая уводит в сторону.',
    },
    en: {
      title: 'Choose your direction',
      question: 'Where should effort go before you pick up speed?',
      paragraphs: [
        'The Chariot is associated with directed effort and achievement in the outward world. When tasks multiply, speed can look like progress. It is useful to distinguish moving towards a chosen goal from becoming very efficient at answering each new demand.',
        'Well-organised movement does not, by itself, explain why a destination matters. Take a moment to check the direction. Then choose the next stretch of the journey: a clear result, an available action, and something you can deliberately leave outside your attention for now.',
      ],
      action: 'Name one result for the next hour and set aside one task that pulls you away from it.',
    },
  },
  8: {
    ru: {
      title: 'Одинаковая мера',
      question: 'Применяете ли вы к себе и другим одинаковые критерии?',
      paragraphs: [
        'Справедливость предлагает рассмотреть поступки, обязательства и последствия без поспешного приговора. В спорном вопросе легко незаметно менять меру: своё опоздание объяснять обстоятельствами, а чужое — отношением к вам. Одинаковый критерий помогает увидеть ситуацию точнее.',
        'Начните с того, что действительно известно, затем отделите договорённость от ожидания, которое не было высказано. Не всё случившееся заслужено и не всё находится в чьей-то власти. Но там, где решение принадлежит вам, можно сделать его понятным и соразмерным.',
      ],
      action: 'Возьмите одно небольшое разногласие и запишите факт, договорённость и невысказанное ожидание отдельно.',
    },
    en: {
      title: 'Use the same measure',
      question: 'Are you applying the same standard to yourself and others?',
      paragraphs: [
        'Justice invites a measured look at actions, commitments, and consequences before reaching a verdict. Standards can quietly shift: your own delay has circumstances, while someone else’s seems to reveal their attitude. Applying the same measure can make a situation clearer.',
        'Begin with what is known, then distinguish an agreement from an expectation that was never spoken. Not everything that happens is deserved or within someone’s control. Where a decision is yours, however, you can make its reasoning understandable and its response proportionate.',
      ],
      action: 'For one small disagreement, separate a fact, an agreement, and an unspoken expectation.',
    },
  },
  9: {
    ru: {
      title: 'Свет своего опыта',
      question: 'Что из уже понятого может стать для вас опорой?',
      paragraphs: [
        'Отшельник связан с достигнутым пониманием, которое может освещать путь. Его тема шире одиночества: важно не только отойти от шума, но и заметить, какой опыт уже стал ясным. Иногда полезный ответ теряется среди новых советов, хотя однажды вы уже нашли работающий способ.',
        'Вернитесь к такому опыту без требования превратить его во всеобщее правило. Что именно тогда помогло? Где это применимо сейчас? Ясно сформулированное наблюдение может поддержать и вас, и того, кто попросит поделиться, не требуя навязывать ему свой путь.',
      ],
      action: 'Вспомните один освоенный урок и запишите, в каких обстоятельствах он действительно помогает.',
    },
    en: {
      title: 'Light from experience',
      question: 'What have you already understood that could support you?',
      paragraphs: [
        'The Hermit is associated with understanding that has been reached and can illuminate a path. This is more than solitude: stepping away from noise can reveal knowledge already made clear by experience. A useful answer can disappear beneath new advice even when you have previously found a workable approach.',
        'Return to that experience without turning it into a rule for everyone. What helped, and where is it relevant now? A clearly expressed observation can support you and, when invited, someone else, while leaving them their own path.',
      ],
      action: 'Recall one lesson you have learned, and note the circumstances in which it actually helps.',
    },
  },
  10: {
    ru: {
      title: 'Опора среди перемен',
      question: 'Что можно сохранить, когда обстоятельства меняются?',
      paragraphs: [
        'Колесо Фортуны соединяет движение жизни с поиском равновесия внутри перемен. План может измениться, привычный ритм — сдвинуться, а возможность — появиться не в назначенный час. Этот образ предлагает рассмотреть, на что можно опереться, когда внешние условия не остаются прежними.',
        'Разделите происходящее на то, что можно выбрать, и то, к чему приходится приспосабливаться. Сохранить важный смысл иногда удаётся, изменив форму действия. Перенести встречу, упростить задачу или уточнить следующий шаг — тоже способы продолжать путь, не требуя от обстоятельств неподвижности.',
      ],
      action: 'Для одного изменившегося плана найдите то, что хотите сохранить, и одну допустимую замену.',
    },
    en: {
      title: 'Steadiness within change',
      question: 'What can remain important when circumstances change?',
      paragraphs: [
        'The Wheel of Fortune brings together life’s movement and balance within change. A plan may shift, a familiar rhythm may alter, and an opportunity may arrive at an inconvenient time. The image invites attention to what can support you when external conditions will not stay still.',
        'Distinguish what you can choose from what requires adjustment. Sometimes an intention survives through a different form: rescheduling, simplifying a task, or clarifying the next step. These are ways to continue without requiring the circumstances themselves to become fixed.',
      ],
      action: 'For one changed plan, name what you want to preserve and one acceptable alternative.',
    },
  },
  11: {
    ru: {
      title: 'Сила без нажима',
      question: 'Где спокойная твёрдость полезнее резкого усилия?',
      paragraphs: [
        'Сила связана с тем, как более глубокое намерение направляет порыв, не отдавая ему всё управление. Раздражение, азарт или нетерпение могут быть заметными, но действие не обязано повторять их громкость. Между первым импульсом и ответом иногда достаточно небольшой паузы.',
        'Мягкость здесь не требует отказаться от своей границы. Можно произнести ясное «нет», уменьшить темп или повторить просьбу без давления. Попробуйте найти форму, в которой твёрдое решение сохраняется, а лишняя борьба перестаёт поглощать внимание и силы.',
      ],
      action: 'Сформулируйте одну важную границу коротко и спокойно, без оправданий и обвинений.',
    },
    en: {
      title: 'Strength without pressure',
      question: 'Where would quiet firmness help more than force?',
      paragraphs: [
        'Strength concerns a deeper intention guiding an impulse rather than handing it control. Irritation, excitement, or impatience can be present without setting the volume of your response. A brief pause can create room between the first impulse and the action that follows.',
        'Gentleness does not require surrendering a boundary. You can say a clear no, slow the pace, or repeat a request without pressure. Look for a form in which the decision remains firm while unnecessary struggle takes less of your attention.',
      ],
      action: 'Express one important boundary briefly and calmly, without accusations or a long defence.',
    },
  },
  12: {
    ru: {
      title: 'Пауза для нового взгляда',
      question: 'Что становится видно, если ненадолго перестать торопить решение?',
      paragraphs: [
        'Повешенный связан с приостановленностью, в которой возможно новое понимание. Не всякая остановка пуста: иногда привычное действие мешает увидеть сам вопрос. Если дело допускает паузу, можно временно отложить поиск ответа и рассмотреть, как именно вы ставите задачу.',
        'Смена взгляда не требует признать себя неправым или терпеть то, что причиняет вред. Это небольшой опыт: заменить одну привычную формулировку, заметить упущенное условие, допустить другой способ начать. Пауза получает смысл, когда после неё появляется что-то, что раньше оставалось незамеченным.',
      ],
      action: 'Переформулируйте один застрявший вопрос, начав со слов «Что я пока не учитываю?».',
    },
    en: {
      title: 'Pause for another view',
      question: 'What becomes visible when you stop hurrying an answer?',
      paragraphs: [
        'The Hanged Man concerns suspension in which a different understanding becomes possible. Not every pause is empty: a familiar action can obscure the question itself. If the situation allows, set the search for an answer aside and examine how you have framed the problem.',
        'A changed perspective does not require declaring yourself wrong or enduring harm. It can be a small experiment: rewording a question, noticing an overlooked condition, or allowing another starting point. The pause gains purpose when something previously unnoticed becomes visible.',
      ],
      action: 'Reframe one stuck question by beginning, “What have I not yet taken into account?”.',
    },
  },
  13: {
    ru: {
      title: 'Дать этапу завершиться',
      question: 'Что уже выполнило свою задачу и может закончиться?',
      paragraphs: [
        'В теме дня Смерть обращает к переходу между формами жизни и опыта: старое устройство уже не вмещает то, что изменилось. Для размышления можно взять совсем небольшой пример — завершённый черновик, устаревший список дел, привычку хранить материалы к давно закрытой задаче.',
        'Завершение не обязывает считать прошлое ошибкой. Оно могло быть нужным и при этом перестать быть актуальным. Попробуйте отделить ценность полученного опыта от необходимости продолжать прежнюю форму. Иногда достаточно назвать дело законченным и оставить из него то, что пригодится дальше.',
      ],
      action: 'Закройте одну небольшую завершённую задачу: подведите итог и уберите её из активного списка.',
    },
    en: {
      title: 'Let a stage end',
      question: 'What has served its purpose and can now be completed?',
      paragraphs: [
        'As a topic for reflection, Death turns attention to a transition between forms of experience: an old arrangement no longer holds what has changed. Choose a modest example, such as a finished draft, an outdated task list, or materials kept for a project that has already ended.',
        'Completion does not mean the past was a mistake. Something can have been valuable and no longer be current. Separate the experience worth keeping from the need to maintain its previous form. Sometimes naming a task finished is enough to make room.',
      ],
      action: 'Close one small completed task: note what it gave you and remove it from your active list.',
    },
  },
  14: {
    ru: {
      title: 'Найти подходящую меру',
      question: 'Какие две потребности можно лучше согласовать?',
      paragraphs: [
        'Умеренность связана с согласованием разных сторон жизни. Это не обязательно равное количество всего: нужная мера зависит от того, что вы соединяете. Сосредоточенная работа и отдых, собственный темп и общая договорённость могут требовать разных пропорций в разные дни.',
        'Вместо резкой переделки всего распорядка попробуйте небольшую настройку. Чуть сократить задачу, добавить промежуток между встречами, заранее подготовить переход от работы к дому. Важно заметить, как части сочетаются между собой, а не оценивать каждую из них отдельно как правильную или неправильную.',
      ],
      action: 'Выберите две конкурирующие потребности и измените одну небольшую деталь, чтобы учесть обе.',
    },
    en: {
      title: 'Find a workable proportion',
      question: 'Which two needs could fit together more comfortably?',
      paragraphs: [
        'Temperance concerns bringing different parts of life into a workable relationship. This need not mean equal amounts of everything. Focused work and rest, or your own pace and a shared commitment, may call for different proportions on different days.',
        'Instead of rebuilding your whole routine, try one small adjustment: shorten a task, leave a gap between meetings, or prepare a transition from work to home. Notice how the parts work together, rather than judging each one in isolation as entirely right or wrong.',
      ],
      action: 'Choose two competing needs and adjust one small detail so that both receive some room.',
    },
  },
  15: {
    ru: {
      title: 'Заметить привычную привязку',
      question: 'Где автоматическое «да» можно заменить осознанным выбором?',
      paragraphs: [
        'Дьявол ставит вопрос о свободе там, где притяжение или привычка сужают выбор. Для спокойного размышления достаточно бытовой сцены: открыть знакомую ленту, согласиться по инерции, проверить уведомления без особой причины. Важно увидеть связь между побуждением и действием, а не осудить себя за неё.',
        'Спросите, что обещает привычное действие и что оно действительно даёт в этом случае. Затем найдите маленький доступный выбор: отложить, изменить условие, выбрать другой способ. Замеченная привязка не определяет человека целиком; её можно рассматривать конкретно, без ярлыков.',
      ],
      action: 'Перед одним привычным действием сделайте паузу и решите, хотите ли вы его именно сейчас.',
    },
    en: {
      title: 'Notice an automatic pull',
      question: 'Where could an automatic yes become a considered choice?',
      paragraphs: [
        'The Devil raises the question of freedom where attraction or habit narrows a choice. An ordinary example is enough: opening a familiar feed, agreeing by default, or checking notifications without a reason. The aim is to notice the link between an impulse and an action without condemning yourself.',
        'Ask what the familiar action promises and what it actually offers in this instance. Then find a small available choice: delay it, change a condition, or try another approach. A pattern can be examined specifically without becoming a label for a person.',
      ],
      action: 'Pause before one habitual action and decide whether you want to do it at this moment.',
    },
  },
  16: {
    ru: {
      title: 'Проверить основание',
      question: 'Какое предположение вы давно принимаете без проверки?',
      paragraphs: [
        'Башня обращает внимание на то, что построено на ненадёжном основании. В размышлении это может быть не большое потрясение, а знакомая уверенность: «иначе нельзя», «всем это понятно», «мы уже договорились». Полезно проверить, что под ней находится: факт, старая информация или повторённое много раз предположение.',
        'Пересматривать уверенность бывает неприятно, и не нужно требовать от себя немедленно увидеть в этом пользу. Начните с одного доступного уточнения. Исправленная деталь не обесценивает всё сделанное; она позволяет точнее понять, какую часть решения стоит сохранить, а какую изменить.',
      ],
      action: 'Выберите одно рабочее предположение и найдите простой способ его проверить или уточнить.',
    },
    en: {
      title: 'Check the foundation',
      question: 'Which assumption have you stopped examining?',
      paragraphs: [
        'The Tower directs attention to what rests on an unreliable foundation. For reflection, this can be a familiar certainty rather than a dramatic event: “There is no other way”, “Everyone understands”, or “We already agreed”. Consider what supports it: a fact, old information, or an assumption repeated many times.',
        'Revising a certainty can be uncomfortable; there is no need to find an immediate benefit. Begin with one possible clarification. Correcting a detail does not erase all previous work. It helps distinguish what can remain from what needs to change.',
      ],
      action: 'Choose one working assumption and find a simple way to check or clarify it.',
    },
  },
  17: {
    ru: {
      title: 'То, что питает надежду',
      question: 'Что поддерживает вас без требования немедленной отдачи?',
      paragraphs: [
        'Звезда связана с открытостью, щедро передаваемой жизнью и смыслом, который помогает смотреть дальше. Надежда здесь может быть тихой: интерес к незавершённому делу, красота знакомого места, возможность снова попробовать. Ей не обязательно превращаться в обещание, что всё получится по плану.',
        'Заметьте то, что питает внимание без соревнования и оценки. Этим можно воспользоваться самому или поделиться: дать время творчеству, предложить полезную находку, спокойно поддержать чужой замысел. Небольшой свободный жест сохраняет ценность даже тогда, когда его результат нельзя заранее измерить.',
      ],
      action: 'Уделите несколько минут тому, что вдохновляет без оценки результата, или поделитесь такой находкой.',
    },
    en: {
      title: 'What nourishes hope',
      question: 'What supports you without demanding an immediate return?',
      paragraphs: [
        'The Star is associated with openness, freely offered nourishment, and meaning that allows a wider view. Hope can be quiet: interest in unfinished work, beauty in a familiar place, or room to try again. It need not become a promise that everything will follow a plan.',
        'Notice what sustains attention without competition or assessment. You might make room for it yourself or share it: spend time creating, offer a useful discovery, or encourage someone’s idea. A freely offered gesture can matter even when its outcome cannot be measured in advance.',
      ],
      action: 'Spend a few minutes with something inspiring, without assessing the result, or share a useful discovery.',
    },
  },
  18: {
    ru: {
      title: 'Различить факт и догадку',
      question: 'Что вы знаете, а что воображение пока достраивает?',
      paragraphs: [
        'Луна связана с воображением и неясностью, в которой знакомые вещи могут выглядеть иначе. Короткий ответ, задержка сообщения или незавершённый разговор оставляют место догадкам. Чувство при этом может быть вполне настоящим, хотя объяснение случившегося ещё не проверено.',
        'Попробуйте не спорить с самим переживанием и одновременно не принимать первый сюжет за факт. Что вы наблюдали напрямую? Какие другие объяснения возможны? Какое уточнение действительно доступно? Если ответа пока нет, допустимо оставить вопрос открытым, не заполняя неизвестность самым тревожным вариантом.',
      ],
      action: 'Для одной неясной ситуации запишите наблюдаемый факт и две возможные версии, не выбирая победителя.',
    },
    en: {
      title: 'Separate fact from possibility',
      question: 'What do you know, and what is imagination filling in?',
      paragraphs: [
        'The Moon concerns imagination and uncertainty, where familiar things can look different. A brief reply, a delayed message, or an unfinished conversation leaves space for guesses. The feeling may be real while the explanation of what happened remains untested.',
        'Try allowing the feeling without treating the first story as a fact. What did you observe directly? Which other explanations are possible? What could you actually clarify? If no answer is available yet, the question can remain open instead of being filled with the most worrying possibility.',
      ],
      action: 'For one unclear situation, write down an observed fact and two possible explanations without choosing one.',
    },
  },
  19: {
    ru: {
      title: 'Заметить ясную радость',
      question: 'Что хорошее можно принять без сложного объяснения?',
      paragraphs: [
        'Солнце связано с ясностью, простотой и ощущением целостности. В обычном дне этот образ приглашает заметить хорошее, которое уже присутствует: понятный разговор, законченное дело, удовольствие от прогулки. Иногда радость становится почти невидимой, если сразу превращать её в новый план или сравнение.',
        'Не нужно заставлять себя быть в хорошем настроении. Достаточно дать одному приятному моменту место рядом со всем остальным. Можно назвать его, задержаться в нём на минуту или разделить с другим человеком, не требуя, чтобы он объяснял и оправдывал весь день.',
      ],
      action: 'Назовите одну простую радость этого дня и побудьте с ней минуту, ничего не улучшая.',
    },
    en: {
      title: 'Notice a simple joy',
      question: 'What good thing needs no complicated explanation?',
      paragraphs: [
        'The Sun is associated with clarity, simplicity, and a sense of wholeness. In an ordinary day, it invites attention to something good already present: a clear conversation, completed work, or pleasure in a walk. Joy can become almost invisible when immediately turned into a new plan or comparison.',
        'There is no requirement to feel cheerful. Give one pleasant moment room alongside everything else. You can name it, stay with it briefly, or share it with someone without asking it to explain or justify the entire day.',
      ],
      action: 'Name one simple pleasure from your day and spend a minute with it without trying to improve it.',
    },
  },
  20: {
    ru: {
      title: 'Услышать важный отклик',
      question: 'К какому важному делу вы хотите вернуться осознанно?',
      paragraphs: [
        'Суд связан с пробуждением и внутренним ответом на значимый призыв. В повседневном размышлении это может быть возвращение к делу, которое продолжает иметь смысл: разговору, обучению, обещанию самому себе. Важно различить живой отклик и привычное требование немедленно всё наверстать.',
        'Возвращаться необязательно в прежнем виде. Можно пересмотреть обязательство, начать с другого шага или признать, что смысл сохранился, а способ изменился. Вместо приговора прошлому попробуйте определить, какой ответ возможен сейчас и действительно соответствует тому, что для вас важно.',
      ],
      action: 'Выберите одно важное незавершённое дело и определите небольшой осознанный шаг возвращения.',
    },
    en: {
      title: 'Answer what matters',
      question: 'Which meaningful task would you like to return to deliberately?',
      paragraphs: [
        'Judgement is associated with awakening and an inward response to a meaningful call. In everyday reflection, this might be a return to a conversation, learning, or a promise to yourself that still matters. Distinguish a living interest from the familiar demand to catch up on everything immediately.',
        'Returning need not mean repeating the old arrangement. A commitment can be reconsidered or approached differently. Instead of passing judgement on the past, ask what response is possible now and whether it still expresses something important to you.',
      ],
      action: 'Choose one meaningful unfinished task and define a small, deliberate way to return to it.',
    },
  },
  21: {
    ru: {
      title: 'Увидеть целое',
      question: 'Какой результат стоит признать завершённым?',
      paragraphs: [
        'Мир связан с полнотой и завершением: отдельные части складываются в целое, которое можно увидеть и признать. В повседневности этому иногда мешает взгляд, занятый только недочётами. Законченное дело уже стало частью опыта, даже если его можно было бы бесконечно улучшать.',
        'Попробуйте посмотреть на весь путь: что требовалось в начале, что получилось, какие навыки и связи появились по дороге. Завершение позволяет не только поставить отметку, но и присвоить результат. После этого легче решить, что действительно продолжать, а что оставить завершённым.',
      ],
      action: 'Подведите итог одному законченному делу: результат, приобретённый опыт и то, что больше не нужно делать.',
    },
    en: {
      title: 'See the whole',
      question: 'Which result deserves to be recognised as complete?',
      paragraphs: [
        'The World concerns wholeness and completion: separate parts come together into something that can be recognised. In everyday life, attention fixed only on imperfections can obscure that whole. Finished work has already become part of your experience, even when further improvements remain possible.',
        'Look at the full path: what was needed at the start, what emerged, and which skills or connections developed along the way. Completion lets you acknowledge a result, then decide what truly deserves continuation and what can remain finished.',
      ],
      action: 'Review one completed task: its result, what you learned, and what no longer needs doing.',
    },
  },
  22: {
    ru: {
      title: 'Разрешить себе пробу',
      question: 'Что можно попробовать без требования сразу уметь?',
      paragraphs: [
        'Шут связан с открытостью опыту и возможностью встретить незнакомое без готового ответа. Для такой встречи не обязательно менять всю жизнь. Иногда достаточно взять непривычный материал, задать простой вопрос или попробовать занятие, в котором пока нет привычной роли знающего человека.',
        'Свобода пробы хорошо сочетается с понятными границами: небольшое время, доступные средства, возможность остановиться. Тогда любопытство получает место, а результат не обязан доказывать вашу способность. Даже опыт «мне это не подходит» может быть полноценным итогом маленького исследования.',
      ],
      action: 'Выберите безопасную пробу на десять минут, в которой можно быть начинающим и ничего не доказывать.',
    },
    en: {
      title: 'Allow a first attempt',
      question: 'What could you try without already knowing how?',
      paragraphs: [
        'The Fool is associated with openness to experience and meeting the unfamiliar without a prepared answer. This does not require changing your whole life. A different material, a simple question, or an activity outside your usual expertise can provide a small encounter with something new.',
        'Experimenting can have clear boundaries: a little time, available means, and permission to stop. Curiosity then has room without making the outcome a test of your ability. Discovering that something is not for you can be a complete result of a small exploration.',
      ],
      action: 'Choose a safe ten-minute experiment in which you can be a beginner with nothing to prove.',
    },
  },
};

export function dailyContent(locale: 'ru' | 'en', arcanum: number): DailyTopicContent {
  if (!Number.isInteger(arcanum) || arcanum < 1 || arcanum > 22) {
    throw new RangeError('Daily topic arcanum must be an integer from 1 to 22');
  }
  return topics[arcanum][locale];
}
