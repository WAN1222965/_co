const fs = require('fs');

class Parser {
    constructor(inputPath) {
        const content = fs.readFileSync(inputPath, 'utf-8');
        this.commands = content
            .split(/\r?\n/)
            .map(line => {
                const commentIndex = line.indexOf('//');
                if (commentIndex !== -1) {
                    line = line.substring(0, commentIndex);
                }
                return line.trim();
            })
            .filter(line => line.length > 0);

        this.currentIndex = -1;
        this.currentCommand = '';
    }

    hasMoreLines() {
        return this.currentIndex + 1 < this.commands.length;
    }

    advance() {
        this.currentIndex++;
        this.currentCommand = this.commands[this.currentIndex];
    }

    commandType() {
        const firstWord = this.currentCommand.split(/\s+/)[0];
        const typeMap = {
            push: 'C_PUSH',
            pop: 'C_POP',
            label: 'C_LABEL',
            goto: 'C_GOTO',
            'if-goto': 'C_IF',
            function: 'C_FUNCTION',
            call: 'C_CALL',
            return: 'C_RETURN'
        };
        return typeMap[firstWord] || 'C_ARITHMETIC';
    }

    arg1() {
        const parts = this.currentCommand.split(/\s+/);
        if (this.commandType() === 'C_ARITHMETIC') {
            return parts[0];
        }
        return parts[1];
    }

    arg2() {
        const parts = this.currentCommand.split(/\s+/);
        return parseInt(parts[2], 10);
    }
}

module.exports = Parser;