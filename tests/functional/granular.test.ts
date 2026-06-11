/**
 * granular.test.ts —— 极致颗粒度测试（纯 ESM）
 *
 * 覆盖：每一个导出函数的正常/边界/异常/特殊字符 全路径
 * 铁律：真实 localStorage、真实文件、真实命令、真实数据
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// 全部静态导入
import * as storage from '../../src/lib/storage';
import { cn, formatTime, formatDate } from '../../src/lib/utils';
import { isRunnable, getRunCommand } from '../../src/lib/shell';
import { __test as apiTest } from '../../src/lib/api';
import { __test as toolsTest, setCurrentProjectPath, getCurrentProjectPath } from '../../src/lib/tools';
import * as checkpoint from '../../src/lib/checkpoint';
import { isElectron, isTauri, fileExists } from '../../src/lib/tauriFs';
import { parseUnifiedDiff } from '../../src/components/DiffViewer';

const { stableStringify, makeUsage } = apiTest;
const { isAbsolutePath, resolvePath } = toolsTest;

const TMP = join(__dirname, '..', '..', '.tmp-granular');

beforeEach(() => { localStorage.clear(); if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true }); });
afterEach(() => { try { rmSync(TMP, { recursive: true, force: true }); } catch {} });

// ============================================================
// A. storage.ts — 全部 25+ 函数，逐个测试
// ============================================================
describe('A. storage.ts 全部函数', () => {

  describe('A1. 会话持久化', () => {
    it('loadConversations 空 → []', () => expect(storage.loadConversations()).toEqual([]));
    it('save + load 往返', () => {
      const c = [{ id:'c1', title:'T', project:'p', messages:[], createdAt:1, updatedAt:2 }];
      storage.saveConversations(c);
      expect(storage.loadConversations()).toEqual(c);
    });
    it('损坏 JSON → []', () => {
      localStorage.setItem('devwhale-conversations', '{broken');
      expect(storage.loadConversations()).toEqual([]);
    });
    it('空数组保存', () => { storage.saveConversations([]); expect(storage.loadConversations()).toEqual([]); });
  });

  describe('A2. 活跃会话 ID', () => {
    it('默认 null', () => expect(storage.loadActiveConversationId()).toBeNull());
    it('save/load', () => { storage.saveActiveConversationId('x'); expect(storage.loadActiveConversationId()).toBe('x'); });
    it('save null 删除', () => { storage.saveActiveConversationId('x'); storage.saveActiveConversationId(null); expect(storage.loadActiveConversationId()).toBeNull(); });
  });

  describe('A3. 项目', () => {
    it('默认 []', () => expect(storage.loadProjects()).toEqual([]));
    it('往返', () => { storage.saveProjects([{id:'p',name:'P',path:'/p'}]); expect(storage.loadProjects()).toHaveLength(1); });
  });

  describe('A4. 用户名', () => {
    it('默认 DevWhale', () => expect(storage.loadUsername()).toBe('DevWhale'));
    it('save/load', () => { storage.saveUsername('Alice'); expect(storage.loadUsername()).toBe('Alice'); });
  });

  describe('A5. 模式', () => {
    it('默认 yolo', () => expect(storage.loadMode()).toBe('yolo'));
    it('ask', () => { storage.saveMode('ask'); expect(storage.loadMode()).toBe('ask'); });
    it('plan', () => { storage.saveMode('plan'); expect(storage.loadMode()).toBe('plan'); });
  });

  describe('A6. 对话设置', () => {
    it('默认值', () => {
      const s = storage.loadChatSettings();
      expect(s.density).toBe('comfortable');
      expect(s.typingSpeed).toBe(20);
      expect(s.autoScroll).toBe(true);
    });
    it('修改保存', () => {
      storage.saveChatSettings({ density:'compact', codeTheme:'light', showTimestamps:false, autoScroll:false, typingSpeed:5 });
      const s = storage.loadChatSettings();
      expect(s.typingSpeed).toBe(5);
      expect(s.showTimestamps).toBe(false);
    });
  });

  describe('A7. API Key', () => {
    it('默认空', () => expect(storage.loadApiKey()).toBe(''));
    it('save/load', () => { storage.saveApiKey('sk-t'); expect(storage.loadApiKey()).toBe('sk-t'); });
    it('清空', () => { storage.saveApiKey('sk-t'); storage.saveApiKey(''); expect(storage.loadApiKey()).toBe(''); });
  });

  describe('A8. 模型选择', () => {
    it('默认 deepseek-v4-pro', () => expect(storage.loadSelectedModel()).toBe('deepseek-v4-pro'));
    it('切换', () => { storage.saveSelectedModel('gpt-4o'); expect(storage.loadSelectedModel()).toBe('gpt-4o'); });
  });

  describe('A9. 提供商', () => {
    it('默认 deepseek', () => expect(storage.loadProvider()).toBe('deepseek'));
    it('切换 openai', () => { storage.saveProvider('openai'); expect(storage.loadProvider()).toBe('openai'); });
    it('切换 anthropic', () => { storage.saveProvider('anthropic'); expect(storage.loadProvider()).toBe('anthropic'); });
    it('getProviderConfig 返回完整结构', () => {
      storage.saveProviderApiKey('deepseek', 'sk-ds');
      const c = storage.getProviderConfig('deepseek');
      expect(c.name).toBe('DeepSeek');
      expect(c.baseUrl).toBe('https://api.deepseek.com/v1');
      expect(c.apiKey).toBe('sk-ds');
    });
    it('loadProviderApiKey 空', () => expect(storage.loadProviderApiKey('openai')).toBe(''));
    it('saveProviderApiKey 往返', () => {
      storage.saveProviderApiKey('openai', 'sk-o');
      expect(storage.loadProviderApiKey('openai')).toBe('sk-o');
    });
  });

  describe('A10. API Key 迁移', () => {
    it('旧 key → deepseek', () => {
      localStorage.setItem('devwhale-api-key', 'oldkey');
      storage.migrateLegacyApiKey();
      expect(storage.loadProviderApiKey('deepseek')).toBe('oldkey');
      expect(localStorage.getItem('devwhale-api-key')).toBeNull();
    });
    it('已有 deepseek key → 不覆盖', () => {
      localStorage.setItem('devwhale-api-key', 'oldkey');
      localStorage.setItem('devwhale-apikey-deepseek', 'exist');
      storage.migrateLegacyApiKey();
      expect(storage.loadProviderApiKey('deepseek')).toBe('exist');
    });
  });

  describe('A11. isFirstLaunch', () => {
    it('无 key → true', () => expect(storage.isFirstLaunch()).toBe(true));
    it('有 key → false', () => {
      storage.saveProviderApiKey('deepseek', 'x');
      expect(storage.isFirstLaunch()).toBe(false);
    });
  });

  describe('A12. 通用偏好', () => {
    it('默认值', () => {
      const p = storage.loadGeneralPreferences();
      expect(p.linkOpenMode).toBe('always-ask');
      expect(p.fontSize).toBe(14);
      expect(p.language).toBe('zh');
      expect(p.privacyMode).toBe(false);
    });
    it('修改保存', () => {
      storage.saveGeneralPreferences({ linkOpenMode:'auto-browser', fontSize:20, language:'en', privacyMode:true });
      const p = storage.loadGeneralPreferences();
      expect(p.fontSize).toBe(20);
      expect(p.privacyMode).toBe(true);
    });
  });

  describe('A13. 规则与记忆', () => {
    it('默认空', () => {
      const rm = storage.loadRulesMemory();
      expect(rm.rules).toEqual([]);
      expect(rm.memories).toEqual([]);
    });
    it('save/load', () => {
      storage.saveRulesMemory({
        rules: [{ id:'r1', content:'用中文', enabled:true, createdAt:1 }],
        memories: [{ id:'m1', content:'前端开发者', createdAt:1 }],
      });
      const rm = storage.loadRulesMemory();
      expect(rm.rules).toHaveLength(1);
      expect(rm.memories).toHaveLength(1);
    });
  });

  describe('A14. 技能系统', () => {
    it('BUILTIN_SKILLS 12个', () => expect(storage.BUILTIN_SKILLS.length).toBe(12));
    it('每个有必填字段', () => {
      for (const s of storage.BUILTIN_SKILLS) {
        expect(s.id).toBeTruthy();
        expect(s.name).toBeTruthy();
        expect(s.systemPrompt.length).toBeGreaterThan(10);
      }
    });
    it('loadEnabledSkills 默认12', () => expect(storage.loadEnabledSkills().length).toBe(12));
    it('saveEnabledSkills 子集', () => {
      storage.saveEnabledSkills(['code-review','sql-expert']);
      expect(storage.loadEnabledSkills()).toEqual(['code-review','sql-expert']);
    });
    it('loadEnabledSkills 损坏降级', () => {
      localStorage.setItem('devwhale-enabled-skills', 'bad');
      expect(storage.loadEnabledSkills().length).toBe(12);
    });
    it('loadShowRecommendations 默认 true', () => expect(storage.loadShowRecommendations()).toBe(true));
    it('saveShowRecommendations', () => {
      storage.saveShowRecommendations(false);
      expect(storage.loadShowRecommendations()).toBe(false);
    });
    it('loadCustomSkills 空', () => expect(storage.loadCustomSkills()).toEqual([]));
    it('install + uninstall 自定义', () => {
      storage.installCustomSkill({ id:'cs1', name:'C', desc:'', icon:'🧪', category:'X', systemPrompt:'P' });
      expect(storage.loadCustomSkills().length).toBe(1);
      storage.uninstallCustomSkill('cs1');
      expect(storage.loadCustomSkills().length).toBe(0);
    });
    it('重复 install 不重复', () => {
      storage.installCustomSkill({ id:'dup', name:'D', desc:'', icon:'🧪', category:'X', systemPrompt:'P' });
      storage.installCustomSkill({ id:'dup', name:'D2', desc:'', icon:'🧪', category:'X', systemPrompt:'P2' });
      expect(storage.loadCustomSkills().length).toBe(1);
    });
    it('getAllSkills 聚合', () => {
      storage.installCustomSkill({ id:'a1', name:'A', desc:'', icon:'📦', category:'X', systemPrompt:'P' });
      expect(storage.getAllSkills().length).toBe(13);
    });
    it('getEnabledSkillItems 过滤完整对象', () => {
      storage.saveEnabledSkills(['code-review','security-audit']);
      const items = storage.getEnabledSkillItems();
      expect(items).toHaveLength(2);
      expect(items[0].systemPrompt.length).toBeGreaterThan(10);
    });
    it('uninstallCustomSkill 同步移除启用列表', () => {
      storage.installCustomSkill({ id:'rm', name:'R', desc:'', icon:'🗑️', category:'X', systemPrompt:'P' });
      storage.saveEnabledSkills(['code-review','rm']);
      storage.uninstallCustomSkill('rm');
      expect(storage.loadEnabledSkills()).not.toContain('rm');
    });
  });

  describe('A15. MCP 服务器', () => {
    it('loadMcpServers 空', () => expect(storage.loadMcpServers()).toEqual([]));
    it('往返', () => {
      storage.saveMcpServers([{ id:'s', name:'S', command:'npx', args:[], enabled:true }]);
      expect(storage.loadMcpServers()).toHaveLength(1);
    });
    it('损坏降级', () => {
      localStorage.setItem('devwhale-mcp-servers', '}');
      expect(storage.loadMcpServers()).toEqual([]);
    });
  });
});

// ============================================================
// B. utils.ts — 全部函数
// ============================================================
describe('B. utils.ts 全部函数', () => {
  describe('B1. cn', () => {
    it('单参', () => expect(cn('a')).toBe('a'));
    it('多参', () => expect(cn('a','b','c')).toBe('a b c'));
    it('falsy跳过', () => expect(cn('a',false,'b',null,undefined,'c')).toBe('a b c'));
    it('条件', () => expect(cn('base', true && 'active', false && 'hidden')).toBe('base active'));
    it('空', () => expect(cn()).toBe(''));
  });

  describe('B2. formatTime', () => {
    it('上午', () => expect(formatTime(new Date('2026-01-01T08:30').getTime())).toMatch(/\d{2}:\d{2}/));
    it('下午', () => expect(formatTime(new Date('2026-01-01T14:30').getTime())).toMatch(/\d{2}:\d{2}/));
    it('午夜', () => expect(formatTime(new Date('2026-01-01T00:00').getTime())).toMatch(/\d{2}:\d{2}/));
  });

  describe('B3. formatDate', () => {
    it('6月10日', () => expect(formatDate(new Date('2026-06-10').getTime())).toMatch(/6月10/));
    it('1月1日', () => expect(formatDate(new Date('2026-01-01').getTime())).toMatch(/1月1/));
  });
});

// ============================================================
// C. shell.ts — 全部函数
// ============================================================
describe('C. shell.ts 全部函数', () => {
  describe('C1. isRunnable 全覆盖', () => {
    ['python','py','bash','sh','powershell','pwsh','shell','cmd','bat','node','js','ruby','rb'].forEach(l =>
      it(`${l} → true`, () => expect(isRunnable(l)).toBe(true)));
    ['typescript','tsx','rust','go','java','html','css','json','md',''].forEach(l =>
      it(`${l || '(空)'} → false`, () => expect(isRunnable(l)).toBe(false)));
    it('大写 PYTHON', () => expect(isRunnable('PYTHON')).toBe(true));
    it('混合 PoWeRsHeLl', () => expect(isRunnable('PoWeRsHeLl')).toBe(true));
  });

  describe('C2. getRunCommand 全覆盖', () => {
    it('python', () => expect(getRunCommand('python')).toEqual({program:'python',args:[]}));
    it('bash', () => expect(getRunCommand('bash')).toEqual({program:'bash',args:[]}));
    it('powershell', () => expect(getRunCommand('powershell')).toEqual({program:'powershell',args:[]}));
    it('cmd', () => expect(getRunCommand('cmd')).toEqual({program:'cmd',args:['/c']}));
    it('node', () => expect(getRunCommand('node')).toEqual({program:'node',args:[]}));
    it('unknown', () => expect(getRunCommand('unknown')).toEqual({program:'',args:[]}));
    it('空', () => expect(getRunCommand('')).toEqual({program:'',args:[]}));
  });

  describe('C3. 真实 Shell 执行', () => {
    it('echo', () => expect(execSync('echo granular-ok',{encoding:'utf-8'})).toContain('granular-ok'));
    it('PowerShell', () => expect(execSync('powershell -NoProfile -Command Write-Output pwsh-g',{encoding:'utf-8'})).toContain('pwsh-g'));
    it('命令失败', () => { try { execSync('nonexistent_xyz',{encoding:'utf-8',stdio:'pipe'}); expect(true).toBe(false); } catch(e:any) { expect(e.status).not.toBe(0); } });
  });
});

// ============================================================
// D. api.ts — 全部核心函数
// ============================================================
describe('D. api.ts 全部核心函数', () => {
  describe('D1. stableStringify 全类型', () => {
    it('null', () => expect(stableStringify(null)).toBe('null'));
    it('undefined → null', () => expect(stableStringify(undefined)).toBe('null'));
    it('number', () => expect(stableStringify(42)).toBe('42'));
    it('negative', () => expect(stableStringify(-1)).toBe('-1'));
    it('float', () => expect(stableStringify(3.14)).toBe('3.14'));
    it('string', () => expect(stableStringify('hello')).toBe('"hello"'));
    it('空串', () => expect(stableStringify('')).toBe('""'));
    it('true', () => expect(stableStringify(true)).toBe('true'));
    it('false', () => expect(stableStringify(false)).toBe('false'));
    it('空对象', () => expect(stableStringify({})).toBe('{}'));
    it('空数组', () => expect(stableStringify([])).toBe('[]'));
    it('键排序', () => expect(stableStringify({z:1,a:2})).toBe('{"a":2,"z":1}'));
    it('嵌套', () => expect(stableStringify({o:{b:1,a:2}})).toBe('{"o":{"a":2,"b":1}}'));
    it('数组', () => expect(stableStringify([3,1,2])).toBe('[3,1,2]'));
    it('数组含undefined→null', () => expect(stableStringify([1,undefined,3])).toBe('[1,null,3]'));
    it('对象含undefined→跳过', () => {
      const r = stableStringify({a:1,b:undefined,c:3});
      const p = JSON.parse(r);
      expect(p.a).toBe(1);
      expect(p.c).toBe(3);
      expect('b' in p).toBe(false);
    });
    it('Unicode中文', () => expect(JSON.parse(stableStringify({msg:'你好'})).msg).toBe('你好'));
    it('特殊字符转义', () => expect(JSON.parse(stableStringify({p:'a"b'})).p).toBe('a"b'));
    it('5层嵌套', () => expect(JSON.parse(stableStringify({l1:{l2:{l3:{l4:{l5:'deep'}}}}})).l1.l2.l3.l4.l5).toBe('deep'));
    it('TOOLS结构', () => {
      const r = stableStringify({tools:[{type:'function',function:{name:'read_file'}}]});
      expect(JSON.parse(r).tools[0].function.name).toBe('read_file');
    });
  });

  describe('D2. makeUsage 全边界', () => {
    it('null', () => expect(makeUsage(null)).toBeNull());
    it('undefined', () => expect(makeUsage(undefined)).toBeNull());
    it('完整', () => expect(makeUsage({prompt_tokens:100,completion_tokens:50,prompt_cache_hit_tokens:30,prompt_cache_miss_tokens:70})).toEqual({prompt:100,completion:50,cacheHit:30,cacheMiss:70}));
    it('全零', () => {
      const r = makeUsage({prompt_tokens:0,completion_tokens:0,prompt_cache_hit_tokens:0,prompt_cache_miss_tokens:0})!;
      expect(r.cacheHit).toBe(0);
      expect(r.cacheMiss).toBe(0);
    });
    it('仅prompt', () => expect(makeUsage({prompt_tokens:500})).toEqual({prompt:500,completion:0,cacheHit:0,cacheMiss:500}));
    it('全缓存命中', () => {
      const r = makeUsage({prompt_tokens:1000,prompt_cache_hit_tokens:1000,prompt_cache_miss_tokens:0})!;
      expect(r.cacheHit).toBe(1000);
      expect(r.cacheMiss).toBe(0);
    });
  });
});

// ============================================================
// E. tools.ts — 全部函数
// ============================================================
describe('E. tools.ts 全部函数', () => {
  describe('E1. isAbsolutePath 全路径', () => {
    ['C:\\','D:\\test','C:/Users','/home','/usr/bin','A:\\'].forEach(p =>
      it(`"${p}" → true`, () => expect(isAbsolutePath(p)).toBe(true)));
    ['src/App.tsx','./file','../lib','file.txt','','a/b/c'].forEach(p =>
      it(`"${p}" → false`, () => expect(isAbsolutePath(p)).toBe(false)));
    it('仅盘符 C: → false', () => expect(isAbsolutePath('C:')).toBe(false));
  });

  describe('E2. resolvePath', () => {
    beforeEach(() => setCurrentProjectPath('C:/dev/project'));
    it('绝对路径原样', () => expect(resolvePath('D:\\other')).toBe('D:/other'));
    it('相对路径拼接', () => expect(resolvePath('src/main.ts')).toBe('C:/dev/project/src/main.ts'));
    it('根路径', () => expect(resolvePath('/')).toBe('/'));
    it('空项目根', () => { setCurrentProjectPath(''); expect(resolvePath('file.ts')).toBe('file.ts'); });
    it('尾部斜杠清理', () => { setCurrentProjectPath('C:/proj/'); expect(resolvePath('x.ts')).toBe('C:/proj/x.ts'); });
  });

  describe('E3. getCurrentProjectPath', () => {
    it('设置后读取', () => { setCurrentProjectPath('C:/my'); expect(getCurrentProjectPath()).toBe('C:/my'); });
  });
});

// ============================================================
// F. checkpoint.ts — 全部函数
// ============================================================
describe('F. checkpoint.ts 全部函数', () => {
  const cpFile = join(TMP, 'cp.txt');

  beforeEach(() => {
    checkpoint.clearAllCheckpoints();
    checkpoint.setCheckpointProjectRoot(TMP);
    writeFileSync(cpFile, 'v1-original', 'utf-8');
  });

  it('F1. createCheckpoint 返回ID', async () => {
    const id = await checkpoint.createCheckpoint(cpFile, 'write', 'desc');
    expect(typeof id).toBe('string');
    expect(id!.length).toBeGreaterThan(5);
  });

  it('F2. getCheckpoint 详情', async () => {
    const id = (await checkpoint.createCheckpoint(cpFile, 'edit', 'edit-desc'))!;
    const cp = checkpoint.getCheckpoint(id);
    expect(cp).not.toBeNull();
    expect(cp!.toolName).toBe('edit');
    expect(cp!.filePath).toBe(cpFile);
  });

  it('F3. listCheckpoints 排序', async () => {
    await checkpoint.createCheckpoint(cpFile, 'w1', 'd1');
    await new Promise(r => setTimeout(r, 10));
    await checkpoint.createCheckpoint(cpFile, 'w2', 'd2');
    const list = checkpoint.listCheckpoints();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0].createdAt).toBeGreaterThanOrEqual(list[1].createdAt);
  });

  it('F4. listCheckpoints 按文件过滤', async () => {
    const id = await checkpoint.createCheckpoint(cpFile, 'w', '');
    // 非 Electron 模式下 createCheckpoint 一定返回 ID
    expect(typeof id).toBe('string');
    const list = checkpoint.listCheckpoints(cpFile);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('F5. deleteCheckpoint', async () => {
    const id = (await checkpoint.createCheckpoint(cpFile, 'w', ''))!;
    expect(checkpoint.deleteCheckpoint(id)).toBe(true);
    expect(checkpoint.getCheckpoint(id)).toBeNull();
  });

  it('F6. clearAllCheckpoints', async () => {
    await checkpoint.createCheckpoint(cpFile, 'w1', '');
    await checkpoint.createCheckpoint(cpFile, 'w2', '');
    checkpoint.clearAllCheckpoints();
    expect(checkpoint.listCheckpoints()).toEqual([]);
    expect(checkpoint.getCheckpointStats().total).toBe(0);
  });

  it('F7. getCheckpointStats', async () => {
    const id1 = await checkpoint.createCheckpoint(cpFile, 'w', '');
    expect(typeof id1).toBe('string');
    const stats = checkpoint.getCheckpointStats();
    expect(stats.total).toBeGreaterThanOrEqual(1);
    expect(stats.files).toBeGreaterThanOrEqual(1);
    expect(stats.latestTime).not.toBeNull();
  });

  it('F8. revertCheckpoint 无效ID', async () => {
    expect(await checkpoint.revertCheckpoint('no-such')).toContain('不存在');
  });
});

// ============================================================
// G. tauriFs.ts — 全部函数
// ============================================================
describe('G. tauriFs.ts 全部函数', () => {
  it('isElectron → false', () => expect(isElectron()).toBe(false));
  it('isTauri === isElectron', () => expect(isTauri()).toBe(isElectron()));
  it('fileExists → false', async () => expect(await fileExists('/x')).toBe(false));
});

// ============================================================
// H. DiffViewer — 全部解析
// ============================================================
describe('H. DiffViewer 全部解析', () => {
  it('H1. 新增', () => {
    const r = parseUnifiedDiff('diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1,2 +1,3 @@\n ctx\n+add\n ctx');
    expect(r.hunks[0].lines.filter(l=>l.type==='add')).toHaveLength(1);
  });
  it('H2. 删除', () => {
    const r = parseUnifiedDiff('diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1,3 +1,2 @@\n ctx\n-del\n ctx');
    expect(r.hunks[0].lines.filter(l=>l.type==='remove')).toHaveLength(1);
  });
  it('H3. 上下文', () => {
    const r = parseUnifiedDiff('diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1,2 +1,2 @@\n a\n b');
    expect(r.hunks[0].lines.filter(l=>l.type==='context')).toHaveLength(2);
  });
  it('H4. 多文件', () => {
    const r = parseUnifiedDiff('diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1,1 +1,2 @@\n x\n+y\ndiff --git a/b b/b\n--- a/b\n+++ b/b\n@@ -1,1 +1,1 @@\n z\n');
    expect(r.fileName).toBe('b');
  });
  it('H5. 非diff文本', () => {
    const r = parseUnifiedDiff('not a diff');
    expect(r.hunks).toEqual([]);
  });
  it('H6. 空字符串', () => expect(parseUnifiedDiff('').hunks).toEqual([]));
});

// ============================================================
// I. 真实文件系统边界
// ============================================================
describe('I. 真实文件系统边界', () => {
  const tf = join(TMP, 'bound.txt');
  it('I1. 空文件', () => { writeFileSync(tf,''); expect(readFileSync(tf,'utf-8')).toBe(''); });
  it('I2. >200KB', () => { const b='x'.repeat(200000); writeFileSync(tf,b); expect(statSync(tf).size).toBe(200000); });
  it('I3. CRLF混合', () => { writeFileSync(tf,'a\r\nb\nc\r\n'); expect(readFileSync(tf,'utf-8')).toContain('a'); });
  it('I4. Emoji', () => { const e='🎉你好🌍'; writeFileSync(tf,e); expect(readFileSync(tf,'utf-8')).toBe(e); });
  it('I5. 嵌套目录', () => {
    const d = join(TMP,'a','b','c','d.txt');
    mkdirSync(join(TMP,'a','b','c'),{recursive:true});
    writeFileSync(d,'deep');
    expect(existsSync(d)).toBe(true);
  });
});

// ============================================================
// J. 全 key 往返测试
// ============================================================
describe('J. 全 key 往返', () => {
  it('J1. 全部14个key读写一致', () => {
    storage.saveConversations([{id:'x',title:'X',project:'p',messages:[],createdAt:1,updatedAt:2}]);
    storage.saveActiveConversationId('cv1');
    storage.saveProjects([{id:'p1',name:'P',path:'/p'}]);
    storage.saveUsername('Tester');
    storage.saveMode('ask');
    storage.saveChatSettings({density:'compact',codeTheme:'dark',showTimestamps:true,autoScroll:true,typingSpeed:5});
    storage.saveApiKey('sk-test');
    storage.saveSelectedModel('gpt-4o');
    storage.saveProvider('openai');
    storage.saveProviderApiKey('openai','sk-o');
    storage.saveGeneralPreferences({linkOpenMode:'auto-browser',fontSize:16,language:'en',privacyMode:true});
    storage.saveRulesMemory({rules:[{id:'r1',content:'R',enabled:true,createdAt:1}],memories:[{id:'m1',content:'M',createdAt:1}]});
    storage.saveEnabledSkills(['code-review','test-gen']);
    storage.saveMcpServers([{id:'s1',name:'S',command:'npx',args:[],enabled:true}]);

    expect(storage.loadConversations()).toHaveLength(1);
    expect(storage.loadActiveConversationId()).toBe('cv1');
    expect(storage.loadProjects()).toHaveLength(1);
    expect(storage.loadUsername()).toBe('Tester');
    expect(storage.loadMode()).toBe('ask');
    expect(storage.loadChatSettings().typingSpeed).toBe(5);
    expect(storage.loadApiKey()).toBe('sk-test');
    expect(storage.loadSelectedModel()).toBe('gpt-4o');
    expect(storage.loadProvider()).toBe('openai');
    expect(storage.loadProviderApiKey('openai')).toBe('sk-o');
    expect(storage.loadGeneralPreferences().fontSize).toBe(16);
    expect(storage.loadRulesMemory().rules).toHaveLength(1);
    expect(storage.loadEnabledSkills()).toHaveLength(2);
    expect(storage.loadMcpServers()).toHaveLength(1);
  });
});
