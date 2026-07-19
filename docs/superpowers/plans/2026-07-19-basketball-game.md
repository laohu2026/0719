# HTML5 篮球闯关游戏实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 创建一款单文件、可直接在现代浏览器运行的中文 HTML5 篮球游戏，完整实现 10 关、每关 10 次投篮、60 分通关和逐关加速。

**架构：** `basketball_game.html` 内联 CSS、游戏 DOM、Canvas 和 JavaScript。可测试的纯规则函数暴露为 `globalThis.BasketballCore`，浏览器控制器消费这些函数；Node.js 测试通过读取 HTML 中的核心脚本并使用 `vm` 执行，保证最终游戏仍是单文件交付。

**技术栈：** HTML5、CSS3、Canvas 2D、原生 JavaScript、Node.js 内置 `node:test`、`assert` 与 `vm`。

---

## 文件结构

- 创建：`basketball_game.html`——单文件游戏，包含样式、界面、核心规则、计时器、Canvas 渲染和输入控制。
- 创建：`basketball_game.test.js`——使用 Node.js 内置测试运行器验证纯规则函数和 HTML 静态契约。
- 参考：`docs/superpowers/specs/2026-07-19-basketball-game-design.md`——已批准的需求与设计依据。

当前工作区不是 Git 仓库，因此计划不包含会失败的提交命令；每个任务完成后以测试通过和文件差异检查作为检查点。

### 任务 1：建立规则测试与最小核心

**文件：**
- 创建：`basketball_game.test.js`
- 创建：`basketball_game.html`

- [ ] **步骤 1：编写核心规则失败测试**

创建测试加载器和首批规则测试：

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCore() {
  const html = fs.readFileSync(path.join(__dirname, 'basketball_game.html'), 'utf8');
  const match = html.match(/<script id="game-core">([\s\S]*?)<\/script>/);
  assert.ok(match, '缺少 game-core 脚本');
  const context = { globalThis: {} };
  vm.runInNewContext(match[1], context);
  return context.globalThis.BasketballCore;
}

test('初始状态从第 1 关开始且有 10 次机会', () => {
  const core = loadCore();
  assert.deepEqual(
    JSON.parse(JSON.stringify(core.createInitialState())),
    { level: 1, score: 0, shotsLeft: 10, phase: 'ready' },
  );
});

test('命中增加 10 分并消耗一次机会', () => {
  const core = loadCore();
  const next = core.applyShot(core.createInitialState(), true);
  assert.equal(next.score, 10);
  assert.equal(next.shotsLeft, 9);
});

test('投失只消耗一次机会', () => {
  const core = loadCore();
  const next = core.applyShot(core.createInitialState(), false);
  assert.equal(next.score, 0);
  assert.equal(next.shotsLeft, 9);
});

test('没有剩余机会时不能再次投篮', () => {
  const core = loadCore();
  const state = { level: 1, score: 60, shotsLeft: 0, phase: 'roundOver' };
  assert.deepEqual(core.applyShot(state, true), state);
});
```

- [ ] **步骤 2：运行测试并确认正确失败**

运行：`node --test basketball_game.test.js`

预期：测试失败，错误包含 `ENOENT`，原因是 `basketball_game.html` 尚未创建。

- [ ] **步骤 3：实现最小核心规则**

创建 `basketball_game.html`，先加入可测试核心：

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>极限投篮挑战</title>
</head>
<body>
<script id="game-core">
(function (root) {
  'use strict';

  function createInitialState() {
    return { level: 1, score: 0, shotsLeft: 10, phase: 'ready' };
  }

  function applyShot(state, made) {
    if (state.shotsLeft <= 0 || state.phase === 'roundOver') return state;
    const shotsLeft = state.shotsLeft - 1;
    return {
      ...state,
      score: state.score + (made ? 10 : 0),
      shotsLeft,
      phase: shotsLeft === 0 ? 'roundOver' : 'ready',
    };
  }

  root.BasketballCore = { createInitialState, applyShot };
}(globalThis));
</script>
</body>
</html>
```

- [ ] **步骤 4：运行核心规则测试**

运行：`node --test basketball_game.test.js`

