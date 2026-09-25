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
const events = [];
const context = {
  document: { getElementById: get, createElement: () => new FakeElement(), createElementNS: () => new FakeElement() },
  crypto: webcrypto,
  window: { trackToolEvent: (tool, action) => events.push([tool, action]) },
  Uint32Array, Number, Array, Math, RangeError, Error
};
vm.runInNewContext(fs.readFileSync("assets/app.js", "utf8"), context);

get("roulette-items").value = "<img src=x onerror=alert(1)>\n安全";
get("roulette-run").click();
assert.ok(["<img src=x onerror=alert(1)>", "安全"].includes(get("roulette-result").textContent));
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

get("dice-count").value = "10";
get("dice-roll").click();
assert.equal(get("dice-faces").children.length, 10);
assert.match(get("dice-result").textContent, /^出目 [1-6](・[1-6]){9} \/ 合計 \d+$/);
assert.deepEqual(events.map((x) => x.join(":")), [
  "roulette:generate", "amidaku:generate", "amidaku:reveal", "dice:generate"
]);
console.log("smoke checks passed");
