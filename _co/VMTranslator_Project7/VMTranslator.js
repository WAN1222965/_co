const path = require('path');
const Parser = require('./Parser');
const CodeWriter = require('./CodeWriter');

const args = process.argv.slice(2);
if (args.length === 0) {
    console.log('請提供 .vm 檔案路徑，例如: node VMTranslator.js BasicTest.vm');
    process.exit(1);
}

const inputPath = path.resolve(args[0]);
const outputPath = inputPath.replace(/\.vm$/, '.asm');
const fileName = path.basename(inputPath, '.vm'); // 取得純檔名，例如 "StaticTest"

const parser = new Parser(inputPath);
const codeWriter = new CodeWriter(outputPath, fileName);

while (parser.hasMoreLines()) {
    parser.advance();
    const type = parser.commandType();
    if (type === 'C_ARITHMETIC') {
        codeWriter.writeArithmetic(parser.arg1());
    } else if (type === 'C_PUSH' || type === 'C_POP') {
        codeWriter.writePushPop(type, parser.arg1(), parser.arg2());
    }
}

codeWriter.close();
console.log(`轉譯完成，已產生: ${outputPath}`);