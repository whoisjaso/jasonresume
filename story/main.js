/* After Hours, Episode One: Lamps On. The story you walk through.

   You arrive at Triple J Auto's lot in Houston after close. Dell, the night
   porter, is at the gate; Jason is by the showroom. Walk the lot, go into the
   office, look at things, talk to people. What you say and what you look at
   changes what is said later, and the episode ends with the version of the
   record that fits why you came: the one-page resume for the role you're
   hiring for, Obavia's early access for a dealer, the arcade cabinet for
   someone curious, or the record as it is if you never say.

   The words are data (tools/site/story.json, inlined as #story-data). Every
   line Jason says that states a fact is a first-person fact already in
   llms.txt; Dell, Renata, the caller, the voice agent and the library are
   fictional, labelled so where they speak, and voiced with stock Kokoro voices.
   Jason's lines are his own voice, synthesized from his recording with his
   permission. Captions are always on; voices play only with the score on.
   Choices, arrivals and trophies fire sound, haptic and motion in the same
   frame; skips and cancels are silent. Trophies are earned in play through
   window.JG_GAME.unlock, so the library, the profile and the platinum agree.

   Lazy: game.js loads this module (with three.js, vendored and pinned) only
   when someone presses Play, opens #story or #story/<scene>, or Continues.
   window.JG_STORY.open(scene, how)  .close(how)  .isOpen()  .hasSave()
   window.JG_STORY.debug             hooks for tools/verify/story.mjs */
import * as THREE from "../vendor/three-0.184.0/three.module.min.js";
import { U, MAXL, blobMat } from "./paint.js";
import * as TX from "./tex.js";
import { loadCast } from "./people.js";
import { buildLot, buildOffice, buildLibrary, addKeys } from "./world.js";
import { Post, GRADES, applyGrade } from "./post.js";

const root = document.documentElement, body = document.body;
const D = JSON.parse(document.getElementById("story-data").textContent);
const LIB = (() => { try { return JSON.parse(document.getElementById("library-data").textContent); } catch (e) { return null; } })();
const TALK = D.talks, OBJ = D.objects, CAST = D.cast, UI = D.ui;
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const COARSE = matchMedia("(pointer: coarse)");
const DEBUG = /[?&]debug=story/.test(location.search);
const FAST = DEBUG && /[?&]fast=1/.test(location.search);
const VER = "v1";

/* ---------- small helpers ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [].slice.call((r || document).querySelectorAll(s));
const E = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const sleep = ms => new Promise(r => setTimeout(r, FAST ? Math.min(ms, 30) : ms));
function T(e, p) { if (window.JG_TRACK) window.JG_TRACK(e, p || {}); }
function FX(k) { if (window.JG_FX) window.JG_FX(k); }
function hap(k) { if (window.JG_HAPTIC) window.JG_HAPTIC(k); }
function SC() { return window.JG_SCORE; }
const soundOn = () => !!(SC() && SC().isOn());
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
const still = () => RM.matches;
function angTo(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

/* ---------- state ---------- */
const S = {
  open: false, scene: null, phase: "load", flags: {}, looked: {}, log: [], trophies: [], journal: [], obj: null,
  talking: null, ending: null, t: 0, started: 0
};
function cond(c) {
  if (!c) return true;
  return c.split(",").every(term => {
    term = term.trim();
    if (term.startsWith("seen:")) return !!S.looked[term.slice(5)];
    if (term.startsWith("!")) return !S.flags[term.slice(1)];
    const ne = term.split("!="); if (ne.length === 2) return String(S.flags[ne[0]] || "") !== ne[1];
    const eq = term.split("="); if (eq.length === 2) return String(S.flags[eq[0]] || "") === eq[1];
    return !!S.flags[term];
  });
}
function save() {
  if (!S.scene || S.ending) return;
  store.set("jg_story", JSON.stringify({ v: 1, scene: S.scene, flags: S.flags, looked: S.looked, log: S.log, trophies: S.trophies, journal: S.journal, t: Date.now() }));
}
function loadSave() { try { const s = JSON.parse(store.get("jg_story") || "null"); return s && s.v === 1 && s.scene ? s : null; } catch (e) { return null; } }

/* ================================================================
   DOM: the layers over the canvas
   ================================================================ */
let el = $("#story");
if (!el) { el = document.createElement("div"); el.id = "story"; el.className = "story is-loading"; body.appendChild(el); }
el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", D.title + ", " + D.episode);
el.innerHTML =
  '<canvas class="st-cv" aria-hidden="true"></canvas>' +
  '<div class="st-box" aria-hidden="true"><i></i><i></i></div>' +
  '<div class="st-dots" aria-hidden="true"></div>' +
  '<button class="st-prompt" type="button" hidden><span class="st-prompt__dot" aria-hidden="true"></span><span class="st-prompt__verb"></span><span class="st-prompt__label"></span><kbd class="st-prompt__key" aria-hidden="true">E</kbd></button>' +
  '<p class="st-obj" aria-live="polite" hidden></p>' +
  '<div class="st-note" role="status" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c-2.8 0-5 2.2-5 5 0 2 1.1 3.3 2.2 4.2.6.5.8 1.1.8 1.8v1h4v-1c0-.7.3-1.3.8-1.8C15.9 11.3 17 10 17 8c0-2.8-2.2-5-5-5zM10 18h4M10.5 21h3"/></svg><span></span></div>' +
  '<div class="st-trophy" role="status" hidden></div>' +
  '<div class="st-toast" role="status" hidden></div>' +
  '<div class="st-cap" aria-live="polite" hidden><p class="st-cap__who"><b></b><small></small></p><p class="st-cap__said"></p></div>' +
  '<div class="st-choices" role="group" hidden><ol></ol><div class="st-timer" aria-hidden="true"><i></i></div></div>' +
  '<div class="st-card" aria-hidden="true" hidden><p class="st-card__ep"></p><h2 class="st-card__h"></h2><p class="st-card__sub"></p></div>' +
  '<div class="st-hud"><button class="st-ico" type="button" data-st="journal" aria-label="' + E(UI.journal) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM4 17a2 2 0 0 1 2-2h12M9 7h6M9 10h4"/></svg></button><button class="st-ico" type="button" data-st="pause" aria-label="' + E(UI.pause) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg></button></div>' +
  '<p class="st-hint" hidden></p>' +
  '<div class="st-stick" aria-hidden="true" hidden><i></i></div>' +
  '<div class="st-close" hidden><div class="st-close__spots"></div><button class="st-back" type="button" data-st="back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>Back</button></div>' +
  '<section class="st-sheet" hidden aria-label="Handle a Sale"><div class="st-sheet__in"><p class="st-sheet__note">' + E("Handle a Sale. Fictional buyer, example figures.") + '</p><div class="iphone" data-desk-app></div><button class="st-back" type="button" data-st="sheet-back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>Back</button></div></section>' +
  '<section class="st-journal" hidden aria-label="' + E(UI.journal) + '"></section>' +
  '<section class="st-pause" hidden aria-label="' + E(UI.pause) + '"></section>' +
  '<section class="st-end" hidden aria-label="' + E(UI.end_h) + '"></section>' +
  '<div class="st-load"><p class="st-load__t">' + E(D.title) + '</p><p class="st-load__s">' + E(D.episode + ". " + D.name) + '</p><div class="st-load__bar"><i></i></div><p class="st-load__line"></p></div>' +
  '<div class="st-fade" aria-hidden="true"></div>';
const cv = $(".st-cv", el), capEl = $(".st-cap", el), whoEl = $(".st-cap__who b", el), tagEl = $(".st-cap__who small", el), saidEl = $(".st-cap__said", el);
const choicesEl = $(".st-choices", el), choicesOl = $("ol", choicesEl), timerEl = $(".st-timer", el);
const promptEl = $(".st-prompt", el), objEl = $(".st-obj", el), noteEl = $(".st-note", el), trophyEl = $(".st-trophy", el), toastEl = $(".st-toast", el);
const cardEl = $(".st-card", el), fadeEl = $(".st-fade", el), dotsEl = $(".st-dots", el), hintEl = $(".st-hint", el), stickEl = $(".st-stick", el);
const closeEl = $(".st-close", el), sheetEl = $(".st-sheet", el), journalEl = $(".st-journal", el), pauseEl = $(".st-pause", el), endEl = $(".st-end", el), loadEl = $(".st-load", el);
function setLoad(f, line) { $(".st-load__bar i", el).style.transform = "scaleX(" + clamp(f, 0, 1) + ")"; if (line != null) $(".st-load__line", el).textContent = line; }
setLoad(0.15, D.scenes.lot.card);

/* ================================================================
   RENDERER, SETS, CAST
   ================================================================ */
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: "high-performance", alpha: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x05070a, 1);
const scene = new THREE.Scene();
const world = new THREE.Group(); scene.add(world);
const camera = new THREE.PerspectiveCamera(50, 1, 0.08, 220);
camera.layers.enableAll();
let quality = COARSE.matches ? 1 : 2;
{ const m = location.search.match(/[?&]sq=(\d)/); if (DEBUG && m) quality = +m[1]; }
const post = new Post(renderer, { quality });
let pixelRatio = Math.min(devicePixelRatio || 1, COARSE.matches ? 1.5 : 1.75);
{ const m = location.search.match(/[?&]pr=([\d.]+)/); if (DEBUG && m) { pixelRatio = +m[1]; S.lockQ = true; } }
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(1); renderer.setSize(w, h, false);
  const pw = Math.round(w * pixelRatio), ph = Math.round(h * pixelRatio);
  post.setSize(pw, ph); renderer.setSize(pw, ph, false); cv.style.width = w + "px"; cv.style.height = h + "px";
  camera.aspect = w / h; camera.fov = w / h < 1 ? 62 : 48; camera.updateProjectionMatrix();
  el.classList.toggle("is-upright", w < h);
}
addEventListener("resize", resize);

U.uBrush.value = TX.brush();
const sets = {};
let cast = null;
const P = {}; // people: you, jason, dell, renata, memory
let wordmark = null;
await new Promise(res => { const i = new Image(); i.onload = () => { wordmark = i; res(); }; i.onerror = () => res(); i.src = "assets/brand/triplej-wordmark.png"; });
try { await document.fonts.load('600 64px "Cormorant Garamond"'); await document.fonts.load('500 24px "Hanken Grotesk"'); } catch (e) {}
setLoad(0.3);

function lotArt() { const a = (LIB && LIB.titles && (LIB.titles.find(t => t.id === "triple-j") || {}).art) || "triple-j"; return "assets/game/art/" + a + "-1280.webp"; }
function getSet(name) {
  if (sets[name]) return sets[name];
  let s;
  if (name === "lot" || name === "decision") s = sets.lot || buildLot({ wordmark, lowres: COARSE.matches });
  else if (name === "office") s = buildOffice({ lotArt: lotArt(), arcadeTex: arcadeVideo() });
  else if (name === "memory") s = buildLibrary({});
  else if (name === "keys") { s = buildLot({ wordmark, day: true, lowres: true }); addKeys(s); }
  s.visible = false; world.add(s);
  sets[name] = s; if (name === "lot") sets.decision = s; if (name === "decision") sets.lot = s;
  return s;
}
let arcadeV = null;
function arcadeVideo() {
  try {
    const v = document.createElement("video"); v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
    const src = (D.arcade || "assets/game/loops/run-attract"); v.innerHTML = '<source src="' + src + '.webm" type="video/webm"><source src="' + src + '.mp4" type="video/mp4">';
    arcadeV = v; const t = new THREE.VideoTexture(v); t.colorSpace = THREE.SRGBColorSpace; return t;
  } catch (e) { return null; }
}

/* ================================================================
   AUDIO: rain, footsteps, the phone (only with the score on)
   ================================================================ */
