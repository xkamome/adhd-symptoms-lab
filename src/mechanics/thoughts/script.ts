// 交代的內容：每局隨機抽一種情境（主管／教授／家長），再從該情境的欄位池組出 11 句話。
// 考題與錯誤選項也從同一組池子挑，所以沒辦法靠「上次考過」或「一眼看出哪個是亂編的」作答。

const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
const shuffle = <T>(a: readonly T[]) => {
  const b = a.slice()
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] }
  return b
}
const other = <T>(a: readonly T[], not: T) => pick(a.filter((x) => x !== not))

export interface Question { q: string; options: string[]; answer: string }

/** 腦中冒出的念頭；next 是趕走它之後可能被牽出來的下一個 */
export interface Thought { text: string; next?: string }

export interface Scenario {
  id: 'boss' | 'professor' | 'parent'
  emoji: string
  speaker: string // 「主管正在交代事情。」
  once: string // 「她只講一次。」
  myth: string // 結果頁「一般人以為」
  thoughts: Thought[] // 這個情境專屬的念頭
}

export interface Briefing { scenario: Scenario; lines: string[]; quiz: Question[] }

/** 正解 + 3 個從同一池子挑的干擾選項，打亂順序 */
function mcq(q: string, answer: string, pool: readonly string[]): Question {
  const wrong = shuffle([...new Set(pool)].filter((x) => x !== answer)).slice(0, 3)
  return { q, answer, options: shuffle([answer, ...wrong]) }
}

const t = (text: string, next?: string): Thought => ({ text, next })

// ── 主管：交代報表 ─────────────────────────────────────────────

const BOSS: Scenario = {
  id: 'boss', emoji: '👩‍💼', speaker: '主管正在交代事情。', once: '她只講一次。',
  myth: '沒在聽、不尊重人、左耳進右耳出。',
  thoughts: [
    t('他今天換髮型了？', '我是不是也該剪頭髮了'),
    t('主管的馬克杯好可愛', '在哪裡買的啊'),
    t('上次開會是不是講錯話', '他那時候的表情是什麼意思'),
    t('她講話一直在轉筆', '轉得好順，怎麼辦到的'),
    t('這個月的加班費……', '算了，不要想'),
    t('會議室冷氣好強', '是不是只有我覺得冷'),
    t('我在這間公司第幾年了', '時間怎麼過得這麼快'),
    t('下班要不要去健身房', '上次去好像是三月'),
  ],
}

function bossBrief() {
  const DAYS = ['週一', '週二', '週三', '週四', '週五'] as const
  const TIMES = ['早上十點', '中午十二點', '下午三點', '下午五點'] as const
  const REPORTS = ['第三季的業績報表', '客戶滿意度調查', '明年的預算表', '新產品企劃書', '展場活動的成果報告'] as const
  const DEPTS = ['業務部', '行銷部', '財務部', '人資部'] as const
  const NAMES = ['林經理', '陳經理', '王協理', '張主任'] as const
  const CCS = ['財務的小陳', '行銷的阿美', '業務的小吳', '人資的佩佩'] as const
  const FORMATS = ['PDF', 'Excel', 'Word', '簡報檔'] as const
  const UNITS = ['新台幣千元', '新台幣萬元', '新台幣元', '美元'] as const
  const ASKS = ['阿哲', '小芳', '志明', '雅婷'] as const

  const day = pick(DAYS), time = pick(TIMES), report = pick(REPORTS)
  const dept = pick(DEPTS), name = pick(NAMES), cc = pick(CCS)
  const format = pick(FORMATS), notFormat = other(FORMATS, format)
  const unit = pick(UNITS), ask = pick(ASKS)

  const lines = [
    '好，我簡單交代一下。',
    `${day}${time}前，`,
    `把${report}`,
    `寄給${dept}的${name}，`,
    `副本給${cc}。`,
    '檔名後面要加上日期，',
    `格式用${format}，不要${notFormat}。`,
    `數字單位用${unit}。`,
    `如果有問題，先問${ask}，`,
    `不要直接去問${name}。`,
    '好，這樣清楚嗎？',
  ]
  // 截止時間的干擾選項：只改星期或只改時間，才不會一眼看穿
  const quiz = [
    mcq('截止時間是？', `${day}${time}`, [...DAYS.map((d) => `${d}${time}`), ...TIMES.map((x) => `${day}${x}`)]),
    mcq('要交的是什麼？', report, REPORTS),
    mcq('要寄給誰？', `${dept}的${name}`, DEPTS.flatMap((d) => NAMES.map((n) => `${d}的${n}`))),
    mcq('副本給誰？', cc, CCS),
    mcq('檔案格式？', format, FORMATS),
    mcq('數字單位？', unit, UNITS),
    mcq('有問題先問誰？', ask, [...ASKS, name]),
  ]
  return { lines, quiz }
}

// ── 教授：期末報告規定 ─────────────────────────────────────────

