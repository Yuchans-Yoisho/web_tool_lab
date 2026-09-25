(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const svgNS = "http://www.w3.org/2000/svg";
  const colors = ["#f7a46b", "#a8d9ce", "#a9bff1", "#f3cce0", "#ead28a", "#bdc9a7", "#b9a6e3", "#eaa9a0"];

  function randomInt(max) {
    if (!Number.isSafeInteger(max) || max < 1 || max > 0xffffffff) throw new RangeError("Invalid random range");
    const limit = Math.floor(0x100000000 / max) * max;
    const values = new Uint32Array(1);
    do { crypto.getRandomValues(values); } while (values[0] >= limit);
    return values[0] % max;
  }

  function lines(value, max) {
    const items = value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    if (items.length < 2 || items.length > max) throw new Error("2〜" + max + "件を入力してください。");
    if (items.some((x) => Array.from(x).length > 40)) throw new Error("各行は40文字以内にしてください。");
    return items;
  }

  function element(name, attrs = {}) {
    const el = document.createElementNS(svgNS, name);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
    return el;
  }

  function showError(id, message) { $(id).textContent = message; }

  function renderWheel(items) {
    const wheel = $("wheel");
    wheel.replaceChildren();
    const radius = 148;
    items.forEach((item, index) => {
      const start = -Math.PI / 2 + 2 * Math.PI * index / items.length;
      const end = -Math.PI / 2 + 2 * Math.PI * (index + 1) / items.length;
      const x1 = 160 + radius * Math.cos(start), y1 = 160 + radius * Math.sin(start);
      const x2 = 160 + radius * Math.cos(end), y2 = 160 + radius * Math.sin(end);
      const path = element("path", {
        d: "M 160 160 L " + x1 + " " + y1 + " A " + radius + " " + radius + " 0 " + (items.length === 2 ? 0 : (end - start > Math.PI ? 1 : 0)) + " 1 " + x2 + " " + y2 + " Z",
        fill: colors[index % colors.length], stroke: "#fffaf2", "stroke-width": 2
      });
      wheel.append(path);
      const mid = (start + end) / 2;
      const text = element("text", {
        x: 160 + 88 * Math.cos(mid), y: 160 + 88 * Math.sin(mid),
        "text-anchor": "middle", "dominant-baseline": "middle", "font-size": items.length > 12 ? 11 : 13,
        fill: "#27313a"
      });
      text.textContent = Array.from(item).slice(0, 8).join("") + (Array.from(item).length > 8 ? "…" : "");
      wheel.append(text);
    });
    wheel.append(element("circle", { cx: 160, cy: 160, r: 15, fill: "#263a4a" }));
  }

  let wheelRotation = 0;
  let spinning = false;
  const rouletteButton = $("roulette-run");
  if (rouletteButton) {
    renderWheel(lines($("roulette-items").value, 20));
    $("roulette-motion-note").hidden = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  rouletteButton?.addEventListener("click", () => {
    if (spinning) return;
    try {
      const items = lines($("roulette-items").value, 20);
      showError("roulette-error", "");
      const choice = randomInt(items.length);
      renderWheel(items);
      // SVG の最初の区画は上から始まる。区画の中央を上の印へ合わせる。
      const center = 360 * (choice + 0.5) / items.length;
      const target = (360 - center) % 360;
      const current = ((wheelRotation % 360) + 360) % 360;
      wheelRotation += 1080 + ((target - current + 360) % 360);
      spinning = true;
      rouletteButton.disabled = true;
      $("roulette-result").textContent = "回転中…";
      const wheel = $("wheel");
      const showResult = () => {
        $("roulette-result").textContent = items[choice];
        rouletteButton.disabled = false;
        spinning = false;
      };
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        wheel.style.transform = "rotate(" + wheelRotation + "deg)";
        showResult();
      } else {
        // DOM更新後に一度描画してから角度を変え、初回もtransitionを発火させる。
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          wheel.style.transform = "rotate(" + wheelRotation + "deg)";
          window.setTimeout(showResult, 2800);
        }));
      }
      window.trackToolEvent("roulette", "generate");
    } catch (error) { showError("roulette-error", error.message); }
  });

  let ladderState = null;
  const xAt = (column) => 75 + column * 100;
  const yAt = (row) => 100 + row * 29;

  function ladderPath(start, rungs) {
    let column = start;
    const points = [[xAt(column), 100]];
    rungs.forEach((row, index) => {
      const y = yAt(index + 1);
      points.push([xAt(column), y]);
      if (row.includes(column)) column += 1;
      else if (row.includes(column - 1)) column -= 1;
      points.push([xAt(column), y]);
    });
    points.push([xAt(column), yAt(rungs.length + 2)]);
    return { column, points };
  }

  function buildRungs(count) {
    // 先に一様な順列を作ることで、各参加者の行き先を等確率にする。
    const target = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [target[i], target[j]] = [target[j], target[i]];
    }
    const order = Array.from({ length: count }, (_, i) => i);
    const rungs = [];
    for (let pos = 0; pos < count; pos++) {
      let current = order.indexOf(target[pos]);
      while (current > pos) {
        rungs.push([current - 1]);
        [order[current - 1], order[current]] = [order[current], order[current - 1]];
        current--;
      }
    }
    // 2回続く横線は行き先を変えず、道筋だけ増やす。
    for (let i = 0; i < Math.floor(count / 2); i++) {
      const col = randomInt(count - 1);
      rungs.push([col], [col]);
    }
    return rungs;
  }

  function drawLadder(selected = -1) {
    const { names, prizes, rungs } = ladderState;
    const svg = $("ladder");
    svg.replaceChildren();
    const width = Math.max(320, 150 + (names.length - 1) * 100);
    const height = yAt(rungs.length + 2) + 58;
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    names.forEach((name, i) => {
      const line = element("line", { x1: xAt(i), y1: 100, x2: xAt(i), y2: yAt(rungs.length + 2), class: "ladder-line" });
      svg.append(line);
      for (const [label, y] of [[name, 55], [prizes[i], height - 20]]) {
        const t = element("text", { x: xAt(i), y, "text-anchor": "middle", class: "ladder-label" });
        t.textContent = Array.from(label).slice(0, 8).join("") + (Array.from(label).length > 8 ? "…" : "");
        svg.append(t);
      }
    });
    rungs.forEach((row, rowIndex) => row.forEach((col) => {
      svg.append(element("line", { x1: xAt(col), y1: yAt(rowIndex + 1), x2: xAt(col + 1), y2: yAt(rowIndex + 1), class: "ladder-line" }));
    }));
    if (selected >= 0) {
      const { points } = ladderPath(selected, rungs);
      svg.append(element("polyline", { points: points.map((p) => p.join(",")).join(" "), class: "ladder-highlight" }));
    }
  }

  $("amidaku-build")?.addEventListener("click", () => {
    try {
      const names = lines($("amidaku-names").value, 8);
      const prizes = lines($("amidaku-prizes").value, 8);
      if (names.length !== prizes.length) throw new Error("参加者と結果の数を揃えてください。");
      showError("amidaku-error", "");
      const rungs = buildRungs(names.length);
      ladderState = { names, prizes, rungs };
      drawLadder();
      const buttons = $("amidaku-buttons");
      buttons.replaceChildren();
      names.forEach((name, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "choice-button";
        button.textContent = name;
        button.addEventListener("click", () => {
          drawLadder(index);
          const result = ladderPath(index, rungs).column;
          $("amidaku-result").textContent = name + " → " + prizes[result];
          window.trackToolEvent("amidaku", "reveal");
        });
        buttons.append(button);
      });
      $("amidaku-result").textContent = "名前を選んでみよう";
      window.trackToolEvent("amidaku", "generate");
    } catch (error) { showError("amidaku-error", error.message); }
  });

  $("dice-roll")?.addEventListener("click", () => {
    const count = Number($("dice-count").value);
    if (!Number.isInteger(count) || count < 1 || count > 10) return;
    const rolls = Array.from({ length: count }, () => randomInt(6) + 1);
    const faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
    const container = $("dice-faces");
    container.replaceChildren();
    rolls.forEach((roll) => {
      const span = document.createElement("span");
      span.textContent = faces[roll - 1];
      container.append(span);
    });
    $("dice-result").textContent = "出目 " + rolls.join("・") + " / 合計 " + rolls.reduce((a, b) => a + b, 0);
    window.trackToolEvent("dice", "generate");
  });
})();
