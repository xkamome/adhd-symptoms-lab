import type { Component } from 'svelte'
import Hyperfocus from './hyperfocus/Hyperfocus.svelte'
import OutOfSight from './outofsight/OutOfSight.svelte'

export interface Mechanic {
  id: string
  title: string
  symptom: string
  blurb: string
  component: Component
}

// 之後要加新的 ADHD 症狀機制，就在這裡多一項（各自一個資料夾模組）。
export const MECHANICS: Mechanic[] = [
  {
    id: 'hyperfocus',
    title: '超專注隧道',
    symptom: 'Hyperfocus',
    blurb: '盯著一點，世界縮成一條清晰的隧道——你看得無比仔細，卻錯過了周邊的一切。',
    component: Hyperfocus,
  },
  {
    id: 'outofsight',
    title: '不在眼前就消失',
    symptom: 'Working memory',
    blurb: '你沒在照顧的事會枯萎、從畫面消失。輪流澆水四盆植物，但你記得住有哪些嗎？',
    component: OutOfSight,
  },
]
