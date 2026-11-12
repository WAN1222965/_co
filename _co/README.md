# IC 設計的 EDA 是什麼？

> 本專案由 opencode 協助說明與範例製作。

| 欄位 | 內容 |
|------|------|
| 課程 | 計算機結構 |
| 學期 | 115 學年上學期 |
| 學生 | 吳嘉恩 |
| 學號 | 09 |
| 實作工具 | veryl2chip IDE（瀏覽器版 WebAssembly EDA） |
| 工具網址 | <https://ccc-eda.github.io/veryl2chip/web/dist/index.html> |

## 摘要

**EDA（Electronic Design Automation，電子設計自動化）是用軟體設計晶片的一整套工具鏈。** 當晶片動輒數十億個電晶體，從撰寫電路、模擬、合成、佈局、繞線、時序分析到實體驗證，已不可能靠人力逐步完成，必須交由 EDA 自動化。

本報告以 Veryl 撰寫一個 LED 閃爍電路（Blinky），先走完 FPGA（iCE40）的 **RTL → 模擬 → 合成 → 佈局繞線 → 時序 → 位元流** 流程，再切換到 ASIC（SKY130）觀察標準元件、CTS 與 GDSII 產出，最後從操作過程中整理 EDA 的技術內涵與個人心得。

## 一、EDA 是什麼

EDA 的核心任務，是把設計者的「想法」轉換成「可製造的電路」。它可以分成兩個層面：

- **設計描述（Design Entry）**：用硬體描述語言（Verilog、SystemVerilog、VHDL、Veryl）或電路圖描述電路功能。
- **設計實現與驗證（Implementation & Verification）**：把高階描述自動轉換成邏輯閘、標準元件或 FPGA 的查表（LUT），安排實體位置、拉線、計算延遲與功耗，並確認結果與原始描述等價。

要完成這些工作，EDA 實際上結合了四類技術：

| 技術領域 | 在 EDA 中的角色 |
|----------|-----------------|
| 編譯器技術 | 語法解析、型別檢查、參數展開、邏輯展開 |
| 演算法 | 布林化簡、圖論分割、模擬退火佈局、全域／細部繞線 |
| 數值分析 | RC 延遲、時序分析（STA）、功耗與電壓降（IR drop） |
| 驗證工程 | 模擬、形式等價檢查、DRC／LVS 實體驗證 |

**沒有 EDA，就沒有今日的 SoC、CPU、GPU 與 AI 晶片。**

## 二、EDA 在 IC 設計流程中的位置

IC 設計一般分為「前端（front-end）」與「後端（back-end）」。前端處理「邏輯對不對」，後端處理「做不做得出來、跑得多快、多耗電」。

| 階段 | 主要工作 | 典型工具／技術 |
|------|----------|----------------|
| 規格與架構 | 決定功能、效能、面積、功耗（PPA）目標 | 系統模擬、架構探索 |
| RTL 設計 | 用 HDL 撰寫電路行為 | 編輯器、lint、語法檢查 |
| 功能模擬 | 用 testbench 驗證邏輯 | 事件驅動模擬器（Verilator 等） |
| 邏輯合成 | RTL 轉成閘級網表並最佳化 | Yosys、Design Compiler、Genus |
| 技術對應 | 閘電路對應到 LUT 或標準元件 | LUT mapping、standard cell mapping |
| 佈局（Placement） | 決定元件在晶片上的座標 | 模擬退火、解析式佈局 |
| 時鐘樹合成（CTS） | 均勻分配時脈、降低 skew | CTS 工具 |
| 繞線（Routing） | 依實體規則連接元件 | 全域／細部繞線器 |
| 時序分析（STA） | 檢查 setup／hold、求 Fmax | PrimeTime、OpenSTA |
| 功耗與 IR Drop | 估算動態／靜態功耗與電壓降 | Power analysis |
| 實體驗證 | DRC、LVS、GDSII 產出 | KLayout、Calibre |
| FPGA 流程 | LUT、P&R、位元流、燒錄 | nextpnr、icepack、iceprog |

## 三、實作環境：veryl2chip IDE

veryl2chip 是一套以 Rust 撰寫、編譯成 WebAssembly 的開源 EDA，全部在瀏覽器執行，不需安裝或伺服器。

| 項目 | 內容 |
|------|------|
| 硬體描述語言 | Veryl（語法類似 Rust，編譯成 SystemVerilog） |
| 內建模擬器 | 事件驅動模擬器 |
| FPGA 後端 | iCE40UP5K，可產生 `.bin` |
| ASIC 後端 | SKY130 PDK，可輸出 GDSII |
| 輔助功能 | 虛擬 iCEBreaker 板、波形檢視器、全面驗證 |
| 命令列工具 | `v2c`（`sim`、`synth`、`fpga`、`asic`、`gatesim` 等） |
| 操作入口 | 左側「範例庫 → 教學 → 第 1 課 Blinky」 |

## 四、實作流程：從 Blinky 到晶片

以下依實際操作順序，把「設計 → 驗證 → 合成 → 實現」四個環節串起來。

### 4.1 設計輸入：Blinky