预期：4 项测试全部通过，退出码为 `0`。

### 任务 2：实现难度与关卡结算

**文件：**
- 修改：`basketball_game.test.js`
- 修改：`basketball_game.html`

- [ ] **步骤 1：追加难度和结算失败测试**

```javascript
test('10 关限时从 5.0 秒严格递减到 1.4 秒', () => {
  const core = loadCore();
  const limits = Array.from({ length: 10 }, (_, index) => core.getDifficulty(index + 1).timeLimit);
  assert.deepEqual(Array.from(limits), [5, 4.6, 4.2, 3.8, 3.4, 3, 2.6, 2.2, 1.8, 1.4]);
  for (let index = 1; index < limits.length; index += 1) {
    assert.ok(limits[index] < limits[index - 1]);
  }
});

test('指针速度随关卡提升而增加', () => {
  const core = loadCore();
  assert.ok(core.getDifficulty(10).meterSpeed > core.getDifficulty(1).meterSpeed);
});

test('60 分通过当前关，50 分失败', () => {
  const core = loadCore();
  assert.equal(core.evaluateRound({ level: 1, score: 60 }).result, 'passed');
  assert.equal(core.evaluateRound({ level: 1, score: 50 }).result, 'failed');
});

test('第 9 关通过后进入第 10 关', () => {
  const core = loadCore();
  assert.deepEqual(
    JSON.parse(JSON.stringify(core.nextRound({ level: 9, score: 60 }))),
    { level: 10, score: 0, shotsLeft: 10, phase: 'ready' },
  );
});

test('第 10 关通过后全部通关', () => {
  const core = loadCore();
  assert.equal(core.evaluateRound({ level: 10, score: 60 }).result, 'completed');
});
```

- [ ] **步骤 2：运行测试确认新测试失败**

运行：`node --test basketball_game.test.js`

预期：原有测试通过，新测试因 `getDifficulty is not a function` 失败。

- [ ] **步骤 3：实现难度和结算函数**

在核心脚本中加入并导出：

```javascript
const TIME_LIMITS = Object.freeze([5, 4.6, 4.2, 3.8, 3.4, 3, 2.6, 2.2, 1.8, 1.4]);

function getDifficulty(level) {
  const safeLevel = Math.min(10, Math.max(1, Number(level) || 1));
  return {
    timeLimit: TIME_LIMITS[safeLevel - 1],
    meterSpeed: 0.62 + (safeLevel - 1) * 0.09,
    hitZoneStart: 0.42,
    hitZoneEnd: 0.58,
  };
}

function evaluateRound(state) {
  if (state.score < 60) return { result: 'failed' };
  if (state.level === 10) return { result: 'completed' };
  return { result: 'passed' };
}

function nextRound(state) {
  return { level: state.level + 1, score: 0, shotsLeft: 10, phase: 'ready' };
}
```

将导出更新为：

```javascript
root.BasketballCore = {
  createInitialState,
  applyShot,
  getDifficulty,
  evaluateRound,
  nextRound,
};
```

- [ ] **步骤 4：运行全部规则测试**

运行：`node --test basketball_game.test.js`

预期：9 项测试全部通过。

### 任务 3：实现时机条纯逻辑

**文件：**
- 修改：`basketball_game.test.js`
- 修改：`basketball_game.html`

- [ ] **步骤 1：追加时机条失败测试**

```javascript
test('指针在命中区内判定进球，边界外判定投失', () => {
  const core = loadCore();
  const difficulty = core.getDifficulty(1);
  assert.equal(core.isHit(0.5, difficulty), true);
  assert.equal(core.isHit(0.41, difficulty), false);
  assert.equal(core.isHit(0.59, difficulty), false);
});

test('指针到达右边界后反向移动且保持在 0 到 1', () => {
  const core = loadCore();
  const result = core.advanceMeter({ position: 0.98, direction: 1 }, 0.1, 1);
  assert.ok(result.position >= 0 && result.position <= 1);
  assert.equal(result.direction, -1);
});

test('超时判定为投失', () => {
  const core = loadCore();
  assert.deepEqual(
    JSON.parse(JSON.stringify(core.resolveAttempt({ remaining: 0, position: 0.5 }, core.getDifficulty(1)))),
    { made: false, reason: 'timeout' },
  );
});
```

