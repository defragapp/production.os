// Throwaway QA: capture live site at iOS viewport via CDP.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.argv[2] || "https://sovereign.defrag.app/";
const W = 393, H = 852;
const profile = mkdtempSync(join(tmpdir(), "qa-profile-"));
const PORT = 9333;

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", `--user-data-dir=${profile}`,
  `--remote-debugging-port=${PORT}`, "--no-first-run", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try { return (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; }
    catch { await sleep(250); }
  }
  throw new Error("chrome did not start");
}
let id = 0; const pending = new Map(); let ws;
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const msgId = ++id; pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
  });
}
const main = async () => {
  ws = new WebSocket(await getWsUrl());
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p = {}) => send(m, p, sessionId);
  await S("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  await S("Page.enable"); await S("Runtime.enable");
  await S("Page.navigate", { url: URL });
  await sleep(5000);
  const evalJs = async (expression) => (await S("Runtime.evaluate", { expression, returnByValue: true })).result?.value;
  const shot = async (name, scrollY) => {
    await evalJs(`window.scrollTo(0, ${scrollY}); "ok"`);
    await sleep(700);
    const { data } = await S("Page.captureScreenshot", { format: "png" });
    writeFileSync(`/tmp/${name}.png`, Buffer.from(data, "base64"));
    console.log("wrote /tmp/" + name + ".png");
  };
  const offsets = await evalJs(`(() => {
    const hs = [...document.querySelectorAll("h2")];
    return JSON.stringify({ pageH: document.body.scrollHeight, h2: hs.map(h => Math.round(h.getBoundingClientRect().top + window.scrollY)) });
  })()`);
  console.log("offsets:", offsets);
  const { pageH, h2 } = JSON.parse(offsets);
  await shot("qa2-hero", 0);
  for (let i = 0; i < h2.length; i++) await shot(`qa2-sec${i}`, Math.max(0, h2[i] - 90));
  chrome.kill(); process.exit(0);
};
main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
