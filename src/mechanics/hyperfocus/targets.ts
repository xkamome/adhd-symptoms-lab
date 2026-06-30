import paintingUrl from '../../assets/painting.jpg'

export { paintingUrl }

export interface Target {
  id: string
  tx: number // 相對 X (0..1)
  ty: number // 相對 Y (0..1)
  emoji: string
}

export const TASK = '把游標停住、慢慢對焦，找出藏在這幅名畫裡的 3 隻貓。'

// 貓由我們疊在名畫上（會跟著一起模糊），對焦到才看得清。
export const TARGETS: Target[] = [
  { id: 'cat1', tx: 0.20, ty: 0.62, emoji: '🐱' },
  { id: 'cat2', tx: 0.60, ty: 0.28, emoji: '🐈' },
  { id: 'cat3', tx: 0.82, ty: 0.72, emoji: '🐈‍⬛' },
]
