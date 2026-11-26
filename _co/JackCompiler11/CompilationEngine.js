const SymbolTable = require('./SymbolTable');
const VMWriter = require('./VMWriter');

const OP_MAP = {
  '+': 'add',
  '-': 'sub',
  '&': 'and',
  '|': 'or',
  '<': 'lt',
  '>': 'gt',
  '=': 'eq'
};

const KEYWORD_CONSTANTS = new Set(['true', 'false', 'null', 'this']);

class CompilationEngine {
  constructor(tokenizer, outputPath) {
    this.tokenizer = tokenizer;
    this.symbolTable = new SymbolTable();
    this.vmWriter = new VMWriter(outputPath);
    this.className = '';
    this.labelCounter = 0;
  }

  _nextLabel(prefix) {
    const label = `${prefix}_${this.labelCounter}`;
    this.labelCounter++;
    return label;
  }

  _eat() {
    const val = this.tokenizer.currentToken.value;
    if (this.tokenizer.hasMoreTokens()) {
      this.tokenizer.advance();
    }
    return val;
  }

  _kindToSegment(kind) {
    switch (kind) {
      case 'STATIC': return 'static';
      case 'FIELD':  return 'this';
      case 'ARG':    return 'argument';
      case 'VAR':    return 'local';
      default:       return null;
    }
  }

  compileClass() {
    this.tokenizer.advance();
    this._eat(); // 'class'
    this.className = this._eat(); // className
    this._eat(); // '{'

    while (
      this.tokenizer.tokenType() === 'keyword' &&
      (this.tokenizer.keyWord() === 'static' || this.tokenizer.keyWord() === 'field')
    ) {
      this.compileClassVarDec();
    }

    while (
      this.tokenizer.tokenType() === 'keyword' &&
      ['constructor', 'function', 'method'].includes(this.tokenizer.keyWord())
    ) {
      this.compileSubroutine();
    }

    this._eat(); // '}'
    this.vmWriter.close();
  }

  compileClassVarDec() {
    const kind = this._eat().toUpperCase(); // 'STATIC' | 'FIELD'
    const type = this._eat();
    let varName = this._eat();
    this.symbolTable.define(varName, type, kind);

    while (this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === ',') {
      this._eat(); // ','
      varName = this._eat();
      this.symbolTable.define(varName, type, kind);
    }

    this._eat(); // ';'
  }

  compileSubroutine() {
    this.symbolTable.startSubroutine();

    const subType = this._eat(); // 'constructor' | 'function' | 'method'
    this._eat(); // return type ('void' | type)
    const subName = this._eat();

    // 若為 method，argument 0 保留給物件本身的 this
    if (subType === 'method') {
      this.symbolTable.define('this', this.className, 'ARG');
    }

    this._eat(); // '('
    this.compileParameterList();
    this._eat(); // ')'

    // 進入 subroutineBody
    this._eat(); // '{'
    while (this.tokenizer.tokenType() === 'keyword' && this.tokenizer.keyWord() === 'var') {
      this.compileVarDec();
    }

    const nLocals = this.symbolTable.varCount('VAR');
    this.vmWriter.writeFunction(`${this.className}.${subName}`, nLocals);

    // 根據函式類型初始化 this 指標
    if (subType === 'constructor') {
      const nFields = this.symbolTable.varCount('FIELD');
      this.vmWriter.writePush('constant', nFields);
      this.vmWriter.writeCall('Memory.alloc', 1);
      this.vmWriter.writePop('pointer', 0);
    } else if (subType === 'method') {
      this.vmWriter.writePush('argument', 0);
      this.vmWriter.writePop('pointer', 0);
    }

    this.compileStatements();
    this._eat(); // '}'
  }

  compileParameterList() {
    if (!(this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === ')')) {
      let type = this._eat();
      let name = this._eat();
      this.symbolTable.define(name, type, 'ARG');

      while (this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === ',') {
        this._eat(); // ','
        type = this._eat();
        name = this._eat();
        this.symbolTable.define(name, type, 'ARG');
      }
    }
  }

  compileVarDec() {
    this._eat(); // 'var'
    const type = this._eat();
    let name = this._eat();
    this.symbolTable.define(name, type, 'VAR');

    while (this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === ',') {
      this._eat(); // ','
      name = this._eat();
      this.symbolTable.define(name, type, 'VAR');
    }

    this._eat(); // ';'
  }

