# Project 06 - Assembler

本資料夾收錄 nand2tetris Project 6 的組譯器練習。除了官方提供的 `.asm` 與對應的 `.hack` 之外，另外用 JavaScript 實作了一個組譯器 `assembler.js`，用來把 `.asm` 轉成 `.hack`，並與原始 `.hack` 做逐行比對。

## 目錄結構

```
06/
├── add/
│   ├── Add.asm         # 官方組合語言
│   ├── Add.hack        # 官方組譯結果（asm → hack）
│   ├── Add1.hack       # 由 assembler.js 產生的結果（js → hack）
│   └── assembler.js    # JavaScript 組譯器
├── max/
│   ├── Max.asm         # 含符號版本
│   ├── MaxL.asm        # 無符號版本
│   ├── Max.hack        # 官方結果
│   ├── MaxL.hack       # 官方結果（無符號版）
│   └── Max1.hack       # JS 組譯結果
├── rect/
│   ├── Rect.asm
│   ├── RectL.asm
│   ├── Rect.hack
│   ├── RectL.hack
│   └── Rect1.hack
└── pong/
    ├── Pong.asm        # 由 Jack → VM → asm 產生的完整程式
    ├── PongL.asm       # 無符號版本
    ├── Pong.hack       # 官方結果
    ├── PongL.hack      # 官方結果（無符號版）
    └── Pong1.hack      # JS 組譯結果
```

## Hack 機器碼格式

Hack 的每一行指令都是 16 bits：

| 類型 | 格式 | 說明 |
| --- | --- | --- |
| A-instruction | `0` + 15 bits 位址 | `@value`，把 value 載入 A 暫存器 |
| C-instruction | `111` + `comp`(7) + `dest`(3) + `jump`(3) | 運算、指定目的、條件跳躍 |

例如 `M=D` 會編譯成 `1110001100001000`：

- `111`：C-instruction 固定前綴
- `000110`：comp = `D`
- `000`：dest 中的 A 為 0
- `100`：dest = `M`（第 3 bit 為 1）
- `000`：jump = null

## asm 轉 hack（標準流程）

這是課本與官方工具（Assembler）所描述的流程，重點在兩階段掃描：

1. **去除註解與空白**：刪掉 `//` 之後的內容與空行。
2. **第一階段（符號收集）**：遇到 `(LABEL)` 就記錄它對應的 ROM 位址（不佔指令行），其餘指令行號 `+1`。
3. **第二階段（產生機器碼）**：
   - A-instruction：數字直接轉二進位；符號查符號表，找不到就配置 RAM 位址（從 16 開始）。
   - C-instruction：拆解 `dest=comp;jump`，查表組出 16 bits。

`Max.asm` 的例子：

```
@R0        -> 0000000000000000   （R0 = 0）
D=M        -> 1111110000010000
D=D-M      -> 1111010011010000
@ITSR0     -> 0000000000001010   （標籤位址 10）
D;JGT      -> 1110001100000001
```

## js 轉 hack（assembler.js）

`add/assembler.js` 用 Node.js 實作同一套邏輯，程式結構如下：

- `COMP_TABLE` / `DEST_TABLE` / `JUMP_TABLE`：C-instruction 的三張查表。
- `createSymbolTable()`：預先放入 `SP`、`LCL`、`ARG`、`THIS`、`THAT`、`SCREEN`、`KBD` 與 `R0`～`R15`。
- `cleanLines()`：移除 `//` 註解與空行。
- `assemble()`：
  1. 第一階段掃描標籤，建立符號表。
  2. 第二階段逐行翻譯，變數從 RAM[16] 開始配位。
  3. 輸出檔名為原檔名加 `1`，例如 `Add.asm` → `Add1.hack`。

執行方式：

```bash
node add/assembler.js add/Add.asm
node add/assembler.js max/Max.asm
node add/assembler.js rect/Rect.asm
node add/assembler.js pong/Pong.asm
```

## 兩種方式對比

| 比較項目 | asm 轉 hack（官方） | js 轉 hack（assembler.js） |
| --- | --- | --- |
| 輸入 | `.asm` | `.asm` |
| 輸出 | `.hack` | `*1.hack`（同目錄） |
| 執行者 | 官方 Assembler 工具 | Node.js 腳本 |
| 符號處理 | 兩階段掃描 | 兩階段掃描（相同做法） |
| 變數配置 | RAM[16] 起 | RAM[16] 起（相同） |
| 錯誤處理 | 較完整 | 僅基本檢查（查表失敗會產生 `undefined`） |
| 可讀性 | 黑箱工具 | 原始碼公開，可逐步除錯 |
| 適用對象 | 直接驗證結果 | 理解組譯原理 |

以 `Add.asm` 為例，兩者輸出完全一致：

| 指令 | asm → hack | js → hack |
| --- | --- | --- |
| `@2` | `0000000000000010` | `0000000000000010` |
| `D=A` | `1110110000010000` | `1110110000010000` |
| `@3` | `0000000000000011` | `0000000000000011` |
| `D=D+A` | `1110000010010000` | `1110000010010000` |
| `@0` | `0000000000000000` | `0000000000000000` |
| `M=D` | `1110001100001000` | `1110001100001000` |

## 驗證結果

使用 `Compare-Object` 逐行比對官方 `.hack` 與 JS 產生的 `*1.hack`：

| 程式 | 指令行數 | 是否完全相同 |
| --- | --- | --- |
| Add | 6 | ✅ 相同 |
| Max | 16 | ✅ 相同 |
| MaxL（無符號版） vs Max | 16 | ✅ 相同 |
| Rect | 25 | ✅ 相同 |
| RectL（無符號版） vs Rect | 25 | ✅ 相同 |
| Pong | 27,483 | ✅ 相同 |
| PongL（無符號版） vs Pong | 27,483 | ✅ 相同 |

另外，含符號版本（`Max.asm`、`Rect.asm`、`Pong.asm`）與無符號版本（`MaxL.asm`、`RectL.asm`、`PongL.asm`）產生的機器碼也完全相同，表示符號解析與標籤位址計算正確。

## 結論

- **asm 轉 hack** 是官方工具的黑箱流程，適合快速得到正確答案。
- **js 轉 hack** 則把流程攤開，能清楚看到符號表、兩階段掃描與三張指令查表的運作。
- 在本專案中，兩者對 Add、Max、Rect、Pong（含無符號版本）的輸出**完全一致**，證明 `assembler.js` 的實作符合 Hack 組譯器規格。
