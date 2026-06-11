import { contextBridge, ipcRenderer } from 'electron';

/**
 * Electron 预加载脚本 —— 暴露安全 API 到渲染进程
 */

contextBridge.exposeInMainWorld('electronAPI', {
  // 文件系统
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
  fileExists: (path: string) => ipcRenderer.invoke('fs:exists', path),

  // Shell
  execCommand: (command: string, args: string[], options?: { cwd?: string }) =>
    ipcRenderer.invoke('shell:exec', command, args, options),

  // 流式 Shell
  execStreaming: (requestId: string, command: string, args: string[], options?: { cwd?: string }) => {
    ipcRenderer.send('shell:execStreaming', requestId, command, args, options);
  },
  onStreamData: (requestId: string, callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on(`shell:stream:${requestId}`, handler);
    return () => ipcRenderer.removeListener(`shell:stream:${requestId}`, handler);
  },

  // 对话框
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  openFileDialog: (filterType?: string) => ipcRenderer.invoke('dialog:openFiles', filterType),

  // 文件系统（扩展）
  readBinaryFile: (path: string) => ipcRenderer.invoke('fs:readBinaryFile', path),

  // 应用信息
  getDocumentDir: () => ipcRenderer.invoke('app:getDocumentDir'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),

  // LSP
  startLsp: (language: string, command: string, args: string[], projectPath: string) =>
    ipcRenderer.invoke('lsp:start', language, command, args, projectPath),
  lspRequest: (serverId: string, method: string, params: any) =>
    ipcRenderer.invoke('lsp:request', serverId, method, params),
  lspDiagnostics: (serverId: string, filePath: string) =>
    ipcRenderer.invoke('lsp:diagnostics', serverId, filePath),
  stopLsp: (serverId: string) => ipcRenderer.invoke('lsp:stop', serverId),

  // MCP
  startMcp: (command: string, args: string[], cwd?: string) =>
    ipcRenderer.invoke('mcp:start', command, args, cwd),
  mcpRequest: (serverId: string, method: string, params: any) =>
    ipcRenderer.invoke('mcp:request', serverId, method, params),
  stopMcp: (serverId: string) =>
    ipcRenderer.invoke('mcp:stop', serverId),
  onMcpCrashed: (callback: (serverId: string) => void) => {
    const handler = (_event: any, serverId: string) => callback(serverId);
    ipcRenderer.on('mcp:crashed', handler);
    return () => ipcRenderer.removeListener('mcp:crashed', handler);
  },

  // 调试器
  startDebug: (debugId: string, scriptPath: string, cwd: string) =>
    ipcRenderer.invoke('debug:start', debugId, scriptPath, cwd),
  debugSetBreakpoint: (debugId: string, file: string, line: number) =>
    ipcRenderer.invoke('debug:setBreakpoint', debugId, file, line),
  debugRemoveBreakpoint: (debugId: string, file: string, line: number) =>
    ipcRenderer.invoke('debug:removeBreakpoint', debugId, file, line),
  debugContinue: (debugId: string) => ipcRenderer.invoke('debug:continue', debugId),
  debugStepOver: (debugId: string) => ipcRenderer.invoke('debug:stepOver', debugId),
  debugStepInto: (debugId: string) => ipcRenderer.invoke('debug:stepInto', debugId),
  debugStepOut: (debugId: string) => ipcRenderer.invoke('debug:stepOut', debugId),
  stopDebug: (debugId: string) => ipcRenderer.invoke('debug:stop', debugId),
  // 更新检查
  checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),

  onDebugEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('debug:event', handler);
    return () => ipcRenderer.removeListener('debug:event', handler);
  },
});
