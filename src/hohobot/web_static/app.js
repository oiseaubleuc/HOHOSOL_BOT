/**
 * HOHOBOT dashboard — spatial canvas + chat
 */

const canvas = document.getElementById("space-canvas");
const orbitCore = document.getElementById("orbit-core");
const thread = document.getElementById("thread");
const form = document.getElementById("composer");
const input = document.getElementById("input");
const agentSelect = document.getElementById("agent");
const enginePill = document.getElementById("engine-pill");
const engineLabel = document.getElementById("engine-label");
const mLat = document.getElementById("m-lat");
const mModel = document.getElementById("m-model");

/** @type {CanvasRenderingContext2D | null} */
let ctx = null;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function resizeCanvas() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Spatial star field with parallax layers */
const stars = [];
const LAYERS = 3;

function initStars() {
  stars.length = 0;
  const count = Math.floor((window.innerWidth * window.innerHeight) / 9000);
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      z: Math.random(),
      layer: Math.floor(Math.random() * LAYERS),
      s: 0.6 + Math.random() * 1.8,
      tw: Math.random() * Math.PI * 2,
    });
  }
}

let mx = 0;
let my = 0;
window.addEventListener("pointermove", (e) => {
  if (reduceMotion) return;
  mx = e.clientX / window.innerWidth - 0.5;
  my = e.clientY / window.innerHeight - 0.5;
  const tiltX = my * -6;
  const tiltY = mx * 8;
  document.documentElement.style.setProperty("--tilt-x", `${tiltX}deg`);
  document.documentElement.style.setProperty("--tilt-y", `${tiltY}deg`);
});

function drawFrame(t) {
  if (!ctx || !canvas) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);

  const gx = 0.5 + mx * 0.15;
  const gy = 0.5 + my * 0.15;
  const g = ctx.createRadialGradient(w * gx, h * gy, 0, w * gx, h * gy, Math.max(w, h) * 0.65);
  g.addColorStop(0, "rgba(56, 189, 248, 0.12)");
  g.addColorStop(0.35, "rgba(167, 139, 250, 0.06)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  for (const s of stars) {
    const depth = (s.layer + 1) / LAYERS;
    const parallaxX = mx * 40 * depth;
    const parallaxY = my * 28 * depth;
    const twinkle = 0.55 + 0.45 * Math.sin(t * 0.001 + s.tw);
    ctx.fillStyle = `rgba(226,232,240,${0.15 + twinkle * 0.35 * depth})`;
    ctx.beginPath();
    ctx.arc(s.x + parallaxX, s.y + parallaxY, s.s * depth, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!reduceMotion) requestAnimationFrame(drawFrame);
}

window.addEventListener("resize", () => {
  resizeCanvas();
  initStars();
  if (reduceMotion) drawFrame(0);
});

resizeCanvas();
initStars();

if (reduceMotion) {
  drawFrame(0);
} else {
  requestAnimationFrame(drawFrame);
}

async function checkHealth() {
  try {
    const r = await fetch("/health", { cache: "no-store" });
    const data = await r.json();
    const ok = r.ok && data.status === "ok";
    enginePill.classList.toggle("ok", ok);
    enginePill.classList.toggle("bad", !ok);
    engineLabel.textContent = ok ? "Engine online" : "Engine degraded";
  } catch {
    enginePill.classList.remove("ok");
    enginePill.classList.add("bad");
    engineLabel.textContent = "Unreachable";
  }
}

function appendBubble(role, text) {
  const wrap = document.createElement("div");
  wrap.className = `bubble ${role}`;
  const r = document.createElement("div");
  r.className = "role";
  r.textContent = role === "user" ? "You" : "HOHOBOT";
  const body = document.createElement("div");
  body.textContent = text;
  wrap.append(r, body);
  thread.appendChild(wrap);
  thread.scrollTop = thread.scrollHeight;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  appendBubble("user", text);
  input.value = "";
  input.style.height = "auto";

  const agent = agentSelect.value;
  orbitCore.classList.add("sending");
  const t0 = performance.now();

  try {
    const r = await fetch("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent,
        messages: [{ role: "user", content: text }],
      }),
    });
    const data = await r.json();
    const dt = Math.round(performance.now() - t0);
    mLat.textContent = `${dt} ms`;
    if (!r.ok) {
      const detail = data.detail ?? JSON.stringify(data);
      appendBubble("assistant", `Error: ${detail}`);
      return;
    }
    const content = data.choices?.[0]?.message?.content ?? "(empty)";
    mModel.textContent = data.model ?? "—";
    appendBubble("assistant", content);
  } catch (err) {
    appendBubble("assistant", `Network error: ${err}`);
  } finally {
    orbitCore.classList.remove("sending");
  }
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
});

checkHealth();
setInterval(checkHealth, 15000);