  compileStatements() {
    while (
      this.tokenizer.tokenType() === 'keyword' &&
      ['let', 'if', 'while', 'do', 'return'].includes(this.tokenizer.keyWord())
    ) {
      const kw = this.tokenizer.keyWord();
      if (kw === 'let') this.compileLet();
      else if (kw === 'if') this.compileIf();
      else if (kw === 'while') this.compileWhile();
      else if (kw === 'do') this.compileDo();
      else if (kw === 'return') this.compileReturn();
    }
  }

  compileLet() {
    this._eat(); // 'let'
    const varName = this._eat();
    const kind = this.symbolTable.kindOf(varName);
    const segment = this._kindToSegment(kind);
    const index = this.symbolTable.indexOf(varName);

    let isArray = false;
    if (this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === '[') {
      isArray = true;
      this._eat(); // '['
      this.compileExpression(); // 1. 計算索引值
      this._eat(); // ']'

      this.vmWriter.writePush(segment, index); // 2. 推入陣列基底位址
      this.vmWriter.writeArithmetic('add');     // 3. 目標位址 (base + index) 留在堆疊頂端
    }

    this._eat(); // '='
    this.compileExpression(); // 4. 計算右側賦值結果
    this._eat(); // ';'

    if (isArray) {
      this.vmWriter.writePop('temp', 0);     // 5. 將右側結果暫存到 temp 0
      this.vmWriter.writePop('pointer', 1);  // 6. 從堆疊取出剛才算好的目標位址，放入 THAT (pointer 1)
      this.vmWriter.writePush('temp', 0);    // 7. 取回右側結果
      this.vmWriter.writePop('that', 0);     // 8. 寫入目標陣列元素
    } else {
      this.vmWriter.writePop(segment, index);
    }
  }

  compileIf() {
    const elseLabel = this._nextLabel('IF_ELSE');
    const endLabel = this._nextLabel('IF_END');

    this._eat(); // 'if'
    this._eat(); // '('
    this.compileExpression();
    this._eat(); // ')'

    this.vmWriter.writeArithmetic('not');
    this.vmWriter.writeIf(elseLabel);

    this._eat(); // '{'
    this.compileStatements();
    this._eat(); // '}'
    this.vmWriter.writeGoto(endLabel);

    this.vmWriter.writeLabel(elseLabel);
    if (this.tokenizer.tokenType() === 'keyword' && this.tokenizer.keyWord() === 'else') {
      this._eat(); // 'else'
      this._eat(); // '{'
      this.compileStatements();
      this._eat(); // '}'
    }
    this.vmWriter.writeLabel(endLabel);
  }

  compileWhile() {
    const expLabel = this._nextLabel('WHILE_EXP');
    const endLabel = this._nextLabel('WHILE_END');

    this.vmWriter.writeLabel(expLabel);
    this._eat(); // 'while'
    this._eat(); // '('
    this.compileExpression();
    this._eat(); // ')'

    this.vmWriter.writeArithmetic('not');
    this.vmWriter.writeIf(endLabel);

    this._eat(); // '{'
    this.compileStatements();
    this._eat(); // '}'

    this.vmWriter.writeGoto(expLabel);
    this.vmWriter.writeLabel(endLabel);
  }

  compileDo() {
    this._eat(); // 'do'
    this._compileSubroutineCall();
    this._eat(); // ';'
    // do 陳述句會丟棄回傳值
    this.vmWriter.writePop('temp', 0);
  }

  compileReturn() {
    this._eat(); // 'return'
    if (!(this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === ';')) {
      this.compileExpression();
    } else {
      // void 函式必須回傳 0
      this.vmWriter.writePush('constant', 0);
    }
    this._eat(); // ';'
    this.vmWriter.writeReturn();
  }

  compileExpression() {
    this.compileTerm();

    while (
      this.tokenizer.tokenType() === 'symbol' &&
      (OP_MAP[this.tokenizer.symbol()] || this.tokenizer.symbol() === '*' || this.tokenizer.symbol() === '/')
    ) {
      const op = this._eat();
      this.compileTerm();

      if (op === '*') {
        this.vmWriter.writeCall('Math.multiply', 2);
      } else if (op === '/') {
        this.vmWriter.writeCall('Math.divide', 2);
      } else {
        this.vmWriter.writeArithmetic(OP_MAP[op]);
      }
    }
  }