Blinky 是一個 24 位元計數器，每個時脈加 1，用最高位元驅動板上的紅、綠燈，並用最高 5 個位元驅動擴充板 LED。

```veryl
module Blinky #(
    param WIDTH: u32 = 24,
) (
    i_clk : input  clock   ,
    i_rst : input  reset   ,
    o_ledr: output logic   ,
    o_ledg: output logic   ,
    o_led : output logic<5>,
) {
    var cnt: logic<WIDTH>;

    always_ff {
        if_reset {
            cnt = 0;
        } else {
            cnt = cnt + 1;
        }
    }

    assign o_ledr = !cnt[WIDTH - 1];
    assign o_ledg = cnt[WIDTH - 1];
    assign o_led  = cnt[WIDTH - 1:WIDTH - 5];
}
```

**重點**：Veryl 的時脈與重設有專屬型別，`always_ff` 不必寫敏感列表，`if_reset` 統一處理重設，能減少 Verilog 常見的錯誤。

### 4.2 功能模擬與波形

按下「▶ 測試」（Ctrl/⌘+Enter）後顯示 PASS。testbench 用 `$tb::clock_gen` 產生時脈、`$tb::reset_gen` 產生重設，並以 `$assert` 檢查三件事：

- 重設後計數為 0；
- 前進 37 個時脈後，頂端 5 位元應為 `10010`；
- 再 27 個時脈後溢位回到 0。

測試時把 `WIDTH` 縮成 6，讓 64 個時脈就能跑完一輪，這是硬體驗證常用的「縮小參數」技巧。切到「波形」面板，可勾選 `clk`、`rst`、`dut.cnt`、`led` 等訊號，觀察計數器每個正緣加 1、LED 每 2 拍才變化，以及 `cnt` 從 31 變 32 時紅綠燈同時翻轉。

若故意把斷言改成錯誤值，模擬器會回報 `ASSERTION FAILED at time …`，指出哪一個斷言、在哪個時間失敗。**這說明 EDA 模擬器不只看結果，還能定位問題。**

### 4.3 邏輯合成：從 RTL 到 LUT（FPGA）

在標題列選擇 FPGA 後端後，IDE 會顯示合成流程的每個階段：

```
① RTL→Logic → ② Logic Netlist → ③ Tech-indep Syn
→ ④ LUT4 Techmap → ⑤ Placement → ⑥ Routing → ⑦ Timing
```

| 階段 | 工作內容 | Blinky 的觀察結果 |
|------|----------|------------------|
| ① RTL→Logic | 解析 Veryl、展開參數、攤平階層 | 1 個模組、5 個埠 |
| ② Logic Netlist | 每行程式化成 2 輸入 AND/XOR/NOT 與 DFF | 24 個 DFF 加上加法器邏輯 |
| ③ Tech-indep Syn | 常數傳播、去除重複與無用邏輯 | 71 個元件 |
| ④ LUT4 Techmap | 對應到 iCE40 的 LUT4 與 DFF | 33 個 SB_LUT4 + 24 個 SB_DFFR |

**這一步最能體會「EDA 是編譯器」**：一行 `cnt = cnt + 1` 被展開成進位鏈，再被包成 4 輸入查表；點選單一 LUT 還能查看它的 16 項真值表。

### 4.4 全面驗證：合成前後一致嗎？

合成工具本身也可能有 bug，因此 IDE 提供「✔ 全面驗證」：同一組 testbench 分別跑在

- RTL、
- 通用閘網表、
- iCE40 LUT 網表、
- ASIC 標準元件網表

四種實作上，結果必須完全一致。這對應業界的「閘級模擬」與「形式等價檢查」，是確保合成沒有改變功能的核心手段。

### 4.5 佈局、繞線、時序與位元流

- **⑤ Placement**：晶片由 26×32 個 tile 組成，邏輯單元（LC = LUT + DFF）被分配到具體位置；IDE 提供「退火動畫」，可看到模擬退火如何把相連元件拉近以縮短線長。
- **⑥ Routing**：顯示實際使用的導線，可單獨檢視某一條 net。
- **⑦ Timing（STA）**：紅線標出關鍵路徑並列出每段延遲。Blinky 的臨界路徑約 **29.68 ns**、Fmax 約 **33.70 MHz**；板子時脈為 12 MHz，因此有充足餘裕。
- **位元流**：下載 `.bin` 後可用 `iceprog` 燒錄；也可在 IDE 按「⚡ 虛擬板」，把設計燒到畫出來的 iCEBreaker 上，LED 會依工作週期亮起，按鈕可互動。

**功能正確只是第一步，還要確認電路放得下、接得起來、跑得夠快。**

### 4.6 ASIC 流程：一路走到 GDSII

把後端切換為 ASIC · SKY130，流程變成：

```
① RTL→Logic → ② Logic Netlist → ③ Tech-indep Syn
→ ④ Standard Cell Map → ⑤ Row Placement
→ ⑥ CTS + Global Routing → ⑦ Detail Routing → ⑧ STA → ⑨ Power + IR Drop
```

與 FPGA 最大的差異：

