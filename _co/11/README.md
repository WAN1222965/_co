# Project 11 - Jack Compiler

本資料夾收錄 Nand2Tetris Project 11 的 Jack 測試程式（`.jack`）與由編譯器產出的 VM 程式（`.vm`）。編譯器本體不在本資料夾，而是共用上一層的 `../JackCompiler11/`：它以 JavaScript / Node.js 實作，把 Jack 高階語言直接編譯成 VM 中介碼，不再輸出 XML。

> 本文件記錄的是 **Nand2Tetris Project 11**，不同於 `_co/README.md` 的 EDA 軟體報告。
>
> 實作語言：**JavaScript / Node.js**（CommonJS），原始碼位於 `../JackCompiler11/`。
>
> 本資料夾的 `.vm` 已用該編譯器在暫存副本中重新產生並逐行比對，**11 個檔案全部一致**（詳見「驗證結果」）。

---

## 一、專案定位：從 Jack 到 VM

Nand2Tetris 的軟體層流程是：

```
Jack 原始碼 (.jack)
   │  JackTokenizer        切割 token
   ▼
CompilationEngine + SymbolTable   解析語法、管理變數、生成程式碼
   │  VMWriter             輸出 VM 指令
   ▼
VM 中介碼 (.vm)
   │  VMTranslator (Project 7/8)
   ▼
Hack 組合語言 (.asm)
   │  Assembler (Project 6)
   ▼
Hack 機器碼 (.hack) → CPU Emulator 執行
```

Project 10 的 `JackAnalyzer10` 只做到「剖析並輸出 XML 語法樹」，用來檢查 tokenizer 與 grammar 是否正確；Project 11 的 `JackCompiler11` 沿用相同的 tokenizer 與遞迴下降剖析架構，但把輸出從 XML 換成真正可執行的 VM 指令，並新增 `SymbolTable` 與 `VMWriter` 兩個模組。

| 比較 | `../JackAnalyzer10/`（Project 10） | `../JackCompiler11/`（Project 11） |
| --- | --- | --- |
| 輸出 | `.xml` 語法樹 | `.vm` 中介碼 |
| 核心模組 | JackTokenizer、CompilationEngine | JackTokenizer、CompilationEngine、SymbolTable、VMWriter |
| _symbol table_ | 無 | 有，記錄 static / field / arg / var 與索引 |
| 遇到 `let x = ...` | 印出 `<keyword> let </keyword>` 等.tag | 產生 `pop local 2` 等指派指令 |
| 遇到 `if (...)` | 輸出 XML 节点 | 產生 `not`、`if-goto`、標籤與 `goto` |
| 目的 | 驗證語法結構 | 產生可翻譯成機器碼的程式 |

---

## 二、目錄結構

本資料夾（`11/`）：

```text
11/
├── README.md
├── Average/          # 讀取整數、計算平均並印出
│   ├── Main.jack
│   └── Main.vm
├── ComplexArrays/    # 多層陣列索引、巢狀函式呼叫與乘法
│   ├── Main.jack
│   └── Main.vm
├── ConvertToBin/     # 把十進位整數轉成二進位字串
│   ├── Main.jack
│   └── Main.vm
├── Pong/             # 完整 Pong 遊戲：球、球拍、遊戲迴圈
│   ├── Ball.jack / Ball.vm
│   ├── Bat.jack  / Bat.vm
│   ├── Main.jack / Main.vm
│   └── PongGame.jack / PongGame.vm
├── Seven/            # 計算 1 + (2 * 3) 並印在螢幕左上角
│   ├── Main.jack
│   └── Main.vm
└── Square/           # 可用鍵盤控制的正方形，含 constructor / method
    ├── Main.jack / Main.vm
    ├── Square.jack / Square.vm
    └── SquareGame.jack / SquareGame.vm
```

編譯器原始碼（`../JackCompiler11/`）：

