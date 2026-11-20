// 1. A scroll during the opening shot takes over at once with no jump. 2. Rapid section switching ends on the last
// section's view with no jump. A jump = one frame moving the camera more than 4x the median step of its neighbours.
import { launch, HOOK } from "./cdp.mjs";
const [w, h] = (process.argv[2] || "1440x900").split("x").map(Number);
const b = await launch({ port: 9333 }); await b.size(w, h, w < 700);
await b.goto("http://localhost:5173/tuning?lang=en");
await b.waitFor(`document.querySelector(".tz-canvas canvas") && performance.getEntriesByType("resource").some((e) => e.name.includes("@react-three_fiber.js"))`);
await b.eval(HOOK);
await b.eval(`(() => { window.__cam = []; window.__fiber.addAfterEffect(() => { const c = window.__tz.getState().camera; window.__cam.push([performance.now(), ...c.position.toArray(), document.querySelector(".tz-loader") ? 1 : 0]); }); return true; })()`);
await b.waitFor(`window.__cam.some((r) => !r[4])`);
await b.sleep(800);
const res = []; const check = (n, ok, i = "") => { res.push(ok); console.log(ok ? "PASS" : "FAIL", n, i); };
const jumps = (rows) => {
  const steps = rows.slice(1).map((r, i) => Math.hypot(r[1] - rows[i][1], r[2] - rows[i][2], r[3] - rows[i][3]) / Math.max(r[0] - rows[i][0], 1));
  let worst = 0;
  for (let i = 3; i < steps.length - 3; i++) { const around = [...steps.slice(i - 3, i), ...steps.slice(i + 1, i + 4)].sort((a, c) => a - c); const med = around[3]; if (med > 1e-4) worst = Math.max(worst, steps[i] / med); }
  return worst;
};
// 1. scroll mid-intro
await b.eval(`window.__mark = window.__cam.length; window.scrollBy({ top: innerHeight * 0.6, behavior: "smooth" }); true`);
await b.sleep(2800);
let rows = await b.eval(`window.__cam.filter((r) => !r[4])`);
const j1 = jumps(rows);
check("scroll during the opening shot: no jump", j1 < 4, `worst step ${j1.toFixed(2)}x its neighbours`);
const atWheels = await b.eval(`[...document.querySelectorAll(".tz-step")].findIndex((x) => x.classList.contains("is-active"))`);
check("the scroll moved on", atWheels >= 0, `active step ${atWheels}`);
// 2. rapid switching
await b.eval(`window.__cam = []; true`);
for (const i of [1, 3, 0, 2, 4, 1, 2]) { await b.eval(`document.querySelectorAll(".tz-step")[${i}].click()`); await b.sleep(180); }
await b.sleep(3500);
rows = await b.eval(`window.__cam`);
const j2 = jumps(rows);
check("rapid section switching: no jump", j2 < 4, `worst step ${j2.toFixed(2)}x its neighbours, frames ${rows.length}`);
const last = rows.at(-1); const prev = rows.at(-6);
const still = Math.hypot(last[1] - prev[1], last[2] - prev[2], last[3] - prev[3]);
const active = await b.eval(`document.querySelector(".tz-step.is-active")?.textContent`);
check("ends at rest on the last section", still < 0.002 && /lights/i.test(active), `${active}, moved ${(still * 1000).toFixed(1)} mm over the last frames`);
console.log("errors", JSON.stringify(b.errors).slice(0, 200));
console.log(`${res.filter(Boolean).length}/${res.length} PASS`);
await b.close();
