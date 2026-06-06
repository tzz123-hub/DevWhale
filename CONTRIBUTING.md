# Contributing to DevWhale

欢迎为 DevWhale 贡献代码、文档、Bug 反馈或功能建议。

## 开发环境

```bash
git clone https://github.com/tzz123-hub/DevWhale.git
cd DevWhale
npm install
npm run dev          # Vite 开发服务器 + Electron 窗口
```

## 项目结构

见 [README.md](./README.md#项目结构)。

## 提交规范

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `style:` 代码格式
- `refactor:` 重构
- `perf:` 性能优化
- `chore:` 构建/工具变更

## 问题反馈

请通过 [GitHub Issues](https://github.com/tzz123-hub/DevWhale/issues) 提交，附上：
- 操作系统和版本
- 复现步骤
- 期望行为 vs 实际行为
- 截图（如有）

## Pull Request

1. Fork 仓库
2. 创建功能分支：`git checkout -b feat/xxx`
3. 提交修改并通过 `npm run build` 验证
4. 发起 PR，描述修改内容和原因

## 许可

贡献即同意将代码以 [MIT License](./LICENSE) 许可。