const A = { ctx: null, rain: null, rainG: null, rainF: null };
function audio() {
  if (A.ctx || !soundOn()) return A.ctx;
  try {
    const C = new (window.AudioContext || window.webkitAudioContext)(); A.ctx = C;
    const len = C.sampleRate * 2, buf = C.createBuffer(1, len, C.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.98 * b0 + w * 0.1; b1 = 0.6 * b1 + w * 0.4; d[i] = b0 * 0.6 + b1 * 0.25 + (Math.random() < 0.0006 ? (Math.random() - 0.5) * 2.2 : 0); }
    A.noise = buf;
    const src = C.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = C.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 4200;
    const hp = C.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 280;
    const g = C.createGain(); g.gain.value = 0;
    src.connect(hp); hp.connect(f); f.connect(g); g.connect(C.destination); src.start();
    A.rain = src; A.rainG = g; A.rainF = f;
  } catch (e) {}
  return A.ctx;
}
function rainLevel(v, muffled) {
  if (!audio() || !A.rainG) return;
  const t = A.ctx.currentTime;
  A.rainG.gain.cancelScheduledValues(t); A.rainG.gain.linearRampToValueAtTime(soundOn() ? v : 0, t + 1.2);
  A.rainF.frequency.linearRampToValueAtTime(muffled ? 900 : 4200, t + 1.2);
}
function step(wet) {
  if (!soundOn() || !audio()) return;
  const C = A.ctx, s = C.createBufferSource(); s.buffer = A.noise;
  const f = C.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = wet ? 1400 + Math.random() * 500 : 700 + Math.random() * 200; f.Q.value = 1.2;
  const g = C.createGain(); const t = C.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(wet ? 0.07 : 0.05, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + (wet ? 0.16 : 0.09));
  s.connect(f); f.connect(g); g.connect(C.destination); s.start(t, Math.random() * 1.5, 0.2);
}
let ringOn = false, ringT = 0;
function ringTick(dt) {
  if (!ringOn) return;
  ringT += dt;
  const ph = ringT % 4, on = ph < 1.6;
  const led = sets.office && sets.office.userData.phone.led;
  if (led) led.material.uniforms.uK.value = on && (ph * 8 % 1 < 0.5) ? 3 : 0.4;
  if (on && !A.ringing && soundOn() && audio()) {
    A.ringing = true; const C = A.ctx, t = C.currentTime, g = C.createGain(); g.gain.value = 0; g.connect(C.destination);
    for (const fq of [440, 480]) { const o = C.createOscillator(); o.frequency.value = fq; o.connect(g); o.start(t); o.stop(t + 1.6); }
    const lfo = C.createOscillator(), lg = C.createGain(); lfo.frequency.value = 20; lg.gain.value = 0.03; lfo.connect(lg); lg.connect(g.gain); lfo.start(t); lfo.stop(t + 1.6);
    g.gain.setValueAtTime(0.03, t); g.gain.setValueAtTime(0.03, t + 1.55); g.gain.linearRampToValueAtTime(0, t + 1.6);
  }
  if (!on) A.ringing = false;
}

/* ================================================================
   VOICES AND CAPTIONS
   ================================================================ */
const VBASE = D.out || "assets/voice/story";
const have = { fict: {}, me: {} };
fetch(VBASE + "/manifest.json").then(r => (r.ok ? r.json() : null)).then(j => { if (j && j.lines) have.fict = j.lines; }).catch(() => {});
fetch(VBASE + "/manifest-jason.json").then(r => (r.ok ? r.json() : null)).then(j => { if (j && j.lines) have.me = j.lines; }).catch(() => {});
let line = null; // { L, t, dur, audio, words, done }
let skipLine = null;
function speakerOf(who) { return P[who === "jason" && S.scene === "memory" ? "memory" : who] || null; }
function sayLine(L) {
  return new Promise(resolve => {
    const words = L.t.split(" ");
    const c = CAST[L.who] || { name: "" };
    whoEl.textContent = c.name || ""; tagEl.textContent = c.tag || ""; tagEl.hidden = !c.tag;
    capEl.classList.toggle("is-thought", L.who === "you");
    capEl.classList.toggle("is-me", L.who === "jason");
    saidEl.innerHTML = words.map(w => "<i>" + E(w) + "</i>").join(" ");
    capEl.hidden = false; requestAnimationFrame(() => capEl.classList.add("is-on"));
    const sp = speakerOf(L.who);
    const base = { L, t: 0, dur: FAST ? 0.05 : 1.1 + L.t.length * 0.052, audio: null, words: null, resolve, sp };
    line = base;
    if (sp) { sp.talk = L.who === "you" ? 0 : 1; sp.nod = 1; sp.brow = /\?$/.test(L.t) ? 1 : 0; }
    if (L.who === "phone" || L.who === "agent" || L.who === "caller") { if (P.jason) P.jason.lookAtP = null; }
    shotFor(L);
    // voices only with the score on; my lines once they exist in my voice
    const id = L.who === "jason" ? "jason-" + L.id : L.id;
    const voiced = L.who !== "you" && soundOn() && !FAST && (L.who === "jason" ? have.me[id] : have.fict[id]);
    if (voiced) {
      const a = new Audio(); a.preload = "auto"; a.src = VBASE + "/" + id + ".mp3"; a.volume = 0.96;
      a.addEventListener("loadedmetadata", () => { if (line === base && a.duration) base.dur = a.duration + 0.35; });
      a.addEventListener("ended", () => { if (line === base) base.dur = Math.min(base.dur, base.t + 0.3); });
      const p = a.play(); if (p && p.catch) p.catch(() => {});
      base.audio = a; if (SC() && SC().voice) SC().voice(true);
      fetch(VBASE + "/" + id + ".json").then(r => (r.ok ? r.json() : null)).then(j => { if (j && line === base) base.words = j.words; }).catch(() => {});
    } else $$("i", saidEl).forEach(w => w.classList.add("is-said"));
    const sr = $(".st-sr", el) || (() => { const s = document.createElement("p"); s.className = "st-sr vh"; s.setAttribute("aria-live", "polite"); el.appendChild(s); return s; })();
    sr.textContent = (c.name ? c.name + ": " : "") + L.t;
  });
}
function endLine(skipped) {
  if (!line) return;
  const L = line;
  if (L.audio) { try { L.audio.pause(); } catch (e) {} if (SC() && SC().voice) SC().voice(false); }
  if (L.sp) { L.sp.talk = 0; L.sp.brow = 0; }
  line = null;
  capEl.classList.remove("is-on");
  L.resolve(skipped);
}
function tickLine(dt) {
  if (!line) return;
  line.t += dt;
  const a = line.audio, now = a && !a.paused ? a.currentTime : line.t;
  if (line.audio) {
    const spans = $$("i", saidEl);
    if (line.words) spans.forEach((s, i) => s.classList.toggle("is-said", line.words[i] && now >= line.words[i].s - 0.02));
    else { const n = Math.floor(spans.length * Math.min(1, now / Math.max(0.5, line.dur - 0.5))); spans.forEach((s, j) => s.classList.toggle("is-said", j < n)); }
    // the mouth follows the voice: open on words, rest between them
    if (line.sp && line.words) { const w = line.words.find(w => now >= w.s && now <= w.e + 0.04); line.sp.talk = w ? 1 : 0.15; }
  } else if (line.sp && line.L.who !== "you") line.sp.talk = line.t < line.dur - 0.5 ? 1 : 0;
  if (line.t > line.dur) endLine(false);
}

/* ---------- choices ---------- */
let choosing = null;
let chHide = [];
function choose(T0) {
  const list = (T0.choices || []).filter(c => cond(c.if));
  chHide.forEach(clearTimeout); chHide = [];
  return new Promise(resolve => {
    choicesOl.innerHTML = list.map((c, i) => '<li><button type="button" class="st-ch" data-i="' + i + '"><kbd aria-hidden="true">' + (i + 1) + "</kbd><span>" + E(c.t) + "</span></button></li>").join("");
    choicesEl.hidden = false; requestAnimationFrame(() => choicesEl.classList.add("is-on")); el.classList.add("has-choices");
    choicesEl.setAttribute("aria-label", "Choose");
    const timed = T0.timed && !still() ? T0.timed : null;
    timerEl.hidden = !timed;
    choosing = { list, resolve, t: 0, timed, idx: 0 };
    shotChoices();
    setTimeout(() => { const b = $(".st-ch", choicesOl); if (b && !COARSE.matches) b.focus({ preventScroll: true }); }, 60);
  });
}
function pick(i, how) {
  if (!choosing) return;
  const c = choosing.list[i]; if (!c) return;
  const res = choosing.resolve; choosing = null;
  const b = $$(".st-ch", choicesOl)[i]; if (b) b.classList.add("is-picked");
  FX("choice");
  T("story_choice", { scene: S.scene, talk: S.talking, choice: i, text: c.t, how: how || "" });
  // a choice that leads straight to more choices cancels these, so the new ones never vanish under it
  chHide.push(setTimeout(() => { choicesEl.classList.remove("is-on"); el.classList.remove("has-choices"); chHide.push(setTimeout(() => { choicesEl.hidden = true; }, 260)); }, 180));
  res(c);
}
choicesEl.addEventListener("click", e => { const b = e.target.closest(".st-ch"); if (b) pick(+b.dataset.i, "click"); });
function tickChoices(dt) {
  if (!choosing || !choosing.timed) return;
  choosing.t += dt;
  const f = choosing.t / choosing.timed.s; $("i", timerEl).style.transform = "scaleX(" + clamp(1 - f, 0, 1) + ")";
  if (f >= 1) pick(choosing.timed.default || 0, "timer");
}

/* ---------- notices, toasts, objectives ---------- */
let noteT = null;
function notice(text) {
  $("span", noteEl).textContent = text; noteEl.hidden = false; noteEl.classList.remove("is-on"); void noteEl.offsetWidth; noteEl.classList.add("is-on");
  hap("tap"); if (SC()) SC().tick && SC().tick();
  clearTimeout(noteT); noteT = setTimeout(() => { noteEl.classList.remove("is-on"); setTimeout(() => (noteEl.hidden = true), 500); }, FAST ? 200 : 3600);
  S.log.push({ note: text });
}
let toastT = null;
function toast(text) { toastEl.textContent = text; toastEl.hidden = false; toastEl.classList.add("is-on"); clearTimeout(toastT); toastT = setTimeout(() => { toastEl.classList.remove("is-on"); setTimeout(() => (toastEl.hidden = true), 400); }, FAST ? 200 : 2200); }
function objective(k) {
  S.obj = k; const t = k && D.objectives[k];
  if (!t) { objEl.classList.remove("is-on"); setTimeout(() => { if (!S.obj) objEl.hidden = true; }, 400); return; }
  objEl.textContent = t; objEl.hidden = false; objEl.classList.remove("is-on"); void objEl.offsetWidth; objEl.classList.add("is-on");
}
const trophyQ = [];
function trophy(slug) {
  if (!LIB || !LIB.trophies[slug]) return;
  const ok = window.JG_GAME && window.JG_GAME.unlock ? window.JG_GAME.unlock(slug, "story") : false;
  if (!S.trophies.includes(slug)) S.trophies.push(slug);
  if (!ok) return; // already earned: no second celebration
  trophyQ.push(slug); if (trophyQ.length === 1) showTrophy();
  // every medal earns the platinum
  const all = Object.keys(LIB.trophies).filter(s => s !== LIB.platinum);
  let seen = {}; try { (JSON.parse(store.get("jg_trophies") || "[]")).forEach(s => (seen[s] = 1)); } catch (e) {}
  if (all.every(s => seen[s]) && window.JG_GAME.unlock(LIB.platinum, "story")) { trophyQ.push(LIB.platinum); }
}
function showTrophy() {
  const slug = trophyQ[0]; if (!slug) return;
  const t = LIB.trophies[slug];
  trophyEl.innerHTML = '<img src="assets/game/medals/' + slug + '-160.webp" alt="" width="56" height="56" /><div><p class="st-trophy__k">' + E(t.tier.charAt(0).toUpperCase() + t.tier.slice(1)) + ' trophy</p><p class="st-trophy__h">' + E(t.name) + '</p><p class="st-trophy__p">' + E(t.desc) + "</p></div>";
  trophyEl.hidden = false; trophyEl.classList.remove("is-on"); void trophyEl.offsetWidth; trophyEl.classList.add("is-on");
  hap("success"); if (SC()) SC().sting("trophy-" + t.tier);
  setTimeout(() => { trophyEl.classList.remove("is-on"); setTimeout(() => { trophyEl.hidden = true; trophyQ.shift(); if (trophyQ.length) showTrophy(); }, 450); }, FAST ? 250 : 4200);
}

/* ================================================================
   PEOPLE IN THE SCENES
   ================================================================ */
async function person(key, name) {
  if (P[key]) return P[key];
  const p = await cast.make(name + "-" + VER);
  p.key = key; world.add(p.group);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), blobMat(0.55)); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015; sh.layers.set(2); world.add(sh); p.shadow = sh;
  P[key] = p; return p;
}
function place(p, v, yaw) { if (!p) return; p.pos.copy(v); p.yaw = p.wantYaw = yaw || 0; p.group.visible = true; p.speed = 0; p.path = null; }
function hide(p) { if (p) { p.group.visible = false; if (p.shadow) p.shadow.visible = false; } }

