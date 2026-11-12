const fs = require('fs');
const path = require('path');

const COMP_TABLE = {
    '0':   '0101010', '1':   '0111111', '-1':  '0111010',
    'D':   '0001100', 'A':   '0110000', '!D':  '0001101',
    '!A':  '0110001', '-D':  '0001111', '-A':  '0110011',
    'D+1': '0011111', 'A+1': '0110111', 'D-1': '0001110',
    'A-1': '0110010', 'D+A': '0000010', 'D-A': '0010011',
    'A-D': '0000111', 'D&A': '0000000', 'D|A': '0010101',
    'M':   '1110000', '!M':  '1110001', '-M':  '1110011',
    'M+1': '1110111', 'M-1': '1110010', 'D+M': '1000010',
    'D-M': '1010011', 'M-D': '1000111', 'D&M': '1000000',
    'D|M': '1010101'
};

const DEST_TABLE = {
    null:  '000',
    'M':   '001',
    'D':   '010',
    'MD':  '011', 'DM':  '011',
    'A':   '100',
    'AM':  '101', 'MA':  '101',
    'AD':  '110', 'DA':  '110',
    'AMD': '111', 'ADM': '111'
};

const JUMP_TABLE = {
    null:  '000',
    'JGT': '001', 'JEQ': '010', 'JGE': '011',
    'JLT': '100', 'JNE': '101', 'JLE': '110',
    'JMP': '111'
};

function createSymbolTable() {
    const table = {
        SP: 0, LCL: 1, ARG: 2, THIS: 3, THAT: 4,
        SCREEN: 16384, KBD: 24576
    };
    for (let i = 0; i <= 15; i++) {
        table[`R${i}`] = i;
    }
    return table;
}

function cleanLines(rawText) {
    return rawText
        .split(/\r?\n/)
        .map(line => line.replace(/\/\/.*$/, '').trim())
        .filter(line => line.length > 0);
}

function assemble(asmFilePath) {
    const rawContent = fs.readFileSync(asmFilePath, 'utf-8');
    const lines = cleanLines(rawContent);
    const symbolTable = createSymbolTable();

    // 第一階段掃描：記錄所有 (LABEL) 標籤的指令行號
    let romAddress = 0;
    for (const line of lines) {
        if (line.startsWith('(') && line.endsWith(')')) {
            const label = line.slice(1, -1);
            symbolTable[label] = romAddress;
        } else {
            romAddress++;
        }
    }

    // 第二階段掃描：逐行翻譯成 16 位元二進位碼
    const binaryOutput = [];
    let nextRamAddress = 16;

    for (const line of lines) {
        if (line.startsWith('(') && line.endsWith(')')) {
            continue;
        }

        if (line.startsWith('@')) {
            const symbol = line.slice(1);
            let address;

            if (/^\d+$/.test(symbol)) {
                address = parseInt(symbol, 10);
            } else {
                if (!(symbol in symbolTable)) {
                    symbolTable[symbol] = nextRamAddress++;
                }
                address = symbolTable[symbol];
            }

            const binaryA = '0' + address.toString(2).padStart(15, '0');
            binaryOutput.push(binaryA);
        } else {
            let dest = null;
            let comp = line;
            let jump = null;

            if (comp.includes(';')) {
                const parts = comp.split(';');
                comp = parts[0].trim();
                jump = parts[1].trim();
            }
            if (comp.includes('=')) {
                const parts = comp.split('=');
                dest = parts[0].trim();
                comp = parts[1].trim();
            }

            const binaryC = '111' + COMP_TABLE[comp] + DEST_TABLE[dest] + JUMP_TABLE[jump];
            binaryOutput.push(binaryC);
        }
    }

    const parsedPath = path.parse(asmFilePath);
const outFilePath = path.join(parsedPath.dir, `${parsedPath.name}1.hack`);
fs.writeFileSync(outFilePath, binaryOutput.join('\n') + '\n', 'utf-8');
    console.log(`組譯完成：${outFilePath}`);
}

const targetFile = process.argv[2];
if (!targetFile) {
    console.error('請指定要組譯的 .asm 檔案，例如：node add/add.js add/Add.asm');
    process.exit(1);
}
assemble(targetFile);