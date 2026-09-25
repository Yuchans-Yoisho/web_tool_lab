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
      remove: (name) => this.classes.delete(name),
      contains: (name) => this.classes.has(name),
      toggle: (name, force) => { if (force ?? !this.classes.has(name)) this.classes.add(name); else this.classes.delete(name); }
    };
  }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  click() { assert.ok(this.handlers.click, "click handler"); this.handlers.click(); }
  replaceChildren() { this.children = []; }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name]; }
  closest(selector) { return selector === ".ladder-slot" && this.className === "ladder-slot" ? this : this.parent?.closest(selector) ?? null; }
  focus() { this.focused = true; }
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

let pointerTarget = null;
const ids = new Map();
const get = (id) => {
  if (!ids.has(id)) ids.set(id, new FakeElement());
  return ids.get(id);
};
for (const id of ["roulette-run", "amidaku-count", "amidaku-build", "dice-roll"]) get(id);
get("amidaku-count").value = "3";
get("roulette-items").value = "映画\n散歩";
get("roulette-motion").checked = true;
get("roulette-effects").checked = true;
const events = [];
const frames = [];
const timers = [];
const randomValues = [0, 50]; // 最初の抽選は候補0、演出は「最後にひとつ進む」
const context = {
  document: { getElementById: get, createElement: () => new FakeElement(), createElementNS: () => new FakeElement(), elementFromPoint: () => pointerTarget },
  crypto: { getRandomValues: (values) => { values[0] = randomValues.shift() ?? 0; return values; } },
  window: {
    trackToolEvent: (tool, action) => events.push([tool, action]),
    matchMedia: () => ({ matches: true }),
    requestAnimationFrame: (callback) => frames.push(callback),
    setTimeout: (callback) => timers.push(callback),
    clearTimeout: (callback) => { const index = timers.indexOf(callback); if (index >= 0) timers.splice(index, 1); }
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

assert.equal(get("ladder").children.filter((x) => x.attributes.class === "ladder-line").length, 3, "three lines appear on load");
assert.equal(get("amidaku-name-slots").children.length, 3);
assert.equal(get("amidaku-prize-slots").children[0].children[0].value, "当たり");
assert.equal(get("amidaku-prize-slots").children[1].children[0].value, "はずれ");
assert.equal(get("ladder-cover").hidden, undefined, "cover starts visible");
get("amidaku-name-slots").children[2].children[0].value = "田中";
get("amidaku-name-slots").children[2].children[0].handlers.input();
get("amidaku-count").value = "5";
get("amidaku-count").handlers.change();
assert.equal(get("amidaku-name-slots").children.length, 5);
assert.equal(get("amidaku-prize-slots").children[4].children[0].value, "はずれ");
get("amidaku-count").value = "3";
get("amidaku-count").handlers.change();
assert.equal(get("amidaku-name-slots").children[2].children[0].value, "田中", "edited name is preserved on shrink");
assert.equal(get("amidaku-prize-slots").children[0].children[0].value, "当たり");
get("amidaku-prize-slots").children[2].children[0].value = "景品";
get("amidaku-prize-slots").children[2].children[0].handlers.input();
get("amidaku-count").value = "2";
get("amidaku-count").handlers.change();
assert.equal(get("amidaku-name-slots").children[1].children[0].value, "田中", "unedited loss is removed first");
assert.equal(get("amidaku-prize-slots").children[1].children[0].value, "景品", "edited result is preserved");
get("amidaku-count").value = "3";
get("amidaku-count").handlers.change();
assert.equal(get("amidaku-prize-slots").children[2].children[0].value, "はずれ", "a new line gets a default loss");
get("amidaku-prize-slots").children[1].children[0].value = "はずれ";
get("amidaku-prize-slots").children[1].children[0].handlers.input();
const firstName = get("amidaku-name-slots").children[0].children[0].value;
const dragHandle = get("amidaku-name-slots").children[0].children[1];
pointerTarget = get("amidaku-name-slots").children[1].children[0];
dragHandle.handlers.pointerdown({ preventDefault() {}, pointerId: 1 });
dragHandle.handlers.pointerup({ clientX: 0, clientY: 0 });
assert.equal(get("amidaku-name-slots").children[1].children[0].value, firstName, "drag swaps participants");
const keyboardHandle = get("amidaku-prize-slots").children[0].children[1];
keyboardHandle.handlers.keydown({ key: "ArrowRight", preventDefault() {} });
assert.equal(get("amidaku-prize-slots").children[1].children[0].value, "当たり", "keyboard can move results");
assert.equal(get("amidaku-prize-slots").children[0].children[0].value, "はずれ");
get("amidaku-build").click();
assert.equal(get("ladder-cover").hidden, false, "rungs stay covered after generation");
assert.equal(get("amidaku-reveal").disabled, false);
get("amidaku-reveal").click();
assert.equal(get("amidaku-buttons").children.length, 0);
advanceAnimation();
assert.equal(get("ladder-cover").hidden, true);
assert.equal(get("amidaku-buttons").children.length, 3);
assert.equal(get("amidaku-retry").hidden, false);
const assignments = new Set();
for (const button of get("amidaku-buttons").children) {
  button.click();
  assignments.add(get("amidaku-result").textContent.split(" → ")[1]);
}
assert.equal(assignments.size, 2, "the default results contain one win and two losses");
assert.ok(get("ladder").children.some((x) => x.attributes.class === "ladder-highlight"));
const currentName = get("amidaku-name-slots").children[0].children[0].value;
const currentPrize = get("amidaku-prize-slots").children[0].children[0].value;
get("amidaku-retry").click();
assert.equal(get("amidaku-retry").hidden, true);
assert.equal(get("ladder-cover").hidden, false);
assert.equal(get("amidaku-buttons").children.length, 0);
assert.equal(get("amidaku-build").disabled, false);
assert.equal(get("amidaku-name-slots").children[0].children[0].value, currentName);
assert.equal(get("amidaku-prize-slots").children[0].children[0].value, currentPrize);
get("amidaku-build").click();
assert.equal(get("amidaku-reveal").disabled, false, "retry allows a new ladder with the same entries");
get("amidaku-count").value = "8";
get("amidaku-count").handlers.change();
assert.equal(get("ladder").children.filter((x) => x.attributes.class === "ladder-line").length, 8);
assert.equal(get("amidaku-prize-slots").children.filter((slot) => slot.children[0].value === "当たり").length, 1);
get("amidaku-build").click();
get("amidaku-reveal").click();
advanceAnimation();
assert.equal(get("amidaku-buttons").children.length, 8);
get("amidaku-name-slots").children[0].children[0].value = "";
get("amidaku-name-slots").children[0].children[0].handlers.input();
assert.equal(get("amidaku-build").disabled, true, "empty inline input blocks generation");
assert.equal(get("ladder-cover").hidden, false, "editing after reveal restores cover");

get("dice-count").value = "3";
get("dice-sides").value = "8";
get("dice-sides").handlers.change();
assert.equal(get("dice-faces").children.length, 3, "dice preview follows the selected count");
assert.equal(get("dice-faces").children[0].className, "die die-d8");
assert.equal(get("dice-faces").children[0].children[0].textContent, "?");
for (const sides of [4, 6, 8, 10, 12, 20, 30, 60, 100]) {
  const count = sides === 20 ? 10 : 2;
  get("dice-count").value = String(count);
  get("dice-sides").value = String(sides);
  randomValues.length = 0;
  randomValues.push(...Array(count).fill(sides - 1));
  get("dice-roll").click();
  assert.equal(get("dice-roll").disabled, true);
  assert.equal(get("dice-count").disabled, true);
  assert.equal(get("dice-sides").disabled, true);
  assert.equal(get("dice-result").textContent, "転がり中…");
  assert.equal(get("dice-faces").children.length, count);
  assert.equal(get("dice-faces").children[0].className, "die die-d" + sides);
  const eventCount = events.length;
  get("dice-roll").click();
  assert.equal(events.length, eventCount, "another roll is ignored during animation");
  while (timers.length) timers.shift()();
  assert.equal(get("dice-roll").disabled, false);
  assert.equal(get("dice-count").disabled, false);
  assert.equal(get("dice-sides").disabled, false);
  assert.equal(get("dice-result").textContent, sides + "面ダイス / 出目 " + Array(count).fill(sides).join("・") + " / 合計 " + count * sides);
  assert.ok(get("dice-faces").children.every((die) => die.children[0].textContent === String(sides)));
}
for (const count of [20, 50, 100, 200, 500, 1000]) {
  get("dice-count").value = String(count);
  get("dice-sides").value = "6";
  get("dice-count").handlers.change();
  assert.equal(get("dice-faces").children.length, count);
  assert.equal(get("dice").classList.contains("many-dice"), true);
  assert.equal(get("dice").classList.contains("crowd-dice"), count > 100);
  assert.equal(get("dice").classList.contains("wall-dice"), count > 500);
  randomValues.length = 0;
  randomValues.push(...Array(count).fill(5));
  get("dice-roll").click();
  while (timers.length) timers.shift()();
  assert.equal(get("dice-result").textContent, "6面ダイス × " + count + "個 / 合計 " + count * 6);
  assert.equal(get("dice-roll-details").hidden, false);
  assert.equal(get("dice-roll-list").textContent.split("・").length, count);
  assert.ok(get("dice-faces").children.every((die) => die.children[0].textContent === "6"));
}
get("dice-count").value = "1001";
get("dice-count").handlers.change();
assert.equal(get("dice-roll").disabled, true, "count above the practical limit is rejected");
get("dice-count").value = "3";
get("dice-sides").value = "shigoro";
get("dice-sides").handlers.change();
assert.equal(get("dice").classList.contains("many-dice"), false);
assert.equal(get("dice-roll-details").hidden, true);
assert.equal(get("dice-faces").children[0].className, "die die-shigoro");
randomValues.length = 0;
randomValues.push(0, 2, 4);
get("dice-roll").click();
while (timers.length) timers.shift()();
assert.equal(get("dice-result").textContent, "456賽 / 出目 4・5・6 / 合計 15");
get("dice-sides").value = "pinzoro";
get("dice-sides").handlers.change();
randomValues.length = 0;
randomValues.push(5, 4, 3);
get("dice-roll").click();
while (timers.length) timers.shift()();
assert.equal(get("dice-result").textContent, "ピンゾロ賽 / 出目 1・1・1 / 合計 3");
get("dice-sides").value = "custom";
get("dice-sides").handlers.change();
assert.equal(get("dice-custom-wrap").hidden, false);
assert.equal(get("dice-roll").disabled, true, "custom dice require a valid number of sides");
get("dice-custom-sides").value = "３７";
get("dice-custom-sides").handlers.input();
assert.equal(get("dice-roll").disabled, false);
assert.equal(get("dice-faces").children[0].className, "die die-custom");
get("dice-count").value = "2";
randomValues.length = 0;
randomValues.push(0, 36);
get("dice-roll").click();
while (timers.length) timers.shift()();
assert.equal(get("dice-result").textContent, "37面ダイス / 出目 1・37 / 合計 38");
get("dice-custom-sides").value = "10000";
get("dice-custom-sides").handlers.input();
randomValues.length = 0;
randomValues.push(9999, 9999);
get("dice-roll").click();
while (timers.length) timers.shift()();
assert.equal(get("dice-result").textContent, "10000面ダイス / 出目 10000・10000 / 合計 20000");
get("dice-custom-sides").value = "10001";
get("dice-custom-sides").handlers.input();
assert.equal(get("dice-roll").disabled, true);
assert.match(get("dice-error").textContent, /2〜10,000/);
get("dice-sides").value = "7";
get("dice-roll").click();
assert.equal(get("dice-roll").disabled, true, "unsupported dice sides are rejected");
assert.equal(events[0].join(":"), "roulette:generate");
assert.equal(events.at(-1).join(":"), "dice:generate");
assert.equal(events.filter((x) => x.join(":") === "amidaku:generate").length, 3);

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
