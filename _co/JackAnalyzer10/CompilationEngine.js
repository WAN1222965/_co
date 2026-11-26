const fs = require('fs');

const OP_SET = new Set(['+', '-', '*', '/', '&', '|', '<', '>', '=']);
const UNARY_OP_SET = new Set(['-', '~']);
const KEYWORD_CONSTANTS = new Set(['true', 'false', 'null', 'this']);

class CompilationEngine {
  constructor(tokenizer, outputPath) {
    this.tokenizer = tokenizer;
    this.outputPath = outputPath;
    this.outputLines = [];
    this.indentLevel = 0;
  }

  _escapeXml(str) {
    return String(str)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  _writeLine(text) {
    const indent = '  '.repeat(this.indentLevel);
    this.outputLines.push(indent + text);
  }

  _openTag(tag) {
    this._writeLine(`<${tag}>`);
    this.indentLevel++;
  }

  _closeTag(tag) {
    this.indentLevel--;
    this._writeLine(`</${tag}>`);
  }

  // 消耗目前 Token 並輸出對應 XML 標籤
  _eat() {
    const type = this.tokenizer.tokenType();
    const val = this._escapeXml(this.tokenizer.currentToken.value);
    this._writeLine(`<${type}> ${val} </${type}>`);
    if (this.tokenizer.hasMoreTokens()) {
      this.tokenizer.advance();
    }
  }

  compileClass() {
    this.tokenizer.advance(); // 讀取第一個 token ('class')
    this._openTag('class');

    this._eat(); // 'class'
    this._eat(); // className
    this._eat(); // '{'

    // 零或多個 classVarDec ('static' | 'field')
    while (
      this.tokenizer.tokenType() === 'keyword' &&
      (this.tokenizer.keyWord() === 'static' || this.tokenizer.keyWord() === 'field')
    ) {
      this.compileClassVarDec();
    }

    // 零或多個 subroutineDec ('constructor' | 'function' | 'method')
    while (
      this.tokenizer.tokenType() === 'keyword' &&
      ['constructor', 'function', 'method'].includes(this.tokenizer.keyWord())
    ) {
      this.compileSubroutine();
    }

    this._eat(); // '}'
    this._closeTag('class');

    fs.writeFileSync(this.outputPath, this.outputLines.join('\n') + '\n', 'utf8');
  }

  compileClassVarDec() {
    this._openTag('classVarDec');
    this._eat(); // 'static' | 'field'
    this._eat(); // type
    this._eat(); // varName

    while (this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === ',') {
      this._eat(); // ','
      this._eat(); // varName
    }

    this._eat(); // ';'
    this._closeTag('classVarDec');
  }

  compileSubroutine() {
    this._openTag('subroutineDec');
    this._eat(); // 'constructor' | 'function' | 'method'
    this._eat(); // 'void' | type
    this._eat(); // subroutineName
    this._eat(); // '('
    this.compileParameterList();
    this._eat(); // ')'
    this.compileSubroutineBody();
    this._closeTag('subroutineDec');
  }

  compileParameterList() {
    this._openTag('parameterList');

    // 若下一個 token 不是 ')'，代表至少有一個參數
    if (!(this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === ')')) {
      this._eat(); // type
      this._eat(); // varName

      while (this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === ',') {
        this._eat(); // ','
        this._eat(); // type
        this._eat(); // varName
      }
    }

    this._closeTag('parameterList');
  }

  compileSubroutineBody() {
    this._openTag('subroutineBody');
    this._eat(); // '{'

    while (this.tokenizer.tokenType() === 'keyword' && this.tokenizer.keyWord() === 'var') {
      this.compileVarDec();
    }

    this.compileStatements();
    this._eat(); // '}'
    this._closeTag('subroutineBody');
  }

  compileVarDec() {
    this._openTag('varDec');
    this._eat(); // 'var'
    this._eat(); // type
    this._eat(); // varName

    while (this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === ',') {
      this._eat(); // ','
      this._eat(); // varName
    }

    this._eat(); // ';'
    this._closeTag('varDec');
  }

  compileStatements() {
    this._openTag('statements');

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

    this._closeTag('statements');
  }

  compileLet() {
    this._openTag('letStatement');
    this._eat(); // 'let'
    this._eat(); // varName

    // 處理陣列索引 [expression]
    if (this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === '[') {
      this._eat(); // '['
      this.compileExpression();
      this._eat(); // ']'
    }

    this._eat(); // '='
    this.compileExpression();
    this._eat(); // ';'
    this._closeTag('letStatement');
  }

  compileIf() {
    this._openTag('ifStatement');
    this._eat(); // 'if'
    this._eat(); // '('
    this.compileExpression();
    this._eat(); // ')'
    this._eat(); // '{'
    this.compileStatements();
    this._eat(); // '}'

    if (this.tokenizer.tokenType() === 'keyword' && this.tokenizer.keyWord() === 'else') {
      this._eat(); // 'else'
      this._eat(); // '{'
      this.compileStatements();
      this._eat(); // '}'
    }

    this._closeTag('ifStatement');
  }

  compileWhile() {
    this._openTag('whileStatement');
    this._eat(); // 'while'
    this._eat(); // '('
    this.compileExpression();
    this._eat(); // ')'
    this._eat(); // '{'
    this.compileStatements();
    this._eat(); // '}'
    this._closeTag('whileStatement');
  }

  compileDo() {
    this._openTag('doStatement');
    this._eat(); // 'do'
    this._compileSubroutineCall();
    this._eat(); // ';'
    this._closeTag('doStatement');
  }

  compileReturn() {
    this._openTag('returnStatement');
    this._eat(); // 'return'

    if (!(this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === ';')) {
      this.compileExpression();
    }

    this._eat(); // ';'
    this._closeTag('returnStatement');
  }

  compileExpression() {
    this._openTag('expression');
    this.compileTerm();

    while (this.tokenizer.tokenType() === 'symbol' && OP_SET.has(this.tokenizer.symbol())) {
      this._eat(); // op
      this.compileTerm();
    }

    this._closeTag('expression');
  }

  compileTerm() {
    this._openTag('term');
    const type = this.tokenizer.tokenType();

    if (type === 'integerConstant' || type === 'stringConstant') {
      this._eat();
    } else if (type === 'keyword' && KEYWORD_CONSTANTS.has(this.tokenizer.keyWord())) {
      this._eat();
    } else if (type === 'symbol' && this.tokenizer.symbol() === '(') {
      this._eat(); // '('
      this.compileExpression();
      this._eat(); // ')'
    } else if (type === 'symbol' && UNARY_OP_SET.has(this.tokenizer.symbol())) {
      this._eat(); // unaryOp ('-' | '~')
      this.compileTerm();
    } else if (type === 'identifier') {
      const next = this.tokenizer.peek();
      if (next && next.type === 'symbol' && next.value === '[') {
        // 陣列存取：varName[expression]
        this._eat(); // varName
        this._eat(); // '['
        this.compileExpression();
        this._eat(); // ']'
      } else if (next && next.type === 'symbol' && (next.value === '(' || next.value === '.')) {
        // 副程式呼叫
        this._compileSubroutineCall();
      } else {
        // 一般變數名稱
        this._eat();
      }
    }

    this._closeTag('term');
  }

  _compileSubroutineCall() {
    this._eat(); // subroutineName 或 className / varName
    if (this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === '.') {
      this._eat(); // '.'
      this._eat(); // subroutineName
    }
    this._eat(); // '('
    this.compileExpressionList();
    this._eat(); // ')'
  }

  compileExpressionList() {
    this._openTag('expressionList');

    if (!(this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === ')')) {
      this.compileExpression();
      while (this.tokenizer.tokenType() === 'symbol' && this.tokenizer.symbol() === ',') {
        this._eat(); // ','
        this.compileExpression();
      }
    }

    this._closeTag('expressionList');
  }
}

module.exports = CompilationEngine;