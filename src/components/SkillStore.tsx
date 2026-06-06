/**
 * SkillStore — Skill 专区
 * 三个功能：已安装 / 搜索推荐（可从市场安装）/ 榜单（可安装）
 */
import { useState, useEffect, useCallback } from 'react';
import { loadEnabledSkills, saveEnabledSkills, getAllSkills, loadCustomSkills, installCustomSkill, uninstallCustomSkill, type SkillItem } from '../lib/storage';
import { searchAllSources, fetchSkillFromGitHub, getLeaderboard, type MarketplaceSkill } from '../lib/skillsMarket';

type Tab = 'installed' | 'search' | 'leaderboard';
type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly';

export function SkillStore() {
  const [activeTab, setActiveTab] = useState<Tab>('installed');
  const [enabledIds, setEnabledIds] = useState<string[]>(() => loadEnabledSkills());
  const [customSkills, setCustomSkills] = useState<SkillItem[]>(() => loadCustomSkills());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MarketplaceSkill[]>([]);
  const [searching, setSearching] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>('weekly');
  const [leaderboard, setLeaderboard] = useState<MarketplaceSkill[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const allSkills = getAllSkills();
  const installedSkills = allSkills.filter(s => enabledIds.includes(s.id));
  const isBuiltin = (id: string) => !customSkills.some(cs => cs.id === id);

  const toggleSkill = (id: string) => {
    setEnabledIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      saveEnabledSkills(next);
      return next;
    });
  };

  /** 安装市场 Skill */
  const handleInstall = async (skill: MarketplaceSkill) => {
    setInstalling(skill.id);
    try {
      // 1. 从 GitHub 获取 SKILL.md 内容
      const ghData = await fetchSkillFromGitHub(skill);

      // 2. 创建 SkillItem 并存储
      const newSkill: SkillItem = {
        id: `market-${skill.id.replace(/[/.]/g, '-')}`,
        name: ghData?.name || skill.name,
        desc: ghData?.desc || skill.description,
        icon: '📦',
        category: '市场',
        systemPrompt: ghData?.systemPrompt || skill.description,
      };

      installCustomSkill(newSkill);
      setCustomSkills(loadCustomSkills());

      // 3. 自动启用
      setEnabledIds(prev => {
        const next = prev.includes(newSkill.id) ? prev : [...prev, newSkill.id];
        saveEnabledSkills(next);
        return next;
      });
    } catch (e: any) {
      console.error('安装失败:', e);
    } finally {
      setInstalling(null);
    }
  };

  /** 卸载自定义 Skill */
  const handleUninstall = (id: string) => {
    uninstallCustomSkill(id);
    setCustomSkills(loadCustomSkills());
    setEnabledIds(prev => prev.filter(x => x !== id));
  };

  // 检查 skill 是否已安装
  const isInstalled = (skill: MarketplaceSkill) => {
    const skillId = `market-${skill.id.replace(/[/.]/g, '-')}`;
    return customSkills.some(cs => cs.id === skillId);
  };

  // 搜索
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const results = await searchAllSources(searchQuery.trim());
      setSearchResults(results);
    } catch (e: any) {
      console.error('搜索失败:', e);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  // 榜单
  const loadBoard = useCallback(async (period: LeaderboardPeriod) => {
    setLoadingLeaderboard(true);
    try {
      const results = await getLeaderboard(period, 20);
      setLeaderboard(results);
    } catch (e) { console.error('榜单加载失败:', e); }
    finally { setLoadingLeaderboard(false); }
  }, []);

  useEffect(() => { loadBoard(leaderboardPeriod); }, [leaderboardPeriod, loadBoard]);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'installed', label: '已安装', icon: '📦' },
    { key: 'search', label: '探索', icon: '🔍' },
    { key: 'leaderboard', label: '榜单', icon: '🏆' },
  ];

  return (
    <div className="flex flex-col h-full bg-surface-0">
      <div className="flex border-b border-surface-200 bg-surface-50 px-3">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold border-b-2 -mb-[1px] transition-colors ${
              activeTab === tab.key
                ? 'text-accent border-accent'
                : 'text-surface-400 border-transparent hover:text-surface-600'
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* === 已安装 === */}
        {activeTab === 'installed' && (
          <div className="space-y-3">
            {installedSkills.length === 0 && (
              <p className="text-xs text-surface-400 text-center py-8">暂无已启用的 Skill，去"探索"或"榜单"安装</p>
            )}
            {installedSkills.map(skill => {
              const enabled = enabledIds.includes(skill.id);
              const builtin = isBuiltin(skill.id);
              return (
                <div key={skill.id} className={`p-3 rounded-xl border transition-colors ${
                  enabled ? 'border-accent/30 bg-accent/5' : 'border-surface-200 bg-surface-50'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{skill.icon}</span>
                        <span className="text-sm font-semibold text-surface-700">{skill.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${builtin ? 'bg-surface-200 text-surface-500' : 'bg-amber-100 text-amber-700'}`}>
                          {builtin ? skill.category : '市场'}
                        </span>
                      </div>
                      <p className="text-xs text-surface-500 mt-1">{skill.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <button
                        onClick={() => toggleSkill(skill.id)}
                        className={`shrink-0 w-8 h-5 rounded-full transition-colors relative ${
                          enabled ? 'bg-accent' : 'bg-surface-300'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          enabled ? 'left-3.5' : 'left-0.5'
                        }`} />
                      </button>
                      {!builtin && (
                        <button
                          onClick={() => handleUninstall(skill.id)}
                          className="text-[10px] text-red-400 hover:text-red-600 transition-colors"
                        >
                          卸载
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* === 搜索 === */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="描述你需要的 Skill，如：帮我做 PPT、自动化部署..."
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-surface-300 bg-surface-50 outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
              />
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="px-4 py-2 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
              >
                {searching ? '搜索中...' : '搜索'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">
                  来自 SkillsMP 市场 ({searchResults.length})
                </h3>
                {searchResults.slice(0, 15).map(skill => {
                  const installed = isInstalled(skill);
                  return (
                    <div
                      key={skill.id}
                      className="p-3 rounded-xl border border-surface-200 hover:border-accent/30 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-semibold text-surface-700">{skill.name}</span>
                          <span className="text-[10px] text-surface-400 ml-2">by {skill.author}</span>
                          <p className="text-xs text-surface-500 mt-1 line-clamp-2">{skill.description}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <span className="text-xs text-surface-400">⭐ {skill.stars.toLocaleString()}</span>
                          {installed ? (
                            <span className="text-[10px] text-green-500 font-medium">✓ 已安装</span>
                          ) : (
                            <button
                              onClick={() => handleInstall(skill)}
                              disabled={installing === skill.id}
                              className="shrink-0 px-3 py-1 text-[10px] font-medium bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
                            >
                              {installing === skill.id ? '安装中...' : '安装'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!searching && searchQuery && searchResults.length === 0 && (
              <p className="text-xs text-surface-400 text-center py-8">未找到相关 Skill，尝试修改关键词</p>
            )}
          </div>
        )}

        {/* === 榜单 === */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
            <div className="flex gap-1 bg-surface-100 rounded-lg p-0.5">
              {(['daily', 'weekly', 'monthly'] as LeaderboardPeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setLeaderboardPeriod(p)}
                  className={`flex-1 px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
                    leaderboardPeriod === p
                      ? 'bg-surface-0 text-accent shadow-sm'
                      : 'text-surface-400 hover:text-surface-600'
                  }`}
                >
                  {{ daily: '日榜', weekly: '周榜', monthly: '月榜' }[p]}
                </button>
              ))}
            </div>

            {loadingLeaderboard ? (
              <p className="text-xs text-surface-400 text-center py-8">加载中...</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((skill, i) => {
                  const installed = isInstalled(skill);
                  return (
                    <div
                      key={skill.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-surface-200 hover:border-accent/30 transition-colors"
                    >
                      <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-surface-100 text-surface-500'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-surface-700 truncate">{skill.name}</span>
                          <span className="text-[10px] text-surface-400 shrink-0">by {skill.author}</span>
                        </div>
                        <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{skill.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-surface-400">⭐ {skill.stars.toLocaleString()}</span>
                        {installed ? (
                          <span className="text-[10px] text-green-500 font-medium">✓ 已安装</span>
                        ) : (
                          <button
                            onClick={() => handleInstall(skill)}
                            disabled={installing === skill.id}
                            className="shrink-0 px-3 py-1 text-[10px] font-medium bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
                          >
                            {installing === skill.id ? '安装中...' : '安装'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
