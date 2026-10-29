# IC 設計的 EDA 是什麼？

> 本專案由 opencode 協助說明與範例製作。

欄位 | 內容
-----|------
課程 | 計算機結構
學期 | 115 學年上學期
學生 | 吳嘉恩
學號 | 09
實作工具 | veryl2chip IDE（瀏覽器版 WebAssembly EDA）
工具網址 | <https://ccc-eda.github.io/veryl2chip/web/dist/index.html>

## 摘要

EDA（Electronic Design Automation，電子設計自動化）是「用軟體來設計晶片」的一整套工具鏈。現代晶片動輒數十億個電晶體，人不可能手算每個邏輯閘的位置與連線，因此從寫程式、模擬、合成、佈局、繞線、時序分析到實體驗證，每一步都必須靠 EDA 工具完成。

本報告先說明 EDA 的定義與它在 IC 設計流程中的角色，再實際使用開源的 veryl2chip IDE，以 Veryl 硬體描述語言完成一個 LED 閃爍電路（Blinky），依序走過「RTL → 模擬 → 波形 → 合成 → 閘級模擬 → 佈局繞線 → 時序分析 → 位元流 → 虛擬板」的完整 FPGA 流程，並切換到 ASIC（SKY130）流程觀察標準元件、佈局、繞線與 GDSII 輸出。最後整理從操作中看到的 EDA 技術內涵、開源與商業工具的差異，以及心得。

## 1. 什麼是 EDA？

EDA 是把 IC 設計者的「想法」轉換成「可製造電路」的電腦輔助工程軟體。它可以分成兩個層面理解：

- **設計描述（Design Entry）**：用硬體描述語言（HDL，如 Verilog、SystemVerilog、VHDL、Veryl）或電路圖描述電路的功能。
- **設計實現與驗證（Implementation & Verification）**：把高階描述自動轉換成邏輯閘、標準元件或 FPGA 的查表（LUT），安排實體位置、拉線、計算延遲與功耗，並確認結果與原始描述等價。

因此 EDA 不只是「畫圖工具」，而是結合了：

- **編譯器技術**：語法解析、型別檢查、參數展開、邏輯展開。
- **演算法**：布林化簡、圖論分割、模擬退火佈局、全域／細部繞線。
- **數值分析**：RC 延遲、時序分析（STA）、功耗與電壓降（IR drop）。
- **驗證工程**：模擬、形式等價檢查、DRC／LVS 實體驗證。

沒有 EDA，就沒有今日的 SoC、CPU、GPU 與 AI 晶片。

## 2. EDA 在 IC 設計流程中的位置

一般把 IC 設計流程分成「前端（front-end）」與「後端（back-end）」：

階段 | 主要工作 | 典型 EDA 工具／技術
-----|----------|--------------------
規格與架構 | 決定功能、效能、面積、功耗（PPA）目標 | 系統模擬、架構探索
RTL 設計 | 用 HDL 撰寫電路行為 | 編輯器、lint、語法檢查
功能模擬 | 用 testbench 驗證邏輯 | 事件驅動模擬器（Verilator 等）
邏輯合成 | RTL 轉成閘級網表並最佳化 | Yosys、Design Compiler、Genus
技術對應 | 閘電路對應到 LUT 或標準元件 | LUT mapping、standard cell mapping
佈局（Placement） | 決定元件在晶片上的座標 | 模擬退火、解析式佈局
時鐘樹合成（CTS） | 均勻分配時脈、降低 skew | CTS 工具
繞線（Routing） | 依實體規則連接元件 | 全域／細部繞線器
時序分析（STA） | 檢查 setup／hold、求 Fmax | PrimeTime、OpenSTA
功耗與 IR Drop | 估算動態／靜態功耗與電壓降 | Power analysis
實體驗證 | DRC、LVS、GDSII 產出 | KLayout、Calibre
FPGA 流程 | LUT、P&R、位元流、燒錄 | nextpnr、icepack、iceprog

前端處理「邏輯對不對」，後端處理「電路做不做得出來、跑得多快、多耗電」。

## 3. 實際操作：veryl2chip IDE

### 3.1 環境與工具特色

veryl2chip 是一套以 Rust 撰寫、編譯成 WebAssembly 的開源 EDA，全部在瀏覽器執行，不需要安裝或伺服器：

