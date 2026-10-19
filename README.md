# 素材库 · 拆书记录

纯静态单页应用，无构建步骤，直接托管在 GitHub Pages。

数据存在浏览器 `localStorage`，可选通过 GitHub API 同步到仓库。

## 目录结构

```
index.html            612 行   页面结构 + 资源引用（原来的 3937 行已拆开）
css/
  base.css             34 行   设计令牌：颜色 / 圆角 / 阴影 / 明暗主题变量
  layout.css           90 行   布局骨架：侧边栏 / 主区域 / 一句话 / 输入区
  components.css      181 行   按钮 / 页签 / 工具栏 / 卡片 / 分页 / 批量栏 / 弹窗
  panels.css           91 行   设置 / 导出 / 去重 / 回收站·健康·统计
  images.css          129 行   图片分类 / 瀑布流浏览 / 图床管理 / Toast
  zen.css              28 行   极简浏览模式
  responsive.css       42 行   响应式断点
js/
  core.js             276 行   常量 / 状态 / DOM 缓存 / 工具函数 / 一言 / 布局·主题·设置
  store.js            122 行   本地存储：读写 / 数据规范化 / 筛选
  render.js           378 行   渲染管线：侧栏 / 标签 / 页签 / 列表 / 分页 / 选择器面板
  items.js            258 行   素材增删改：回收站 / 标签管理 / 待上传图 / 拖拽分类
  tools.js            138 行   辅助功能：去重 / 统计 / 健康检查
  github.js           252 行   GitHub 同步：配置 / 拉取 / 推送
  images.js           294 行   图片压缩 / 上传流程 / 瀑布流浏览
  imgbed.js           209 行   图床管理：仓库图片列表 / 删除 / 清理
  io.js               158 行   极简模式 / 导入导出 / 侧边栏开关
  bind-core.js        207 行   事件绑定：输入区 / 选择器 / 搜索 / 导航 / 图片兜底
  bind-list.js        149 行   事件绑定：列表 / 分页 / 分类管理 / 批量操作
  bind-views.js       275 行   事件绑定：视图切换 / 各弹窗 / 设置表单
  init.js              37 行   启动初始化
```

## 加载顺序是有意义的

两部分都**按顺序加载**，等价于原先「一个 `<style>` + 一个 `<script>`」的语义：

- CSS 文件按原顺序串联 → 层叠优先级与拆分前完全一致，所以**不要随意调整 `index.html` 里 `<link>` 的顺序**。
- JS 用的是**普通 `<script>`（不是 `type="module"`）** → 顶层声明的 `const` / `let` / `function` 在所有文件之间共享同一个全局作用域，所以函数互相调用不需要 import/export，代码本身一行没改。代价是**也不能随意调换 `<script>` 顺序**。

`bind-*.js` 里是 `addEventListener` 注册，会在加载时立刻执行，所以它们必须排在前面所有文件之后；`init.js` 负责最后启动，必须排最后。

## 想改某个功能该动哪里

| 想改的东西                  | 文件                                |
| ---------------------- | --------------------------------- |
| 颜色、圆角、明暗主题             | `css/base.css`                    |
| 侧边栏 / 顶栏 / 输入框布局       | `css/layout.css`                  |
| 按钮、卡片、分页、弹窗通用样式        | `css/components.css`              |
| 某一个弹窗的样式               | `css/panels.css`、`css/images.css` |
| 页面骨架、某个弹窗的 HTML        | `index.html`                      |
| 新增/编辑素材、分类、标签          | `js/items.js` + `js/bind-*.js`    |
| 列表渲染、搜索筛选结果            | `js/render.js`                    |
| localStorage 结构与数据迁移   | `js/store.js`                     |
| GitHub 同步              | `js/github.js`                    |
| 图片上传、压缩                | `js/images.js`                    |
| 导入导出 JSON/TXT/Markdown | `js/io.js`                        |

一般改一个功能只需要动 1～2 个文件。

## 部署

推到仓库的 `main` 分支根目录即可，路径全部是相对路径：

```
Settings → Pages → Source: Deploy from a branch → main / (root)
```

没有构建步骤，`css/` 和 `js/` 会被原样提供。

## 