- [ ] **步骤 2：运行测试确认失败原因**

运行：`node --test basketball_game.test.js`

预期：新测试因 `isHit is not a function` 失败。

- [ ] **步骤 3：实现时机条函数**

```javascript
function isHit(position, difficulty) {
  return position >= difficulty.hitZoneStart && position <= difficulty.hitZoneEnd;
}

function advanceMeter(meter, deltaSeconds, speed) {
  let position = meter.position + meter.direction * deltaSeconds * speed;
  let direction = meter.direction;
  while (position > 1 || position < 0) {
    if (position > 1) {
      position = 2 - position;
      direction = -1;
    } else {
      position = -position;
      direction = 1;
    }
  }
  return { position, direction };
}

function resolveAttempt(attempt, difficulty) {
  if (attempt.remaining <= 0) return { made: false, reason: 'timeout' };
  return {
    made: isHit(attempt.position, difficulty),
    reason: isHit(attempt.position, difficulty) ? 'timed' : 'missed',
  };
}
```

导出 `isHit`、`advanceMeter` 和 `resolveAttempt`。

- [ ] **步骤 4：运行全部测试**

运行：`node --test basketball_game.test.js`

预期：12 项测试全部通过。

### 任务 4：建立可访问的完整界面

**文件：**
- 修改：`basketball_game.test.js`
- 修改：`basketball_game.html`

- [ ] **步骤 1：追加 HTML 契约失败测试**

```javascript
test('页面包含游戏所需界面与无障碍属性', () => {
  const html = fs.readFileSync(path.join(__dirname, 'basketball_game.html'), 'utf8');
  for (const id of ['gameCanvas', 'levelValue', 'scoreValue', 'shotsValue', 'timeValue', 'meterNeedle', 'shootButton', 'gameDialog']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-label="投篮"/);
  assert.match(html, /prefers-reduced-motion/);
});
```

- [ ] **步骤 2：运行测试确认静态契约失败**

运行：`node --test basketball_game.test.js`

预期：新测试因缺少 `gameCanvas` 失败。

- [ ] **步骤 3：加入完整 HTML 结构**

在核心脚本前加入：

```html
<main class="game-shell">
  <header class="scoreboard" aria-label="比赛状态">
    <div class="stat"><span>当前关卡</span><strong id="levelValue">1 / 10</strong></div>
    <div class="stat"><span>本关得分</span><strong id="scoreValue">0</strong></div>
    <div class="stat"><span>剩余投篮</span><strong id="shotsValue">10</strong></div>
    <div class="stat"><span>每球限时</span><strong id="timeValue">5.0 秒</strong></div>
  </header>
  <section class="court-panel" aria-label="篮球投篮区域">
    <canvas id="gameCanvas" width="960" height="520">浏览器不支持 Canvas。</canvas>
    <p id="statusMessage" class="status-message" aria-live="polite">准备开始</p>
  </section>
  <section class="controls" aria-label="投篮控制">
    <div class="timer-line"><span>把握最佳时机</span><strong id="countdownValue">5.0 秒</strong></div>
    <div class="meter" role="meter" aria-label="投篮时机条" aria-valuemin="0" aria-valuemax="100">
      <span class="hit-zone"><span>最佳</span></span>
      <span id="meterNeedle" class="meter-needle"></span>
    </div>
    <button id="shootButton" type="button" aria-label="投篮">投篮</button>
    <p class="keyboard-hint">点击按钮或按空格键投篮</p>
  </section>
</main>
<div id="gameDialog" class="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="dialogTitle">
  <section class="dialog-card">
    <p class="dialog-kicker">极限投篮挑战</p>
    <h1 id="dialogTitle">十关篮球王</h1>
    <p id="dialogMessage">每关 10 次机会，拿到 60 分即可晋级。</p>
    <button id="dialogButton" type="button">开始挑战</button>
  </section>
</div>
```

- [ ] **步骤 4：加入响应式视觉样式**

