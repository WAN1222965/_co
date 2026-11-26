class SymbolTable {
  constructor() {
    this.classScope = new Map();
    this.subroutineScope = new Map();
    this.counts = {
      STATIC: 0,
      FIELD: 0,
      ARG: 0,
      VAR: 0
    };
  }

  // 進入新的 subroutine（constructor / function / method）時重置區域符號表
  startSubroutine() {
    this.subroutineScope.clear();
    this.counts.ARG = 0;
    this.counts.VAR = 0;
  }

  // 定義新變數並自動分配索引
  define(name, type, kind) {
    const index = this.counts[kind];
    this.counts[kind]++;
    const entry = { type, kind, index };

    if (kind === 'STATIC' || kind === 'FIELD') {
      this.classScope.set(name, entry);
    } else {
      this.subroutineScope.set(name, entry);
    }
  }

  varCount(kind) {
    return this.counts[kind];
  }

  kindOf(name) {
    if (this.subroutineScope.has(name)) return this.subroutineScope.get(name).kind;
    if (this.classScope.has(name)) return this.classScope.get(name).kind;
    return 'NONE';
  }

  typeOf(name) {
    if (this.subroutineScope.has(name)) return this.subroutineScope.get(name).type;
    if (this.classScope.has(name)) return this.classScope.get(name).type;
    return null;
  }

  indexOf(name) {
    if (this.subroutineScope.has(name)) return this.subroutineScope.get(name).index;
    if (this.classScope.has(name)) return this.classScope.get(name).index;
    return -1;
  }
}

module.exports = SymbolTable;