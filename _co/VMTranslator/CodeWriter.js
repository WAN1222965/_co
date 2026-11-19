const fs = require('fs');

class CodeWriter {
    constructor(outputPath) {
        this.outputPath = outputPath;
        this.fileName = '';
        this.currentFunction = 'null';
        this.lines = [];
        this.labelCounter = 0;
    }

    setFileName(fileName) {
        this.fileName = fileName;
    }

    pushD() {
        this.lines.push('@SP', 'A=M', 'M=D', '@SP', 'M=M+1');
    }

    // Bootstrap code：設定 SP = 256 並呼叫 Sys.init
    writeInit() {
        this.lines.push(
            '// Bootstrap code',
            '@256',
            'D=A',
            '@SP',
            'M=D'
        );
        this.writeCall('Sys.init', 0);
    }

    writeArithmetic(command) {
        this.lines.push(`// ${command}`);
        if (command === 'add' || command === 'sub' || command === 'and' || command === 'or') {
            const opMap = { add: 'M=M+D', sub: 'M=M-D', and: 'M=M&D', or: 'M=M|D' };
            this.lines.push('@SP', 'AM=M-1', 'D=M', 'A=A-1', opMap[command]);
        } else if (command === 'neg' || command === 'not') {
            const op = command === 'neg' ? 'M=-M' : 'M=!M';
            this.lines.push('@SP', 'A=M-1', op);
        } else if (command === 'eq' || command === 'gt' || command === 'lt') {
            const jumpMap = { eq: 'JEQ', gt: 'JGT', lt: 'JLT' };
            const id = this.labelCounter++;
            this.lines.push(
                '@SP', 'AM=M-1', 'D=M', 'A=A-1', 'D=M-D',
                `@TRUE_${id}`, `D;${jumpMap[command]}`,
                '@SP', 'A=M-1', 'M=0',
                `@END_${id}`, '0;JMP',
                `(TRUE_${id})`, '@SP', 'A=M-1', 'M=-1',
                `(END_${id})`
            );
        }
    }

    writePushPop(command, segment, index) {
        this.lines.push(`// ${command} ${segment} ${index}`);
        const segmentMap = { local: 'LCL', argument: 'ARG', this: 'THIS', that: 'THAT' };

        if (command === 'C_PUSH') {
            if (segment === 'constant') {
                this.lines.push(`@${index}`, 'D=A');
                this.pushD();
            } else if (segmentMap[segment]) {
                this.lines.push(`@${index}`, 'D=A', `@${segmentMap[segment]}`, 'A=M+D', 'D=M');
                this.pushD();
            } else if (segment === 'temp') {
                this.lines.push(`@${5 + index}`, 'D=M');
                this.pushD();
            } else if (segment === 'pointer') {
                const ptr = index === 0 ? 'THIS' : 'THAT';
                this.lines.push(`@${ptr}`, 'D=M');
                this.pushD();
            } else if (segment === 'static') {
                this.lines.push(`@${this.fileName}.${index}`, 'D=M');
                this.pushD();
            }
        } else if (command === 'C_POP') {
            if (segmentMap[segment]) {
                this.lines.push(
                    `@${index}`, 'D=A', `@${segmentMap[segment]}`, 'D=M+D',
                    '@R13', 'M=D',
                    '@SP', 'AM=M-1', 'D=M',
                    '@R13', 'A=M', 'M=D'
                );
            } else if (segment === 'temp') {
                this.lines.push('@SP', 'AM=M-1', 'D=M', `@${5 + index}`, 'M=D');
            } else if (segment === 'pointer') {
                const ptr = index === 0 ? 'THIS' : 'THAT';
                this.lines.push('@SP', 'AM=M-1', 'D=M', `@${ptr}`, 'M=D');
            } else if (segment === 'static') {
                this.lines.push('@SP', 'AM=M-1', 'D=M', `@${this.fileName}.${index}`, 'M=D');
            }
        }
    }

    // 分支指令（加上函式名稱前綴避免不同函式內的標籤衝突）
    writeLabel(label) {
        this.lines.push(`// label ${label}`, `(${this.currentFunction}$${label})`);
    }

    writeGoto(label) {
        this.lines.push(`// goto ${label}`, `@${this.currentFunction}$${label}`, '0;JMP');
    }

    writeIf(label) {
        this.lines.push(
            `// if-goto ${label}`,
            '@SP', 'AM=M-1', 'D=M',
            `@${this.currentFunction}$${label}`, 'D;JNE'
        );
    }

    // 函式宣告：建立進入點標籤，並將 numVars 個區域變數初始化為 0
    writeFunction(functionName, numVars) {
        this.currentFunction = functionName;
        this.lines.push(`// function ${functionName} ${numVars}`, `(${functionName})`);
        for (let i = 0; i < numVars; i++) {
            this.lines.push('@SP', 'A=M', 'M=0', '@SP', 'M=M+1');
        }
    }

    // 呼叫函式：保存呼叫端狀態 -> 設定新的 ARG 與 LCL -> 跳轉至目標函式
    writeCall(functionName, numArgs) {
        const returnLabel = `${functionName}$ret.${this.labelCounter++}`;
        this.lines.push(`// call ${functionName} ${numArgs}`);

        // 1. 推入返回位址
        this.lines.push(`@${returnLabel}`, 'D=A');
        this.pushD();

        // 2. 推入 LCL, ARG, THIS, THAT
        for (const seg of ['LCL', 'ARG', 'THIS', 'THAT']) {
            this.lines.push(`@${seg}`, 'D=M');
            this.pushD();
        }

        // 3. ARG = SP - 5 - numArgs
        this.lines.push('@SP', 'D=M', `@${5 + numArgs}`, 'D=D-A', '@ARG', 'M=D');

        // 4. LCL = SP
        this.lines.push('@SP', 'D=M', '@LCL', 'M=D');

        // 5. 跳轉並宣告返回標籤
        this.lines.push(`@${functionName}`, '0;JMP', `(${returnLabel})`);
    }

    // 函式返回：恢復呼叫端的段指標與堆疊狀態，並跳回返回位址
    writeReturn() {
        this.lines.push('// return');

        // FRAME (R13) = LCL
        this.lines.push('@LCL', 'D=M', '@R13', 'M=D');

        // RET (R14) = *(FRAME - 5)（必須先存起來，避免 numArgs=0 時被 *ARG 覆蓋）
        this.lines.push('@5', 'A=D-A', 'D=M', '@R14', 'M=D');

        // *ARG = pop()（將回傳值放到呼叫端的堆疊頂端）
        this.lines.push('@SP', 'AM=M-1', 'D=M', '@ARG', 'A=M', 'M=D');

        // SP = ARG + 1
        this.lines.push('@ARG', 'D=M+1', '@SP', 'M=D');

        // 依序恢復 THAT, THIS, ARG, LCL
        for (const seg of ['THAT', 'THIS', 'ARG', 'LCL']) {
            this.lines.push('@R13', 'AM=M-1', 'D=M', `@${seg}`, 'M=D');
        }
        this.lines.push('@R14', 'A=M', '0;JMP');
    }

    close() {
        fs.writeFileSync(this.outputPath, this.lines.join('\n') + '\n', 'utf-8');
    }
}

module.exports = CodeWriter;