在 `<head>` 中加入内联 `<style>`，必须覆盖以下具体规则：

```css
:root { color-scheme: dark; --orange: #f97316; --green: #22c55e; --ink: #08111f; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; font-family: system-ui, "Microsoft YaHei", sans-serif; background: #050b14; color: #f8fafc; }
button { min-height: 52px; cursor: pointer; }
button:focus-visible { outline: 3px solid #facc15; outline-offset: 3px; }
.game-shell { width: min(100%, 1080px); min-height: 100vh; margin: 0 auto; background: var(--ink); }
.scoreboard { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 16px; }
.stat { padding: 12px; border: 1px solid #334155; border-radius: 14px; text-align: center; background: #111c2d; }
.stat span, .stat strong { display: block; }
.stat strong { margin-top: 4px; color: #fb923c; font-size: clamp(1.25rem, 3vw, 1.8rem); }
.court-panel { position: relative; aspect-ratio: 16 / 8.8; min-height: 280px; }
#gameCanvas { display: block; width: 100%; height: 100%; }
.status-message { position: absolute; left: 50%; top: 8%; transform: translateX(-50%); padding: 8px 16px; border-radius: 999px; background: rgb(8 17 31 / 80%); }
.controls { padding: 18px 22px 24px; }
.timer-line { display: flex; justify-content: space-between; margin-bottom: 8px; }
.meter { position: relative; height: 26px; overflow: hidden; border: 2px solid #64748b; border-radius: 999px; background: #27364d; }
.hit-zone { position: absolute; left: 42%; width: 16%; height: 100%; display: grid; place-items: center; background: var(--green); color: #052e16; font-size: .7rem; font-weight: 900; }
.meter-needle { position: absolute; left: 0; width: 5px; height: 100%; background: white; box-shadow: 0 0 10px white; transform: translateX(-50%); }
#shootButton, #dialogButton { width: 100%; margin-top: 14px; border: 0; border-radius: 14px; background: var(--orange); color: white; font-size: 1.1rem; font-weight: 900; }
.keyboard-hint { margin: 10px 0 0; text-align: center; color: #94a3b8; }
.dialog-backdrop { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 20px; background: rgb(2 6 23 / 86%); }
.dialog-card { width: min(100%, 460px); padding: 28px; border: 1px solid #475569; border-radius: 24px; background: #111c2d; text-align: center; box-shadow: 0 24px 80px rgb(0 0 0 / 45%); }
.dialog-kicker { color: #fb923c; font-weight: 800; letter-spacing: .12em; }
@media (max-width: 640px) { .scoreboard { grid-template-columns: repeat(2, 1fr); } .court-panel { min-height: 250px; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; } }
```

- [ ] **步骤 5：运行全部测试**

运行：`node --test basketball_game.test.js`

预期：全部测试通过，HTML 契约测试通过。

### 任务 5：实现 Canvas 渲染与投篮轨迹

**文件：**
- 修改：`basketball_game.test.js`
- 修改：`basketball_game.html`

- [ ] **步骤 1：追加轨迹失败测试**

```javascript
test('投篮轨迹从球员位置移动到篮筐位置并形成抛物线', () => {
  const core = loadCore();
  const start = core.getTrajectoryPoint(0);
  const middle = core.getTrajectoryPoint(0.5);
  const end = core.getTrajectoryPoint(1);
  assert.deepEqual(JSON.parse(JSON.stringify(start)), { x: 0.18, y: 0.78 });
  assert.deepEqual(JSON.parse(JSON.stringify(end)), { x: 0.82, y: 0.32 });
  assert.ok(middle.y < start.y && middle.y < end.y);
});
```

- [ ] **步骤 2：运行测试确认轨迹函数缺失**

运行：`node --test basketball_game.test.js`

预期：新测试因 `getTrajectoryPoint is not a function` 失败。

- [ ] **步骤 3：实现并导出轨迹函数**

```javascript
function getTrajectoryPoint(progress) {
  const t = Math.min(1, Math.max(0, progress));
  const x = 0.18 + (0.82 - 0.18) * t;
  const linearY = 0.78 + (0.32 - 0.78) * t;
  const y = linearY - Math.sin(Math.PI * t) * 0.42;
  return { x, y };
}
```

