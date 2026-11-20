import { launch, HOOK } from "./cdp.mjs";
const [w, h] = (process.argv[2] || "1440x900").split("x").map(Number);
const lang = process.argv[3] || "en";
const tag = `${w}-${lang}`;
const BASE = process.env.BASE || "http://localhost:5173";
const ORDER = ["golf", "rs6", "m3", "tiguan", "c63", "supra"];
const b = await launch();
await b.size(w, h, w < 700);
await b.goto(`${BASE}/tuning?lang=${lang}`);
await b.eval("Object.keys(localStorage).filter((k) => k.startsWith('autozone:tuning-setup')).forEach((k) => localStorage.removeItem(k)); true");
await b.goto(`${BASE}/tuning?lang=${lang}`);
await b.waitFor(`document.querySelector(".tz-canvas canvas") && !document.querySelector(".tz-loader")`);
await b.sleep(2000);
await b.eval(HOOK);
const S = (js) => b.eval(js);
const results = [];
const check = (name, ok, info = "") => { results.push([ok ? "PASS" : "FAIL", name, info]); console.log(ok ? "PASS" : "FAIL", name, info); };

// Per-frame recorder: every car group, its position, visibility, front-left wheel spin, and whether it is on screen.
await S(`(() => {
  const s = window.__tz.getState();
  const V = s.camera.position.constructor;
  window.__Box3 = window.__Box3 || (() => { let B; s.scene.traverse((x) => { if (!B && x.geometry?.boundingBox?.constructor) B = x.geometry.boundingBox.constructor; }); if (!B) { s.scene.traverse((x) => { if (!B && x.geometry) { x.geometry.computeBoundingBox(); B = x.geometry.boundingBox.constructor; } }); } return B; })();
  window.__rec = [];
  window.__off = window.__fiber.addAfterEffect(() => {
    const st = window.__tz.getState();
    const cars = [];
    st.scene.children.forEach((root) => root.traverse((o) => {
      if (!o.name?.startsWith("car:")) return;
      const p = o.getWorldPosition(new V());
      let wheel = null;
      o.traverse((n) => { if (!wheel && /(WHEEL_|JEREZ_19_|ALUMINUM_19_)FL$/.test(n.name)) wheel = n; });
      const box = new (st.camera.position.constructor === V ? window.__Box3 : window.__Box3)().setFromObject(o);
      let on = false;
      for (let k = 0; k < 8; k++) {
        const c = new V(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(st.camera);
        if (c.z < 1 && Math.abs(c.x) < 0.92 && Math.abs(c.y) < 0.95) on = true;
      }
      const ndc = p.clone().project(st.camera);
      cars.push({ id: o.name.slice(4), vis: o.visible, x: +p.x.toFixed(3), z: +p.z.toFixed(3), spin: wheel ? +wheel.rotation.x.toFixed(3) : null, on: o.visible && on });
    }));
    window.__rec.push({ t: Math.round(performance.now()), cars, model: document.querySelector(".tz-garage__model")?.textContent, swapping: document.querySelector(".tz").classList.contains("is-swapping") });
  });
  return true;
})()`);

const presentedModel = () => S(`document.querySelector(".tz-garage__model")?.textContent`);
const garageOpen = () => S(`document.querySelector(".tz-garage").classList.contains("is-open")`);
const swapping = () => S(`document.querySelector(".tz").classList.contains("is-swapping")`);
const carsNow = () => S(`(() => { const out = []; window.__tz.getState().scene.traverse((o) => { if (o.name?.startsWith("car:")) out.push(o.name.slice(4) + (o.visible ? "" : "(hidden)")); }); return out; })()`);
async function settle(timeout = 30000) {
  const end = Date.now() + timeout;
  await b.sleep(300);
  while (Date.now() < end) { if (!(await swapping())) { await b.sleep(400); return true; } await b.sleep(150); }
  return false;
}
await S("window.__tz.getState().invalidate(); true"); await b.sleep(300);
const rest = (await S(`window.__rec.at(-1).cars[0]`));
check("starts with the Golf on the floor", rest.id === "golf" && (await presentedModel()) === "Golf GTI", JSON.stringify(rest));