  compileTerm() {
    const type = this.tokenizer.tokenType();

    if (type === 'integerConstant') {
      const val = this._eat();
      this.vmWriter.writePush('constant', val);
    } else if (type === 'stringConstant') {
      const str = this._eat();
      this.vmWriter.writePush('constant', str.length);
      this.vmWriter.writeCall('String.new', 1);
      for (let i = 0; i < str.length; i++) {
        this.vmWriter.writePush('constant', str.charCodeAt(i));
        this.vmWriter.writeCall('String.appendChar', 2);
      }
    } else if (type === 'keyword' && KEYWORD_CONSTANTS.has(this.tokenizer.keyWord())) {
      const kw = this._eat();
      if (kw === 'true') {
        this.vmWriter.writePush('constant', 0);
        this.vmWriter.writeArithmetic('not'); // true 在 Jack 中為 -1
      } else if (kw === 'false' || kw === 'null') {
        this.vmWriter.writePush('constant', 0);
      } else if (kw === 'this') {
        this.vmWriter.writePush('pointer', 0);
      }
    } else if (type === 'symbol' && this.tokenizer.symbol() === '(') {
      this._eat(); // '('
      this.compileExpression();
      this._eat(); // ')'
    } else if (type === 'symbol' && (this.tokenizer.symbol() === '-' || this.tokenizer.symbol() === '~')) {
      const unaryOp = this._eat();
      this.compileTerm();
      this.vmWriter.writeArithmetic(unaryOp === '-' ? 'neg' : 'not');
    } else if (type === 'identifier') {
      const next = this.tokenizer.peek();
      if (next && next.type === 'symbol' && next.value === '[') {
        // 陣列取值：varName[expression]
        const varName = this._eat();
        const segment = this._kindToSegment(this.symbolTable.kindOf(varName));
        const index = this.symbolTable.indexOf(varName);

        this._eat(); // '['
        this.compileExpression();
        this._eat(); // ']'

        this.vmWriter.writePush(segment, index);
        this.vmWriter.writeArithmetic('add');
        this.vmWriter.writePop('pointer', 1);
        this.vmWriter.writePush('that', 0);
      } else if (next && next.type === 'symbol' && (next.value === '(' || next.value === '.')) {
        // 副程式呼叫
        this._compileSubroutineCall();
      } else {
        // 一般變數取值
        const varName = this._eat();
        const segment = this._kindToSegment(this.symbolTable.kindOf(varName));
        const index = this.symbolTable.indexOf(varName);
        this.vmWriter.writePush(segment, index);
      }
    }
  }

  _compileSubroutineCall() {
    const firstName = this._eat();
    let fullFuncName = '';
    let nArgs = 0;

    if (this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === '.') {
      this._eat(); // '.'
      const subName = this._eat();
      const kind = this.symbolTable.kindOf(firstName);

      if (kind !== 'NONE') {
        // 物件實例呼叫：obj.method(...) -> 需先將 obj 作為第 0 個參數推入堆疊
        const type = this.symbolTable.typeOf(firstName);
        const segment = this._kindToSegment(kind);
        const index = this.symbolTable.indexOf(firstName);
        this.vmWriter.writePush(segment, index);
        fullFuncName = `${type}.${subName}`;
        nArgs = 1;
      } else {
        // 靜態函式或建構子呼叫：ClassName.func(...)
        fullFuncName = `${firstName}.${subName}`;
      }
    } else {
      // 同類別內的方法呼叫：method(...) -> 需先將目前物件 this 推入堆疊
      this.vmWriter.writePush('pointer', 0);
      fullFuncName = `${this.className}.${firstName}`;
      nArgs = 1;
    }

    this._eat(); // '('
    nArgs += this.compileExpressionList();
    this._eat(); // ')'

    this.vmWriter.writeCall(fullFuncName, nArgs);
  }

  compileExpressionList() {
    let count = 0;
    if (!(this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === ')')) {
      this.compileExpression();
      count++;
      while (this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === ',') {
        this._eat(); // ','
        this.compileExpression();
        count++;
      }
    }
    return count;
  }
}

module.exports = CompilationEngine;