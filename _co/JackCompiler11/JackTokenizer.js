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
    let cleaned = code.replace(/\/\*[\s\S]*?\*\//g, ' ');
    cleaned = cleaned.replace(/\/\/.*$/gm, ' ');

    const tokens = [];
    let i = 0;
    const len = cleaned.length;

    while (i < len) {
      const ch = cleaned[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (ch === '"') {
        let strVal = '';
        i++;
        while (i < len && cleaned[i] !== '"') {
          strVal += cleaned[i];
          i++;
        }
        i++;
        tokens.push({ type: 'stringConstant', value: strVal });
        continue;
      }
      if (SYMBOLS.has(ch)) {
        tokens.push({ type: 'symbol', value: ch });
        i++;
        continue;
      }
      if (/[0-9]/.test(ch)) {
        let numStr = '';
        while (i < len && /[0-9]/.test(cleaned[i])) {
          numStr += cleaned[i];
          i++;
        }
        tokens.push({ type: 'integerConstant', value: numStr });
        continue;
      }
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