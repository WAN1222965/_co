const fs = require('fs');
const path = require('path');
const Parser = require('./Parser');
const CodeWriter = require('./CodeWriter');

const args = process.argv.slice(2);
if (args.length === 0) {
    console.log('請提供 .vm 檔案或資料夾路徑');
    process.exit(1);
}

const inputPath = path.resolve(args[0]);
const stat = fs.statSync(inputPath);

let vmFiles = [];
let outputPath = '';
let shouldWriteBootstrap = false;

if (stat.isDirectory()) {
    // 輸入為資料夾：找出所有 .vm 檔，輸出為 資料夾名稱.asm，並寫入 Bootstrap code
    const folderName = path.basename(inputPath);
    outputPath = path.join(inputPath, `${folderName}.asm`);
    vmFiles = fs.readdirSync(inputPath)
        .filter(file => file.endsWith('.vm'))
        .map(file => path.join(inputPath, file));
    shouldWriteBootstrap = vmFiles.length > 1;
} else {
    // 輸入為單一 .vm 檔：不寫入 Bootstrap code
    outputPath = inputPath.replace(/\.vm$/, '.asm');
    vmFiles = [inputPath];
    shouldWriteBootstrap = false;
}

const codeWriter = new CodeWriter(outputPath);
if (shouldWriteBootstrap) {
    codeWriter.writeInit();
}

for (const vmFile of vmFiles) {
    const fileName = path.basename(vmFile, '.vm');
    codeWriter.setFileName(fileName);
    const parser = new Parser(vmFile);

    while (parser.hasMoreLines()) {
        parser.advance();
        const type = parser.commandType();
        if (type === 'C_ARITHMETIC') {
            codeWriter.writeArithmetic(parser.arg1());
        } else if (type === 'C_PUSH' || type === 'C_POP') {
            codeWriter.writePushPop(type, parser.arg1(), parser.arg2());
        } else if (type === 'C_LABEL') {
            codeWriter.writeLabel(parser.arg1());
        } else if (type === 'C_GOTO') {
            codeWriter.writeGoto(parser.arg1());
        } else if (type === 'C_IF') {
            codeWriter.writeIf(parser.arg1());
        } else if (type === 'C_FUNCTION') {
            codeWriter.writeFunction(parser.arg1(), parser.arg2());
        } else if (type === 'C_CALL') {
            codeWriter.writeCall(parser.arg1(), parser.arg2());
        } else if (type === 'C_RETURN') {
            codeWriter.writeReturn();
        }
    }
}

codeWriter.close();
console.log(`轉譯完成，已產生: ${outputPath}`);