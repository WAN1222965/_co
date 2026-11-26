const fs = require('fs');

class VMWriter {
  constructor(outputPath) {
    this.outputPath = outputPath;
    this.lines = [];
  }

  writePush(segment, index) {
    this.lines.push(`push ${segment} ${index}`);
  }

  writePop(segment, index) {
    this.lines.push(`pop ${segment} ${index}`);
  }

  writeArithmetic(command) {
    this.lines.push(command);
  }

  writeLabel(label) {
    this.lines.push(`label ${label}`);
  }

  writeGoto(label) {
    this.lines.push(`goto ${label}`);
  }

  writeIf(label) {
    this.lines.push(`if-goto ${label}`);
  }

  writeCall(name, nArgs) {
    this.lines.push(`call ${name} ${nArgs}`);
  }

  writeFunction(name, nLocals) {
    this.lines.push(`function ${name} ${nLocals}`);
  }

  writeReturn() {
    this.lines.push('return');
  }

  close() {
    fs.writeFileSync(this.outputPath, this.lines.join('\n') + '\n', 'utf8');
  }
}

module.exports = VMWriter;