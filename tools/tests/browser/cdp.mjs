import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

// Screenshots land in tools/tests/browser/out/.
const OUT = new URL("./out/", import.meta.url).pathname;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port = 9333 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), "tzchrome-"));
  const proc = spawn("google-chrome", [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    ...(process.env.TZ_GL === "sw" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"]),
    "--no-first-run", "--no-default-browser-check", "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "about:blank",
  ], { stdio: "ignore" });
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); }
  }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map(); const listeners = [];
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); }
    else listeners.forEach((fn) => fn(msg));
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method, params })); });
  const errors = [];
  listeners.push((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  });
  await send("Runtime.enable"); await send("Page.enable");
  // One call with every feature: a second call would replace the first.
  const features = [
    ...(process.env.REDUCED ? [{ name: "prefers-reduced-motion", value: "reduce" }] : []),
    ...(process.env.DARK ? [{ name: "prefers-color-scheme", value: "dark" }] : []),
  ];
  if (features.length) await send("Emulation.setEmulatedMedia", { features });
  if (process.env.THROTTLE) await send("Emulation.setCPUThrottlingRate", { rate: +process.env.THROTTLE });
  const api = {
    send, errors, sleep,
    on(fn) { listeners.push(fn); },
    async size(width, height, mobile = false) { await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile }); },
    async goto(url) { await send("Page.navigate", { url }); await sleep(500); },
    async eval(expr) {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async waitFor(expr, timeout = 60000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) { if (await api.eval(expr).catch(() => false)) return true; await sleep(200); }
      throw new Error("timeout: " + expr);
    },
    async shot(path, clip) { const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 80, ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); mkdirSync(OUT, { recursive: true }); writeFileSync(isAbsolute(path) ? path : join(OUT, path), Buffer.from(r.data, "base64")); },
    async close() { try { await send("Browser.close"); } catch {} proc.kill(); },
  };
  return api;
}

// Gives page access to the R3F store of the Tuning canvas (dev server only).
export const HOOK = `(async () => {
  const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes("@react-three_fiber.js"));
  const fiber = await import(url);
  const canvas = document.querySelector(".tz-canvas canvas");
  window.__tz = fiber._roots.get(canvas).store; window.__fiber = fiber;
  return !!window.__tz;
})()`;
