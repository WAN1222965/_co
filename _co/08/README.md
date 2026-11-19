# Project 08 - VM Translator II：程式流程與函式呼叫

本資料夾收錄 Nand2Tetris Project 8 的測試程式，並搭配上一章完成的 VM Translator 擴充版，將 VM 指令轉譯成 Hack 組合語言。

> 本文件記錄的是 **Nand2Tetris Project 8**，不同於 `_co/README.md` 的 EDA 軟體報告。
>
> 實作語言：**JavaScript / Node.js**（CommonJS），原始碼位於 `../VMTranslator/`。

第七章完成了算術邏輯與記憶體區段存取；第八章在此基礎上再加入兩類能力：

1. **程式流程（Program Flow）**：`label`、`goto`、`if-goto`。
2. **函式呼叫（Function Calls）**：`function`、`call`、`return`，以及多檔案程式的 **Bootstrap code**。

---

## 目錄結構

```text
08/
├── README.md
├── ProgramFlow/
│   ├── BasicLoop/
│   │   ├── BasicLoop.vm        # VM 原始程式
│   │   ├── BasicLoop.asm       # 轉譯後的 Hack 組合語言
│   │   ├── BasicLoop.tst       # CPU Emulator 測試腳本
│   │   ├── BasicLoopVME.tst    # VM Emulator 測試腳本
│   │   ├── BasicLoop.cmp       # 預期輸出
│   │   └── BasicLoop.out       # 實際執行輸出
│   └── FibonacciSeries/
│       ├── FibonacciSeries.vm
│       ├── FibonacciSeries.asm
│       ├── FibonacciSeries.tst
│       ├── FibonacciSeriesVME.tst
│       ├── FibonacciSeries.cmp
│       └── FibonacciSeries.out
└── FunctionCalls/
    ├── SimpleFunction/
    │   ├── SimpleFunction.vm
    │   ├── SimpleFunction.asm
    │   ├── SimpleFunction.tst
    │   ├── SimpleFunctionVME.tst
    │   ├── SimpleFunction.cmp
    │   └── SimpleFunction.out
    ├── FibonacciElement/
    │   ├── Sys.vm              # Sys.init：程式進入點
    │   ├── Main.vm             # Main.fibonacci：遞迴函式
    │   ├── FibonacciElement.asm
    │   ├── FibonacciElement.tst
    │   ├── FibonacciElementVME.tst
    │   ├── FibonacciElement.cmp
    │   └── FibonacciElement.out
    ├── NestedCall/
    │   ├── Sys.vm              # Sys.init、Sys.main、Sys.add12
    │   ├── NestedCall.asm
    │   ├── NestedCall.tst
    │   ├── NestedCallVME.tst
    │   ├── NestedCall.cmp
    │   ├── NestedCall.out
    │   ├── NestedCall.html             # 官方測試說明
    │   └── NestedCallStack.html        # 逐步堆疊框架圖
    └── StaticsTest/
        ├── Sys.vm
        ├── Class1.vm
        ├── Class2.vm
        ├── StaticsTest.asm
        ├── StaticsTest.tst
        ├── StaticsTestVME.tst
        ├── StaticsTest.cmp
        └── StaticsTest.out
```

Translator 原始碼：

```text
VMTranslator/
├── VMTranslator.js   # CLI 入口：讀取檔案 / 資料夾並組裝流程
├── Parser.js         # 移除註解、解析指令類型與參數
└── CodeWriter.js     # 將 VM 指令轉換為 Hack asm
```

`VMTranslator_Project7/` 是第七章的舊版，只支援算術與 push/pop；第八章請使用 `VMTranslator/`。

---

## 程式架構

| 模組 | 職責 | 關鍵方法 |
| --- | --- | --- |
| `VMTranslator.js` | 判斷輸入是單檔或資料夾，建立輸出檔，逐行分派指令 | `process.argv`、`setFileName()`、`close()` |
| `Parser.js` | 清除 `//` 註解與空白行，解析 mnemonic 與參數 | `hasMoreLines()`、`advance()`、`commandType()`、`arg1()`、`arg2()` |
| `CodeWriter.js` | 保存目前檔案 / 函式名稱，產生唯一標籤與 asm 程式碼 | `writeInit()`、`writeLabel()`、`writeGoto()`、`writeIf()`、`writeFunction()`、`writeCall()`、`writeReturn()` |

