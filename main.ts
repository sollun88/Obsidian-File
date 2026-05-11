import {
  ItemView,
  Notice,
  Plugin,
  TFile,
  TFolder,
  WorkspaceLeaf,
  setIcon
} from "obsidian";

const VIEW_TYPE_CURRENT_FOLDER_PANEL = "current-folder-panel-view";
type FilterMode = "all" | "unsupported";

const OBSIDIAN_SUPPORTED_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "canvas",
  "flac",
  "gif",
  "jpeg",
  "jpg",
  "m4a",
  "md",
  "mov",
  "mp3",
  "mp4",
  "ogg",
  "pdf",
  "png",
  "svg",
  "wav",
  "webm",
  "webp"
]);

export default class CurrentFolderPanelPlugin extends Plugin {
  onload() {
    this.registerView(
      VIEW_TYPE_CURRENT_FOLDER_PANEL,
      (leaf) => new CurrentFolderPanelView(leaf, this)
    );

    this.addRibbonIcon("folder-open", "显示当前目录面板", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "show-panel",
      name: "显示当前目录面板",
      callback: () => {
        void this.activateView();
      }
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.refreshViews();
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        this.refreshViews();
      })
    );

    this.registerEvent(
      this.app.vault.on("create", () => {
        this.refreshViews();
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", () => {
        this.refreshViews();
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", () => {
        this.refreshViews();
      })
    );
  }

  async activateView() {
    const activeFile = this.app.workspace.getActiveFile();

    if (!activeFile) {
      new Notice("当前没有打开文件");
    }

    let leaf: WorkspaceLeaf | null | undefined =
      this.app.workspace.getLeavesOfType(VIEW_TYPE_CURRENT_FOLDER_PANEL)[0];

    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);

      if (!leaf) {
        new Notice("无法创建右侧面板");
        return;
      }

      await leaf.setViewState({
        type: VIEW_TYPE_CURRENT_FOLDER_PANEL,
        active: true
      });
    }

    await this.app.workspace.revealLeaf(leaf);
    this.refreshViews();
  }

  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CURRENT_FOLDER_PANEL)) {
      const view = leaf.view;

      if (view instanceof CurrentFolderPanelView) {
        view.render();
      }
    }
  }
}

class CurrentFolderPanelView extends ItemView {
  private readonly plugin: CurrentFolderPanelPlugin;
  private readonly expandedFolderPaths = new Set<string>();
  private filterActionEl: HTMLElement | null = null;
  private filterMode: FilterMode = "all";

  constructor(leaf: WorkspaceLeaf, plugin: CurrentFolderPanelPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_CURRENT_FOLDER_PANEL;
  }

  getDisplayText() {
    return "Current folder panel";
  }

  getIcon() {
    return "folder-open";
  }

  onOpen(): Promise<void> {
    this.render();
    return Promise.resolve();
  }

  render() {
    const { containerEl } = this;
    containerEl.empty();

    const rootEl = containerEl.createDiv({ cls: "current-folder-panel" });
    const activeFile = this.app.workspace.getActiveFile();

    if (!activeFile) {
      this.renderEmpty(rootEl, "当前没有打开文件");
      return;
    }

    const folder = activeFile.parent;

    if (!folder) {
      this.renderEmpty(rootEl, "无法识别当前目录");
      return;
    }

    this.expandedFolderPaths.add(folder.path);

    const children = this.getVisibleChildren(folder);
    const fileCount = this.getVisibleFileCount(folder);
    this.renderHeader(rootEl, folder, fileCount);

    if (children.length === 0) {
      this.renderEmpty(
        rootEl,
        this.filterMode === "all" ? "当前目录无文件" : "当前目录无 Obsidian 不支持的文件"
      );
      return;
    }

    const listEl = rootEl.createDiv({ cls: "current-folder-panel__list nav-files-container" });
    const childrenEl = listEl.createDiv({ cls: "nav-folder-children" });

    for (const child of children) {
      this.renderChild(childrenEl, child, activeFile);
    }

    this.scrollActiveFileIntoView(activeFile);
  }

