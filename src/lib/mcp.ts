/**
 * MCP (Model Context Protocol) 客户端
 * 通过 Electron IPC 与主进程中的 MCP 协议处理器通信
 */

/* ====== 类型 ====== */

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

/* ====== MCP 客户端会话 ====== */

interface McpSession {
  config: McpServerConfig;
  tools: McpTool[];
  initialized: boolean;
}

const sessions = new Map<string, McpSession>();

/**
 * 启动 MCP 服务器并返回其工具列表和 serverId。
 * 主进程会自动完成 initialize → tools/list 握手。
 */
export async function startMcpServer(config: McpServerConfig): Promise<{ tools: McpTool[]; serverId: string }> {
  const api = (window as any).electronAPI;
  if (!api?.startMcp) {
    throw new Error('MCP 仅在 Electron 桌面模式下可用');
  }

  // 检查是否已有同名会话运行中（避免重复启动）
  for (const [id, s] of sessions) {
    if (s.config.name === config.name && s.initialized) {
      return { tools: s.tools, serverId: id };
    }
  }

  const result = await api.startMcp(config.command, config.args);
  if (result.error) {
    throw new Error('MCP 启动失败: ' + result.error);
  }

  const serverId: string = result.serverId;
  const tools: McpTool[] = result.tools || [];

  const session: McpSession = {
    config: { ...config, id: serverId },
    tools,
    initialized: true,
  };
  sessions.set(serverId, session);

  return { tools, serverId };
}

/**
 * 调用 MCP 服务器的工具
 */
export async function callMcpTool(
  serverId: string,
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  const session = sessions.get(serverId);
  if (!session) throw new Error('MCP 服务器 ' + serverId + ' 未启动');

  const api = (window as any).electronAPI;
  const result = await api.mcpRequest(serverId, 'tools/call', {
    name: toolName,
    arguments: args,
  });

  if (!result) throw new Error('MCP 服务器 ' + serverId + ' 无响应（可能已崩溃）');
  if (result.error) throw new Error('MCP 工具失败: ' + result.error);

  // MCP tools/call 返回格式: { result: { content: [{ type, text }] } }
  const content: Array<Record<string, any>> = result.result?.content || [];
  const textParts = content
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text);
  return textParts.join('\n') || JSON.stringify(result.result || {});
}

/**
 * 停止并清理 MCP 服务器会话
 */
export async function stopMcpServer(serverId: string): Promise<void> {
  sessions.delete(serverId);
  const api = (window as any).electronAPI;
  if (api?.stopMcp) {
    await api.stopMcp(serverId);
  }
}

/**
 * 获取所有已启动的 MCP 服务器的工具列表
 */
export function getAllMcpTools(): { serverId: string; serverName: string; tools: McpTool[] }[] {
  const result: { serverId: string; serverName: string; tools: McpTool[] }[] = [];
  for (const [id, session] of sessions) {
    result.push({ serverId: id, serverName: session.config.name, tools: session.tools });
  }
  return result;
}
