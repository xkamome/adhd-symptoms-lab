import proverbs from '../../assets/painting.jpg'
import children from '../../assets/children-games.jpg'
import garden from '../../assets/garden.jpg'

export interface Painting { id: string; url: string; title: string }

// 三幅超繁忙的公共版權名畫，每局隨機選一幅。
export const PAINTINGS: Painting[] = [
  { id: 'proverbs', url: proverbs, title: '尼德蘭箴言 · 布勒哲爾' },
  { id: 'children', url: children, title: '兒童遊戲 · 布勒哲爾' },
  { id: 'garden', url: garden, title: '人間樂園 · 波希' },
]

export const TASK = '把游標停住對焦，找出藏在這幅名畫裡的 3 隻貓。'

const CAT_EMOJIS = ['🐱', '🐈', '🐈‍⬛']

export interface CatTarget { id: string; tx: number; ty: number; emoji: string }

export function randomPainting(): Painting {
  return PAINTINGS[Math.floor(Math.random() * PAINTINGS.length)]
}

// 每局隨機 3 隻貓，彼此保持距離、避開最邊緣。
export function randomCats(n = 3): CatTarget[] {
  const cats: CatTarget[] = []
  let tries = 0
  while (cats.length < n && tries < 800) {
    tries++
    const tx = 0.12 + Math.random() * 0.76
    const ty = 0.14 + Math.random() * 0.72
    if (cats.some((c) => Math.hypot(c.tx - tx, c.ty - ty) < 0.16)) continue
    cats.push({ id: `cat${cats.length}`, tx, ty, emoji: CAT_EMOJIS[cats.length % CAT_EMOJIS.length] })
  }
  return cats
}
