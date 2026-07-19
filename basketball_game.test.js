'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Worker } = require('node:worker_threads');

function loadCore() {
  const htmlPath = path.join(__dirname, 'basketball_game.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const match = html.match(/<script\b(?=[^>]*\bid=["']game-core["'])[^>]*>([\s\S]*?)<\/script>/i);

  assert.ok(match, 'basketball_game.html 必须包含 id="game-core" 的脚本');

  const context = vm.createContext({ globalThis: {} });
  vm.runInContext(match[1], context);
  return context.globalThis.BasketballCore;
}

function loadHtml() {
  return fs.readFileSync(path.join(__dirname, 'basketball_game.html'), 'utf8');
}

function loadRenderer() {
  const html = loadHtml();
  const scripts = Array.from(html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi));
  const rendererScript = scripts.find((match) => /class\s+CanvasRenderer/.test(match[1]));
  assert.ok(rendererScript, '页面必须定义 CanvasRenderer');

  const context = vm.createContext({
    globalThis: null,
    document: { getElementById: () => null },
  });
  context.globalThis = context;
  context.addEventListener = () => {};
  context.removeEventListener = () => {};
  vm.runInContext(rendererScript[1], context);
  return context.CanvasRenderer;
}

function createMockCanvas() {
  const calls = [];
  const gradient = { addColorStop: (...args) => calls.push(['addColorStop', ...args]) };
  const methods = [
    'arc',
    'beginPath',
    'clearRect',
    'clip',
    'createLinearGradient',
    'createRadialGradient',
    'ellipse',
    'fill',
    'fillRect',
    'lineTo',
    'moveTo',
    'quadraticCurveTo',
    'restore',
    'save',
    'setTransform',
    'stroke',
    'strokeRect',
  ];
  const context = {};
  for (const method of methods) {
    context[method] = (...args) => {
      calls.push([method, ...args]);
      return method.startsWith('create') ? gradient : undefined;
    };
  }

  return {
    canvas: {
      getBoundingClientRect: () => ({ width: 960, height: 528 }),
      getContext: () => context,
    },
    calls,
  };
}

function openingTagForId(html, id) {
  const match = html.match(new RegExp(`<[^>]+\\bid=["']${id}["'][^>]*>`, 'i'));
  assert.ok(match, `页面必须包含 id="${id}"`);
  return match[0];
}

