// node --import ./tools/tests/resolve-hook.mjs --test tools/tests/pricing.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { DISPLAY_ONLY, formatAmount, OPTION_GRADES, PRICE_LISTS, priceOf, quoteFor } from "../../src/pages/tuning/pricing.js";
import { factoryFor, GROUPS, visibleOptions } from "../../src/pages/tuning/options.js";
import { hasGroup, VEHICLES, vehicleById } from "../../src/pages/tuning/vehicles.js";

const golf = vehicleById("golf");
const supra = vehicleById("supra");

test("every car has its own list, only for groups it supports, with a price for every grade it shows", () => {
  for (const vehicle of VEHICLES) {
    const list = PRICE_LISTS[vehicle.id];
    assert.ok(list, `${vehicle.id} has a price list`);

    for (const group of Object.keys(list.groups)) {
      assert.ok(hasGroup(vehicle, group), `${vehicle.id} lists ${group}, which it does not have`);
      assert.ok(!DISPLAY_ONLY.has(group), `${group} is display-only`);
    }

    for (const group of Object.keys(GROUPS)) {
      if (!hasGroup(vehicle, group) || DISPLAY_ONLY.has(group)) continue;
      assert.ok(list.groups[group], `${vehicle.id} prices ${group}`);

      for (const option of visibleOptions(group, vehicle)) {
        const price = priceOf(vehicle, group, option.id);
        assert.ok(Number.isInteger(price) && price >= 0, `${vehicle.id} ${group} ${option.id} has a whole price (${price})`);
        if (option.id !== factoryFor(vehicle)[group]) assert.ok(OPTION_GRADES[group][option.id], `${group} ${option.id} has a grade`);
      }
    }
  }
});

test("lists are not the Golf's copied to other cars", () => {
  for (const vehicle of VEHICLES.filter((item) => item.id !== "golf")) {
    assert.notDeepEqual(PRICE_LISTS[vehicle.id].groups.paint, PRICE_LISTS.golf.groups.paint, vehicle.id);
  }
});

test("factory is included, display-only groups are never priced", () => {
  for (const vehicle of VEHICLES) {
    const factory = factoryFor(vehicle);
    for (const group of Object.keys(PRICE_LISTS[vehicle.id].groups)) assert.equal(priceOf(vehicle, group, factory[group]), 0);
    for (const group of DISPLAY_ONLY) assert.equal(priceOf(vehicle, group, "high"), null);
  }
  assert.equal(quoteFor({ ...factoryFor(golf), frontLights: "high", stage: "stage-2" }, golf).total, 0);
});

test("replacing an option replaces its price, reverting removes it, a free option adds nothing", () => {
  const factory = factoryFor(golf);
  const one = quoteFor({ ...factory, rims: "gloss-black" }, golf);
  const swapped = quoteFor({ ...factory, rims: "bronze" }, golf);
  assert.equal(one.total, PRICE_LISTS.golf.groups.rims.powder);
  assert.equal(swapped.total, PRICE_LISTS.golf.groups.rims.special);
  assert.equal(swapped.paid.length, 1);

  const several = quoteFor({ ...factory, rims: "bronze", paint: "pearl-white", seats: "cognac" }, golf);
  assert.equal(several.total, 95000 + 160000 + 240000);
  assert.equal(quoteFor({ ...factory, paint: "pearl-white", seats: "cognac" }, golf).total, 160000 + 240000);

  const free = quoteFor({ ...factory, rims: "bronze", paint: "pure-white" }, golf);
  assert.equal(free.total, 95000);
  assert.deepEqual(free.included, [{ group: "paint", option: "pure-white" }]);
  assert.equal(quoteFor(factory, golf).total, 0);
});

test("each car keeps its own quote, lines follow its sections, integers only", () => {
  const golfSetup = { ...factoryFor(golf), paint: "graphite", tint: "vlt-20" };
  const supraSetup = { ...factoryFor(supra), paint: "graphite", tint: "vlt-20", rims: "bronze" };
  const a = quoteFor(golfSetup, golf);
  const b = quoteFor(supraSetup, supra);
  assert.equal(a.total, 85000 + 18000);
  assert.equal(b.total, 120000 + 20000, "the Supra has no rim option, so its bronze is ignored");
  assert.deepEqual(b.paid.map((line) => line.group), ["paint", "tint"]);
  assert.equal(quoteFor(golfSetup, golf).total, a.total);
  for (const q of [a, b]) assert.ok(Number.isInteger(q.total) && q.paid.every((line) => Number.isInteger(line.price)));
});

test("a base price is added once", () => {
  const saved = PRICE_LISTS.golf.base;
  PRICE_LISTS.golf.base = 9500000;
  try {
    const quote = quoteFor({ ...factoryFor(golf), paint: "graphite" }, golf);
    assert.equal(quote.base, 9500000);
    assert.equal(quote.options, 85000);
    assert.equal(quote.total, 9585000);
  } finally {
    PRICE_LISTS.golf.base = saved;
  }
});

test("amounts are written like the site's prices", () => {
  assert.equal(formatAmount(130000), "130 000");
  assert.equal(formatAmount(95000, { sign: true }), "⁦+95 000⁩");
  assert.equal(formatAmount(-45000, { sign: true }), "⁦−45 000⁩");
});
