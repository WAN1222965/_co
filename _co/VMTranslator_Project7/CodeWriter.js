const fs = require('fs');

class CodeWriter {
    constructor(outputPath, fileName) {
        this.outputPath = outputPath;
        this.fileName = fileName;
        this.lines = [];
        this.labelCounter = 0;
    }

    // 輔助方法：將暫存器 D 的值推入堆疊頂端並讓 SP + 1
    pushD() {
        this.lines.push(
            '@SP',
            'A=M',
            'M=D',
            '@SP',
            'M=M+1'
        );
    }

    writeArithmetic(command) {
        this.lines.push(`// ${command}`);
        if (command === 'add' || command === 'sub' || command === 'and' || command === 'or') {
            const opMap = {
                add: 'M=M+D',
                sub: 'M=M-D',
                and: 'M=M&D',
                or:  'M=M|D'
            };
            this.lines.push(
                '@SP',
                'AM=M-1',
                'D=M',
                'A=A-1',
                opMap[command]
            );
        } else if (command === 'neg' || command === 'not') {
            const op = command === 'neg' ? 'M=-M' : 'M=!M';
            this.lines.push(
                '@SP',
                'A=M-1',
                op
            );
        } else if (command === 'eq' || command === 'gt' || command === 'lt') {
            const jumpMap = {
                eq: 'JEQ',
                gt: 'JGT',
                lt: 'JLT'
            };
            const id = this.labelCounter++;
            this.lines.push(
                '@SP',
                'AM=M-1',
                'D=M',
                'A=A-1',
                'D=M-D',
                `@TRUE_${id}`,
                `D;${jumpMap[command]}`,
                '@SP',
                'A=M-1',
                'M=0',
                `@END_${id}`,
                '0;JMP',
                `(TRUE_${id})`,
                '@SP',
                'A=M-1',
                'M=-1',
                `(END_${id})`
            );
        }
    }

    writePushPop(command, segment, index) {
        this.lines.push(`// ${command} ${segment} ${index}`);

        const segmentMap = {
            local: 'LCL',
            argument: 'ARG',
            this: 'THIS',
            that: 'THAT'
        };

        if (command === 'C_PUSH') {
            if (segment === 'constant') {
                this.lines.push(`@${index}`, 'D=A');
                this.pushD();
            } else if (segmentMap[segment]) {
                this.lines.push(
                    `@${index}`,
                    'D=A',
                    `@${segmentMap[segment]}`,
                    'A=M+D',
                    'D=M'
                );
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
                    `@${index}`,
                    'D=A',
                    `@${segmentMap[segment]}`,
                    'D=M+D',
                    '@R13',
                    'M=D',
                    '@SP',
                    'AM=M-1',
                    'D=M',
                    '@R13',
                    'A=M',
                    'M=D'
                );
            } else if (segment === 'temp') {
                this.lines.push(
                    '@SP',
                    'AM=M-1',
                    'D=M',
                    `@${5 + index}`,
                    'M=D'
                );
            } else if (segment === 'pointer') {
                const ptr = index === 0 ? 'THIS' : 'THAT';
                this.lines.push(
                    '@SP',
                    'AM=M-1',
                    'D=M',
                    `@${ptr}`,
                    'M=D'
                );
            } else if (segment === 'static') {
                this.lines.push(
                    '@SP',
                    'AM=M-1',
                    'D=M',
                    `@${this.fileName}.${index}`,
                    'M=D'
                );
            }
        }
    }

    close() {
        fs.writeFileSync(this.outputPath, this.lines.join('\n') + '\n', 'utf-8');
    }
}

module.exports = CodeWriter;