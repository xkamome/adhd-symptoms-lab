import type { Component } from 'svelte'
import Hyperfocus from './hyperfocus/Hyperfocus.svelte'
import OutOfSight from './outofsight/OutOfSight.svelte'
import Urgency from './urgency/Urgency.svelte'
import LostKeys from './lostkeys/LostKeys.svelte'

export type MechanicStatus = 'polished' | 'experimental'

export interface Mechanic {
  id: string
  title: string
  symptom: string
  blurb: string
  status: MechanicStatus // polished：打磨得比較完整；experimental：先測試這個症狀好不好玩
  component: Component
}

// 之後要加新的 ADHD 症狀機制，就在這裡多一項（各自一個資料夾模組）。
export const MECHANICS: Mechanic[] = [
  {
    id: 'hyperfocus',
    title: '超專注隧道',
    symptom: 'Hyperfocus',
    blurb: '盯著一點，世界縮成一條清晰的隧道——你看得無比仔細，卻錯過了周邊的一切。',
    status: 'polished',
    component: Hyperfocus,
  },
  {
    id: 'outofsight',
    title: '不在眼前就消失',
    symptom: 'Working memory',
    blurb: '你沒在照顧的事會枯萎、從畫面消失。輪流澆水四盆植物，但你記得住有哪些嗎？',
    status: 'experimental',
    component: OutOfSight,
  },
  {
    id: 'urgency',
    title: '最後一秒引擎',
    symptom: 'Urgency-based attention',
    blurb: '平常按什麼都慢半拍；直到剩最後 5 秒，腦子才突然變得靈敏無比。',
    status: 'experimental',
    component: Urgency,
  },
  {
    id: 'lostkeys',
    title: '鑰匙放哪了',
    symptom: 'Object permanence / working memory',
    blurb: '記住鑰匙放在哪，被打斷一下回頭——家具悄悄重排，你的自信不再可信。',
    status: 'experimental',
    component: LostKeys,
  },
]
