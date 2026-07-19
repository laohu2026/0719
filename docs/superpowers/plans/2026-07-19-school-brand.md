# 主标题栏学校标识实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在篮球游戏主标题栏加入「福州软件职业学院」联合文字标识和原创 `FZ` 圆形徽记。

**架构：** 仅修改单文件页面的标题栏 HTML 与内联 CSS，不改变游戏规则和控制器。通过现有 Node.js 静态契约测试验证校名、装饰徽记语义和响应式样式，再进行浏览器布局验收。

**技术栈：** HTML5、CSS3、Node.js 内置 `node:test`。

---

## 文件结构

- 修改：`basketball_game.html`——加入学校联合标识结构、桌面样式和手机样式。
- 修改：`basketball_game.test.js`——加入学校标识静态契约测试。
- 参考：`docs/superpowers/specs/2026-07-19-school-brand-design.md`——已批准的视觉与无障碍规格。

### 任务 1：加入学校联合标识

**文件：**
- 修改：`basketball_game.test.js`
- 修改：`basketball_game.html`

- [x] **步骤 1：编写失败的静态契约测试**

在界面静态测试区域加入：

```javascript
test('主标题栏展示学校联合标识并保持无障碍语义', () => {
  const html = loadHtml();
  const schoolMark = html.match(/<[^>]+\bclass=["'][^"']*\bschool-mark\b[^"']*["'][^>]*>/i)?.[0] || '';

  assert.match(html, /<[^>]+\bclass=["'][^"']*\bschool-name\b[^"']*["'][^>]*>\s*福州软件职业学院\s*<\/[^>]+>/i);
  assert.match(schoolMark, /\baria-hidden=["']true["']/i);
  assert.match(html, /\.school-brand\s*\{/i);
  assert.match(html, /\.school-mark\s*\{/i);
  assert.match(html, /@media\s*\([^)]*max-width\s*:\s*640px[^)]*\)[\s\S]*?\.school-mark\s*\{/i);
});
```

- [x] **步骤 2：运行测试并验证失败**

运行：`node --test basketball_game.test.js`

预期：新增测试失败，原因是页面尚未包含 `school-name` 和 `school-mark`。

- [x] **步骤 3：实现标题栏结构**

将标题左侧内容替换为：

```html
<div class="school-brand">
  <span class="school-mark" aria-hidden="true">FZ</span>
  <div class="brand-copy">
    <p class="school-name">福州软件职业学院</p>
    <h1 id="gameTitle">压哨投篮</h1>
  </div>
</div>
```

删除原有「街头挑战」眉题，避免与学校名称竞争视觉层级。

- [x] **步骤 4：实现桌面端和手机端样式**

在标题样式区域加入：

```css
.school-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.school-mark {
  display: grid;
  flex: 0 0 46px;
  width: 46px;
  height: 46px;
  place-items: center;
  border: 2px solid var(--orange);
  border-radius: 50%;
  color: var(--orange-light);
  box-shadow: inset 0 0 0 5px rgb(255 122 26 / 12%);
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: -0.04em;
}

.brand-copy {
  min-width: 0;
}

.school-name {
  margin: 0 0 2px;
  color: var(--orange-light);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}
```

在现有 `@media (max-width: 640px)` 中加入：

```css
.school-brand {
  gap: 9px;
}

.school-mark {
  flex-basis: 40px;
  width: 40px;
  height: 40px;
}

.school-name {
  font-size: 0.72rem;
  letter-spacing: 0.04em;
}
```

- [x] **步骤 5：运行完整自动化测试**

运行：`node --test basketball_game.test.js`

预期：全部测试通过，失败数为 `0`。

- [x] **步骤 6：执行浏览器响应式验收**

打开 `basketball_game.html`，检查桌面端和窄屏：

- 校名、`FZ` 徽记和游戏标题完整显示。
- 玩法说明与联合标识不重叠。
- 页面没有横向滚动。
- 初始弹层和游戏交互保持正常。

当前工作区不是 Git 仓库，因此不执行 commit 步骤；以自动测试和浏览器验收结果作为完成检查点。