```text
JackCompiler11/
├── JackCompiler.js       # CLI 入口：讀取單檔或資料夾，逐一編譯 .jack
├── JackTokenizer.js      # 移除註解、切割五種 token
├── CompilationEngine.js  # 遞迴下降剖析器，直接呼叫 VMWriter 生成程式碼
├── SymbolTable.js        # 兩層作用域的變數表與索引分配
└── VMWriter.js           # 累積 VM 指令並一次寫入 .vm
```

六個測試程式同時涵蓋了不同難度：

| 程式 | 主要考驗 |
| --- | --- |
| `Seven` | 常數、運算子優先順序、`Math.multiply`、靜態函式呼叫 |
| `Average` | `Array.new`、字串常數、while 迴圈、除法和 `Keyboard.readInt` |
| `ConvertToBin` | 字串處理、迴圈與陣列寫入 |
| `ComplexArrays` | 多層 `a[b[...]]`、巢狀呼叫、`null`、乘法 |
| `Square` | `field`、`constructor`、`method`、`this`、物件方法呼叫 |
| `Pong` | 多檔案類別協作、狀態機、大量方法呼叫 |

---

## 三、程式架構

| 模組 | 職責 | 關鍵方法 |
| --- | --- | --- |
| `JackCompiler.js` | 解析命令列參數、判斷檔案／資料夾、呼叫編譯流程 | `compileFile()`、`main()` |
| `JackTokenizer.js` | 去掉 `//` 與 `/* */` 註解，把原始碼轉成 token 陣列 | `_tokenize()`、`hasMoreTokens()`、`advance()`、`peek()` |
| `SymbolTable.js` | 維護 class / subroutine 兩層符號表與四類計數器 | `startSubroutine()`、`define()`、`varCount()`、`kindOf()`、`typeOf()`、`indexOf()` |
| `VMWriter.js` | 把 VM 指令暫存於 `this.lines`，最後一次寫檔 | `writePush()`、`writePop()`、`writeArithmetic()`、`writeLabel()`、`writeGoto()`、`writeIf()`、`writeCall()`、`writeFunction()`、`writeReturn()`、`close()` |
| `CompilationEngine.js` | 依照 Jack grammar 遞迴下降剖析，並直接生成 VM | `compileClass()` 到 `compileExpressionList()` 共 16 個方法 |

`CompilationEngine` 不再產生中繼的 XML 樹，而是「一邊剖析、一邊呼叫 `VMWriter`」。例如讀到 `return` 就立刻寫入 `return`；讀到 `if` 就先產生標籤，再遞迴編譯區塊內的陳述句。

---

## 四、JackTokenizer：從字元到 token

`JackTokenizer.js:22` 的 `_tokenize()` 先移除兩種註解：

```js
let cleaned = code.replace(/\/\*[\s\S]*?\*\//g, ' ');
cleaned = cleaned.replace(/\/\/.*$/gm, ' ');
```

接著用一個指標 `i` 掃描整份程式，依序判斷：

| 字元 | 處理方式 | token 類型 | 範例 |
| --- | --- | --- | --- |
| `"` | 一直讀到下一個 `"`，內容不保留引號 | `stringConstant` | `"Hello"` → `Hello` |
| `SYMBOLS` 集合內的字元 | 單一字元直接成 token | `symbol` | `{`、`[`、`+` |
| 數字 | 連續讀取 `0-9` | `integerConstant` | `254` |
| 字母或底線 | 連續讀取 `a-zA-Z0-9_`，再查 `KEYWORDS` | `keyword` 或 `identifier` | `while`、`Output` |
| 空白 | 跳過 | — | — |

五種 token 的讀取方法為 `tokenType()`、`keyWord()`、`symbol()`、`identifier()`、`intVal()`、`stringVal()`。與 Project 10 相比，Project 11 多了一個很重要的 `peek()`（`JackTokenizer.js:90`）：它回傳「下一個 token」但不移動指標，讓 `compileTerm()` 能預先看見 identifier 後面接的是 `[`、`(` 還是 `.`，藉此分辨陣列取值、同類方法呼叫與物件／類別呼叫。

以 `Seven/Main.jack:12` 為例：

```jack
do Output.printInt(1 + (2 * 3));
```

會被切成：

