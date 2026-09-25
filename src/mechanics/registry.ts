import type { Component } from 'svelte'
import Hyperfocus from './hyperfocus/Hyperfocus.svelte'
import Thoughts from './thoughts/Thoughts.svelte'
import Rush from './rush/Rush.svelte'

export type MechanicStatus = 'polished' | 'experimental'

export interface Mechanic {
  id: string
  title: string
  symptom: string
  blurb: string
  task: string // 首頁卡片上的一句「你要做的事」
  emoji: string
  status: MechanicStatus // polished：打磨得比較完整；experimental：先測試這個症狀好不好玩
  component: Component
}

// 之後要加新的 ADHD 症狀機制，就在這裡多一項（各自一個資料夾模組）。
// 設計原則：任務簡單到誰都會，難的是腦袋不配合（參考《ダレカレ》）。
export const MECHANICS: Mechanic[] = [
  {
    id: 'hyperfocus',
    title: '超專注隧道',
    symptom: 'Hyperfocus',
    blurb: '畫面一塊塊輪流變成馬賽克、毛玻璃、萬花筒——只有你盯住的那一點是清楚的，周邊一閃而過的事全被你錯過。',
    task: '在名畫裡找出 3 隻貓',
    emoji: '🐱',
    status: 'polished',
    component: Hyperfocus,
  },
  {
    id: 'thoughts',
    title: '念頭插隊',
    symptom: 'Distractibility',
    blurb: '你很認真在聽。但主管每講完一句就消失，腦中的念頭還一直浮上來插隊，趕走一個又牽出下一個。',
    task: '聽主管交代一次，然後回答問題',
    emoji: '💭',
    status: 'experimental',
    component: Thoughts,
  },
  {
    id: 'rush',
    title: '急迫引擎',
    symptom: 'Urgency-based motivation',
    blurb: '同一雙手，平常又慢又飄、拿著東西還會鬆手；直到最後幾秒，才突然什麼都做得到。',
    task: '客人到之前把房間收好',
    emoji: '🔔',
    status: 'experimental',
    component: Rush,
  },
]
