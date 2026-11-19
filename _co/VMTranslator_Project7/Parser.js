const fs = require('fs');

class Parser {
    constructor(inputPath) {
        const content = fs.readFileSync(inputPath, 'utf-8');
        this.commands = content
            .split(/\r?\n/)
            .map(line => {
                // 移除 // 註解與前後空白
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
        if (this.currentCommand.startsWith('push')) return 'C_PUSH';
        if (this.currentCommand.startsWith('pop')) return 'C_POP';
        return 'C_ARITHMETIC';
    }

    arg1() {
        const parts = this.currentCommand.split(/\s+/);
        if (this.commandType() === 'C_ARITHMETIC') {
            return parts[0]; // 例如 "add", "sub"
        }
        return parts[1]; // 例如 "constant", "local"
    }

    arg2() {
        const parts = this.currentCommand.split(/\s+/);
        return parseInt(parts[2], 10); // 例如索引值 7
    }
}

module.exports = Parser;