- [ ] **步骤 4：运行测试确认轨迹通过**

运行：`node --test basketball_game.test.js`

预期：全部测试通过。

- [ ] **步骤 5：实现 CanvasRenderer**

在核心脚本后加入浏览器脚本并定义 `CanvasRenderer`，严格执行以下接口和算法：

- `constructor(canvas, core)`：保存 Canvas、2D context 和核心对象；绑定 `resize()`；注册窗口 `resize` 监听；立即调整尺寸并绘制静态场景。
- `resize()`：读取 Canvas 的 CSS 边界；把设备像素比限制在 `1-2`；更新实际像素宽高；用 `context.setTransform()` 建立 CSS 像素坐标系；保存逻辑宽高并重新绘制。
- `drawScene(ballPoint, made)`：清空画布；依次绘制蓝色天空、橙棕色木地板、白色球场线、右侧篮板、橙色篮筐和白色球网；`ballPoint` 为空时在 `{ x: 0.18, y: 0.78 }` 绘球；命中时在篮筐附近绘制绿色光晕，投失时绘制红色光晕。
- `drawBall(x, y)`：把归一化坐标乘以逻辑宽高；半径使用 `clamp(width * 0.032, 18, 34)`；绘制橙色径向渐变圆、深色水平弧线、垂直弧线和外边框。
- `animateShot(made, reducedMotion)`：返回 `Promise`；减少动画时直接绘制终点并完成；普通模式使用 `requestAnimationFrame` 在 650 ms 内读取 `core.getTrajectoryPoint(progress)`，投失时在 `progress > 0.72` 后增加水平偏移；进度到 1 时保存最终画面并完成 Promise。
- `destroy()`：取消仍在运行的投篮动画帧，并移除窗口 `resize` 监听。

- [ ] **步骤 6：浏览器静态检查**

直接打开 `basketball_game.html`。

预期：显示深色球场、地板、篮筐和篮球；调整窗口后 Canvas 不变形、不模糊，控制台无错误。

### 任务 6：实现计时循环、输入锁和关卡流程

**文件：**
- 修改：`basketball_game.test.js`
- 修改：`basketball_game.html`

- [ ] **步骤 1：追加重复输入保护测试**