- **標準元件對應**：使用 SKY130 `sky130_fd_sc_hd` 的 AND、OR、DFF 等 cell，而非 LUT。
- **列式佈局**：標準元件必須排在固定高度的列（row）上。
- **時鐘樹合成（CTS）**：讓時脈到達各正反器的延遲盡量一致。
- **功耗與 IR Drop**：估算動態／靜態功耗與電源網電壓降。
- **實體驗證與產出**：DRC 檢查通過後可下載 DEF 與 GDSII。

同樣的設計在 ASIC 上通常有更高的 Fmax 與更小的面積，因為標準元件是為該製程特製的；代價是光罩成本極高、流程更長、驗證更嚴格。IDE 的「⇄ FPGA vs ASIC」可並排比較兩者的面積、連線、Fmax、功耗與能耗。

## 五、從實作看 EDA 的技術內涵

- **EDA 是「硬體編譯器」**：RTL 是原始碼，網表是目的碼，合成是編譯，最佳化就是 compiler optimization。
- **分層抽象是關鍵**：RTL → 邏輯閘 → LUT／標準元件 → 實體佈局，每一層只暴露必要資訊，讓問題可處理。
- **驗證與實現同等重要**：沒有模擬、閘級模擬、等價檢查與 DRC，就不能保證晶片可用。
- **PPA 是後端優化的核心**：Performance（Fmax）、Power、Area 彼此牽制，佈局與繞線就是在約束下找最佳解。
- **同一份前端可對應多個後端**：同一個 Veryl 設計可走 FPGA 或 ASIC，說明 EDA 流程的可重定向性（retargetability）。

## 六、開源與商業 EDA

| 面向 | 開源工具（本報告使用） | 商業工具 |
|------|------------------------|----------|
| 代表 | veryl2chip、Yosys、nextpnr、OpenSTA、KLayout | Synopsys、Cadence、Siemens EDA |
| 成本 | 免費 | 授權費高昂 |
| 製程支援 | 以開源 PDK（SKY130）與 FPGA 為主 | 先進製程（7nm、5nm、3nm） |
| 優勢 | 可學習、可修改、適合教學與研究 | 完整生態、簽核（sign-off）能力、技術支援 |
| 限制 | 規模與先進製程支援有限 | 取得門檻高、封閉原始碼 |

veryl2chip 的價值，在於把整套流程壓縮成瀏覽器可執行的版本，讓學生在沒有昂貴授權的情況下，仍能親手走完從程式到 GDSII 的每一步。

## 七、心得

這次最大的收穫，是 EDA 從一個「聽過的名詞」變成一條可以親手走完的流程。

以前寫 Verilog，判斷對錯的方式幾乎只有「模擬有沒有過」。模擬過了，就覺得設計完成了。但這次看著自己的 `cnt = cnt + 1` 在合成後變成進位鏈、變成 33 個 LUT4 與 24 個正反器，才真正意識到：**程式碼只是起點，真正的電路是在合成與實現之後才誕生的。** 模擬通過只代表「行為描述正確」，不代表「電路做得出來、跑得夠快、不發熱」。

第二個讓我印象深刻的是「全面驗證」。原本我以為合成是絕對可靠的，但仔細想想，合成、佈局、繞線每一步都在重寫電路結構，只要工具理解錯一個條件，功能就可能悄悄改變。業界願意花大量時間做閘級模擬與等價檢查，不是因為不信任自己的設計，而是因為**不信任中間的自動化程序**。這種「用同一組測試證明行為不變」的思維，是書本上很難體會、實際操作一次才懂的事。

第三，ASIC 流程讓我重新認識 FPGA 與 ASIC 的差別。以前只覺得差在「一個可重燒、一個要光罩」，實際切換後才看到標準元件、列式佈局、CTS、功耗與 DRC 這麼大一整套工程。也第一次具體感受到 PPA 的拉扯：想要更快、更小、更省電，往往得在佈局與繞線的約束裡互相妥協，而不是單靠寫出漂亮的 RTL 就能解決。

最後，veryl2chip 在瀏覽器裡跑完整條流程，讓我體會到 EDA 教育其實可以不被昂貴授權綁住。雖然開源工具在先進製程與規模上仍有限制，但它把「從程式碼到 GDSII」的每一步攤開給你看，對學習而言反而比商業黑箱更有價值。

**總結來說，EDA 不是單一軟體，而是一條從高階描述通往矽晶片的自動化流水線。理解 EDA，就等於理解現代晶片如何在人類無法手動處理的複雜度下，仍然被可靠地設計與製造出來。**

## 參考資料

- AI 自製 EDA -- <https://github.com/ccc-eda/veryl2chip/>
- 線上使用 -- <https://ccc-eda.github.io/veryl2chip/web/dist/index.html>
- Nand2tetris 網頁專案 -- <https://github.com/ccc-js/hack-computer>
- 線上使用 -- <https://ccc-js.github.io/hack-computer/dist/hdl.html>
- EDA 電子書 -- <https://github.com/ccc-eda/eda-books/tree/main/book>
- 康乃爾大學的 IC 設計課程 -- <https://www.csl.cornell.edu/courses/ece5745/handouts.html>
