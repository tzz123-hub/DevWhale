/**
 * MCP (Model Context Protocol) 客户端
 * 支持 stdio 类型的 MCP 服务器，通过 Electron IPC 通信
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

/* ====== MCP 客户端 ====== */

interface McpSession {
  config: McpServerConfig;
  tools: McpTool[];
  initialized: boolean;
  requestId: number;
}

const sessions = new Map<string, McpSession>();

export async function startMcpServer(config: McpServerConfig): Promise<McpTool[]> {
  const api = (window as any).electronAPI;
  if (!api?.startLsp) {
    throw new Error('MCP 仅在 Electron 桌面模式下可用');
  }

  // 使用 LSP 基础设施启动 MCP 服务器
  const result = await api.startLsp('mcp', config.command, config.args, '');
  if (result.error) throw new Error('MCP 启动失败: ' + result.error);

  const serverId: string = result.serverId || config.id; // 用主进程返回的 serverId
  const session: McpSession = {
    config: { ...config, id: serverId }, // 更新 id 以匹配
    tools: [],
    initialized: true,
    requestId: 1,
  };
  sessions.set(serverId, session);

  // 获取工具列表
  try {
    const toolsResult = await api.lspRequest(serverId, 'tools/list', {});
    session.tools = toolsResult?.tools || [];
  } catch {}

  return session.tools;
}

export async function callMcpTool(
  serverId: string,
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  const session = sessions.get(serverId);
  if (!session) throw new Error('MCP 服务器 ' + serverId + ' 未启动');

  const api = (window as any).electronAPI;
  const result = await api.lspRequest(serverId, 'tools/call', {
    name: toolName,
    arguments: args,
  });

  if (result?.error) throw new Error('MCP 工具失败: ' + result.error);
  const content = result?.result?.content || [];
  const textParts = content.filter((c: any) => c.type === 'text').map((c: any) => c.text);
  return textParts.join('\n') || JSON.stringify(result?.result || {});
}

export async function stopMcpServer(serverId: string): Promise<void> {
  sessions.delete(serverId);
  const api = (window as any).electronAPI;
  if (api?.stopLsp) await api.stopLsp(serverId);
}

export function getAllMcpTools(): { serverId: string; serverName: string; tools: McpTool[] }[] {
  const result: { serverId: string; serverName: string; tools: McpTool[] }[] = [];
  for (const [id, session] of sessions) {
    result.push({ serverId: id, serverName: session.config.name, tools: session.tools });
  }
  return result;
}
