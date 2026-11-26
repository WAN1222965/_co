const fs = require('fs');
const path = require('path');
const JackTokenizer = require('./JackTokenizer');
const CompilationEngine = require('./CompilationEngine');

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

function processJackFile(jackFilePath, outputDir) {
  const baseName = path.basename(jackFilePath, '.jack');

  // 1. 生成 XxxT.xml (Tokenizer 測試檔)
  const tokenizerForT = new JackTokenizer(jackFilePath);
  const tLines = ['<tokens>'];
  while (tokenizerForT.hasMoreTokens()) {
    tokenizerForT.advance();
    const type = tokenizerForT.tokenType();
    const val = escapeXml(tokenizerForT.currentToken.value);
    tLines.push(`<${type}> ${val} </${type}>`);
  }
  tLines.push('</tokens>');
  const tOutPath = path.join(outputDir, `${baseName}T.xml`);
  fs.writeFileSync(tOutPath, tLines.join('\n') + '\n', 'utf8');

  // 2. 生成 Xxx.xml (完整語法樹檔)
  const tokenizerForParser = new JackTokenizer(jackFilePath);
  const xmlOutPath = path.join(outputDir, `${baseName}.xml`);
  const engine = new CompilationEngine(tokenizerForParser, xmlOutPath);
  engine.compileClass();

  console.log(`已解析: ${baseName}.jack -> ${baseName}T.xml, ${baseName}.xml`);
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
    const outDir = path.join(path.dirname(resolvedPath), 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
    processJackFile(resolvedPath, outDir);
  } else if (stat.isDirectory()) {
    const outDir = path.join(resolvedPath, 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    const files = fs.readdirSync(resolvedPath).filter(f => f.endsWith('.jack'));
    if (files.length === 0) {
      console.log('該資料夾中沒有 .jack 檔案。');
      return;
    }
    for (const file of files) {
      processJackFile(path.join(resolvedPath, file), outDir);
    }
  }
}

main();