- **硬體描述語言**：Veryl（語法類似 Rust，編譯成 SystemVerilog）。
- **內建**：事件驅動模擬器、邏輯合成、FPGA 流程（iCE40UP5K，可產生 `.bin`）、ASIC 流程（vlib 標準元件與 SkyWater SKY130 PDK，可輸出 GDSII）。
- 附虛擬 iCEBreaker 板、波形檢視器、全面驗證（同一組 testbench 同時跑 RTL 與三種合成後網表）。
- 支援命令列工具 `v2c`（`sim`、`synth`、`fpga`、`asic`、`gatesim` 等）。
- **操作方式**：開啟 IDE 後，從左側「範例庫 → 教學」選擇「第 1 課 Blinky」，即可載入程式與 testbench。

### 3.2 設計輸入：Blinky

Blinky 是一個 24 位元計數器，每個時脈加 1，用最高位元驅動板上的紅、綠燈，並用最高的 5 個位元驅動擴充板 LED：

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

Veryl 的特點是時脈與重設有專屬型別，`always_ff` 不必寫敏感列表，`if_reset` 統一處理重設，減少了 Verilog 常見的錯誤。

### 3.3 功能模擬與波形

按下「▶ 測試」（Ctrl/⌘+Enter）後，測試結果面板顯示 PASS。testbench 用 `$tb::clock_gen` 產生時脈、`$tb::reset_gen` 產生重設，並用 `$assert` 檢查：

- 重設後計數為 0；
- 前進 37 個時脈後，頂端 5 位元應為 `10010`；
- 再 27 個時脈後溢位回到 0。

測試時把 `WIDTH` 縮成 6，讓 64 個時脈就能跑完一輪，這是硬體驗證常用的「縮小參數」技巧。切到下方面板「波形」後，可勾選 `clk`、`rst`、`dut.cnt`、`led` 等訊號，觀察計數器每個正緣加 1、LED 每 2 拍才變化，以及 `cnt` 從 31 變 32 時紅綠燈同時翻轉。

若故意把斷言改成 `5'b10011`，模擬器會回報 `ASSERTION FAILED at time …`，指出哪一個斷言、在哪個時間失敗。這說明了 EDA 模擬器不只看結果，還能定位問題。

### 3.4 邏輯合成：從 RTL 到 LUT

在標題列選擇後端 FPGA 與階段，IDE 會顯示合成流程的每個階段：

```
① RTL→Logic → ② Logic Netlist → ③ Tech-indep Syn
→ ④ LUT4 Techmap → ⑤ Placement → ⑥ Routing → ⑦ Timing
```

階段 | 工作內容 | Blinky 的觀察結果
-----|----------|------------------
① RTL→Logic | 解析 Veryl、展開參數、攤平階層 | 1 個模組、5 個埠
② Logic Netlist | 每行程式化成 2 輸入 AND/XOR/NOT 與 DFF | 24 個 DFF 加上加法器邏輯
③ Tech-indep Syn | 常數傳播、去除重複與無用邏輯 | 71 個元件
④ LUT4 Techmap | 對應到 iCE40 的 LUT4 與 DFF | 33 個 SB_LUT4 + 24 個 SB_DFFR

這一步最能體會「EDA 是編譯器」：一行 `cnt = cnt + 1` 被展開成進位鏈，再被包成 4 輸入查表。點選單一 LUT 還能查看它的 16 項真值表。

### 3.5 全面驗證：合成前後一致嗎？

合成工具本身也可能有 bug，因此 IDE 提供「✔ 全面驗證」：同一組 testbench 分別跑在

- RTL、
- 通用閘網表、
- iCE40 LUT 網表、
- ASIC 標準元件網表

四種實作上，結果必須完全一致。這對應到業界的「閘級模擬（gate-level simulation）」與「形式等價檢查（formal equivalence）」，是確保合成沒有改變功能的核心手段。

### 3.6 佈局、繞線、時序與位元流

- **⑤ Placement**：晶片由 26×32 個 tile 組成，彩色的邏輯單元（LC = LUT + DFF）被分配到具體位置。IDE 提供「退火動畫」，可看到模擬退火如何把相連元件拉近以縮短線長。
- **⑥ Routing**：顯示實際使用的導線，可單獨檢視某一條 net。
- **⑦ Timing（STA）**：紅線標出關鍵路徑並列出每段延遲。Blinky 的結果為臨界路徑約 29.68 ns、Fmax 約 33.70 MHz；板子時脈為 12 MHz，因此有充足餘裕。
- **位元流**：下載 `.bin` 後可用 `iceprog` 燒錄；也可以在 IDE 中按「⚡ 虛擬板」，把設計燒到畫出來的 iCEBreaker 上，LED 會依工作週期亮起，按鈕可互動。

這個階段對應業界的 P&R 與 STA：功能正確只是第一步，還要確認電路放得下、接得起來、跑得夠快。

### 3.7 ASIC 流程：走到 GDSII