```text
keyword       do
identifier    Output
symbol        .
identifier    printInt
symbol        (
integerConstant 1
symbol        +
symbol        (
integerConstant 2
symbol        *
integerConstant 3
symbol        )
symbol        )
symbol        ;
```

---

## 五、SymbolTable：把名字映射到 VM 記憶體區段

`SymbolTable.js` 使用兩個 `Map`：

- `classScope`：`STATIC`、`FIELD`，整個 class 共用，進入 subroutine 時不清除。
- `subroutineScope`：`ARG`、`VAR`，每次進入新的 subroutine 都清空。

`define(name, type, kind)` 會依照 kind 自動分配遞增索引（`SymbolTable.js:21`），`varCount(kind)` 則提供給 `writeFunction()` 決定 local 數量。查找順序是 **subroutineScope 優先、classScope 次之**（`SymbolTable.js:37`～`53`），因此區域變數可以覆蓋同名的 field。

| Jack kind | VM segment | 索引來源 | 配置時機 | 對應 Hack RAM |
| --- | --- | --- | --- | --- |
| `STATIC` | `static` | class 內由 0 起 | 編譯 class 時 | `RAM[16]` 起，以 `ClassName.index`  symbol |
| `FIELD` | `this` | class 內由 0 起 | 編譯 class 時 | `THIS` 指向的基底 + index |
| `ARG` | `argument` | subroutine 內由 0 起 | `startSubroutine()` 後 | `ARG` 指向的基底 + index |
| `VAR` | `local` | subroutine 內由 0 起 | `compileVarDec()` | `LCL` 指向的基底 + index |

`_kindToSegment()`（`CompilationEngine.js:39`）就是這張表的程式化版本。若查不到符號，回傳 `NONE` 或 `-1`；目前沒有額外的錯誤訊息。

以 `Square/Square.jack:10` 為例：

```jack
field int x, y;
field int size;
```

會建立三個 `FIELD`：`x → this 0`、`y → this 1`、`size → this 2`。因此 `Square/Square.vm:31` 的 `let` 取值會編譯成 `push this 0`。

---

## 六、VMWriter：輸出中介碼

`VMWriter.js` 刻意不每行寫檔，而是先放進陣列：

```js
writePush(segment, index) {
  this.lines.push(`push ${segment} ${index}`);
}
```

直到 `close()`（`VMWriter.js:45`）才用 `fs.writeFileSync()` 一次寫出 `${baseName}.vm`。這樣做有兩個好處：

1. 同一個 `CompilationEngine` 可以連續處理一個 class 中的多個 subroutine，所有指令都累積在同一份輸出。
2. CompilationEngine 不需要自己處理換行或檔案 handle，只要呼叫對應的 `writeXxx()`。

九個方法與 VM 指令是一對一對應：

| 方法 | 輸出 |
| --- | --- |
| `writePush(segment, index)` | `push segment index` |
| `writePop(segment, index)` | `pop segment index` |
| `writeArithmetic(command)` | `add` / `sub` / `neg` / `eq` / `gt` / `lt` / `and` / `or` / `not` |
| `writeLabel(label)` | `label label` |
| `writeGoto(label)` | `goto label` |
| `writeIf(label)` | `if-goto label` |
| `writeCall(name, nArgs)` | `call name nArgs` |
| `writeFunction(name, nLocals)` | `function name nLocals` |
| `writeReturn()` | `return` |

---

## 七、CompilationEngine：Jack 語法到 VM 指令

`CompilationEngine.js` 是整個專案的核心，共 16 個 `compileXxx()` 方法。它依照 Jack grammar 逐層下降：

```
class
├── classVarDec*           (static / field)
└── subroutineDec*         (constructor / function / method)
    ├── parameterList
    ├── varDec*
    └── statements
        ├── let
        ├── if
        ├── while
        ├── do
        └── return
            └── expression → term → subroutineCall / expressionList
```

### 7.1 class 與 subroutine

`compileClass()`（`CompilationEngine.js:49`）先吃掉 `class`、類別名與 `{`，接著處理所有 `static` / `field`，再處理所有 subroutine，最後 `}` 並呼叫 `vmWriter.close()`。

