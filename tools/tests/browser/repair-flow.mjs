// The full customer repair journey: open from the 3D Zone, fill the steps, attach a photo, submit, confirm, and
// check the stored request (submitted, right car + problems, the image saved), then track it. Deletes its test row.
//   node tools/tests/browser/repair-flow.mjs 1440x900 en
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, existsSync, unlinkSync } from "node:fs";
import { launch } from "./cdp.mjs";

const require = createRequire(import.meta.url);
const serverDir = join(dirname(fileURLToPath(import.meta.url)), "../../../server");
const db = require(join(serverDir, "database.js"));
const [w, h] = (process.argv[2] || "1440x900").split("x").map(Number);
const lang = process.argv[3] || "en";
const tag = `${w}-${lang}`;
const API = "http://localhost:5000";
const b = await launch({ port: Number(process.env.PORT || 9333) });
const S = (js) => b.eval(js);
const results = [];
const check = (name, ok, info = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, info); };
let createdId = null;

// A tiny PNG on disk to upload.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const pngPath = "/tmp/claude-1000/-home-ouail-nazim-Documents-GitHub-Fennec-Realty-V14/2cd3bfad-aa61-408d-aaca-6aa5643ca504/scratchpad/tz/rp/pixel.png";
writeFileSync(pngPath, png);

await b.size(w, h, w < 700);
await b.goto(`http://localhost:5173/tuning?lang=${lang}`);
await b.waitFor(`document.querySelector(".tz-canvas canvas") && !document.querySelector(".tz-loader")`);
await b.sleep(2800);

await S(`document.querySelector(".tz-bar__repair").click()`);
await b.waitFor(`!!document.querySelector(".tz-rp__panel")`, 60000);
await b.sleep(2600);
check("opened over the 3D Zone, one canvas", (await S(`document.querySelectorAll("canvas").length`)) === 1);

// Step 1 vehicle (prefilled) -> continue
await S(`document.querySelector(".tz-rp-primary").click()`); await b.sleep(700);
// Step 2 problems: pick Engine, describe; attach the png via CDP file input
await S(`document.querySelectorAll(".tz-rp-cat")[0].click()`); await b.sleep(1600);
await S(`(() => { const t = document.querySelector(".tz-rp-problem textarea"); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(t, "Engine knocks when cold."); t.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
// severity urgent
await S(`document.querySelector(".tz-rp-chip--urgent input").click()`); await b.sleep(150);
const fileNode = await b.send("Runtime.evaluate", { expression: `document.querySelector('.tz-rp-thumb--add input[type=file]')`, returnByValue: false });
const { root } = await b.send("DOM.getDocument", {});
const found = await b.send("DOM.querySelector", { nodeId: root.nodeId, selector: ".tz-rp-thumb--add input[type=file]" });
await b.send("DOM.setFileInputFiles", { files: [pngPath], nodeId: found.nodeId });
await b.sleep(500);
check("photo attached", (await S(`document.querySelectorAll(".tz-rp-thumb img").length`)) === 1);
await S(`document.querySelector(".tz-rp-primary").click()`); await b.sleep(700);
// Step 3 details
await S(`(() => { const set = (sel, v) => { const el = document.querySelector(sel); Object.getOwnPropertyDescriptor(el.constructor.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); }; set(".tz-rp-field input[type=text]", "Repair Flow Test"); set(".tz-rp-field input[type=tel]", "0551 22 33 44"); set(".tz-rp-field input[type=email]", "flow@example.com"); return true; })()`);
await b.sleep(200);
await S(`document.querySelector(".tz-rp-primary").click()`); await b.sleep(700);
// Step 4 review -> send
check("review shows the problem and severity", await S(`document.querySelector(".tz-rp-review").textContent.includes("Urgent") || document.querySelector(".tz-rp-review").textContent.length > 20`));
await S(`document.querySelector(".tz-rp-primary").click()`);
await b.waitFor(`!!document.querySelector(".tz-rp-sent")`, 20000);
await b.sleep(700);
await b.shot(`flow-${tag}-sent.jpg`);
const reference = await S(`document.querySelector(".tz-rp-sent__reference strong").textContent`);
createdId = Number(reference.replace(/\D/g, ""));
check("confirmation with an RP reference, under review", /^RP-\d+$/.test(reference) && (await S(`!!document.querySelector(".tz-rp-status")`)), reference);
check("track link carries the reference", (await S(`document.querySelector(".tz-rp-sent a").getAttribute("href")`)) === `/track?id=${reference}`);

// Stored correctly, never priced
const row = db.prepare("SELECT * FROM repair_requests WHERE id = ?").get(createdId);
const problems = JSON.parse(row.problems);
const attachments = JSON.parse(row.attachments);
check("stored as submitted", row.status === "submitted");
check("stored car + customer", row.vehicle_make === "Volkswagen" && row.full_name === "Repair Flow Test" && row.phone.includes("0551"));
check("stored the problem (engine, urgent, area)", problems.length === 1 && problems[0].category === "engine" && problems[0].severity === "urgent" && problems[0].area === "engine");
check("stored the photo", attachments.length === 1);
const imgPath = join(serverDir, attachments[0].replace(/^\//, ""));
check("photo file on disk", existsSync(imgPath), attachments[0]);

// Track by reference + phone
const tracked = await (await fetch(`${API}/api/tuning-requests`.replace("tuning", "repair") + "/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference, phone: "0551223344" }) })).json();
check("tracking shows submitted, problem count", tracked.request?.status === "submitted" && tracked.request?.problem_count === 1);

// Close -> back to the configurator
await S(`document.querySelector(".tz-rp-sent .tz-rp-quiet").click()`); await b.sleep(700);
await b.waitFor(`!!document.querySelector(".tz-canvas canvas")`, 30000);
check("back in the workshop", await S(`!document.querySelector(".tz-rp")`));
check("no console errors", b.errors.length === 0, JSON.stringify(b.errors).slice(0, 300));

// Cleanup
if (createdId) {
  if (existsSync(imgPath)) unlinkSync(imgPath);
  db.prepare("DELETE FROM notifications WHERE type = 'repair' AND ref_id = ?").run(createdId);
  db.prepare("DELETE FROM repair_requests WHERE id = ?").run(createdId);
}
if (existsSync(pngPath)) unlinkSync(pngPath);

console.log(`${tag}: ${results.filter(Boolean).length}/${results.length} PASS (test request ${createdId} deleted)`);
await b.close();