`CodeWriter` 不會每行直接寫檔，而是先累積到 `this.lines`，最後在 `close()` 一次寫入 `.asm`。這樣可以安全地跨多個 `.vm` 檔案共用同一個輸出串流，也方便在檔案前面插入 Bootstrap code。

---

## VM 指令集

### 第七章既有指令

| 類型 | 範例 | 說明 |
| --- | --- | --- |
| 算術邏輯 | `add`、`sub`、`neg`、`eq`、`gt`、`lt`、`and`、`or`、`not` | 以堆疊頂端作為運算元 |
| 記憶體存取 | `push constant 7`、`pop local 2` | 支援 constant、local、argument、this、that、temp、pointer、static |

### 第八章新增：程式流程

| 指令 | 範例 | 轉譯結果 |
| --- | --- | --- |
| `label` | `label LOOP` | `(currentFunction$LOOP)` |
| `goto` | `goto END` | `@currentFunction$END` + `0;JMP` |
| `if-goto` | `if-goto LOOP` | pop 到 D，再 `D;JNE` |

標籤會加上 `currentFunction$` 前綴，避免不同函式使用相同標籤名稱時發生衝突。若直接轉譯單一、不含 `function` 的 `.vm` 檔，`currentFunction` 預設為 `null`，因此會看到 `null$LOOP` 這類標籤；功能正確，只是名稱較不直觀。

### 第八章新增：函式呼叫

| 指令 | 範例 | 說明 |
| --- | --- | --- |
| `function` | `function Main.fibonacci 2` | 建立進入點標籤，並將 2 個 local 初始化為 0 |
| `call` | `call Sys.add12 1` | 保存呼叫端狀態、設定新堆疊框架、跳到目標函式 |
| `return` | `return` | 放回回傳值、還原呼叫端狀態、跳回返回位址 |

---

## 函式呼叫協定

### 堆疊框架

`call f n` 完成後，記憶體配置如下：

```text
ARG ->  argument 0
        ...
        argument n-1
        return address
        saved LCL
        saved ARG
        saved THIS
        saved THAT
LCL ->  local 0
        ...
SP  ->  下一個空位
```

### `call functionName numArgs`

`CodeWriter.writeCall()` 依序產生五個動作：

1. 產生唯一返回標籤 `functionName$ret.<n>`，並 push 返回位址。
2. 依序 push `LCL`、`ARG`、`THIS`、`THAT`。
3. `ARG = SP - 5 - numArgs`。
4. `LCL = SP`。
5. `@functionName` + `0;JMP`，接著宣告返回標籤。

返回標籤中的 `<n>` 由 `labelCounter` 遞增產生，因此同一個函式被呼叫多次也不會產生重複標籤。

### `return`

`CodeWriter.writeReturn()` 依序產生：

1. `FRAME = LCL`，存到 `R13`。
2. `RET = *(FRAME - 5)`，存到 `R14`。
3. `*ARG = pop()`，把回傳值放到呼叫端可見的位置。
4. `SP = ARG + 1`。
5. 依序由框架還原 `THAT`、`THIS`、`ARG`、`LCL`。
6. 跳到 `R14` 所記錄的返回位址。

**關鍵細節**：必須先把返回位址存進 `R14`，再執行 `*ARG = pop()`。當 `numArgs = 0` 時，`ARG` 指向的位置正好就是返回位址；若順序顛倒，返回位址會被回傳值覆蓋，程式就無法回到呼叫端。

---

## Bootstrap code

撰寫 `writeInit()` 時會產生：

```asm
// Bootstrap code
@256
D=A
@SP
M=D
// call Sys.init 0
...
```

也就是：

1. `SP = 256`。
2. 以 `call Sys.init 0` 進入程式。

目前 `VMTranslator.js` 的設計是：**只有輸入為資料夾且資料夾內有多於一個 `.vm` 檔時才寫入 Bootstrap**。所以：

| 測試 | Bootstrap | 原因 |
| --- | --- | --- |
| `FibonacciElement` | 有 | `Sys.vm` + `Main.vm` |
| `StaticsTest` | 有 | `Sys.vm` + `Class1.vm` + `Class2.vm` |
| `BasicLoop`、`FibonacciSeries` | 無 | 單一 `.vm`，測試腳本自行初始化 |
| `SimpleFunction`、`NestedCall` | 無 | 測試腳本自行建立堆疊與呼叫框架 |