`compileSubroutine()`（`CompilationEngine.js:88`）的順序是：

1. `startSubroutine()` 清空 ARG / VAR 計數器。
2. 若為 `method`，先把 `this` 以 `ARG 0` 定義進符號表（`CompilationEngine.js:96`）。
3. 處理參數與 `var` 宣告。
4. 以 `nLocals = varCount('VAR')` 寫出 `function ClassName.subName nLocals`。
5. 依 subroutine 類型初始化 `THIS`：

| 類型 | 初始化動作 | 生成的 VM | 資料來源 |
| --- | --- | --- | --- |
| `constructor` | 配置 `field` 數量個字組，指向新物件 | `push constant nFields` → `call Memory.alloc 1` → `pop pointer 0` | `CompilationEngine.js:114` |
| `method` | 把 arg 0（呼叫者傳入的物件）設為 `THIS` | `push argument 0` → `pop pointer 0` | `CompilationEngine.js:119` |
| `function` | 不需要物件，無額外指令 | — | — |

對應到 `Square/Square.vm:1`～`4`：

```vm
function Square.new 0
push constant 3
call Memory.alloc 1
pop pointer 0
```

以及 `Square/Square.vm:16`～`18`：

```vm
function Square.dispose 0
push argument 0
pop pointer 0
```

### 7.2 `let`：一般變數與陣列元素

一般指派很單純：`compileExpression()` 把值留在堆疊頂端，再 `pop segment index`。

陣列指派（`CompilationEngine.js:172`～`202`）則必須先算出目標位址。以 `let a[i] = v` 為例，產生的順序是：

```text
1. compileExpression()      計算索引 i
2. push segment index       推入陣列基底 a
3. add                      得到 a + i（目標位址留在堆疊頂端）
4. compileExpression()      計算右側值 v
5. pop temp 0               先暫存 v
6. pop pointer 1            把目標位址寫入 THAT
7. push temp 0              取回 v
8. pop that 0               寫入 a[i]
```

`pointer 1` 就是 `THAT`，`that 0` represent `*(THAT + 0)`，也就是 `a[i]`。使用 `temp 0` 是為了避免右側值被第 6 步的 `pop` 覆蓋。

### 7.3 `if` 與 `while`：標籤與條件反轉

`if`（`CompilationEngine.js:204`）使用兩個由 `labelCounter` 產生的唯一標籤：

```vm
// 條件 expression 已在堆疊頂端
not
if-goto IF_ELSE_0
// then 區塊
goto IF_END_1
label IF_ELSE_0
// else 區塊（可省略）
label IF_END_1
```

因為 VM 的 `if-goto` 是「不為零就跳」，而 Jack 的 `if (cond)` 是「為真就執行 then」，所以先 `not` 再 `if-goto elseLabel`。即使沒有 `else`，`IF_ELSE_n` 標籤仍會輸出，只是其後沒有指令。

`while`（`CompilationEngine.js:231`）也是同樣技巧：

```vm
label WHILE_EXP_0
// 條件 expression
not
if-goto WHILE_END_1
// 迴圈本體
goto WHILE_EXP_0
label WHILE_END_1
```

`Average/Main.vm:47`～`52` 可以看到實際結果：

```vm
label WHILE_EXP_0
push local 2
push local 1
lt
not
if-goto WHILE_END_1
```

### 7.4 `do` 與 `return`

`do`（`CompilationEngine.js:252`）呼叫副程式後，一定補一個 `pop temp 0` 丟掉回傳值，例如 `Seven/Main.vm:7`～`8`：

```vm
call Output.printInt 1
pop temp 0
```

`return`（`CompilationEngine.js:260`）若後面有 expression 就編譯它；若是 `return;`，則補 `push constant 0`，保證堆疊上永遠有一個回傳值，最後寫入 `return`。`Square/Square.vm:22`～`23` 就是 `method void dispose()` 的結尾：

```vm
push constant 0
return
```

### 7.5 expression 與 term

