import { launch, HOOK } from "./cdp.mjs";
const [w, h] = (process.argv[2] || "1440x900").split("x").map(Number);
const lang = process.argv[3] || "en";
const b = await launch();
await b.size(w, h, w < 700);
await b.goto(`${process.env.BASE || "http://localhost:5173"}/tuning?lang=${lang}`);
await b.eval("localStorage.removeItem('autozone:tuning-setup'); true");
await b.goto(`${process.env.BASE || "http://localhost:5173"}/tuning?lang=${lang}`);
await b.waitFor(`document.querySelector(".tz-canvas canvas") && !document.querySelector(".tz-loader")`);
await b.sleep(2000);
await b.eval(HOOK);
const results = [];
const check = (name, ok, info = "") => { results.push([ok ? "PASS" : "FAIL", name, info]); };
const S = (js) => b.eval(js);
const scene = (js) => S(`(() => { const s = window.__tz.getState(); const o = (n) => s.scene.getObjectByName(n); return ${js}; })()`);
const step = async (i) => { await S(`document.querySelectorAll(".tz-step")[${i}].click()`); await b.sleep(2600); };
const active = () => S(`[...document.querySelectorAll(".tz-step")].findIndex((x) => x.classList.contains("is-active"))`);
const cam = () => scene("s.camera.position.toArray().map((v) => +v.toFixed(2))");