async function transition(label, act, from, to) {
  const t0 = await S("Math.round(performance.now())");
  await act();
  const done = await settle();
  const t1 = await S("Math.round(performance.now())");
  const frames = (await S(`window.__rec.filter((f) => f.t >= ${t0})`));
  await S("window.__rec.length = 0; window.__tz.getState().invalidate(); true"); await b.sleep(200);
  const end = await carsNow();
  let emptiest = 0, run = 0, minGap = Infinity, maxDt = 0, prev = null;
  const spins = { [from]: new Set(), [to]: new Set() };
  for (const f of frames) {
    const on = f.cars.filter((c) => c.on).length;
    run = on ? 0 : run + (prev ? f.t - prev.t : 0);
    emptiest = Math.max(emptiest, run);
    const vis = f.cars.filter((c) => c.vis);
    if (vis.length === 2) minGap = Math.min(minGap, Math.hypot(vis[0].x - vis[1].x, vis[0].z - vis[1].z));
    f.cars.forEach((c) => c.vis && spins[c.id]?.add(c.spin));
    const moved = prev && f.cars.some((c) => { const q = prev.cars.find((x) => x.id === c.id); return c.vis && q && Math.hypot(c.x - q.x, c.z - q.z) > 1e-4; });
    if (moved) maxDt = Math.max(maxDt, f.t - prev.t);
    if (moved && f.t - prev.t > 50 && process.env.DIAG) console.log('   long', f.t - prev.t, 'ms at', f.t - t0, JSON.stringify(f.cars.map((c) => [c.id, c.vis, c.x, c.z])));
    prev = f;
  }
  const last = frames.at(-1)?.cars.find((c) => c.id === to);
  const back = last && Math.hypot(last.x - rest.x, last.z - rest.z);
  check(`${label}: ${from} -> ${to} arrives`, done && end.length === 1 && end[0] === to, `${((t1 - t0) / 1000).toFixed(1)} s, scene ${JSON.stringify(end)}`);
  check(`${label}: ${to} parks where the car stood`, back !== undefined && back < 0.05, `off by ${back?.toFixed(3)} m`);
  check(`${label}: cars never overlap`, minGap > 2.2, `closest ${minGap === Infinity ? "n/a" : minGap.toFixed(2)} m`);
  check(`${label}: showroom never empty > 1.2 s`, emptiest <= 1200, `longest empty ${emptiest} ms`);
  check(`${label}: both cars' wheels turn`, spins[from].size > 5 && spins[to].size > 5, `${spins[from].size}/${spins[to].size} distinct angles`);
  return { maxDt, frames: frames.length };
}