`compileExpression()`（`CompilationEngine.js:272`）先編譯第一個 term，然後只要看到運算子就繼續編譯 term 並生成對應指令：

| Jack 運算子 | VM 指令 |
| --- | --- |
| `+` | `add` |
| `-` | `sub` |
| `&` | `and` |
| `\|` | `or` |
| `<` | `lt` |
| `>` | `gt` |
| `=` | `eq` |
| `*` | `call Math.multiply 2` |
| `/` | `call Math.divide 2` |

`*` 與 `/` 沒有對應的 VM 算術指令，因此轉為呼叫 OS 的 `Math` 函式（`CompilationEngine.js:282`～`287`）。這也是為什麼完整執行 Jack 程式時，必須把 `../12/` 的 OS class 一起編譯。

`compileTerm()`（`CompilationEngine.js:292`）處理六種 term：

| term 形式 | 生成的 VM |
| --- | --- |
| `integerConstant` | `push constant n` |
| `stringConstant` | `push constant length` → `call String.new 1` → 每個字元 `push constant charCode` + `call String.appendChar 2` |
| `true` / `false` / `null` / `this` | `push constant 0` + `not`（true = -1）／ `push constant 0`／ `push pointer 0` |
| `(expression)` | 直接編譯括號內 expression |
| `-term` / `~term` | 編譯 term 後 `neg` / `not` |
| `varName[expr]` | 計算 `base + index` → `pop pointer 1` → `push that 0` |
| `varName` | `push segment index` |

字串常數的處理可在 `Average/Main.vm:2`～`39` 看到：`"How many numbers? "` 被展開成 `String.new`、`String.appendChar` 與一連串 ASCII code。

### 7.6 三種 subroutine call

`_compileSubroutineCall()`（`CompilationEngine.js:353`）利用 `peek()` 與符號表分辨三種語法：

| Jack 寫法 | 判斷方式 | 生成的呼叫 | 第 0 個參數 |
| --- | --- | --- | --- |
| `obj.method(args)` | `firstName` 在符號表中 | `push segment index` → `call Type.method 1+n` | 物件本身 |
| `ClassName.func(args)` | `firstName` 不在符號表中 | `call ClassName.func n` | 無 |
| `method(args)`（同 class） | 後面直接是 `(` | `push pointer 0` → `call CurrentClass.method 1+n` | 目前物件 `this` |

`compileExpressionList()` 會一邊編譯引號一邊計數，回傳的數量加上可能的 `this` 就是 `writeCall()` 的 `nArgs`。

以 `Square/Square.jack:18` 的 `do draw();` 為例，`Square/Square.vm:11`～`13` 是：

```vm
push pointer 0
call Square.draw 1
pop temp 0
```

---

## 八、完整範例：Seven

Jack（`Seven/Main.jack:9`～`16`）：

```jack
class Main {
   function void main() {
      do Output.printInt(1 + (2 * 3));
      return;
   }
}
```

編譯結果（`Seven/Main.vm` 全部 10 行）：

```vm
function Main.main 0
push constant 1
push constant 2
push constant 3
call Math.multiply 2
add
call Output.printInt 1
pop temp 0
push constant 0
return
```

逐步解讀：

1. `function Main.main 0`：沒有 `var`，所以 local 數量為 0。
2. 依序推入 `1`、`2`、`3`。
3. `call Math.multiply 2` 取走 `2`、`3`，回傳 `6`。
4. `add` 算出 `1 + 6 = 7`。
5. `call Output.printInt 1` 印出 `7`。
6. `pop temp 0` 丟掉 `printInt` 的回傳值。
7. `push constant 0` + `return`：void 函式仍回傳一個值。

這個例子同時示範了 operator precedence：`*` 先被 `compileTerm`／`compileExpression` 處理成 `Math.multiply`，再與左邊的 `1` 做 `add`，即使 Jack 原始碼寫成 `1 + (2 * 3)` 也正確。

---

## 九、使用方式

需要安裝 Node.js。以下指令假設工作目錄是 `_co/11/`。

編譯單一 `.jack`（輸出同目錄的 `.vm`）：

