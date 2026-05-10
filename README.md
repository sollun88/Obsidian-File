# Current Folder Panel

一个 Obsidian 插件，用于在右侧边栏显示当前文件所在目录的文件树。

## 功能

- 自动识别当前激活文件所在目录
- 在右侧面板显示当前目录下的文件和子文件夹
- 文件夹支持展开、折叠
- 当前文件高亮显示
- 打开面板时自动定位到当前文件
- 点击文件后在 Obsidian 中打开
- 切换文件、创建、删除、重命名文件时自动刷新
- 样式尽量贴近 Obsidian 原生文件树

## 开发

安装依赖：

```bash
npm install
```

构建：

```bash
npm run build
```

开发监听：

```bash
npm run dev
```

## 安装到 Obsidian

构建后，将以下文件复制到目标 vault 的插件目录：

```text
.obsidian/plugins/current-folder-panel/
├── main.js
├── manifest.json
└── styles.css
```

然后在 Obsidian 中进入 `Settings -> Community plugins`，启用 `Current Folder Panel`。

## 使用

点击左侧 ribbon 的文件夹图标，或在命令面板执行：

```text
显示当前目录面板
```

右侧边栏会显示当前文件所在目录的文件树，并自动定位到当前文件。