```javascript
test('非 ready 阶段不接受投篮输入', () => {
  const core = loadCore();
  assert.equal(core.canShoot({ shotsLeft: 10, phase: 'animating' }), false);
  assert.equal(core.canShoot({ shotsLeft: 10, phase: 'paused' }), false);
  assert.equal(core.canShoot({ shotsLeft: 10, phase: 'ready' }), true);
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：`node --test basketball_game.test.js`

预期：新测试因 `canShoot is not a function` 失败。

- [ ] **步骤 3：实现并导出输入保护函数**

```javascript
function canShoot(state) {
  return state.phase === 'ready' && state.shotsLeft > 0;
}
```

- [ ] **步骤 4：运行全部测试**

运行：`node --test basketball_game.test.js`

预期：全部测试通过。

- [ ] **步骤 5：实现 GameController**

浏览器脚本定义 `GameController`，严格执行以下状态转换：

- `constructor(core, renderer, elements)`：创建初始状态；初始化 `{ position: 0, direction: 1 }`、剩余时间、动画帧编号、上一帧时间和暂停前阶段；绑定所有事件处理函数；调用 `renderHud()`。
- `startGame()`：取消旧循环；设置 `core.createInitialState()`；隐藏弹层；调用 `startAttempt()`。
- `startAttempt()`：把阶段设为 `ready`；指针重置为左端并向右；剩余时间取当前关 `timeLimit`；上一帧时间清空；启用投篮按钮；启动 `requestAnimationFrame(update)`。
- `update(timestamp)`：若阶段不是 `ready` 则退出；首帧只保存时间；其余帧计算不超过 0.1 秒的 delta；调用 `advanceMeter()`；扣减剩余时间；刷新 HUD；剩余时间归零时调用 `shoot(true)`，否则请求下一帧。
- `shoot(timedOut)`：先调用 `canShoot()`，不接受输入时立即返回；把阶段改为 `animating`、禁用按钮并取消计时帧；超时时结果固定为投失，否则调用 `resolveAttempt()`；更新状态消息；等待 `renderer.animateShot()` 完成后调用 `finishAttempt(made)`。
- `finishAttempt(made)`：调用 `applyShot()` 并刷新 HUD；机会为 0 时调用 `finishRound()`，否则在 350 ms 结果停留后调用 `startAttempt()`。
- `finishRound()`：调用 `evaluateRound()`；失败时显示分数和「重试本关」；通过第 1-9 关时显示分数和「进入下一关」；全部通关时显示「十关全部完成」和「重新开始」。
- `retryLevel()`：保留当前关卡，把分数设为 0、机会设为 10、阶段设为 `ready`，隐藏弹层并开始投篮。
- `advanceLevel()`：调用 `nextRound()`，隐藏弹层并开始下一关。
- `handleVisibility()`：页面隐藏且处于 `ready` 时记录原阶段、改为 `paused` 并取消帧；页面恢复且暂停前为 `ready` 时改回 `ready`、清空上一帧时间并恢复循环，保证后台时间不计入倒计时。
- `renderHud()`：更新关卡、分数、剩余机会、每球限时、实时倒计时；把指针位置写入 `transform: translateX(...)`；同步 meter 的 `aria-valuenow`；仅在阶段为 `ready` 时启用投篮按钮。
- `destroy()`：取消计时帧和结果延时，移除按钮、键盘、页面可见性事件，并调用 `renderer.destroy()`。

必须绑定：

- `shootButton` 的 `click`。
- `document` 的 `keydown`，仅在 `event.code === 'Space'` 且非重复按键时投篮，并调用 `preventDefault()`。
- `document.visibilitychange`，后台时暂停，返回时恢复。
- 弹层按钮根据当前弹层动作执行开始、下一关、重试或重新开始。

- [ ] **步骤 6：运行回归测试**

运行：`node --test basketball_game.test.js`

预期：全部测试通过，无警告或异常输出。

### 任务 7：端到端手动验收与收尾

**文件：**
- 修改：`basketball_game.html`（仅修复验收发现的问题）
- 修改：`basketball_game.test.js`（每个逻辑缺陷先增加失败测试）

- [ ] **步骤 1：运行自动测试基线**

运行：`node --test basketball_game.test.js`

预期：全部测试通过，退出码为 `0`。

- [ ] **步骤 2：桌面端完整流程验收**

在浏览器中打开 `basketball_game.html`，依次验证：

1. 开始弹层说明 10 次机会和 60 分通关。
2. 鼠标点击和空格键均可投篮。
3. 动画期间连续点击不会多扣机会。
4. 每次命中恰好增加 10 分。
5. 10 次后分数达到 60 分显示成功弹层。
6. 低于 60 分显示失败弹层，并可重试当前关。
7. 逐关确认限时依次为 5.0 到 1.4 秒。
8. 第 10 关通过后显示全部通关弹层。
9. 重新开始后回到第 1 关、0 分和 10 次机会。

预期：所有步骤行为与设计规格一致，控制台无错误。

- [ ] **步骤 3：验证暂停与恢复**

在一次投篮倒计时过程中切换到其他标签页，等待数秒后返回。

预期：返回时仍保留离开前的剩余时间，不会立即判定超时；计时继续正常运行。

- [ ] **步骤 4：验证响应式布局**

使用浏览器设备模拟分别检查 `390 × 844` 和 `1280 × 800`。

预期：无横向滚动；状态卡片、Canvas、时机条和投篮按钮完整可见；按钮触控区域不小于 44 × 44 像素。

- [ ] **步骤 5：验证减少动画模式**

在开发者工具中模拟 `prefers-reduced-motion: reduce` 后重新加载。

预期：投篮结果立即反馈，玩法、计分、机会和关卡流程保持完整。

- [ ] **步骤 6：最终验证**

运行：`node --test basketball_game.test.js`

预期：全部测试通过。随后检查 `basketball_game.html` 不引用外部 CSS、JavaScript、图片或字体，确认双击文件即可运行。
