const fs = require('fs');
const path = require('path');
const JackTokenizer = require('./JackTokenizer');
const CompilationEngine = require('./CompilationEngine');

function compileFile(jackFilePath) {
  const dir = path.dirname(jackFilePath);
  const baseName = path.basename(jackFilePath, '.jack');
  const vmOutPath = path.join(dir, `${baseName}.vm`);

  const tokenizer = new JackTokenizer(jackFilePath);
  const engine = new CompilationEngine(tokenizer, vmOutPath);
  engine.compileClass();

  console.log(`編譯完成: ${baseName}.jack -> ${baseName}.vm`);
}

function main() {
  const inputArg = process.argv[2] || '.';
  const resolvedPath = path.resolve(inputArg);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`找不到路徑: ${resolvedPath}`);
    process.exit(1);
  }

  const stat = fs.statSync(resolvedPath);
  if (stat.isFile()) {
    compileFile(resolvedPath);
  } else if (stat.isDirectory()) {
    const files = fs.readdirSync(resolvedPath).filter(f => f.endsWith('.jack'));
    if (files.length === 0) {
      console.log('該資料夾中沒有 .jack 檔案。');
      return;
    }
    for (const file of files) {
      compileFile(path.join(resolvedPath, file));
    }
  }
}

main();