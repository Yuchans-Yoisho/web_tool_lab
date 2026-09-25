const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

class FakeElement {
  constructor() {
    this.value = "";
    this.textContent = "";
    this.style = {};
    this.children = [];
    this.attributes = {};
    this.handlers = {};
  }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  click() { assert.ok(this.handlers.click, "click handler"); this.handlers.click(); }
  replaceChildren() { this.children = []; }
  append(child) { this.children.push(child); }
  setAttribute(name, value) { this.attributes[name] = value; }
}

const ids = new Map();
const get = (id) => {
  if (!ids.has(id)) ids.set(id, new FakeElement());
  return ids.get(id);
};
for (const id of ["roulette-run", "amidaku-build", "dice-roll"]) get(id);
get("roulette-items").value = "映画\n散歩";
const events = [];
const frames = [];
const timers = [];
const context = {
  document: { getElementById: get, createElement: () => new FakeElement(), createElementNS: () => new FakeElement() },
  crypto: webcrypto,
  window: {
    trackToolEvent: (tool, action) => events.push([tool, action]),
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (callback) => frames.push(callback),
    setTimeout: (callback) => timers.push(callback)
  },
  Uint32Array, Number, Array, Math, RangeError, Error
};
vm.runInNewContext(fs.readFileSync("assets/app.js", "utf8"), context);
assert.ok(get("wheel").children.length > 0, "wheel is visible before first click");
assert.equal(get("roulette-motion-note").hidden, true);

get("roulette-items").value = "<img src=x onerror=alert(1)>\n安全";
get("roulette-run").click();
assert.equal(get("roulette-result").textContent, "回転中…");
assert.equal(get("roulette-run").disabled, true);
while (frames.length) frames.shift()();
assert.match(get("wheel").style.transform, /^rotate\(\d+deg\)$/);
assert.equal(timers.length, 1);
timers.shift()();
assert.ok(["<img src=x onerror=alert(1)>", "安全"].includes(get("roulette-result").textContent));
assert.equal(get("roulette-run").disabled, false);
assert.equal(get("roulette-error").textContent, "");
assert.ok(get("wheel").children.length > 0);
get("roulette-items").value = "ひとつだけ";
get("roulette-run").click();
assert.match(get("roulette-error").textContent, /2〜20件/);

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