// 1. every section
for (let i = 0; i < 8; i++) { await step(i); check(`section ${i + 1} active`, (await active()) === i, JSON.stringify(await cam())); }
// 2. exterior views
await step(0);
const views = await S(`document.querySelectorAll(".tz-section.is-active .tz-view").length`);
const seen = new Set();
for (let i = 0; i < views; i++) { await S(`document.querySelectorAll(".tz-section.is-active .tz-view")[${i}].click()`); await b.sleep(2200); seen.add(JSON.stringify(await cam())); }
check("exterior views move the camera", seen.size === views, `${seen.size}/${views}`);
// 3. paint change + undo/redo + reset + compare
const paint0 = await scene(`(() => { let c; s.scene.traverse((m) => { if (m.material?.name?.startsWith?.("Rojo")) c = m.material.color.getHexString(); }); return c; })()`);
await S(`document.querySelectorAll(".tz-section.is-active input[name=paint]")[2].click()`); await b.sleep(400);
const paint1 = await scene(`(() => { let c; s.scene.traverse((m) => { if (m.material?.name?.startsWith?.("Rojo")) c = m.material.color.getHexString(); }); return c; })()`);
check("paint changes the body", paint0 !== paint1, `${paint0} -> ${paint1}`);
await S(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }))`); await b.sleep(300);
const paintU = await scene(`(() => { let c; s.scene.traverse((m) => { if (m.material?.name?.startsWith?.("Rojo")) c = m.material.color.getHexString(); }); return c; })()`);
check("Ctrl+Z undoes", paintU === paint0);
await S(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true }))`); await b.sleep(300);
const paintR = await scene(`(() => { let c; s.scene.traverse((m) => { if (m.material?.name?.startsWith?.("Rojo")) c = m.material.color.getHexString(); }); return c; })()`);
check("Ctrl+Shift+Z redoes", paintR === paint1);
await S(`document.querySelector(".tz-toolbar [aria-pressed]").click()`); await b.sleep(300);
check("compare shows factory", (await S(`!!document.querySelector(".tz-compare-badge")`)));
await S(`document.querySelector(".tz-toolbar [aria-pressed]").click()`); await b.sleep(300);
// 4. wheels: stance lowers body, wheels stay
await step(1);
const stance = async () => scene(`[o("EXT_BODY").getWorldPosition(new s.camera.position.constructor()).y, o("JEREZ_19_FL").getWorldPosition(new s.camera.position.constructor()).y].map((v) => +v.toFixed(4))`);
const before = await stance();
await S(`(() => { const rows = [...document.querySelectorAll(".tz-section.is-active .tz-component")]; rows[rows.length - 1].click(); })()`); await b.sleep(1500);
await S(`(() => { const r = [...document.querySelectorAll(".tz-section.is-active input[type=radio], .tz-section.is-active [role=radio]")]; r[r.length - 1].click(); })()`); await b.sleep(800);
const after = await stance();
check("ride height lowers the body, not the wheels", after[0] < before[0] - 0.02 && after[1] === before[1], `${before} -> ${after}`);
await S(`document.querySelector(".tz-section.is-active .tz-panel__back, .tz-section.is-active [class*=back]")?.click()`); await b.sleep(500);
// 5. interior: component open, door opens, cabin views stay in cabin
await step(4);
const door = () => scene(`+o("EXT_DOOR_FL").quaternion.y.toFixed(3)`);
check("door open on the seats view", (await door()) < -0.4, String(await door()));
const iv = await S(`document.querySelectorAll(".tz-section.is-active .tz-view").length`);
let inside = 0;
for (let i = 1; i < iv; i++) { await S(`document.querySelectorAll(".tz-section.is-active .tz-view")[${i}].click()`); await b.sleep(2600); const p = await cam(); if (Math.abs(p[0]) < 0.8 && p[1] < 1.42 && Math.abs(p[2]) < 1.05) inside++; }
check("cabin views put the camera in the cabin", inside === iv - 1, `${inside}/${iv - 1}`);
await S(`document.querySelectorAll(".tz-section.is-active .tz-component")[0]?.click()`); await b.sleep(2000);
check("component opens its options", await S(`!!document.querySelector(".tz-section.is-active .tz-group, .tz-section.is-active [role=radiogroup]")`));
await S(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`); await b.sleep(1500);
check("Escape closes the component", await S(`!!document.querySelector(".tz-section.is-active .tz-component")`));
// 6. engine: bonnet opens; leaving closes it
await step(6);
const hinge = () => scene(`+o("Hood_Hinge").rotation.x.toFixed(3)`);
check("bonnet opens on the engine views", (await hinge()) > 0.9, String(await hinge()));
await step(7); await b.sleep(1200);
check("bonnet closes elsewhere", Math.abs(await hinge()) < 0.01, String(await hinge()));
check("door closes outside the interior", (await door()) > -0.06, String(await door()));
// 7. 360 outside, hotspots, inside, Escape
await step(0);
await S(`[...document.querySelectorAll(".tz-toolbar .tz-btn")].find((x) => x.querySelector(".lucide-rotate-3d"))?.click() ?? document.querySelectorAll(".tz-toolbar .tz-btn")[1].click()`); await b.sleep(1500);
check("360° hides the panels", await S(`document.querySelector(".tz").classList.contains("is-free")`));
const spots = await S(`[...document.querySelectorAll(".tz-hotspot")].filter((x) => x.dataset.hidden === "false").length`);
check("hotspots shown on the visible side", spots > 0, String(spots));
await S(`document.querySelector('.tz-segment input[value="inside"]').click()`); await b.sleep(1200);
const pin = await cam();
check("inside 360° puts the camera at the driver's eye", Math.abs(pin[0] - 0.36) < 0.1 && Math.abs(pin[2] + 0.12) < 0.1, JSON.stringify(pin));
await S(`document.querySelector('.tz-segment input[value="outside"]').click()`); await b.sleep(1200);
await S(`[...document.querySelectorAll(".tz-hotspot")].find((x) => x.dataset.hidden === "false").click()`); await b.sleep(2500);
check("hotspot opens its section and component", !(await S(`document.querySelector(".tz").classList.contains("is-free")`)) && (await S(`!!document.querySelector(".tz-section.is-active .tz-group, .tz-section.is-active [role=radiogroup]")`)));
// 8. reset + undo
await S(`[...document.querySelectorAll(".tz-toolbar .tz-btn")].at(-1).click()`); await b.sleep(400);
check("reset returns to factory", (await S(`document.querySelector(".tz-toolbar [aria-pressed]").disabled`)));
await S(`document.querySelectorAll(".tz-toolbar .tz-icon-btn")[0].click()`); await b.sleep(400);
check("reset can be undone", !(await S(`document.querySelector(".tz-toolbar [aria-pressed]").disabled`)));
check("no console errors", b.errors.length === 0, JSON.stringify(b.errors).slice(0, 300));
results.forEach((r) => console.log(r.join("  ")));
console.log(`${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
await b.close();
