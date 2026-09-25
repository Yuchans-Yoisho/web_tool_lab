const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

class FakeElement {
  constructor() {
    this.value = "";
    this.textContent = "";
    this.style = {};
    this.children = [];
    this.attributes = {};
    this.handlers = {};
    this.classes = new Set();
    this.classList = {
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name)
    };
  }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  click() { assert.ok(this.handlers.click, "click handler"); this.handlers.click(); }
  replaceChildren() { this.children = []; }
  append(child) { this.children.push(child); }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  cloneNode(deep) {
    const copy = new FakeElement();
    copy.textContent = this.textContent;
    copy.style = { ...this.style };
    copy.attributes = { ...this.attributes };
    if (deep) copy.children = this.children.map((child) => child.cloneNode(true));
    return copy;
  }
}

const ids = new Map();
const get = (id) => {
  if (!ids.has(id)) ids.set(id, new FakeElement());
  return ids.get(id);
};
for (const id of ["roulette-run", "amidaku-build", "dice-roll"]) get(id);
get("roulette-items").value = "映画\n散歩";
get("roulette-motion").checked = true;
get("roulette-effects").checked = true;
const events = [];
const frames = [];
const timers = [];
const randomValues = [0, 50]; // 最初の抽選は候補0、演出は「最後にひとつ進む」
const context = {
  document: { getElementById: get, createElement: () => new FakeElement(), createElementNS: () => new FakeElement() },
  crypto: { getRandomValues: (values) => { values[0] = randomValues.shift() ?? 0; return values; } },
  window: {
    trackToolEvent: (tool, action) => events.push([tool, action]),
    matchMedia: () => ({ matches: true }),
    requestAnimationFrame: (callback) => frames.push(callback),
    setTimeout: (callback) => timers.push(callback)
  },
  Uint32Array, Number, Array, Math, RangeError, Error
};
vm.runInNewContext(fs.readFileSync("assets/app.js", "utf8"), context);
assert.ok(get("wheel").children.length > 0, "wheel is visible before first click");

function advanceAnimation() {
  while (frames.length) frames.shift()();
  assert.ok(timers.length, "animation has a pending step");
  timers.shift()();
}

get("roulette-items").value = "<img src=x onerror=alert(1)>\n安全";
get("roulette-run").click();
assert.equal(get("roulette-result").textContent, "回転中…");
assert.equal(get("roulette-run").disabled, true);
advanceAnimation();
assert.equal(get("roulette-result").textContent, "止まった…？");
advanceAnimation();
assert.equal(get("roulette-result").textContent, "もうひとつ！");
advanceAnimation();
assert.match(get("wheel").style.transform, /^rotate\(\d+deg\)$/);
assert.ok(["<img src=x onerror=alert(1)>", "安全"].includes(get("roulette-result").textContent));
assert.equal(get("roulette-run").disabled, false);
assert.equal(get("roulette-error").textContent, "");
assert.ok(get("wheel").children.length > 0);
get("roulette-items").value = "A\nB\nC";
for (let effect = 1; effect < 5; effect++) {
  randomValues.length = 0;
  randomValues.push(0, [62, 74, 86, 88][effect - 1], 0);
  get("roulette-run").click();
  for (let steps = 0; get("roulette-run").disabled && steps < 15; steps++) advanceAnimation();
  assert.equal(get("roulette-run").disabled, false, "effect " + effect + " finishes");
  assert.equal(get("roulette-result").textContent, "A", "effect " + effect + " keeps the selected result");
  if (effect === 2) assert.equal(get("wheel").children[1].children[1].textContent, "A");
  if (effect === 3) {
    assert.equal(get("roulette-burst").hidden, false);
    assert.equal(get("burst-left").children.length, 1);
    assert.notEqual(get("burst-left").children[0].style.visibility, "hidden");
  }
  if (effect === 1 || effect === 4) {
    const angle = Number(get("wheel").style.transform.match(/rotate\(([-\d.]+)deg\)/)[1]);
    assert.ok(Math.abs(((angle % 360) + 360) % 360 - 300) < 0.001);
  }
}
randomValues.length = 0;
randomValues.push(0, 49);
get("roulette-run").click();
advanceAnimation();
assert.equal(get("roulette-result").textContent, "A", "49以下は演出なしで完了する");
assert.equal(get("roulette-burst").hidden, true);
get("roulette-effects").checked = false;
get("roulette-run").click();
while (get("roulette-run").disabled) advanceAnimation();
assert.equal(get("roulette-result").textContent, "A");
get("roulette-items").value = "ひとつだけ";
get("roulette-run").click();
assert.match(get("roulette-error").textContent, /2〜20件/);
get("roulette-items").value = "A\nB";
get("roulette-motion").checked = false;
get("roulette-effects").checked = true;
get("roulette-run").click();
assert.equal(get("wheel").style.transition, "none");
assert.ok(["A", "B"].includes(get("roulette-result").textContent));