test('页面提供完整中文游戏界面所需的静态元素', () => {
  const html = loadHtml();
  const requiredIds = [
    'gameCanvas',
    'levelValue',
    'scoreValue',
    'shotsValue',
    'timeValue',
    'countdownValue',
    'meterNeedle',
    'shootButton',
    'gameDialog',
    'dialogTitle',
    'dialogMessage',
    'dialogButton',
    'statusMessage',
  ];

  assert.match(html, /<html\b[^>]*\blang=["']zh-CN["'][^>]*>/i);
  for (const id of requiredIds) {
    openingTagForId(html, id);
  }
});

test('关键交互元素具备无障碍语义与中文 Canvas 降级内容', () => {
  const html = loadHtml();
  const shootButton = openingTagForId(html, 'shootButton');
  const meter = html.match(/<[^>]+\brole=["']meter["'][^>]*>/i)?.[0] || '';
  const canvas = openingTagForId(html, 'gameCanvas');

  assert.match(shootButton, /\baria-label=["']投篮["']/i);
  assert.match(html, /\baria-live=["']polite["']/i);
  assert.match(meter, /\baria-valuemin=["']0["']/i);
  assert.match(meter, /\baria-valuemax=["']100["']/i);
  assert.match(canvas, /^<canvas\b/i);
  assert.match(html, /<canvas\b[^>]*\bid=["']gameCanvas["'][^>]*>[\s\S]*[\u4e00-\u9fff][\s\S]*<\/canvas>/i);
});

test('页面声明移动端视口和响应式、减弱动态效果契约', () => {
  const html = loadHtml();

  assert.match(html, /<meta\b(?=[^>]*\bname=["']viewport["'])(?=[^>]*\bcontent=["'][^"']*width=device-width[^"']*initial-scale=1(?:\.0)?[^"']*["'])[^>]*>/i);
  assert.match(html, /@media\s*\([^)]*max-width\s*:\s*640px[^)]*\)/i);
  assert.match(html, /@media\s*\([^)]*prefers-reduced-motion\s*:\s*reduce[^)]*\)/i);
  assert.match(html, /:focus-visible/i);
  assert.match(html, /z-index\s*:\s*50\b/i);
  assert.match(html, /min-height\s*:\s*52px/i);
  assert.match(html, /overflow-x\s*:\s*hidden/i);
});

test('初始弹层将游戏主体设为 inert 并自动聚焦弹层按钮', () => {
  const html = loadHtml();
  const gameShell = html.match(/<main\b[^>]*\bclass=["'][^"']*\bgame-shell\b[^"']*["'][^>]*>/i)?.[0] || '';
  const dialogButton = openingTagForId(html, 'dialogButton');

  assert.match(gameShell, /\binert(?:\s|=|>)/i);
  assert.match(dialogButton, /\bautofocus(?:\s|=|>)/i);
});

test('游戏画布提供可访问名称和等价中文降级说明', () => {
  const html = loadHtml();
  const canvas = openingTagForId(html, 'gameCanvas');

  assert.match(canvas, /\baria-label=["']篮球场游戏画面["']/i);
  assert.match(
    html,
    /<canvas\b[^>]*\bid=["']gameCanvas["'][^>]*>\s*篮球场游戏画面无法显示，请使用支持 HTML5 Canvas 的浏览器。\s*<\/canvas>/i,
  );
});

test('弹层背景和卡片支持小视口纵向滚动', () => {
  const html = loadHtml();

  assert.match(html, /\.dialog-backdrop\s*\{[^}]*\boverflow-y\s*:\s*auto\s*;/is);
  assert.match(html, /\.dialog-card\s*\{[^}]*\bmax-height\s*:\s*calc\(100vh\s*-\s*40px\)\s*;/is);
  assert.match(html, /\.dialog-card\s*\{[^}]*\boverflow-y\s*:\s*auto\s*;/is);
});

test('初始弹层明确每关机会、晋级分数和最佳投篮区域', () => {
  const html = loadHtml();
  const message = html.match(/<p\b[^>]*\bid=["']dialogMessage["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] || '';

  assert.equal(message.trim(), '每关 10 次投篮机会，达到 60 分即可晋级；在绿色最佳区域投篮。');
});

test('CanvasRenderer 定义在核心脚本之外并获取二维绘图上下文', () => {
  const html = loadHtml();
  const coreScript = html.match(/<script\b(?=[^>]*\bid=["']game-core["'])[^>]*>([\s\S]*?)<\/script>/i)?.[1] || '';

  assert.doesNotMatch(coreScript, /CanvasRenderer/);
  assert.match(html, /globalThis\.CanvasRenderer\s*=\s*class\s+CanvasRenderer/);
  assert.match(html, /getContext\s*\(\s*['"]2d['"]\s*\)/);
});

test('CanvasRenderer 限制 DPR 到 1 至 2 并将画布变换为 CSS 像素', () => {
  const html = loadHtml();

  assert.match(html, /devicePixelRatio/);
  assert.match(html, /Math\.min\s*\(\s*2\s*,\s*Math\.max\s*\(\s*1\s*,/);
  assert.match(html, /getBoundingClientRect\s*\(/);
  assert.match(html, /setTransform\s*\(\s*dpr\s*,\s*0\s*,\s*0\s*,\s*dpr\s*,\s*0\s*,\s*0\s*\)/);
});

test('CanvasRenderer 使用 Promise 和动画帧并在销毁时完整清理', () => {
  const html = loadHtml();

  assert.match(html, /animateShot\s*\(\s*made\s*,\s*reducedMotion\s*\)/);
  assert.match(html, /new\s+Promise\s*\(/);
  assert.match(html, /requestAnimationFrame\s*\(/);
  assert.match(html, /cancelAnimationFrame\s*\(/);
  assert.match(html, /removeEventListener\s*\(\s*['"]resize['"]/);
  assert.match(html, /getTrajectoryPoint\s*\(/);
});

test('CanvasRenderer 使用布尔投篮结果和双数值篮球坐标契约', () => {
  const html = loadHtml();

  assert.match(html, /drawScene\s*\(\s*ballPoint\s*=\s*null\s*,\s*made\s*=\s*null\s*\)/);
  assert.match(html, /drawBall\s*\(\s*x\s*,\s*y\s*\)/);
  assert.match(html, /this\.drawBall\s*\(\s*point\.x\s*,\s*point\.y\s*\)/);
  assert.match(html, /made\s*===\s*true/);
  assert.match(html, /made\s*===\s*false/);
  assert.doesNotMatch(html, /made\s*\?\s*['"]made['"]\s*:\s*['"]missed['"]/);
});

test('篮球半径、独立外边框和全部弧形纹路符合绘制契约', () => {
  const html = loadHtml();
  const drawBall = html.match(/drawBall\s*\(\s*x\s*,\s*y\s*\)\s*\{([\s\S]*?)\r?\n\s*\}\r?\n\r?\n\s*animateShot/)?.[1] || '';

  assert.match(drawBall, /Math\.min\s*\(\s*34\s*,\s*Math\.max\s*\(\s*18\s*,\s*this\.width\s*\*\s*0\.032\s*\)\s*\)/);
  assert.match(drawBall, /ctx\.fill\s*\(\s*\)[\s\S]*?ctx\.restore\s*\(\s*\)[\s\S]*?ctx\.strokeStyle\s*=\s*['"]#4c1d0b['"][\s\S]*?ctx\.arc\s*\([^;]+Math\.PI\s*\*\s*2\s*\)[\s\S]*?ctx\.stroke\s*\(\s*\)/);
  assert.doesNotMatch(drawBall, /ctx\.lineTo\s*\(/);
  assert.ok((drawBall.match(/ctx\.arc\s*\(/g) || []).length >= 3, '圆形、水平和垂直纹路应使用 arc');
  assert.ok((drawBall.match(/ctx\.quadraticCurveTo\s*\(/g) || []).length >= 2, '两侧纹路应使用 quadraticCurveTo');
});

test('Canvas mock 可实例化渲染器并以布尔结果绘制场景和双参数篮球', () => {
  const CanvasRenderer = loadRenderer();
  const { canvas, calls } = createMockCanvas();
  const renderer = new CanvasRenderer(canvas, { getTrajectoryPoint: () => ({ x: 0.82, y: 0.32 }) });

  assert.doesNotThrow(() => renderer.drawScene({ x: 0.4, y: 0.5 }, true));
  assert.doesNotThrow(() => renderer.drawScene({ x: 0.4, y: 0.5 }, false));
  assert.doesNotThrow(() => renderer.drawScene({ x: 0.4, y: 0.5 }, null));
  assert.doesNotThrow(() => renderer.drawBall(0.4, 0.5));
  assert.ok(calls.some(([method, x, y]) => method === 'arc' && x === 384 && y === 264));
});

test('页面初始化渲染器和游戏控制器且保持初始弹层显示', () => {
  const html = loadHtml();
  const dialog = openingTagForId(html, 'gameDialog');

  assert.match(html, /new\s+globalThis\.CanvasRenderer\s*\(/);
  assert.match(html, /globalThis\.GameController\s*=\s*class\s+GameController/);
  assert.match(html, /new\s+globalThis\.GameController\s*\(/);
  assert.doesNotMatch(dialog, /\bhidden\b|display\s*:\s*none/i);
});

test('GameController 实现计时、投篮、关卡、暂停和销毁流程', () => {
  const html = loadHtml();
  const requiredMethods = [
    'startGame',
    'startAttempt',
    'update',
    'shoot',
    'finishAttempt',
    'finishRound',
    'retryLevel',
    'advanceLevel',
    'handleVisibility',
    'renderHud',
    'destroy',
  ];

  for (const method of requiredMethods) {
    assert.match(html, new RegExp(`\\b${method}\\s*\\(`), `缺少 ${method} 方法`);
  }
  assert.match(html, /addEventListener\s*\(\s*['"]click['"]/);
  assert.match(html, /addEventListener\s*\(\s*['"]keydown['"]/);
  assert.match(html, /addEventListener\s*\(\s*['"]visibilitychange['"]/);
  assert.match(html, /event\.code\s*(?:===|!==)\s*['"]Space['"]/);
  assert.match(html, /event\.repeat/);
  assert.match(html, /preventDefault\s*\(\s*\)/);
  assert.match(html, /matchMedia\s*\(\s*['"]\(prefers-reduced-motion:\s*reduce\)['"]\s*\)/);
});

function advanceMeterInWorker(meter, deltaSeconds, speed) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads');
      const fs = require('node:fs');
      const vm = require('node:vm');
      const html = fs.readFileSync(workerData.htmlPath, 'utf8');
      const match = html.match(/<script\\b(?=[^>]*\\bid=["']game-core["'])[^>]*>([\\s\\S]*?)<\\/script>/i);
      const context = vm.createContext({ globalThis: {} });
      vm.runInContext(match[1], context);
      parentPort.postMessage(
        context.globalThis.BasketballCore.advanceMeter(
          workerData.meter,
          workerData.deltaSeconds,
          workerData.speed,
        ),
      );
    `, {
      eval: true,
      workerData: {
        htmlPath: path.join(__dirname, 'basketball_game.html'),
        meter,
        deltaSeconds,
        speed,
      },
    });
    const timeout = setTimeout(() => {
      void worker.terminate();
      reject(new Error('advanceMeter 处理超大步长未能快速结束'));
    }, 5000);

    worker.once('message', (result) => {
      clearTimeout(timeout);
      void worker.terminate();
      resolve(result);
    });
    worker.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

test('初始状态精确匹配回合默认值', () => {
  const core = loadCore();

  assert.deepStrictEqual({ ...core.createInitialState() }, {
    level: 1,
    score: 0,
    shotsLeft: 10,
    phase: 'ready',
  });
});

test('命中加 10 分并减少一次机会，且不突变原状态', () => {
  const core = loadCore();
  const state = { level: 1, score: 0, shotsLeft: 10, phase: 'ready' };

  const nextState = core.applyShot(state, true);

  assert.deepStrictEqual({ ...nextState }, {
    level: 1,
    score: 10,
    shotsLeft: 9,
    phase: 'ready',
  });
  assert.deepStrictEqual(state, {
    level: 1,
    score: 0,
    shotsLeft: 10,
    phase: 'ready',
  });
  assert.notStrictEqual(nextState, state);
});

test('普通投失时分数不变、只减少一次机会且回合仍可继续', () => {
  const core = loadCore();
  const state = { level: 1, score: 20, shotsLeft: 5, phase: 'ready' };

  const nextState = core.applyShot(state, false);

  assert.deepStrictEqual({ ...nextState }, {
    level: 1,
    score: 20,
    shotsLeft: 4,
    phase: 'ready',
  });
});

test('投失只减少一次机会，最后一次后结束回合', () => {
  const core = loadCore();
  const state = { level: 1, score: 20, shotsLeft: 1, phase: 'ready' };

  const nextState = core.applyShot(state, false);

  assert.deepStrictEqual({ ...nextState }, {
    level: 1,
    score: 20,
    shotsLeft: 0,
    phase: 'roundOver',
  });
  assert.deepStrictEqual(state, {
    level: 1,
    score: 20,
    shotsLeft: 1,
    phase: 'ready',
  });
});

test('没有剩余机会或回合已结束时返回原状态', () => {
  const core = loadCore();
  const noShots = { level: 1, score: 30, shotsLeft: 0, phase: 'ready' };
  const roundOver = { level: 1, score: 30, shotsLeft: 4, phase: 'roundOver' };

  assert.strictEqual(core.applyShot(noShots, true), noShots);
  assert.strictEqual(core.applyShot(roundOver, false), roundOver);
});

test('剩余机会为负数时返回原状态', () => {
  const core = loadCore();
  const state = { level: 1, score: 30, shotsLeft: -1, phase: 'ready' };

  assert.strictEqual(core.applyShot(state, true), state);
});

test('10 关限时精确匹配并逐关递减', () => {
  const core = loadCore();
  const timeLimits = Array.from({ length: 10 }, (_, index) => (
    core.getDifficulty(index + 1).timeLimit
  ));

  assert.deepStrictEqual(timeLimits, [5, 4.6, 4.2, 3.8, 3.4, 3, 2.6, 2.2, 1.8, 1.4]);
  assert.ok(timeLimits.every((timeLimit, index) => (
    index === 0 || timeLimit < timeLimits[index - 1]
  )));
});

test('难度关卡转为数字并限制在 1 到 10，命中区固定', () => {
  const core = loadCore();

  assert.deepStrictEqual({ ...core.getDifficulty('0') }, { ...core.getDifficulty(1) });
  assert.deepStrictEqual({ ...core.getDifficulty('11') }, { ...core.getDifficulty(10) });
  assert.equal(core.getDifficulty('4').timeLimit, 3.8);
  assert.equal(core.getDifficulty(6).hitZoneStart, 0.42);
  assert.equal(core.getDifficulty(6).hitZoneEnd, 0.58);
});

test('小数关卡截断为整数关卡', () => {
  const core = loadCore();

  assert.deepStrictEqual({ ...core.getDifficulty(1.9) }, { ...core.getDifficulty(1) });
  assert.deepStrictEqual({ ...core.getDifficulty(9.8) }, { ...core.getDifficulty(9) });
});

test('无效关卡回退到第 1 关难度', () => {
  const core = loadCore();

  for (const level of [undefined, NaN, 'abc']) {
    const difficulty = core.getDifficulty(level);

    assert.equal(difficulty.timeLimit, 5);
    assert.equal(difficulty.meterSpeed, 0.62);
  }
});

test('指针速度第 1 关为 0.62、第 10 关为 1.43，且逐关增加 0.09', () => {
  const core = loadCore();
  const speeds = Array.from({ length: 10 }, (_, index) => (
    core.getDifficulty(index + 1).meterSpeed
  ));
  const tolerance = 1e-12;

  assert.ok(Math.abs(speeds[0] - 0.62) < tolerance);
  assert.ok(Math.abs(speeds[9] - 1.43) < tolerance);
  for (let index = 1; index < speeds.length; index += 1) {
    assert.ok(Math.abs((speeds[index] - speeds[index - 1]) - 0.09) < tolerance);
  }
});

test('关卡限时使用冻结的 TIME_LIMITS 常量', () => {
  const html = fs.readFileSync(path.join(__dirname, 'basketball_game.html'), 'utf8');

  assert.match(html, /const\s+TIME_LIMITS\s*=\s*Object\.freeze\s*\(\s*\[/);
});

test('50 分失败，60 分通过', () => {
  const core = loadCore();

  assert.deepStrictEqual({ ...core.evaluateRound({ level: 3, score: 50 }) }, { result: 'failed' });
  assert.deepStrictEqual({ ...core.evaluateRound({ level: 3, score: 60 }) }, { result: 'passed' });
});

test('第 9 关通过后进入全新的第 10 关状态', () => {
  const core = loadCore();
  const state = { level: 9, score: 80, shotsLeft: 0, phase: 'roundOver' };

  const nextState = core.nextRound(state);

  assert.deepStrictEqual({ ...nextState }, {
    level: 10,
    score: 0,
    shotsLeft: 10,
    phase: 'ready',
  });
  assert.notStrictEqual(nextState, state);
});

test('第 10 关不能进入第 11 关并返回原状态引用', () => {
  const core = loadCore();
  const state = { level: 10, score: 80, shotsLeft: 0, phase: 'roundOver' };

  assert.strictEqual(core.nextRound(state), state);
});

test('第 10 关达到 60 分时完成游戏', () => {
  const core = loadCore();

  assert.deepStrictEqual(
    { ...core.evaluateRound({ level: 10, score: 60 }) },
    { result: 'completed' },
  );
});

test('投篮轨迹起终点精确匹配篮筐两端坐标', () => {
  const core = loadCore();

  assert.deepStrictEqual({ ...core.getTrajectoryPoint(0) }, { x: 0.18, y: 0.78 });
  assert.deepStrictEqual({ ...core.getTrajectoryPoint(1) }, { x: 0.82, y: 0.32 });
});

test('投篮轨迹横坐标线性推进且中点形成向上的抛物弧', () => {
  const core = loadCore();
  const midpoint = core.getTrajectoryPoint(0.5);

  assert.ok(Math.abs(midpoint.x - 0.5) < 1e-12);
  assert.ok(Math.abs(midpoint.y - 0.13) < 1e-12);
  assert.ok(midpoint.y < 0.32);
  assert.ok(midpoint.y < 0.78);
});

test('投篮轨迹限制进度到 0 至 1 且 NaN 回退到起点', () => {
  const core = loadCore();

  assert.deepStrictEqual({ ...core.getTrajectoryPoint(-1) }, { x: 0.18, y: 0.78 });
  assert.deepStrictEqual({ ...core.getTrajectoryPoint(2) }, { x: 0.82, y: 0.32 });
  assert.deepStrictEqual({ ...core.getTrajectoryPoint(NaN) }, { x: 0.18, y: 0.78 });
});

test('命中区中心与闭区间边界命中，区间外投失', () => {
  const core = loadCore();
  const difficulty = core.getDifficulty(1);

  assert.equal(core.isHit(0.5, difficulty), true);
  assert.equal(core.isHit(0.41, difficulty), false);
  assert.equal(core.isHit(0.59, difficulty), false);
  assert.equal(core.isHit(0.42, difficulty), true);
  assert.equal(core.isHit(0.58, difficulty), true);
});

test('命中判断遇到非有限位置或命中区边界时返回 false', () => {
  const core = loadCore();
  const difficulty = core.getDifficulty(1);

  for (const position of [NaN, Infinity, -Infinity]) {
    assert.equal(core.isHit(position, difficulty), false);
  }
  for (const hitZoneStart of [NaN, Infinity, -Infinity]) {
    assert.equal(core.isHit(0.5, { ...difficulty, hitZoneStart }), false);
  }
  for (const hitZoneEnd of [NaN, Infinity, -Infinity]) {
    assert.equal(core.isHit(0.5, { ...difficulty, hitZoneEnd }), false);
  }
});

test('指针越过右边界时镜像反弹并向左移动', () => {
  const core = loadCore();

  const meter = core.advanceMeter({ position: 0.9, direction: 1 }, 0.2, 1);

  assert.ok(Math.abs(meter.position - 0.9) < 1e-12);
  assert.equal(meter.direction, -1);
});

test('指针越过左边界时镜像反弹并向右移动', () => {
  const core = loadCore();

  const meter = core.advanceMeter({ position: 0.1, direction: -1 }, 0.2, 1);

  assert.ok(Math.abs(meter.position - 0.1) < 1e-12);
  assert.equal(meter.direction, 1);
});

test('推进指针返回新对象且不修改输入对象', () => {
  const core = loadCore();
  const input = { position: 0.25, direction: 1 };

  const meter = core.advanceMeter(input, 0.5, 1);

  assert.notStrictEqual(meter, input);
  assert.deepStrictEqual(input, { position: 0.25, direction: 1 });
});

test('推进指针对位置、方向、时间和速度使用确定降级规则', () => {
  const core = loadCore();

  for (const position of [NaN, Infinity, -Infinity]) {
    assert.deepStrictEqual(
      { ...core.advanceMeter({ position, direction: 1 }, 0, 1) },
      { position: 0, direction: 1 },
    );
  }
  assert.deepStrictEqual(
    { ...core.advanceMeter({ position: -2, direction: 1 }, 0, 1) },
    { position: 0, direction: 1 },
  );
  assert.deepStrictEqual(
    { ...core.advanceMeter({ position: 2, direction: -1 }, 0, 1) },
    { position: 1, direction: -1 },
  );

  for (const direction of [0, 2, NaN, Infinity, undefined]) {
    const meter = core.advanceMeter({ position: 0.5, direction }, 0.1, 1);
    assert.ok(Math.abs(meter.position - 0.6) < 1e-12);
    assert.equal(meter.direction, 1);
  }

  for (const deltaSeconds of [NaN, Infinity, -Infinity, -1]) {
    assert.deepStrictEqual(
      { ...core.advanceMeter({ position: 0.5, direction: 1 }, deltaSeconds, 1) },
      { position: 0.5, direction: 1 },
    );
  }
  for (const speed of [NaN, Infinity, -Infinity, -1]) {
    assert.deepStrictEqual(
      { ...core.advanceMeter({ position: 0.5, direction: 1 }, 1, speed) },
      { position: 0.5, direction: 1 },
    );
  }
});

test('指针精确位于边界并朝外时立即反弹', () => {
  const core = loadCore();

  assert.deepStrictEqual(
    { ...core.advanceMeter({ position: 0, direction: -1 }, 0, 1) },
    { position: 0, direction: 1 },
  );
  assert.deepStrictEqual(
    { ...core.advanceMeter({ position: 1, direction: 1 }, 0, 1) },
    { position: 1, direction: -1 },
  );
});

test('大步长经过多次反弹后位置仍保持在 0 到 1', () => {
  const core = loadCore();

  const meter = core.advanceMeter({ position: 0.25, direction: 1 }, 12.5, 1);

  assert.ok(meter.position >= 0 && meter.position <= 1);
  assert.equal(meter.position, 0.75);
  assert.equal(meter.direction, 1);
});

test('delta 为 1e12 时快速结束且位置保持在 0 到 1', async () => {
  const meter = await advanceMeterInWorker({ position: 0.25, direction: 1 }, 1e12, 1);

  assert.ok(meter.position >= 0 && meter.position <= 1);
});

test('剩余时间耗尽时即使命中命中区也判定超时失败', () => {
  const core = loadCore();
  const difficulty = core.getDifficulty(1);

  assert.deepStrictEqual(
    { ...core.resolveAttempt({ position: 0.5, remaining: 0 }, difficulty) },
    { made: false, reason: 'timeout' },
  );
});

test('剩余时间非有限或小于等于零时均判定超时且不修改输入', () => {
  const core = loadCore();
  const difficulty = core.getDifficulty(1);

  for (const remaining of [NaN, Infinity, -Infinity, 0, -1]) {
    const attempt = { position: 0.5, remaining };
    const snapshot = { ...attempt };

    assert.deepStrictEqual(
      { ...core.resolveAttempt(attempt, difficulty) },
      { made: false, reason: 'timeout' },
    );
    assert.deepStrictEqual(attempt, snapshot);
  }
});

test('剩余时间内命中返回 timed，投失返回 missed', () => {
  const core = loadCore();
  const difficulty = core.getDifficulty(1);

  assert.deepStrictEqual(
    { ...core.resolveAttempt({ position: 0.5, remaining: 1 }, difficulty) },
    { made: true, reason: 'timed' },
  );
  assert.deepStrictEqual(
    { ...core.resolveAttempt({ position: 0.41, remaining: 1 }, difficulty) },
    { made: false, reason: 'missed' },
  );
});

test('仅 ready 阶段且仍有机会时允许投篮', () => {
  const core = loadCore();

  assert.equal(core.canShoot({ shotsLeft: 10, phase: 'ready' }), true);
  assert.equal(core.canShoot({ shotsLeft: 10, phase: 'animating' }), false);
  assert.equal(core.canShoot({ shotsLeft: 10, phase: 'paused' }), false);
  assert.equal(core.canShoot({ shotsLeft: 0, phase: 'ready' }), false);
});