```bash
node ../JackCompiler11/JackCompiler.js Seven/Main.jack
node ../JackCompiler11/JackCompiler.js ComplexArrays/Main.jack
```

編譯整個資料夾（只處理該層的 `.jack`，輸出每個 `.vm`）：

```bash
node ../JackCompiler11/JackCompiler.js Seven
node ../JackCompiler11/JackCompiler.js Average
node ../JackCompiler11/JackCompiler.js Pong
node ../JackCompiler11/JackCompiler.js .
```

`JackCompiler.js:18` 的行為：

| 輸入 | 行為 |
| --- | --- |
| 不給參數 | 預設 `.`，編譯目前資料夾 |
| 檔案路徑 | 編譯該 `.jack`，輸出同名 `.vm` |
| 資料夾路徑 | 讀取該層所有 `.jack`（`endsWith('.jack')`），逐一編譯 |
| 路徑不存在 | 印出 `找不到路徑: ...` 並 `process.exit(1)` |
| 資料夾內沒有 `.jack` | 印出 `該資料夾中沒有 .jack 檔案。` |

每成功編譯一個檔案會印出 `編譯完成: Xxx.jack -> Xxx.vm`。輸出檔直接覆寫同名 `.vm`，不會備份。

### 9.1 串接後續流程

若要真正跑在 Hack 平台上，需要把 OS 一起編譯：

```bash
# 1. 編譯 ../12/ 的 8 個 OS class（Array、Math、String、Output、...）
node ../JackCompiler11/JackCompiler.js ../12

# 2. 編譯應用程式
node ../JackCompiler11/JackCompiler.js Seven

# 3. 把程式 .vm 與 OS .vm 放在同一資料夾，交給 VMTranslator
node ../VMTranslator/VMTranslator.js <vm資料夾>

# 4. 用 Project 6 的 assembler 轉成 .hack
node ../06/add/assembler.js <asm路徑>

# 5. 用 CPU Emulator 載入測試或直接使用 Generated Virtual Machine 執行
```

第 3 步會因為資料夾內有多個 `.vm` 而自動加入 Bootstrap，並呼叫 `Sys.init`，細節可參考 `../08/README.md`。

---

## 十、驗證結果

為了不覆蓋原有 `.vm`，先把 `11/` 複製到暫存目錄，對副本執行 `JackCompiler.js`，再用 `Compare-Object` 逐行比對新舊 `.vm`：

| 程式 | `.vm` 檔 | 行數 | 是否完全相同 |
| --- | --- | --- | --- |
| Average | `Main.vm` | 149 | ✅ 相同 |
| ComplexArrays | `Main.vm` | 703 | ✅ 相同 |
| ConvertToBin | `Main.vm` | 106 | ✅ 相同 |
| Pong | `Ball.vm` | 435 | ✅ 相同 |
| Pong | `Bat.vm` | 208 | ✅ 相同 |
| Pong | `Main.vm` | 13 | ✅ 相同 |
| Pong | `PongGame.vm` | 321 | ✅ 相同 |
| Seven | `Main.vm` | 10 | ✅ 相同 |
| Square | `Main.vm` | 11 | ✅ 相同 |
| Square | `Square.vm` | 310 | ✅ 相同 |
| Square | `SquareGame.vm` | 190 | ✅ 相同 |

共 **11 個檔案、2,256 行 VM 指令**全部一致。這代表：

- tokenizer 對註解、字串、數字與 identifier 的切割正確；
- symbol table 的索引分配與 class / subroutine 作用域正確；
- `let`、`if`、`while`、`do`、`return`、expression、term 與 subroutine call 的轉換正確；
- label counter 產生的標籤名稱與既有輸出一致。

---

## 十一、學習心得

### 1. 「剖析」與「生成」是兩件事

Project 10 只要把 token 放回 XML tag 裡，結構對了就過關；Project 11 必須一边剖析、一边决定要推入哪個 segment、要呼叫哪個函式、要跳到哪個標籤。同一段 Jack 語法，在 XML 裡只是一個节点，在 VM 裡卻變成一串有順序副作用的指令。