get("amidaku-names").value = "A\nB\nC";
get("amidaku-prizes").value = "甲\n乙\n丙";
get("amidaku-build").click();
assert.equal(get("amidaku-buttons").children.length, 3);
get("amidaku-buttons").children[0].click();
assert.match(get("amidaku-result").textContent, /^A → (甲|乙|丙)$/);
assert.ok(get("ladder").children.some((x) => x.attributes.class === "ladder-highlight"));
const assignments = new Set();
for (const button of get("amidaku-buttons").children) {
  button.click();
  assignments.add(get("amidaku-result").textContent.split(" → ")[1]);
}
assert.equal(assignments.size, 3, "each result is assigned once");
get("amidaku-prizes").value = "甲\n乙";
get("amidaku-build").click();
assert.match(get("amidaku-error").textContent, /数を揃えて/);
get("amidaku-names").value = Array.from({ length: 8 }, (_, i) => "N" + i).join("\n");
get("amidaku-prizes").value = Array.from({ length: 8 }, (_, i) => "P" + i).join("\n");
get("amidaku-build").click();
assert.equal(get("amidaku-error").textContent, "");
const eightResults = new Set();
for (const button of get("amidaku-buttons").children) {
  button.click();
  eightResults.add(get("amidaku-result").textContent.split(" → ")[1]);
}
assert.equal(eightResults.size, 8, "all eight results are assigned once");

get("dice-count").value = "10";
get("dice-roll").click();
assert.equal(get("dice-faces").children.length, 10);
assert.match(get("dice-result").textContent, /^出目 [1-6](・[1-6]){9} \/ 合計 \d+$/);
assert.equal(events[0].join(":"), "roulette:generate");
assert.equal(events.at(-1).join(":"), "dice:generate");
assert.equal(events.filter((x) => x.join(":") === "amidaku:generate").length, 2);

const analyticsSource = fs.readFileSync("assets/analytics.js", "utf8");
const appended = [];
const analyticsWindow = { TOOL_LAB_GA_ID: "" };
const analyticsContext = {
  window: analyticsWindow,
  document: {
    createElement: () => new FakeElement(),
    head: { append: (node) => appended.push(node) }
  },
  Date, encodeURIComponent
};
vm.runInNewContext(analyticsSource, analyticsContext);
assert.equal(appended.length, 0, "no Google script while GA ID is unset");
analyticsWindow.TOOL_LAB_GA_ID = "G-ABCDEF1234";
vm.runInNewContext(analyticsSource, analyticsContext);
assert.equal(appended.length, 1);
analyticsWindow.trackToolEvent("roulette", "generate");
analyticsWindow.trackToolEvent("roulette", "unexpected");
assert.equal(analyticsWindow.dataLayer.length, 3);
assert.equal(analyticsWindow.dataLayer[2][0], "event");
assert.equal(analyticsWindow.dataLayer[2][2].tool_name, "roulette");
console.log("smoke checks passed");
