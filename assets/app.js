(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const svgNS = "http://www.w3.org/2000/svg";
  const colors = ["#f7a46b", "#a8d9ce", "#a9bff1", "#f3cce0", "#ead28a", "#bdc9a7", "#b9a6e3", "#eaa9a0"];
  let wheelSegments = [];

  function randomInt(max) {
    if (!Number.isSafeInteger(max) || max < 1 || max > 0xffffffff) throw new RangeError("Invalid random range");
    const limit = Math.floor(0x100000000 / max) * max;
    const values = new Uint32Array(1);
    do { crypto.getRandomValues(values); } while (values[0] >= limit);
    return values[0] % max;
  }

  function randomRouletteEffect() {
    const roll = randomInt(100);
    if (roll < 50) return -1; // 通常回転 50%
    if (roll < 62) return 0;  // ひとつ進む 12%
    if (roll < 74) return 1;  // 逆回転 12%
    if (roll < 86) return 2;  // マスの入れ替わり 12%
    if (roll < 88) return 3;  // 派手な結果表示 2%
    return 4;                 // 揺れ戻し 12%
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
    wheelSegments = [];
    const radius = 148;
    items.forEach((item, index) => {
      const group = element("g", { class: "wheel-sector" });
      const start = -Math.PI / 2 + 2 * Math.PI * index / items.length;
      const end = -Math.PI / 2 + 2 * Math.PI * (index + 1) / items.length;
      const x1 = 160 + radius * Math.cos(start), y1 = 160 + radius * Math.sin(start);
      const x2 = 160 + radius * Math.cos(end), y2 = 160 + radius * Math.sin(end);
      const path = element("path", {
        d: "M 160 160 L " + x1 + " " + y1 + " A " + radius + " " + radius + " 0 " + (items.length === 2 ? 0 : (end - start > Math.PI ? 1 : 0)) + " 1 " + x2 + " " + y2 + " Z",
        fill: colors[index % colors.length], stroke: "#fffaf2", "stroke-width": 2
      });
      group.append(path);
      const mid = (start + end) / 2;
      const text = element("text", {
        x: 160 + 88 * Math.cos(mid), y: 160 + 88 * Math.sin(mid),
        "text-anchor": "middle", "dominant-baseline": "middle", "font-size": items.length > 12 ? 11 : 13,
        fill: "#27313a"
      });
      text.textContent = shortLabel(item, 8);
      group.append(text);
      wheel.append(group);
      wheelSegments.push({ group, path, text, color: colors[index % colors.length] });
    });
    wheel.append(element("circle", { cx: 160, cy: 160, r: 15, fill: "#263a4a" }));
  }

  function shortLabel(value, length) {
    const chars = Array.from(value);
    return chars.slice(0, length).join("") + (chars.length > length ? "…" : "");
  }

  let wheelRotation = 0;
  let spinning = false;
  const rouletteButton = $("roulette-run");
  if (rouletteButton) {
    renderWheel(lines($("roulette-items").value, 20));
    const motion = $("roulette-motion");
    const effects = $("roulette-effects");
    motion.addEventListener("change", () => { effects.disabled = !motion.checked; });
  }
  rouletteButton?.addEventListener("click", () => {
    if (spinning) return;
    try {
      const items = lines($("roulette-items").value, 20);
      showError("roulette-error", "");
      const choice = randomInt(items.length);
      const motion = $("roulette-motion").checked;
      const effect = motion && $("roulette-effects").checked ? randomRouletteEffect() : -1;
      const wheel = $("wheel");
      const burst = $("roulette-burst");
      wheel.style.visibility = "";
      burst.hidden = true;
      burst.classList.remove("active");
      $("burst-left").replaceChildren();
      $("burst-right").replaceChildren();
      renderWheel(items);
      spinning = true;
      rouletteButton.disabled = true;
      $("roulette-result").textContent = "回転中…";
      const sector = 360 / items.length;
      const nextPaint = (callback) => window.requestAnimationFrame(() => window.requestAnimationFrame(callback));
      const moveTo = (angle, duration, easing, done) => {
        wheel.style.transition = "transform " + duration + "ms " + easing;
        nextPaint(() => {
          wheel.style.transform = "rotate(" + angle + "deg)";
          window.setTimeout(done, duration);
        });
      };
      const spinTo = (index, duration, easing, done) => {
        const target = (360 - sector * (index + .5)) % 360;
        const current = ((wheelRotation % 360) + 360) % 360;
        wheelRotation += 1440 + ((target - current + 360) % 360);
        moveTo(wheelRotation, duration, easing, done);
      };
      const moveBy = (degrees, duration, easing, done) => {
        wheelRotation += degrees;
        moveTo(wheelRotation, duration, easing, done);
      };
      const finish = () => {
        $("roulette-result").textContent = items[choice];
        rouletteButton.disabled = false;
        spinning = false;
      };
      if (!motion) {
        const target = (360 - sector * (choice + .5)) % 360;
        const current = ((wheelRotation % 360) + 360) % 360;
        wheelRotation += (target - current + 360) % 360;
        wheel.style.transition = "none";
        wheel.style.transform = "rotate(" + wheelRotation + "deg)";
        finish();
      } else if (effect === 0) {
        spinTo((choice + 1) % items.length, 2500, "cubic-bezier(.12,.72,.18,1)", () => {
          $("roulette-result").textContent = "止まった…？";
          window.setTimeout(() => {
            $("roulette-result").textContent = "もうひとつ！";
            moveBy(sector, 750, "cubic-bezier(.2,.75,.3,1)", finish);
          }, 360);
        });
      } else if (effect === 1) {
        spinTo((choice - 1 + items.length) % items.length, 2600, "cubic-bezier(.12,.72,.18,1)", () => {
          $("roulette-result").textContent = "止まった…？";
          window.setTimeout(() => {
            $("roulette-result").textContent = "逆回転！";
            moveBy(-360 - sector, 800, "cubic-bezier(.25,.7,.4,1)", finish);
          }, 350);
        });
      } else if (effect === 2) {
        const decoy = (choice + 1 + randomInt(items.length - 1)) % items.length;
        spinTo(decoy, 3000, "cubic-bezier(.12,.72,.18,1)", () => {
          $("roulette-result").textContent = "入れ替わる…";
          const a = wheelSegments[decoy], b = wheelSegments[choice];
          a.group.style.opacity = b.group.style.opacity = "0.15";
          window.setTimeout(() => {
            [a.text.textContent, b.text.textContent] = [b.text.textContent, a.text.textContent];
            [a.color, b.color] = [b.color, a.color];
            a.path.setAttribute("fill", a.color);
            b.path.setAttribute("fill", b.color);
            a.group.style.opacity = b.group.style.opacity = "1";
            window.setTimeout(finish, 600);
          }, 600);
        });
      } else if (effect === 3) {
        wheelRotation += 2160 + randomInt(items.length) * sector;
        moveTo(wheelRotation, 3000, "cubic-bezier(.65,0,.95,.5)", () => {
          const left = wheel.cloneNode(true), right = wheel.cloneNode(true);
          left.removeAttribute("id");
          right.removeAttribute("id");
          left.style.transform = right.style.transform = wheel.style.transform;
          $("burst-left").append(left);
          $("burst-right").append(right);
          wheel.style.visibility = "hidden";
          $("burst-result").textContent = shortLabel(items[choice], 12);
          burst.hidden = false;
          burst.classList.add("active");
          $("roulette-result").textContent = "大当たり！";
          window.setTimeout(finish, 1800);
        });
      } else if (effect === 4) {
        spinTo(choice, 2600, "cubic-bezier(.12,.72,.18,1)", () => {
          $("roulette-result").textContent = "決まる…？";
          moveBy(sector * .4, 280, "ease-out", () =>
            moveBy(-sector * .65, 270, "ease-in-out", () =>
              moveBy(sector * .25, 210, "ease-out", finish)));
        });
      } else {
        spinTo(choice, 3300, "cubic-bezier(.12,.72,.18,1)", finish);
      }
      window.trackToolEvent("roulette", "generate");
    } catch (error) { showError("roulette-error", error.message); }
  });

  const ladderState = {
    count: 3,
    names: Array.from({ length: 3 }, (_, i) => ({ value: "参加者" + (i + 1), edited: false })),
    prizes: [{ value: "当たり", edited: false }, { value: "はずれ", edited: false }, { value: "はずれ", edited: false }],
    rungs: null,
    revealed: false
  };
  let ladderRevealTimer = null;
  const ladderWidth = 1000;
  const ladderHeight = 420;
  const ladderX = (column) => ladderWidth * (column + .5) / ladderState.count;
  const ladderY = (row, total) => 28 + (row + 1) * (ladderHeight - 56) / (total + 1);

  function ladderPath(start, rungs) {
    let column = start;
    const points = [[ladderX(column), 0]];
    rungs.forEach((row, index) => {
      const y = ladderY(index, rungs.length);
      points.push([ladderX(column), y]);
      if (row.includes(column)) column += 1;
      else if (row.includes(column - 1)) column -= 1;
      points.push([ladderX(column), y]);
    });
    points.push([ladderX(column), ladderHeight]);
    return { column, points };
  }

  function buildRungs(count) {
    // 一様な順列を先に選び、どの参加者も各結果に等確率で着くようにする。
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
    // 往復する横線は割り当てを変えず、見た目の道筋を増やす。
    for (let i = 0; i < Math.floor(count / 2); i++) {
      const col = randomInt(count - 1);
      rungs.push([col], [col]);
    }
    return rungs;
  }

  function drawLadder(selected = -1) {
    const svg = $("ladder");
    svg.replaceChildren();
    svg.setAttribute("viewBox", "0 0 " + ladderWidth + " " + ladderHeight);
    for (let i = 0; i < ladderState.count; i++) {
      svg.append(element("line", {
        x1: ladderX(i), y1: 0, x2: ladderX(i), y2: ladderHeight, class: "ladder-line"
      }));
    }
    ladderState.rungs?.forEach((row, index) => row.forEach((col) => {
      const y = ladderY(index, ladderState.rungs.length);
      svg.append(element("line", {
        x1: ladderX(col), y1: y, x2: ladderX(col + 1), y2: y, class: "ladder-line"
      }));
    }));
    if (selected >= 0 && ladderState.rungs) {
      const { points } = ladderPath(selected, ladderState.rungs);
      svg.append(element("polyline", {
        points: points.map((point) => point.join(",")).join(" "), class: "ladder-highlight"
      }));
    }
  }

  function ladderReady() {
    return [...ladderState.names, ...ladderState.prizes].every((entry) => {
      const length = Array.from(entry.value.trim()).length;
      return length > 0 && length <= 40;
    });
  }

  function updateLadderControls() {
    const ready = ladderReady();
    $("amidaku-build").disabled = !ready || !!ladderState.rungs;
    $("amidaku-reveal").disabled = !ladderState.rungs || ladderState.revealed;
    $("amidaku-retry").hidden = !ladderState.revealed;
    if (!ladderState.rungs) $("amidaku-buttons").replaceChildren();
    if (!ready) showError("amidaku-error", "各ラインの参加者と結果を入力してください（各40文字以内）。");
    else showError("amidaku-error", "");
  }

  function resetLadderBuild() {
    if (ladderRevealTimer) window.clearTimeout(ladderRevealTimer);
    ladderRevealTimer = null;
    ladderState.rungs = null;
    ladderState.revealed = false;
    $("amidaku-board").classList.remove("has-results");
    const cover = $("ladder-cover");
    cover.hidden = false;
    cover.classList.remove("opening");
    $("amidaku-result").textContent = "準備ができたら、あみだを作ろう";
    drawLadder();
    updateLadderControls();
  }

  function swapLadderEntries(kind, first, second) {
    if (second < 0 || second >= ladderState.count || first === second) return;
    const entries = ladderState[kind];
    [entries[first], entries[second]] = [entries[second], entries[first]];
    renderLadderSlots(kind);
    resetLadderBuild();
  }

  function slotAtPointer(event, kind) {
    const slot = document.elementFromPoint(event.clientX, event.clientY)?.closest(".ladder-slot");
    return slot?.getAttribute("data-kind") === kind ? Number(slot.getAttribute("data-index")) : -1;
  }

  function renderLadderSlots(kind) {
    const container = $(kind === "names" ? "amidaku-name-slots" : "amidaku-prize-slots");
    container.replaceChildren();
    container.style.gridTemplateColumns = "repeat(" + ladderState.count + ",minmax(0,1fr))";
    ladderState[kind].forEach((entry, index) => {
      const slot = document.createElement("div");
      slot.className = "ladder-slot";
      slot.setAttribute("data-kind", kind);
      slot.setAttribute("data-index", index);
      const input = document.createElement("input");
      input.type = "text";
      input.value = entry.value;
      input.maxLength = 40;
      input.setAttribute("aria-label", (kind === "names" ? "参加者" : "結果") + " " + (index + 1));
      input.addEventListener("input", () => {
        entry.value = input.value;
        entry.edited = true;
        resetLadderBuild();
      });
      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "ladder-drag";
      handle.textContent = "⠿";
      handle.setAttribute("aria-label", entry.value + "の位置をドラッグで変更。左右矢印キーでも移動できます");
      handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        handle.setPointerCapture?.(event.pointerId);
        slot.classList.add("dragging");
      });
      handle.addEventListener("pointermove", (event) => {
        if (!slot.classList.contains("dragging")) return;
        for (const sibling of container.children) sibling.classList.remove("drop-target");
        const target = slotAtPointer(event, kind);
        if (target >= 0 && target !== index) container.children[target].classList.add("drop-target");
      });
      handle.addEventListener("pointerup", (event) => {
        if (!slot.classList.contains("dragging")) return;
        const target = slotAtPointer(event, kind);
        slot.classList.remove("dragging");
        for (const sibling of container.children) sibling.classList.remove("drop-target");
        swapLadderEntries(kind, index, target);
      });
      handle.addEventListener("pointercancel", () => {
        slot.classList.remove("dragging");
        for (const sibling of container.children) sibling.classList.remove("drop-target");
      });
      handle.addEventListener("keydown", (event) => {
        const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        if (!step) return;
        event.preventDefault();
        const target = index + step;
        swapLadderEntries(kind, index, target);
        container.children[target]?.children[1]?.focus();
      });
      slot.append(input, handle);
      container.append(slot);
    });
  }

  function removalPriority(index) {
    const name = ladderState.names[index];
    const prize = ladderState.prizes[index];
    if (prize.value.trim() === "はずれ" && !prize.edited && !name.edited) return 0;
    if (prize.value.trim() === "はずれ" && !prize.edited) return 1;
    if (prize.value.trim() === "はずれ") return 2;
    if (prize.value.trim() === "当たり") return 5;
    return prize.edited || name.edited ? 4 : 3;
  }

  function resizeLadder(count) {
    while (ladderState.count < count) {
      let number = 1;
      while (ladderState.names.some((entry) => entry.value === "参加者" + number)) number++;
      ladderState.names.push({ value: "参加者" + number, edited: false });
      ladderState.prizes.push({ value: "はずれ", edited: false });
      ladderState.count++;
    }
    while (ladderState.count > count) {
      const indices = Array.from({ length: ladderState.count }, (_, i) => i);
      indices.sort((a, b) => removalPriority(a) - removalPriority(b) || b - a);
      const remove = indices[0];
      ladderState.names.splice(remove, 1);
      ladderState.prizes.splice(remove, 1);
      ladderState.count--;
    }
    renderLadderSlots("names");
    renderLadderSlots("prizes");
    resetLadderBuild();
  }

  const ladderCount = $("amidaku-count");
  if (ladderCount) {
    renderLadderSlots("names");
    renderLadderSlots("prizes");
    drawLadder();
    updateLadderControls();
    ladderCount.addEventListener("change", () => {
      const count = Number(ladderCount.value);
      if (Number.isInteger(count) && count >= 2 && count <= 8) resizeLadder(count);
    });
  }

  $("amidaku-build")?.addEventListener("click", () => {
    if (!ladderReady() || ladderState.rungs) return;
    ladderState.rungs = buildRungs(ladderState.count);
    drawLadder();
    updateLadderControls();
    $("amidaku-result").textContent = "あみだができました。結果を表示できます";
    window.trackToolEvent("amidaku", "generate");
  });

  $("amidaku-reveal")?.addEventListener("click", () => {
    if (!ladderState.rungs || ladderState.revealed) return;
    ladderState.revealed = true;
    $("amidaku-reveal").disabled = true;
    $("ladder-cover").classList.add("opening");
    $("amidaku-result").textContent = "カバーを外しています…";
    ladderRevealTimer = window.setTimeout(() => {
      ladderRevealTimer = null;
      $("ladder-cover").hidden = true;
      $("ladder-cover").classList.remove("opening");
      $("amidaku-board").classList.add("has-results");
      $("amidaku-retry").hidden = false;
      const buttons = $("amidaku-buttons");
      buttons.replaceChildren();
      ladderState.names.forEach((name, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "choice-button";
        button.textContent = name.value;
        button.addEventListener("click", () => {
          drawLadder(index);
          const result = ladderPath(index, ladderState.rungs).column;
          $("amidaku-result").textContent = name.value + " → " + ladderState.prizes[result].value;
          window.trackToolEvent("amidaku", "reveal");
        });
        buttons.append(button);
      });
      $("amidaku-result").textContent = "名前を選ぶと道筋が光ります";
    }, 1800);
  });

  $("amidaku-retry")?.addEventListener("click", () => {
    if (!ladderState.revealed) return;
    resetLadderBuild();
    $("amidaku-build").focus();
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
