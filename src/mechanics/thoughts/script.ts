// 主管交代的內容：每局從欄位池隨機組出一段話，考題與錯誤選項也從同一組池子挑，
// 所以沒辦法靠「上次考過」或「一眼看出哪個是亂編的」作答。

const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
const shuffle = <T>(a: readonly T[]) => {
  const b = a.slice()
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] }
  return b
}

const DAYS = ['週一', '週二', '週三', '週四', '週五'] as const
const TIMES = ['早上十點', '中午十二點', '下午三點', '下午五點'] as const
const REPORTS = ['第三季的業績報表', '客戶滿意度調查', '明年的預算表', '新產品企劃書', '展場活動的成果報告'] as const
const DEPTS = ['業務部', '行銷部', '財務部', '人資部'] as const
const NAMES = ['林經理', '陳經理', '王協理', '張主任'] as const
const CCS = ['財務的小陳', '行銷的阿美', '業務的小吳', '人資的佩佩'] as const
const FORMATS = ['PDF', 'Excel', 'Word', '簡報檔'] as const
const UNITS = ['新台幣千元', '新台幣萬元', '新台幣元', '美元'] as const
const ASKS = ['阿哲', '小芳', '志明', '雅婷'] as const

export interface Question { q: string; options: string[]; answer: string }
export interface Briefing { lines: string[]; quiz: Question[] }

/** 正解 + 3 個從同一池子挑的干擾選項，打亂順序 */
function mcq(q: string, answer: string, pool: readonly string[]): Question {
  const wrong = shuffle(pool.filter((x) => x !== answer)).slice(0, 3)
  return { q, answer, options: shuffle([answer, ...wrong]) }
}

export function makeBriefing(quizCount = 5): Briefing {
  const day = pick(DAYS), time = pick(TIMES)
  const report = pick(REPORTS)
  const dept = pick(DEPTS), name = pick(NAMES)
  const cc = pick(CCS)
  const format = pick(FORMATS)
  const notFormat = pick(FORMATS.filter((f) => f !== format))
  const unit = pick(UNITS)
  const ask = pick(ASKS)

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
  const deadline = `${day}${time}`
  const deadlinePool = [...DAYS.map((d) => `${d}${time}`), ...TIMES.map((t) => `${day}${t}`)]
  const recipients = DEPTS.flatMap((d) => NAMES.map((n) => `${d}的${n}`))

  const all: Question[] = [
    mcq('截止時間是？', deadline, deadlinePool),
    mcq('要交的是什麼？', report, REPORTS),
    mcq('要寄給誰？', `${dept}的${name}`, recipients),
    mcq('副本給誰？', cc, CCS),
    mcq('檔案格式？', format, FORMATS),
    mcq('數字單位？', unit, UNITS),
    mcq('有問題先問誰？', ask, [...ASKS, name]),
  ]
  return { lines, quiz: shuffle(all).slice(0, quizCount) }
}

export const THOUGHTS: [string, string][] = [
  ['午餐要吃什麼', '說到午餐……那家拉麵是不是關了？'],
  ['剛剛那封信回了沒？', '糟了，好像還沒回'],
  ['窗外那是鴿子嗎', '鴿子的脖子為什麼會發亮'],
  ['我瓦斯有關嗎', '應該有吧……有嗎？'],
  ['他今天換髮型了？', '我是不是也該剪頭髮了'],
  ['週末要幹嘛', '上次說要去的那個展覽'],
  ['要記得買牙膏', '還有衛生紙好像也沒了'],
  ['那首歌叫什麼……', '♪ 噠啦噠～啦……'],
  ['上次開會是不是講錯話', '他那時候的表情是什麼意思'],
  ['手機好像震了一下', '是不是媽媽傳訊息'],
  ['冷氣好冷', '外套放在哪了'],
  ['等等要先做哪件事', '清單寫在哪張便利貼上'],
]
