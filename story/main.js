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
import { loadCast, CAST_VER } from "./people.js";
import * as WORLD from "./world.js";
const { buildLot, buildOffice, buildLibrary, addKeys, buildWaitingRoom } = WORLD;
import { Post, GRADES, applyGrade } from "./post.js";
import { createAudio } from "./audio.js";
import { buildNav, pathLen } from "./nav.js";
import { Guide } from "./guide.js";
import { addLostPlates, syncLostPlates, takeLostPlate, tickLostPlates, LOST_IDS, lostGen } from "./tags.js";

const root = document.documentElement, body = document.body;
const D = JSON.parse(document.getElementById("story-data").textContent);
const LIB = (() => { try { return JSON.parse(document.getElementById("library-data").textContent); } catch (e) { return null; } })();
const TALK = D.talks, OBJ = D.objects, CAST = D.cast, UI = D.ui;
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const COARSE = matchMedia("(pointer: coarse)");
const DEBUG = /[?&]debug=story/.test(location.search);
const FAST = DEBUG && /[?&]fast=1/.test(location.search);
const VER = CAST_VER || "v2";

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
function hap(k, s) { if (window.JG_HAPTIC) window.JG_HAPTIC(k, s); }
function SC() { return window.JG_SCORE; }
const soundOn = () => !!(SC() && SC().isOn());
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };

/* ---------- settings: the mix lives in audio.js; controls here; both persist ---------- */
const KEYS0 = { up: "w", down: "s", left: "a", right: "d", run: "shift", act: "e", journal: "j" };
const SET = Object.assign({ runToggle: false, lock: false, invert: false, look: 1 }, (() => { try { return JSON.parse(store.get("jg_story_controls") || "null") || {}; } catch (e) { return {}; } })());
SET.keys = Object.assign({}, KEYS0, SET.keys || {});
function saveSet() { store.set("jg_story_controls", JSON.stringify(SET)); }
const AU = createAudio({ soundOn: () => !!(window.JG_SCORE && window.JG_SCORE.isOn()), store, base: "assets/story/sfx/", mobile: matchMedia("(pointer: coarse)").matches });
const still = () => RM.matches;
function angTo(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

/* ---------- state ---------- */
const S = {
  open: false, scene: null, phase: "load", flags: {}, looked: {}, log: [], trophies: [], journal: [], obj: null, tags: [],
  talking: null, ending: null, t: 0, started: 0
};
/* the phase, kept honest under the menus: whatever finishes while the pause menu or the journal is open (a scene card,
   a cinematic, a talk) lands in the phase they return to, so Resume never brings back something that already ended */
function setPhase(p) {
  if ((S.phase === "pause" || S.phase === "journal") && p !== "pause" && p !== "journal") { S.prevPhase = p; return; }
  S.phase = p;
}
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
  store.set("jg_story", JSON.stringify({ v: 1, scene: S.scene, flags: S.flags, looked: S.looked, log: S.log, trophies: S.trophies, journal: S.journal, tags: S.tags, obj: S.obj || null, hint: S.hint || null, pos: me && S.phase === "explore" ? [+me.pos.x.toFixed(2), +me.pos.z.toFixed(2), +me.yaw.toFixed(2)] : null, t: Date.now() }));
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
  '<div class="st-stick" aria-hidden="true" hidden><b></b><i></i></div>' +
  '<div class="st-way" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 5.5l7 6.5-7 6.5"/></svg></div>' +
  '<button class="st-act" type="button" hidden><span class="st-act__dot" aria-hidden="true"></span><span class="st-act__verb"></span></button>' +
  '<button class="st-skip" type="button" hidden>' + E(UI.skip) + '</button>' +
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
const wayEl = $(".st-way", el), actEl = $(".st-act", el), skipEl = $(".st-skip", el);
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
const guide = new Guide(world);
let quality = COARSE.matches ? 1 : 2;
{ const m = location.search.match(/[?&]sq=(\d)/); if (DEBUG && m) quality = +m[1]; }
const post = new Post(renderer, { quality });
// a phone starts at a modest resolution (its screen is small and dense; the post chain hides the difference) and earns more if there's room
const PR_MAX = COARSE.matches ? 1.25 : 1.75, PR_MIN = COARSE.matches ? 0.75 : 0.7;
let pixelRatio = Math.min(devicePixelRatio || 1, PR_MAX);
let VW = innerWidth, VH = innerHeight; // the viewport, read once per resize, never per frame
{ const m = location.search.match(/[?&]pr=([\d.]+)/); if (DEBUG && m) { pixelRatio = +m[1]; S.lockQ = true; } }
function resize() {
  const w = innerWidth, h = innerHeight; VW = w; VH = h;
  renderer.setPixelRatio(1); renderer.setSize(w, h, false);
  const pw = Math.round(w * pixelRatio), ph = Math.round(h * pixelRatio);
  post.setSize(pw, ph); renderer.setSize(pw, ph, false); cv.style.width = w + "px"; cv.style.height = h + "px";
  camera.aspect = w / h; camera.fov = w / h < 1 ? 62 : 48; camera.updateProjectionMatrix();
  el.classList.toggle("is-upright", w < h);
}
addEventListener("resize", () => { resize(); try { readSafe(); } catch (e) {} });

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
  // the morning lot: the keys and the sale share one set; where its drivable cars were parked is remembered
  else if (name === "keys" || name === "sale") { s = sets.keys || sets.sale; if (!s) { s = buildLot({ wordmark, day: true, lowres: true }); addKeys(s); for (const c of s.userData.drivable || []) c.home = { x: c.x, z: c.z, yaw: c.yaw }; } }
  else if (name === "june") s = buildWaitingRoom({});
  if (name !== "keys" && name !== "sale" && name !== "june") addLostPlates(s, name === "decision" ? "lot" : name, UI.tag); // the lost license plates (story/tags.js)
  s.visible = false; world.add(s);
  sets[name] = s; if (name === "lot") sets.decision = s; if (name === "decision") sets.lot = s; if (name === "keys") sets.sale = s; if (name === "sale") sets.keys = s;
  return s;
}
let arcadeV = null;
/* the cabinet's screen is a video texture, the dearest upload on a phone: it plays only while the cabinet is near and in view */
let arcadeT = 0;
function arcadeWatch(dt) {
  if (!arcadeV || (arcadeT -= dt) > 0) return; arcadeT = 0.5;
  const sp = S.scene === "office" && set && set.userData.spots && set.userData.spots.arcade;
  let want = false;
  if (sp && sp.p && S.phase !== "pause" && S.phase !== "journal") { const q = project(sp.p); want = q.on && camera.position.distanceTo(sp.p) < 9; }
  if (want && arcadeV.paused) { const pr = arcadeV.play(); if (pr && pr.catch) pr.catch(() => {}); }
  else if (!want && !arcadeV.paused) arcadeV.pause();
}
function arcadeVideo() {
  try {
    const v = document.createElement("video"); v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
    const src = (D.arcade || "assets/game/loops/run-attract"); v.innerHTML = '<source src="' + src + '.webm" type="video/webm"><source src="' + src + '.mp4" type="video/mp4">';
    arcadeV = v; const t = new THREE.VideoTexture(v); t.colorSpace = THREE.SRGBColorSpace; return t;
  } catch (e) { return null; }
}

/* ================================================================
   SOUND: story/audio.js does the work; here it learns where things are
   ================================================================ */
/* what's underfoot; the world can answer for itself (set.userData.surfaceAt) */
function surfaceAt(x, z) {
  const ud = set && set.userData; if (!ud) return "concrete";
  if (typeof ud.surfaceAt === "function") { try { const s = ud.surfaceAt(x, z); if (s) return s; } catch (e) {} }
  if (S.scene === "keys") return "asphalt";
  if (S.scene === "lot" || S.scene === "decision") {
    const pud = (ud.puddles || []).slice(); if (ud.spots && ud.spots.puddle) pud.push({ x: ud.spots.puddle.p.x, z: ud.spots.puddle.p.z, r: 1.4 });
    for (const q of pud) if (Math.hypot(x - q.x, z - q.z) < (q.r || 1.2)) return "puddle";
    if (z < -16.8 && x > -11 && x < 15.3) return "concrete"; // the dry strip under the showroom's front
    return "wet";
  }
  if (S.scene === "office") return Math.abs(x + 0.9) < 2.4 && z > -3.2 && z < 1.0 ? "carpet" : "tile";
  if (S.scene === "memory") return Math.abs(x) < 2.0 ? "carpet" : "wood";
  return "concrete";
}
const footAt = p => ({ x: p.pos.x, y: 0.05, z: p.pos.z });
/* a footstep for anyone walking: on a foot-contact event from people.js when it sends them (p.onFoot), else on the stride's phase */
function feet() {
  for (const p of Object.values(P)) {
    if (!p.group.visible) { p._ph = undefined; continue; }
    // people.js plants each foot and tells us: about 0.7 walking, 1 running, 0.2 for a small step on the spot
    if (!p.onFoot) p.onFoot = (side, k) => { p.footHook = true; footstep(p, Math.max(0.25, Math.min(1.3, (k == null ? 0.7 : k) / 0.72))); };
    const ph = Math.floor(p.phase / Math.PI);
    if (p._ph === undefined) { p._ph = ph; continue; }
    if (ph !== p._ph) { p._ph = ph; if (!p.footHook && (p.speed > 0.3 || (p.turnStep || 0) > 0.4)) footstep(p, p.speed > 0.3 ? 1 : 0.45); }
  }
}
function footstep(p, k) {
  if (S.phase === "load" || p.pose === "sit") return;
  const mine = p === me;
  AU.step(surfaceAt(p.pos.x, p.pos.z), { at: footAt(p), run: p.speed > 2.0, gain: (mine ? 1 : 0.62) * (k == null ? 1 : k), ref: mine ? 4.2 : 2.6 });
}
let ringOn = false, ringT = 0;
function ringTick(dt) {
  if (!ringOn) return;
  const was = ringT % 4 < 1.6;
  ringT += dt;
  const ph = ringT % 4, on = ph < 1.6;
  const led = sets.office && sets.office.userData.phone.led;
  if (led) led.material.uniforms.uK.value = on && (ph * 8 % 1 < 0.5) ? 3 : 0.4;
  if (on && (!was || ringT - dt <= 0)) { const sp = sets.office.userData.spots.phone; AU.ring({ x: sp.p.x, y: sp.p.y, z: sp.p.z }, 1.6); }
}
/* the score toggle (M, or Sound in the pause menu) is the episode's sound too */
document.addEventListener("jg:score", e => { AU.sound(!!(e.detail && e.detail.on)); });

/* ================================================================
   VOICES AND CAPTIONS
   The voice is the clock. A caption shows at once, dim; its words light,
   the mouth moves and the ball lands only once the recording is actually
   playing, and all three follow audio.currentTime from there. A buffering
   voice stops the clock; the line ends when the voice ends (and a short
   hold), never on a guess at its length. One voice at a time: a new line
   stops the last. If the voice can't play (an error, a refusal, a load that
   never comes) the line falls back to a reading clock from where it was.
   While a line plays the next one's recording is already loading.
   ================================================================ */
const VBASE = D.out || "assets/voice/story-v3";
const VREV = "2";
const have = { fict: {}, me: {}, ready: 0 };
let haveDone; const haveP = new Promise(r => (haveDone = r));
// the manifests are fetched past the year-long asset cache: a line voiced later (your thoughts) still gets heard
fetch(VBASE + "/manifest.json?v=" + VREV).then(r => (r.ok ? r.json() : null)).then(j => { if (j && j.lines) have.fict = j.lines; }).catch(() => {}).then(() => { if (++have.ready === 2) haveDone(); });
fetch(VBASE + "/manifest-jason.json?v=" + VREV).then(r => (r.ok ? r.json() : null)).then(j => { if (j && j.lines) have.me = j.lines; }).catch(() => {}).then(() => { if (++have.ready === 2) haveDone(); });
let line = null; // { L, t, mode: "wait"|"voice"|"text", clock, vt, dur, endAt, audio, v, words, est, sp, resolve }
let skipLine = null;
const HOLD = 0.35, WAIT_MAX = 3.5, STALL_MAX = 6;
const VC = new Map(); // id -> { a, words, dur, routed, wp }
let curV = null;
const syncLog = []; // for tools/verify/story.mjs: how each line began and ended
function speakerOf(who) { return P[who === "jason" && S.scene === "memory" ? "memory" : who] || null; }
function voiceId(L) { return L.who === "jason" ? "jason-" + L.id : L.id; }
function voicedLine(L) { if (!L || !soundOn() || FAST) return false; const id = voiceId(L); return !!(L.who === "jason" ? have.me[id] : have.fict[id]); }
/* players a press has already started (silently): a phone lets them speak later, outside any press. The title
   screen's Play leaves a few (intro.js); every press inside the episode tops the pool up */