/* ================================================================
   SCENES
   ================================================================ */
const SCENE_LIGHT = {
  lot: { sky: "#1f2724", ground: "#0c0c0b", moon: "#2e2c27", rim: "#7d7565", fog: "#0b1115", den: 0.028, wetAll: 0.75, sat: 1, moonDir: [-0.4, 0.7, -0.55] },
  decision: { sky: "#222a27", ground: "#0d0d0c", moon: "#302e29", rim: "#817968", fog: "#0d1418", den: 0.022, wetAll: 0.65, sat: 1, moonDir: [-0.4, 0.7, -0.55] },
  office: { sky: "#33363a", ground: "#1c1a17", moon: "#2a2927", rim: "#6b6a62", fog: "#141618", den: 0.01, wetAll: 0.25, sat: 1, moonDir: [0.3, 0.8, 0.5] },
  memory: { sky: "#463c34", ground: "#1d1712", moon: "#4a3826", rim: "#7c6a58", fog: "#1a1612", den: 0.014, wetAll: 0.2, sat: 0.85, moonDir: [0.2, 0.8, -0.6] },
  keys: { sky: "#9db1c2", ground: "#5e564a", moon: "#ffe7c2", rim: "#cfd9e2", fog: "#c9cfcf", den: 0.006, wetAll: 0.0, sat: 1, moonDir: [0.55, 0.6, 0.45] }
};
function lightScene(name) {
  const L = SCENE_LIGHT[name];
  U.uSky.value.set(L.sky); U.uGround.value.set(L.ground); U.uMoon.value.set(L.moon); U.uRim.value.set(L.rim); U.uFog.value.set(L.fog); U.uFogDen.value = L.den; U.uWetAll.value = L.wetAll; U.uSat.value = L.sat;
  U.uMoonDir.value.set(...L.moonDir).normalize();
  if (name === "keys") { U.uMoon.value.multiplyScalar(1.5); }
}
let set = null, rain = null;
function makeRain() {
  const n = quality >= 2 ? 800 : 420;
  const g = new THREE.InstancedBufferGeometry(); g.instanceCount = n;
  g.setAttribute("position", new THREE.Float32BufferAttribute([-0.0025, 0, 0, 0.0025, 0, 0, 0.0025, 1, 0, -0.0025, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  const seed = new Float32Array(n * 4); for (let i = 0; i < n; i++) { seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = 0.7 + Math.random() * 0.6; }
  g.setAttribute("seed", new THREE.InstancedBufferAttribute(seed, 4));
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, uCam: { value: new THREE.Vector3() }, uK: { value: 1 } },
    vertexShader: `attribute vec4 seed; uniform vec3 uCam; uniform float uTime; uniform vec4 uLampPos[8]; uniform vec4 uLampCol[8]; uniform int uLampN; varying float vL; varying float vA;
      void main(){ vec3 box = vec3(22.0, 12.0, 22.0); vec3 p = vec3(seed.x, fract(seed.y - uTime * 0.85 * seed.w), seed.z) * box - box * 0.5; p.y += 4.0;
        p.xz = uCam.xz + mod(p.xz - uCam.xz + box.xz * 0.5, box.xz) - box.xz * 0.5; p.x += position.y * 0.05;
        float len = 0.35 * seed.w; vec3 wp = vec3(p.x + position.x, p.y + position.y * len, p.z);
        vec3 cdir = normalize(wp - cameraPosition); vec3 side = normalize(cross(cdir, vec3(0.0, 1.0, 0.0))); wp = vec3(p.x, p.y + position.y * len, p.z) + side * position.x * 3.0;
        float l = 0.05; for (int i = 0; i < 8; i++) { if (i >= uLampN) break; float d = length(uLampPos[i].xyz - wp); l += max(0.0, 1.0 - d / (uLampPos[i].w * 0.6)) * length(uLampCol[i].rgb) * 0.6; }
        vL = l; vA = smoothstep(2.5, 6.0, length(wp - cameraPosition)) * smoothstep(20.0, 8.0, length(wp - cameraPosition));
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`,
    fragmentShader: `uniform float uK; varying float vL; varying float vA; void main(){ gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * vL * 0.34 * uK * vA, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.layers.set(3); return mesh;
}

async function enter(name, o = {}) {
  const prev = S.scene;
  S.scene = name; S.phase = "cinematic";
  S.visited = S.visited || {}; S.visited[name] = 1;
  Object.values(sets).forEach(s => (s.visible = false));
  set = getSet(name); set.visible = true;
  lightScene(name);
  applyGrade(post, GRADES[name]);
  ringOn = false;
  // who is here
  for (const k of Object.keys(P)) hide(P[k]);
  const M = set.userData.marks;
  if (name === "lot") {
    await person("you", "player"); await person("jason", "jason"); await person("dell", "dell");
    place(P.you, M.playerStart, Math.PI); place(P.jason, M.jason, M.jasonYaw); place(P.dell, M.dell, M.dellYaw);
    P.dell.hold = "umbrella"; if (P.dell.umbrella) P.dell.umbrella.visible = true;
    if (S.flags.met) { place(P.you, set.userData.spots.door.stand.clone().add(new THREE.Vector3(-1.5, 0, 2.5)), Math.PI); }
    set.userData.gate.position.x = -3.2;
  } else if (name === "office") {
    await person("you", "player"); await person("jason", "jason"); await person("renata", "renata");
    place(P.you, M.playerStart, M.playerYaw); place(P.jason, M.jason, M.jasonYaw); place(P.renata, M.renata, M.renataYaw); P.renata.pose = "sit";
    if (arcadeV) { const pr = arcadeV.play(); if (pr && pr.catch) pr.catch(() => {}); }
    if (S.flags.desked) place(P.you, new THREE.Vector3(-0.5, 0, 0.4), Math.PI);
  } else if (name === "memory") {
    await person("memory", "jason-memory");
    place(P.memory, M.playerStart, M.playerYaw);
  } else if (name === "keys") {
    await person("jason", "jason");
    place(P.jason, new THREE.Vector3(10.2, 0, -12.6), Math.PI * 0.9);
  } else if (name === "decision") {
    await person("you", "player"); await person("jason", "jason"); await person("dell", "dell");
    place(P.you, M.decisionPlayer, Math.PI * 0.9); place(P.jason, M.decisionJason, Math.PI * 0.2); place(P.dell, M.dellGate, Math.PI);
    P.dell.hold = "umbrella";
    set.userData.gate.position.x = S.flags.gate === "helped" ? 3.2 : -0.6;
  }
  for (const p of Object.values(P)) if (p.shadow) p.shadow.visible = p.group.visible;
  me = name === "memory" ? P.memory : name === "keys" ? P.jason : P.you;
  if (name === "decision" && S.obj === "keys") objective(null);
  // the rain: hard on the lot, gentler at the end, none inside or in the morning
  if (!rain) { rain = makeRain(); scene.add(rain); }
  rain.visible = name === "lot" || name === "decision";
  rain.material.uniforms.uK.value = name === "decision" ? 0.55 : 1;
  if (set.userData.groundMat) set.userData.groundMat.uniforms.uRain.value = name === "decision" ? 0.5 : name === "keys" ? 0 : 1;
  rainLevel(name === "lot" ? 0.32 : name === "decision" ? 0.18 : name === "office" ? 0.12 : 0, name === "office");
  // the desk lamp in the memory remembers what you chose
  if (S.scene === "decision" && S.flags.lamp === "off") { const l = sets.lot.userData.lamps[5]; if (l) { l.col = [0.6, 0.38, 0.18]; l.glow.material.uniforms.uK.value = 0.7; } }
  // the score: the title's layer for where you are
  if (SC() && SC().focus) SC().focus({ lot: "triple-j", decision: "triple-j", office: "lead-to-title", memory: "neuroscience", keys: "triple-j" }[name]);
  camState.yaw = me ? me.yaw + Math.PI : 0; camState.init = true;
  save();
  T("story_scene", { scene: name, from: prev || "" });
  if (!o.quiet) { FX("arrive"); await sceneCard(name); }
}
async function sceneCard(name) {
  const sc = D.scenes[name];
  $(".st-card__ep", cardEl).textContent = name === "lot" && !S.flags.met ? D.episode : "";
  $(".st-card__h", cardEl).textContent = sc.name; $(".st-card__sub", cardEl).textContent = sc.card;
  cardEl.hidden = false; cardEl.classList.remove("is-on"); void cardEl.offsetWidth; cardEl.classList.add("is-on");
  await sleep(2600);
  cardEl.classList.remove("is-on"); await sleep(500); cardEl.hidden = true;
}
async function fade(to, ms = 600, col) { fadeEl.style.background = col || "#000"; fadeEl.style.transitionDuration = (FAST ? 20 : still() ? Math.min(ms, 200) : ms) + "ms"; fadeEl.classList.toggle("is-on", to > 0); await sleep(ms + 30); }

/* ================================================================
   CAMERA: follow, conversation shots, rails
   ================================================================ */
let me = null;
const camState = { yaw: 0, pitch: 0.2, dist: 3.4, init: true, pos: new THREE.Vector3(), look: new THREE.Vector3(), mode: "follow", shot: null, rail: null, drag: 0 };
function headOf(p) { return p ? p.headWorld(new THREE.Vector3()) : new THREE.Vector3(); }
function shotFor(L) {
  if (S.phase === "close") return; // the close-up holds its frame while the notes are read
  if (S.phase !== "talk") return;
  const sp = speakerOf(L.who);
  const other = S.partner;
  const you = me;
  if (!you) return;
  const reduced = still();
  if (L.who === "you" || !sp || sp === you) {
    // your thought: a slow, wider shot over the shoulder toward what you're looking at
    const tgt = S.focusPoint || headOf(other) || headOf(you);
    const yh = headOf(you), dir = tgt.clone().sub(yh).setY(0).normalize();
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    camState.shot = { pos: yh.clone().addScaledVector(dir, -1.6).addScaledVector(side, 0.7).add(new THREE.Vector3(0, 0.25, 0)), look: tgt.clone().lerp(yh, 0.3), push: reduced ? 0 : 0.12 };
  } else if (L.who === "agent" || L.who === "caller") {
    const ph = sets.office.userData.spots.phone.p;
    camState.shot = { pos: ph.clone().add(new THREE.Vector3(0.9, 0.45, 0.9)), look: ph.clone(), push: reduced ? 0 : 0.08 };
  } else {
    // over your shoulder onto the speaker's face
    const sh = headOf(sp), yh = headOf(you);
    const dir = sh.clone().sub(yh).setY(0); const d = dir.length(); dir.normalize();
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    const flip = (S.shotFlip = !S.shotFlip) ? 1 : -1;
    const ots = d > 0.6 && d < 6 && Math.random() < 0.75;
    camState.shot = ots
      ? { pos: yh.clone().addScaledVector(dir, -0.75).addScaledVector(side, 0.42 * flip).add(new THREE.Vector3(0, 0.06, 0)), look: sh.clone().add(new THREE.Vector3(0, -0.04, 0)), push: reduced ? 0 : 0.1, focus: d + 0.75 }
      : { pos: sh.clone().addScaledVector(dir, -1.35).addScaledVector(side, 0.35 * flip).add(new THREE.Vector3(0, 0.02, 0)), look: sh.clone().add(new THREE.Vector3(0, -0.06, 0)), push: reduced ? 0 : 0.06, focus: 1.35 };
  }
  camState.shotT = 0; camState.cut = true;
}
function shotChoices() {
  const you = me, other = S.partner;
  if (!you) return;
  const a = headOf(you), b = other ? headOf(other) : (S.focusPoint || a.clone().add(new THREE.Vector3(0, 0, -1)));
  const mid = a.clone().lerp(b, 0.5), dir = b.clone().sub(a).setY(0).normalize(), side = new THREE.Vector3(dir.z, 0, -dir.x);
  const span = Math.max(1.2, a.distanceTo(b)), dist = span * 1.25 + 0.8;
  // try both sides and a few angles; keep the frame whose sight lines miss the lamp poles and the walls
  let best = null, bestScore = Infinity;
  for (const sg of [1, -1]) for (const ang of [0, 0.3, -0.3, 0.6, -0.6]) {
    const c = Math.cos(ang), s = Math.sin(ang), d = new THREE.Vector3(side.x * c - side.z * s, 0, side.x * s + side.z * c).multiplyScalar(sg);
    const pos = mid.clone().addScaledVector(d, dist);
    const score = Math.abs(ang) * 2 + (sg < 0 ? 0.4 : 0) + framePenalty(pos, [a, b, mid]);
    if (score < bestScore) { bestScore = score; best = pos; }
  }
  camState.shot = { pos: best.add(new THREE.Vector3(0, 0.15, 0)), look: mid.clone().add(new THREE.Vector3(0, -0.12, 0)), push: still() ? 0 : 0.05, focus: dist };
  camState.shotT = 0; camState.cut = true;
}
/* how badly a camera at pos would be blocked looking at the points: a pole near a sight line, a wall across it, a camera inside one */
function segDist(px, pz, ax, az, bx, bz) { const vx = bx - ax, vz = bz - az, l = vx * vx + vz * vz || 1, t = clamp(((px - ax) * vx + (pz - az) * vz) / l, 0, 1); return Math.hypot(ax + vx * t - px, az + vz * t - pz); }
function framePenalty(pos, pts) {
  let pen = 0;
  const lamps = set.userData.lamps || [], walls = set.userData.walls || [];
  for (const l of lamps) {
    if (l.fixed) continue;
    const px = l.p.x - 0.7, pz = l.p.z;
    for (const q of pts) { const d = segDist(px, pz, pos.x, pos.z, q.x, q.z); if (d < 0.7) pen += (0.7 - d) * 12; }
    // a pole standing in the gap between the two people, even far behind them, splits the frame
    const ang = (x, z) => Math.atan2(x - pos.x, z - pos.z), wrap = v => Math.atan2(Math.sin(v), Math.cos(v));
    const ga = ang(pts[0].x, pts[0].z), gb = wrap(ang(pts[1].x, pts[1].z) - ga), gp = wrap(ang(px, pz) - ga);
    const far = Math.hypot(px - pos.x, pz - pos.z);
    if (far < 30 && Math.abs(gb) > 0.01 && gp / gb > -0.15 && gp / gb < 1.15) pen += 3;
  }
  for (const w of walls) {
    if (pos.x > w.x0 - 0.3 && pos.x < w.x1 + 0.3 && pos.z > w.z0 - 0.3 && pos.z < w.z1 + 0.3) pen += 20;
    for (const q of pts) {
      if (q.x > w.x0 && q.x < w.x1 && q.z > w.z0 && q.z < w.z1) continue;
      for (let i = 1; i < 8; i++) { const t = i / 8, x = pos.x + (q.x - pos.x) * t, z = pos.z + (q.z - pos.z) * t; if (x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1) { pen += 4; break; } }
    }
  }
  const bd = set.userData.bounds; if (bd && (pos.x < bd.x0 || pos.x > bd.x1 || pos.z < bd.z0 || pos.z > bd.z1)) pen += 6;
  return pen;
}
const ray = new THREE.Raycaster();
function updateCamera(dt) {
  if (camState.view) { camera.position.copy(camState.view.p); camera.lookAt(camState.view.t); post.comp.u.uFocus.value = camState.view.p.distanceTo(camState.view.t); post.comp.u.uRange.value = camState.view.r || 6; post.comp.u.uDofK.value = quality >= 2 ? 0.8 : 0; return; }
  const k = still() ? 1 : 1 - Math.exp(-6 * dt);
  if (camState.rail) {
    const r = camState.rail; r.t += dt / r.dur; const u = clamp(r.t, 0, 1), e = u * u * (3 - 2 * u);
    camera.position.copy(r.pos.getPoint(e)); camState.look.copy(r.look.getPoint(e)); camera.lookAt(camState.look);
    post.comp.u.uFocus.value = camera.position.distanceTo(camState.look);
    if (u >= 1 && r.done) { const d = r.done; r.done = null; d(); }
    return;
  }
  if ((S.phase === "talk" || S.phase === "close") && camState.shot) {
    const s = camState.shot; camState.shotT += dt;
    const push = s.push * Math.min(1, camState.shotT / 4);
    const pos = s.pos.clone().lerp(s.look, push);
    if (camState.cut) { camera.position.copy(pos); camState.look.copy(s.look); camState.cut = false; }
    else { camera.position.lerp(pos, 1 - Math.exp(-3 * dt)); camState.look.lerp(s.look, 1 - Math.exp(-3 * dt)); }
    camera.lookAt(camState.look);
    post.comp.u.uFocus.value = s.focus || camera.position.distanceTo(camState.look); post.comp.u.uRange.value = 1.6; post.comp.u.uDofK.value = quality >= 2 ? 0.9 : 0;
    return;
  }
  if (!me) return;
  post.comp.u.uDofK.value = quality >= 2 ? 0.45 : 0; post.comp.u.uRange.value = 9;
  const head = me.pos.clone().add(new THREE.Vector3(0, me.height * 0.86, 0));
  // drift behind the walker unless the visitor is steering the camera
  if (me.speed > 0.4 && camState.drag <= 0) camState.yaw += angTo(camState.yaw, me.yaw + Math.PI) * (1 - Math.exp(-1.6 * dt));
  camState.drag -= dt;
  const inside = S.scene === "office" || S.scene === "memory";
  const mem = S.scene === "memory";
  let dist = mem ? 1.85 : inside ? 2.7 : 3.6; const pitch = camState.pitch + (mem ? -0.06 : inside ? 0.08 : 0);
  const off = new THREE.Vector3(Math.sin(camState.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(camState.yaw) * Math.cos(pitch));
  // keep the camera inside the room; in the memory it sits close, over your right shoulder
  const want = head.clone().addScaledVector(off, dist);
  const shoulder = mem ? new THREE.Vector3(Math.cos(camState.yaw), 0, -Math.sin(camState.yaw)).multiplyScalar(0.55) : null;
  if (mem) want.add(shoulder);
  const b = set.userData.bounds;
  if (b) { want.x = clamp(want.x, b.x0 + 0.2, b.x1 - 0.2); want.z = clamp(want.z, b.z0 + 0.2, b.z1 - 0.2); want.y = Math.min(want.y, 2.85); }
  else {
    // outside, the camera never ends up inside a parked car or a wall: it comes in along the line to your head
    const walls = set.userData.walls || [];
    for (let i = 1; i <= 12; i++) {
      const t = i / 12, x = head.x + (want.x - head.x) * t, y = head.y + (want.y - head.y) * t, z = head.z + (want.z - head.z) * t;
      if (y < 1.8 && walls.some(w => x > w.x0 - 0.25 && x < w.x1 + 0.25 && z > w.z0 - 0.25 && z < w.z1 + 0.25)) { const tt = Math.max(0.3, t - 0.12); want.copy(head).lerp(want, tt); want.y = Math.max(want.y, head.y + 0.25); break; }
    }
  }
  if (camState.init) { camera.position.copy(want); camState.look.copy(head); camState.init = false; }
  if (shoulder) head.add(shoulder).add(new THREE.Vector3(0, -0.15, 0));
  camera.position.lerp(want, k); camState.look.lerp(head.add(new THREE.Vector3(0, -0.1, 0)), k);
  camera.lookAt(camState.look);
  post.comp.u.uFocus.value = camera.position.distanceTo(camState.look);
}
function rail(points, looks, dur) {
  return new Promise(res => {
    camState.rail = { pos: new THREE.CatmullRomCurve3(points), look: new THREE.CatmullRomCurve3(looks), t: 0, dur: FAST ? 0.2 : still() ? Math.min(dur, 2) : dur, done: () => { camState.rail = null; res(); } };
  });
}

/* ================================================================
   MOVEMENT: keys, stick, tap to walk; walls; footsteps
   ================================================================ */
const keys = {};
const mv = { x: 0, z: 0, run: false, target: null, after: null };
function blocked(x, z, r = 0.28) {
  for (const w of set.userData.walls) if (x > w.x0 - r && x < w.x1 + r && z > w.z0 - r && z < w.z1 + r) return true;
  const b = set.userData.bounds; if (b && (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1)) return true;
  for (const k of Object.keys(P)) { const p = P[k]; if (p === me || !p.group.visible) continue; if (Math.hypot(p.pos.x - x, p.pos.z - z) < 0.55) return true; }
  return false;
}
let stepPh = 0;
function moveMe(dt) {
  if (!me) return;
  let ix = 0, iz = 0;
  const free = S.phase === "explore";
  if (free) {
    ix = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0) + mv.x;
    iz = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0) + mv.z;
    const pad = padState(); ix += pad.x; iz += pad.y;
  }
  let speed = 0, dir = null;
  const run = keys.shift || mv.run;
  if (Math.hypot(ix, iz) > 0.12) {
    mv.target = null; mv.after = null;
    const a = Math.atan2(ix, iz) + camState.yaw; // camera relative
    dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    speed = (run ? 2.6 : 1.45) * Math.min(1, Math.hypot(ix, iz));
  } else if (mv.target) {
    const d = mv.target.clone().sub(me.pos).setY(0); const L = d.length();
    if (L < 0.12) { mv.target = null; const f = mv.after; mv.after = null; if (f) f(); }
    else { dir = d.normalize(); speed = Math.min(L * 2.2, run ? 2.6 : 1.45); }
  }
  if (dir && speed > 0) {
    me.wantYaw = Math.atan2(dir.x, dir.z);
    const turn = Math.abs(angTo(me.yaw, me.wantYaw));
    const sp = speed * (turn > 1.6 ? 0.25 : 1);
    let nx = me.pos.x + dir.x * sp * dt, nz = me.pos.z + dir.z * sp * dt;
    if (!blocked(nx, nz)) { me.pos.x = nx; me.pos.z = nz; }
    else if (!blocked(nx, me.pos.z)) me.pos.x = nx;
    else if (!blocked(me.pos.x, nz)) me.pos.z = nz;
    else if (mv.target) { mv.target = null; const f = mv.after; mv.after = null; if (f) f(); }
    me.speed = damp(me.speed, sp, 10, dt);
  } else me.speed = damp(me.speed, 0, 12, dt);
  // footsteps on the beat of the walk
  const ph = Math.floor(me.phase / Math.PI);
  if (ph !== stepPh && me.speed > 0.3) { stepPh = ph; step(S.scene === "lot" || S.scene === "decision"); }
}
function walkTo(v, then) { mv.target = v.clone().setY(0); mv.after = then || null; }

/* ---------- gamepad ---------- */
let padPrev = {};
function padState() {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null;
  if (!gp) return { x: 0, y: 0 };
  const ax = Math.abs(gp.axes[0]) > 0.18 ? gp.axes[0] : 0, ay = Math.abs(gp.axes[1]) > 0.18 ? gp.axes[1] : 0;
  const rx = Math.abs(gp.axes[2] || 0) > 0.2 ? gp.axes[2] : 0;
  if (rx) { camState.yaw -= rx * 0.04; camState.drag = 1.5; }
  const btn = i => gp.buttons[i] && gp.buttons[i].pressed;
  const edge = i => btn(i) && !padPrev[i];
  if (edge(0)) act("a"); if (edge(1)) act("b"); if (edge(9)) act("pause"); if (edge(3)) act("journal");
  if (choosing) { if (edge(12)) moveChoice(-1); if (edge(13)) moveChoice(1); }
  padPrev = {}; gp.buttons.forEach((b, i) => (padPrev[i] = b.pressed));
  return { x: ax, y: ay };
}
function moveChoice(d) { const bs = $$(".st-ch", choicesOl); const i = bs.indexOf(document.activeElement); const n = clamp((i < 0 ? 0 : i + d), 0, bs.length - 1); if (bs[n]) { bs[n].focus({ preventScroll: true }); if (SC()) SC().tick(); } }

/* ================================================================
   INTERACTION: spots, prompts, talking
   ================================================================ */
function spotsHere() {
  const out = [];
  for (const [id, o] of Object.entries(OBJ)) {
    const sceneOk = o.scene === S.scene || (o.scene === "lot" && S.scene === "lot");
    if (!sceneOk) continue;
    if (o.if && !cond(o.if)) continue;
    if (o.once && S.looked[id] && !o.again) continue;
    const sp = set.userData.spots[id]; if (!sp) continue;
    let p = sp.p;
    if (sp.who) { const who = P[sp.who]; if (!who || !who.group.visible) continue; p = headOf(who).add(new THREE.Vector3(0, -0.15, 0)); }
    out.push({ id, o, sp, p });
  }
  if (S.scene === "decision") return out.filter(s => s.id === "jason-end");
  return out;
}
let near = null;
const v2 = new THREE.Vector3();
function project(p) { v2.copy(p).project(camera); return { x: (v2.x * 0.5 + 0.5) * innerWidth, y: (-v2.y * 0.5 + 0.5) * innerHeight, on: v2.z < 1 && Math.abs(v2.x) < 1.05 && Math.abs(v2.y) < 1.05 }; }
function updatePrompts() {
  if (S.phase !== "explore" || !me) { promptEl.hidden = true; dotsEl.innerHTML = ""; near = null; return; }
  const list = spotsHere();
  let best = null, bd = 1e9;
  for (const s of list) {
    const d = Math.hypot(s.p.x - me.pos.x, s.p.z - me.pos.z);
    const r = s.sp.r || 2;
    // facing matters a little: things in front of you win ties
    const a = Math.abs(angTo(me.yaw, Math.atan2(s.p.x - me.pos.x, s.p.z - me.pos.z)));
    const score = d + a * 0.35;
    if (d < r && score < bd) { best = s; bd = score; }
  }
  near = best;
  // faint dots on what's interactable nearby; the nearest gets the full prompt
  let html = "";
  for (const s of list) {
    if (s === best) continue;
    const d = Math.hypot(s.p.x - me.pos.x, s.p.z - me.pos.z); if (d > 11) continue;
    const q = project(s.p); if (!q.on) continue;
    html += '<button type="button" class="st-dot" data-spot="' + s.id + '" style="transform:translate(' + q.x.toFixed(0) + "px," + q.y.toFixed(0) + 'px)" aria-label="' + E(s.o.verb + " " + s.o.label) + '"><i></i></button>';
  }
  dotsEl.innerHTML = html;
  if (!best) { promptEl.hidden = true; return; }
  const q = project(best.p);
  // a thing above or beside the frame (the pylon sign seen up close on a phone) keeps its prompt at the edge of the screen
  if (v2.z >= 1) { q.x = innerWidth / 2 - 60; q.y = 90; }
  q.x = clamp(q.x, 24, innerWidth - 200); q.y = clamp(q.y, 84, innerHeight - 110);
  promptEl.hidden = false;
  $(".st-prompt__verb", promptEl).textContent = best.o.verb; $(".st-prompt__label", promptEl).textContent = best.o.label;
  $(".st-prompt__key", promptEl).hidden = COARSE.matches;
  promptEl.dataset.spot = best.id;
  promptEl.style.transform = "translate(" + Math.round(q.x) + "px," + Math.round(q.y) + "px)";
}
promptEl.addEventListener("click", e => { e.stopPropagation(); if (near) interact(near.id, "click"); });
dotsEl.addEventListener("click", e => { const b = e.target.closest("[data-spot]"); if (!b) return; e.stopPropagation(); goInteract(b.dataset.spot); });
function goInteract(id) {
  const s = spotsHere().find(x => x.id === id); if (!s) return;
  const stand = s.sp.stand || (s.sp.who ? P[s.sp.who].pos.clone().add(me.pos.clone().sub(P[s.sp.who].pos).setY(0).normalize().multiplyScalar(1.2)) : s.p);
  walkTo(stand, () => interact(id, "walk"));
}
async function interact(id, how) {
  if (S.phase !== "explore") return;
  const o = OBJ[id]; if (!o) return;
  const s = set.userData.spots[id] || {};
  mv.target = null;
  if (o.go) { FX("arrive"); T("story_object", { id, scene: S.scene }); await travel(o.go); return; }
  const first = !S.looked[id];
  S.looked[id] = (S.looked[id] || 0) + 1;
  T("story_object", { id, scene: S.scene, first });
  FX("arrive");
  // face it, and let whoever it is face you
  const target = s.who ? P[s.who] : null;
  const tp = target ? target.pos : s.p;
  if (tp) me.wantYaw = Math.atan2(tp.x - me.pos.x, tp.z - me.pos.z);
  S.partner = target || (S.scene === "office" && ["cabinet", "laptop", "ledger", "board", "book"].includes(id) ? P.jason : S.scene === "lot" && id === "sold" ? P.jason : null);
  S.focusPoint = s.p || null;
  const talk = !first && o.again ? o.again : o.talk;
  if (s.close) return;
  await runTalk(talk);
}
async function runTalk(id) {
  S.phase = "talk"; promptEl.hidden = true; dotsEl.innerHTML = ""; objEl.classList.add("is-dim");
  el.classList.add("is-talking");
  const partner = S.partner;
  if (partner && me) { partner.lookAtP = headOf(me); me.lookAtP = headOf(partner); partner.wantYaw = Math.atan2(me.pos.x - partner.pos.x, me.pos.z - partner.pos.z); me.wantYaw = Math.atan2(partner.pos.x - me.pos.x, partner.pos.z - me.pos.z); }
  let cur = id;
  let guard = 0;
  while (cur && guard++ < 40) {
    const T0 = TALK[cur]; if (!T0) break;
    S.talking = cur;
    if (T0.branch) { const b = T0.branch.find(x => cond(x.if)); cur = b ? b.go : null; continue; }
    if (T0.set) Object.assign(S.flags, T0.set);
    for (const L of T0.lines || []) {
      if (!cond(L.if)) continue;
      await sayLine(L);
      if (!FAST) await sleep(120);
    }
    let next = T0.next || null;
    if (T0.choices) {
      const c = await choose(T0);
      if (c.set) Object.assign(S.flags, c.set);
      S.log.push({ talk: cur, choice: c.t });
      if (c.note) notice(c.note);
      if (c.hold && !FAST && !still()) await sleep(500);
      next = c.go || null;
    }
    for (const d of T0.do || []) { const r = await doAct(d); if (r) next = r; }
    if (S.ending) { cur = null; break; }
    cur = next;
  }
  S.talking = null;
  if (S.phase === "talk") endTalk();
}
function endTalk() {
  el.classList.remove("is-talking"); objEl.classList.remove("is-dim");
  capEl.classList.remove("is-on"); setTimeout(() => { if (!line) capEl.hidden = true; }, 300);
  for (const p of Object.values(P)) { if (p !== me) p.lookAtP = null; }
  if (me) me.lookAtP = null;
  camState.shot = null; S.partner = null; S.focusPoint = null;
  S.phase = "explore";
  camState.yaw = me ? me.yaw + Math.PI : camState.yaw;
  save();
  afterTalk();
}
async function doAct(d) {
  const [k, v] = d.split(/:(.*)/s);
  if (k === "unlock") trophy(v);
  else if (k === "journal") addJournal(v);
  else if (k === "obj") objective(v);
  else if (k === "flag") { const [a, b] = v.split("="); S.flags[a] = b === "1" ? 1 : b; }
  else if (k === "note") notice(v);
  else if (k === "goto") { await travel(v); }
  else if (k === "end") { await ending(v); }
  else if (k === "desk") { const ok = await openDesk(); if (!ok) S.flags.desk = "watched"; return ok ? "desk-filed" : "desk-watch"; }
  else if (k === "ring") { setTimeout(() => startRing(), FAST ? 50 : 3500); }
  else if (k === "close") { await closeUp(v); }
  else if (k === "lampoff") { const l = sets.memory && sets.memory.userData.deskLamp; if (l) l.col = [0.15, 0.1, 0.06]; }
  return null;
}
function afterTalk() {
  // the office: once the desk and the call are done, Jason points at the book
  if (S.scene === "office" && S.flags.desked && S.flags.called && !S.flags.hinted) setTimeout(() => { if (S.phase === "explore" && !S.flags.hinted) { S.partner = P.jason; runTalk("book-hint"); } }, FAST ? 50 : 2200);
  // the memory: pack the desk, then the lamp
  if (S.scene === "memory" && !S.flags.packed) {
    const pack = Object.entries(OBJ).filter(([, o]) => o.pack).map(([id]) => id);
    if (pack.every(id => S.looked[id])) { S.flags.packed = 1; objective(null); toast(D.objects["mem-lamp"].label); }
  }
}
function startRing() {
  if (S.scene !== "office") return;
  S.flags.ringing = 1; ringOn = true; ringT = 0; objective("phone");
  if (P.jason) { const m = set.userData.marks.jasonPhone; walkPerson(P.jason, m); }
}
function walkPerson(p, to) { p.path = to.clone(); }
function movePeople(dt) {
  for (const p of Object.values(P)) {
    if (p === me || !p.group.visible) continue;
    if (p.path) { const d = p.path.clone().sub(p.pos).setY(0), L = d.length(); if (L < 0.08) { p.path = null; p.speed = 0; } else { d.normalize(); p.wantYaw = Math.atan2(d.x, d.z); const sp = Math.min(1.3, L * 2); p.pos.addScaledVector(d, sp * dt); p.speed = damp(p.speed, sp, 8, dt); } }
    else p.speed = damp(p.speed, 0, 8, dt);
    // idle: turn to look at you when you're near
    if (S.phase === "explore" && me && !p.path) {
      const d = Math.hypot(me.pos.x - p.pos.x, me.pos.z - p.pos.z);
      p.lookAtP = d < 4.5 ? headOf(me) : null;
      if (d < 2.6 && p.pose !== "sit") p.wantYaw = Math.atan2(me.pos.x - p.pos.x, me.pos.z - p.pos.z);
    }
    if (p.shadow) p.shadow.position.set(p.pos.x, 0.015, p.pos.z);
  }
  if (me && me.shadow) me.shadow.position.set(me.pos.x, 0.015, me.pos.z);
}

/* ---------- travel between scenes ---------- */
async function travel(to) {
  S.phase = "cinematic"; promptEl.hidden = true; dotsEl.innerHTML = "";
  const memoryIn = to === "memory" || to === "keys";
  if (to === "memory") { fadeEl.classList.add("is-memory"); await fade(1, 1400, "#e9dfc8"); }
  else if (to === "keys") await fade(1, 1200, "#f3ead6");
  else if (S.scene === "keys") await fade(1, 1400, "#f3ead6");
  else await fade(1, 700);
  await enter(to, { quiet: true });
  await sleep(200);
  await fade(0, memoryIn ? 1400 : 700);
  fadeEl.classList.remove("is-memory");
  FX("arrive"); await sceneCard(to);
  const st = D.scenes[to].start;
  S.phase = "explore";
  if (st && TALK[st]) {
    S.partner = to === "office" ? P.jason : to === "decision" ? P.jason : null;
    await startTalk(to);
  }
}

/* a scene's opening talk; once it has run to its end, a Continue into that scene does not replay it */
async function startTalk(name) {
  const st = D.scenes[name].start; if (!st || !TALK[st]) return;
  await runTalk(st);
  if (S.open && S.scene === name) { S.flags["done-" + name] = 1; save(); }
}

/* ---------- the close-up: the whiteboard's three notes ---------- */
function closeUp(which) {
  return new Promise(resolve => {
    S.phase = "close"; el.classList.add("is-close");
    const sp = set.userData.spots[which];
    // on a narrow screen the camera steps back until the whole board fits across
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect), d0 = sp.cam.p.distanceTo(sp.cam.t), dist = Math.max(d0, 1.3 / Math.tan(half));
    const cpos = sp.cam.t.clone().add(sp.cam.p.clone().sub(sp.cam.t).normalize().multiplyScalar(dist));
    camState.shot = { pos: cpos, look: sp.cam.t.clone(), push: 0, focus: dist }; camState.cut = true; camState.shotT = 0;
    // you step out of your own way: the close-up is what you see
    if (me) me.group.visible = false;
    capEl.classList.remove("is-on");
    const ids = Object.keys(D.board_notes);
    const draw = () => {
      $(".st-close__spots", closeEl).innerHTML = ids.map(id => { const q = project(set.userData.spots[id].p), x = clamp(q.x, 84, innerWidth - 84); return '<button type="button" class="st-note-spot' + (S.looked[id] ? " is-read" : "") + '" data-note="' + id + '" style="left:' + x.toFixed(0) + "px;top:" + q.y.toFixed(0) + 'px"><span>' + E(D.board_notes[id]) + "</span></button>"; }).join("");
    };
    closeEl.hidden = false; setTimeout(draw, FAST ? 300 : 700);
    const onResize = () => draw(); addEventListener("resize", onResize); setTimeout(() => closeEl.classList.add("is-on"), 20);
    const onClick = async e => {
      const b = e.target.closest("[data-note]");
      if (b) {
        const id = b.dataset.note; FX("arrive"); S.looked[id] = 1; T("story_object", { id, scene: S.scene });
        closeEl.classList.add("is-busy");
        for (const L of TALK[id].lines) { if (cond(L.if)) await sayLine(L); }
        for (const d of TALK[id].do || []) await doAct(d);
        capEl.classList.remove("is-on"); closeEl.classList.remove("is-busy"); draw();
        if (ids.every(x => S.looked[x])) finish();
        return;
      }
      if (e.target.closest("[data-st='back']")) finish();
    };
    const finish = () => { closeEl.removeEventListener("click", onClick); removeEventListener("resize", onResize); if (me) me.group.visible = true; closeEl.classList.remove("is-on"); setTimeout(() => (closeEl.hidden = true), 300); el.classList.remove("is-close"); S.phase = "talk"; resolve(); };
    closeEl.addEventListener("click", onClick);
    S.closeFinish = finish;
  });
}

/* ---------- the desk: Handle a Sale on a phone, fictional buyer, example figures ---------- */
function openDesk() {
  return new Promise(resolve => {
    S.phase = "sheet"; sheetEl.hidden = false; requestAnimationFrame(() => sheetEl.classList.add("is-on"));
    const host = $("[data-desk-app]", sheetEl);
    if (!host.firstChild && window.JG_DESK) window.JG_DESK.build(host);
    let done = false;
    const iv = setInterval(() => {
      const on = $(".app-screen.is-on", host);
      if (on && /Filed/.test(on.getAttribute("aria-label") || on.textContent)) { done = true; finish(true); }
    }, 250);
    const finish = ok => { clearInterval(iv); sheetEl.classList.remove("is-on"); setTimeout(() => { sheetEl.hidden = true; }, 350); S.phase = "talk"; if (ok) FX("send"); resolve(ok); };
    $("[data-st='sheet-back']", sheetEl).onclick = () => { if (!done) finish(false); };
    S.deskFinish = finish;
  });
}

/* ================================================================
   JOURNAL: what you found, sketched; the people; trophies; your choices
   ================================================================ */
const sketches = {};
function addJournal(key) {
  if (S.journal.includes(key)) return;
  S.journal.push(key);
  toast(UI.journal + ": " + D.journal[key].h);
  try { sketch(key); } catch (e) {}
}
function sketch(key) {
  const J = D.journal[key]; if (!J || sketches[key]) return;
  let p = null, r = 0.5;
  const sp = set.userData.spots[J.sketch] || set.userData.spots[key];
  if (sp && sp.p) { p = sp.p.clone(); r = 0.55; }
  const who = { jason: P.jason, dell: P.dell, renata: P.renata }[J.sketch];
  if (who && who.group.visible) { p = headOf(who).add(new THREE.Vector3(0, -0.12, 0)); r = 0.32; }
  if (!p) return;
  const size = 256, rt = new THREE.WebGLRenderTarget(size, size);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
  const from = me ? me.pos.clone().setY(p.y + 0.15) : p.clone().add(new THREE.Vector3(0, 0, 2));
  const dir = from.clone().sub(p); dir.y = Math.max(dir.y, 0.2); dir.normalize();
  cam.position.copy(p).addScaledVector(dir, r / Math.tan(15 * Math.PI / 180)); cam.lookAt(p);
  cam.layers.set(0); cam.layers.enable(1);
  // only the subject: you and the others step out of the drawing
  const shown = Object.values(P).filter(q => q.group.visible && q !== who);
  shown.forEach(q => { q.group.visible = false; });
  const read = () => { const b = new Uint8Array(size * size * 4); renderer.readRenderTargetPixels(rt, 0, 0, size, size, b); return b; };
  // pass one, the forms: normals, on a clear background
  const was = scene.overrideMaterial; scene.overrideMaterial = new THREE.MeshNormalMaterial();
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
  scene.overrideMaterial = was; const px = read();
  // pass two, the marks: the lit scene, for lettering and the edges of printed things
  renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam); const lit = read();
  renderer.setRenderTarget(null); renderer.setClearColor(0x05070a, 1); rt.dispose();
  shown.forEach(q => { q.group.visible = true; });
  // pencil: edges where the normal turns or the tone steps, hatching where it faces away from a light up and to the left
  const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d"); const img = g.createImageData(size, size), d = img.data;
  const at = (x, y) => ((size - 1 - y) * size + x) * 4;
  const N = (x, y) => { const i = at(x, y); return [px[i] / 127.5 - 1, px[i + 1] / 127.5 - 1, px[i + 2] / 127.5 - 1]; };
  const Lm = (x, y) => { const i = at(x, y); return Math.log(1 + (lit[i] * 0.3 + lit[i + 1] * 0.59 + lit[i + 2] * 0.11)); };
  for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
    const bg = px[at(x, y) + 3] < 8;
    const n = N(x, y), a = N(x + 1, y), b = N(x, y + 1), e = Math.abs(n[0] - a[0]) + Math.abs(n[1] - a[1]) + Math.abs(n[0] - b[0]) + Math.abs(n[1] - b[1]) + Math.abs(n[2] - a[2]) + Math.abs(n[2] - b[2]);
    const l0 = Lm(x, y), te = Math.abs(l0 - Lm(x + 1, y)) + Math.abs(l0 - Lm(x, y + 1));
    const lam = clamp(-n[0] * 0.5 + n[1] * 0.6 + n[2] * 0.6, 0, 1);
    const hatch = !bg && lam < 0.55 && ((x + y) % 5 === 0 || (lam < 0.3 && (x - y + 400) % 6 === 0));
    let ink = clamp(e * 1.6, 0, 1) * 0.9 + clamp((te - 0.12) * 1.4, 0, 0.75) + (hatch ? 0.32 : 0);
    if (bg) ink = 0;
    ink = Math.min(ink, 1);
    const i = (y * size + x) * 4; const v = 233 - ink * 190;
    d[i] = v; d[i + 1] = v - 4; d[i + 2] = v - 14; d[i + 3] = ink > 0.06 ? Math.min(255, ink * 340) : 0;
  }
  g.putImageData(img, 0, 0);
  sketches[key] = c.toDataURL("image/png");
}
let jTab = "things";
function openJournal() {
  if (S.phase === "end" || S.phase === "load") return;
  S.prevPhase = S.phase === "journal" ? S.prevPhase : S.phase; S.phase = "journal";
  // after a Continue the drawings are gone; redraw the ones whose thing is in this scene
  for (const k of S.journal) if (!sketches[k] && D.journal[k] && OBJ[k] && OBJ[k].scene === S.scene) { try { sketch(k); } catch (e) {} }
  renderJournal(); journalEl.hidden = false; requestAnimationFrame(() => journalEl.classList.add("is-on"));
  FX("arrive");
}
function closeJournal() { journalEl.classList.remove("is-on"); setTimeout(() => (journalEl.hidden = true), 300); S.phase = S.prevPhase || "explore"; }
function renderJournal() {
  const people = ["jason", "dell", "renata"].filter(k => (k === "jason" && S.flags.met) || (k === "dell" && S.looked.dell) || (k === "renata" && S.flags.desked));
  const things = S.journal.filter(k => !["jason", "dell", "renata"].includes(k));
  const entry = k => { const J = D.journal[k]; const sk = sketches[k] || sketches[J.sketch]; return '<li class="jr-e">' + (sk ? '<img src="' + sk + '" alt="" />' : '<span class="jr-e__blank" aria-hidden="true"></span>') + "<div><h4>" + E(J.h) + (J.fictional ? ' <small>' + E(UI.fictional) + "</small>" : "") + "</h4><p>" + E(J.p) + "</p></div></li>"; };
  const tabs = [["things", UI.j_things], ["people", UI.j_people], ["trophies", UI.j_trophies], ["choices", UI.j_choices]];
  let inner = "";
  if (jTab === "things") inner = things.length ? '<ul class="jr-list">' + things.map(entry).join("") + "</ul>" : '<p class="jr-empty">' + E(UI.j_empty) + "</p>";
  else if (jTab === "people") inner = people.length ? '<ul class="jr-list">' + people.map(entry).join("") + "</ul>" : '<p class="jr-empty">' + E(UI.j_empty) + "</p>";
  else if (jTab === "trophies") inner = S.trophies.length ? '<ul class="jr-tro">' + S.trophies.map(s => { const t = LIB.trophies[s]; return '<li><img src="assets/game/medals/' + s + '-160.webp" alt="" width="48" height="48" /><div><b>' + E(t.name) + "</b><p>" + E(t.desc) + "</p></div></li>"; }).join("") + "</ul>" : '<p class="jr-empty">' + E(UI.j_empty) + "</p>";
  else inner = '<ul class="jr-ch">' + recapLines().map(t => "<li>" + E(t) + "</li>").join("") + "</ul>";
  journalEl.innerHTML = '<div class="jr"><header class="jr-h"><h3>' + E(UI.journal) + '</h3><nav class="jr-tabs" role="tablist">' + tabs.map(([k, l]) => '<button type="button" role="tab" aria-selected="' + (k === jTab) + '" data-tab="' + k + '">' + E(l) + "</button>").join("") + '</nav><button class="st-x" type="button" data-st="journal-close" aria-label="Close the journal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header><div class="jr-b">' + inner + "</div></div>";
}
journalEl.addEventListener("click", e => {
  const t = e.target.closest("[data-tab]"); if (t) { jTab = t.dataset.tab; renderJournal(); if (SC()) SC().tick(); return; }
  if (e.target.closest("[data-st='journal-close']") || e.target === journalEl) closeJournal();
});

/* ---------- recap ---------- */
function recapLines() {
  const R = D.recap, out = [], f = S.flags;
  if (f.said) out.push(R.why[f.said]);
  if (f.said === "deflect" && f.why && f.why !== "deflect") out.push(R.said_late);
  if (f.cluster && f.why === "hiring") out.push(R.cluster[f.cluster]);
  if (f.lot && f.why === "dealer") out.push(R.lot[f.lot]);
  if (f.dell) out.push(R.dell[f.dell]);
  if (f.gate) out.push(R.gate[f.gate]);
  if (f.desk) out.push(R.desk[f.desk]);
  if (f.phone) out.push(R.phone[f.phone]);
  if (f.lamp) out.push(R.lamp[f.lamp]);
  const things = Object.keys(S.looked).filter(k => OBJ[k] && !OBJ[k].who && !OBJ[k].go && !k.startsWith("note-")).map(k => OBJ[k].label.toLowerCase()).filter((t, i, a) => a.indexOf(t) === i);
  if (things.length) out.push(R.looked + " " + listOf(things.map(t => (/^(dell|jason|renata)$/i.test(t) ? t : (t.startsWith("the ") ? t : "the " + t)))) + ".");
  else out.push(R.none);
  return out.filter(Boolean);
}
function listOf(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }

/* ================================================================
   ENDINGS
   ================================================================ */
function readOf() {
  const pri = { build: ["board", "laptop", "cabinet", "desk", "phone"], ai: ["phone", "laptop", "board", "desk", "cabinet"], ops: ["cabinet", "ledger", "desk", "board", "phone"], sales: ["desk", "phone", "ledger", "laptop", "cabinet"] };
  const seen = k => (k === "phone" ? S.flags.called : k === "desk" ? S.flags.desk === "helped" : k === "board" ? ["note-rls", "note-valid", "note-migr"].filter(n => S.looked[n]).length >= 2 : S.looked[k]);
  const order = pri[S.flags.cluster] || ["board", "cabinet", "laptop", "phone", "desk"];
  return order.find(seen) || "";
}
async function ending(kind) {
  S.ending = kind; S.phase = "end";
  promptEl.hidden = true; dotsEl.innerHTML = ""; objective(null);
  T("story_ending", { ending: kind, role: S.flags.role || "", lot: S.flags.lot || "", why: S.flags.why || "" });
  // the ending's build: the card and the page for a role, the lot's card for a dealer
  let b = null;
  try {
    if (window.JG_BUILD) {
      if (kind === "hiring" && S.flags.role) b = window.JG_BUILD.make("role", S.flags.role, "story");
      else if (kind === "dealer" && S.flags.lot) b = window.JG_BUILD.make("lot", S.flags.lot, "story");
    }
  } catch (e) {}
  // a last look: the camera rises over the lot, the lamps on (or one out)
  if (!still() && me) { const h = headOf(me); await rail([camera.position.clone(), h.clone().add(new THREE.Vector3(3, 2.4, 5)), h.clone().add(new THREE.Vector3(6, 6, 12))], [camState.look.clone(), h.clone(), h.clone().add(new THREE.Vector3(-4, -1, -8))], 5); }
  if (SC()) SC().sting("level-clear"); hap("success");
  const E0 = D.endings[kind];
  const rec = recapLines();
  let acts = "";
  if (kind === "hiring" && b) acts += window.JG_BUILD.resume(b, "btn btn--primary") + '<button class="btn" type="button" data-st="save-card"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-share"/></svg>' + E(UI.save_card || "Save the card") + "</button>";
  if (kind === "dealer") acts += '<a class="btn btn--primary" href="/obavia.html#early" data-st="early">' + E(UI.early) + "</a>" + (b ? ((c => (/data-build-obavia/.test(c) ? "" : c))(window.JG_BUILD.lotCta(b, "btn", "story"))) : "");
  if (kind === "curious") acts += '<button class="btn btn--primary" type="button" data-st="run"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-pad"/></svg>' + E(UI.run) + "</button>";
  if (kind === "passing") acts += '<a class="btn btn--primary" href="' + E((LIB && LIB.pdf) || "assets/Jason_Obawemimo_Resume_2026.pdf") + '" download data-st="resume">' + E(UI.resume_pdf) + "</a>";
  acts += '<button class="btn ' + (acts ? "btn--ghost" : "btn--primary") + '" type="button" data-st="library">' + E(UI.enter) + "</button>";
  endEl.innerHTML = '<div class="en"><div class="en-l"><p class="en-k">' + E(UI.end_h) + '</p><h2 class="en-h">' + E(E0.name) + '</h2><p class="en-p">' + E(E0.line) + '</p><h3 class="en-r">' + E(UI.recap_h) + '</h3><ol class="en-list">' + rec.map(t => "<li>" + E(t) + "</li>").join("") + '</ol></div><div class="en-r2">' + (b && window.JG_BUILD ? '<div class="en-card">' + window.JG_BUILD.cardHTML(b) + "</div>" : "") + '<div class="en-acts">' + acts + "</div></div></div>";
  endEl.hidden = false; requestAnimationFrame(() => endEl.classList.add("is-on"));
  store.del("jg_story"); store.set("jg_story_end", kind);
  S.endBuild = b;
}
endEl.addEventListener("click", e => {
  const a = e.target.closest("[data-st]"); if (!a) return;
  const k = a.dataset.st;
  if (k === "library") { close("ending"); }
  else if (k === "run") { FX("choice"); close("run"); setTimeout(() => window.JG_GAME && window.JG_GAME.play("", "story"), 200); }
  else if (k === "save-card") { if (window.JG_BUILD && S.endBuild) window.JG_BUILD.save(S.endBuild, "story"); }
  else if (k === "early") { FX("send"); T("cta_click", { cta: "obavia_early", where: "story" }); }
  else if (k === "resume") { FX("send"); }
});

/* ================================================================
   PAUSE
   ================================================================ */
function pause() {
  if (S.phase === "end" || S.phase === "load" || S.phase === "pause") return;
  S.prevPhase = S.phase; S.phase = "pause";
  if (line && line.audio) line.audio.pause();
  const reached = ["lot", "office", "memory", "decision"].filter(n => S.visited && S.visited[n]);
  pauseEl.innerHTML = '<div class="pz"><h3 class="pz-h">' + E(UI.pause) + '</h3><ul class="pz-m">' +
    '<li><button type="button" data-p="resume">' + E(UI.resume) + "</button></li>" +
    '<li><button type="button" data-p="journal">' + E(UI.journal) + "</button></li>" +
    '<li><button type="button" data-p="sound" aria-pressed="' + soundOn() + '">' + E(UI.sound) + ": " + (soundOn() ? "On" : "Off") + "</button></li>" +
    (reached.length > 1 ? '<li class="pz-ch"><span>' + E(UI.chapters) + "</span>" + reached.map(n => '<button type="button" data-p="go" data-s="' + n + '">' + E(D.scenes[n].name) + "</button>").join("") + "</li>" : "") +
    '<li><button type="button" data-p="restart">' + E(UI.restart) + "</button></li>" +
    '<li><button type="button" data-p="library">' + E(UI.library) + "</button></li></ul>" +
    '<p class="pz-fine">' + E(D.voices_note) + " " + E(UI.captions) + "</p></div>";
  pauseEl.hidden = false; requestAnimationFrame(() => pauseEl.classList.add("is-on"));
  setTimeout(() => { const b = $("button", pauseEl); if (b) b.focus({ preventScroll: true }); }, 40);
}
function unpause() { pauseEl.classList.remove("is-on"); setTimeout(() => (pauseEl.hidden = true), 250); S.phase = S.prevPhase || "explore"; if (line && line.audio) { const p = line.audio.play(); if (p && p.catch) p.catch(() => {}); } }
pauseEl.addEventListener("click", async e => {
  const b = e.target.closest("[data-p]"); if (!b) return;
  const k = b.dataset.p;
  if (k === "resume") unpause();
  else if (k === "journal") { unpause(); openJournal(); }
  else if (k === "sound") { if (SC()) SC().toggle("story"); FX("choice"); pause_refresh(); }
  else if (k === "library") { T("story_quit", { scene: S.scene }); close("quit"); }
  else if (k === "restart") { FX("choice"); unpause(); store.del("jg_story"); resetState(); await travelFresh("lot"); }
  else if (k === "go") { FX("choice"); unpause(); await travelFresh(b.dataset.s); }
});
function pause_refresh() { S.phase = S.prevPhase; pause(); }
function resetState() { S.flags = {}; S.looked = {}; S.log = []; S.trophies = []; S.journal = []; S.ending = null; S.visited = {}; }
async function travelFresh(name) { if (line) endLine(true); if (choosing) { choosing = null; choicesEl.hidden = true; } await fade(1, 500); await enter(name, { quiet: true }); await fade(0, 600); S.phase = "explore"; if (name === "lot" && !S.flags.met) runTalk("lot-arrive"); else if (name !== "lot" && D.scenes[name].start) { S.partner = P.jason; startTalk(name); } }

/* ================================================================
   INPUT
   ================================================================ */
function act(k) {
  if (k === "pause") { if (S.phase === "pause") unpause(); else if (S.phase === "journal") closeJournal(); else pause(); return; }
  if (k === "journal") { if (S.phase === "journal") closeJournal(); else if (S.phase === "explore" || S.phase === "talk") openJournal(); return; }
  if (k === "b") { if (S.phase === "journal") closeJournal(); else if (S.phase === "pause") unpause(); else if (S.phase === "close" && S.closeFinish) S.closeFinish(); return; }
  if (k === "a") {
    if (choosing) { const bs = $$(".st-ch", choicesOl); const i = Math.max(0, bs.indexOf(document.activeElement)); pick(i, "pad"); return; }
    if (line) { endLine(true); return; }
    if (S.phase === "explore" && near) interact(near.id, "key");
  }
}
addEventListener("keydown", e => {
  if (!S.open || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (S.phase === "sheet") { if (k === "escape") { e.preventDefault(); S.deskFinish && S.deskFinish(false); } return; }
  if (S.phase === "end") return;
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) { keys[k] = true; if (S.phase === "explore") e.preventDefault(); }
  if (k === "escape" || k === "p") { e.preventDefault(); act(S.phase === "close" ? "b" : "pause"); return; }
  if (k === "j") { e.preventDefault(); act("journal"); return; }
  if (choosing && /^[1-4]$/.test(k)) { e.preventDefault(); pick(+k - 1, "key"); return; }
  if (choosing && (k === "arrowdown" || k === "arrowup")) { e.preventDefault(); moveChoice(k === "arrowdown" ? 1 : -1); return; }
  if ((k === "e" || k === "enter" || k === " ") && !choosing) {
    if (e.target && e.target.closest && e.target.closest("button,a") && k !== "e") return;
    e.preventDefault(); act("a");
  }
}, true);
addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

/* pointer: tap the ground to walk, tap a thing to go to it, drag to look around, a stick where the thumb lands (bottom left) */
const ptr = { id: null, x0: 0, y0: 0, t0: 0, moved: false, stick: false };
cv.addEventListener("pointerdown", e => {
  if (!S.open || S.phase !== "explore") { if (line && (S.phase === "talk")) endLine(true); return; }
  ptr.id = e.pointerId; ptr.x0 = e.clientX; ptr.y0 = e.clientY; ptr.t0 = performance.now(); ptr.moved = false;
  ptr.stick = COARSE.matches && e.clientX < innerWidth * 0.38 && e.clientY > innerHeight * 0.45;
  if (ptr.stick) { stickEl.hidden = false; stickEl.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)"; }
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener("pointermove", e => {
  if (ptr.id !== e.pointerId) return;
  const dx = e.clientX - ptr.x0, dy = e.clientY - ptr.y0;
  if (Math.hypot(dx, dy) > 8) ptr.moved = true;
  if (ptr.stick) { const m = Math.min(1, Math.hypot(dx, dy) / 60), a = Math.atan2(dx, dy); mv.x = Math.sin(a) * m; mv.z = Math.cos(a) * m; mv.run = m > 0.95; $("i", stickEl).style.transform = "translate(" + (Math.sin(a) * m * 34).toFixed(0) + "px," + (Math.cos(a) * m * 34).toFixed(0) + "px)"; }
  else if (ptr.moved) { camState.yaw -= (e.movementX || 0) * 0.006; camState.pitch = clamp(camState.pitch + (e.movementY || 0) * 0.003, 0.02, 0.6); camState.drag = 2; }
});
function endPtr(e) {
  if (ptr.id !== e.pointerId) return;
  const tap = !ptr.moved && performance.now() - ptr.t0 < 350;
  if (ptr.stick) { stickEl.hidden = true; mv.x = 0; mv.z = 0; mv.run = false; }
  if (tap && !ptr.stick && S.phase === "explore") tapAt(e.clientX, e.clientY);
  ptr.id = null; ptr.stick = false;
}
cv.addEventListener("pointerup", endPtr); cv.addEventListener("pointercancel", endPtr);
function tapAt(x, y) {
  // a thing near the tap wins over the ground
  let best = null, bd = 56;
  for (const s of spotsHere()) { const q = project(s.p); if (!q.on) continue; const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = s; } }
  if (best) { if (near && near.id === best.id) interact(best.id, "tap"); else goInteract(best.id); return; }
  const nd = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(nd, camera);
  const t = -ray.ray.origin.y / ray.ray.direction.y;
  if (t > 0 && t < 60) { const p = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t); walkTo(p); FX("key"); }
}
capEl.addEventListener("click", () => { if (line) endLine(true); });
el.addEventListener("click", e => {
  const b = e.target.closest("[data-st]"); if (!b) return;
  if (b.dataset.st === "journal") act("journal");
  else if (b.dataset.st === "pause") act("pause");
});

/* ================================================================
   LAMPS: the eight that matter, nearest the camera
   ================================================================ */
function updateLamps() {
  const L = set.userData.lamps.slice();
  const c = camera.position;
  L.sort((a, b) => (a.fixed ? -1 : 0) - (b.fixed ? -1 : 0) || a.p.distanceToSquared(c) - b.p.distanceToSquared(c));
  const n = Math.min(MAXL, L.length);
  const day = S.scene === "keys";
  for (let i = 0; i < MAXL; i++) {
    const l = L[i];
    if (!l || i >= n) { U.uLampPos.value[i].set(0, -100, 0, 1); U.uLampCol.value[i].set(0, 0, 0, 0); continue; }
    const k = day && !l.fixed ? 0 : 1;
    U.uLampPos.value[i].set(l.p.x, l.p.y, l.p.z, l.range); U.uLampCol.value[i].set(l.col[0] * k, l.col[1] * k, l.col[2] * k, l.cone || 0);
    if (l.coneMesh) l.coneMesh.visible = !day;
    if (l.glow) l.glow.material.uniforms.uK.value = day ? 0.15 : l.glow.material.uniforms.uK.value;
  }
  U.uLampN.value = n;
}

/* ================================================================
   THE LOOP, WITH ADAPTIVE QUALITY
   ================================================================ */
let last = performance.now(), acc = 0, frames = 0, fpsLog = [];
const perf = {};
let raf = 0;
function frame(now) {
  raf = requestAnimationFrame(frame);
  if (!S.open || document.hidden || S.attract) { last = now; return; }
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S.phase === "pause" || S.phase === "journal") dt = S.phase === "journal" ? dt * 0.0 : 0;
  S.t += dt; U.uTime.value = S.t;
  const tA = performance.now();
  if (S.phase !== "pause") {
    tickLine(dt); tickChoices(dt); ringTick(dt);
    moveMe(dt); movePeople(dt);
    const tP = performance.now();
    for (const p of Object.values(P)) if (p.group.visible) p.update(dt);
    perf.people = performance.now() - tP;
    updateCamera(dt);
    const tU = performance.now();
    updatePrompts();
    perf.prompts = performance.now() - tU;
  }
  perf.update = performance.now() - tA;
  if (set) {
    updateLamps();
    if (rain && rain.visible) { rain.material.uniforms.uCam.value.copy(camera.position); const base = S.scene === "decision" ? 0.55 : 1; rain.material.uniforms.uK.value = damp(rain.material.uniforms.uK.value, S.phase === "talk" || S.phase === "close" ? base * 0.45 : base, 2, dt); }
    camera.updateMatrixWorld();
    const ground = set.userData.groundMat ? set.children.find(m => m.material === set.userData.groundMat) : null;
    const t0 = DEBUG ? performance.now() : 0, gl = DEBUG ? renderer.getContext() : null;
    if (ground && quality >= 1) { ground.material.uniforms.uReflK.value = 1; post.reflect(scene, camera, world, ground); }
    else if (ground) ground.material.uniforms.uReflK.value = 0;
    if (DEBUG) { gl.finish(); perf.refl = performance.now() - t0; }
    post.render(scene, camera, S.t);
    if (DEBUG) { gl.finish(); perf.total = performance.now() - t0; perf.calls = renderer.info.render.calls; perf.tris = renderer.info.render.triangles; }
  }
  // adapt: step down when frames run long, back up when there is room
  perf.frame = performance.now() - now; perf.gap = now - (frame.prev || now);
  acc += (now - (frame.prev || now)); frame.prev = now; frames++;
  if (acc > 2000) {
    const ms = acc / frames; fpsLog.push(Math.round(1000 / ms)); if (fpsLog.length > 60) fpsLog.shift();
    const target = COARSE.matches ? 33 : 17.5;
    if (!S.lockQ && ms > target * 1.25 && (pixelRatio > 0.6 || quality > 0)) {
      if (pixelRatio > 0.75) pixelRatio = Math.max(0.6, pixelRatio - 0.2); else quality = Math.max(0, quality - 1);
      post.q = quality; resize();
    } else if (ms < target * 0.7 && pixelRatio < Math.min(devicePixelRatio || 1, 1.75) - 0.01) { pixelRatio = Math.min(Math.min(devicePixelRatio || 1, 1.75), pixelRatio + 0.1); resize(); }
    acc = 0; frames = 0;
  }
}
document.addEventListener("visibilitychange", () => { if (document.hidden) { if (A.ctx) A.ctx.suspend(); if (line && line.audio) line.audio.pause(); } else { if (A.ctx) A.ctx.resume(); if (line && line.audio && S.phase !== "pause") line.audio.play().catch(() => {}); } });

/* ================================================================
   OPEN AND CLOSE
   ================================================================ */
async function coldOpen() {
  // a quiet establishing sequence: low over the wet asphalt, past the lamps and the cars, to the showroom and Jason under the light
  S.phase = "cinematic"; el.classList.add("is-cinema");
  post.comp.u.uBox.value = 1;
  const u = set.userData;
  const p = rail(u.camRail, u.camLook, 13);
  await sleep(2800);
  $(".st-card__ep", cardEl).textContent = D.episode;
  $(".st-card__h", cardEl).textContent = D.title; $(".st-card__sub", cardEl).textContent = D.name;
  cardEl.classList.add("is-title"); cardEl.hidden = false; void cardEl.offsetWidth; cardEl.classList.add("is-on");
  if (SC()) SC().sting("open");
  await sleep(4200);
  cardEl.classList.remove("is-on"); await sleep(600); cardEl.hidden = true; cardEl.classList.remove("is-title");
  await p;
  await fade(1, 600);
  // you, at the gate
  place(me, set.userData.marks.playerIn, Math.PI);
  camState.init = true; camState.yaw = Math.PI * 0 ; camState.yaw = me.yaw + Math.PI;
  post.comp.u.uBox.value = 0; el.classList.remove("is-cinema");
  await fade(0, 800);
  showHint();
  S.phase = "explore";
  await runTalk("lot-arrive");
}
function showHint() {
  hintEl.textContent = COARSE.matches ? UI.walk_touch : UI.walk_pointer;
  if (COARSE.matches && innerWidth < innerHeight) hintEl.textContent += " " + UI.turn;
  hintEl.hidden = false; hintEl.classList.add("is-on");
  setTimeout(() => { hintEl.classList.remove("is-on"); setTimeout(() => (hintEl.hidden = true), 600); }, FAST ? 100 : 6000);
}

let booted = false;
async function boot() {
  if (booted) return; booted = true;
  resize();
  setLoad(0.4, D.scenes.lot.card);
  cast = await loadCast("assets/story/cast/");
  setLoad(0.55);
  getSet("lot");
  setLoad(0.7);
  // warm the shaders on the first frames, behind the loading screen
  await person("you", "player"); setLoad(0.8); await person("jason", "jason"); await person("dell", "dell"); setLoad(0.92);
  raf = requestAnimationFrame(frame);
  // build the rest while you play
  setTimeout(() => { try { getSet("office"); } catch (e) {} }, 2500);
}

async function open(sceneName, how) {
  if (S.open) return;
  S.open = true; S.visited = S.visited || {};
  root.classList.add("story-on"); el.hidden = false; el.classList.add("is-on");
  S.paused = []; $$("video").forEach(v => { if (!el.contains(v) && !v.paused) { v.pause(); S.paused.push(v); } });
  if (window.JG_LOCK) window.JG_LOCK(true);
  audio();
  const saved = loadSave();
  const fresh = !sceneName && !saved;
  if (saved && !sceneName) { Object.assign(S, { flags: saved.flags || {}, looked: saved.looked || {}, log: saved.log || [], trophies: saved.trophies || [], journal: saved.journal || [] }); }
  T("story_started", { how: how || "", scene: sceneName || (saved ? saved.scene : "lot"), cont: !!(saved && !sceneName) });
  await boot();
  setLoad(1);
  const target = sceneName || (saved ? saved.scene : "lot");
  // the address keeps whatever brought you here; a deep link is consumed, so a reload meets the start screen (and Continue)
  if (/^#story/.test(location.hash) && history.replaceState) history.replaceState(null, "", location.pathname + location.search);
  await enter(target, { quiet: true });
  S.visited[target] = 1;
  await sleep(300);
  el.classList.remove("is-loading"); loadEl.classList.add("is-gone");
  setTimeout(() => (loadEl.hidden = true), 900);
  if (target === "lot" && fresh) { await coldOpen(); return; }
  await fade(0, 10);
  FX("arrive"); await sceneCard(target);
  S.phase = "explore";
  if (S.obj) objective(S.obj);
  const st = D.scenes[target].start;
  if (target === "lot" && !S.flags.met) runTalk("lot-arrive");
  else if (target !== "lot" && st && !(saved && saved.scene === target && !sceneName && target !== "decision" && S.flags["done-" + target])) { S.partner = P.jason; startTalk(target); }
}
function close(how) {
  if (!S.open) return;
  S.open = false; S.phase = "closed";
  if (line) endLine(true);
  rainLevel(0); ringOn = false;
  if (arcadeV) arcadeV.pause();
  el.classList.remove("is-on"); root.classList.remove("story-on");
  setTimeout(() => { el.hidden = true; }, 500);
  if (window.JG_LOCK) window.JG_LOCK(false);
  (S.paused || []).forEach(v => { const p = v.play(); if (p && p.catch) p.catch(() => {}); }); S.paused = [];
  if (location.hash.indexOf("#story") === 0 && history.replaceState) history.replaceState(null, "", location.pathname + location.search);
  if (SC() && SC().focus) SC().focus(window.JG_GAME && window.JG_GAME.focusId ? window.JG_GAME.focusId() : "triple-j");
  document.dispatchEvent(new CustomEvent("jg:story-closed", { detail: { how } }));
}

window.JG_STORY = {
  open, close, isOpen: () => S.open, hasSave: () => !!loadSave(),
  debug: {
    state: () => ({ open: S.open, scene: S.scene, phase: S.phase, flags: { ...S.flags }, looked: { ...S.looked }, trophies: S.trophies.slice(), journal: S.journal.slice(), talking: S.talking, line: line ? line.L.id : null, choices: choosing ? choosing.list.map(c => c.t) : null, ending: S.ending, near: near ? near.id : null, me: me ? [me.pos.x, me.pos.z] : null, quality, pixelRatio, fps: fpsLog.slice(-5), obj: S.obj }),
    skip: () => { if (line) endLine(true); },
    flag: (k, v) => { S.flags[k] = v; },
    choose: i => pick(i, "debug"),
    spots: () => spotsHere().map(s => s.id),
    warp: id => {
      const s = spotsHere().find(x => x.id === id); if (!s) return false;
      let st = s.sp.stand || s.p;
      if (s.sp.who) { const w = P[s.sp.who]; st = w.pos.clone().add(new THREE.Vector3(Math.sin(w.yaw), 0, Math.cos(w.yaw)).multiplyScalar(1.35)); }
      mv.target = null; mv.after = null; me.pos.set(st.x, 0, st.z); me.wantYaw = me.yaw = Math.atan2(s.p.x - st.x, s.p.z - st.z); camState.yaw = me.yaw + Math.PI; camState.init = true; return true;
    },
    interact: id => interact(id, "debug"),
    desk: () => S.deskFinish && S.deskFinish(true),
    closeAll: () => { const f = S.closeFinish; if (f) f(); },
    note: id => { const b = $("[data-note='" + id + "']", closeEl); if (b) b.click(); return !!b; },
    camera: () => [camera.position.x, camera.position.y, camera.position.z],
    view: (p, t, r) => { camState.view = p ? { p: new THREE.Vector3(...p), t: new THREE.Vector3(...t), r } : null; },
    box: v => { post.comp.u.uBox.value = v; },
    place: (who, x, z, yaw) => { const p = P[who]; if (!p) return false; p.pos.set(x, 0, z); p.yaw = p.wantYaw = yaw; return true; },
    look: (who, x, y, z) => { const p = P[who]; if (p) p.lookAtP = x == null ? null : new THREE.Vector3(x, y, z); },
    /* the attract loop: a slow move across the lot at night toward Jason under the lamp, rendered frame by frame */
    attract: async () => { S.phase = "cinematic"; S.attract = true; el.classList.add("is-cinema"); post.comp.u.uBox.value = 0; objEl.hidden = true; $(".st-hud", el).style.display = "none";
      place(P.you, new THREE.Vector3(60, 0, 60), 0); hide(P.you); place(P.jason, new THREE.Vector3(9.4, 0, -11.9), -0.95); P.jason.hold = null; place(P.dell, new THREE.Vector3(3.6, 0, 19.2), Math.PI * 0.85);
      return true; },
    renderAt: t => {
      const dur = 12, u = (t % dur) / dur, e = 0.5 - 0.5 * Math.cos(u * Math.PI * 2);
      const pos = new THREE.Vector3(lerp(-4.5, 6.4, e), lerp(1.55, 1.45, e), lerp(-7.9, -9.3, e)), look = new THREE.Vector3(lerp(5.5, 9.4, e), lerp(1.45, 1.45, e), lerp(-12.8, -12.0, e));
      S.t = t; U.uTime.value = t; camera.position.copy(pos); camera.lookAt(look); camState.view = { p: pos, t: look, r: 9 };
      for (const p of Object.values(P)) if (p.group.visible) { p.lookAtP = p === P.jason ? new THREE.Vector3(pos.x, 1.6, pos.z) : null; p.update(1 / 30); }
      updateLamps(); if (rain) { rain.visible = true; rain.material.uniforms.uCam.value.copy(pos); rain.material.uniforms.uK.value = 0.8; }
      const ground = set.children.find(m => m.material === set.userData.groundMat); post.reflect(scene, camera, world, ground); post.render(scene, camera, t); return true;
    },
    perf: () => ({ ...perf, prog: renderer.info.programs ? renderer.info.programs.length : 0 }),
    bench: () => {
      const gl = renderer.getContext(), t = f => { const a = performance.now(); for (let i = 0; i < 3; i++) { f(); gl.finish(); } return +((performance.now() - a) / 3).toFixed(1); };
      const ground = set.userData.groundMat ? set.children.find(m => m.material === set.userData.groundMat) : null;
      return { plain: t(() => { renderer.setRenderTarget(null); renderer.render(scene, camera); }), post: t(() => post.render(scene, camera, S.t)), refl: ground ? t(() => post.reflect(scene, camera, world, ground)) : -1, w: post.w, h: post.h, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    },
    quality: (q, pr) => { quality = q; post.q = q; if (pr) pixelRatio = pr; resize(); }
  }
};
