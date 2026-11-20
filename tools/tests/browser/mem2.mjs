import { launch, HOOK } from "./cdp.mjs";
const b = await launch(); await b.size(1440, 900);
await b.goto("http://localhost:5173/tuning?lang=en");
await b.waitFor(`document.querySelector(".tz-canvas canvas") && !document.querySelector(".tz-loader")`);
await b.sleep(2000); await b.eval(HOOK);
const settle = async () => { await b.sleep(300); for (let i = 0; i < 300; i++) { if (!(await b.eval(`document.querySelector(".tz").classList.contains("is-swapping")`))) return; await b.sleep(150); } };
const tex = () => b.eval(`window.__tz.getState().gl.info.memory.textures`);
const step = async (i) => { await b.eval(`document.querySelectorAll(".tz-garage__step")[${i}].click()`); await settle(); await b.sleep(300); };
await step(1); await step(1); // golf -> rs6 -> m3
const out = [["m3", await tex()]];
for (let k = 0; k < 3; k++) { await step(0); out.push(["rs6", await tex()]); await step(1); out.push(["m3", await tex()]); }
for (let k = 0; k < 2; k++) { await step(0); await step(0); out.push(["golf", await tex()]); await step(1); await step(1); out.push(["m3", await tex()]); }
console.log(JSON.stringify(out));
await b.close();