// 1. Next arrow through all six cars and back to the Golf.
const stepBtn = (i) => S(`document.querySelectorAll(".tz-garage__step")[${i}].click()`);
for (let i = 0; i < ORDER.length; i++) {
  const from = ORDER[i], to = ORDER[(i + 1) % ORDER.length];
  const r = await transition("next", () => stepBtn(1), from, to);
  await b.shot(`sr-${tag}-${to}.jpg`);
  console.log("   frames", r.frames, "longest frame while a car moves", r.maxDt, "ms");
}
// 2. Previous arrow.
await transition("previous", () => stepBtn(0), "golf", "supra");
// 3. Direct choice in the panel.
await S(`document.querySelector(".tz-garage__current").click()`); await b.sleep(400);
check("name opens the car panel", await garageOpen());
check("panel lists six cars, current marked", (await S(`[document.querySelectorAll(".tz-car").length, document.querySelectorAll('.tz-car[aria-pressed="true"]').length, document.activeElement.classList.contains("tz-car")]`)).join() === "6,1,true");
check("thumbnails load", await S(`[...document.querySelectorAll(".tz-car img")].every((i) => i.complete && i.naturalWidth > 0)`));
await b.shot(`sr-${tag}-panel.jpg`);
await transition("panel", () => S(`document.querySelectorAll(".tz-car")[2].click()`), "supra", "m3");
check("panel closes after a choice", !(await garageOpen()));
// 4. Escape closes the panel.
await S(`document.querySelector(".tz-garage__current").click()`); await b.sleep(300);
await S(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`); await b.sleep(300);
check("Escape closes the panel, focus back on the name", !(await garageOpen()) && (await S(`document.activeElement.classList.contains("tz-garage__current")`)));
// 5. Rapid clicks: three nexts in 300 ms land on the third car, one car at the end.
const t0 = Date.now();
await stepBtn(1); await b.sleep(100); await stepBtn(1); await b.sleep(100); await stepBtn(1);
await settle(40000); await b.sleep(300);
if (await swapping()) await settle(40000);
await settle(40000);
const rapid = await carsNow();
check("rapid clicks end on the last choice, one car", rapid.length === 1 && rapid[0] === "supra" && (await presentedModel()) === "GR Supra", `${JSON.stringify(rapid)} after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await S("window.__rec.length = 0; true");
// 6. Choose then come back before it loads/arrives: no stray car.
await stepBtn(1); await b.sleep(80); await stepBtn(0);
await settle(40000); await settle(40000);
const cancel = await carsNow();
check("next then previous at once ends on the start car", cancel.length === 1 && (await presentedModel()) === "GR Supra", JSON.stringify(cancel));
// 7. Per-car setup is kept.
await transition("setup", () => S(`document.querySelectorAll(".tz-car")[1].click()`), "supra", "rs6");
await S(`document.querySelectorAll(".tz-step")[0].click()`); await b.sleep(2500);
const paintOf = () => S(`(() => { let c; window.__tz.getState().scene.traverse((m) => { if (m.material?.name?.startsWith?.("Body Paint")) c = m.material.color.getHexString(); }); return c; })()`);
const p0 = await paintOf();
await S(`document.querySelectorAll(".tz-section.is-active input[name=paint]")[3].click()`); await b.sleep(500);
const p1 = await paintOf();
check("paint changes the RS 6", p0 !== p1, `${p0} -> ${p1}`);
await transition("setup", () => stepBtn(1), "rs6", "m3");
const m3paint = await paintOf();
check("M3 keeps its own paint", m3paint !== p1, m3paint);
await transition("setup", () => stepBtn(0), "m3", "rs6");
check("RS 6 paint kept after a round trip", (await paintOf()) === p1, await paintOf());
check("each car saved under its own key", await S(`!!localStorage.getItem("autozone:tuning-setup:rs6") && !!localStorage.getItem("autozone:tuning-setup")`));
// 8. Options offered match the car.
const groupsShown = await S(`[...document.querySelectorAll(".tz-section.is-active .tz-component__name, .tz-section.is-active .tz-group__name")].map((x) => x.textContent)`);
console.log("   RS 6 exterior groups:", JSON.stringify(groupsShown));
// 9. Language switch during a swap.
await stepBtn(1); await b.sleep(900);
await S(`document.querySelector(".lang-menu__button").click()`); await b.sleep(200);
await S(`document.querySelector('.lang-menu__item[lang="${lang === "ar" ? "en" : "ar"}"]').click()`);
await settle(40000); await b.sleep(3500);
const afterLang = await carsNow();
const dirNow = await S(`document.documentElement.dir`);
check("language switch mid-swap: one car, arrived", afterLang.length === 1 && afterLang[0] === "m3", `${JSON.stringify(afterLang)} dir=${dirNow}`);
await b.shot(`sr-${tag}-langswap.jpg`);
await S(`window.__off(); true`);
check("no console errors", b.errors.length === 0, JSON.stringify(b.errors).slice(0, 400));
console.log(`${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
await b.close();
