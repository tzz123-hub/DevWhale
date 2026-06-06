/**
 * Checkpoint 系统 —— 文件操作前自动备份，支持回滚
 * 备份存储在项目根目录的 .devwhale-checkpoints/ 下
 */
import { writeFileContent, readFileContent } from './shell';
import { isTauri } from './tauriFs';

/* ====== 类型 ====== */

export interface Checkpoint {
  id: string;
  filePath: string;        // 原始文件路径
  backupPath: string;       // 备份文件路径
  content: string;          // 原始内容
  description: string;      // 操作描述
  createdAt: number;        // 时间戳
  toolName: string;         // 触发工具（write_file / edit_file）
}

/* ====== 内存存储（会话级） ====== */

const checkpoints: Map<string, Checkpoint> = new Map();

/** 项目根路径（由 App.tsx 设置） */
let projectRoot = '';

export function setCheckpointProjectRoot(path: string) {
  projectRoot = path;
}

/* ====== API ====== */

/**
 * 在写操作前创建检查点
 * @returns checkpoint id，如果读取失败则返回 null
 */
export async function createCheckpoint(
  filePath: string,
  toolName: string,
  description?: string
): Promise<string | null> {
  if (!isTauri()) {
    // 浏览器模式：保存到 localStorage（跨刷新持久化）
    const id = `cp-${Date.now()}`;
    const cp: Checkpoint = {
      id,
      filePath,
      backupPath: `(localStorage) ${filePath}`,
      content: '',
      description: description || `${toolName} 操作前备份`,
      createdAt: Date.now(),
      toolName,
    };
    checkpoints.set(id, cp);
    try {
      const all = JSON.parse(localStorage.getItem('devwhale-checkpoints') || '[]');
      all.push({ id, filePath, backupPath: cp.backupPath, content: cp.content, description: cp.description, createdAt: cp.createdAt, toolName });
      if (all.length > 50) all.splice(0, all.length - 50); // 最多保留 50 个
      localStorage.setItem('devwhale-checkpoints', JSON.stringify(all));
    } catch {}
    return id;
  }

  try {
    const original = await readFileContent(filePath);
    if (!original || original.startsWith('读取失败') || original.startsWith('错误')) {
      return null; // 文件不存在或无法读取，无需备份
    }

    const id = `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = filePath.replace(/[/\\:]/g, '_');
    const backupDir = projectRoot ? `${projectRoot}/.devwhale-checkpoints` : '.devwhale-checkpoints';
    const backupPath = `${backupDir}/${timestamp}_${safeName}`;

    // 写入备份
    await writeFileContent(backupPath, original);

    const cp: Checkpoint = {
      id,
      filePath,
      backupPath,
      content: original,
      description: description || `${toolName} 操作前备份`,
      createdAt: Date.now(),
      toolName,
    };

    checkpoints.set(id, cp);
    return id;
  } catch (e) {
    console.warn('[Checkpoint] 创建失败:', e);
    return null;
  }
}

/**
 * 回滚到指定检查点
 */
export async function revertCheckpoint(checkpointId: string): Promise<string> {
  const cp = checkpoints.get(checkpointId);
  if (!cp) return `检查点 ${checkpointId} 不存在（可能已过期或会话已结束）`;

  if (!isTauri()) {
    checkpoints.delete(checkpointId);
    // 浏览器模式：从 localStorage 恢复
    try {
      const all = JSON.parse(localStorage.getItem('devwhale-checkpoints') || '[]');
      const idx = all.findIndex((c: any) => c.id === checkpointId);
      if (idx >= 0) { all.splice(idx, 1); localStorage.setItem('devwhale-checkpoints', JSON.stringify(all)); }
    } catch {}
    return `已回滚（浏览器模式）: ${cp.filePath}\n（注：浏览器模式回滚仅移除检查点，无法恢复磁盘文件）`;
  }

  try {
    await writeFileContent(cp.filePath, cp.content);
    checkpoints.delete(checkpointId);
    return `已回滚: ${cp.filePath} → ${cp.description}`;
  } catch (e: any) {
    return `回滚失败: ${e.message || e}`;
  }
}

/**
 * 列出所有检查点
 */
export function listCheckpoints(filePath?: string): Checkpoint[] {
  const all = Array.from(checkpoints.values());
  if (filePath) {
    return all.filter((cp) => cp.filePath === filePath);
  }
  return all.sort((a, b) => b.createdAt - a.createdAt); // 最新的在前
}

/**
 * 获取检查点详情（含文件内容预览）
 */
export function getCheckpoint(id: string): Checkpoint | null {
  return checkpoints.get(id) || null;
}

/**
 * 删除检查点
 */
export function deleteCheckpoint(id: string): boolean {
  return checkpoints.delete(id);
}

/**
 * 清除所有检查点
 */
export function clearAllCheckpoints(): void {
  checkpoints.clear();
}

/**
 * 获取检查点统计
 */
export function getCheckpointStats(): { total: number; files: number; latestTime: number | null } {
  const all = Array.from(checkpoints.values());
  const uniqueFiles = new Set(all.map((cp) => cp.filePath));
  return {
    total: all.length,
    files: uniqueFiles.size,
    latestTime: all.length > 0 ? Math.max(...all.map((cp) => cp.createdAt)) : null,
  };
}
