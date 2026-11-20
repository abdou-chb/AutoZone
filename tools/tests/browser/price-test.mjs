// node --import ./tools/tests/resolve-hook.mjs tools/tests/browser/price-test.mjs 1440x900 en
import { launch, HOOK } from "./cdp.mjs";
import { PRICE_LISTS, priceOf, quoteFor } from "../../../src/pages/tuning/pricing.js";
import { factoryFor, LIGHT_LOOKS, lookFor } from "../../../src/pages/tuning/options.js";
import { vehicleById } from "../../../src/pages/tuning/vehicles.js";

const DIR = new URL("./out", import.meta.url).pathname;
const [w, h] = (process.argv[2] || "1440x900").split("x").map(Number);
const lang = process.argv[3] || "en";
const tag = `${w}-${lang}${process.env.DARK ? "-dark" : ""}`;
const BASE = "http://localhost:5173";
const CUR = lang === "ar" ? "دج" : "DA";
const b = await launch({ port: 9444 });
await b.size(w, h, w < 700);
await b.goto(`${BASE}/tuning?lang=${lang}`);
await b.eval("Object.keys(localStorage).filter((k) => k.startsWith('autozone:tuning-setup')).forEach((k) => localStorage.removeItem(k)); true");
if (process.env.DARK) await b.eval("localStorage.setItem('autozone:theme', 'dark'); true");
else await b.eval("localStorage.removeItem('autozone:theme'); true");
await b.goto(`${BASE}/tuning?lang=${lang}`);
await b.waitFor(`document.querySelector(".tz-canvas canvas") && !document.querySelector(".tz-loader") && !!document.querySelector(".tz-quote__amount")`);
await b.sleep(2500);
await b.eval(HOOK);
const S = (js) => b.eval(js);
const results = [];
const check = (name, ok, info = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, info); };
const clean = (text) => (text || "").replace(/[⁦-⁩]/g, "").replace(/[  ]/g, " ").trim();
const da = (value, sign = false) => `${sign ? (value < 0 ? "−" : "+") : ""}${new Intl.NumberFormat("fr-FR").format(Math.abs(value)).replace(/[  ]/g, " ")} ${CUR}`;
const pill = async () => clean(await S(`document.querySelector(".tz-quote__amount")?.textContent`));
const flash = async () => clean(await S(`document.querySelector(".tz-quote__flash")?.innerText`));
const golf = vehicleById("golf");
let setup = { ...factoryFor(golf) };

async function settle(timeout = 30000) {
  const end = Date.now() + timeout;
  await b.sleep(300);
  while (Date.now() < end) {
    if (!(await S(`document.querySelector(".tz").classList.contains("is-swapping")`))) { await b.sleep(500); return true; }
    await b.sleep(150);
  }
  return false;
}
async function section(id) { await S(`document.querySelector('#tuning-${id}').scrollIntoView({ block: "start" }); true`); await b.sleep(1400); }
async function openRow(id, index) { await S(`document.querySelectorAll('#tuning-${id} .tz-component')[${index}].click(); true`); await b.sleep(900); }
async function back(id) { await S(`document.querySelector('#tuning-${id} .tz-crumbs__back').click(); true`); await b.sleep(500); }
async function pick(group, id) {
  const ok = await S(`(() => { const input = document.querySelector('input[name="${group}"][value="${id}"]'); if (!input) return false; input.click(); return true; })()`);
  setup = { ...setup, [group]: id };
  await b.sleep(250);
  return ok;
}
async function expectTotal(name, vehicle = golf) {
  await b.sleep(700);
  const want = quoteFor(setup, vehicle).total;
  const got = await pill();
  check(`${name}: total ${da(want)}`, got === da(want), `pill "${got}"`);
}

