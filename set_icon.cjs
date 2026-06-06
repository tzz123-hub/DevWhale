const fs = require('fs');
const path = require('path');

const DESKTOP_WHALE_ICO = 'C:\\Users\\DELL\\Desktop\\whale.ico';
const PROJECT_ROOT = 'C:\\Users\\DELL\\Desktop\\TUI\\codewhale-windows-x64\\bob前端';

console.log('开始设置DevWhale图标...\n');

// 检查源文件是否存在
if (!fs.existsSync(DESKTOP_WHALE_ICO)) {
  console.error('❌ 错误：桌面上找不到 whale.ico 文件！');
  process.exit(1);
}

console.log('✅ 找到源文件：whale.ico\n');

// 目标位置
const targets = [
  path.join(PROJECT_ROOT, 'build', 'icon.ico'),
  path.join(PROJECT_ROOT, 'dist', 'icon.ico'),
  path.join(PROJECT_ROOT, 'dist-electron', 'icon.ico'),
  path.join(PROJECT_ROOT, 'public', 'icon.ico'),
];

// 复制文件到所有目标位置
targets.forEach(target => {
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(DESKTOP_WHALE_ICO, target);
  console.log(`✅ 复制到：${target}`);
});

console.log('\n📋 图标文件已复制完成！');
console.log('\n接下来需要更新配置文件...\n');

// 更新 package.json
const pkgPath = path.join(PROJECT_ROOT, 'package.json');
let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
pkg.build.icon = 'build/icon.ico';
pkg.build.win = {
  ...pkg.build.win,
  icon: 'build/icon.ico',
};
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log('✅ 已更新 package.json\n');

// 更新 electron/main.ts
const mainTsPath = path.join(PROJECT_ROOT, 'electron', 'main.ts');
let mainTs = fs.readFileSync(mainTsPath, 'utf-8');
mainTs = mainTs.replace(
  "const appIcon = path.join(__dirname, 'icon.png');",
  "const appIcon = path.join(__dirname, 'icon.ico');"
);
fs.writeFileSync(mainTsPath, mainTs, 'utf-8');
console.log('✅ 已更新 electron/main.ts\n');

console.log('🎉 DevWhale图标设置完成！');
console.log('\n下一步：如果要打包应用，请运行：npm run electron:build');
console.log('如果只是开发测试，图标会在下次构建时应用。');