這是為了配合官方 `.tst` 的出發狀態。若是要執行完整的 Jack 編譯成果，通常會改成「只要檔案中含有 `Sys.init` 就產生 Bootstrap」，會更接近正式規格。

---

## Hack RAM 對照表

| VM 記憶體區段 | Hack RAM 對應位置 | 轉譯方式 |
| --- | --- | --- |
| Stack（SP） | `RAM[0]` | `@SP`，指向堆疊頂端的下一個空位 |
| local（LCL） | `RAM[1]` 指向的基底 | `RAM[LCL] + index` |
| argument（ARG） | `RAM[2]` 指向的基底 | `RAM[ARG] + index` |
| this（THIS） | `RAM[3]` 指向的基底 | `RAM[THIS] + index` |
| that（THAT） | `RAM[4]` 指向的基底 | `RAM[THAT] + index` |
| temp | `RAM[5]`～`RAM[12]` | `5 + index` |
| pointer | `RAM[3]`、`RAM[4]` | pointer 0 → THIS，pointer 1 → THAT |
| static | `RAM[16]`～`RAM[255]` | `@檔名.index`，由組譯器配置符號 |

多檔案 static 是本章另一個重點。`Class1.vm` 的 `static 0` 會轉成 `@Class1.0`，`Class2.vm` 的 `static 0` 會轉成 `@Class2.0`，因此不同檔案的靜態變數不會互相覆蓋。

---

## 使用方式

需要安裝 Node.js。以下指令由 `_co/08/` 目錄執行。

轉譯單一 `.vm`：

```bash
node ../VMTranslator/VMTranslator.js ProgramFlow/BasicLoop/BasicLoop.vm
node ../VMTranslator/VMTranslator.js ProgramFlow/FibonacciSeries/FibonacciSeries.vm
node ../VMTranslator/VMTranslator.js FunctionCalls/SimpleFunction/SimpleFunction.vm
```

轉譯整個資料夾（多 `.vm` 會自動加入 Bootstrap，輸出為 `資料夾名.asm`）：

```bash
node ../VMTranslator/VMTranslator.js FunctionCalls/FibonacciElement
node ../VMTranslator/VMTranslator.js FunctionCalls/StaticsTest
```

輸出檔會寫在輸入檔或輸入資料夾內，例如 `NestedCall.vm` → `NestedCall.asm`，`FibonacciElement/` → `FibonacciElement.asm`。

### 驗證流程

1. 選擇性：雙擊 `nand2tetris/tools/bin/VMEmulator.bat`，載入 `XxxVME.tst`，觀察 VM 層級的堆疊與 RAM 變化。
2. 執行上面的 `node` 指令產生 `.asm`。
3. 雙擊 `nand2tetris/tools/bin/CPUEmulator.bat`，載入 `Xxx.tst`。
4. 執行 Run；若顯示 `End of script - Comparison ended successfully`，代表 `.out` 與 `.cmp` 完全一致。

---

## 測試結果

| 測試 | 主要驗證項目 | 預期結果 | 結果 |
| --- | --- | --- | --- |
| `BasicLoop` | `label`、`if-goto` 迴圈 | `SP=257`、`RAM[256]=6` | 通過 |
| `FibonacciSeries` | `goto`、`if-goto`、`that`、`pointer 1` | `RAM[3000..3005] = 0, 1, 1, 2, 3, 5` | 通過 |
| `SimpleFunction` | local 初始化、`return` 還原指標 | `SP=311`、`LCL=305`、`ARG=300`、`THIS=3010`、`THAT=4010`、`RAM[310]=1196` | 通過 |
| `FibonacciElement` | 多檔案、Bootstrap、遞迴呼叫 | `RAM[0]=262`、`RAM[261]=3` | 通過 |
| `NestedCall` | 巢狀呼叫、無參數呼叫、THIS/THAT 還原 | `RAM[0..6] = 261, 261, 256, 4000, 5000, 135, 246` | 通過 |
| `StaticsTest` | 不同 `.vm` 的 static 隔離 | `RAM[0]=263`、`RAM[261]=-2`、`RAM[262]=8` | 通過 |

六組 `.out` 都已與對應 `.cmp` 逐位元組比對一致。

> `NestedCall/Sys.vm` 的註解提到 local 總和應為 456，但 `.cmp`、`.out` 與 `NestedCallStack.html` 都是 246；測試驗證以 246 為準。

---

## 學習心得

### 1. 從「操作堆疊」進步到「管理呼叫框架」