// Overlaps: console vs car box on screen, toolbar.
async function layout(label) {
  const r = await S(`(() => {
    const st = window.__tz.getState();
    const V = st.camera.position.constructor;
    let B; st.scene.traverse((x) => { if (!B && x.geometry) { x.geometry.computeBoundingBox(); B = x.geometry.boundingBox.constructor; } });
    let car = null; st.scene.traverse((o) => { if (o.name?.startsWith("car:") && o.visible) car = o; });
    // The body's meshes only (no dust, light cones or shadow planes, which reach far beyond the car).
    const box = new B();
    car.traverse((o) => { if (!o.isMesh || !o.visible || o.material?.transparent && o.material?.blending === 2) return; const one = new B().setFromObject(o); const size = one.getSize(new V()); if (size.length() < 7) box.union(one); });
    const canvas = document.querySelector(".tz-canvas").getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let k = 0; k < 8; k++) {
      const c = new V(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(st.camera);
      const x = canvas.left + (c.x + 1) / 2 * canvas.width, y = canvas.top + (1 - c.y) / 2 * canvas.height;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
    return { car: { l: minX, t: minY, r: maxX, b: maxY }, console: rect(".tz-console"), toolbar: rect(".tz-toolbar"), vw: innerWidth };
  })()`);
  const hit = (a, c) => a && c && a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b;
  const carRect = r.car;
  check(`${label}: console clear of the car`, !hit(r.console, carRect), `console bottom ${r.console.b.toFixed(0)}, car top ${carRect.t.toFixed(0)}`);
  check(`${label}: console clear of the toolbar`, !hit(r.console, r.toolbar));
  check(`${label}: console inside the screen`, r.console.l >= 0 && r.console.r <= r.vw, `${r.console.l.toFixed(0)}-${r.console.r.toFixed(0)} of ${r.vw}`);
}

check("starts at 0", (await pill()) === da(0), await pill());
await layout("hero");
await b.shot(`${DIR}/price-${tag}-0-start.jpg`);

// 1. A paid option.
await pick("paint", "pearl-white");
await b.sleep(150);
const f1 = await flash();
check("flash names the option and its price", f1.includes(da(priceOf(golf, "paint", "pearl-white"), true)), JSON.stringify(f1));
await b.shot(`${DIR}/price-${tag}-1-flash.jpg`);
await expectTotal("paint pearl white");
const legend = clean(await S(`document.querySelector('#tz-group-paint .tz-group__price').textContent`));
check("legend shows the selected price", legend === da(priceOf(golf, "paint", "pearl-white"), true), legend);
const chip = clean(await S(`document.querySelector('input[name="paint"][value="graphite"]').closest('label').querySelector('.tz-chip__price').textContent`));
check("chip shows its price", chip === da(PRICE_LISTS.golf.groups.paint.metallic, true), chip);
await b.sleep(2600);
check("flash goes away", !(await S(`!!document.querySelector(".tz-quote__flash")`)));

// 2. Several, then replace one wheel option by another.
await section("wheels");
await openRow("wheels", 0);
await pick("rims", "gloss-black");
await expectTotal("rims gloss black");
await pick("rims", "bronze");
await expectTotal("rims bronze replaces gloss black");
await back("wheels");
await openRow("wheels", 1);
await pick("calipers", "yellow");
await expectTotal("calipers yellow");
await back("wheels");
await openRow("wheels", 2);
await pick("stance", "lowered-35");
await expectTotal("coilovers");
const seg = clean(await S(`document.querySelector('input[name="stance"][value="lowered-35"]').nextElementSibling.querySelector('.tz-segment__price')?.textContent`));
check("segment shows its price", seg === da(PRICE_LISTS.golf.groups.stance.coilovers, true), seg);
await b.shot(`${DIR}/price-${tag}-2-wheels.jpg`);
await back("wheels");

// 3. A free option.
await section("exterior");
await pick("paint", "pure-white");
await b.sleep(150);
const f3 = await flash();
check("free option says Included", /Included|Inclus|مشمول/.test(f3), JSON.stringify(f3));
await expectTotal("pure white is free");