const PROFESSOR: Scenario = {
  id: 'professor', emoji: '👨‍🏫', speaker: '教授在講期末報告的規定。', once: '他只講一次。',
  myth: '上課不專心、不用功，被扣分是活該。',
  thoughts: [
    t('教授的襯衫跟上週一樣', '是同一件，還是買了一打'),
    t('旁邊的同學在課本上畫畫', '欸，畫得還不錯'),
    t('學餐今天有沒有咖哩', '上次的咖哩好水'),
    t('投影片的字好小', '後排的人看得到嗎'),
    t('我當初為什麼選這堂課', '喔對，因為學分'),
    t('期中考成績公布了沒', '……還是不要看好了'),
    t('大家為什麼在笑', '他剛剛講了什麼笑話'),
    t('社團的東西還沒弄', '學長會不會生氣'),
  ],
}

function professorBrief() {
  const DAYS = ['週一', '週二', '週三', '週四', '週五'] as const
  const TIMES = ['早上九點', '中午十二點', '下午五點', '晚上十一點五十九分'] as const
  const TEAMS = ['兩個人', '三個人', '四個人', '五個人'] as const
  const TOPICS = ['台灣的夜市文化', '社群媒體與睡眠', '便利商店的經濟學', '手搖飲的產業分析', '貓為什麼要推倒杯子'] as const
  const WORDS = ['三千字', '五千字', '八千字', '一萬字'] as const
  const PLATFORMS = ['Moodle', 'Google Classroom', '系上信箱', '課程網'] as const
  const FORMATS = ['PDF', 'Word', 'Google 文件', 'ODT'] as const
  const CITES = ['APA', 'MLA', 'Chicago', 'IEEE'] as const
  const TAS = ['助教小林', '助教阿凱', '助教佳佳', '助教小美'] as const

  const day = pick(DAYS), time = pick(TIMES), team = pick(TEAMS), topic = pick(TOPICS)
  const words = pick(WORDS), platform = pick(PLATFORMS)
  const format = pick(FORMATS), notFormat = other(FORMATS, format)
  const cite = pick(CITES), ta = pick(TAS)

  const lines = [
    '好，期末報告的規定我只講一次。',
    `${team}一組，`,
    `題目是「${topic}」，`,
    `字數至少${words}。`,
    `${day}${time}前`,
    `上傳到${platform}，`,
    `存成${format}，不要${notFormat}。`,
    `引用格式一律用${cite}。`,
    `有問題先問${ta}，`,
    '不要半夜寄信給我。',
    '好，大家都聽清楚了吧？',
  ]
  const quiz = [
    mcq('截止時間是？', `${day}${time}`, [...DAYS.map((d) => `${d}${time}`), ...TIMES.map((x) => `${day}${x}`)]),
    mcq('幾個人一組？', team, TEAMS),
    mcq('報告題目是？', topic, TOPICS),
    mcq('字數至少多少？', words, WORDS),
    mcq('要上傳到哪裡？', platform, PLATFORMS),
    mcq('檔案要存成？', format, FORMATS),
    mcq('引用格式用哪一種？', cite, CITES),
    mcq('有問題先問誰？', ta, TAS),
  ]
  return { lines, quiz }
}

// ── 家長：出門前交代 ───────────────────────────────────────────

const PARENT: Scenario = {
  id: 'parent', emoji: '👩', speaker: '媽媽出門前在交代事情。', once: '她只講一次。',
  myth: '叫不動、講了也當耳邊風，根本是故意的。',
  thoughts: [
    t('媽媽背了一個新包包', '看起來好像很貴'),
    t('冰箱裡的布丁是我的嗎', '沒寫名字就是我的'),
    t('等一下可以打電動嗎', '先打一場就好'),
    t('貓一直盯著我', '牠是不是知道什麼'),
    t('晚餐是不是又是咖哩', '已經連續三天了'),
    t('我的襪子怎麼只剩一隻', '洗衣機是不是會吃襪子'),
    t('遙控器又不見了', '一定在沙發縫裡'),
    t('她剛剛說幾點？', '……算了，等一下再問'),
  ],
}