把後端切換為 ASIC · SKY130，流程變成：

```
① RTL→Logic → ② Logic Netlist → ③ Tech-indep Syn
→ ④ Standard Cell Map → ⑤ Row Placement
→ ⑥ CTS + Global Routing → ⑦ Detail Routing → ⑧ STA → ⑨ Power + IR Drop
```

與 FPGA 最大的差異是：

- **標準元件對應**：使用 SKY130 `sky130_fd_sc_hd` 的 AND、OR、DFF 等 cell，而非 LUT。
- **列式佈局**：標準元件必須排在固定高度的列（row）上。
- **時鐘樹合成（CTS）**：讓時脈到達各正反器的延遲盡量一致。
- **功耗與 IR Drop**：估算動態／靜態功耗與電源網電壓降。
- **實體驗證與產出**：DRC 檢查通過後可下載 DEF 與 GDSII。

同樣的設計在 ASIC 上通常有更高的 Fmax 與更小的面積，因為標準元件是為該製程特製的；代價是光罩成本極高、流程更長、驗證更嚴格。IDE 的「⇄ FPGA vs ASIC」可並排比較兩者的面積、連線、Fmax、功耗與能耗。

## 4. 從操作中看到的 EDA 技術內涵

- **EDA 是「硬體編譯器」**：RTL 是原始碼，網表是目的碼，合成是編譯，最佳化是 compiler optimization。
- **分層抽象是關鍵**：RTL → 邏輯閘 → LUT／標準元件 → 實體佈局，每一層都只暴露必要資訊，讓問題可處理。
- **驗證與實現同等重要**：沒有模擬、閘級模擬、等價檢查與 DRC，就不能保證晶片可用。
- **PPA 是後端優化的核心**：Performance（Fmax）、Power、Area 彼此牽制，佈局與繞線就是在約束下找最佳解。
- **同一個前端可對應多個後端**：同一份 Veryl 可走 FPGA 或 ASIC，說明 EDA 流程的可重定向性（retargetability）。

## 5. 開源與商業 EDA

面向 | 開源工具（本報告使用） | 商業工具
-----|------------------------|---------
代表 | veryl2chip、Yosys、nextpnr、OpenSTA、KLayout | Synopsys、Cadence、Siemens EDA
成本 | 免費 | 授權費高昂
製程支援 | 以開源 PDK（SKY130）與 FPGA 為主 | 先進製程（7nm、5nm、3nm）
優勢 | 可學習、可修改、適合教學與研究 | 完整生態、簽核（sign-off）能力、技術支援
限制 | 規模與先進製程支援有限 | 取得門檻高、封閉原始碼

veryl2chip 的價值在於把整套流程壓縮成瀏覽器可執行的版本，讓學生在沒有昂貴授權的情況下，仍能親手走完從程式到 GDSII 的每一步。

## 6. 心得與結論

EDA 是 IC 設計的「作業系統」：設計者負責描述功能，EDA 負責把功能落實成可製造的幾何結構，並在過程中不斷回答三個問題——對不對、快不快、做不做得出來。

這次使用 veryl2chip 的收穫有三點：

1. 以前寫 Verilog 只停留在「模擬會過」，這次第一次完整看到合成後每一行變成了幾個 LUT、幾個 DFF，以及臨界路徑與 Fmax 是怎麼算出來的。
2. 「全面驗證」讓我理解為什麼業界要花大量時間在閘級模擬與等價檢查：合成與佈局繞線都是會改變電路結構的自動化程序，必須用同一組測試證明行為不變。
3. ASIC 流程讓我看到 FPGA 與 ASIC 的差異不只在「燒錄與光罩」，還包括標準元件、列式佈局、CTS、功耗與 DRC 等一整套實體驗證思維。

總結來說，EDA 並不是單一軟體，而是一條從高階描述通往矽晶片的自動化流水線。理解 EDA，就等於理解現代晶片是如何在人類無法手動處理的複雜度下，仍然被可靠地設計與製造出來。

## 參考資料

- AI 自製 EDA -- <https://github.com/ccc-eda/veryl2chip/>
- 線上使用 -- <https://ccc-eda.github.io/veryl2chip/web/dist/index.html>
- Nand2tetris 網頁專案 -- <https://github.com/ccc-js/hack-computer>
- 線上使用 -- <https://ccc-js.github.io/hack-computer/dist/hdl.html>
- EDA 電子書 -- <https://github.com/ccc-eda/eda-books/tree/main/book>
- 康乃爾大學的 IC 設計課程 -- <https://www.csl.cornell.edu/courses/ece5745/handouts.html>