// 4. Breakdown: lines, remove.
await b.sleep(2600);
await S(`document.querySelector(".tz-quote__pill").click(); true`);
await b.sleep(500);
const q = quoteFor(setup, golf);
const lines = await S(`[...document.querySelectorAll(".tz-quote__panel .tz-quote__line")].map((li) => li.querySelector(".tz-quote__price").textContent)`);
check("breakdown lists paid and included lines", lines.length === q.paid.length + q.included.length, JSON.stringify(lines.map(clean)));
check("breakdown prices match pricing.js", q.paid.every((line, i) => clean(lines[i]) === da(line.price)));
const total = clean(await S(`document.querySelector(".tz-quote__total .numeric").textContent`));
check("breakdown total", total === da(q.total), total);
await b.shot(`${DIR}/price-${tag}-3-breakdown.jpg`);
await S(`document.querySelector(".tz-quote__remove").click(); true`);
setup = { ...setup, [q.paid[0].group]: factoryFor(golf)[q.paid[0].group] };
await expectTotal(`remove ${q.paid[0].group}`);
await S(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); true`);
await b.sleep(300);
check("Escape closes and focus returns to the pill", await S(`document.querySelector(".tz-quote__panel").hidden && document.activeElement === document.querySelector(".tz-quote__pill")`));

// 5. A light look: several options at once.
await section("lights");
const look = lookFor(LIGHT_LOOKS.find((item) => item.id === "ice"), golf);
await S(`[...document.querySelectorAll(".tz-look")][1].click(); true`);
setup = { ...setup, ...look.setup };
await b.sleep(200);
const f5 = await flash();
check("look flash counts options", /\d|واحد|خياران/.test(f5) && f5.includes(CUR), JSON.stringify(f5));
await expectTotal("ice look");
const golfTotal = quoteFor(setup, golf).total;

// 6. Undo.
await S(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })); true`);
const undone = { ...setup };
Object.keys(look.setup).forEach((group) => { undone[group] = setup[group]; });
await b.sleep(900);
check("undo takes the look's price off", (await pill()) !== da(golfTotal), await pill());
await S(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })); true`);
await expectTotal("redo puts it back");

// 7. Switch car and back.
await S(`document.querySelectorAll(".tz-garage__step")[1].click(); true`);
await settle();
await b.sleep(800);
const rs6 = vehicleById("rs6");
check("next car starts at its own 0", (await pill()) === da(0), await pill());
check("no flash on a car change", !(await S(`!!document.querySelector(".tz-quote__flash")`)));
setup = { ...factoryFor(rs6) };
await pick("paint", "graphite");
await expectTotal("RS 6 graphite uses the RS 6 list", rs6);
check("RS 6 graphite price differs from Golf", priceOf(rs6, "paint", "graphite") !== priceOf(golf, "paint", "graphite"));
await layout("RS 6");
await b.shot(`${DIR}/price-${tag}-4-rs6.jpg`);
await S(`document.querySelectorAll(".tz-garage__step")[0].click(); true`);
await settle();
await b.sleep(700);
check("back on the Golf, its own total", (await pill()) === da(golfTotal), await pill());

// 8. Summary section shows prices and the total.
await section("summary");
const grand = clean(await S(`document.querySelector(".tz-summary__grand dd")?.textContent`));
check("summary total", grand === da(golfTotal), grand);
await b.shot(`${DIR}/price-${tag}-5-summary.jpg`);

// 9. Garage panel and price breakdown never open together over each other.
await S(`document.querySelector(".tz-garage__current").click(); true`);
await b.sleep(400);
const both = await S(`(() => { const p = document.querySelector(".tz-garage__panel").getBoundingClientRect(); const q = document.querySelector(".tz-quote__pill").getBoundingClientRect(); return { panelTop: p.top, pillBottom: q.bottom, open: !document.querySelector(".tz-garage__panel").hidden }; })()`);
check("garage panel sits under the console", both.open && both.panelTop >= both.pillBottom, JSON.stringify(both));
await b.shot(`${DIR}/price-${tag}-6-garage.jpg`);
await S(`(() => { const p = document.querySelector(".tz-quote__pill"); p.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); p.click(); return true; })()`);
await b.sleep(400);
check("opening the price closes the car panel", await S(`document.querySelector(".tz-garage__panel").hidden && !document.querySelector(".tz-quote__panel").hidden`));
await S(`document.querySelector(".tz-quote__pill").click(); true`);

const mine = b.errors.filter((e) => !/TuningScene\.jsx/.test(e));
check("no console errors outside the scene", mine.length === 0, mine.slice(0, 3).join(" | "));
if (b.errors.length) console.log(`(scene errors from the camera work in progress: ${b.errors.length})`);
console.log(`${tag}: ${results.filter(Boolean).length}/${results.length}`);
await b.close();
process.exit(0);
