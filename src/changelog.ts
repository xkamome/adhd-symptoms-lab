export interface ChangelogEntry { date: string; items: string[] }

// 新的更新加在最前面（陣列開頭）。日期新到舊。
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-07-03',
    items: [
      '不在眼前就消失：支援手機——未完成的盆栽有最低可見度、觸控感應半徑加大、版面不再被返回鍵擋住',
    ],
  },
  {
    date: '2026-07-02',
    items: [
      '不在眼前就消失：完成後留下半透明殘影繼續飄，真正完成的紀錄改記在 HUD；新增關卡、干擾通知、植物個性',
      '超專注隧道：手機可拖曳平移視野、新增「看答案」鍵',
      '新機制上線（測試中）：最後一秒引擎、鑰匙放哪了',
    ],
  },
]