### 2. Symbol table 是從名字到記憶體的翻譯層

Jack 程式設計師寫的是 `size`、`x`、`a[i]`；VM 只認識 `local 2`、`this 2`、`that 0`。`SymbolTable` 把「 identifier → kind + index」記錄下來，再由 `_kindToSegment()` 轉成 VM segment。沒有這一層，編譯器就無法處理區域變數與物件欄位。

### 3. `this` 是 method 的第 0 個參數

`method void draw()` 在 VM 裡其實是 `function Square.draw` 加上一個隱藏的 `argument 0`。呼叫端 push `pointer 0`，被呼叫端 `pop pointer 0`，物件本身就這樣在函式之間傳遞。constructor 則反過來：先 `Memory.alloc`，再把新物件放進 `pointer 0`。讀懂這兩個動作後，物件導向在 Hack 上就不再神祕。

### 4. 陣列指派要先存值，再設 THAT

`let a[i] = v` 看起來只是一行，但堆迭上同時有「索引」与「值」。若先把目標位址 `pop pointer 1` 再算右側值，THAT 可能被後續呼叫破壞；因此程式先 `pop temp 0` 暫存值，設好 `THAT` 後再寫回 `that 0`。這個順序是實際寫編譯器才會注意到的細節。

### 5. 標籤唯一性由編譯器負責

`IF_ELSE_0`、`IF_END_1`、`WHILE_EXP_2` 全靠 `labelCounter` 遞增。若沒有計數器，巢狀迴圈或重複的 `if` 會產生同名標籤，組譯時就會衝突。這和 Project 8 的 `functionName$ret.n` 是同一種思維。

### 6. 布林值不是 1，而是 -1

Jack 的 `true` 編譯成 `push constant 0` + `not`，也就是 `-1`（所有位元皆為 1）。`false` 與 `null` 則是 `0`。若直接用 `1` 代表 true，`~` 與位元運算就會出錯。這個慣例在 `Square/Square.vm:27`～`29` 的 `Screen.setColor(false)` 也能看到。

### 7. 分層驗證比盯著單一輸出有效

除錯時有效的順序是：先看 `.jack` 確認語意，再看符號表確認 segment / index，再看 `.vm` 確認指令順序，最後才用 VM Emulator 或 CPU Emulator 觀察堆疊。只盯著 `.vm` 很難判斷 `pop temp 0` 是努力工作還是多餘指令。

---

## 十二、已知限制與可改進事項

- `JackCompiler.js` 的資料夾模式不遞迴子資料夾，也不排序檔名。
- 註解移除使用正規表達式，不支援巢狀 `/* ... /* ... */ ... */`。
- 字串常數不做跳脫字元處理（例如 `\n`、`\"`）。
- `_eat()` 沒有檢查 token 是否符合 preconditions，語法錯誤時可能安靜跳過或產生不完整的 `.vm`。
- `compileTerm()` 遇到未預期的 token 時沒有 else 分支，也不會回報錯誤。
- `kindOf()` 回傳 `NONE` 時，`_kindToSegment()` 回傳 `null`，可能寫出 `push null -1` 這類無效指令。
- 沒有輸出目錄參數，輸出固定在 `.jack` 同目錄並覆蓋既有 `.vm`。
- 沒有自動化測試腳本；目前靠「重新編譯 + 逐行比對」人工驗證。
- 尚未做peephole 最佳化，例如連續 `push constant 0` / `not` 可以合併。

---

## 十三、參考資料

- Nand2Tetris 官方網站：<https://www.nand2tetris.org/>
- *The Elements of Computing Systems*，Noam Nisan & Shimon Schocken
- `../JackCompiler11/`：本專案使用的 Jack Compiler 原始碼
- `../JackAnalyzer10/`：Project 10 的 XML 分析器，供對照
- `../08/README.md`：VM Translator 的呼叫框架與 Bootstrap 說明
- `../06/README.md`：Assembler 與 `.hack` 產生方式
- 各測試資料夾內的 `.jack` 與 `.vm`