第七章只要能把值放到堆疊頂端再運算即可；第八章必須同時管理 `SP`、`LCL`、`ARG`、`THIS`、`THAT` 五個指標。最難的地方不是撰寫 asm，而是建立正確的心智模型：**一次函式呼叫，就是在堆疊上切出一塊有固定格式的框架**。

### 2. `call` 與 `return` 是一對對稱操作

`call` 負責保存舊狀態、建立新框架；`return` 則以 `LCL` 當成框架起點，反向還原所有指標。只要把框架圖畫出來，程式碼幾乎就是圖的逐行翻譯；反之，若沒有畫圖，很容易在 `FRAME - 5`、`*ARG = pop()` 這些地方出錯。

### 3. 返回位址必須先保存

`numArgs = 0` 是一個很容易忽略的邊界情況。因為 `ARG` 與返回位址只相差五個字組，而 `*ARG = pop()` 會寫入 `ARG` 指向的位置；若先寫回傳值再讀返回位址，讀到的就會是錯誤值。這個錯誤在簡單測試可能不明顯，但遇到無參數呼叫就會整個程式失控。

### 4. 標籤唯一性是 Translator 的基本責任

比較運算的 `TRUE_n` / `END_n`，以及函式呼叫的 `functionName$ret.n`，都不能重複。Translator 必須自己維護計數器，不能假設原始碼不會重複使用同一個 label。`functionName$label` 的前綴設計也讓不同函式擁有獨立的命名空間。

### 5. Bootstrap 必須配合出發狀態

同一份 VM 程式，如果由 VM Emulator 直接執行、由 CPU Emulator 搭配 `.tst` 執行，或由完整 Jack 程式啟動，出發時的 RAM 狀態並不相同。因此 Bootstrap 不是「固定一定要寫在每一行前面」，而是要配合執行環境。這提醒我：轉譯器不只是語法轉換，還必須理解執行環境的約定。

### 6. 除錯要同時看三層

遇到錯誤時，有效順序是：

1. 先看 `.vm` 確認呼叫順序與參數數量。
2. 再看 `.asm` 的註解，找出對應的轉譯片段。
3. 最後用 CPU Emulator 逐步執行，觀察 `SP`、`ARG`、`LCL` 與返回位址何時偏離預期。

只盯著 `.asm` 很難發現問題；把 `.vm`、`.asm`、`.cmp` 三層對照起來，才能真正定位錯誤。

### 7. 多檔案 static 是命名空間問題

`static` 看似只是 RAM[16] 開始的變數，但多個 `.vm` 檔案同時編譯時，若 translator 只產生 `@0`、`@1`，不同類別的變數就會互相干擾。用 `@檔名.index` 讓每個檔案擁有獨立前綴，是本專案中一個非常具體的「命名空間」實作。

### 8. 從抽象化體會 Compiler 的價值

寫完第八章後，再看 `NestedCall` 與 `FibonacciElement`，會發現高階語言中的函式、區域變數、遞迴、呼叫堆疊，全都被攤平成一份只有 `@`、`M=D` 與 `0;JMP` 的 `.asm`。這讓我更具體理解 Compiler / Translator 的價值：它不是單純「換語法」，而是把一套高階語意，映射到另一套低階機制，同時保證行為等價。

---

## 已知限制與可改進事項

- `Parser.commandType()` 對未知 mnemonic 會退回 `C_ARITHMETIC`，沒有明確錯誤訊息。
- 資料夾模式只讀取該層 `.vm`，不遞迴子資料夾，也沒有排序檔名。
- Bootstrap 目前以 `.vm` 數量判斷，而不是偵測 `Sys.init`。
- 單檔程式流程測試的 label 會出現 `null$` 前綴。
- 轉譯器會直接覆蓋同名 `.asm`，沒有備份機制。
- 目前靠 `.tst` / `.cmp` 人工驗證，尚無自動化測試腳本。

---

## 參考資料

- Nand2Tetris 官方網站：<https://www.nand2tetris.org/>
- *The Elements of Computing Systems*，Noam Nisan & Shimon Schocken
- `../VMTranslator/`：本專案使用的 JavaScript VM Translator
- `../VMTranslator_Project7/`：第七章舊版，供對照
- 各測試資料夾內的 `.vm`、`.tst`、`.cmp`、`.out`
- `FunctionCalls/NestedCall/NestedCallStack.html`：堆疊框架逐步圖