const VPOOL = window.JG_VPOOL || (window.JG_VPOOL = []);
function blessVoices() {
  if (!S.open || !window.JG_SILENT) return;
  while (VPOOL.length < 6) {
    const a = new Audio(); a.src = window.JG_SILENT; a._b = 1;
    try { const p = a.play(); if (p && p.then) p.then(() => { if (a._b) a.pause(); }).catch(() => {}); } catch (e) {}
    VPOOL.push(a);
  }
}
addEventListener("pointerdown", blessVoices, true); addEventListener("keydown", blessVoices, true);
function prepVoice(L) {
  const id = voiceId(L); let v = VC.get(id);
  if (v) { VC.delete(id); VC.set(id, v); return v; }
  const a = VPOOL.shift() || new Audio(); a._b = 0; try { a.pause(); } catch (e) {}
  a.preload = "auto"; a.src = VBASE + "/" + id + ".mp3";
  v = { id, a, words: null, dur: 0, routed: false };
  v.wp = fetch(VBASE + "/" + id + ".json").then(r => (r.ok ? r.json() : null)).then(j => { if (j && j.words) { v.words = j.words; v.dur = j.duration || 0; } }).catch(() => {});
  VC.set(id, v);
  // keep a handful; the oldest that isn't speaking lets go of its file
  for (const [k, o] of VC) { if (VC.size <= 8) break; if (o === curV) continue; try { o.a.pause(); o.a.removeAttribute("src"); o.a.load(); } catch (e) {} VC.delete(k); }
  return v;
}
function preloadLine(L) { if (voicedLine(L)) prepVoice(L); }
function stopVoice() { if (curV) { try { curV.a.pause(); } catch (e) {} curV = null; if (SC() && SC().voice) SC().voice(false); } }
/* a reading clock's word timings: longer words and stops after punctuation take longer */
function estWords(text, t0, t1) {
  const ws = text.split(" "), wt = ws.map(w => 2 + w.replace(/[^\w']/g, "").length + (/[.?!]$/.test(w) ? 5 : /[,;:]$/.test(w) ? 2.5 : 0));
  const sum = wt.reduce((a, b) => a + b, 0) || 1, k = Math.max(0.2, t1 - t0) / sum;
  let t = t0; return ws.map((w, i) => { const s = t; t += wt[i] * k; return { w, s, e: s + Math.max(0.08, (wt[i] - (/[.?!,;:]$/.test(w) ? 2 : 0)) * k * 0.9) }; });
}
function lineWords(l) { return l.words || l.est; }
/* a thought out in the world: the narrator says it while you keep walking (no stop, no camera move); a talk that
   starts cuts it short */
const WTH = D.world_thoughts || {};
function murmur(id, t) {
  if (S.phase !== "explore" || (line && !line.L.ambient)) return;
  sayLine({ id: "w-" + id, who: "you", t, ambient: true }).catch(() => {});
}
async function sayLine(L) {
  if (have.ready < 2 && soundOn() && !FAST) await Promise.race([haveP, sleep(3000)]);
  return sayLine0(L);
}
function sayLine0(L) {
  if (line && line.L.ambient) endLine(true); // a passing thought gives way
  return new Promise(resolve => {
    const words = L.t.split(" ");
    const c = CAST[L.who] || { name: "" };
    whoEl.textContent = c.name || ""; tagEl.textContent = c.tag || ""; tagEl.hidden = !c.tag;
    capEl.classList.toggle("is-thought", L.who === "you");
    capEl.classList.toggle("is-me", L.who === "jason");
    // a passing thought is read, not tapped: it never sits over the big button you use the next thing with
    capEl.classList.toggle("is-passing", !!L.ambient);
    saidEl.innerHTML = words.map(w => "<i>" + E(w) + "</i>").join(" ");
    capEl.hidden = false; requestAnimationFrame(() => capEl.classList.add("is-on"));
    const sp = speakerOf(L.who);
    const textDur = S.holdLines && !L.ambient ? 60 : FAST ? 0.05 : 1.1 + L.t.length * 0.052; // a passing thought never waits to be skipped
    const base = { L, t: 0, mode: "text", clock: 0, vt: 0, dur: textDur, endAt: null, audio: null, v: null, words: null, est: null, resolve, sp, offs: [], k: -2, stallT: 0, waitT: 0, perf: performance.now() };
    base.est = estWords(L.t, 0.12, Math.max(0.5, Math.min(textDur, 1.1 + L.t.length * 0.052) - 0.55));
    if (curV) stopVoice();
    line = base;
    if (sp) { sp.talk = 0; sp.nod = 1; sp.brow = /\?$/.test(L.t) ? 1 : 0; }
    if (L.who === "phone" || L.who === "agent" || L.who === "caller") { if (P.jason) P.jason.lookAtP = null; }
    shotFor(L);
    const rec = { id: L.id, who: L.who, voiced: false, at: performance.now(), playing: null, ended: null, end: null, skipped: null, mode: "text" };
    base.rec = rec; syncLog.push(rec); if (syncLog.length > 80) syncLog.shift();
    // voices only with the score on; my lines once they exist in my voice
    if (voicedLine(L)) {
      const v = prepVoice(L), a = v.a;
      curV = v; base.v = v; base.audio = a; base.mode = "wait"; rec.voiced = true; rec.mode = "wait";
      if (!v.routed) { AU.voice(a); v.routed = true; }
      try { if (a.currentTime) a.currentTime = 0; } catch (e) {}
      const on = (ev, f) => { a.addEventListener(ev, f); base.offs.push(() => a.removeEventListener(ev, f)); };
      on("playing", () => { if (line !== base || base.mode === "text") return; if (base.mode === "wait") { rec.playing = performance.now(); base.ctAt = performance.now(); base.lastCT = a.currentTime; } base.mode = "voice"; rec.mode = "voice"; base.stall = false; });
      on("waiting", () => { if (line === base) base.stall = true; });
      on("stalled", () => { if (line === base && base.mode === "wait") base.stall = true; });
      on("ended", () => { if (line === base && base.mode === "voice") { rec.ended = performance.now(); base.vt = Math.max(base.vt, a.duration || base.vt); base.endAt = performance.now() + HOLD * 1000; } });
      on("error", () => { if (line === base) toText(base, "error"); });
      const p = a.play(); if (p && p.catch) p.catch(e => { if (line === base && base.mode !== "text" && !(e && e.name === "AbortError")) toText(base, "refused"); });
      if (SC() && SC().voice) SC().voice(true); AU.duck(0.45);
      if (v.words) base.words = v.words; else v.wp.then(() => { if (line === base && v.words) base.words = v.words; });
    } else AU.duck(0.8);
    capEl.classList.toggle("is-voiced", !!base.audio);
    const sr = $(".st-sr", el) || (() => { const s = document.createElement("p"); s.className = "st-sr vh"; s.setAttribute("aria-live", "polite"); el.appendChild(s); return s; })();
    sr.textContent = (c.name ? c.name + ": " : "") + L.t;
    ball.start(saidEl, still());
  });
}
/* the voice couldn't play: carry on with the reading clock from where the voice had got to */
function toText(l, why) {
  if (l.audio) { try { l.audio.pause(); } catch (e) {} }
  if (curV === l.v) { curV = null; if (SC() && SC().voice) SC().voice(false); }
  l.mode = "text"; l.rec.mode = "text:" + why; l.clock = l.vt || 0;
  if (!l.words) l.est = estWords(l.L.t, l.clock + 0.12, Math.max(l.clock + 0.5, l.dur - 0.55));
  l.dur = Math.max(l.dur, (lineWords(l).slice(-1)[0] || { e: 0 }).e + 0.6);
  AU.duck(0.8);
}
function endLine(skipped) {
  if (!line) return;
  const L = line;
  L.offs.forEach(f => f()); L.offs = [];
  if (L.audio) { try { L.audio.pause(); } catch (e) {} }
  if (curV === L.v) stopVoice();
  if (L.sp) { L.sp.talk = 0; L.sp.brow = 0; }
  L.rec.end = performance.now(); L.rec.skipped = !!skipped;
  line = null; AU.duck(1);
  capEl.classList.remove("is-on"); ball.stop();
  // no talk to put the caption away after a passing thought: it goes once it has faded (an empty caption left on
  // the page still takes the taps meant for what's under it)
  if (L.L.ambient) setTimeout(() => { if (!line) capEl.hidden = true; }, 360);
  L.resolve(skipped);
}
/* where the line is now, in the voice's own seconds; between the audio clock's ticks it runs on the frame clock */
function lineNow(l, pnow) {
  if (S.ballPin != null) return S.ballPin; // a still, for the harness
  if (l.mode === "voice") {
    const a = l.audio, ct = a.currentTime;
    if (ct !== l.lastCT && !a.ended) { l.lastCT = ct; l.vt = ct; l.ctAt = pnow; l.stall = false; l.stallT = 0; }
    if (a.paused || l.stall || a.ended) return l.vt;
    return Math.min(l.vt + Math.max(0, (pnow - l.ctAt) / 1000), l.vt + 0.25);
  }
  if (l.mode === "wait") return 0;
  return l.clock + (S.phase === "pause" ? 0 : Math.min(0.05, Math.max(0, (pnow - l.perf) / 1000)));
}
function tickLine(dt) {
  if (!line) return;
  const l = line, pnow = performance.now();
  l.t += dt;
  if (l.mode === "wait") {
    // nothing heard yet: the clock holds; too long (a slow network, a blocked file) and the line reads on its own
    if (S.phase !== "pause") l.waitT += dt;
    if (l.waitT > WAIT_MAX) toText(l, "late");
  } else if (l.mode === "voice") {
    const a = l.audio, ct = a.currentTime;
    if (ct !== l.lastCT) { l.lastCT = ct; l.vt = ct; l.ctAt = pnow; l.stall = false; l.stallT = 0; }
    else if (!a.paused && !a.ended && dt > 0) { l.stallT += dt; if (l.stallT > STALL_MAX) toText(l, "stalled"); }
    if (l.endAt == null && a.ended) { l.rec.ended = l.rec.ended || pnow; l.endAt = pnow + HOLD * 1000; }
  } else { l.clock += dt; l.perf = pnow; }
  const now = lineNow(l, pnow);
  l.now = now;
  if (l.mode !== "wait") {
    const W = lineWords(l), spans = saidEl.children;
    let k = -1; for (let i = 0; i < W.length; i++) { if (now >= W[i].s - 0.02) k = i; else break; }
    if (k !== l.k) {
      for (let i = 0; i < spans.length; i++) { spans[i].classList.toggle("is-said", i <= k); spans[i].classList.toggle("is-now", i === k); }
      l.k = k;
    }
    // the mouth follows the voice: open on words, rest between them
    if (l.sp && l.L.who !== "you") {
      const w = W.find(w => now >= w.s && now <= w.e + 0.04); l.sp.talk = w ? 1 : 0.15;
      if (l.sp.speak) l.sp.speak(W, now);
    }
  }
  if (l.mode === "text" && l.clock > l.dur) return endLine(false);
  if (l.mode === "voice" && l.endAt != null && pnow >= l.endAt && S.phase !== "pause" && (!S.holdLines || l.L.ambient)) return endLine(false);
}
/* the voice picks up again after the pause menu or a hidden tab, if it was the clock */
function resumeVoice() { if (line && line.audio && line.mode !== "text") { const p = line.audio.play(); if (p && p.catch) p.catch(() => {}); } }

/* ================================================================
   THE CAPTION BALL
   A small bone ball that hops from word to word as each is spoken: it
   lands on the word's own moment (the arc is higher for a longer hop or a
   longer wait), squashes on landing, stretches along its flight with a few
   fading ghosts behind it, and breathes while the voice rests. Positions
   are a pure function of the line's clock, so it is drawn every frame from
   the voice itself with transforms only; reduced motion leaves only the
   lit word.
   ================================================================ */
const EZ = (() => { // the site's one ease, cubic-bezier(0.2, 0.7, 0.1, 1), solved for x
  const x1 = 0.2, y1 = 0.7, x2 = 0.1, y2 = 1;
  const bx = t => 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t;
  const by = t => 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t;
  return x => { if (x <= 0) return 0; if (x >= 1) return 1; let a = 0, b = 1, t = x; for (let i = 0; i < 18; i++) { t = (a + b) / 2; if (bx(t) < x) a = t; else b = t; } return by(t); };
})();
const ball = (() => {
  const layer = document.createElement("div"); layer.className = "st-ball"; layer.setAttribute("aria-hidden", "true");
  // the streak first (under everything), then three ghosts, then the ball on top
  const streak = document.createElement("b"); streak.className = "is-streak"; layer.appendChild(streak);
  const els = [0, 1, 2, 3].map(i => { const b = document.createElement("i"); if (i) b.className = "is-ghost"; return b; });
  [3, 2, 1, 0].forEach(i => layer.appendChild(els[i]));
  capEl.appendChild(layer);
  let on = false, pos = [], R = 3.5, host = null, lastK = -1;
  function measure() {
    if (!host) return;
    const c = capEl.getBoundingClientRect(), fs = parseFloat(getComputedStyle(host).fontSize) || 18;
    R = Math.max(4.5, Math.min(6, fs * 0.25)); // about half an em across: 9 px on a phone, 10 to 12 on a desktop
    els.forEach(b => { b.style.width = b.style.height = (2 * R).toFixed(1) + "px"; });
    streak.style.height = (2 * R * 0.86).toFixed(1) + "px";
    pos = [].map.call(host.children, s => { const r = s.getBoundingClientRect(); return { x: r.left - c.left + r.width / 2, y: r.top - c.top + (r.height - fs) * 0.5 + fs * 0.1 - R - 2, row: Math.round(r.top), bot: r.bottom - c.top - (r.height - fs) * 0.5 }; });
    // on a lower row the hop stays in the gap under the row above, never over its letters
    for (const p of pos) { const above = pos.filter(q => q.row < p.row); p.room = above.length ? Math.max(2.5, p.y - R - Math.max(...above.map(q => q.bot)) - 1) : 40; }
  }
  function start(h, rm) {
    host = h; on = !rm; lastK = -1;
    capEl.classList.toggle("has-ball", on);
    els.forEach(b => { b.style.opacity = "0"; });
    if (on) measure();
  }
  function stop() { on = false; }
  addEventListener("resize", () => { if (on) measure(); });
  /* the ball at time t: x, y, opacity, and how long since it landed (or -1 in the air) */
  function at(W, t) {
    const n = Math.min(W.length, pos.length); if (!n) return null;
    let k = -1; for (let i = 0; i < n; i++) { if (t >= W[i].s) k = i; else break; }
    if (k < 0) { // dropping in onto the first word
      const T = Math.min(0.32, Math.max(0.1, W[0].s)), u = 1 - (W[0].s - t) / T, p = pos[0];
      if (u <= 0) return { x: p.x, y: p.y - 22, o: 0, land: -1, air: true };
      return { x: p.x, y: p.y - 22 * (1 - u * u), o: Math.min(1, u * 1.6), land: -1, air: true };
    }
    const p = pos[k];
    if (k < n - 1) {
      const nx = W[k + 1].s, gap = nx - W[k].s, T = clamp(gap * 0.62, 0.1, 0.42), take = nx - T;
      if (t >= take) {
        const q = pos[k + 1], u = (t - take) / T;
        const wait = Math.max(0, W[k + 1].s - W[k].e);
        const h = Math.min(clamp(5 + Math.abs(q.x - p.x) * 0.1 + wait * 16 + T * 14, 6, 30), p.room, q.room);
        if (q.row !== p.row) { // a new row: up and out, then down onto the next word from above
          if (u < 0.4) { const v = u / 0.4; return { x: p.x, y: p.y - h * EZ(v), o: 1 - v, land: -1, air: true, wrap: true }; }
          const v = (u - 0.4) / 0.6; return { x: q.x, y: q.y - h * (1 - v * v), o: Math.min(1, v * 1.5), land: -1, air: true, wrap: true };
        }
        const xu = 0.5 * u + 0.5 * EZ(u);
        return { x: p.x + (q.x - p.x) * xu, y: p.y + (q.y - p.y) * u - 4 * h * u * (1 - u), o: 1, land: -1, air: true };
      }
    }
    return { x: p.x, y: p.y, o: 1, land: t - W[k].s, air: false, rest: t - W[k].e };
  }
  function draw(l, pnow) {
    if (!on || !l || l.mode === "wait") { if (on) { els.forEach(b => { b.style.opacity = "0"; }); streak.style.opacity = "0"; } return; }
    const W = lineWords(l); if (!W) return;
    const t = lineNow(l, pnow), b = at(W, t); if (!b) return;
    const b1 = at(W, t - 1 / 120) || b;
    let vx = (b.x - b1.x) * 120, vy = (b.y - b1.y) * 120; if (b.wrap) { vx = 0; vy = Math.max(-400, Math.min(400, vy)); }
    const sp = Math.hypot(vx, vy);
    let sx = 1, sy = 1, ang = 0, dy = 0;
    if (b.air && sp > 30) { const s = 1 + Math.min(1.1, sp / 420); sx = s; sy = 1 / Math.sqrt(s); ang = Math.atan2(vy, vx); }
    else if (!b.air && b.land < 0.24) { const k = Math.exp(-b.land * 15) * Math.cos(b.land * 32); sx = 1 + 0.34 * k; sy = 1 - 0.4 * k; dy = (1 - sy) * R; }
    else if (!b.air && b.rest > 0.2) { const k = 1 + 0.07 * Math.sin(t * Math.PI * 1.6) * Math.min(1, (b.rest - 0.2) * 3); sx = sy = k; }
    const tf = (x, y, a, X, Y) => "translate3d(" + (x - R).toFixed(1) + "px," + (y - R).toFixed(1) + "px,0) rotate(" + a.toFixed(3) + "rad) scale(" + X.toFixed(3) + "," + Y.toFixed(3) + ")";
    els[0].style.transform = tf(b.x, b.y + dy, ang, sx, sy); els[0].style.opacity = b.o.toFixed(2);
    // the blur: ghosts a beat behind along the same arc, fading, only while it's really moving
    const blur = b.air && !b.wrap ? Math.min(1, sp / 260) : 0;
    // the streak: a soft pill trailing back along the velocity, as long as the last few hundredths of a second of travel
    if (blur > 0.05) {
      const len = Math.min(70, sp * 0.055), w = 2 * R + len, hh = 2 * R * 0.86;
      streak.style.width = w.toFixed(1) + "px";
      streak.style.transform = "translate3d(" + (b.x - w + R).toFixed(1) + "px," + (b.y + dy - hh / 2).toFixed(1) + "px,0) rotate(" + ang.toFixed(3) + "rad)";
      streak.style.transformOrigin = (w - R).toFixed(1) + "px 50%";
      streak.style.opacity = (blur * 0.75 * b.o).toFixed(2);
    } else streak.style.opacity = "0";
    for (let i = 1; i < 4; i++) {
      const g = blur > 0.05 ? at(W, t - i * 0.024) : null;
      if (!g || !g.air || g.wrap) { els[i].style.opacity = "0"; continue; }
      els[i].style.transform = tf(g.x, g.y, ang, sx * (1 + i * 0.12), sy * (1 - i * 0.12)); els[i].style.opacity = (blur * [0, 0.42, 0.24, 0.11][i] * g.o).toFixed(2);
    }
  }
  return { start, stop, draw, measure, at: (t) => { const l = line; if (!l) return null; return at(lineWords(l), t); }, get pos() { return pos; }, get on() { return on; }, get R() { return R; } };
})();

/* ---------- choices ---------- */
let choosing = null;
let chHide = [];
function choose(T0) {
  const list = (T0.choices || []).filter(c => cond(c.if));
  chHide.forEach(clearTimeout); chHide = [];
  return new Promise(resolve => {
    choicesOl.innerHTML = list.map((c, i) => '<li><button type="button" class="st-ch" data-i="' + i + '"><kbd aria-hidden="true">' + (dev === "pad" ? "" : i + 1) + "</kbd><span>" + E(c.t) + "</span></button></li>").join("");
    choicesEl.hidden = false; requestAnimationFrame(() => choicesEl.classList.add("is-on")); el.classList.add("has-choices");
    choicesEl.setAttribute("aria-label", "Choose");
    const timed = T0.timed && !still() ? T0.timed : null;
    timerEl.hidden = !timed;
    choosing = { list, resolve, t: 0, timed, idx: 0 };
    shotChoices();
    setTimeout(() => { const b = $(".st-ch", choicesOl); if (b && dev !== "touch") b.focus({ preventScroll: true }); }, 60);
  });
}
function pick(i, how) {
  if (!choosing) return;
  const c = choosing.list[i]; if (!c) return;
  const res = choosing.resolve; choosing = null;
  const b = $$(".st-ch", choicesOl)[i]; if (b) b.classList.add("is-picked");
  FX("choice"); AU.ui("choice");
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
  hap("tap"); if (SC()) SC().tick && SC().tick(); AU.ui("notice");
  clearTimeout(noteT); noteT = setTimeout(() => { noteEl.classList.remove("is-on"); setTimeout(() => (noteEl.hidden = true), 500); }, FAST ? 200 : 3600);
  S.log.push({ note: text });
}
let toastT = null;
function toast(text) { toastEl.textContent = text; toastEl.hidden = false; toastEl.classList.add("is-on"); clearTimeout(toastT); toastT = setTimeout(() => { toastEl.classList.remove("is-on"); setTimeout(() => (toastEl.hidden = true), 400); }, FAST ? 200 : 2200); }
function objective(k) {
  if (k !== S.obj) progress();
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
  hap("success"); if (SC()) SC().sting("trophy-" + t.tier); AU.ui("trophy");
  setTimeout(() => { trophyEl.classList.remove("is-on"); setTimeout(() => { trophyEl.hidden = true; trophyQ.shift(); if (trophyQ.length) showTrophy(); }, 450); }, FAST ? 250 : 4200);
}

/* ================================================================
   PEOPLE IN THE SCENES
   ================================================================ */
const personP = {};
function person(key, name, o) {
  if (P[key]) return Promise.resolve(P[key]);
  return personP[key] || (personP[key] = person0(key, name, o).finally(() => { delete personP[key]; }));
}
async function person0(key, name, o) {
  const p = await cast.make(name + "-" + VER, o);
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
  keys: { sky: "#9db1c2", ground: "#5e564a", moon: "#ffe7c2", rim: "#cfd9e2", fog: "#c9cfcf", den: 0.006, wetAll: 0.0, sat: 1, moonDir: [0.55, 0.6, 0.45] },
  june: { sky: "#2a3134", ground: "#191b1a", moon: "#23282a", rim: "#66706e", fog: "#111517", den: 0.012, wetAll: 0.12, sat: 0.8, moonDir: [0.6, 0.7, -0.2] },
  sale: { sky: "#a9b9c4", ground: "#625849", moon: "#ffdcae", rim: "#ddd5c6", fog: "#d8ccb4", den: 0.0035, wetAll: 0.0, sat: 1, moonDir: [0.65, 0.5, 0.4] }
};
function lightScene(name) {
  const L = SCENE_LIGHT[name];
  U.uSky.value.set(L.sky); U.uGround.value.set(L.ground); U.uMoon.value.set(L.moon); U.uRim.value.set(L.rim); U.uFog.value.set(L.fog); U.uFogDen.value = L.den; U.uWetAll.value = L.wetAll; U.uSat.value = L.sat;
  U.uMoonDir.value.set(...L.moonDir).normalize();
  if (name === "keys" || name === "sale") { U.uMoon.value.multiplyScalar(1.5); }
}
let set = null, rain = null;
function makeRain() {
  const n = quality >= 2 ? 800 : COARSE.matches ? 250 : quality >= 1 ? 420 : 250;
  const g = new THREE.InstancedBufferGeometry(); g.instanceCount = n;
  g.setAttribute("position", new THREE.Float32BufferAttribute([-0.0025, 0, 0, 0.0025, 0, 0, 0.0025, 1, 0, -0.0025, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  const seed = new Float32Array(n * 4); for (let i = 0; i < n; i++) { seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = 0.7 + Math.random() * 0.6; }
  g.setAttribute("seed", new THREE.InstancedBufferAttribute(seed, 4));
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, uCam: { value: new THREE.Vector3() }, uK: { value: 1 } },
    vertexShader: `attribute vec4 seed; uniform vec3 uCam; uniform float uTime; uniform vec2 uWind; uniform vec4 uLampPos[8]; uniform vec4 uLampCol[8]; uniform int uLampN; varying float vL; varying float vA;
      void main(){ vec3 box = vec3(22.0, 12.0, 22.0); float ph = fract(seed.y - uTime * 0.85 * seed.w); vec3 p = vec3(seed.x, ph, seed.z) * box - box * 0.5; p.y += 4.0;
        p.xz += uWind * (1.0 - ph) * 1.4; // a gust carries the drops sideways as they fall
        p.xz = uCam.xz + mod(p.xz - uCam.xz + box.xz * 0.5, box.xz) - box.xz * 0.5; p.x += position.y * 0.05;
        float len = 0.25 * seed.w; vec3 lean = vec3(-uWind.x, 0.0, -uWind.y) * position.y * len * 0.5; vec3 wp = vec3(p.x + position.x, p.y + position.y * len, p.z) + lean;
        vec3 cdir = normalize(wp - cameraPosition); vec3 side = normalize(cross(cdir, vec3(0.0, 1.0, 0.0))); wp = vec3(p.x, p.y + position.y * len, p.z) + lean + side * position.x * 1.2;
        float l = 0.05; for (int i = 0; i < 8; i++) { if (i >= uLampN) break; float d = length(uLampPos[i].xyz - wp); l += max(0.0, 1.0 - d / (uLampPos[i].w * 0.6)) * length(uLampCol[i].rgb) * 0.6; }
        vL = l; vA = smoothstep(4.0, 7.0, length(wp - cameraPosition)) * smoothstep(20.0, 8.0, length(wp - cameraPosition));
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`,
    fragmentShader: `uniform float uK; varying float vL; varying float vA; void main(){ gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * vL * 0.34 * uK * vA, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.layers.set(3); return mesh;
}

async function enter(name, o = {}) {
  if (DRV.state) exitCar("scene", true); // on your feet before anything moves you
  const prev = S.scene;
  S.scene = name; setPhase("cinematic");
  S.visited = S.visited || {}; S.visited[name] = 1;
  Object.values(sets).forEach(s => (s.visible = false));
  set = getSet(name); set.visible = true; applyTier();
  lightScene(name);
  applyGrade(post, GRADES[name]);
  ringOn = false;
  // who is here
  for (const k of Object.keys(P)) { const q = P[k]; if (q.car && q !== me) { try { q.driving = null; } catch (e) {} } hide(q); }
  // whatever the last scene left on them: Jason sitting with his head down, a phone at your ear, a cup in a hand
  if (P.jason) { P.jason.pose = "stand"; P.jason.heavy = 0; }
  for (const q of Object.values(P)) { if (q.hold === "phone") q.hold = null; const C = q.carrying; if (C) for (const sd of ["l", "r"]) if (C[sd]) { C[sd] = null; try { q.release(sd); } catch (e) {} } }
  if (P.you && P.you.car) { try { P.you.driving = null; } catch (e) {} }
  AUTO = null; S.heldShot = null; S.busy = false; camState.juneIn = false; if (HOLDG) endHold(false);
  if (name === "sale") courseReset();
  const M = set.userData.marks;
  if (name === "lot") {
    await person("you", "player"); await person("jason", "jason"); await person("dell", "dell");
    // outside the gate is only for the cold open (which walks you in); any other way in starts you on the lot
    place(P.you, o.cold ? M.playerStart : (M.playerIn || M.playerStart), Math.PI); place(P.jason, M.jason, M.jasonYaw); place(P.dell, M.dell, M.dellYaw);
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
  } else if (name === "june") {
    // past midnight: Jason in the row facing the doors, elbows in, the weight of it on him
    await person("you", "player"); await person("jason", "jason");
    place(P.you, M.playerStart, M.playerYaw); place(P.jason, M.jason, M.jasonYaw); P.jason.pose = "sit"; P.jason.heavy = 1;
    buzzT = 6;
  } else if (name === "sale") {
    // the next morning: Marisol by the first car, Jason a step back, you coming up the lane
    await person("you", "player"); await person("jason", "jason"); await person("marisol", "renata", { look: "marisol" });
    saleCarHome();
    const c = saleCar() || { x: -1.6, z: 4.5, yaw: 0 };
    const mp = carLocal(c, -1.3, -1.7), jp = carLocal(c, 1.7, -3.6), yp = carLocal(c, 0.3, -6.4);
    place(P.you, yp, Math.atan2(mp.x - yp.x, mp.z - yp.z)); place(P.marisol, mp, Math.atan2(yp.x - mp.x, yp.z - mp.z)); place(P.jason, jp, Math.atan2(mp.x - jp.x, mp.z - jp.z));
    set.userData.spots["sale-buyer"] = set.userData.spots["sale-keys"] = { who: "marisol", r: 2.6 };
    // the journal's drawing of the morning: the car, wherever it is
    if (!set.userData.spots.sale) Object.defineProperty(set.userData.spots, "sale", { value: { get p() { const k = saleCar(); return k ? new THREE.Vector3(k.x, 0.75, k.z) : new THREE.Vector3(-1.6, 0.75, 4.5); }, sketchR: 2.2 }, enumerable: false });
  } else if (name === "decision") {
    await person("you", "player"); await person("jason", "jason"); await person("dell", "dell");
    place(P.you, M.decisionPlayer, Math.PI * 0.9); place(P.jason, M.decisionJason, Math.PI * 0.2); place(P.dell, M.dellGate, Math.PI);
    P.dell.hold = "umbrella";
    set.userData.gate.position.x = S.flags.gate === "helped" ? 3.2 : -0.6;
  }
  for (const p of Object.values(P)) if (p.shadow) p.shadow.visible = p.group.visible;
  me = name === "memory" ? P.memory : name === "keys" ? P.jason : P.you;
  // come in through an exit: you arrive at the way back to where you were
  if (me && o.from) { const ex = Object.values(set.userData.spots || {}).find(x => x && x.kind === "exit" && (x.to === o.from || (o.from === "decision" && x.to === "lot") || (o.from === "lot" && x.to === "decision"))); if (ex) { const q = ex.stand || ex.p || ex.at; if (q) { me.pos.set(q.x, 0, q.z); const f = ex.p || ex.at; if (f && f !== q) me.yaw = me.wantYaw = Math.atan2(q.x - f.x, q.z - f.z); } } }
  if (me && !o.cold) unstick(me);
  if (name === "decision" && ["keys", "sale", "drive", "back"].includes(S.obj)) objective(null);
  // the rain: hard on the lot, gentler at the end, none inside or in the morning
  if (!rain) { rain = makeRain(); scene.add(rain); }
  rain.visible = name === "lot" || name === "decision";
  rain.material.uniforms.uK.value = name === "decision" ? 0.55 : 1;
  if (set.userData.groundMat) set.userData.groundMat.uniforms.uRain.value = name === "decision" ? 0.5 : name === "keys" || name === "sale" ? 0 : 1;
  if (set.userData.keys) set.userData.keys.visible = name === "keys"; // the lockbox is the keys morning's, not the sale's
  AU.scene(name, set);
  nav = null; navFor = null; guideRoute = null;
  // the desk lamp in the memory remembers what you chose
  if (S.scene === "decision" && S.flags.lamp === "off") { const l = sets.lot.userData.lamps[5]; if (l) { l.col = [0.6, 0.38, 0.18]; l.glow.material.uniforms.uK.value = 0.7; } }
  // the score: the title's layer for where you are
  if (SC() && SC().focus) SC().focus({ lot: "triple-j", decision: "triple-j", office: "lead-to-title", memory: "neuroscience", keys: "triple-j", june: "bed", sale: "triple-j" }[name]);
  // the waiting room takes the score almost all the way down; the morning gives it back, warm
  AU.scoreLevel(name === "june" ? 0.1 : 1, name === "june" ? 4 : 6);
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
  // a shot the scene is holding (the car driving away), or the slow close one beside him in the waiting room
  if (S.heldShot) { camState.shot = S.heldShot; return; }
  if (S.scene === "june" && me && me.seated && S.partner === P.jason && P.jason) { juneShot(L); return; }
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
  if (DRV.state === "drive" && DRV.veh && !camState.view && !camState.rail && S.phase === "drive" && driveView(dt)) return;
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
    const push = s.push * Math.min(1, camState.shotT / (s.dur || 4));
    const pos = s.pos.clone().lerp(s.look, push);
    if (camState.cut) { camera.position.copy(pos); camState.look.copy(s.look); camState.cut = false; }
    else { camera.position.lerp(pos, 1 - Math.exp(-3 * dt)); camState.look.lerp(s.look, 1 - Math.exp(-3 * dt)); }
    camera.lookAt(camState.look);
    post.comp.u.uFocus.value = s.focus || camera.position.distanceTo(camState.look); post.comp.u.uRange.value = s.range || 1.6; post.comp.u.uDofK.value = quality >= 2 ? (s.range && s.range < 1.2 ? 1 : 0.9) : 0;
    return;
  }
  if (!me) return;
  post.comp.u.uDofK.value = 0; post.comp.u.uRange.value = 9; // depth of field is for conversations; walking, the lot stays sharp
  const { want, look } = followView(dt, false);
  if (camState.init) { camera.position.copy(want); camState.look.copy(look); camState.init = false; }
  camera.position.lerp(want, k); camState.look.lerp(look, k);
  camera.lookAt(camState.look);
  post.comp.u.uFocus.value = camera.position.distanceTo(camState.look);
}
/* the follow camera: behind you and a little over the right shoulder, leading the way you walk,
   pulled in along the line to your head whenever a wall, a car, a pole or the room's edge would be in the way */
// outside, a car is as good as a wall (a camera skimming a roof sees nothing but paint); in a room the desks and tables are low enough to look over
const camWalls = () => (set.userData.walls || []).map(w => ({ ...w, src: w, h: w.h != null ? w.h : (set.userData.bounds && (w.x1 - w.x0) > 1.2 && (w.z1 - w.z0) > 1.0 && (w.x1 - w.x0) * (w.z1 - w.z0) < 14 ? 1.1 : 99) }));
let camWallsFor = null, camWallList = [];
function insideAny(x, y, z, pad, list) {
  if (camWallsFor !== set) { camWallList = camWalls(); camWallsFor = set; }
  for (const w of list || camWallList) if (y < w.h + pad && x > w.x0 - pad && x < w.x1 + pad && z > w.z0 - pad && z < w.z1 + pad) return true;
  // people, and Dell's umbrella, are solid too
  for (const k in P) { const q = P[k]; if (q === me || !q.group.visible) continue; const r = (q.hold === "umbrella" ? 0.72 : 0.42) + pad * 0.5; if (y < 2.35 && (x - q.pos.x) ** 2 + (z - q.pos.z) ** 2 < r * r) return true; }
  const b = set.userData.bounds; if (b && (x < b.x0 + pad * 0.5 || x > b.x1 - pad * 0.5 || z < b.z0 + pad * 0.5 || z > b.z1 - pad * 0.5 || y > (set.userData.ceilingY || (S.scene === "memory" ? 6.2 : 2.95)) - pad * 0.5)) return true;
  return y < 0.15;
}
/* scratch vectors for the cameras: nothing allocated per frame */
const _head = new THREE.Vector3(), _off = new THREE.Vector3(), _right = new THREE.Vector3(), _aim = new THREE.Vector3(), _pivot = new THREE.Vector3(), _o2 = new THREE.Vector3(), _want = new THREE.Vector3(), _look = new THREE.Vector3(), _tmp = new THREE.Vector3();
const _fv = { want: _want, look: _look }, _near = [];
function followView(dt, probe) {
  // a jump: the camera goes half way up with you, and dips with the landing
  const head = _head.copy(me.pos); head.y += me.height * 0.86 - me.pos.y * 0.5 - JUMP.dip;
  // drift behind the walker unless the visitor is steering the camera
  if (!probe) {
    if (me.speed > 0.4 && camState.drag <= 0) camState.yaw += angTo(camState.yaw, me.yaw + Math.PI) * (1 - Math.exp(-(mv.path ? 1.0 : 1.6) * dt));
    camState.drag -= dt;
  }
  const inside = S.scene === "office" || S.scene === "memory", mem = S.scene === "memory", upright = VW < VH;
  const dist = (mem ? 2.2 : inside ? 2.7 : 3.6) * (camState.zoom || 1) * (upright ? 1.12 : 1);
  // close to a wall, the camera rises and looks down over you rather than sit behind your head
  const pitch = camState.pitch + (mem ? -0.06 : inside ? 0.08 : 0) + (probe ? 0 : (camState.lift || 0) + (camState.close || 0));
  const off = _off.set(Math.sin(camState.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(camState.yaw) * Math.cos(pitch));
  const right = _right.set(Math.cos(camState.yaw), 0, -Math.sin(camState.yaw));
  const sh = (mem ? 0.55 : inside ? 0.45 : 0.38) * (upright ? 0.45 : 1);
  if (inside) head.y += 0.12; // indoors a little higher, looking over the shoulder
  // look ahead the way you're going, more at a run
  const ahead = camState.ahead || (camState.ahead = new THREE.Vector3());
  const lead = probe ? 0 : Math.min(1, me.speed / RUN) * (inside ? 0.45 : 0.9);
  const aim = _aim.set(Math.sin(me.yaw) * lead, 0, Math.cos(me.yaw) * lead);
  if (probe) ahead.set(0, 0, 0); else ahead.lerp(aim, 1 - Math.exp(-2.2 * dt));
  // the pivot: the shoulder, pulled toward the head if the shoulder itself would be inside something
  const pivot = _pivot.copy(head).addScaledVector(right, sh);
  // only the walls within reach of the camera this frame (the march below asks many times)
  if (camWallsFor !== set) { camWallList = camWalls(); camWallsFor = set; }
  _near.length = 0; const rr = dist + 0.6;
  for (const w of camWallList) if (pivot.x > w.x0 - rr && pivot.x < w.x1 + rr && pivot.z > w.z0 - rr && pivot.z < w.z1 + rr) _near.push(w);
  if (insideAny(pivot.x, pivot.y, pivot.z, 0.18, _near)) pivot.copy(head);
  // march out from the pivot; stop short of the first thing in the way
  const reach = o => { for (let i = 1; i <= 24; i++) { const t = (i / 24) * dist, x = pivot.x + o.x * t, y = pivot.y + o.y * t, z = pivot.z + o.z * t; if (insideAny(x, y, z, 0.24, _near)) return Math.max(0.1, t - 0.22); } return dist; };
  let free = reach(off);
  // how much room there is to see the way the camera looks (a view into the room beats a view of the wall)
  const view = (dx, dz) => { const l = Math.hypot(dx, dz) || 1; for (let i = 1; i <= 16; i++) { const t = i * 0.5; if (insideAny(head.x + dx / l * t, 1.2, head.z + dz / l * t, 0.05)) return t; } return 8; };
  // backed against a wall: rather than sit on your head, the camera swings round to where there's room (unless you're steering it)
  // in a corner it also rises and looks down over you
  if (!probe) {
    let best = 0, lift = 0;
    if (free < dist * 0.7 && camState.drag <= 0) {
      let bs = Math.min(free, dist) + (camState.init || camState.reframe ? 0.35 * view(-off.x, -off.z) : 0);
      // just arrived or just finished talking: look the whole way round for the room; walking: only lean a little
      const re = camState.init || camState.reframe;
      const das = re ? [...Array(16)].map((_, i) => ((i + 1) >> 1) * (i % 2 ? 1 : -1) * Math.PI / 8) : [0, 0.3, -0.3, 0.6, -0.6];
      for (const da of das) for (const pe of re ? [0, 0.2] : [0, 0.15, 0.3]) {
        if (!da && !pe) continue;
        const a = camState.yaw + da, pt = Math.min(0.95, pitch + pe), o2 = _o2.set(Math.sin(a) * Math.cos(pt), Math.sin(pt), Math.cos(a) * Math.cos(pt));
        const f = reach(o2), sc = Math.min(f, dist) + (re ? 0.35 * view(-o2.x, -o2.z) : 0) - Math.abs(da) * (re ? 0.12 : 0.5) - pe * 0.6;
        if (sc > bs + 0.25) { bs = sc; best = da; lift = pe; }
      }
      if (best) camState.yaw += best * (camState.init || camState.reframe ? 1 : 1 - Math.exp(-2.5 * dt));
      if (camState.init || camState.reframe) camState.lift = lift;
    }
    camState.lift = damp(camState.lift || 0, free < dist * 0.7 ? Math.max(lift, camState.lift > 0.02 && free < dist * 0.9 ? camState.lift : 0) : 0, 2, dt);
  }
  // in fast, out slow, so a pole sliding past doesn't make the camera pump
  if (probe || camState.cd == null || camState.init) camState.cd = free;
  else camState.cd = free < camState.cd ? damp(camState.cd, free, 18, dt) : damp(camState.cd, free, 2.2, dt);
  const want = _want.copy(pivot).addScaledVector(off, Math.min(camState.cd, free + 0.05));
  if (!probe) camState.close = damp(camState.close || 0, clamp((1.6 - Math.min(camState.cd, free)) / 1.1, 0, 1) * 0.3, 3, dt);
  // forced right up against you, you step out of the frame rather than fill it
  if (!probe && S.phase === "explore") me.group.visible = Math.min(camState.cd, free) > 0.45;
  const look = _look.copy(head).addScaledVector(right, sh * 0.7).add(ahead); look.y += mem ? -0.25 : -0.1;
  // risen close over you, it looks out past you into the room, not down at the floor
  if (!probe && camState.close > 0.01) { look.add(_tmp.set(-off.x, 0, -off.z).normalize().multiplyScalar(camState.close * 5)); look.y += camState.close * 0.8; }
  return _fv;
}
function rail(points, looks, dur) {
  return new Promise(res => {
    camState.rail = { pos: new THREE.CatmullRomCurve3(points), look: new THREE.CatmullRomCurve3(looks), t: 0, dur: FAST ? 0.2 : still() ? Math.min(dur, 2) : dur, done: () => { camState.rail = null; res(); } };
  });
}

/* ================================================================
   MOVEMENT: keys, the stick, the pad (analog: a light push walks, a full one
   runs), and tap to walk along a path around the cars; walls; cloth
   ================================================================ */
const keys = {};
const WALK = 1.45, RUN = 2.6, RUN_AT = 0.82, DEAD = 0.14;
const mv = { x: 0, z: 0, mag: 0, runLatch: false, path: null, pi: 1, after: null, stuck: 0, idle: 0, running: false, src: "" };
const pad = { x: 0, y: 0, mag: 0 };
let nav = null, navFor = null;
function navNow() { if (!set) return null; if (navFor !== set) { nav = buildNav(set); navFor = set; } return nav; }
/* if a placement (a restore, a scene change, getting out of a car) left you inside something or outside the set,
   step to the nearest clear ground, on a widening ring */
function unstick(p) {
  if (!set || !blocked(p.pos.x, p.pos.z)) return false;
  for (let r = 0.4; r <= 8; r += 0.4) for (let a = 0; a < 16; a++) {
    const x = p.pos.x + Math.sin(a / 16 * Math.PI * 2) * r, z = p.pos.z + Math.cos(a / 16 * Math.PI * 2) * r;
    if (!blocked(x, z)) { p.pos.x = x; p.pos.z = z; return true; }
  }
  return false;
}
function blocked(x, z, r = 0.28) {
  for (const w of set.userData.walls) if (x > w.x0 - r && x < w.x1 + r && z > w.z0 - r && z < w.z1 + r) return true;
  const b = set.userData.bounds; if (b && (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1)) return true;
  for (const k of Object.keys(P)) { const p = P[k]; if (p === me || !p.group.visible) continue; if (Math.hypot(p.pos.x - x, p.pos.z - z) < 0.55) return true; }
  return false;
}
const keyOn = name => !!keys[SET.keys[name]];
const runHeld = () => (SET.runToggle ? mv.runLatch : !!keys[SET.keys.run]);
/* how fast for a push: a dead zone, a walk that grows with the push, then a clear step up to a run */
function speedFor(m) { return m <= 0 ? 0 : m >= RUN_AT ? RUN : WALK * (0.28 + 0.72 * Math.min(1, m / (RUN_AT - 0.04))); }
function wantInput() {
  if (S.phase !== "explore" || S.busy) return null;
  const kx = (keyOn("right") || keys.arrowright ? 1 : 0) - (keyOn("left") || keys.arrowleft ? 1 : 0);
  const kz = (keyOn("down") || keys.arrowdown ? 1 : 0) - (keyOn("up") || keys.arrowup ? 1 : 0);
  if (kx || kz) { const l = Math.hypot(kx, kz); return { x: kx / l, z: kz / l, m: runHeld() ? 1 : RUN_AT - 0.04, src: "keys" }; }
  if (mv.mag > 0) return { x: mv.x, z: mv.z, m: mv.mag, src: "stick" };
  if (pad.mag > 0) return { x: pad.x, z: pad.y, m: pad.mag, src: "pad" };
  return null;
}
let clothT = 0;
function moveMe(dt) {
  if (!me) return;
  const inp = wantInput();
  // seated (or sitting down, or getting up): people.js has the body; any move gets you up (a push of the stick or a
  // key, or a tap on the ground: its walk waits until you're on your feet, then goes)
  if (me.inCar) { if (me.seated && (inp || mv.path) && me.standUp) me.standUp(); return; }
  // a jump: the air carries the body; on the ground again the walk takes over
  jumpTick(dt);
  if (me.jumping && jumpMove(dt, inp)) return;
  let speed = 0, dir = null;
  const prevSpeed = me.speed;
  if (inp) {
    if (mv.path) { mv.path = null; mv.after = null; guide.clearRing(); }
    const a = Math.atan2(inp.x, inp.z) + camState.yaw; // camera relative
    dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    speed = speedFor(inp.m); mv.running = inp.m >= RUN_AT; mv.src = inp.src;
    mv.idle = 0;
  } else if (mv.path && S.phase === "explore") {
    const last = mv.path.length - 1;
    let tgt = mv.path[mv.pi], d = new THREE.Vector3(tgt.x - me.pos.x, 0, tgt.z - me.pos.z), L = d.length();
    while (L < 0.25 && mv.pi < last) { mv.pi++; tgt = mv.path[mv.pi]; d.set(tgt.x - me.pos.x, 0, tgt.z - me.pos.z); L = d.length(); }
    let rest = L; for (let k = mv.pi; k < last; k++) rest += Math.hypot(mv.path[k + 1].x - mv.path[k].x, mv.path[k + 1].z - mv.path[k].z);
    if (mv.pi === last && L < 0.12) arrive(false);
    else { dir = d.normalize(); speed = Math.min(rest * 2.2, mv.pathRun && rest > 3 ? RUN : WALK); mv.running = speed > WALK + 0.1; }
    mv.idle = 0;
  } else { mv.idle += dt; mv.running = false; }
  if (dir && speed > 0) {
    me.wantYaw = Math.atan2(dir.x, dir.z);
    const turn = Math.abs(angTo(me.yaw, me.wantYaw));
    const sp = speed * (turn > 1.6 ? 0.25 : 1);
    let nx = me.pos.x + dir.x * sp * dt, nz = me.pos.z + dir.z * sp * dt;
    let moved = true;
    if (!blocked(nx, nz) || blocked(me.pos.x, me.pos.z)) { me.pos.x = nx; me.pos.z = nz; } // stuck inside something: let them walk out
    else if (!blocked(nx, me.pos.z)) me.pos.x = nx;
    else if (!blocked(me.pos.x, nz)) me.pos.z = nz;
    else {
      // someone in the way: lean around them
      moved = false;
      for (const s2 of [0.8, -0.8, 1.4, -1.4]) { const c = Math.cos(s2), si = Math.sin(s2), x2 = me.pos.x + (dir.x * c - dir.z * si) * sp * dt, z2 = me.pos.z + (dir.x * si + dir.z * c) * sp * dt; if (!blocked(x2, z2)) { me.pos.x = x2; me.pos.z = z2; moved = true; break; } }
    }
    if (mv.path) { mv.stuck = moved ? 0 : mv.stuck + dt; if (mv.stuck > 0.8) arrive(true); }
    me.speed = damp(me.speed, sp, 10, dt);
    // cloth: setting off, or a sharp turn
    clothT -= dt;
    if (clothT <= 0 && ((prevSpeed < 0.25 && me.speed > 0.25) || turn > 1.3)) { AU.cloth(footAt(me), turn > 1.3 ? 0.9 : 0.6); clothT = 0.9; }
  } else {
    if (prevSpeed > 1.2 && clothT <= 0) { AU.cloth(footAt(me), 0.5); clothT = 0.9; }
    me.speed = damp(me.speed, 0, 12, dt);
  }
}
/* the end of a tap-to-walk: the ring closes with a soft sound and a tap, or, when it led to a thing, the thing takes over */
function arrive(gaveUp) {
  const f = mv.after; mv.path = null; mv.after = null; mv.stuck = 0;
  if (gaveUp) { guide.clearRing(); return; } // a walk that can't finish ends quietly
  if (f) { guide.clearRing(); f(); return; }
  guide.land(); AU.ui("land"); hap("tap");
}
function walkTo(v, then, o = {}) {
  const n = navNow(); if (!n || !me) return false;
  const path = n.path(me.pos.x, me.pos.z, v.x, v.z);
  if (!path) return false;
  mv.path = path; mv.pi = 1; mv.after = then || null; mv.stuck = 0;
  mv.pathRun = !!o.run || pathLen(path) > 9;
  if (o.ring !== false) { const e = path[path.length - 1]; guide.ring(e.x, e.z); }
  return true;
}

/* ---------- the jump: Space, A with nothing to use (X any time), the Jump button under the right thumb on a touch screen.
   Only on your feet, exploring: never talking, seated, in a car or in a cutscene. people.js does the body (the crouch,
   the air, the knees taking it); here the ground carries it: a running jump keeps its speed, a standing one stays put
   with a little steer, and the walls (every car, pole and desk) stop it in the air as on the ground, so nothing gets
   jumped over or onto. The landing is one frame: the step on that surface (a splash in a puddle), the haptic and the
   rumble, and the camera's dip. Nothing here allocates per frame ---------- */
const JUMP = { vx: 0, vz: 0, dip: 0, dipT: 1, dipA: 0, n: 0, at: { x: 0, y: 0.05, z: 0 } };
/* the floor under a point: the world can give heights (set.userData.heightAt); the sets are flat otherwise */
function groundY(x, z) { const h = set && set.userData.heightAt; return typeof h === "function" ? h(x, z) || 0 : 0; }
function canJump() {
  return !!(me && me.jump && S.open && S.phase === "explore" && !S.busy && !HOLDG && !DRV.state && !me.inCar && !me.jumping && !S.skipOpen && !choosing && me.group.visible &&
    !(me.reaches && (me.reaches.l || me.reaches.r)) && !(me.shot));
}
function jump(how) {
  if (!canJump()) return false;
  if (mv.path) { mv.path = null; mv.after = null; guide.clearRing(); }
  mv.idle = 0;
  const run = clamp((me.speed - WALK) / (RUN - WALK), 0, 1);
  const p = me.jump({ run, ground: groundY, onTakeoff: jumpOff, onLand: jumpLand });
  if (!p) return false;
  JUMP.n++; JUMP.how = how || "";
  return true;
}
function jumpAt() { JUMP.at.x = me.pos.x; JUMP.at.z = me.pos.z; return JUMP.at; }
/* off the ground: the speed you had is the speed you keep; a scuff and the cloth */
function jumpOff() {
  JUMP.vx = me.vel.x; JUMP.vz = me.vel.z;
  const at = jumpAt();
  AU.step(surfaceAt(at.x, at.z), { at, gain: 0.35, ref: 4.2 }); AU.cloth(at, 0.7);
}
/* down: the step on whatever is underfoot (a splash in a puddle), the haptic, the rumble and the camera's dip, together */
function jumpLand(imp) {
  const at = jumpAt(), surf = surfaceAt(at.x, at.z);
  const heard = AU.step(surf, { at, run: imp > 0.5, gain: 0.9 + imp * 0.6, ref: 4.2 });
  if (surf === "puddle") AU.use("splash", at);
  hap(imp > 0.7 ? "select" : "tap", 0.6 + imp);
  // the camera starts down this frame (the knees already have: people.js began the absorb as it touched)
  JUMP.dipA = still() ? 0 : 0.04 + 0.07 * imp; JUMP.dipT = 0.06; JUMP.dip = JUMP.dipA * Math.sin(JUMP.dipT * Math.PI);
  mv.idle = 0;
  if (DEBUG) JUMP.last = { t: performance.now(), surf, heard: !!heard, imp: +imp.toFixed(2), dip: +JUMP.dip.toFixed(3), crouch: +(me.jC || 0).toFixed(3) };
}
/* the ground under a jump: in the air the body goes where the takeoff sent it (a little steer from the stick); landing
   from a run it rolls on unless you push somewhere else. Returns true when it has moved the body this frame */
function jumpMove(dt, inp) {
  const air = me.airborne, land = me.jumping && !air && me.jmp.st === "land";
  if (!air && !(land && !inp)) return false;
  if (air && inp) {
    const a = Math.atan2(inp.x, inp.z) + camState.yaw, sp = speedFor(inp.m);
    JUMP.vx = damp(JUMP.vx, Math.sin(a) * Math.max(sp, Math.hypot(JUMP.vx, JUMP.vz)), 1.6, dt);
    JUMP.vz = damp(JUMP.vz, Math.cos(a) * Math.max(sp, Math.hypot(JUMP.vx, JUMP.vz)), 1.6, dt);
  }
  if (land) { JUMP.vx = damp(JUMP.vx, 0, 7, dt); JUMP.vz = damp(JUMP.vz, 0, 7, dt); }
  const nx = me.pos.x + JUMP.vx * dt, nz = me.pos.z + JUMP.vz * dt;
  // walls stop you in the air as on the ground: slide along them, never over
  if (!blocked(nx, nz) || blocked(me.pos.x, me.pos.z)) { me.pos.x = nx; me.pos.z = nz; }
  else if (!blocked(nx, me.pos.z)) { me.pos.x = nx; JUMP.vz = 0; }
  else if (!blocked(me.pos.x, nz)) { me.pos.z = nz; JUMP.vx = 0; }
  else { JUMP.vx = JUMP.vz = 0; }
  const sp = Math.hypot(JUMP.vx, JUMP.vz);
  if (sp > 0.3) me.wantYaw = Math.atan2(JUMP.vx, JUMP.vz);
  me.speed = sp; mv.idle = 0;
  return true;
}
/* the camera's dip on a landing, and the shadow left on the ground shrinking under you in the air */
function jumpTick(dt) {
  if (JUMP.dipT < 1) { JUMP.dipT = Math.min(1, JUMP.dipT + dt / 0.34); JUMP.dip = JUMP.dipA * Math.sin(JUMP.dipT * Math.PI) * (1 - JUMP.dipT * 0.35); }
  else JUMP.dip = 0;
  if (me.shadow) { const s = 1 - clamp(me.pos.y, 0, 1) * 0.45; if (me.shadow.scale.x !== s) me.shadow.scale.set(s, s, s); }
}

/* ---------- gamepad, on the standard mapping, in Xbox letters (a PlayStation pad's cross, circle, square, triangle
   are the same buttons). Walking: the left stick, on a curve so a light push is an easy stroll and all the way over
   runs (click it to keep running until you let go); the right stick looks (click it to put the camera back behind
   you). A uses what's prompted and jumps when nothing is, X jumps any time, B backs out, Y or View opens the journal,
   Menu pauses. Every menu, the choices, the journal, the board, the phone and the end: the D-pad or the left stick
   moves the focus, A chooses, B goes back. In the car: RT gas, LT brake, the left stick steers, A the handbrake,
   X the camera, B out. The pad rumbles wherever a haptic fires (skips and cancels have none, so they never rumble).
   Nothing here allocates per frame ---------- */
const padPrev = new Array(17).fill(false);
let padSeen = false, padGP = null;
const PADN = { dir: 0, t: 0, run: false, rc: 0, any: false };
/* the response curve: gentle at the bottom of the throw, so the slowest walk is easy to hold, and full at the top */
const padCurve = k => k * (0.25 + 0.75 * k);
function padNow() {
  if (!navigator.getGamepads) return null;
  const l = navigator.getGamepads();
  for (let i = 0; i < l.length; i++) { const g = l[i]; if (g && g.connected) return g; }
  return null;
}
function pb(i) { const b = padGP && padGP.buttons[i]; return !!(b && b.pressed); }
function pe(i) { return pb(i) && !padPrev[i]; }
function pv(i) { const b = padGP && padGP.buttons[i]; return b ? b.value || (b.pressed ? 1 : 0) : 0; }
/* the D-pad or the left stick as one direction (1 up, 2 down, 3 left, 4 right), once on the press, then repeating while held */
function padDir(dt) {
  const ax = padGP.axes[0] || 0, ay = padGP.axes[1] || 0;
  let d = pb(12) ? 1 : pb(13) ? 2 : pb(14) ? 3 : pb(15) ? 4 : 0;
  if (!d && ax * ax + ay * ay > 0.3) d = Math.abs(ay) >= Math.abs(ax) ? (ay < 0 ? 1 : 2) : (ax < 0 ? 3 : 4);
  if (d !== PADN.dir) { PADN.dir = d; PADN.t = 0.38; return d; }
  if (!d) return 0;
  PADN.t -= dt; if (PADN.t <= 0) { PADN.t = 0.11; return d; }
  return 0;
}
function padPoll(dt) {
  jumpUI();
  const gp = padNow(); padGP = gp;
  if (!gp) { pad.x = pad.y = pad.mag = 0; return; }
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, m = Math.hypot(ax, ay);
  // the left stick: a radial dead zone, then the curve; clicked, it runs until it comes back to centre
  if (m > DEAD) { const k = Math.min(1, (m - DEAD) / (1 - DEAD - 0.05)); pad.x = ax / m; pad.y = ay / m; pad.mag = PADN.run ? 1 : padCurve(k); }
  else { pad.x = pad.y = pad.mag = 0; PADN.run = false; }
  const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0, rm = Math.hypot(rx, ry);
  if (rm > 0.16) {
    // the right stick: the same kind of dead zone and curve, so a small correction is small
    const k = padCurve(Math.min(1, (rm - 0.16) / 0.8)) / rm;
    camState.yaw -= rx * k * 2.8 * dt * SET.look; camState.pitch = clamp(camState.pitch + ry * k * (SET.invert ? -1 : 1) * 1.5 * dt * SET.look, -0.15, 0.75); camState.drag = 1.5; PADN.rc = 0; setDev("pad");
  }
  let any = m > 0.3;
  for (let i = 0; i < gp.buttons.length && !any; i++) if (gp.buttons[i].pressed) any = true;
  if (any) { setDev("pad"); mv.idle = 0; }
  const dir = padDir(dt);
  // in the car: RT gas, LT brake, the left stick steers, A the handbrake, X the camera, B out
  pad.drive = S.phase === "drive" ? (pad.driveO || (pad.driveO = { rt: 0, lt: 0, sx: 0, a: 0 })) : null;
  if (pad.drive) { const d = pad.drive; d.rt = pv(7); d.lt = pv(6); d.sx = Math.abs(ax) > DEAD ? Math.sign(ax) * Math.min(1, (Math.abs(ax) - DEAD) / (1 - DEAD - 0.05)) : 0; d.a = pv(0); }
  const host = padHost();
  if (S.phase === "drive") { if (DRV.state !== "drive" && DRV.skip && (pe(0) || pe(1))) DRV.skip(); else if (pe(1)) exitCar("pad"); if (pe(2)) driveCam(); if (Math.abs(rx) > 0.16) { DRV.look = clamp(DRV.look - rx * 2.2 * dt * SET.look, -2.6, 2.6); DRV.lookT = 1.2; } }
  else if (S.skipOpen) { if (pe(0) || pe(1)) act("a"); }
  else if (host && (S.phase === "pause" || S.phase === "journal" || !choosing)) {
    if (dir) padMove(host, dir);
    if (pe(0)) padPress(host);
    if (pe(1)) act("b");
    // the journal (or a long end) scrolls on the right stick
    if (Math.abs(ry) > 0.2) { const sc = padScroller(host); if (sc) sc.scrollTop += ry * 900 * dt; }
  }
  else if (choosing) { if (dir === 1) moveChoice(-1); else if (dir === 2) moveChoice(1); if (pe(0)) act("a"); }
  else {
    if (pe(0)) { if (S.phase === "explore" && !near) jump("pad"); else act("a"); }
    if (pe(2)) jump("pad");
    if (pe(1)) act("b");
    if (pe(10) && S.phase === "explore") PADN.run = !PADN.run;
    if (pe(11) && S.phase === "explore" && me) PADN.rc = 0.45;
  }
  if (pe(9)) act("pause"); if (pe(3) || pe(8)) act("journal");
  // the right stick's click: the camera swings back behind you
  if (PADN.rc > 0 && me) { PADN.rc -= dt; camState.yaw += angTo(camState.yaw, me.yaw + Math.PI) * (1 - Math.exp(-12 * dt)); camState.pitch = damp(camState.pitch, 0.2, 12, dt); camState.drag = 0.2; }
  padLegend();
  for (let i = 0; i < padPrev.length; i++) padPrev[i] = pb(i);
}
/* what the pad is driving: the menu or the screen that's up, or nothing (the world) */
function padHost() {
  const ph = S.phase;
  if (ph === "pause") return pauseEl;
  if (ph === "journal") return journalEl;
  if (ph === "sheet") return sheetEl;
  if (ph === "close") return closeEl;
  if (ph === "end" && !endEl.hidden) return endEl;
  return null;
}
const PAD_SEL = "button:not([disabled]), a[href], input:not([disabled]):not([type=hidden]), select, textarea, [data-car], [data-note]";
/* a thing the focus can land on: on screen, shown, and on the phone's current screen */
function padOk(e) {
  if (!e || !e.isConnected || e.closest("[hidden]")) return false;
  const sc = e.closest(".app-screen"); if (sc && !sc.classList.contains("is-on")) return false;
  const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return false;
  const cs = getComputedStyle(e); return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05;
}
function padList(host) { return $$(PAD_SEL, host).filter(padOk); }
function padFocus(e) {
  if (!e.matches("button, a[href], input, select, textarea") && !e.hasAttribute("tabindex")) e.setAttribute("tabindex", "-1");
  e.focus({ preventScroll: true });
  try { e.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (x) {}
}
/* nothing focused here yet: the first thing, or the one that's chosen (the open tab, the main button) */
function padFirst(host) {
  const l = padList(host); if (!l.length) return null;
  // a way back (the phone's own back, the Back button) is never where the focus starts unless it's all there is
  const e = l.find(x => x.getAttribute("aria-selected") === "true" || x.classList.contains("btn--primary") || x.classList.contains("app-btn--gold")) || l.find(x => !x.matches("[data-back], .st-back, .st-x, [data-st$='back']")) || l[0];
  padFocus(e); return e;
}
function padCur(host) { const a = document.activeElement; return a && a !== document.body && host.contains(a) && padOk(a) ? a : null; }
/* move the focus the way pressed: the nearest thing that way on screen, so rows, columns and the phone's lists all work */
function padMove(host, dir) {
  const cur = padCur(host);
  if (!cur) { if (padFirst(host) && SC()) SC().tick(); return; }
  if (cur.matches("input[type=range]") && dir > 2) {
    cur.value = String(+cur.value + (dir === 4 ? 5 : -5));
    cur.dispatchEvent(new Event("input", { bubbles: true })); cur.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  const r0 = cur.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
  let best = null, bs = 1e9;
  for (const e of padList(host)) {
    if (e === cur || e.contains(cur) || cur.contains(e)) continue;
    const r = e.getBoundingClientRect(), dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
    // across: the gap between the two side by side (none when they overlap, as a wide slider under a toggle does)
    const along = dir === 1 ? -dy : dir === 2 ? dy : dir === 3 ? -dx : dx;
    const gap = dir < 3 ? Math.max(0, r.left - r0.right, r0.left - r.right) : Math.max(0, r.top - r0.bottom, r0.top - r.bottom);
    if (along < 4) continue;
    const sc = along + gap * 2.2 + (dir < 3 ? Math.abs(dx) : Math.abs(dy)) * 0.1;
    if (sc < bs) { bs = sc; best = e; }
  }
  if (best) { padFocus(best); if (SC()) SC().tick(); }
}
/* A: press what has the focus (a slider takes left and right instead); nothing focused yet, find something first */
function padPress(host) {
  const cur = padCur(host);
  if (!cur) { padFirst(host); return; }
  if (cur.matches("input[type=range]")) return;
  cur.click();
}
function padScroller(host) {
  for (const s of [".jr-b", ".app-screen.is-on .app-scroll", ".en"]) { const e = host.querySelector(s); if (e && e.scrollHeight > e.clientHeight + 2) return e; }
  return host.scrollHeight > host.clientHeight + 2 ? host : null;
}
/* the rumble: the haptic's pattern as a dual-rumble on the pad in use, scaled by k */
const RUMBLE = { tap: [0.1, 0.32, 45], select: [0.22, 0.45, 70], arrive: [0.14, 0.36, 90], success: [0.5, 0.65, 240], unlock: [0.38, 0.55, 140], heart: [0.2, 0.3, 200] };
function rumble(kind, k) {
  const gp = padGP, va = gp && gp.vibrationActuator;
  if (dev !== "pad" || !va || !va.playEffect) return;
  const R = RUMBLE[kind] || RUMBLE.tap, s = k == null ? 1 : k;
  try { const p = va.playEffect(va.type || "dual-rumble", { startDelay: 0, duration: R[2], strongMagnitude: Math.min(1, R[0] * s), weakMagnitude: Math.min(1, R[1] * s) }); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}
/* every haptic in the episode (the story's own, the site's sounds and stings through JG_FX, the phone on the desk) also
   rumbles the pad while the episode is open; the site's own haptic carries on as it was */
(() => {
  const h0 = window.JG_HAPTIC;
  if (h0 && h0.__pad) return;
  const h = function (kind, k) { if (h0) h0(kind); if (S.open) rumble(kind, k); };
  h.__pad = true; window.JG_HAPTIC = h;
})();
function moveChoice(d) { const bs = $$(".st-ch", choicesOl); const i = bs.indexOf(document.activeElement); const n = clamp((i < 0 ? 0 : i + d), 0, bs.length - 1); if (bs[n]) { bs[n].focus({ preventScroll: true }); if (SC()) SC().tick(); } }

/* ================================================================
   INTERACTION: spots, prompts, talking
   ================================================================ */
let spotsMemo = null, spotsFrame = -1, frameNo = 0;
function spotsHere() {
  if (spotsFrame === frameNo && spotsMemo) return spotsMemo;
  spotsFrame = frameNo; spotsMemo = spotsHere0();
  return spotsMemo;
}
/* a once-only thing you've already looked at: its narrated thought, said again (no trophy, journal or step twice) */
const thoughtMemo = {};
const dotEls = new Map(); let dotGen = 0;
function clearDots() { if (dotEls.size) { for (const b of dotEls.values()) b.remove(); dotEls.clear(); } if (dotsEl.firstChild) dotsEl.innerHTML = ""; }
function thoughtOf(id) {
  if (id in thoughtMemo) return thoughtMemo[id];
  const o = OBJ[id], T0 = o && o.talk && TALK[o.talk];
  return (thoughtMemo[id] = T0 && !T0.choices && !T0.next ? (T0.lines || []).filter(L => L.who === "you") : null);
}
async function sayAgain(lines) {
  setPhase("talk"); promptEl.hidden = true; actEl.hidden = true; objEl.classList.add("is-dim"); el.classList.add("is-talking");
  for (const L of lines) { if (cond(L.if)) { await sayLine(L); if (!FAST) await sleep(120); } }
  if (S.phase === "talk") endTalk();
}
function spotsHere0() {
  const out = [];
  for (const [id, o] of Object.entries(OBJ)) {
    const sceneOk = o.scene === S.scene || (o.scene === "lot" && S.scene === "lot");
    if (!sceneOk) continue;
    if (o.if && !cond(o.if)) continue;
    if (o.once && S.looked[id] && !o.again && !thoughtOf(id)) continue; // looked at: only a thought you can have again stays
    const sp = set.userData.spots[id]; if (!sp) continue;
    let p = sp.p;
    if (sp.who) { const who = P[sp.who]; if (!who || !who.group.visible) continue; p = headOf(who).add(new THREE.Vector3(0, -0.15, 0)); }
    out.push({ id, o, sp, p });
  }
  return (S.scene === "decision" ? out.filter(s => s.id === "jason-end") : out).concat(worldSpots(), carSpots());
}
/* the world's own spots (tools/story/HANDOFF-explore.md): { kind, label, p | at, stand, to } that aren't story
   objects. Exits take you to another set; the rest are things to use: switch, open, sit, press, pick up, read,
   splash, knock. No story text: a reach, a sound, a haptic, and what the world does with it. */
const WORLD_KINDS = ["exit", "toggle", "open", "sit", "press", "pickup", "read", "splash", "knock"];
const worldSpotCache = new WeakMap();
function worldSpots() {
  const sp = set && set.userData.spots; if (!sp) return [];
  // a story object with the same id wins where the story uses it (the lot's office door); elsewhere the world's own
  // (a lost plate found, or a door in front of one opened or shut, starts the list again)
  let store0 = worldSpotCache.get(set);
  if (!store0 || store0.gen !== lostGen.n) { store0 = { gen: lostGen.n }; worldSpotCache.set(set, store0); }
  const key = S.scene;
  let c = store0[key];
  if (!c) {
    c = [];
    for (const [id, x] of Object.entries(sp)) {
      if (!x || !x.kind || !WORLD_KINDS.includes(x.kind)) continue;
      if (OBJ[id] && OBJ[id].scene === S.scene && S.scene !== "decision") continue;
      if (x.tag && (S.tags.includes(id) || (x.when && !x.when()))) continue;
      const p = x.p || x.at; if (!p) continue;
      const pv = p.isVector3 ? p : new THREE.Vector3(p.x, p.y || 1, p.z);
      c.push({ id, o: { verb: UI["v_" + x.kind] || UI.act, label: x.label || (x.kind === "exit" ? (UI["to_" + x.to] || x.to) : ""), world: x.kind }, sp: Object.assign(x, { r: x.r || 1.8 }), p: pv });
    }
    store0[key] = c; worldSpotCache.set(set, store0);
  }
  return c;
}
async function useWorld(s, how) {
  const x = s.sp, kind = x.kind, at = s.p;
  if (x.tag) { pickPlate(s, how); return; }
  mv.path = null; mv.after = null; guide.clearRing(); progress();
  T("story_use", { id: s.id, kind, scene: S.scene, how: how || "" });
  if (kind === "exit") { FX("arrive"); AU.use("exit", at); hap("tap"); await roam(x.to); return; }
  S.looked[s.id] = (S.looked[s.id] || 0) + 1;
  me.wantYaw = Math.atan2(at.x - me.pos.x, at.z - me.pos.z);
  let fired = false;
  const feel = () => {
    if (fired) return; fired = true;
    x.on = !x.on;
    FX("arrive"); if (kind !== "knock") AU.use(kind, at, x.on); hap("tap");
    try { if (typeof x.use === "function") x.use({ kind, on: x.on, who: me }); } catch (e) {}
    // the first time, your thought about it, said as you carry on (a sign's own words are in it); after that, the sign
    const th = WTH[s.id];
    if (th && S.looked[s.id] === 1) murmur(s.id, th);
    else if (kind === "read" && x.text) toast(x.text);
    document.dispatchEvent(new CustomEvent("jg:story-use", { detail: { id: s.id, kind, on: x.on } }));
  };
  const safety = () => setTimeout(feel, FAST ? 0 : 2500); // a move that never lands still gets its answer
  const pt = at.clone ? at.clone() : new THREE.Vector3(at.x, at.y, at.z);
  try {
    if (kind === "sit") {
      if (me.seated) { if (me.standUp) await me.standUp(); return; }
      const seat = x.seat || at, yaw = x.yaw != null ? x.yaw : me.yaw;
      const sitNow = async () => {
        setPhase("cinematic"); feel(); // people.js moves the body until it has sat; a press or a push gets you up
        const go = me.sitDown || me.sitAt;
        try { const r = go.call(me, seat, yaw); await Promise.race([r, new Promise(res => setTimeout(res, 10000))]); } catch (e) {}
        if (S.phase === "cinematic") setPhase("explore");
      };
      const ap = me.seatApproach ? me.seatApproach(seat, yaw) : null;
      if (ap && Math.hypot(ap.x - me.pos.x, ap.z - me.pos.z) > 0.6 && walkTo(ap, () => { sitNow(); }, { ring: false })) return;
      await sitNow(); return;
    }
    if (kind === "splash") { feel(); return; }
    if (kind === "toggle" && me.flip) { safety(); await me.flip(pt, { dir: x.on ? "up" : "down", onFlip: feel }); feel(); return; }
    if (kind === "press" && me.press) { safety(); await me.press(pt, { onContact: feel }); feel(); return; }
    if (kind === "knock" && me.knock) {
      safety(); await me.knock(pt, { n: 3, onKnock: i => { AU.use("knock1", at); if (!i) feel(); } }); feel(); return;
    }
    if (kind === "knock") { AU.use("knock", at); feel(); return; }
    if (kind === "open" && /lid/i.test(x.label || "") && me.openLid) {
      safety(); const R = new THREE.Vector3(Math.cos(me.yaw), 0, -Math.sin(me.yaw)).multiplyScalar(0.38);
      await me.openLid(() => ({ l: pt.clone().sub(R), r: pt.clone().add(R) }), { dur: 1.1, onProgress: t => { if (t > 0.02) feel(); }, letGo: 0.7 }); feel(); return;
    }
    if (kind === "open" && me.openWith) { safety(); await me.openWith(pt, { dur: 0.9, onProgress: t => { if (t > 0.02) feel(); } }); feel(); return; }
    if (kind === "read" && me.lookAt) { feel(); await me.lookAt(pt, { read: true, dur: 3 }); return; }
    if (me.reachTo) { safety(); const r = me.reachTo(pt, { hold: kind === "pickup" ? "pinch" : kind === "open" ? "grip" : "touch", onContact: feel }); if (r && r.catch) r.catch(feel); return; }
  } catch (e) {}
  feel();
}
/* the lost license plates (story/tags.js): walk up to one and pick it up, or tap it. The metal's clink and a soft
   chime, the haptic and the plate lifting off where it lay land in one frame, and a bar of marks shows how many you
   have (marks, not figures: no number on the page). The last one leaves a note, the score's sting and a page in the
   journal. No trophy: trophies are the record. Found plates ride in the save (as "tags"); Restart clears them */
let tagsEl = null, tagT = null, tagSeen = null, tagSeenGen = -1;
function plateBar(fresh) {
  let h = ""; const n = S.tags.length;
  for (let i = 0; i < LOST_IDS.length; i++) h += i < n ? (fresh && i === n - 1 ? '<i class="is-on is-new"></i>' : '<i class="is-on"></i>') : "<i></i>";
  return '<span class="st-marks" aria-hidden="true">' + h + "</span>";
}
function plateCount() {
  if (!tagsEl) { tagsEl = document.createElement("div"); tagsEl.className = "st-tags"; tagsEl.setAttribute("role", "status"); tagsEl.hidden = true; el.appendChild(tagsEl); }
  tagsEl.innerHTML = '<span class="st-tags__k">' + E(UI.tag) + "</span>" + plateBar(true) + '<span class="st-tags__f">' + E(UI.tags_found) + "</span>";
  tagsEl.hidden = false; tagsEl.classList.remove("is-on"); void tagsEl.offsetWidth; tagsEl.classList.add("is-on");
  clearTimeout(tagT); tagT = setTimeout(() => { tagsEl.classList.remove("is-on"); tagT = setTimeout(() => (tagsEl.hidden = true), 450); }, FAST ? 2500 : 3200);
}
function pickPlate(s, how) {
  if (S.tags.includes(s.id)) return;
  mv.path = null; mv.after = null; guide.clearRing(); progress();
  S.tags.push(s.id);
  const at = s.p, all = S.tags.length >= LOST_IDS.length;
  me.wantYaw = Math.atan2(at.x - me.pos.x, at.z - me.pos.z);
  AU.use("tag", at); hap("tap"); takeLostPlate(set, s.id, still()); plateCount();
  if (me.reachTo) { try { const r = me.reachTo(at.clone(), { hold: "pinch" }); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
  T("story_tag", { id: s.id, scene: S.scene, how: how || "", all });
  if (all) setTimeout(() => { notice(UI.tags_all); FX("unlock"); addJournal("tags"); save(); }, FAST ? 0 : 900);
  save();
}
function platesTick(dt) {
  if (!set || !set.userData.tags) return;
  if (tagSeen !== set || tagSeenGen !== lostGen.n) { syncLostPlates(set, S.tags); tagSeen = set; tagSeenGen = lostGen.n; }
  tickLostPlates(set, me && S.phase === "explore" ? me.pos : null, S.t, dt);
}
// a door in front of a lost plate opened or shut: what you can reach has changed
document.addEventListener("jg:story-use", () => { lostGen.n++; });
/* free roam between sets: the story's arrival talk plays only the first time; the way keeps pointing at the next step */
async function roam(to) {
  if (!to || !D.scenes[to] && to !== "lot") return;
  if (to === "lot" && S.visited && S.visited.decision) to = "decision";
  if (to === S.scene) return;
  const first = !(S.visited && S.visited[to]);
  setPhase("cinematic"); hideWorldUI();
  if (S.scene === "lot" && to === "office") officeDoor(1, 520);
  await fade(1, 600);
  const back = S.scene === "office" && (to === "lot" || to === "decision");
  await enter(to, { quiet: true, from: S.scene });
  officeDoor(back ? 0.9 : 0, 10); if (back) setTimeout(() => officeDoor(0, 700), 900);
  await sleep(150);
  await fade(0, 600);
  FX("arrive"); if (first) await sceneCard(to);
  setPhase("explore");
  const st = D.scenes[to] && D.scenes[to].start;
  if (st && TALK[st] && !S.flags["done-" + to]) { S.partner = to === "office" || to === "decision" ? P.jason : null; await startTalk(to); }
}
let near = null;
const v2 = new THREE.Vector3();
function project(p) { v2.copy(p).project(camera); return { x: (v2.x * 0.5 + 0.5) * VW, y: (-v2.y * 0.5 + 0.5) * VH, on: v2.z < 1 && Math.abs(v2.x) < 1.05 && Math.abs(v2.y) < 1.05 }; }
let nearLost = 0, lastNear = null;
function updatePrompts() {
  if (S.phase !== "explore" || !me || S.busy) { promptEl.hidden = true; actEl.hidden = true; clearDots(); near = null; lastNear = null; return; }
  const list = spotsHere();
  let best = null, bd = 1e9;
  for (const s of list) {
    const d = Math.hypot(s.p.x - me.pos.x, s.p.z - me.pos.z);
    const r = s.sp.r || 2;
    // facing matters a little: things in front of you win ties
    const a = Math.abs(angTo(me.yaw, Math.atan2(s.p.x - me.pos.x, s.p.z - me.pos.z)));
    // a story thing you haven't looked at yet wins over a plain thing beside it (the drawer in the filing cabinet)
    // and standing on a thing's own spot, facing it, means that thing (the radio under the whiteboard), whatever's beside
    // it; seated, the seat you're on (its prompt is how you get up)
    const st = s.sp.stand, own = me.seated ? (s.o.world === "sit" ? 2 : 0) : st && a < 0.7 ? Math.max(0, 1 - Math.hypot(st.x - me.pos.x, st.z - me.pos.z) / 0.6) : 0;
    // the thing that already has the prompt keeps it a little longer and a little further, so it doesn't flicker
    // between two things or go out under your thumb; on a touch screen every reach is a little longer
    const keep = s === near || (near && s.id === near.id);
    // (standing on a lost plate's own spot, facing it, it edges out the thing beside it: the laundromat's open door)
    const score = d + a * 0.35 - (OBJ[s.id] && !S.looked[s.id] ? 0.8 : 0) - (s.sp.tag && own > 0.5 ? 0.5 : 0) - own - (keep ? 0.3 : 0);
    const reach = r * (keep ? 1.3 : 1) + (dev === "touch" ? 0.4 : 0);
    if (d < reach && score < bd) { best = s; bd = score; }
  }
  if (best && (!near || best.id !== near.id)) progress();
  if (best) { near = best; lastNear = best; nearLost = 0; }
  else { if (near) nearLost = performance.now(); near = null; } // (the moment it went, not every frame since: the hold runs out)
  if (!best && lastNear && !list.some(s => s.id === lastNear.id)) lastNear = null; // (gone: picked up, or its set left behind)
  // faint dots on what's interactable nearby; things you haven't looked at yet shimmer when you're close; the nearest gets the full prompt
  dotGen++;
  for (const s of list) {
    if (s === best) continue;
    // (a lost plate gets its dot only up close: from across the lot, it's the glint you look for)
    const d = Math.hypot(s.p.x - me.pos.x, s.p.z - me.pos.z); if (d > (s.sp.tag ? 4.5 : 11)) continue;
    const q = project(s.p); if (!q.on) continue;
    const fresh = !S.looked[s.id] && !s.o.who && d < 7;
    let b = dotEls.get(s.id);
    if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "st-dot"; b.dataset.spot = s.id; b.innerHTML = "<i></i>"; b.setAttribute("aria-label", s.o.verb + " " + s.o.label); dotsEl.appendChild(b); dotEls.set(s.id, b); }
    b._gen = dotGen;
    if (b._fresh !== fresh) { b._fresh = fresh; b.classList.toggle("is-new", fresh); }
    const tx = "translate(" + q.x.toFixed(0) + "px," + q.y.toFixed(0) + "px)";
    if (b._tx !== tx) { b._tx = tx; b.style.transform = tx; }
  }
  for (const [id, b] of dotEls) if (b._gen !== dotGen) { b.remove(); dotEls.delete(id); }
  if (!best) {
    promptEl.hidden = true;
    // the big button stays a moment after you drift out of reach: a press then walks you back to the thing and uses it
    actEl.hidden = !(dev === "touch" && lastNear && performance.now() - nearLost < 900);
    return;
  }
  const q = project(best.p);
  // a thing above or beside the frame (the pylon sign seen up close on a phone) keeps its prompt at the edge of the screen
  if (v2.z >= 1) { q.x = VW / 2 - 60; q.y = 90; }
  q.x = clamp(q.x, 24, VW - 200); q.y = clamp(q.y, 84, VH - 110);
  promptEl.hidden = false;
  // seated, the seat's own prompt gets you up again
  const verb = best.o.world === "sit" && me.seated ? UI.v_stand || best.o.verb : best.o.verb;
  if (promptEl.dataset.spot !== best.id || promptEl.dataset.verb !== verb) {
    $(".st-prompt__verb", promptEl).textContent = verb; $(".st-prompt__label", promptEl).textContent = best.o.label;
    promptEl.dataset.spot = best.id; promptEl.dataset.verb = verb;
    $(".st-act__verb", actEl).textContent = verb; actEl.setAttribute("aria-label", verb + " " + best.o.label);
  }
  promptEl.style.transform = "translate(" + Math.round(q.x) + "px," + Math.round(q.y) + "px)";
  // on a touch screen, the thing you're next to also gets a big button under your right thumb
  actEl.hidden = dev !== "touch";
}
/* a press acts the moment the finger or button comes down, on what had the prompt then: a click arriving later
   (after the prompt moved, or went for a frame) would find nothing; the click that follows a press is swallowed */
let pressT = 0;
function pressUse(how) {
  if (S.phase !== "explore" || S.busy || HOLDG) return;
  pressT = performance.now();
  if (near) { interact(near.id, how); return; }
  // just out of reach (you drifted a step): walk back to it and use it
  if (lastNear && performance.now() - nearLost < 900) goInteract(lastNear.id);
}
promptEl.addEventListener("pointerdown", e => { if (e.button > 0) return; e.preventDefault(); e.stopPropagation(); pressUse("click"); });
// a click only counts from a keyboard (Enter or Space on the focused button): a pointer acts on the press itself, and a
// stray click (left over when something above closes under a finger) must never use whatever is underneath
promptEl.addEventListener("click", e => { e.stopPropagation(); if (e.detail === 0 && performance.now() - pressT > 600) pressUse("click"); });
dotsEl.addEventListener("pointerdown", e => { const b = e.target.closest("[data-spot]"); if (!b || e.button > 0) return; e.preventDefault(); e.stopPropagation(); pressT = performance.now(); goInteract(b.dataset.spot); });
dotsEl.addEventListener("click", e => { const b = e.target.closest("[data-spot]"); if (!b) return; e.stopPropagation(); if (e.detail === 0 && performance.now() - pressT > 600) goInteract(b.dataset.spot); });
function goInteract(id) {
  const s = spotsHere().find(x => x.id === id); if (!s) return;
  const stand = s.sp.stand || (s.sp.who ? P[s.sp.who].pos.clone().add(me.pos.clone().sub(P[s.sp.who].pos).setY(0).normalize().multiplyScalar(1.2)) : s.p);
  if (!walkTo(stand, () => interact(id, "walk"))) interact(id, "walk");
}
async function interact(id, how) {
  if (S.phase !== "explore" || S.busy || HOLDG) return;
  if (id.startsWith("car:")) { const c = drivables().find(x => "car:" + x.id === id); if (c) enterCar(c, how); return; }
  { const w = worldSpots().find(x => x.id === id); if (w) { await useWorld(w, how); return; } }
  const o = OBJ[id]; if (!o) return;
  const s = set.userData.spots[id] || {};
  mv.path = null; mv.after = null; guide.clearRing(); progress();
  const at = s.who && P[s.who] ? headOf(P[s.who]) : s.p ? s.p.clone() : me.pos.clone();
  if (o.go) { FX("arrive"); AU.thing(id, at); T("story_object", { id, scene: S.scene }); await travel(o.go); return; }
  const first = !S.looked[id];
  // sitting down beside him is a hold: the ring fills under your thumb, or nothing happens
  if (id === "june-jason" && first) {
    if (!(await holdTo(how))) return;
    S.looked[id] = 1; T("story_object", { id, scene: S.scene, first });
    await sitBeside();
    S.partner = P.jason; S.focusPoint = null;
    await runTalk(o.talk); return;
  }
  S.looked[id] = (S.looked[id] || 0) + 1;
  if (S.hint && S.hint.id === id) S.hint = null;
  T("story_object", { id, scene: S.scene, first });
  // the coffee: from the machine, into his hand, then the words
  if (id === "june-coffee" && first) { await coffeeRun(s.p ? { p: s.p, sp: s } : { p: me.pos.clone(), sp: {} }); S.partner = P.jason; S.focusPoint = null; await runTalk(o.talk); return; }
  // reach for the things you can touch: the sound, the haptic and the motion land when the hand does
  let fired = false;
  const feel = () => { if (fired) return; fired = true; FX("arrive"); AU.thing(id, at); if (id === "june-window" && set.userData.wipe) set.userData.wipe(s.p); };
  const touchable = /^(ledger|phone|keys|cabinet|book|laptop|door|arcade|mem-(folder|letter|cert|laptop|lamp|psych)|june-(window|phone|scan))$/.test(id) && s.p;
  // the arcade cabinet plays The Run: the episode steps aside, and comes back to this spot in the office when the run closes
  if (o.play) {
    if (!S.journal.includes("arcade")) { try { await doAct("journal:arcade"); } catch (e) {} }
    save(); S.fromArcade = true;
    if (me && me.reachTo && s.p) { try { me.reachTo(s.p.clone(), { hold: "press" }); } catch (e) {} }
    FX("arrive"); AU.thing(id, at); hap("tap");
    await sleep(FAST ? 0 : 450);
    close("arcade");
    setTimeout(() => { if (window.JG_GAME && window.JG_GAME.play) window.JG_GAME.play("", "cabinet"); }, 200);
    return;
  }
  if (me && touchable && me.reachTo) {
    try {
      const r = me.reachTo(s.p.clone(), { hold: id === "keys" ? "pinch" : /^(cabinet|door)$/.test(id) ? "grip" : "touch", onContact: feel });
      if (r && r.catch) r.catch(feel);
      setTimeout(feel, FAST ? 0 : 1200); // a reach that never lands still gets its answer
    } catch (e) { feel(); }
  } else {
    feel();
    if (me && me.play && touchable) { try { me.play("reach"); } catch (e) {} }
  }
  // face it, and let whoever it is face you
  const target = s.who ? P[s.who] : null;
  const tp = target ? target.pos : s.p;
  if (tp) me.wantYaw = Math.atan2(tp.x - me.pos.x, tp.z - me.pos.z);
  S.partner = target || (S.scene === "office" && ["cabinet", "laptop", "ledger", "board", "book"].includes(id) ? P.jason : S.scene === "lot" && id === "sold" ? P.jason : S.scene === "june" && ["june-window", "june-scan", "june-door"].includes(id) ? P.jason : null);
  S.focusPoint = s.p || null;
  const talk = !first && o.again ? o.again : o.talk;
  if (s.close) return;
  if (!first && o.once && !o.again) { const th = thoughtOf(id); if (th && th.length) await sayAgain(th); return; }
  await runTalk(talk);
}
async function runTalk(id) {
  if (DRV.state) exitCar("talk", true); // nobody talks to you through the glass: out first
  if (me) me.group.visible = true;
  setPhase("talk"); promptEl.hidden = true; clearDots(); objEl.classList.add("is-dim");
  el.classList.add("is-talking");
  const partner = S.partner;
  if (partner && me) { partner.lookAtP = headOf(me); me.lookAtP = headOf(partner); if (partner.pose !== "sit") partner.wantYaw = Math.atan2(me.pos.x - partner.pos.x, me.pos.z - partner.pos.z); if (!me.seated) me.wantYaw = Math.atan2(partner.pos.x - me.pos.x, partner.pos.z - me.pos.z); }
  // in the waiting room he keeps his eyes on the floor in front of him
  if (S.scene === "june" && partner === P.jason && P.jason.pose === "sit") partner.lookAtP = P.jason.pos.clone().add(new THREE.Vector3(Math.sin(P.jason.yaw) * 1.3, 0.15, Math.cos(P.jason.yaw) * 1.3));
  let cur = id;
  let guard = 0;
  while (cur && guard++ < 40) {
    const T0 = TALK[cur]; if (!T0) break;
    S.talking = cur; hintFrom(cur);
    if (cur === "sale-done") { S.flags.droven = 1; S.flags.testdrive = 1; }
    if (cur === "june-phone" && S.scene === "june") phoneBuzz(true, 2);
    if (T0.branch) { const b = T0.branch.find(x => cond(x.if)); cur = b ? b.go : null; continue; }
    if (T0.set) Object.assign(S.flags, T0.set);
    const lines = (T0.lines || []).filter(L => cond(L.if));
    for (let li = 0; li < lines.length; li++) {
      const L = lines[li];
      // the next recording loads while this one plays; at the last line, the first of each way on
      if (lines[li + 1]) preloadLine(lines[li + 1]);
      else for (const g of (T0.choices || []).filter(c => cond(c.if)).map(c => c.go).concat(T0.next || [])) { const n = TALK[g] && (TALK[g].lines || []).find(x => cond(x.if)); if (n) preloadLine(n); }
      await beat(L.id, 0);
      // he's the one who stands up first; and she drives away while the line is said
      if (L.id === "june-you-9" && P.jason) { P.jason.pose = "stand"; P.jason.heavy = 0.35; }
      const off = L.id === "sale-you-2" ? driveOff() : null;
      await sayLine(L);
      if (off) { await raceT(off, FAST ? 300 : 14000); S.heldShot = null; }
      await beat(L.id, 1);
      if (!FAST) await sleep(120);
    }
    let next = T0.next || null;
    if (T0.choices) {
      const c = await choose(T0);
      if (c.set) Object.assign(S.flags, c.set);
      if (c.set && c.set.gate === "helped" && set.userData.gate) { const g = set.userData.gate.position; AU.gate({ x: g.x, y: 1.2, z: g.z }); }
      if (c.set && c.set.phone2 && S.scene === "june") phoneChoice(c.set.phone2);
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
  camState.shot = null; S.partner = null; S.focusPoint = null; camState.juneIn = false;
  setPhase("explore");
  camState.yaw = me ? me.yaw + Math.PI : camState.yaw; camState.reframe = true; setTimeout(() => (camState.reframe = false), 80);
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
  else if (k === "lampoff") { const l = sets.memory && sets.memory.userData.deskLamp; if (l) { l.col = [0.15, 0.1, 0.06]; AU.thing("lampoff", l.p); } }
  return null;
}
function afterTalk() {
  // the office: once the desk and the call are done, Jason points at the book
  if (S.scene === "office" && S.flags.desked && S.flags.called && !S.flags.hinted) setTimeout(() => { if (S.phase === "explore" && !S.flags.hinted) { S.partner = P.jason; runTalk("book-hint"); } }, FAST ? 50 : 2200);
  // the memory: pack the desk, then the lamp
  if (S.scene === "memory" && !S.flags.packed) {
    const pack = Object.entries(OBJ).filter(([, o]) => o.pack && o.scene === "memory").map(([id]) => id);
    if (pack.every(id => S.looked[id])) { S.flags.packed = 1; objective(null); toast(D.objects["mem-lamp"].label); }
  }
  // the waiting room: the phone back on the seat after a call; once you've seen it all, he's ready to go
  if (S.scene === "june") {
    if (me && me.hold === "phone") setTimeout(() => { if (me.hold === "phone") { me.hold = null; if (set.userData.phone) set.userData.phone.visible = true; } }, FAST ? 30 : 500);
    if (S.flags.sat && !S.flags.juned) {
      const pack = Object.entries(OBJ).filter(([, o]) => o.pack && o.scene === "june").map(([id]) => id);
      if (pack.every(id => S.looked[id])) { S.flags.juned = 1; objective("june-go"); }
    }
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
/* the office door swings out toward the lot as you go through, and shuts behind you */
function officeDoor(to, ms) {
  const d = sets.lot && sets.lot.userData.officeDoor; if (!d || typeof d.open !== "function") return Promise.resolve();
  const from = d.t || 0, t0 = performance.now(), dur = FAST ? 20 : still() ? Math.min(ms, 150) : ms;
  return new Promise(res => { const step = () => { const u = Math.min(1, (performance.now() - t0) / dur); d.t = from + (to - from) * EZ(u); try { d.open(d.t); } catch (e) {} if (u < 1) requestAnimationFrame(step); else res(); }; step(); });
}
async function travel(to) {
  setPhase("cinematic"); promptEl.hidden = true; clearDots();
  if (S.scene === "lot" && to === "office") officeDoor(1, 520);
  const memoryIn = to === "memory" || to === "keys" || to === "june" || to === "sale";
  if (to === "memory") { fadeEl.classList.add("is-memory"); await fade(1, 1400, "#e9dfc8"); }
  else if (to === "keys") await fade(1, 1200, "#f3ead6");
  else if (S.scene === "june" && to === "sale") { await dawnBreak(); await fade(1, 1600, "#f6e7cc"); } // the morning arrives as relief
  else if (to === "june") await fade(1, 1600, "#05070a");
  else if (S.scene === "keys" || S.scene === "sale") await fade(1, 1400, "#f3ead6");
  else await fade(1, 700);
  await enter(to, { quiet: true });
  officeDoor(0, 10);
  if (to === "office") { const m = set.userData.marks.playerStart; AU.arriveOffice({ x: m.x + 0.4, y: 2.1, z: m.z + 1.1 }); }
  await sleep(200);
  await fade(0, memoryIn ? 1400 : 700);
  fadeEl.classList.remove("is-memory");
  FX("arrive"); await sceneCard(to);
  const st = D.scenes[to].start;
  setPhase("explore");
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
    setPhase("close"); el.classList.add("is-close");
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
    // the notes follow the board until the camera has settled (a slow device draws the cut late)
    const place = () => { for (const b of $$("[data-note]", closeEl)) { const q = project(set.userData.spots[b.dataset.note].p); b.style.left = clamp(q.x, 84, innerWidth - 84).toFixed(0) + "px"; b.style.top = q.y.toFixed(0) + "px"; } };
    const follow = setInterval(place, 250);
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
    const finish = () => { clearInterval(follow); closeEl.removeEventListener("click", onClick); removeEventListener("resize", onResize); if (me) me.group.visible = true; closeEl.classList.remove("is-on"); setTimeout(() => (closeEl.hidden = true), 300); el.classList.remove("is-close"); setPhase("talk"); resolve(); };
    closeEl.addEventListener("click", onClick);
    S.closeFinish = finish;
  });
}

/* ---------- the desk: Handle a Sale on a phone, fictional buyer, example figures ---------- */
function openDesk() {
  return new Promise(resolve => {
    setPhase("sheet"); sheetEl.hidden = false; requestAnimationFrame(() => sheetEl.classList.add("is-on"));
    const host = $("[data-desk-app]", sheetEl);
    if (!host.firstChild && window.JG_DESK) window.JG_DESK.build(host);
    let done = false;
    const iv = setInterval(() => {
      const on = $(".app-screen.is-on", host);
      if (on && /Filed/.test(on.getAttribute("aria-label") || on.textContent)) { done = true; finish(true); }
    }, 250);
    const finish = ok => { clearInterval(iv); sheetEl.classList.remove("is-on"); setTimeout(() => { sheetEl.hidden = true; }, 350); setPhase("talk"); if (ok) FX("send"); resolve(ok); };
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
  if (sp && sp.p) { p = sp.p.clone(); r = sp.sketchR || 0.55; }
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
  AU.ui("page"); hap("tap"); AU.veil(true); hideWorldUI();
  setTimeout(() => { const b = $("[aria-selected='true']", journalEl); if (b && dev !== "touch") b.focus({ preventScroll: true }); }, 60);
}
function closeJournal() { journalEl.classList.remove("is-on"); setTimeout(() => (journalEl.hidden = true), 300); S.phase = S.prevPhase || "explore"; AU.veil(false); }
function renderJournal() {
  const people = ["jason", "dell", "renata"].filter(k => (k === "jason" && S.flags.met) || (k === "dell" && S.looked.dell) || (k === "renata" && S.flags.desked));
  const things = S.journal.filter(k => !["jason", "dell", "renata"].includes(k));
  const entry = k => { const J = D.journal[k]; const sk = sketches[k] || sketches[J.sketch]; return '<li class="jr-e">' + (sk ? '<img src="' + sk + '" alt="" />' : '<span class="jr-e__blank" aria-hidden="true"></span>') + "<div><h4>" + E(J.h) + (J.fictional ? ' <small>' + E(UI.fictional) + "</small>" : "") + "</h4><p>" + E(J.p) + "</p>" + (k === "tags" ? plateBar() : "") + "</div></li>"; };
  // the lost plates found so far, as marks, until the last one gives them their own page
  const tagRow = S.tags.length && !things.includes("tags") ? '<li class="jr-e jr-tags"><span class="jr-e__blank" aria-hidden="true"></span><div><h4>' + E(UI.tag) + "</h4>" + plateBar() + "<p>" + E(UI.tags_found) + "</p></div></li>" : "";
  const tabs = [["things", UI.j_things], ["people", UI.j_people], ["trophies", UI.j_trophies], ["choices", UI.j_choices]];
  let inner = "";
  if (jTab === "things") inner = things.length || tagRow ? '<ul class="jr-list">' + things.map(entry).join("") + tagRow + "</ul>" : '<p class="jr-empty">' + E(UI.j_empty) + "</p>";
  else if (jTab === "people") inner = people.length ? '<ul class="jr-list">' + people.map(entry).join("") + "</ul>" : '<p class="jr-empty">' + E(UI.j_empty) + "</p>";
  else if (jTab === "trophies") inner = S.trophies.length ? '<ul class="jr-tro">' + S.trophies.map(s => { const t = LIB.trophies[s]; return '<li><img src="assets/game/medals/' + s + '-160.webp" alt="" width="48" height="48" /><div><b>' + E(t.name) + "</b><p>" + E(t.desc) + "</p></div></li>"; }).join("") + "</ul>" : '<p class="jr-empty">' + E(UI.j_empty) + "</p>";
  else inner = '<ul class="jr-ch">' + recapLines().map(t => "<li>" + E(t) + "</li>").join("") + "</ul>";
  journalEl.innerHTML = '<div class="jr"><header class="jr-h"><h3>' + E(UI.journal) + '</h3><nav class="jr-tabs" role="tablist">' + tabs.map(([k, l]) => '<button type="button" role="tab" aria-selected="' + (k === jTab) + '" data-tab="' + k + '">' + E(l) + "</button>").join("") + '</nav><button class="st-x" type="button" data-st="journal-close" aria-label="Close the journal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header><div class="jr-b">' + inner + "</div></div>";
}
journalEl.addEventListener("click", e => {
  const t = e.target.closest("[data-tab]"); if (t) { jTab = t.dataset.tab; renderJournal(); AU.ui("tab"); hap("tap"); const nb = $("[data-tab='" + jTab + "']", journalEl); if (nb) nb.focus({ preventScroll: true }); return; }
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
  if (f.june && R.june) out.push(R.june[f.june]);
  if (f.phone2 && R.phone2) out.push(R.phone2[f.phone2]);
  if (f.sale1 && R.sale1) out.push(R.sale1[f.sale1]);
  const things = Object.keys(S.looked).filter(k => OBJ[k] && !OBJ[k].who && !OBJ[k].go && OBJ[k].verb !== "Go" && !k.startsWith("note-")).map(k => (OBJ[k].recap || OBJ[k].label).toLowerCase()).map(t => (/^(dell|jason|renata)$/i.test(t) ? t : (t.startsWith("the ") ? t : "the " + t))).filter((t, i, a) => a.indexOf(t) === i);
  if (things.length) out.push(R.looked + " " + listOf(things) + ".");
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
  S.ending = kind; setPhase("end");
  promptEl.hidden = true; clearDots(); objective(null);
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
let pzView = "main";
/* behind a menu the prompt, the dots, the big button and the arrow step out of the way */
function hideWorldUI() { promptEl.hidden = true; actEl.hidden = true; clearDots(); wayEl.classList.remove("is-on"); way.show = false; guide.trail(null, 0); }
function pause() {
  if (S.phase === "end" || S.phase === "load" || S.phase === "pause") return;
  if (S.phase === "explore") save();
  S.prevPhase = S.phase; S.phase = "pause";
  if (line && line.audio) line.audio.pause();
  for (const k in keys) keys[k] = false;
  if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} }
  pauseView("main"); hideWorldUI(); el.classList.add("is-paused");
  pauseEl.hidden = false; requestAnimationFrame(() => pauseEl.classList.add("is-on"));
  AU.veil(true);
}
const ACTS = [["up", "k_up"], ["down", "k_down"], ["left", "k_left"], ["right", "k_right"], ["run", "k_run"], ["act", "k_act"], ["journal", "k_journal"]];
function pauseView(v) {
  pzView = v;
  const reached = ["lot", "office", "memory", "june", "sale", "decision"].filter(n => S.visited && S.visited[n]);
  const tog = (k, a, b) => '<button type="button" class="pz-tog" data-c="' + k + '" aria-pressed="' + !!SET[k] + '"><span>' + E(SET[k] ? b : a) + "</span></button>";
  const sl = k => '<label class="pz-sl"><span>' + E(UI["mix_" + k]) + '</span><input type="range" min="0" max="100" step="1" data-mix="' + k + '" value="' + Math.round(AU.mix[k] * 100) + '" aria-label="' + E(UI["mix_" + k]) + '" /></label>';
  let h = "";
  if (v === "main") {
    h = '<div class="pz"><h3 class="pz-h">' + E(UI.pause) + '</h3><ul class="pz-m">' +
      '<li><button type="button" data-p="resume">' + E(UI.resume) + "</button></li>" +
      '<li><button type="button" data-p="journal">' + E(UI.journal) + "</button></li>" +
      '<li><button type="button" data-p="settings">' + E(UI.settings) + "</button></li>" +
      (reached.length > 1 ? '<li class="pz-ch"><span>' + E(UI.chapters) + "</span>" + reached.map(n => '<button type="button" data-p="go" data-s="' + n + '">' + E(n === "june" || n === "sale" ? D.scenes[n].card : D.scenes[n].name) + "</button>").join("") + "</li>" : "") +
      '<li><button type="button" data-p="restart">' + E(UI.restart) + "</button></li>" +
      '<li><button type="button" data-p="library">' + E(UI.library) + "</button></li></ul>" +
      '<p class="pz-fine">' + E(D.voices_note) + " " + E(UI.captions) + "</p></div>";
  } else if (v === "settings") {
    h = '<div class="pz pz--set"><div class="pz-top"><h3 class="pz-h">' + E(UI.settings) + '</h3><button type="button" class="pz-done" data-p="back">' + E(UI.done) + "</button></div>" +
      '<div class="pz-row"><span>' + E(UI.sound) + '</span><button type="button" class="pz-tog" data-p="sound" aria-pressed="' + soundOn() + '"><span>' + E(soundOn() ? UI.on : UI.off) + "</span></button></div>" +
      '<div class="pz-mix">' + ["master", "music", "voice", "sfx"].map(sl).join("") + "</div>" +
      '<div class="pz-row pz-kb"><span>' + E(UI.c_run) + "</span>" + tog("runToggle", UI.c_run_hold, UI.c_run_toggle) + "</div>" +
      '<div class="pz-row pz-kb"><span>' + E(UI.c_look) + "</span>" + tog("lock", UI.c_look_drag, UI.c_look_lock) + "</div>" +
      '<div class="pz-row"><span>' + E(UI.c_invert) + "</span>" + tog("invert", UI.c_normal, UI.c_inverted) + "</div>" +
      '<div class="pz-foot pz-kb"><button type="button" class="pz-link" data-p="keys">' + E(UI.c_keys) + "</button></div></div>";
  } else if (v === "keys") {
    h = '<div class="pz pz--set"><div class="pz-top"><h3 class="pz-h">' + E(UI.c_keys) + '</h3><button type="button" class="pz-done" data-p="settings">' + E(UI.done) + '</button></div><div class="pz-keys">' +
      ACTS.map(([a, l]) => '<div class="pz-row"><span>' + E(UI[l]) + '</span><button type="button" class="pz-key" data-key="' + a + '">' + E(rebinding === a ? UI.c_press : keyLabel(SET.keys[a])) + "</button></div>").join("") +
      '</div><p class="pz-fine">' + E(UI.c_keys_fine) + '</p><div class="pz-foot"><button type="button" class="pz-link" data-p="reset-keys">' + E(UI.c_reset) + "</button></div></div>";
  }
  pauseEl.innerHTML = h;
  setTimeout(() => { if (dev === "touch") return; const b = $(v === "main" ? "button" : "input, button", pauseEl); if (b) b.focus({ preventScroll: true }); }, 40);
}
function rebind(a, k) {
  // a key already in use moves to where the old one was, so nothing ends up on two actions
  const other = Object.keys(SET.keys).find(x => x !== a && SET.keys[x] === k);
  if (other) SET.keys[other] = SET.keys[a];
  SET.keys[a] = k; rebinding = null; saveSet(); AU.ui("toggle"); hap("tap"); pauseView("keys"); glyphs();
}
function unpause() {
  pauseEl.classList.remove("is-on"); el.classList.remove("is-paused"); setTimeout(() => { if (S.phase !== "pause") pauseEl.hidden = true; }, 250); S.phase = S.prevPhase || "explore"; rebinding = null;
  AU.veil(false);
  resumeVoice();
  if (SET.lock && dev === "kbm" && S.phase === "explore") { try { cv.requestPointerLock(); } catch (e) {} }
}
let lvT = 0;
pauseEl.addEventListener("input", e => {
  const r = e.target.closest("[data-mix]"); if (!r) return;
  AU.setMix(r.dataset.mix, r.value / 100);
  // you hear the level you set, a soft tick at the new volume
  const t = performance.now(); if (t - lvT > 110 && r.dataset.mix !== "music") { lvT = t; AU.ui("level"); }
});
pauseEl.addEventListener("click", async e => {
  const c = e.target.closest("[data-c]");
  if (c) { SET[c.dataset.c] = !SET[c.dataset.c]; saveSet(); AU.ui("toggle"); hap("tap"); pauseView("settings"); const nb = $("[data-c='" + c.dataset.c + "']", pauseEl); if (nb) nb.focus({ preventScroll: true }); return; }
  const kb = e.target.closest("[data-key]");
  if (kb) { rebinding = kb.dataset.key; kb.textContent = UI.c_press; kb.classList.add("is-wait"); return; }
  const b = e.target.closest("[data-p]"); if (!b) return;
  const k = b.dataset.p;
  if (k === "resume") unpause();
  else if (k === "journal") { unpause(); openJournal(); }
  else if (k === "settings") { if (pzView === "main") { AU.ui("open"); hap("tap"); } pauseView("settings"); }
  else if (k === "keys") { AU.ui("open"); hap("tap"); pauseView("keys"); }
  else if (k === "back") pauseView("main");
  else if (k === "reset-keys") { SET.keys = Object.assign({}, KEYS0); saveSet(); AU.ui("toggle"); hap("tap"); pauseView("keys"); glyphs(); }
  else if (k === "sound") { if (SC()) SC().toggle("story"); AU.sound(soundOn()); FX("choice"); AU.ui("toggle"); pauseView("settings"); const nb = $("[data-p='sound']", pauseEl); if (nb) nb.focus({ preventScroll: true }); }
  else if (k === "library") { T("story_quit", { scene: S.scene }); close("quit"); }
  else if (k === "restart") { FX("choice"); unpause(); store.del("jg_story"); resetState(); await travelFresh("lot"); }
  else if (k === "go") { FX("choice"); unpause(); await travelFresh(b.dataset.s); }
});
function resetState() { S.flags = {}; S.looked = {}; S.log = []; S.trophies = []; S.journal = []; S.tags = []; lostGen.n++; S.ending = null; S.visited = {}; S.hint = null; S.obj = null; }
async function travelFresh(name) { if (line) endLine(true); if (choosing) { choosing = null; choicesEl.hidden = true; } await fade(1, 500); await enter(name, { quiet: true }); await fade(0, 600); setPhase("explore"); if (name === "lot" && !S.flags.met) runTalk("lot-arrive"); else if (name !== "lot" && D.scenes[name].start) { S.partner = P.jason; startTalk(name); } }

/* ================================================================
   INPUT: keys (remappable), mouse, touch, pad; the glyphs follow the last one used
   ================================================================ */
let dev = COARSE.matches ? "touch" : "kbm";
el.dataset.dev = dev;
const KEYNAME = { shift: "Shift", " ": "Space", enter: "Enter", arrowup: "Up", arrowdown: "Down", arrowleft: "Left", arrowright: "Right", control: "Ctrl", alt: "Alt", tab: "Tab", capslock: "Caps" };
const keyLabel = k => KEYNAME[k] || (k && k.length === 1 ? k.toUpperCase() : String(k || "").replace(/^./, c => c.toUpperCase()));
function setDev(d) {
  if (dev === d) return;
  dev = d; el.dataset.dev = d; glyphs(); driveGlyphs(); padLegend(); jumpUI();
}
function glyphs() {
  const key = $(".st-prompt__key", promptEl);
  key.hidden = dev === "touch"; key.textContent = dev === "pad" ? "A" : keyLabel(SET.keys.act); key.classList.toggle("is-pad", dev === "pad");
  $$(".st-ch kbd", choicesOl).forEach((k, i) => { k.textContent = dev === "pad" ? "" : String(i + 1); });
  if (!hintEl.hidden) hintEl.textContent = hintText();
}
function hintText() {
  if (dev === "touch") return UI.walk_touch;
  if (dev === "pad") return UI.walk_pad + " X to jump.";
  const K = SET.keys, wasd = [K.up, K.left, K.down, K.right].every(k => k.length === 1);
  return UI.walk_pointer.replace("{move}", wasd ? (K.up + K.left + K.down + K.right).toUpperCase() : "The arrow keys").replace("{run}", keyLabel(K.run)).replace("{act}", keyLabel(K.act)).replace("{journal}", keyLabel(K.journal)) + " Space to jump.";
}
function act(k) {
  if (S.skipOpen && (k === "a" || k === "pause" || k === "b")) { S.skipOpen(); return; }
  if (k === "pause") { if (S.phase === "pause") unpause(); else if (S.phase === "journal") closeJournal(); else pause(); return; }
  if (k === "journal") { if (S.phase === "journal") closeJournal(); else if (S.phase === "explore" || S.phase === "talk" || (S.phase === "drive" && DRV.state === "drive")) openJournal(); return; }
  if (k === "b") { if (S.phase === "journal") closeJournal(); else if (S.phase === "pause") { if (pzView !== "main") pauseView("main"); else unpause(); } else if (S.phase === "close" && S.closeFinish) S.closeFinish(); else if (S.phase === "sheet" && S.deskFinish) S.deskFinish(false); return; }
  if (k === "a") {
    if (S.phase === "pause" || S.phase === "journal") { const a = document.activeElement; if (a && a.click && (pauseEl.contains(a) || journalEl.contains(a))) a.click(); return; }
    if (choosing) { const bs = $$(".st-ch", choicesOl); const i = Math.max(0, bs.indexOf(document.activeElement)); pick(i, "pad"); return; }
    // a passing thought doesn't stand between you and the next thing: the press uses what's prompted (the thought
    // gives way to whatever that says); with nothing prompted, it skips the thought
    if (line && !(line.L.ambient && S.phase === "explore" && near)) { endLine(true); return; }
    if (S.phase === "explore" && near) interact(near.id, "key");
  }
}
let rebinding = null;
addEventListener("keydown", e => {
  if (!S.open || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (rebinding) { e.preventDefault(); e.stopPropagation(); if (k === "escape") { rebinding = null; pauseView("keys"); } else if (!["tab", "p", "m", "1", "2", "3", "4", "enter", " ", "meta"].includes(k)) rebind(rebinding, k); return; }
  setDev("kbm"); mv.idle = 0;
  if (S.phase === "sheet") { if (k === "escape") { e.preventDefault(); S.deskFinish && S.deskFinish(false); } return; }
  if (S.phase === "end") return;
  if (S.skipOpen && (k === "escape" || k === "enter" || k === " " || k === SET.keys.act)) { e.preventDefault(); S.skipOpen(); return; }
  if (S.phase === "pause") { if (k === "escape" || k === "p") { e.preventDefault(); act("b"); } return; }
  if (S.phase === "drive") {
    // in the car: the keys drive; Esc pauses, Tab or J opens the journal, C swaps the camera, E or F gets out
    e.preventDefault();
    if (k === "escape" || k === "p") act("pause");
    else if (k === "tab" || k === SET.keys.journal) act("journal");
    else if (DRV.state !== "drive") { if (!e.repeat && DRV.skip && (k === SET.keys.act || k === "f" || k === " " || k === "enter")) DRV.skip(); }
    else if (k === SET.keys.act || k === "f") { if (!e.repeat) exitCar("key"); }
    else if (k === "c") { if (!e.repeat) driveCam(); }
    else keys[k] = true;
    return;
  }
  if (k === "tab") { e.preventDefault(); act("journal"); return; }
  const moveKey = ["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k) || ["up", "down", "left", "right", "run"].some(a => SET.keys[a] === k);
  if (moveKey) { keys[k] = true; if (S.phase === "explore") e.preventDefault(); if (k === SET.keys.run && SET.runToggle && !e.repeat) mv.runLatch = !mv.runLatch; }
  if (k === "escape" || k === "p") { e.preventDefault(); act(S.phase === "close" || S.phase === "journal" ? "b" : "pause"); return; }
  if (k === SET.keys.journal) { e.preventDefault(); act("journal"); return; }
  if (choosing && /^[1-4]$/.test(k)) { e.preventDefault(); pick(+k - 1, "key"); return; }
  if (choosing && (k === "arrowdown" || k === "arrowup")) { e.preventDefault(); moveChoice(k === "arrowdown" ? 1 : -1); return; }
  // Space jumps when you're on your feet exploring (E and Enter still use things); anywhere else it moves the talk on
  if (k === " " && S.phase === "explore" && !choosing && !(e.target && e.target.closest && e.target.closest("button,a,input"))) { e.preventDefault(); if (!e.repeat) jump("key"); return; }
  if ((k === SET.keys.act || k === "enter" || k === " ") && !choosing && !moveKey) {
    if (e.target && e.target.closest && e.target.closest("button,a,input") && k !== SET.keys.act) return;
    e.preventDefault(); act("a");
  }
}, true);
addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

/* ---------- pointers: a floating stick under the left thumb, look by dragging on the right (or with two fingers),
   tap the ground or a thing to go there; with a mouse, drag (either button) to look, click to walk ---------- */
const ptrs = new Map();
const STICK_R = 62;
const stickKnob = $("i", stickEl);
function stickAt(x, y) { stickEl.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)"; }
cv.addEventListener("pointerdown", e => {
  if (!S.open) return;
  const touch = e.pointerType === "touch" || e.pointerType === "pen";
  setDev(touch ? "touch" : "kbm"); mv.idle = 0;
  AU.sound(soundOn()); // a suspended context wakes on the first press inside the episode
  if (S.skipOpen) return;
  if (S.phase === "talk" && line && !choosing) { endLine(true); return; } // a skip: silent
  if (S.phase === "drive") { if (DRV.state !== "drive" && DRV.skip) { DRV.skip(); return; } if (DRV.state === "drive") { ptrs.set(e.pointerId, { role: "dlook", x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: false, button: e.button, touch }); try { cv.setPointerCapture(e.pointerId); } catch (x) {} } return; }
  if (S.phase !== "explore" || S.busy || HOLDG) return;
  if (!touch && SET.lock && document.pointerLockElement !== cv && e.button === 0) { try { cv.requestPointerLock(); } catch (x) {} }
  if (document.pointerLockElement === cv) { if (e.button === 0 && near) interact(near.id, "click"); return; }
  const hasStick = [...ptrs.values()].some(p => p.role === "stick");
  const role = touch && !hasStick && e.clientX < innerWidth * 0.45 && e.clientY > innerHeight * 0.3 ? "stick" : "look";
  ptrs.set(e.pointerId, { role, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, bx: e.clientX, by: e.clientY, t0: performance.now(), moved: false, button: e.button, touch });
  if (role === "stick") { stickEl.hidden = false; stickEl.classList.remove("is-run"); stickAt(e.clientX, e.clientY); stickKnob.style.transform = ""; }
  try { cv.setPointerCapture(e.pointerId); } catch (x) {}
});
cv.addEventListener("pointermove", e => {
  if (document.pointerLockElement === cv && S.phase === "explore") { look(e.movementX || 0, e.movementY || 0, 1); return; }
  if (document.pointerLockElement === cv && S.phase === "drive") { DRV.look = clamp(DRV.look - (e.movementX || 0) * 0.004 * SET.look, -2.6, 2.6); DRV.lookT = 1.4; return; }
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx0 = e.clientX - p.x0, dy0 = e.clientY - p.y0;
  if (Math.hypot(dx0, dy0) > 9) p.moved = true;
  if (p.role === "dlook") { DRV.look = clamp(DRV.look - (e.clientX - p.x) * 0.006 * SET.look, -2.6, 2.6); DRV.lookT = 1.4; p.x = e.clientX; p.y = e.clientY; return; }
  if (p.role === "stick") {
    let dx = e.clientX - p.bx, dy = e.clientY - p.by, d = Math.hypot(dx, dy);
    // the base follows a thumb that runs past the rim, so the stick is never lost
    if (d > STICK_R) { p.bx = e.clientX - dx / d * STICK_R; p.by = e.clientY - dy / d * STICK_R; stickAt(p.bx, p.by); dx = e.clientX - p.bx; dy = e.clientY - p.by; d = STICK_R; }
    const raw = d / STICK_R, m = raw < DEAD ? 0 : Math.min(1, (raw - DEAD) / (0.97 - DEAD));
    mv.x = d ? dx / d : 0; mv.z = d ? dy / d : 0; mv.mag = m;
    stickKnob.style.transform = "translate(" + dx.toFixed(0) + "px," + dy.toFixed(0) + "px)";
    stickEl.classList.toggle("is-run", m >= RUN_AT);
  } else if (p.moved) {
    const looks = [...ptrs.values()].filter(q => q.role === "look").length;
    look(e.clientX - p.x, e.clientY - p.y, looks > 1 ? 0.5 : 1);
  }
  p.x = e.clientX; p.y = e.clientY;
});
function look(dx, dy, k) {
  camState.yaw -= dx * 0.0062 * k * SET.look;
  camState.pitch = clamp(camState.pitch + dy * 0.0032 * k * SET.look * (SET.invert ? -1 : 1), -0.15, 0.75);
  camState.drag = 2.2; mv.idle = 0;
}
function endPtr(e) {
  const p = ptrs.get(e.pointerId); if (!p) return;
  ptrs.delete(e.pointerId);
  const tap = !p.moved && performance.now() - p.t0 < 380 && (p.button === 0 || p.touch) && e.type === "pointerup";
  if (p.role === "stick") { stickEl.hidden = true; mv.x = 0; mv.z = 0; mv.mag = 0; }
  if (tap && S.phase === "explore") tapAt(e.clientX, e.clientY);
}
cv.addEventListener("pointerup", endPtr); cv.addEventListener("pointercancel", endPtr);
cv.addEventListener("contextmenu", e => e.preventDefault());
cv.addEventListener("wheel", e => { if (S.phase !== "explore") return; e.preventDefault(); camState.zoom = clamp((camState.zoom || 1) * (e.deltaY > 0 ? 1.08 : 0.93), 0.6, 1.4); }, { passive: false });
// no page zoom, scroll or callout from a stray pinch or long press on the scene
if (!(window.CSS && CSS.supports && CSS.supports("touch-action", "none"))) cv.addEventListener("touchmove", e => e.preventDefault(), { passive: false }); // elsewhere .story's touch-action: none does it without holding the compositor
for (const ev of ["gesturestart", "gesturechange"]) el.addEventListener(ev, e => e.preventDefault());
document.addEventListener("pointerlockchange", () => { if (!document.pointerLockElement && S.open && SET.lock && S.phase === "explore") pause(); });
function tapAt(x, y) {
  // a thing near the tap wins over the ground
  let best = null, bd = dev === "touch" ? 64 : 48;
  for (const s of spotsHere()) { const q = project(s.p); if (!q.on) continue; const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = s; } }
  if (best) { if (near && near.id === best.id) interact(best.id, "tap"); else goInteract(best.id); return; }
  const nd = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(nd, camera);
  const t = -ray.ray.origin.y / ray.ray.direction.y;
  if (t > 0 && t < 60) { const p = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t); if (walkTo(p)) FX("key"); }
}
capEl.addEventListener("click", () => { if (line) endLine(true); });
/* the pad's glyphs (Xbox letters, drawn in CSS) on the buttons they press, a line of what the pad does here, and the
   Jump button under the right thumb on a touch screen, only while you're on your feet exploring */
el.insertAdjacentHTML("beforeend", '<button class="st-jump" type="button" hidden aria-label="Jump"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg><span class="st-jump__verb">Jump</span></button><div class="st-legend" aria-hidden="true" hidden></div>');
const jumpEl = $(".st-jump", el), legendEl = $(".st-legend", el);
const glyph = k => '<kbd class="st-glyph" aria-hidden="true">' + k + "</kbd>";
$$(".st-back", el).forEach(b => b.insertAdjacentHTML("beforeend", glyph("B")));
skipEl.insertAdjacentHTML("beforeend", glyph("A"));
{ const jb = $("[data-st='journal']", el); if (jb) jb.insertAdjacentHTML("beforeend", glyph("Y")); }
jumpEl.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); setDev("touch"); jump("touch"); });
jumpEl.addEventListener("click", e => { e.stopPropagation(); if (e.detail === 0) jump("key"); });
let jumpShown = false;
function jumpUI() {
  const on = dev === "touch" && S.open && S.phase === "explore" && !DRV.state && !!me && !me.inCar;
  if (on !== jumpShown) { jumpShown = on; jumpEl.hidden = !on; }
}
let legendMode = "";
function padLegend() {
  const ph = S.phase;
  const mode = dev !== "pad" || !S.open ? "" : ph === "pause" || ph === "journal" || ph === "sheet" || ph === "close" ? "menu" : ph === "end" ? "end" : choosing ? "choose" : ph === "explore" ? (near ? "near" : "walk") : "";
  if (mode === legendMode) return;
  legendMode = mode; legendEl.hidden = !mode;
  const g = (k, t) => "<span>" + glyph(k) + E(t) + "</span>";
  legendEl.innerHTML = mode === "menu" ? g("A", "Select") + g("B", "Back") : mode === "end" ? g("A", "Select") : mode === "choose" ? g("A", "Choose") :
    mode === "walk" ? g("A", "Jump") + g("Y", UI.journal) : mode === "near" ? g("X", "Jump") + g("Y", UI.journal) : "";
}
actEl.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); setDev("touch"); pressUse("tap"); });
actEl.addEventListener("click", e => { e.stopPropagation(); if (e.detail === 0 && performance.now() - pressT > 600) pressUse("tap"); });
skipEl.addEventListener("click", e => { e.stopPropagation(); if (S.skipOpen) S.skipOpen(); });
el.addEventListener("click", e => {
  const b = e.target.closest("[data-st]"); if (!b) return;
  if (b.dataset.st === "journal") act("journal");
  else if (b.dataset.st === "pause") act("pause");
});

/* ================================================================
   DRIVING: free play on the lot. A drivable car (set.userData.drivable,
   story/vehicle.js) gets a Drive prompt while you explore; you walk to the
   driver's door, reach for the handle, get in, and the camera eases into a
   chase cam. Keys, a pad or the touch pedals drive it; Get out puts you back
   on your feet beside it. Never required, never in the story's way: talk
   prompts are off from inside a car, and anything that needs you on foot (a
   scene change, a chapter, closing) gets you out first.
   ================================================================ */
const DRV = { vehs: new WeakMap(), mod: null, tried: false, veh: null, entry: null, state: null, cam: "chase", blend: 0, au: null, shake: 0, steer: 0, thr: 0, brk: 0, look: 0, lookT: 0, fov: 0, yawC: 0, pos: new THREE.Vector3(), tgt: new THREE.Vector3(), lastGear: 0, hits: 0, log: [], touch: { steer: 0, gas: 0, brake: 0, hb: 0 } };
function vehMod() {
  if (DRV.tried) return DRV.modP;
  DRV.tried = true;
  DRV.modP = import("./vehicle.js").then(m => (DRV.mod = m && m.createVehicle ? m : null)).catch(() => (DRV.mod = null));
  return DRV.modP;
}
function drivables() {
  // the morning of the sale: only her car, and only once she's asked to drive it
  const sale = S.scene === "sale";
  if (!set || (S.scene !== "lot" && S.scene !== "keys" && !(sale && S.flags.testdrive && !S.flags.droven)) || S.ending) return [];
  const list = set.userData.drivable; if (!list || !list.length) return [];
  if (!DRV.tried) vehMod();
  if (!DRV.mod) return [];
  return list.filter(c => c.object && c.object.userData.rig && (!sale || c.id === "car"));
}
function carMeta(c) { const r = c.object.userData.rig; return (r && r.meta) || { W: 1.8, L: 4.6 }; }
/* the driver's door handle and where to stand for it, from the car where it is now */
function doorPoint(c) { const vv = DRV.vehs.get(c); if (vv && vv.doors) { const h = vv.doors.handle("driver"); if (h) return h; } c.object.updateMatrixWorld(true); return c.object.localToWorld(new THREE.Vector3(carMeta(c).W / 2 + 0.04, 0.98, 0.3)); }
function doorStand(c) { c.object.updateMatrixWorld(true); const p = c.object.localToWorld(new THREE.Vector3(carMeta(c).W / 2 + 0.62, 0, 0.1)); p.y = 0; return p; }
/* the cars' spots, worked out again only when a car has moved (spotsHere runs every frame) */
const carSpotCache = new WeakMap();
function carSpots() {
  const out = [];
  for (const c of drivables()) {
    const o = c.object, key = o.position.x.toFixed(2) + "," + o.position.z.toFixed(2) + "," + o.rotation.y.toFixed(3);
    let sp = carSpotCache.get(c);
    if (!sp || sp.key !== key) { sp = { key, s: { id: "car:" + c.id, o: { verb: UI.drive, label: UI["car_" + c.id] || UI.car, car: true, who: "car" }, sp: { r: 2.3, stand: doorStand(c) }, p: doorPoint(c), car: c } }; carSpotCache.set(c, sp); }
    out.push(sp.s);
  }
  return out;
}

/* the touch controls: a steering pad under the left thumb, the pedals under the right, the handbrake, the camera and Get out */
const drvEl = document.createElement("div");
drvEl.className = "st-drive"; drvEl.hidden = true;
drvEl.innerHTML =
  '<div class="st-drive__steer" aria-label="' + E(UI.drive_steer) + '"><span class="st-drive__wheel" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="19"/><circle cx="24" cy="24" r="4.5"/><path d="M5.5 22h14M28.5 22h14M24 28.5V43"/></svg></span></div>' +
  '<div class="st-drive__pedals"><button type="button" class="st-drive__pedal" data-drv="brake" aria-label="' + E(UI.drive_brake) + '"><span>' + E(UI.drive_brake) + '</span></button><button type="button" class="st-drive__pedal is-gas" data-drv="gas" aria-label="' + E(UI.drive_gas) + '"><span>' + E(UI.drive_gas) + "</span></button></div>" +
  '<div class="st-drive__top"><button type="button" class="st-drive__btn" data-drv="hb"><span>' + E(UI.drive_hb) + '</span></button><button type="button" class="st-drive__btn" data-drv="cam"><kbd>C</kbd><span>' + E(UI.drive_cam) + '</span></button><button type="button" class="st-drive__btn is-out" data-drv="out"><kbd>E</kbd><span>' + E(UI.drive_out) + "</span></button></div>" +
  '<p class="st-drive__hint"></p>';
el.appendChild(drvEl);
const drvSteer = $(".st-drive__steer", drvEl), drvWheel = $(".st-drive__wheel", drvEl), drvHint = $(".st-drive__hint", drvEl);
const STEER_R = 70;
let steerPtr = null;
drvSteer.addEventListener("pointerdown", e => {
  e.preventDefault(); e.stopPropagation(); setDev("touch");
  steerPtr = { id: e.pointerId, x0: e.clientX };
  try { drvSteer.setPointerCapture(e.pointerId); } catch (x) {}
  drvSteer.classList.add("is-on");
});
drvSteer.addEventListener("pointermove", e => {
  if (!steerPtr || e.pointerId !== steerPtr.id) return;
  let dx = e.clientX - steerPtr.x0;
  // a thumb that runs past the rim drags the centre with it, so steering back is always one move
  if (dx > STEER_R) { steerPtr.x0 = e.clientX - STEER_R; dx = STEER_R; } else if (dx < -STEER_R) { steerPtr.x0 = e.clientX + STEER_R; dx = -STEER_R; }
  const raw = dx / STEER_R, m = Math.abs(raw) < 0.06 ? 0 : Math.sign(raw) * Math.min(1, (Math.abs(raw) - 0.06) / 0.9);
  DRV.touch.steer = m;
});
const steerEnd = e => { if (!steerPtr || e.pointerId !== steerPtr.id) return; steerPtr = null; DRV.touch.steer = 0; drvSteer.classList.remove("is-on"); };
drvSteer.addEventListener("pointerup", steerEnd); drvSteer.addEventListener("pointercancel", steerEnd);
for (const b of $$("[data-drv]", drvEl)) {
  const k = b.dataset.drv;
  if (k === "gas" || k === "brake" || k === "hb") {
    const on = e => { e.preventDefault(); e.stopPropagation(); setDev(e.pointerType === "mouse" ? dev : "touch"); try { b.setPointerCapture(e.pointerId); } catch (x) {} DRV.touch[k] = 1; b.classList.add("is-on"); };
    const off = e => { DRV.touch[k] = 0; b.classList.remove("is-on"); };
    b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off); b.addEventListener("lostpointercapture", off);
    b.addEventListener("click", e => e.preventDefault());
  } else b.addEventListener("click", e => { e.stopPropagation(); if (k === "out") exitCar("button"); else if (k === "cam") driveCam(); });
}
drvEl.addEventListener("contextmenu", e => e.preventDefault());
function driveGlyphs() {
  if (!DRV.state) return;
  drvEl.dataset.dev = dev;
  const K = SET.keys, out = $('[data-drv="out"] kbd', drvEl), cam = $('[data-drv="cam"] kbd', drvEl);
  out.textContent = dev === "pad" ? "B" : keyLabel(K.act); cam.textContent = dev === "pad" ? "X" : "C";
  out.hidden = cam.hidden = dev === "touch";
  const wasd = [K.up, K.left, K.down, K.right].every(k => k.length === 1);
  drvHint.textContent = dev === "touch" ? UI.drive_touch : dev === "pad" ? UI.drive_pad : UI.drive_pointer.replace("{gas}", wasd ? K.up.toUpperCase() : "Up").replace("{brake}", wasd ? K.down.toUpperCase() : "Down").replace("{left}", wasd ? K.left.toUpperCase() : "Left").replace("{right}", wasd ? K.right.toUpperCase() : "Right").replace("{act}", keyLabel(K.act));
}

/* in: walk to the door, reach for the handle, the door opens, you sit, pull it shut, and the engine catches.
   people.js runs the whole sequence (me.enterCar); while it runs or you're seated, main.js leaves your position
   and heading alone. A press skips it (silently): you're simply in. */
async function enterCar(c, how) {
  if (S.phase !== "explore" || DRV.state || !me) return;
  const mod = await vehMod(); if (!mod || S.phase !== "explore") return;
  mv.path = null; mv.after = null; guide.clearRing(); progress();
  // one vehicle per car, kept: a car you left across the lot is where you left it next time
  let v = DRV.vehs.get(c);
  if (v) { const cols = set.userData.colliders || [], i = c.collider ? cols.indexOf(c.collider) : -1; if (i >= 0) cols.splice(i, 1); }
  else { try { v = mod.createVehicle(set, c, { quality }); } catch (e) { return; } v.entry = c; DRV.vehs.set(c, v); }
  DRV.veh = v;
  setPhase("drive"); DRV.state = "enter"; DRV.entry = c; DRV.hits = 0; DRV.skip = null;
  el.classList.add("is-driving"); hideWorldUI();
  FX("arrive"); hap("tap");
  T("story_drive", { car: c.id, scene: S.scene, how: how || "" });
  DRV.au = AU.drive({ running: !!(v.engine && v.engine.on), start: false, rain: S.scene === "keys" ? 0 : 1 });
  const skipped = new Promise(r => { DRV.skip = () => { DRV.skip = null; r("skip"); }; });
  if (me.enterCar) {
    let p = null; try { p = me.enterCar(v, "driver", { onDoor: carDoor }); } catch (e) {}
    const r = await Promise.race([p || Promise.resolve(), skipped]);
    if (DRV.state !== "enter") return;
    if (r === "skip") { try { me.drive(v, "driver"); } catch (e) {} if (v.doors) v.doors.open("driver", 0); DRV.doorOpen = false; } // a skip shuts it silently
  } else {
    // no seated driver to show: face the door, open it, step in out of sight, shut it
    const at = doorPoint(c);
    me.wantYaw = Math.atan2(at.x - me.pos.x, at.z - me.pos.z);
    if (await Promise.race([sleep(420).then(() => 0), skipped]) !== "skip") { await swingDoor(v, 1, 0.42); await Promise.race([sleep(320), skipped]); }
    if (DRV.state !== "enter") return;
    hide(me); await swingDoor(v, 0, 0.3);
  }
  DRV.skip = null;
  if (DRV.state !== "enter") return;
  if (v.engine && !v.engine.on) { v.engine.start(); if (DRV.au) DRV.au.start(); }
  DRV.state = "drive"; DRV.blend = 0; DRV.camInit = true; DRV.look = 0;
  // the test drive: Marisol in the passenger seat, and the clock (from where it was, if you'd got out)
  if (S.scene === "sale" && courseLive()) { if (P.marisol && P.marisol.group.visible && !P.marisol.inCar) { try { P.marisol.drive(v, "passenger"); } catch (e) {} } if (COURSE.i === 0 && COURSE.t === 0) COURSE.hits0 = DRV.hits; }
  if (DRV.au) DRV.au.inside(DRV.cam === "car");
  if (DRV.cam === "car" && me.inCar) me.group.visible = false;
  drvEl.hidden = false; driveGlyphs();
}
/* the door leaving its latch or shutting, in the frame people.js moves it: the sound and the buzz together */
function carDoor(open) { DRV.doorOpen = open; if (DRV.au && DRV.entry) DRV.au.door(open, doorPoint(DRV.entry)); hap("tap"); }
function swingDoor(v, to, secs) {
  return new Promise(res => {
    if (!v.doors) { res(); return; }
    const from = v.doors.get("driver") || 0, t0 = performance.now(), d = (FAST ? 0.02 : still() ? 0.12 : secs) * 1000;
    const step = () => { const u = Math.min(1, (performance.now() - t0) / d); v.doors.open("driver", from + (to - from) * EZ(u)); if (u < 1) requestAnimationFrame(step); else res(); };
    step();
  });
}
/* out: the car brakes to a stop, you open the door, step out and shut it; the camera comes back to your shoulder.
   instant (a scene change, closing): you're simply out beside it. */
async function exitCar(how, instant) {
  if (!DRV.state || DRV.state === "exit") { if (DRV.state === "exit" && DRV.skip) DRV.skip(); return; }
  const v = DRV.veh, c = DRV.entry;
  const was = DRV.state; DRV.state = "exit";
  if (was === "enter" && DRV.skip) DRV.skip(); // a sequence still running stops where it is
  drvEl.classList.remove("is-on"); setTimeout(() => { if (!DRV.state || DRV.state === "exit") drvEl.hidden = true; }, 250);
  T("story_drive_out", { car: c ? c.id : "", how: how || "" });
  const skipped = new Promise(r => { DRV.skip = () => { DRV.skip = null; r("skip"); }; });
  if (!instant && was === "drive") {
    const t0 = performance.now();
    while (Math.abs(v.speed) > 0.4 && performance.now() - t0 < 2500 && DRV.state === "exit") await sleep(40);
  }
  try { v.park(); } catch (e) {}
  if (DRV.au) DRV.au.inside(false);
  if (me) me.group.visible = true;
  let out = false;
  // the driver's door against something (another car, a wall): no climbing out into it; you step out on a clear side
  const ds = doorStand(c), doorFree = !blocked(ds.x, ds.z, 0.25);
  if (!instant && me.inCar && me.exitCar && doorFree) {
    let p = null; try { p = me.exitCar(v, { onDoor: carDoor }); } catch (e) {}
    out = (await Promise.race([p || Promise.resolve(), skipped])) !== "skip";
  } else if (!instant && !me.inCar) { await swingDoor(v, 1, 0.38); await Promise.race([sleep(260), skipped]); await swingDoor(v, 0, 0.3); }
  DRV.skip = null;
  if (!out) {
    // snapped out (skipped, instant, or no seated driver): stand by the driver's door, or the first clear side
    if (me.inCar) { try { me.driving = null; } catch (e) {} }
    if (v.doors) v.doors.open("driver", 0);
    const st = doorStand(c);
    me.pos.set(st.x, 0, st.z); me.yaw = me.wantYaw = (v.pose ? v.pose.yaw : c.yaw) + Math.PI / 2; me.speed = 0;
    if (blocked(me.pos.x, me.pos.z, 0.2)) { c.object.updateMatrixWorld(true); const W = carMeta(c).W / 2 + 0.62, L = carMeta(c).L / 2 + 0.6; for (const [lx, lz] of [[-W, 0.1], [0, -L], [0, L], [W, -1.2]]) { const q = c.object.localToWorld(new THREE.Vector3(lx, 0, lz)); if (!blocked(q.x, q.z, 0.2)) { me.pos.set(q.x, 0, q.z); break; } } }
  }
  me.group.visible = true; if (me.shadow) me.shadow.visible = true;
  if (DRV.au) { DRV.au.stop(instant ? 0.1 : 1.2); DRV.au = null; }
  // the car stays where you left it, a parked car the walk and the camera go round
  if (!c.engine && v.engine && v.engine.on) { try { v.engine.stop(); } catch (e) {} }
  try { v.dispose(); } catch (e) {}
  DRV.veh = null; navFor = null; camWallsFor = null; if (set) set.userData.navDirty = false;
  // Marisol gets out too, and waits on her side
  if (S.scene === "sale" && P.marisol && P.marisol.inCar && P.marisol.car && P.marisol.car.v === v) {
    try { P.marisol.driving = null; } catch (e) {}
    const q = c.object.localToWorld(new THREE.Vector3(-(carMeta(c).W / 2 + 0.75), 0, 0.3)); q.y = 0;
    place(P.marisol, q, Math.atan2(me.pos.x - q.x, me.pos.z - q.z));
  }
  DRV.state = null; DRV.entry = null; DRV.touch = { steer: 0, gas: 0, brake: 0, hb: 0 };
  el.classList.remove("is-driving");
  post.comp.u.uDofK.value = 0;
  if (S.phase === "drive") setPhase("explore");
  else if (S.prevPhase === "drive") S.prevPhase = "explore";
  DRV.doorOpen = null;
  camState.yaw = me.yaw + Math.PI; camState.init = !!instant; camState.reframe = true; setTimeout(() => { camState.reframe = false; }, 1200);
  camera.fov = innerWidth / innerHeight < 1 ? 62 : 48; camera.updateProjectionMatrix();
}
function driveCam() {
  if (DRV.state !== "drive") return;
  DRV.cam = DRV.cam === "chase" ? "car" : "chase"; DRV.camInit = true;
  if (DRV.au) DRV.au.inside(DRV.cam === "car");
  if (me && me.inCar) me.group.visible = DRV.cam === "chase";
  AU.ui("toggle"); hap("tap");
}
/* the inputs, from whichever device was used last; keys snap, but ramp so a tap isn't a lurch */
function driveInput(dt) {
  const K = SET.keys, kb = n => !!keys[n];
  const up = kb(K.up) || kb("arrowup"), dn = kb(K.down) || kb("arrowdown"), lf = kb(K.left) || kb("arrowleft"), rt = kb(K.right) || kb("arrowright");
  let thr = up ? 1 : 0, brk = dn ? 1 : 0, steer = (rt ? 1 : 0) - (lf ? 1 : 0), hb = kb(" ") ? 1 : 0;
  const gp = pad.drive;
  if (gp) { thr = Math.max(thr, gp.rt); brk = Math.max(brk, gp.lt); if (Math.abs(gp.sx) > Math.abs(steer)) steer = gp.sx; hb = Math.max(hb, gp.a); }
  const t = DRV.touch; thr = Math.max(thr, t.gas); brk = Math.max(brk, t.brake); hb = Math.max(hb, t.hb); if (Math.abs(t.steer) > Math.abs(steer)) steer = t.steer;
  // keys and pedals ease in and out; an analog stick passes straight through
  DRV.thr = thr > DRV.thr ? Math.min(thr, DRV.thr + dt * 4) : Math.max(thr, DRV.thr - dt * 6);
  DRV.brk = brk > DRV.brk ? Math.min(brk, DRV.brk + dt * 6) : Math.max(brk, DRV.brk - dt * 8);
  DRV.steer = steer === 0 ? damp(DRV.steer, 0, 8, dt) : Math.abs(steer) < 1 ? steer : damp(DRV.steer, steer, 7, dt);
  return { throttle: DRV.thr, brake: DRV.brk, steer: DRV.steer, handbrake: hb };
}
function tickDrive(dt) {
  const v = DRV.veh; if (!v || !DRV.state) return;
  // getting out it brakes to a stop, then holds on the handbrake (a held brake at a standstill would select reverse)
  const rolling = DRV.state === "exit" && Math.abs(v.speed || 0) > 0.4;
  const inp = DRV.state === "drive" && S.phase === "drive" ? driveInput(dt) : { throttle: 0, brake: rolling ? 1 : 0, steer: 0, handbrake: rolling ? 0.3 : 1 };
  v.update(dt, inp);
  const p = v.pose || { x: v.object.position.x, z: v.object.position.z, yaw: v.object.rotation.y };
  // with no seated driver to show, you ride along unseen; a seated one is people.js's to place
  if (me && !me.inCar && !me.enterCar && DRV.state === "drive") { me.pos.set(p.x, 0, p.z); me.yaw = me.wantYaw = p.yaw; me.speed = 0; }
  if (DRV.touch.steer || dev === "touch") drvWheel.style.transform = "rotate(" + ((v.wheelAngle != null ? v.wheelAngle : DRV.steer * 7) * 57.3 * 0.35).toFixed(1) + "deg)";
  for (const e of v.events || []) {
    if (e.type === "impact") {
      const k = Math.min(1, e.strength / 8);
      DRV.shake = Math.max(DRV.shake, 0.06 + k * 0.5); DRV.hits++;
      if (DRV.au) DRV.au.impact(e.strength, e.what === "bound" ? null : { x: e.x, y: e.y || 0.5, z: e.z });
      if (e.strength > 0.8) hap(e.strength > 5 ? "success" : e.strength > 2 ? "unlock" : "tap");
      DRV.log.push({ t: S.t, what: e.what, k: +e.strength.toFixed(2) }); if (DRV.log.length > 20) DRV.log.shift();
    } else if (e.type === "shift") { if (DRV.state === "drive" && e.gear > 0 && DRV.lastGear > 0) hap("tap"); DRV.lastGear = e.gear; }
    else if (e.type === "splash" && DRV.au) AU.step("puddle", { at: { x: p.x, y: 0.1, z: p.z }, gain: Math.min(1.6, e.strength / 6), ref: 4 });
    else if (e.type === "bump") DRV.shake = Math.max(DRV.shake, 0.04 * Math.min(1, e.strength || 1));
  }
  // the door: its sound when it leaves the latch and when it shuts (whoever moved it)
  if (v.doors && v.doors.get) { const d = v.doors.get("driver") || 0, o = d > 0.03; if (DRV.doorOpen == null) DRV.doorOpen = o; else if (o !== DRV.doorOpen) { DRV.doorOpen = o; if (DRV.au) DRV.au.door(o, doorPoint(DRV.entry)); if (!o) hap("tap"); } }
  if (!DRV.au && DRV.state === "drive" && AU.ctx && soundOn()) { DRV.au = AU.drive({ running: true, start: false, rain: S.scene === "keys" ? 0 : 1 }); if (DRV.au) DRV.au.inside(DRV.cam === "car"); } // the sound came on mid-drive
  if (DRV.au) DRV.au.update({ rpm: v.rpm, load: v.load, speed: v.speed, slip: v.slip, gear: v.gear, surface: v.surface, engine: v.engine ? v.engine.on : true });
  if (set.userData.navDirty) { navFor = null; camWallsFor = null; set.userData.navDirty = false; }
}
/* the chase cam: behind and over the car, a beat of lag, looking ahead of where it's going; wider with speed;
   pulled in short of anything in the way; a shake on a hit. In the car: the driver's eyes. */
function driveView(dt) {
  const v = DRV.veh; if (!v) return false;
  const p = v.pose || { x: v.object.position.x, z: v.object.position.z, yaw: v.object.rotation.y, speed: v.speed };
  const sp = v.speed || 0, as = Math.abs(sp);
  const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
  // the look: right stick, or a drag, swings the chase cam round; it drifts back behind when you let go
  DRV.lookT -= dt; if (DRV.lookT <= 0) DRV.look = damp(DRV.look, 0, 2.5, dt);
  if (DRV.camInit) { DRV.yawC = p.yaw; }
  // heading the camera follows: the car's yaw with a lag that tightens with speed; reversing it stays put
  DRV.yawC += angTo(DRV.yawC, p.yaw) * (1 - Math.exp(-(1.6 + as * 0.12) * dt));
  const fovBase = VW / VH < 1 ? 64 : 52;
  let pos, look, fov;
  if (DRV.cam === "car" && DRV.state === "drive") {
    const seat = v.seat ? v.seat.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(p.x, 0.5, p.z);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(v.body ? v.body.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion());
    pos = seat.clone().addScaledVector(up, 0.68).addScaledVector(fwd, 0.08);
    const ly = p.yaw + DRV.look * 0.8 + (v.steerAngle || 0) * 0.35;
    look = pos.clone().add(new THREE.Vector3(Math.sin(ly) * 10, -0.6, Math.cos(ly) * 10));
    fov = fovBase + 6 + Math.min(8, as * 0.25);
  } else {
    const dist = 5.4 + Math.min(1.8, as * 0.06), h = 1.75 + Math.min(0.5, as * 0.015);
    const pivot = new THREE.Vector3(p.x, 1.25, p.z);
    const own = DRV.entry && DRV.entry.wall, ownC = DRV.entry && DRV.entry.collider, cols = set.userData.colliders || [];
    if (camWallsFor !== set) { camWallList = camWalls(); camWallsFor = set; }
    // how far out the camera can sit along a heading, and how close a pole or a wall passes the line of sight
    const probe = a => {
      const off = new THREE.Vector3(Math.sin(a) * dist, h - 1.25, Math.cos(a) * dist);
      let free = dist, near = 9;
      for (let i = 1; i <= 16; i++) {
        const t = i / 16, x = pivot.x + off.x * t, y = pivot.y + off.y * t, z = pivot.z + off.z * t;
        let hit = false;
        for (const w of camWallList) { if (own && w.src === own) continue; if (y < w.h + 0.2 && x > w.x0 - 0.2 && x < w.x1 + 0.2 && z > w.z0 - 0.2 && z < w.z1 + 0.2) { hit = true; break; } }
        for (const o of cols) {
          if (o === ownC || o.type !== "circle") continue;
          const d = Math.hypot(x - o.x, z - o.z) - o.r;
          if (d < 0.25) { hit = true; break; }
          if (t > 0.35) near = Math.min(near, d);
        }
        if (hit) { free = Math.max(1.6, (t - 0.08) * dist); break; }
      }
      return { off, free, near };
    };
    // straight behind unless something big is in the way; then swing a little either side to where the view is clear
    const base = DRV.yawC + Math.PI + DRV.look;
    let best = probe(base + (DRV.swing || 0)), bestA = DRV.swing || 0;
    const score = r => r.free / dist * 2 + Math.min(1.2, r.near) - Math.abs(r.a) * 0.6;
    best.a = bestA;
    if (best.free < dist * 0.8 || best.near < 0.9) for (const da of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9]) { const r = probe(base + da); r.a = da; if (score(r) > score(best) + 0.15) { best = r; bestA = da; } }
    else if (DRV.swing) { const r = probe(base); r.a = 0; if (score(r) >= score(best) - 0.05) { best = r; bestA = 0; } }
    DRV.swingT = bestA; DRV.swing = DRV.camInit ? bestA : damp(DRV.swing || 0, bestA, 2.5, dt);
    const fin = Math.abs(DRV.swing - bestA) < 0.01 ? best : probe(base + DRV.swing), off = fin.off, free = fin.free;
    DRV.free = DRV.free == null || DRV.camInit ? free : free < DRV.free ? damp(DRV.free, free, 16, dt) : damp(DRV.free, free, 2, dt);
    const k = DRV.free / dist;
    pos = new THREE.Vector3(pivot.x + off.x * k, pivot.y + off.y * Math.max(k, 0.7) + (1 - k) * 0.8, pivot.z + off.z * k);
    const lead = clamp(sp * 0.32, -3, 6);
    look = new THREE.Vector3(p.x, 1.0, p.z).addScaledVector(fwd, 1.2 + lead);
    fov = fovBase + Math.min(16, as * 0.55);
  }
  // the shake: a hit rattles the frame and settles
  if (DRV.shake > 0.002 && !still()) { const s = DRV.shake; pos.x += (Math.random() - 0.5) * s * 0.5; pos.y += (Math.random() - 0.5) * s * 0.35; pos.z += (Math.random() - 0.5) * s * 0.5; }
  DRV.shake = damp(DRV.shake, 0, 7, dt);
  // easing in from wherever the camera was (the walk's shoulder), then following tightly
  DRV.blend = Math.min(1, DRV.blend + dt / (FAST ? 0.05 : 1.1));
  const tight = DRV.camInit || still() ? 1 : DRV.cam === "car" ? 1 - Math.exp(-30 * dt) : 1 - Math.exp(-(2 + 9 * EZ(DRV.blend)) * dt);
  if (DRV.camInit) { if (DRV.blend < 1 && DRV.cam === "chase" && camera.position.lengthSq() > 0) { DRV.pos.copy(camera.position); DRV.tgt.copy(camState.look); } else { DRV.pos.copy(pos); DRV.tgt.copy(look); } DRV.camInit = false; }
  DRV.pos.lerp(pos, tight); DRV.tgt.lerp(look, DRV.cam === "car" ? 1 : tight);
  camera.position.copy(DRV.pos); camState.look.copy(DRV.tgt); camera.lookAt(DRV.tgt);
  DRV.fov = DRV.fov ? damp(DRV.fov, fov, 3, dt) : fov;
  if (Math.abs(camera.fov - DRV.fov) > 0.05) { camera.fov = DRV.fov; camera.updateProjectionMatrix(); }
  post.comp.u.uDofK.value = 0; post.comp.u.uRange.value = 12; post.comp.u.uFocus.value = camera.position.distanceTo(DRV.tgt);
  return true;
}

/* ================================================================
   JUNE 2025, AND THE NEXT MORNING. The waiting room: sitting down beside
   him is a hold (a ring fills under your thumb with a heartbeat in the
   sound and the haptic; let go early and nothing happens), his phone
   buzzes on the seat until you answer it or let it ring, a coffee from the
   machine goes from your hand into his, a finger leaves a line in the fog
   on the window, and on the way out the window warms toward dawn. The
   morning lot: Marisol, the test drive around the block through the
   guide's ring and chevrons on a gentle clock (never a fail), and the car
   driving off while Jason watches. Nothing here allocates per frame.
   ================================================================ */
/* a beat of silence before and after a line, in ms: the lines that need room */
const BEATS = { "june-you-3": [700, 300], "june-jason-1": [1500, 500], "june-jason-2": [0, 1900], "june-jason-3": [500, 900], "june-jason-5": [0, 900], "june-jason-7": [0, 900], "june-you-9": [600, 400], "sale-jason-9": [0, 500] };
const beat = (id, i) => { const b = BEATS[id]; return b && b[i] && !FAST ? sleep(still() ? Math.min(b[i], 700) : b[i]) : null; };

/* ---------- the hold ---------- */
el.insertAdjacentHTML("beforeend", '<div class="st-hold" aria-hidden="true" hidden><svg viewBox="0 0 64 64"><circle class="st-hold__bg" cx="32" cy="32" r="28"/><circle class="st-hold__fg" cx="32" cy="32" r="28"/></svg></div>');
const holdEl = $(".st-hold", el), holdFg = $(".st-hold__fg", holdEl);
const HELD = { key: false, ptr: false };
const holdKey = k => k === SET.keys.act || k === "enter" || k === " ";
addEventListener("keydown", e => { if (holdKey(e.key.toLowerCase())) HELD.key = true; }, true);
addEventListener("keyup", e => { if (holdKey(e.key.toLowerCase())) HELD.key = false; }, true);
addEventListener("pointerdown", () => { HELD.ptr = true; }, true);
for (const ev of ["pointerup", "pointercancel", "blur"]) addEventListener(ev, () => { HELD.ptr = false; HELD.key = false; }, true);
const heldNow = () => HELD.key || HELD.ptr || pb(0);
let HOLDG = null;
/* resolves true once the ring has filled; false if you let go first (silently). A walk that brought you here, or a
   press already over, fills on its own: nobody has to hold a button they've let go of */
function holdTo(how) {
  return new Promise(res => {
    const host = dev === "touch" && !actEl.hidden ? actEl : promptEl, r = host.getBoundingClientRect();
    holdEl.style.transform = "translate(" + Math.round(host === actEl ? r.left + r.width / 2 : r.left + 22) + "px," + Math.round(r.top + r.height / 2) + "px)";
    holdFg.style.strokeDashoffset = "176"; holdEl.hidden = false; void holdEl.offsetWidth; holdEl.classList.add("is-on");
    HOLDG = { t: 0, beat: 0, auto: how === "debug" || how === "walk" ? true : null, dur: FAST ? 0.9 : still() ? 0.8 : 1.3, res, id: near ? near.id : null };
  });
}
function holdTick(dt) {
  const H = HOLDG; if (!H) return;
  if (H.auto === null) H.auto = !heldNow(); // decided a frame in, once the press that started it has registered
  if ((!H.auto && !heldNow()) || S.phase !== "explore" || (near && H.id && near.id !== H.id)) { endHold(false); return; }
  H.t += dt; H.beat -= dt;
  const u = Math.min(1, H.t / H.dur);
  holdFg.style.strokeDashoffset = (176 * (1 - u)).toFixed(1);
  // the pulse: a heartbeat in the sound and the hand, quickening a little as the ring fills
  if (H.beat <= 0) { H.beat = 0.62 - u * 0.16; AU.heart(0.6 + u * 0.6); hap("heart"); holdEl.classList.remove("is-beat"); void holdEl.offsetWidth; holdEl.classList.add("is-beat"); }
  if (u >= 1) endHold(true);
}
function endHold(ok) { const H = HOLDG; HOLDG = null; holdEl.classList.remove("is-on", "is-beat"); setTimeout(() => { if (!HOLDG) holdEl.hidden = true; }, 260); if (H) H.res(ok); }

/* a walk the episode takes for you (you can't steer it; S.busy keeps the controls and the prompts out of it) */
function walkAwait(v, ms = 12000) { return new Promise(res => { const t = setTimeout(() => res(false), FAST ? 40000 : ms); /* (the harness's software clock is slow) */ if (!walkTo(v, () => { clearTimeout(t); res(true); }, { ring: false })) { clearTimeout(t); res(false); } }); }
const raceT = (p, ms) => Promise.race([p || Promise.resolve(), new Promise(r => setTimeout(r, ms))]); // (a real cap: sleep() is cut short under the harness)

/* sitting down beside him: to the front of the seat, turn, sit */
async function sitBeside() {
  const st = set.userData.seats && set.userData.seats.you; if (!st || !me || !me.sitDown) return;
  S.busy = true; hideWorldUI(); mv.path = null;
  try {
    const ap = me.seatApproach ? me.seatApproach(st.p, st.yaw) : st.p;
    if (Math.hypot(ap.x - me.pos.x, ap.z - me.pos.z) > 0.7) await walkAwait(new THREE.Vector3(ap.x, 0, ap.z));
    FX("arrive"); hap("heart"); AU.use("sit", st.p);
    await raceT(me.sitDown(st.p, st.yaw, FAST ? { dur: 0.3, speed: 3 } : {}), FAST ? 40000 : 9000);
    // (the body settles a beat after the sequence hands back: the talk starts once you're really down)
    for (let t0 = performance.now(); !me.seated && me.car && performance.now() - t0 < (FAST ? 40000 : 3000);) await new Promise(r => setTimeout(r, 50));
  } catch (e) {}
  S.busy = false;
}
/* the coffee: the machine, a cup into the tray, picked up, carried over, and his hand takes it from yours */
async function coffeeRun(s) {
  const ud = set.userData, J = P.jason;
  S.busy = true; hideWorldUI(); mv.path = null;
  try {
    if (me.seated && me.standUp) await raceT(me.standUp(), FAST ? 90000 : 3000);
    const stand = s.sp.stand;
    if (stand && Math.hypot(stand.x - me.pos.x, stand.z - me.pos.z) > 0.5) await walkAwait(stand);
    me.wantYaw = Math.atan2(s.p.x - me.pos.x, s.p.z - me.pos.z);
    const btn = s.p.clone().add(new THREE.Vector3(0.12, 0.42, 0.06));
    let pressed = false; const press = () => { if (pressed) return; pressed = true; FX("arrive"); AU.thing("june-coffee", s.p); hap("tap"); };
    await raceT(me.press ? me.press(btn, { hand: "r", onContact: press }) : null, FAST ? 90000 : 3000); press();
    await sleep(FAST ? 50 : 1700);
    const cup = ud.dropCup ? ud.dropCup() : null;
    let picked = null;
    if (cup && me.pickUp) await raceT(me.pickUp(cup, { hold: "cup", hand: "l", onContact: () => { AU.use("pickup", cup.position); hap("tap"); } }).then(v => (picked = v)), FAST ? 90000 : 6000);
    const side = me.carrying ? (me.carrying.l && me.carrying.l.obj === cup ? "l" : me.carrying.r && me.carrying.r.obj === cup ? "r" : null) : null;
    S.cof = { side, cup: !!cup, picked, carry: me.carrying ? Object.keys(me.carrying).filter(k => me.carrying[k]) : null };
    // across to him; the camera takes the two of you in for the hand-over
    await walkAwait(J.pos.clone().add(new THREE.Vector3(0.12, 0, 0.78)));
    me.wantYaw = Math.atan2(J.pos.x - me.pos.x, J.pos.z - me.pos.z);
    J.lookAtP = headOf(me);
    S.partner = J; setPhase("talk"); shotChoices();
    await sleep(FAST ? 50 : 450);
    if (cup && side && J.pickUp) {
      // his hand comes up to the cup; yours lets go as his closes on it
      const give = () => { if (me.carrying && me.carrying[side]) { me.carrying[side] = null; try { me.release(side); } catch (e) {} } hap("tap"); AU.use("pickup", cup.position); };
      S.cof.took = await raceT(J.pickUp(cup, { hold: "cup", onContact: give }), FAST ? 90000 : 6000); give();
    } else if (cup) cup.visible = false;
  } catch (e) {}
  S.busy = false;
}
/* the phone: buzzing on the seat now and then until you've looked at it; answered, it goes to your ear */
let buzzT = 6;
function phoneBuzz(on, n = 2) {
  const ud = set && set.userData; if (!ud || !ud.phoneBuzz) return;
  ud.phoneBuzz(on);
  if (on) {
    const at = ud.phone.position; AU.buzz({ x: at.x, y: at.y, z: at.z }, n);
    if (me && Math.hypot(at.x - me.pos.x, at.z - me.pos.z) < 3.5) hap("tap");
    clearTimeout(phoneBuzz.t); phoneBuzz.t = setTimeout(() => { if (ud.phoneBuzz) ud.phoneBuzz(false); }, n * 1100);
  }
}
function phoneChoice(k) {
  const ud = set.userData;
  if (k === "answered") { if (ud.phoneBuzz) ud.phoneBuzz(false); if (ud.phone) ud.phone.visible = false; me.hold = "phone"; S.phoneEar = (S.phoneEar || 0) + 1; AU.use("pickup", ud.phone ? ud.phone.position : me.pos); hap("tap"); }
  else phoneBuzz(true, 3);
}
function juneTick(dt) {
  if (S.scene !== "june") return;
  const ud = set.userData;
  // a buzz every so often once you've sat with him, until you look
  if (S.flags.sat && !S.looked["june-phone"] && S.phase === "explore" && (buzzT -= dt) <= 0) { buzzT = 11 + Math.random() * 5; phoneBuzz(true, 2); }
}
/* on the way out: the window warms toward morning before the cut */
function dawnBreak() {
  const ud = set.userData; if (!ud.dawn) return Promise.resolve();
  const sp = ud.spots["june-window"];
  if (sp) { const from = new THREE.Vector3(2.2, 1.45, 1.9); camState.shot = { pos: from, look: sp.p.clone().add(new THREE.Vector3(0, -0.05, 0)), push: still() ? 0 : 0.12, dur: 5, focus: from.distanceTo(sp.p), range: 3 }; camState.shotT = 0; camState.cut = false; }
  const dur = (FAST ? 0.15 : still() ? 1.4 : 4.2) * 1000, t0 = performance.now();
  return new Promise(res => { const step = () => { const u = Math.min(1, (performance.now() - t0) / dur); ud.dawn(u * u * (3 - 2 * u)); if (u < 1) requestAnimationFrame(step); else res(); }; step(); });
}
/* the close, slow camera beside him: low, near shoulder height, the background soft */
function juneShot(L) {
  const J = P.jason, jh = headOf(J), yh = headOf(me), mid = jh.clone().lerp(yh, 0.5), reduced = still();
  const fwd = new THREE.Vector3(Math.sin(J.yaw), 0, Math.cos(J.yaw)), side = new THREE.Vector3(fwd.z, 0, -fwd.x);
  if (L.who === "jason") {
    // on him, from just in front of your shoulder, the lens at his eye line looking a little up
    const pos = yh.clone().addScaledVector(fwd, 0.62).addScaledVector(side, -0.08).add(new THREE.Vector3(0, -0.2, 0));
    camState.shot = { pos, look: jh.clone().add(new THREE.Vector3(0, -0.05, 0)), push: reduced ? 0 : 0.14, dur: 12, focus: pos.distanceTo(jh), range: 1.1 };
  } else {
    // the two of you on the row, from low in front, the room falling away behind
    const pos = mid.clone().addScaledVector(fwd, 1.7).addScaledVector(side, 0.55).add(new THREE.Vector3(0, -0.28, 0));
    camState.shot = { pos, look: mid.clone().add(new THREE.Vector3(0, -0.12, 0)), push: reduced ? 0 : 0.1, dur: 12, focus: pos.distanceTo(mid), range: 1.7 };
  }
  camState.shotT = 0; camState.cut = !camState.juneIn; camState.juneIn = true;
}

/* ---------- the morning: the car, the course, the drive away ---------- */
function saleCar() { return set && set.userData.drivable ? set.userData.drivable.find(c => c.id === "car") || null : null; }
/* a point beside the car in its own frame (x to its left, the driver's side; z ahead) */
function carLocal(c, x, z) { const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw); return new THREE.Vector3(c.x + x * cs + z * sn, 0, c.z - x * sn + z * cs); }
/* the car back where it was parked, should anything have moved it (a chapter replayed, the keys morning) */
function saleCarHome() {
  const c = saleCar(); if (!c || !c.home) return;
  const h = c.home, v = DRV.vehs.get(c);
  if (Math.abs(c.x - h.x) + Math.abs(c.z - h.z) + Math.abs(c.yaw - h.yaw) > 0.01) { if (v) { try { v.reset(h.x, h.z, h.yaw); v.dispose(); } catch (e) {} } else Object.assign(c, { x: h.x, z: h.z, yaw: h.yaw }); navFor = null; camWallsFor = null; }
  if (c.object) c.object.visible = false;
  if (set.userData.showRig) set.userData.showRig(c, false);
}
const COURSE = { i: 0, t: 0, hits0: 0, shown: false, par: 80, path: [new THREE.Vector3(), new THREE.Vector3()],
  // round the lamp, out of the gate, west along the road past the laundromat, round through the empty lot by the taco
  // truck, back east, in at the gate, and park in front of it
  pts: [[-3.4, 11.2, 3.0], [0, 23.4, 3.6], [-10, 30.4, 4.4], [-28.5, 41.5, 4.8], [-12, 28.6, 4.4], [0, 27.4, 3.8], [0.4, 19.5, 3.4], [0.8, 13.2, 3.4]] };
const courseG = new Guide(world); courseG.ringMesh.scale.set(4.2, 1, 4.2);
el.insertAdjacentHTML("beforeend", '<div class="st-course" aria-hidden="true" hidden><i class="st-course__t"><b></b></i><span class="st-course__pips">' + COURSE.pts.map(() => "<b></b>").join("") + "</span></div>");
const courseEl = $(".st-course", el), courseBar = $(".st-course__t b", courseEl), coursePips = $$(".st-course__pips b", courseEl);
const courseLive = () => S.open && S.scene === "sale" && !!S.flags.testdrive && !S.flags.droven;
function courseReset() { COURSE.i = 0; COURSE.t = 0; COURSE.shown = false; courseG.clearRing(); courseG.trail(null, 0); coursePips.forEach(b => b.classList.remove("is-on")); courseEl.classList.remove("is-on"); courseEl.hidden = true; }
function courseTick(dt) {
  if (!courseLive()) { if (COURSE.shown) { COURSE.shown = false; courseG.clearRing(); courseG.trail(null, 0); courseEl.classList.remove("is-on"); } courseG.tick(dt, S.t, still()); return; }
  const pt = COURSE.pts[COURSE.i];
  // the next checkpoint stays on the ground whether you're in the car or not
  if (!COURSE.shown) { courseG.ring(pt[0], pt[1]); COURSE.shown = true; courseEl.hidden = false; }
  const v = DRV.state === "drive" && DRV.veh;
  if (v) {
    const p = v.pose, d = Math.hypot(pt[0] - p.x, pt[1] - p.z);
    COURSE.t += dt;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    COURSE.path[0].set(p.x + fx * 2.2, 0, p.z + fz * 2.2); COURSE.path[1].set(pt[0], 0, pt[1]);
    courseG.trail(d > 6 ? COURSE.path : null, clamp((d - 6) / 6, 0, 1) * 0.8);
    courseBar.style.transform = "scaleX(" + clamp(1 - COURSE.t / COURSE.par, 0, 1).toFixed(3) + ")";
    if (d < pt[2]) coursePass();
  } else courseG.trail(null, 0);
  courseEl.classList.toggle("is-on", !!v);
  courseG.tick(dt, S.t, still());
}
function coursePass() {
  const i = COURSE.i++;
  // the ring closes as you go through it: the sound, the buzz and the motion in the same frame
  courseG.land(); AU.ui("land"); FX("key"); hap("tap");
  if (coursePips[i]) coursePips[i].classList.add("is-on");
  if (COURSE.i === 4) objective("back"); // turned round by the taco truck: home now
  if (COURSE.i >= COURSE.pts.length) { courseFinish(); return; }
  const n = COURSE.pts[COURSE.i]; setTimeout(() => { if (courseLive() && COURSE.pts[COURSE.i] === n) courseG.ring(n[0], n[1]); }, FAST ? 30 : 380);
}
async function courseFinish() {
  S.flags.droven = 1;
  const hits = DRV.hits - COURSE.hits0, k = COURSE.t > COURSE.par || hits > 2 ? "scenic" : hits === 0 && COURSE.t < COURSE.par * 0.55 ? "fast" : hits === 0 ? "smooth" : "scenic";
  S.flags.drove = k; T("story_testdrive", { result: k, t: Math.round(COURSE.t), hits });
  courseEl.classList.remove("is-on"); setTimeout(() => { courseEl.hidden = true; }, 400);
  FX("arrive"); hap("success"); AU.ui("notice"); toast(UI["drive_" + k] || "");
  await sleep(FAST ? 50 : 900);
  await exitCar("course");
  await sleep(FAST ? 50 : 400);
  if (S.scene === "sale" && !S.ending) { S.partner = P.marisol; await runTalk("sale-done"); }
}
/* the drive away: Marisol at the wheel, out of the gate and right along the road until the corner takes her; the camera
   holds wide over Jason's shoulder while he watches */
let AUTO = null;
async function driveOff() {
  const c = saleCar(), M0 = P.marisol; if (!c || !M0) return;
  const mod = await vehMod(); if (!mod || S.scene !== "sale") return;
  let v = DRV.vehs.get(c);
  if (!v) { try { v = mod.createVehicle(set, c, { quality }); } catch (e) { return; } DRV.vehs.set(c, v); }
  else { if (set.userData.showRig) set.userData.showRig(c, true); const cols = set.userData.colliders || [], i = c.collider ? cols.indexOf(c.collider) : -1; if (i >= 0) cols.splice(i, 1); }
  if (v.engine && !v.engine.on) { try { v.engine.start(); } catch (e) {} }
  const p0 = v.pose, pts = [[-2.8, 8.5], [0, 18], [0.3, 25.6], [7, 29.4], [44, 29.4]].filter(q => q[1] > p0.z + 1.5 || q[0] > 5);
  // the camera: wide, behind Jason, the gate and the road in front of him
  const J = P.jason, jh = headOf(J), toG = new THREE.Vector3(0.5 - J.pos.x, 0, 27 - J.pos.z).normalize(), side = new THREE.Vector3(toG.z, 0, -toG.x);
  const pos = jh.clone().addScaledVector(toG, -2.6).addScaledVector(side, 0.9).add(new THREE.Vector3(0, 0.35, 0));
  S.heldShot = { pos, look: new THREE.Vector3(1.5, 1.3, 25), push: still() ? 0 : 0.05, dur: 10, focus: 12, range: 30 };
  if (S.phase === "talk") { camState.shot = S.heldShot; camState.shotT = 0; camState.cut = true; }
  // she gets in on the cut, so the wide shot opens with her at the wheel
  try { M0.drive(v, "driver"); } catch (e) {}
  return new Promise(res => { AUTO = { v, c, pts, i: 0, t: 0, done: res }; });
}
function autoTick(dt) {
  const A = AUTO; if (!A) return;
  A.t += dt;
  const p = A.v.pose, q = A.pts[A.i];
  if (q && Math.hypot(q[0] - p.x, q[1] - p.z) < 3.2) A.i++;
  const tgt = A.pts[Math.min(A.i, A.pts.length - 1)];
  const err = angTo(p.yaw, Math.atan2(tgt[0] - p.x, tgt[1] - p.z));
  A.v.update(dt, { throttle: Math.abs(A.v.speed) < (A.i >= 3 ? 7 : 4) ? 0.5 : 0, brake: 0, steer: clamp(-err * 1.8, -1, 1), handbrake: 0 });
  if (P.jason) { const lk = A.lk || (A.lk = new THREE.Vector3()); P.jason.lookAtP = lk.set(p.x, 1.2, p.z); }
  if ((A.i >= A.pts.length - 1 && p.x > 24) || A.t > (FAST ? 4 : 26)) {
    // round the corner: gone
    AUTO = null; A.c.object.visible = false;
    if (P.marisol) { try { P.marisol.driving = null; } catch (e) {} hide(P.marisol); }
    A.done();
  }
}
/* ================================================================
   LAMPS: the eight that matter, nearest the camera
   ================================================================ */
/* the lamps the shaders light with: re-ranked only when the camera has moved a metre and a half (or the set or its
   lamps changed), into one array kept between frames; the values are written every frame (lights fade) */
const lampOrder = [], lampAt = new THREE.Vector3(1e9, 0, 0);
let lampSet = null, lampN = -1;
const lampCmp = (a, b) => (a.fixed ? -1 : 0) - (b.fixed ? -1 : 0) || a.p.distanceToSquared(lampAt) - b.p.distanceToSquared(lampAt);
function updateLamps() {
  const src = set.userData.lamps, c = camera.position;
  if (lampSet !== set || lampN !== src.length || lampAt.distanceToSquared(c) > 2.25) {
    lampSet = set; lampN = src.length; lampAt.copy(c);
    lampOrder.length = 0; for (let i = 0; i < src.length; i++) lampOrder.push(src[i]);
    lampOrder.sort(lampCmp);
  }
  const L = lampOrder;
  const n = Math.min(MAXL, L.length);
  const day = S.scene === "keys" || S.scene === "sale";
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
   THE WAY: where the story wants you next. Chevrons on the ground along
   the route (guide.js), an arrow at the edge of the screen when the place
   is off it, both fading as you arrive and gone in conversations and
   cinematics; and if you wander a while without getting anywhere, the
   arrow pulses once and the objective says itself again.
   ================================================================ */
const SAFE = { t: 0, r: 0, b: 0, l: 0 };
function readSafe() {
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  body.appendChild(d); const cs = getComputedStyle(d);
  SAFE.t = parseFloat(cs.paddingTop) || 0; SAFE.r = parseFloat(cs.paddingRight) || 0; SAFE.b = parseFloat(cs.paddingBottom) || 0; SAFE.l = parseFloat(cs.paddingLeft) || 0; d.remove();
}
/* where the way leads. In order: what the episode needs from you now (an objective that names a place); then the
   place the last thing said pointed you to (Jason's "find the whiteboard", "open the filing cabinet"), until you've
   been there; then the nearest thing you haven't looked at; and if nothing names a place, the next step of the story.
   A place in another set routes to the way into it (the office door from the lot, an exit back out). */
const HINTS = { "hire-build": "board", "hire-ai": "phone", "hire-ops": "cabinet", "hire-sales": "renata", "lot-calls": "phone", "lot-paperwork": "cabinet", "lot-leads": "laptop", "lot-notebook": "renata", "lot-come-in": "renata", "why-curious": "renata", "why-deflect": "door", "book-hint": "book" };
function hintFrom(talk) {
  const id = HINTS[talk]; if (!id) return;
  const o = OBJ[id]; S.hint = { id, scene: o ? o.scene : S.scene, from: talk };
}
/* the way out of this set toward another: the world's exits first, then the doors we know */
function exitToward(scene) {
  const sp = set && set.userData.spots; if (!sp) return null;
  for (const [id, x] of Object.entries(sp)) if (x && x.kind === "exit" && (x.to === scene || (scene === "decision" && x.to === "lot"))) return { id, sp: x, p: x.p || x.at || x.stand };
  if (S.scene === "lot" && scene === "office" && sp.door) return { id: "door", sp: sp.door, p: sp.door.p };
  return null;
}
function wayTarget() {
  if (!me) return null;
  const here = spotsHere(), spot = id => here.find(x => x.id === id) || null;
  const o = S.obj, F = S.flags;
  let s = null, soft = false;
  // 1. what the episode needs now
  if (S.scene === "memory" && F.packed) s = spot("mem-lamp");
  else if (S.scene === "decision") s = spot("jason-end");
  else if (o === "find") s = spot("jason-lot");
  else if (o === "office") s = spot("door");
  else if (o === "phone") s = spot("phone");
  else if (o === "book") s = spot("book");
  else if (o === "keys") s = spot("keys");
  else if (o === "sit") s = spot("june-jason");
  else if (o === "june-go") s = spot("june-door");
  else if (o === "sale") s = spot("sale-buyer");
  else if ((o === "drive" || o === "back") && S.scene === "sale" && courseLive()) s = here.find(x => x.id === "car:car") || null;
  // 2. the place the last thing said pointed to
  if (!s && S.hint && !S.looked[S.hint.id]) {
    if (S.hint.scene === S.scene) s = spot(S.hint.id);
    else { const x = exitToward(S.hint.scene); if (x) s = here.find(h => h.id === x.id) || { id: x.id, sp: x.sp, p: x.p, o: {} }; }
  }
  // 3. the nearest thing you haven't looked at
  if (!s && (o === "pack" || o === "look" || o === "june-look")) {
    let bd = 1e9; soft = o === "look";
    for (const c of here) {
      if (S.looked[c.id] || c.o.who || c.o.go || c.o.car || c.o.world || c.id === "phone" || c.id === "book" || ((o === "pack" || o === "june-look") && !c.o.pack)) continue;
      const d = Math.hypot(c.p.x - me.pos.x, c.p.z - me.pos.z); if (d < bd) { bd = d; s = c; }
    }
  }
  // 4. nothing named a place: the next step of the story
  if (!s) {
    if (S.scene === "lot") s = F.met ? spot("door") : spot("jason-lot");
    else if (S.scene === "office") s = !F.desked ? spot("renata") : F.ringing && !F.called ? spot("phone") : F.hinted && !S.looked.book ? spot("book") : null;
    else if (S.scene === "june") s = !F.sat ? spot("june-jason") : F.juned ? spot("june-door") : null;
    else if (S.scene === "sale") s = !F.testdrive ? spot("sale-buyer") : null;
  }
  if (!s || !s.p) return null;
  let st = (s.sp && s.sp.stand) || s.p;
  if (s.sp && s.sp.who) { const w = P[s.sp.who]; const d = me.pos.clone().sub(w.pos).setY(0); if (d.length() < 0.01) d.set(0, 0, 1); st = w.pos.clone().addScaledVector(d.normalize(), 1.25); }
  return { id: s.id, stand: st, p: s.sp && s.sp.who ? headOf(P[s.sp.who]) : s.p, soft };
}
let guideRoute = null, wayT = 0, wayKey = "", wayFrom = null;
let progT = 0, progWalk = 0, lastPos = null, nudges = 0;
const STUCK_S = FAST ? 3 : 45;
function progress() { progT = 0; progWalk = 0; }
const way = { show: false, x: 0, y: 0, ang: 0, k: 0, id: null, d: 0 };
function updateWay(dt) {
  const tgt = S.phase === "explore" && !S.skipOpen ? wayTarget() : null;
  way.id = tgt ? tgt.id : null;
  if (!tgt) { guide.trail(null, 0); if (way.show) { way.show = false; wayEl.classList.remove("is-on"); } lastPos = null; return; }
  const d = Math.hypot(tgt.stand.x - me.pos.x, tgt.stand.z - me.pos.z); way.d = d;
  wayT -= dt;
  const key = tgt.id + ":" + S.scene;
  if (key !== wayKey || wayT <= 0 || !wayFrom || Math.hypot(me.pos.x - wayFrom.x, me.pos.z - wayFrom.z) > 0.6) {
    const n = navNow(); guideRoute = n ? n.path(me.pos.x, me.pos.z, tgt.stand.x, tgt.stand.z) : null;
    if (key !== wayKey) progress();
    wayKey = key; wayT = 0.5; wayFrom = { x: me.pos.x, z: me.pos.z };
  }
  const k = clamp((d - 1.6) / 3, 0, 1) * (tgt.soft ? 0.6 : 1) * (mv.path ? 0.45 : 1);
  guide.trail(guideRoute, k); way.k = k;
  // the edge arrow: only when the place is off screen, pointing the way to turn
  v2.set(tgt.p.x, Math.min(tgt.p.y || 1.2, 1.7), tgt.p.z).project(camera);
  const W = VW, H = VH, behind = v2.z > 1;
  let sx = (v2.x * 0.5 + 0.5) * W, sy = (-v2.y * 0.5 + 0.5) * H;
  const mL = 30 + SAFE.l, mR = 30 + SAFE.r, mT = 84 + SAFE.t, mB = (dev === "touch" ? 132 : 70) + SAFE.b;
  const onScreen = !behind && sx > mL && sx < W - mR && sy > mT && sy < H - mB;
  const cx = (mL + W - mR) / 2, cy = (mT + H - mB) / 2;
  let dx = sx - cx, dy = sy - cy;
  if (behind) { dx = -dx; dy = -dy; if (Math.abs(dx) < 1 && Math.abs(dy) < 1) dx = 1; dy = Math.max(dy, Math.abs(dx) * 0.2); }
  const show = !onScreen && d > 2.6;
  if (show) {
    const tx = dx > 0 ? (W - mR - cx) / dx : dx < 0 ? (mL - cx) / dx : 1e9, ty = dy > 0 ? (H - mB - cy) / dy : dy < 0 ? (mT - cy) / dy : 1e9;
    const t = Math.min(tx, ty);
    way.x = cx + dx * t; way.y = cy + dy * t; way.ang = Math.atan2(dy, dx);
    wayEl.style.transform = "translate(" + way.x.toFixed(0) + "px," + way.y.toFixed(0) + "px) rotate(" + way.ang.toFixed(3) + "rad)";
    wayEl.style.opacity = clamp((d - 2.6) / 2.5, 0.35, 1).toFixed(2);
  }
  if (show !== way.show) { way.show = show; wayEl.classList.toggle("is-on", show); }
  // the stuck helper
  if (lastPos) progWalk += Math.hypot(me.pos.x - lastPos.x, me.pos.z - lastPos.z);
  lastPos = { x: me.pos.x, z: me.pos.z };
  progT += dt;
  if (progT > STUCK_S && progWalk > (FAST ? 0 : 8)) nudge();
}
function nudge() {
  progT = STUCK_S - 30; progWalk = 0; nudges++;
  guide.nudge();
  wayEl.classList.remove("is-pulse"); void wayEl.offsetWidth; wayEl.classList.add("is-pulse");
  setTimeout(() => wayEl.classList.remove("is-pulse"), 1400);
  if (S.obj) objective(S.obj); else if (way.id) { objEl.classList.remove("is-on"); void objEl.offsetWidth; objEl.classList.add("is-on"); }
  T("story_nudge", { scene: S.scene, obj: S.obj || "" });
}

/* ================================================================
   THE LOOP, WITH ADAPTIVE QUALITY, AND REST WHEN NOTHING MOVES
   ================================================================ */
let last = performance.now(), acc = 0, frames = 0, fpsLog = [], lastDraw = 0, dtS = 0;
const drawLog = [];
const perf = {};
let raf = 0;
const camFwd = new THREE.Vector3();
function frame(now) {
  raf = requestAnimationFrame(frame);
  frameNo++;
  if (!S.open || document.hidden || S.attract) { last = now; return; }
  if (line) ball.draw(line, now); // the caption ball keeps the full frame rate even when the scene rests
  padPoll(Math.min(0.05, (now - last) / 1000));
  // battery: behind the journal or the pause menu there's nothing to draw; standing still, thirty frames are plenty
  const over = S.phase === "pause" || S.phase === "journal";
  const idle = (S.phase === "explore" && mv.idle > 3 && me && me.speed < 0.05 && camState.drag <= 0 && !ptrs.size) || (S.phase === "talk" && COARSE.matches);
  // full rate whenever anything moves (you, the camera, a car, a talk on a desktop); thirty only when nothing does
  const every = over ? 500 : S.phase === "sheet" || S.phase === "end" ? 100 : idle && !DRV.state ? 32 : 0;
  if (every && now - lastDraw < every) return;
  lastDraw = now;
  if (DEBUG) { drawLog.push(now); if (drawLog.length > 4000) drawLog.splice(0, 2000); }
  // even pacing: the step follows a smoothed frame time, so one late frame doesn't throw everything forward at once
  const raw = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  dtS = dtS ? (raw > dtS * 2.2 ? Math.min(raw, dtS * 1.6) : dtS + (raw - dtS) * 0.3) : raw;
  let dt = every ? raw : Math.min(0.05, dtS);
  if (over) dt = 0;
  S.t += dt; U.uTime.value = S.t;
  const tA = performance.now();
  if (!over) {
    tickLine(dt); tickChoices(dt); ringTick(dt); holdTick(dt); juneTick(dt); courseTick(dt); autoTick(dt);
    if (DRV.veh) tickDrive(dt);
    drvEl.classList.toggle("is-on", S.phase === "drive" && DRV.state === "drive");
    if (!DRV.state) moveMe(dt);
    movePeople(dt);
    const tP = performance.now();
    for (const p of Object.values(P)) if (p.group.visible) p.update(dt);
    feet();
    perf.people = performance.now() - tP;
    updateCamera(dt);
    const tU = performance.now();
    updatePrompts(); updateWay(dt); arcadeWatch(dt); platesTick(dt);
    guide.tick(dt, S.t, still());
    perf.prompts = performance.now() - tU;
    // the ear is the camera; the lamps that buzz are the ones nearest you
    camera.getWorldDirection(camFwd); AU.listen(camera.position, camFwd);
    const typist = S.scene === "office" && P.jason && P.jason.group.visible && !P.jason.path && P.jason.speed < 0.1 && S.phase === "explore" && set.userData.marks && P.jason.pos.distanceTo(set.userData.marks.jason) < 0.6 ? { x: -0.7, y: 0.8, z: -1.75 } : null;
    AU.update(dt, { ear: me ? me.pos : camera.position, day: S.scene === "keys" || S.scene === "sale", typist });
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
  // adapt, with hysteresis: two slow windows in a row step the resolution (then the quality) down; four with room to
  // spare step it back up; a change waits out a cool-down so it never hunts. Only frames drawn at the full rate (or the
  // phone's thirty) count; resting, menus and sheets don't.
  perf.frame = performance.now() - now; perf.gap = now - (frame.prev || now);
  if (every) { QA.n = 0; QA.gap = 0; QA.work = 0; QA.t0 = now; frame.prev = now; return; }
  if (frame.prev) { QA.n++; QA.gap += now - frame.prev; QA.work += perf.frame; }
  frame.prev = now;
  if (now - QA.t0 > 1500 && (QA.n > 8 || (QA.n >= 3 && QA.gap / QA.n > 80))) {
    const ms = QA.gap / QA.n, work = QA.work / QA.n;
    fpsLog.push(Math.round(1000 / ms)); if (fpsLog.length > 60) fpsLog.shift();
    QA.ms = +ms.toFixed(1); QA.cpu = +work.toFixed(1);
    const target = 17.5; // sixty, on a phone too: the ladder spends resolution and effects to get there
    const slow = ms > target * 1.18, roomy = ms < target * 1.04 && work < target * 0.45;
    QA.slow = slow ? QA.slow + 1 : 0; QA.roomy = roomy ? QA.roomy + 1 : 0;
    if (!S.lockQ && now > QA.cool) {
      // far too slow steps at once; a little slow has to be slow twice
      if (QA.slow >= 2 || (QA.slow && ms > target * 2)) { qualityStep(-1); QA.cool = now + (ms > target * 2 ? 1500 : 3000); QA.slow = 0; QA.roomy = 0; }
      else if (QA.roomy >= 4) { qualityStep(1); QA.cool = now + 6000; QA.roomy = 0; }
    }
    QA.n = 0; QA.gap = 0; QA.work = 0; QA.t0 = now;
  }
}
const QA = { n: 0, gap: 0, work: 0, t0: 0, slow: 0, roomy: 0, cool: 0, ms: 0, cpu: 0, q0: quality, log: [] };
/* one rung on the ladder: resolution first while it's high, then the quality (the reflections, the depth of field, the
   world's tier), then the last of the resolution; back up in the reverse order */
function qualityStep(dir) {
  const was = { pr: pixelRatio, q: quality };
  if (dir < 0) {
    if (pixelRatio > 0.9 + 0.01) pixelRatio = Math.max(0.9, +(pixelRatio * 0.86).toFixed(3));
    else if (quality > 0) quality--;
    else if (pixelRatio > PR_MIN + 0.01) pixelRatio = Math.max(PR_MIN, +(pixelRatio * 0.86).toFixed(3));
    else return;
  } else {
    const top = Math.min(devicePixelRatio || 1, PR_MAX);
    if (pixelRatio < 0.9 - 0.01) pixelRatio = Math.min(0.9, +(pixelRatio * 1.12).toFixed(3));
    else if (quality < QA.q0) quality++;
    else if (pixelRatio < top - 0.01) pixelRatio = Math.min(top, +(pixelRatio * 1.1).toFixed(3));
    else return;
  }
  post.q = quality; applyTier(); resize();
  QA.log.push({ t: Math.round(S.t), dir, from: was, to: { pr: pixelRatio, q: quality }, ms: QA.ms }); if (QA.log.length > 20) QA.log.shift();
}
/* the world's own tier follows the ladder where it offers one */
function applyTier() {
  try { if (set && set.userData && typeof set.userData.setTier === "function") set.userData.setTier(quality); } catch (e) {}
  try { if (typeof WORLD.setTier === "function") WORLD.setTier(quality); } catch (e) {}
}
document.addEventListener("visibilitychange", () => { if (!S.open) return; if (document.hidden) { AU.suspend(true); if (line && line.audio) line.audio.pause(); if (S.phase === "explore") pause(); } else { AU.suspend(false); if (S.phase !== "pause") resumeVoice(); } });

/* ================================================================
   OPEN AND CLOSE
   ================================================================ */
async function coldOpen() {
  // a quiet establishing sequence: low over the wet asphalt, past the lamps and the cars, to the showroom and Jason under the light.
  // Skip (or Esc, Enter, A) cuts straight to you at the gate, without a sound
  setPhase("cinematic"); el.classList.add("is-cinema");
  post.comp.u.uBox.value = 1;
  const u = set.userData;
  let skipped = false;
  const skipP = new Promise(r => { S.skipOpen = () => { if (skipped) return; skipped = true; r(); }; });
  skipEl.hidden = false; requestAnimationFrame(() => skipEl.classList.add("is-on"));
  const seq = (async () => {
    const p = rail(u.camRail, u.camLook, 13);
    await sleep(2800); if (skipped) return;
    $(".st-card__ep", cardEl).textContent = D.episode;
    $(".st-card__h", cardEl).textContent = D.title; $(".st-card__sub", cardEl).textContent = D.name;
    cardEl.classList.add("is-title"); cardEl.hidden = false; void cardEl.offsetWidth; cardEl.classList.add("is-on");
    if (SC()) SC().sting("open");
    await sleep(4200); if (skipped) return;
    cardEl.classList.remove("is-on"); await sleep(600); if (skipped) return; cardEl.hidden = true; cardEl.classList.remove("is-title");
    await p;
  })();
  await Promise.race([seq, skipP]);
  S.skipOpen = null; skipEl.classList.remove("is-on"); setTimeout(() => (skipEl.hidden = true), 300);
  if (skipped) T("story_skip", { what: "cold_open" });
  await fade(1, skipped ? 250 : 600);
  if (skipped) { camState.rail = null; cardEl.classList.remove("is-on", "is-title"); cardEl.hidden = true; }
  // you, at the gate
  place(me, set.userData.marks.playerIn, Math.PI);
  camState.init = true; camState.yaw = me.yaw + Math.PI; camState.pitch = 0.2;
  post.comp.u.uBox.value = 0; el.classList.remove("is-cinema");
  await fade(0, 800);
  showHint();
  setPhase("explore");
  await runTalk("lot-arrive");
}
/* ---------- turn sideways: on a phone held upright, a phone that turns itself,
   follows your tilt where the browser shares it, and lets go the moment you turn ---------- */
const TALL = matchMedia("(orientation: portrait)");
const esc = v => String(v == null ? "" : v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let turnEl = null, turnStayed = false;
function turnTilt(e) {
  if (!turnEl || e.gamma == null) return;
  const g = Math.max(-90, Math.min(90, e.gamma));
  turnEl.style.setProperty("--tilt", g.toFixed(1) + "deg");
  turnEl.classList.toggle("is-tilting", Math.abs(g) > 8);
}
function turnCheck() {
  const need = COARSE.matches && TALL.matches && !turnStayed && S.phase !== "ending";
  if (need && !turnEl) {
    turnEl = document.createElement("div");
    turnEl.className = "st-turn";
    turnEl.setAttribute("role", "dialog"); turnEl.setAttribute("aria-live", "polite");
    turnEl.innerHTML =
      '<div class="st-turn__stage" aria-hidden="true"><div class="st-turn__arc"></div><div class="st-turn__phone"><div class="st-turn__screen"><i></i><i></i><i></i></div></div></div>' +
      '<p class="st-turn__h">' + esc(UI.turn_h) + "</p>" +
      '<p class="st-turn__p">' + esc(UI.turn_p) + "</p>" +
      '<button class="st-turn__stay" type="button">' + esc(UI.turn_stay) + "</button>";
    el.appendChild(turnEl);
    requestAnimationFrame(() => turnEl && turnEl.classList.add("is-on"));
    $(".st-turn__stay", turnEl).addEventListener("click", () => { turnStayed = true; closeTurn(false); });
    addEventListener("deviceorientation", turnTilt);
  } else if (!need && turnEl) {
    closeTurn(!turnStayed && !TALL.matches);
  }
}
function closeTurn(arrived) {
  const t = turnEl; if (!t) return; turnEl = null;
  removeEventListener("deviceorientation", turnTilt);
  /* turning the phone is an arrival: light, sound and a tap together; staying upright is a skip, silent */
  if (arrived) { FX("arrive"); hap("success"); t.classList.add("is-turned"); }
  t.classList.remove("is-on");
  setTimeout(() => t.remove(), arrived ? 900 : 450);
}
TALL.addEventListener("change", () => setTimeout(turnCheck, 60));
function showHint() {
  turnCheck();
  hintEl.textContent = hintText();
  hintEl.hidden = false; hintEl.classList.add("is-on");
  setTimeout(() => { hintEl.classList.remove("is-on"); setTimeout(() => (hintEl.hidden = true), 600); }, FAST ? 100 : 8000);
}

let booted = false;
async function boot() {
  if (booted) return; booted = true;
  resize(); readSafe(); glyphs();
  setLoad(0.4, D.scenes.lot.card);
  cast = await loadCast("assets/story/cast/");
  setLoad(0.55);
  // the lot's cars and textures: world.js streams them and says how far it has got; it never waits past 14 s
  const onWorld = e => { const f = e.detail && e.detail.f; if (f != null) setLoad(0.55 + 0.15 * f); };
  document.addEventListener("jg:world-load", onWorld);
  try { if (WORLD.lotReady) await Promise.race([WORLD.lotReady, new Promise(r => setTimeout(r, 15000))]); } catch (e) {}
  document.removeEventListener("jg:world-load", onWorld);
  getSet("lot");
  setLoad(0.7);
  // warm the shaders on the first frames, behind the loading screen
  await person("you", "player"); setLoad(0.8); await person("jason", "jason"); await person("dell", "dell"); setLoad(0.86);
  // every set's shaders and textures, behind the loading screen: no hitch on the first step into the office, the library or a car
  if (typeof WORLD.warmSet === "function") { const W0 = ["lot", "office", "memory", "june"]; for (const n of W0) { try { await WORLD.warmSet(renderer, camera, getSet(n)); } catch (e) {} setLoad(0.86 + 0.015 * W0.indexOf(n)); } }
  setLoad(0.92);
  raf = requestAnimationFrame(frame);
  // build the rest while you play, and compile its shaders off the main path (parallel where the GPU allows), so the
  // first step into the office or the library never hitches on a shader
  if (typeof WORLD.warmSet !== "function") setTimeout(() => warmSets(["office", "memory", "june"]), FAST ? 400 : 2500);
  // the people you meet later, loaded (and kept out of sight) while you're on the lot
  setTimeout(async () => { for (const [k, n, lo] of [["renata", "renata"], ["memory", "jason-memory"], ["marisol", "renata", { look: "marisol" }]]) { if (P[k]) continue; try { const q = await person(k, n, lo); const here = (S.scene === "office" && k === "renata") || (S.scene === "memory" && k === "memory") || (S.scene === "sale" && k === "marisol"); if (!here) hide(q); } catch (e) {} } }, FAST ? 300 : 3000);
}

async function warmSets(names) {
  for (const n of names) {
    try {
      // visible only while the compile walks the scene (synchronously), so it never shows in a frame
      const st = getSet(n);
      if (typeof WORLD.warmSet === "function") { await WORLD.warmSet(renderer, camera, st); await new Promise(r => setTimeout(r, 200)); continue; }
      const was = st.visible; st.visible = true;
      let pr = null; try { pr = renderer.compileAsync ? renderer.compileAsync(scene, camera) : (renderer.compile(scene, camera), null); } finally { if (set !== st) st.visible = was; }
      if (pr) await pr;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 300));
  }
}
async function open(sceneName, how) {
  if (S.open) return;
  S.open = true; S.visited = S.visited || {};
  root.classList.add("story-on"); el.hidden = false; el.classList.add("is-on");
  S.paused = []; $$("video").forEach(v => { if (!el.contains(v) && !v.paused) { v.pause(); S.paused.push(v); } });
  if (window.JG_LOCK) window.JG_LOCK(true);
  // the sound is built here, inside the press of Play or Continue, never before
  AU.build(); AU.sound(soundOn());
  // a reopen in the same page starts clean: no held keys or fingers, no half-made choice, no ending, no skip waiting
  for (const k in keys) keys[k] = false;
  ptrs.clear(); stickEl.hidden = true; mv.x = mv.z = mv.mag = 0; mv.path = null; mv.after = null; mv.runLatch = false;
  choosing = null; choicesEl.hidden = true; el.classList.remove("has-choices", "is-talking", "is-paused", "is-cinema", "is-driving");
  S.ending = null; S.skipOpen = null; S.talking = null; S.partner = null; S.holdLines = S.holdLines && DEBUG;
  pauseEl.hidden = true; journalEl.hidden = true; endEl.hidden = true; endEl.classList.remove("is-on");
  const saved = loadSave();
  const fresh = !sceneName && !saved;
  if (fresh || sceneName) resetState();
  if (saved && !sceneName) { lostGen.n++; Object.assign(S, { flags: saved.flags || {}, looked: saved.looked || {}, log: saved.log || [], trophies: saved.trophies || [], journal: saved.journal || [], tags: (saved.tags || []).filter(id => LOST_IDS.includes(id)), obj: saved.obj || null, hint: saved.hint || null }); }
  T("story_started", { how: how || "", scene: sceneName || (saved ? saved.scene : "lot"), cont: !!(saved && !sceneName) });
  await boot();
  setLoad(1);
  const target = sceneName || (saved ? saved.scene : "lot");
  // the address keeps whatever brought you here; a deep link is consumed, so a reload meets the start screen (and Continue)
  if (/^#story/.test(location.hash) && history.replaceState) history.replaceState(null, "", location.pathname + location.search);
  await enter(target, { quiet: true, cold: target === "lot" && fresh });
  S.visited[target] = 1;
  await sleep(300);
  el.classList.remove("is-loading"); loadEl.classList.add("is-gone");
  setTimeout(() => (loadEl.hidden = true), 900);
  if (target === "lot" && fresh) { await coldOpen(); return; }
  await fade(0, 10);
  if (how !== "arcade") { FX("arrive"); await sceneCard(target); }
  if (saved && !sceneName && saved.scene === target && saved.pos && me && target !== "memory" && target !== "keys") { me.pos.set(saved.pos[0], 0, saved.pos[1]); me.yaw = me.wantYaw = saved.pos[2] || 0; unstick(me); camState.yaw = me.yaw + Math.PI; camState.init = true; }
  setPhase("explore");
  if (S.obj) objective(S.obj);
  const st = D.scenes[target].start;
  if (target === "lot" && !S.flags.met) runTalk("lot-arrive");
  else if (target !== "lot" && st && !(saved && saved.scene === target && !sceneName && target !== "decision" && S.flags["done-" + target])) { S.partner = P.jason; startTalk(target); }
}
function close(how) {
  if (!S.open) return;
  if (DRV.state) exitCar("close", true);
  S.open = false; S.phase = "closed";
  if (line) endLine(true);
  AU.stopAll(); ringOn = false; if (SC() && SC().mix) SC().mix(1, 1);
  if (arcadeV) arcadeV.pause();
  el.classList.remove("is-on"); root.classList.remove("story-on");
  setTimeout(() => { el.hidden = true; }, 500);
  if (window.JG_LOCK) window.JG_LOCK(false);
  (S.paused || []).forEach(v => { const p = v.play(); if (p && p.catch) p.catch(() => {}); }); S.paused = [];
  if (location.hash.indexOf("#story") === 0 && history.replaceState) history.replaceState(null, "", location.pathname + location.search);
  if (SC() && SC().focus) SC().focus(window.JG_GAME && window.JG_GAME.focusId ? window.JG_GAME.focusId() : "triple-j");
  document.dispatchEvent(new CustomEvent("jg:story-closed", { detail: { how } }));
}

document.addEventListener("jg:run-closed", () => {
  if (!S.fromArcade) return;
  S.fromArcade = false;
  setTimeout(() => { if (!S.open) open(null, "arcade"); }, 120);
});
window.JG_STORY = {
  open, close, isOpen: () => S.open, hasSave: () => !!loadSave(),
  debug: {
    state: () => ({ open: S.open, scene: S.scene, phase: S.phase, flags: { ...S.flags }, looked: { ...S.looked }, trophies: S.trophies.slice(), journal: S.journal.slice(), talking: S.talking, line: line ? line.L.id : null, choices: choosing ? choosing.list.map(c => c.t) : null, ending: S.ending, near: near ? near.id : null, me: me ? [me.pos.x, me.pos.z] : null, busy: !!S.busy, quality, pixelRatio, fps: fpsLog.slice(-5), obj: S.obj }),
    skip: () => { if (line) endLine(true); },
    flag: (k, v) => { S.flags[k] = v; },
    choose: i => pick(i, "debug"),
    spots: () => spotsHere().map(s => s.id),
    warp: id => {
      const s = spotsHere().find(x => x.id === id); if (!s) return false;
      let st = s.sp.stand || s.p;
      if (s.sp.who) { const w = P[s.sp.who]; st = w.pos.clone().add(new THREE.Vector3(Math.sin(w.yaw), 0, Math.cos(w.yaw)).multiplyScalar(1.35)); }
      if (me.car && !DRV.state) { try { me.driving = null; } catch (e) {} } // (seated: the harness stands you up to move you)
      mv.path = null; mv.after = null; guide.clearRing(); me.pos.set(st.x, 0, st.z); me.wantYaw = me.yaw = Math.atan2(s.p.x - st.x, s.p.z - st.z); camState.yaw = me.yaw + Math.PI; camState.init = true; return true;
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
    attract: async () => { setPhase("cinematic"); S.attract = true; el.classList.add("is-cinema"); post.comp.u.uBox.value = 0; objEl.hidden = true; $(".st-hud", el).style.display = "none";
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
    quality: (q, pr) => { quality = q; post.q = q; if (pr) pixelRatio = pr; applyTier(); resize(); },
    draws: since => drawLog.filter(t => t >= (since || 0)),
    qa: () => ({ pixelRatio, quality, ms: QA.ms, cpu: QA.cpu, slow: QA.slow, roomy: QA.roomy, log: QA.log.slice(), capped: COARSE.matches && !S.full60, perf: { ...perf } }),
    /* the way, the controls, the camera and the sound, for tools/verify/story.mjs */
    guide: () => { const t = S.phase === "explore" ? wayTarget() : null; const q = t ? project(new THREE.Vector3(t.p.x, Math.min(t.p.y || 1.2, 1.7), t.p.z)) : null; return { obj: S.obj, target: t ? { id: t.id, x: t.stand.x, z: t.stand.z } : null, trail: guide.count, vis: +guide.vis.toFixed(3), route: guideRoute ? guideRoute.map(p => [+p.x.toFixed(2), +p.z.toFixed(2)]) : null, arrow: { show: way.show, x: Math.round(way.x), y: Math.round(way.y), ang: +way.ang.toFixed(3), shown: wayEl.classList.contains("is-on") }, proj: q, nudges, dev }; },
    stuck: () => { progT = STUCK_S + 1; progWalk = 99; },
    yawTo: (x, z, off) => { const a = Math.atan2(x - me.pos.x, z - me.pos.z); camState.yaw = a + Math.PI + (off || 0); camState.drag = 9; camState.init = true; updateCamera(0.016); camera.updateMatrixWorld(); updateWay(0.016); return way; },
    input: () => ({ mag: +mv.mag.toFixed(3), run: mv.mag >= RUN_AT, x: +mv.x.toFixed(3), z: +mv.z.toFixed(3), want: +speedFor(mv.mag).toFixed(3), speed: me ? +me.speed.toFixed(3) : 0, running: mv.running, stick: !stickEl.hidden, stickRun: stickEl.classList.contains("is-run"), path: mv.path ? mv.path.map(p => [+p.x.toFixed(2), +p.z.toFixed(2)]) : null, dev, keys: { ...SET.keys }, runToggle: SET.runToggle }),
    speedFor: m => speedFor(m),
    /* the jump and the pad (tools/verify/story.mjs --jump, --pad) */
    jump: how => jump(how || "debug"),
    jumpState: () => ({ can: canJump(), jumping: !!(me && me.jumping), air: !!(me && me.airborne), st: me && me.jmp ? me.jmp.st : null, y: me ? +me.pos.y.toFixed(3) : 0, x: me ? +me.pos.x.toFixed(3) : 0, z: me ? +me.pos.z.toFixed(3) : 0, n: JUMP.n, how: JUMP.how || "", last: JUMP.last || null, dip: +JUMP.dip.toFixed(3), btn: !jumpEl.hidden, legend: legendEl.hidden ? "" : legendEl.textContent, dev, run: PADN.run, cam: me ? [+camState.yaw.toFixed(3), +me.yaw.toFixed(3), +camState.pitch.toFixed(3)] : null, speed: me ? +me.speed.toFixed(3) : 0 }),
    sheet: () => { if (S.phase !== "explore" && S.phase !== "talk") return false; openDesk(); return true; },
    end: k => { ending(k || "passing"); return true; },
    focus: () => { const a = document.activeElement; if (!a || a === document.body) return null; const host = padHost(); return { tag: a.tagName.toLowerCase(), text: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 40), inHost: !!(host && host.contains(a)), outline: getComputedStyle(a).outlineStyle }; },
    /* step the walk with a fixed clock, so the harness doesn't depend on the frame rate */
    sim: (n, dt) => { for (let i = 0; i < n; i++) { padPoll(dt); moveMe(dt); movePeople(dt); for (const p of Object.values(P)) if (p.group.visible) p.update(dt); feet(); updatePrompts(); } return me ? [me.pos.x, me.pos.z] : null; }, // a step is a frame: the prompt follows too
    put: (x, z, yaw) => { mv.path = null; me.pos.set(x, 0, z); me.yaw = me.wantYaw = yaw || 0; camState.yaw = me.yaw + Math.PI; camState.init = true; return true; },
    walk: (x, z) => { const ok = walkTo(new THREE.Vector3(x, 0, z)); return ok ? mv.path.map(p => [p.x, p.z]) : null; },
    walls: () => (set.userData.walls || []).map(w => [w.x0, w.x1, w.z0, w.z1]),
    blocked: (x, z) => blocked(x, z, 0.2),
    tap: (x, z) => { const q = project(new THREE.Vector3(x, 0, z)); return q; },
    /* put you at each point, turn the camera all the way round, and report any spot where it ends up inside something */
    camProbe: pts => {
      const bad = [], keep = { x: me.pos.x, z: me.pos.z, yaw: me.yaw, cy: camState.yaw, cp: camState.pitch };
      for (const [x, z] of pts.filter(([x, z]) => !blocked(x, z, 0.28))) for (let a = 0; a < 16; a++) for (const pitch of [0.05, 0.25, 0.6]) {
        me.pos.set(x, 0, z); camState.yaw = a / 16 * Math.PI * 2; camState.pitch = pitch;
        const { want } = followView(0.016, true);
        if (insideAny(want.x, want.y, want.z, 0.02)) bad.push([x, z, a, pitch, +want.x.toFixed(2), +want.y.toFixed(2), +want.z.toFixed(2)]);
      }
      me.pos.set(keep.x, 0, keep.z); me.yaw = keep.yaw; camState.yaw = keep.cy; camState.pitch = keep.cp; camState.init = true;
      return { n: pts.filter(([x, z]) => !blocked(x, z, 0.28)).length * 48, bad };
    },
    audio: () => AU.debug(),
    settings: () => ({ ...SET, keys: { ...SET.keys }, mix: { ...AU.mix } }),
    surface: (x, z) => surfaceAt(x, z),
    hold: v => { S.holdLines = !!v; },
    /* the voice clock: the caption's clock against the recording's own, and how many voices are sounding */
    sync: () => {
      const l = line, voices = [...VC.values()].filter(v => !v.a.paused && !v.a.ended).length;
      if (!l) return { line: null, voices, log: syncLog.slice(-30) };
      return { line: l.L.id, mode: l.mode, now: +lineNow(l, performance.now()).toFixed(3), ct: l.audio ? +l.audio.currentTime.toFixed(3) : null, paused: l.audio ? l.audio.paused : null, stall: !!l.stall, k: l.k, said: [].filter.call(saidEl.children, s => s.classList.contains("is-said")).length, words: lineWords(l).map(w => [w.s, w.e]), voices, log: syncLog.slice(-30) };
    },
    ball: t => { const l = line; if (!l) return null; const now = t == null ? lineNow(l, performance.now()) : t; const b = ball.at(now); return { on: ball.on, now, b, pos: ball.pos, R: ball.R }; },
    pin: t => { const l = line; if (!l) return false; S.ballPin = t; return true; },
    /* driving */
    cars: () => drivables().map(c => { const st = doorStand(c); return { id: c.id, x: +c.object.position.x.toFixed(2), z: +c.object.position.z.toFixed(2), yaw: +c.object.rotation.y.toFixed(3), stand: [+st.x.toFixed(2), +st.z.toFixed(2)], W: carMeta(c).W, L: carMeta(c).L }; }),
    drive: () => { const v = DRV.veh; return { state: DRV.state, phase: S.phase, cam: DRV.cam, car: DRV.entry ? DRV.entry.id : null, inCar: !!(me && me.inCar), visible: !!(me && me.group.visible), speed: v ? +v.speed.toFixed(2) : 0, rpm: v ? v.rpm : 0, gear: v ? v.gear : 0, slip: v ? +v.slip.toFixed(2) : 0, pose: v && v.pose ? [+v.pose.x.toFixed(2), +v.pose.z.toFixed(2), +v.pose.yaw.toFixed(3)] : null, hits: DRV.hits, log: DRV.log.slice(-6), inp: { thr: +DRV.thr.toFixed(2), brk: +DRV.brk.toFixed(2), steer: +DRV.steer.toFixed(2) }, touch: { ...DRV.touch }, shake: +DRV.shake.toFixed(3), fov: +camera.fov.toFixed(1), camPos: [camera.position.x, camera.position.y, camera.position.z].map(n => +n.toFixed(2)), ui: drvEl.classList.contains("is-on") && !drvEl.hidden, dev, au: AU.debug().car, skip: !!DRV.skip, near: near ? near.id : null }; },
    /* a start with a clear run ahead (for the harness): nothing to hit for len metres, inside the drive bounds */
    lane: (len = 16) => {
      const cols = set.userData.colliders || [], inB = set.userData.inDriveBounds || (() => true), own = DRV.entry && DRV.entry.collider;
      const hitAt = (x, z) => cols.some(o => o !== own && (o.type === "circle" ? Math.hypot(x - o.x, z - o.z) < o.r + 1.6 : o.type === "box" ? (() => { const c = Math.cos(o.yaw || 0), s2 = Math.sin(o.yaw || 0), dx = x - o.x, dz = z - o.z, lx = dx * c - dz * s2, lz = dx * s2 + dz * c; return Math.abs(lx) < o.hw + 1.4 && Math.abs(lz) < o.hl + 1.4; })() : false));
      for (let x = -14; x <= 16; x += 2) for (let z = -12; z <= 20; z += 2) for (let a = 0; a < 8; a++) {
        const yaw = a * Math.PI / 4; let ok = true;
        for (let d = 0; d <= len && ok; d += 1) { const px = x + Math.sin(yaw) * d, pz = z + Math.cos(yaw) * d; if (!inB(px, pz) || hitAt(px, pz)) ok = false; }
        // and room to turn right at the end of it
        if (ok) return [x, z, yaw];
      }
      return null;
    },
    carPut: (x, z, yaw) => { if (!DRV.veh) return false; DRV.veh.reset(x, z, yaw); DRV.camInit = true; return true; },
    hint: talk => { if (talk == null) { S.hint = null; return null; } hintFrom(talk); return S.hint; },
    hints: () => ({ ...HINTS }),
    seated: () => !!(me && me.seated),
    /* the lost license plates (tools/verify/story.mjs --tags) */
    tags: () => { const T0 = set && set.userData.tags; return { found: S.tags.slice(), total: LOST_IDS.length, noted: S.log.some(x => x.note === UI.tags_all), here: T0 ? T0.list.map(e => e.id) : [], glint: !!(T0 && T0.gl.visible), fly: !!(T0 && T0.fly.visible), draws: T0 ? [T0.im, T0.gl, T0.fly].filter(o => o.visible).length : 0, meshes: T0 ? set.children.filter(o => o === T0.im || o === T0.gl || o === T0.fly).length : 0, counter: tagsEl && !tagsEl.hidden ? { on: tagsEl.classList.contains("is-on"), text: tagsEl.textContent, marks: tagsEl.querySelectorAll(".st-marks i").length, filled: tagsEl.querySelectorAll(".st-marks i.is-on").length } : null }; },
    tagAt: id => { const sp = set && set.userData.spots[id]; return sp && sp.tag ? { p: [sp.p.x, sp.p.y, sp.p.z], stand: [sp.stand.x, sp.stand.z], open: !sp.when || sp.when() } : null; },
    obj: k => { objective(k || null); return S.obj; },
    unlook: id => { delete S.looked[id]; },
    skipCar: () => { if (DRV.skip) { DRV.skip(); return true; } return false; },
    /* the getting in and out stills (tools/verify/car-sheet.mjs): stop the loop, then step whole frames on a fixed clock and draw */
    freeze: on => { S.attract = !!on; last = performance.now(); return S.attract; },
    step: (n, dt, draw = true) => {
      for (let i = 0; i < n; i++) { S.t += dt; if (DRV.veh) tickDrive(dt); if (!DRV.state) moveMe(dt); movePeople(dt); for (const p of Object.values(P)) if (p.group.visible) p.update(dt); feet(); updateCamera(dt); }
      if (!draw) return true;
      updateLamps(); camera.updateMatrixWorld();
      const ground = set.userData.groundMat ? set.children.find(m => m.material === set.userData.groundMat) : null;
      if (ground && quality >= 1) post.reflect(scene, camera, world, ground);
      post.render(scene, camera, S.t); return true;
    },
    you: () => me, veh: () => DRV.veh,
    /* the waiting room and the test drive (tools/verify/story.mjs) */
    june: () => ({ seated: !!(me && me.seated), sitMode: me && me.car ? me.car.mode : null, at: me ? [+me.pos.x.toFixed(2), +me.pos.z.toFixed(2)] : null, jasonSit: !!(P.jason && P.jason.pose === "sit"), hold: !!HOLDG, busy: !!S.busy, phoneEar: !!(me && me.hold === "phone"), answered: S.phoneEar || 0, cof: S.cof || null, cup: !!(set && set.userData.cup && set.userData.cup.visible), jasonCup: !!(P.jason && P.jason.carrying && (P.jason.carrying.l || P.jason.carrying.r)), meshes: (() => { let n = 0; if (set) set.traverse(o => { if (o.isMesh && o.visible) n++; }); return n; })() }),
    course: () => ({ live: courseLive(), i: COURSE.i, n: COURSE.pts.length, t: +COURSE.t.toFixed(2), pts: COURSE.pts.map(p => p.slice()), ring: courseG.ringMesh.visible, ui: courseEl.classList.contains("is-on"), marisol: !!(P.marisol && P.marisol.inCar), drove: S.flags.drove || null, auto: !!AUTO })
  }
};