  private getSortedChildren(folder: TFolder) {
    return folder.children
      .filter((child): child is TFile | TFolder => child instanceof TFile || child instanceof TFolder)
      .sort((a, b) => {
        if (a instanceof TFolder && b instanceof TFile) {
          return -1;
        }

        if (a instanceof TFile && b instanceof TFolder) {
          return 1;
        }

        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
  }

  private getVisibleChildren(folder: TFolder) {
    const children = this.getSortedChildren(folder);

    if (this.filterMode === "all") {
      return children;
    }

    return children.filter((child) => {
      if (child instanceof TFile) {
        return !this.isObsidianSupportedFile(child);
      }

      return this.hasVisibleDescendant(child);
    });
  }

  private getVisibleFileCount(folder: TFolder) {
    if (this.filterMode === "all") {
      return this.getVisibleChildren(folder).filter((child) => child instanceof TFile).length;
    }

    return this.countUnsupportedFiles(folder);
  }

  private renderHeader(rootEl: HTMLElement, folder: TFolder, count: number) {
    const headerEl = rootEl.createDiv({ cls: "current-folder-panel__header" });
    const titleRowEl = headerEl.createDiv({ cls: "current-folder-panel__title-row" });

    titleRowEl.createDiv({
      cls: "current-folder-panel__title",
      text: `当前目录：${this.getFolderName(folder)}`
    });

    titleRowEl.createDiv({
      cls: "current-folder-panel__count",
      text: `${count} 个文件`
    });

    this.filterActionEl = titleRowEl.createEl("button", {
      cls: "clickable-icon current-folder-panel__filter-action",
      attr: {
        type: "button"
      }
    });
    setIcon(this.filterActionEl, "list-filter");
    this.filterActionEl.addEventListener("click", () => {
      this.toggleFilterMode();
    });
    this.updateFilterAction();

    headerEl.createDiv({
      cls: "current-folder-panel__path",
      text:
        this.filterMode === "all"
          ? this.getFolderPath(folder)
          : `${this.getFolderPath(folder)} · 仅显示 Obsidian 不支持的文件`
    });
  }

  private renderChild(parentEl: HTMLElement, child: TFile | TFolder, activeFile: TFile) {
    if (child instanceof TFolder) {
      this.renderFolder(parentEl, child, activeFile);
      return;
    }

    this.renderFile(parentEl, child, child.path === activeFile.path);
  }

  private renderFolder(parentEl: HTMLElement, folder: TFolder, activeFile: TFile) {
    const isExpanded = this.expandedFolderPaths.has(folder.path);
    const folderEl = parentEl.createDiv({
      cls: `nav-folder${isExpanded ? "" : " is-collapsed"}`,
      attr: {
        title: folder.path
      }
    });

    const titleEl = folderEl.createDiv({
      cls: "nav-folder-title",
      attr: {
        "data-path": folder.path
      }
    });

    const collapseIconEl = titleEl.createDiv({
      cls: `nav-folder-collapse-indicator collapse-icon${isExpanded ? "" : " is-collapsed"}`
    });
    setIcon(collapseIconEl, "right-triangle");

    titleEl.createDiv({
      cls: "nav-folder-title-content",
      text: folder.name
    });

    titleEl.addEventListener("click", () => {
      this.toggleFolder(folder.path);
    });

    titleEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      this.toggleFolder(folder.path);
    });

    titleEl.tabIndex = 0;
    titleEl.setAttribute("role", "button");

    const childrenEl = folderEl.createDiv({ cls: "nav-folder-children" });

    if (!isExpanded) {
      return;
    }

    for (const child of this.getVisibleChildren(folder)) {
      this.renderChild(childrenEl, child, activeFile);
    }
  }

  private renderFile(parentEl: HTMLElement, file: TFile, isActive: boolean) {
    const fileEl = parentEl.createDiv({
      cls: "nav-file",
      attr: {
        title: file.path
      }
    });

    const titleEl = fileEl.createDiv({
      cls: `nav-file-title current-folder-panel__file-title${isActive ? " is-active" : ""}`,
      attr: {
        "data-path": file.path
      }
    });

    titleEl.createDiv({
      cls: "nav-file-title-content",
      text: file.name
    });

    titleEl.addEventListener("click", () => {
      void this.plugin.app.workspace.openLinkText(file.path, "", false);
    });

    titleEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      void this.plugin.app.workspace.openLinkText(file.path, "", false);
    });

    titleEl.tabIndex = 0;
    titleEl.setAttribute("role", "button");
  }

  private toggleFolder(path: string) {
    if (this.expandedFolderPaths.has(path)) {
      this.expandedFolderPaths.delete(path);
    } else {
      this.expandedFolderPaths.add(path);
    }

    this.render();
  }

  private toggleFilterMode() {
    this.filterMode = this.filterMode === "all" ? "unsupported" : "all";
    this.updateFilterAction();
    this.render();
  }

  private updateFilterAction() {
    if (!this.filterActionEl) {
      return;
    }

    const isUnsupportedMode = this.filterMode === "unsupported";
    const title = isUnsupportedMode ? "显示全部文件" : "显示不支持的文件";

    this.filterActionEl.toggleClass("is-active", isUnsupportedMode);
    this.filterActionEl.setAttr("aria-label", title);
    this.filterActionEl.setAttr("title", title);
  }

  private hasVisibleDescendant(folder: TFolder): boolean {
    return this.getSortedChildren(folder).some((child) => {
      if (child instanceof TFile) {
        return !this.isObsidianSupportedFile(child);
      }

      return this.hasVisibleDescendant(child);
    });
  }

  private isObsidianSupportedFile(file: TFile) {
    return OBSIDIAN_SUPPORTED_EXTENSIONS.has(file.extension.toLowerCase());
  }

  private countUnsupportedFiles(folder: TFolder): number {
    return this.getSortedChildren(folder).reduce((count, child) => {
      if (child instanceof TFile) {
        return this.isObsidianSupportedFile(child) ? count : count + 1;
      }

      return count + this.countUnsupportedFiles(child);
    }, 0);
  }

  private scrollActiveFileIntoView(activeFile: TFile) {
    window.requestAnimationFrame(() => {
      const activeEl = this.containerEl.querySelector<HTMLElement>(
        `.current-folder-panel__file-title[data-path="${CSS.escape(activeFile.path)}"]`
      );

      activeEl?.scrollIntoView({
        block: "center",
        inline: "nearest"
      });
    });
  }

  private renderEmpty(rootEl: HTMLElement, message: string) {
    rootEl.createDiv({
      cls: "current-folder-panel__empty",
      text: message
    });
  }

  private getFolderName(folder: TFolder) {
    return folder.isRoot() ? "/" : folder.name;
  }

  private getFolderPath(folder: TFolder) {
    return folder.isRoot() ? "/" : folder.path;
  }

}
