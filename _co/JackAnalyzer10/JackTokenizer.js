const fs = require('fs');

const KEYWORDS = new Set([
  'class', 'constructor', 'function', 'method', 'field', 'static',
  'var', 'int', 'char', 'boolean', 'void', 'true', 'false', 'null',
  'this', 'let', 'do', 'if', 'else', 'while', 'return'
]);

const SYMBOLS = new Set([
  '{', '}', '(', ')', '[', ']', '.', ',', ';',
  '+', '-', '*', '/', '&', '|', '<', '>', '=', '~'
]);

class JackTokenizer {
  constructor(filePath) {
    const rawCode = fs.readFileSync(filePath, 'utf8');
    this.tokens = this._tokenize(rawCode);
    this.currentIndex = -1;
    this.currentToken = null;
  }

  _tokenize(code) {
    // 1. 移除所有區塊註解 (/* ... */) 與單行註解 (// ...)
    let cleaned = code.replace(/\/\*[\s\S]*?\*\//g, ' ');
    cleaned = cleaned.replace(/\/\/.*$/gm, ' ');

    const tokens = [];
    let i = 0;
    const len = cleaned.length;

    while (i < len) {
      const ch = cleaned[i];

      // 跳過空白字元
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // 處理字串常數 ("...")
      if (ch === '"') {
        let strVal = '';
        i++; // 跳過開頭雙引號
        while (i < len && cleaned[i] !== '"') {
          strVal += cleaned[i];
          i++;
        }
        i++; // 跳過結尾雙引號
        tokens.push({ type: 'stringConstant', value: strVal });
        continue;
      }

      // 處理符號 (Symbol)
      if (SYMBOLS.has(ch)) {
        tokens.push({ type: 'symbol', value: ch });
        i++;
        continue;
      }

      // 處理整數常數 (IntegerConstant)
      if (/[0-9]/.test(ch)) {
        let numStr = '';
        while (i < len && /[0-9]/.test(cleaned[i])) {
          numStr += cleaned[i];
          i++;
        }
        tokens.push({ type: 'integerConstant', value: numStr });
        continue;
      }

      // 處理關鍵字 (Keyword) 或識別字 (Identifier)
      if (/[a-zA-Z_]/.test(ch)) {
        let word = '';
        while (i < len && /[a-zA-Z0-9_]/.test(cleaned[i])) {
          word += cleaned[i];
          i++;
        }
        if (KEYWORDS.has(word)) {
          tokens.push({ type: 'keyword', value: word });
        } else {
          tokens.push({ type: 'identifier', value: word });
        }
        continue;
      }

      i++;
    }

    return tokens;
  }

  hasMoreTokens() {
    return this.currentIndex + 1 < this.tokens.length;
  }

  advance() {
    if (this.hasMoreTokens()) {
      this.currentIndex++;
      this.currentToken = this.tokens[this.currentIndex];
    }
  }

  // 預讀下一個 Token（不移動指標，用於區分變數、陣列與副程式呼叫）
  peek() {
    if (this.hasMoreTokens()) {
      return this.tokens[this.currentIndex + 1];
    }
    return null;
  }

  tokenType() {
    return this.currentToken.type;
  }

  keyWord() {
    return this.currentToken.value;
  }

  symbol() {
    return this.currentToken.value;
  }

  identifier() {
    return this.currentToken.value;
  }

  intVal() {
    return parseInt(this.currentToken.value, 10);
  }

  stringVal() {
    return this.currentToken.value;
  }
}

module.exports = JackTokenizer;