function parentBrief() {
  const TIMES = ['四點', '五點', '六點', '七點'] as const
  const CHORES = ['把衣服收進來', '把碗洗好', '把垃圾拿去倒', '把貓砂清一清'] as const
  const STORES = ['全聯', '巷口的雜貨店', '菜市場', '便利商店'] as const
  const ITEMS = ['兩瓶醬油', '一盒雞蛋', '一串香蕉', '一包衛生紙'] as const
  const PLACES = ['電視櫃第二層', '冰箱上面', '鞋櫃裡的鐵盒', '玄關的碗裡'] as const
  const VISITORS = ['阿姨', '隔壁的陳伯伯', '表哥', '里長'] as const
  const SPOTS = ['門口的紙袋', '餐桌上的盒子', '客廳的紅色袋子', '冰箱第二層'] as const
  const CALLS = ['阿嬤', '爸爸', '小阿姨', '舅舅'] as const

  const time = pick(TIMES), chore = pick(CHORES), store = pick(STORES), item = pick(ITEMS)
  const place = pick(PLACES), visitor = pick(VISITORS), spot = pick(SPOTS), call = pick(CALLS)

  const lines = [
    '媽媽要出門了，你聽好喔。',
    `${time}前${chore}，`,
    `然後去${store}`,
    `買${item}。`,
    `錢放在${place}。`,
    `等一下${visitor}會來拿東西，`,
    `東西在${spot}。`,
    '門要鎖好，',
    `有事先打給${call}，`,
    '不要一直打給我，我在開會。',
    '好，我走了喔，聽到沒？',
  ]
  const quiz = [
    mcq('幾點前要做完？', `${time}前`, TIMES.map((x) => `${x}前`)),
    mcq('要做什麼家事？', chore, CHORES),
    mcq('去哪裡買東西？', store, STORES),
    mcq('要買什麼？', item, ITEMS),
    mcq('錢放在哪？', place, PLACES),
    mcq('誰會來拿東西？', visitor, VISITORS),
    mcq('要給他的東西在哪？', spot, SPOTS),
    mcq('有事先打給誰？', call, CALLS),
  ]
  return { lines, quiz }
}

const SCENARIOS = [
  { scenario: BOSS, build: bossBrief },
  { scenario: PROFESSOR, build: professorBrief },
  { scenario: PARENT, build: parentBrief },
] as const

export function makeBriefing(quizCount = 5): Briefing {
  const { scenario, build } = pick(SCENARIOS)
  const { lines, quiz } = build()
  return { scenario, lines, quiz: shuffle(quiz).slice(0, quizCount) }
}

// ── 念頭：每種情境都會冒出來的 ────────────────────────────────

export const THOUGHTS: Thought[] = [
  // 荒謬聯想
  t('企鵝有膝蓋嗎', '好像有，藏在羽毛裡'),
  t('如果貓會講話，第一句是什麼', '大概是「飯呢」'),
  t('鴿子的脖子為什麼會發亮', '鴿子是不是其實很時尚'),
  t('恐龍如果還活著會喝珍奶嗎', '應該會點大杯'),
  t('左手是不是比較少被重用', '左手好可憐'),
  t('章魚有三顆心臟', '那牠失戀會難過三倍嗎'),
  // 身體訊號
  t('肚子叫了一聲', '大家有聽到嗎'),
  t('有點想上廁所', '再撐一下好了……吧？'),
  t('眼睛好乾', '我今天是不是忘了喝水'),
  t('鼻子好癢', '要打噴嚏了……又沒了'),
  t('腳麻了', '站起來會不會像殭屍'),
  // 社交重播
  t('國中那次上台講錯話', '為什麼現在突然想起來'),
  t('剛剛那封信回了沒？', '糟了，好像還沒回'),
  t('昨天那個已讀不回', '是不是我講錯什麼'),
  t('我是不是點頭點太多下', '現在突然停下來會不會很怪'),
  t('我現在的表情看起來認真嗎', '眉頭要不要再皺一點'),
  // 購物衝動
  t('購物車那件外套還在打折嗎', '今天好像是最後一天'),
  t('要記得買牙膏', '還有衛生紙好像也沒了'),
  t('氣炸鍋好像很好用', '可是家裡沒地方放'),
  t('那個限定口味的洋芋片', '再不買就要下架了'),
  // 哲學大哉問
  t('如果我其實是 NPC', '那我的台詞是誰寫的'),
  t('宇宙外面是什麼', '好，先不要想這個'),
  t('「一下下」到底是多久', '跟「等一下」差不多吧'),
  t('為什麼鳳梨酥裡面是冬瓜', '這樣算詐騙嗎'),
  // 耳蟲歌
  t('腦中開始播垃圾車的音樂', '♪ 少女的祈禱～'),
  t('那首歌叫什麼……', '♪ 噠啦噠～啦……'),
  t('剛剛那支廣告的歌', '♪ 怎麼一直重複那一句'),
  // 突然想做的事
  t('我瓦斯有關嗎', '應該有吧……有嗎？'),
  t('好想整理房間', '為什麼只有現在想'),
  t('突然好想學日文', '先從五十音……算了'),
  t('好想吃鹹酥雞', '九層塔要加'),
  t('午餐要吃什麼', '那家拉麵是不是關了？'),
  t('週末要幹嘛', '上次說要去的那個展覽'),
  t('等等要先做哪件事', '清單寫在哪張便利貼上'),
]

/** 困難模式的「手機通知」泡泡 */
export const NOTIFICATIONS: string[] = [
  'LINE：阿姨傳了一張早安圖',
  '購物 App：你的購物車想你了',
  '行事曆：5 分鐘後有事（什麼事？）',
  '電量剩 5%',
  '天氣：午後有雷陣雨，記得帶傘',
  '你追蹤的頻道上傳了新影片',
  '外送：你的餐點已送達……？',
  '系統更新：要現在重新啟動嗎？',
  '相簿：「三年前的今天」',
]
