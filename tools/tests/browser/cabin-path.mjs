// Every camera position on the way into the cabin, between cabin views and back out: none may sit in the bodywork
// (inside the car's box but outside the cabin and the door opening). Also counts back-and-forth jitter.
import { launch, HOOK } from "./cdp.mjs";
const car = process.argv[2] || "golf";
const [w, h] = (process.argv[3] || "1440x900").split("x").map(Number);
const ORDER = ["golf", "rs6", "m3", "tiguan", "c63", "supra"];
const FR = { golf: [1, 1, 1], tiguan: [2.163 / 2.099, 1.677 / 1.492, 4.694 / 4.3] }[car];
const b = await launch({ port: 9333 }); await b.size(w, h, w < 700);
await b.goto("http://localhost:5173/tuning?lang=en");
await b.waitFor(`document.querySelector(".tz-canvas canvas") && !document.querySelector(".tz-loader")`);
await b.sleep(3500); await b.eval(HOOK);
const S = (js) => b.eval(js);
if (car !== "golf") { await S(`document.querySelector(".tz-garage__current").click()`); await b.sleep(300); await S(`document.querySelectorAll(".tz-car")[${ORDER.indexOf(car)}].click()`); await b.sleep(9000); }
await S(`(() => { window.__cam = []; window.__fiber.addAfterEffect(() => { const c = window.__tz.getState().camera; window.__cam.push(c.position.toArray()); }); return true; })()`);
const stepTo = async (label) => { await S(`[...document.querySelectorAll(".tz-step")].find((x) => x.textContent.includes(${JSON.stringify(label)})).click()`); await b.sleep(3000); };
await stepTo("Interior");
const n = await S(`document.querySelectorAll(".tz-section.is-active .tz-view").length`);
for (let i = 1; i < n; i++) { await S(`document.querySelectorAll(".tz-section.is-active .tz-view")[${i}].click()`); await b.sleep(i % 2 ? 1200 : 2400); }
await S(`document.querySelectorAll(".tz-section.is-active .tz-view")[0].click()`); await b.sleep(2600);
await stepTo("Paint"); await b.sleep(1000);
const rec = await S(`window.__cam`);
let bad = [], reversals = 0;
for (const p of rec) {
  const [x, y, z] = [p[0] / FR[0], p[1] / FR[1], p[2] / FR[2]];
  const inBox = Math.abs(x) < 1.0 && y > 0.25 && y < 1.4 && Math.abs(z) < 2.1;
  const cabin = Math.abs(x) < 0.8 && y < 1.42 && Math.abs(z) < 1.05;
  const door = x > 0.6 && Math.abs(z - 0.15) < 0.6 && y > 0.85 && y < 1.5;
  if (inBox && !cabin && !door) bad.push(p.map((v) => +v.toFixed(2)));
}
for (let i = 2; i < rec.length; i++) {
  const a = rec[i - 1].map((v, k) => v - rec[i - 2][k]); const c = rec[i].map((v, k) => v - rec[i - 1][k]);
  const la = Math.hypot(...a), lc = Math.hypot(...c);
  if (la > 0.004 && lc > 0.004 && (a[0] * c[0] + a[1] * c[1] + a[2] * c[2]) / (la * lc) < -0.5) reversals++;
}
console.log(`${car} ${w}x${h}: frames ${rec.length}, in bodywork ${bad.length} ${JSON.stringify(bad.slice(0, 5))}, sharp reversals ${reversals}`);
console.log("errors", JSON.stringify(b.errors).slice(0, 200));
await b.close();
