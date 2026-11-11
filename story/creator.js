/* After Hours: the character. Who walks onto the lot is yours to make: a body, a face, hair and what they wear.
   The screen is a small studio (a floor, a wall, three lamps that turn with the camera) drawn by the episode's own
   renderer and lens, with a second copy of the visitor's body standing in it, so the one in the world is never moved:
   it can be sitting, in a car or mid-talk while you change it. Every change goes to both at once, and is saved under
   its own key (jg_story_look), so Restart keeps it and only Reset puts it back.

   The body itself belongs to story/people.js. This file speaks to it through person.setLook(look) and the options it
   offers (lookOptions); where a body has no setLook yet, it falls back to what any body can do today (the colours on
   its skin, hair and clothes, and its height), and shows only the controls that work.

   The opening night never reads any of this: you are Jason there. */
import * as THREE from "../vendor/three-0.184.0/three.module.min.js";
import { U, MAXL, paint, blobMat } from "./paint.js";
import { applyGrade } from "./post.js";

const KEY = "jg_story_look";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const E = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hex = c => "#" + c.getHexString();

/* what any body can wear before people.js offers its own lists */
const FALLBACK = {
  bodies: ["a", "b"],
  skins: ["#f1d3b8", "#e3b891", "#cf9f76", "#b78a66", "#a0704d", "#8a5d40", "#74492f", "#5d3a26", "#472a1b", "#331d13"],
  hairColors: ["#0f0c0a", "#22170f", "#3a2a1c", "#5a3d26", "#7d5a36", "#a8854f", "#cdb07a", "#8a3a22", "#6f6a62", "#c9c6bf"],
  eyeColors: ["#3b2a1e", "#6a4a36", "#8a6a3a", "#5e6b3c", "#4f6f7a", "#5a6a86", "#7d8288"],
  hairStyles: [],
  outfits: ["street", "work", "smart", "rain"],
  outfitColors: { street: "#8a6428", work: "#2f3a4a", smart: "#3d3f44", rain: "#44563c" }
};
const SLIDERS = ["height", "build", "nose.width", "nose.length", "mouth.width", "mouth.fullness", "jaw", "brows"];
/* the screen: four groups, each a few controls */
const CATS = [
  { id: "body", zoom: 0, items: [
    { k: "body", type: "tiles", label: "look_type", list: "bodies", name: "look_type_" },
    { k: "height", type: "slider", label: "look_height", lo: "look_short", hi: "look_tall" },
    { k: "build", type: "slider", label: "look_build", lo: "look_slim", hi: "look_broad" },
    { k: "skin", type: "swatch", label: "look_skin", list: "skins" }] },
  { id: "face", zoom: 1, items: [
    { k: "nose.width", type: "slider", label: "look_nose_w", lo: "look_narrow", hi: "look_wide" },
    { k: "nose.length", type: "slider", label: "look_nose_l", lo: "look_shorter", hi: "look_longer" },
    { k: "mouth.width", type: "slider", label: "look_mouth_w", lo: "look_narrow", hi: "look_wide" },
    { k: "mouth.fullness", type: "slider", label: "look_mouth_f", lo: "look_thin", hi: "look_full" },
    { k: "jaw", type: "slider", label: "look_jaw", lo: "look_soft", hi: "look_strong" },
    { k: "brows", type: "slider", label: "look_brows", lo: "look_light", hi: "look_heavy" },
    { k: "eyes.color", type: "swatch", label: "look_eyes", list: "eyeColors" }] },
  { id: "hair", zoom: 1, items: [
    { k: "hair.style", type: "tiles", label: "look_style", list: "hairStyles", name: "look_hair_" },
    { k: "hair.color", type: "swatch", label: "look_colour", list: "hairColors" }] },
  { id: "outfit", zoom: 0, items: [
    { k: "outfit", type: "tiles", label: "look_wear", list: "outfits", name: "look_outfit_" }] }
];
const getK = (o, k) => k.split(".").reduce((a, p) => (a == null ? a : a[p]), o);
const setK = (o, k, v) => { const ps = k.split("."); let a = o; for (let i = 0; i < ps.length - 1; i++) a = a[ps[i]] || (a[ps[i]] = {}); a[ps[ps.length - 1]] = v; };
const sameCol = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/* the studio's light and lens: neutral, so a skin tone or a jacket reads as itself */
const STUDIO = { sky: "#3d4245", ground: "#1d1e1b", moon: "#4a463f", rim: "#8b8f8e", fog: "#161c19", den: 0.03, wetAll: 0, sat: 1 };
const STUDIO_GRADE = { tone: 0.6, con: 0.3, exp: 1.0, lift: [0.008, 0.009, 0.009], gamma: [1, 1, 1], gain: [1.02, 1.0, 0.98], sat: 1.0, bloom: 0.25, vig: 0.55, grain: 0.02, mem: 0, sh: [0, 0.02, 0.04], hi: [0.08, 0.04, -0.03] };
const COMP_KEYS = ["uExp", "uSat", "uTone", "uCon", "uBloom", "uVig", "uGrain", "uMem", "uBox", "uDofK", "uFocus", "uRange"], COMP_VEC = ["uLift", "uGamma", "uGain", "uShadowTint", "uHiTint"];
const U_COL = ["uSky", "uGround", "uMoon", "uRim", "uFog"], U_NUM = ["uFogDen", "uWetAll", "uSat"];

export function createCreator(X) {
  const { el, UI, store, post, camera, AU } = X;
  const still = () => X.still();
  const touch = () => X.dev() === "touch";
  const L = k => UI[k] || "";

  /* ---------- the look: what is stored, and what a body is told ----------
     Kept here with every slider from nought to one (so a saved look outlives a change of range); a body is told in
     its own units (metres, minus one to one), read from lookOptions() */
  let opts = null;       // the lists and ranges on offer
  let look = null;       // the look as this screen keeps it
  let def = null;        // what Reset goes back to
  let pending = false;   // the body in the world still owes a change of body or height (it was sitting, or in a car)
  const isCol = x => /^#[0-9a-f]{6}$/i.test(String(x));
  const plain = s => (typeof s === "string" && s && !/\d/.test(s) ? s : "");
  function readOpts(p) {
    let o = null;
    try { o = typeof X.lookOptions === "function" ? X.lookOptions() : null; } catch (e) { o = null; }
    const real = !!(o && p && typeof p.setLook === "function");
    const base = X.base || {};
    const R = { real, bodies: FALLBACK.bodies.slice(), skins: FALLBACK.skins.slice(), hairStyles: {}, hairColors: FALLBACK.hairColors.slice(), eyeColors: FALLBACK.eyeColors.slice(), outfits: FALLBACK.outfits.slice(), chip: Object.assign({}, FALLBACK.outfitColors), label: {}, ranges: {}, defaults: {} };
    const ids = (a, key) => (Array.isArray(a) ? a.map(x => { const id = String(x && typeof x === "object" ? x.id : x); if (x && typeof x === "object") { if (plain(x.label)) R.label[key + ":" + id] = x.label; if (isCol(x.color)) R.chip[id] = x.color; } return id; }) : []);
    const cols = a => (Array.isArray(a) ? a.filter(isCol).map(String) : []);
    if (real) {
      const b = ids(o.bodies, "body"); if (b.length) R.bodies = b;
      const hs = (o.hair && o.hair.styles) || {};
      for (const id of R.bodies) R.hairStyles[id] = ids(Array.isArray(hs) ? hs : hs[id], "hair.style");
      for (const [k, v] of [["skins", cols(o.skin)], ["hairColors", cols(o.hair && o.hair.colors)], ["eyeColors", cols(o.eyes && o.eyes.colors)]]) if (v.length) R[k] = v;
      const of = ids(o.outfits, "outfit"); if (of.length) R.outfits = of;
      for (const k of SLIDERS) { const r = getK(o, k); if (r && typeof r === "object" && r.max > r.min) R.ranges[k] = { min: +r.min, max: +r.max }; }
      // the look each body starts with, in this screen's terms
      for (const id of R.bodies) { let d = o.defaults && o.defaults[id]; if (!d && typeof X.defaultLook === "function") { try { d = X.defaultLook(id); } catch (e) {} } if (d) R.defaults[id] = inLook(d, R); }
    }
    def = R.defaults[R.bodies[0]] || {
      body: R.bodies[0], height: 0.5, build: 0.5, skin: base.skin || R.skins[0], hair: { style: "", color: base.hair || R.hairColors[0] }, eyes: { color: base.eyes || R.eyeColors[0] },
      nose: { width: 0.5, length: 0.5 }, mouth: { width: 0.5, fullness: 0.5 }, brows: 0.5, jaw: 0.5, outfit: R.outfits[0]
    };
    // the body's own colours lead their rows when they aren't already in them
    for (const [list, c] of [[R.skins, def.skin], [R.hairColors, def.hair.color], [R.eyeColors, def.eyes.color]]) if (c && !list.some(x => sameCol(x, c))) list.unshift(c);
    return R;
  }
  /* a look in the body's units, as this screen keeps it */
  function inLook(d, R) {
    const o = JSON.parse(JSON.stringify(d || {}));
    for (const k of SLIDERS) { const r = R.ranges[k], v = getK(o, k); setK(o, k, r && typeof v === "number" ? clamp((v - r.min) / (r.max - r.min), 0, 1) : 0.5); }
    o.body = String(o.body != null ? o.body : R.bodies[0]); o.hair = o.hair || {}; o.eyes = o.eyes || {};
    o.hair.style = String(o.hair.style != null ? o.hair.style : ""); o.outfit = String(o.outfit != null ? o.outfit : R.outfits[0]);
    return o;
  }
  const ITEM = {}; for (const c of CATS) for (const it of c.items) ITEM[it.k] = it;
  /* the choices a row offers (the hair styles are the ones the body you chose can wear) */
  const listOf = it => (it.list === "hairStyles" ? opts.hairStyles[look ? look.body : opts.bodies[0]] || [] : opts[it.list]);
  /* which controls do something on this body */
  function can(k) {
    if (!opts) return false;
    const it = ITEM[k];
    if (opts.real) return it.type === "slider" ? !!opts.ranges[k] : it.type === "tiles" ? (k === "hair.style" ? opts.bodies.some(b => (opts.hairStyles[b] || []).length > 1) : opts[it.list].length > 1) : opts[it.list].length > 0;
    return k === "height" || k === "skin" || k === "hair.color" || k === "outfit";
  }
  /* a stored look, made whole: unknown bodies, styles and outfits fall back to the default, numbers stay in range */
  function clean(l) {
    const o = JSON.parse(JSON.stringify(def));
    if (!l || typeof l !== "object") return o;
    const body = String(l.body);
    if (opts.bodies.includes(body) && body !== o.body) { o.body = body; if (opts.defaults[body]) { o.height = opts.defaults[body].height; o.hair.style = opts.defaults[body].hair.style; } }
    for (const k of Object.keys(ITEM)) {
      const it = ITEM[k], v = getK(l, k); if (v == null || k === "body") continue;
      if (it.type === "slider") { if (typeof v === "number" && isFinite(v)) setK(o, k, clamp(v, 0, 1)); }
      else if (it.type === "swatch") { if (isCol(v)) setK(o, k, String(v)); }
      else if (k === "hair.style") { if ((opts.hairStyles[o.body] || []).includes(String(v))) o.hair.style = String(v); }
      else if (opts[it.list].includes(String(v))) setK(o, k, String(v));
    }
    return o;
  }
  function load() { try { const s = JSON.parse(store.get(KEY) || "null"); return s && s.v === 1 ? s.look : null; } catch (e) { return null; } }
  function persist() { store.set(KEY, JSON.stringify({ v: 1, look })); }
  function ready(p) { if (!opts || (!opts.real && p && typeof p.setLook === "function" && typeof X.lookOptions === "function")) { opts = readOpts(p); look = clean(look || load()); } }
  /* one value, or the whole look, as people.js takes it */
  const outV = k => { const r = opts.ranges[k], v = getK(look, k); return r && ITEM[k].type === "slider" ? +(r.min + v * (r.max - r.min)).toFixed(4) : v; };
  function outLook() { const o = {}; for (const k of Object.keys(ITEM)) setK(o, k, outV(k)); return o; }
  const _c = new THREE.Color();
  /* the look onto one body. A body with setLook takes the part that changed (or all of it) and says when it is done;
     one without takes its colours and its height */
  function wear(p, part) {
    if (!p) return Promise.resolve(null);
    if (opts.real && typeof p.setLook === "function") { try { return Promise.resolve(p.setLook(part || outLook())).catch(e => { if (X.debug) console.warn("setLook", e); return null; }); } catch (e) { if (X.debug) console.warn("setLook", e); return Promise.resolve(null); } }
    const cloth = FALLBACK.outfitColors[look.outfit] || FALLBACK.outfitColors.street;
    for (const m of p.meshes || []) {
      const role = (m.userData && m.userData.role) || "", u = m.material && m.material.uniforms; if (!u || !u.uColor) continue;
      if (role === "skin") u.uColor.value.set(look.skin);
      else if (role === "hair" || role === "goatee") { u.uColor.value.set(look.hair.color); if (role === "hair" && u.uKeep && m.geometry.attributes.color) u.uKeep.value.set(look.skin); }
      else if (role === "brow" || role === "lash") { _c.set(look.hair.color); u.uColor.value.copy(_c); if (role === "lash" && u.uKeep) u.uKeep.value.copy(_c); }
      else if (role.startsWith("cloth") && !role.includes("shoes")) u.uColor.value.set(cloth);
    }
    if (p.group) p.group.scale.setScalar(lerp(0.93, 1.07, look.height));
    return Promise.resolve(null);
  }
  /* the body in the world: a new body or height builds it again where it stands, so those wait a beat (a slider
     dragged across its range builds it once, not twenty times) and until it is on its feet; settle, called every
     frame, is what pays the debt. Everything else is worn at once */
  let pendAt = 0;
  function wearYou(part) {
    const y = X.you(); if (!y) return Promise.resolve(null);
    if (!opts.real) return wear(y, null);
    const o = JSON.parse(JSON.stringify(part || outLook()));
    if ("body" in o || "height" in o) { pending = true; pendAt = performance.now() + 220; delete o.body; delete o.height; if (o.hair) delete o.hair.style; }
    else if (pending && o.hair) delete o.hair.style; // (a style for the body it is about to become waits with it)
    return Object.keys(o).length ? wear(y, o) : Promise.resolve(null);
  }
  function settle() { if (pending && performance.now() >= pendAt && X.you() && X.youFree()) { pending = false; wear(X.you(), null); } }
  /* a change (one key, or everything) to both bodies */
  function push(k) {
    let part = null;
    if (k && opts.real) { part = {}; setK(part, k, outV(k)); }
    const a = wear(doll, part); wearYou(part);
    return a;
  }
  /* the saved look on a body when it is first made (main.js, before it is ever seen) */
  function applyTo(p) { if (!p) return Promise.resolve(null); ready(p); return wear(p, null); }
  /* what the body shows, read back from it (the harness checks a change arrived) */
  function readBack(p) {
    if (!p) return null;
    const o = { scale: p.group ? +p.group.scale.y.toFixed(4) : 1, reported: null };
    try { o.reported = typeof p.getLook === "function" ? p.getLook() : null; } catch (e) {}
    for (const m of p.meshes || []) {
      const role = (m.userData && m.userData.role) || "", u = m.material && m.material.uniforms; if (!u || !u.uColor || !m.visible) continue;
      if (role === "skin") o.skin = hex(u.uColor.value); else if (role === "hair") o.hair = hex(u.uColor.value); else if (role.startsWith("cloth") && !role.includes("shoes") && !o.cloth) o.cloth = hex(u.uColor.value);
    }
    return o;
  }

  /* ---------- the studio ---------- */
  const stage = new THREE.Scene();
  let doll = null, dollP = null, built = false, blob = null;
  function build() {
    if (built) return; built = true;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), paint({ color: "#2b332f", wet: 0.04, rim: 0 })); floor.rotation.x = -Math.PI / 2; stage.add(floor);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 9, 48, 1, true), paint({ color: "#27302c", wet: 0, rim: 0, side: THREE.BackSide })); wall.position.y = 4.4; stage.add(wall);
    blob = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), blobMat(0.5)); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; stage.add(blob);
  }
  function getDoll() {
    if (doll) return Promise.resolve(doll);
    return dollP || (dollP = X.make().then(p => { doll = p; build(); stage.add(p.group); p.pos.set(0, 0, 0); p.yaw = p.wantYaw = 0; p.group.visible = true; p.lod = 0; return applyTo(p).then(() => p); }).catch(e => { dollP = null; throw e; }));
  }

  /* ---------- the screen ---------- */
  const sec = document.createElement("section");
  sec.className = "st-look"; sec.hidden = true; sec.setAttribute("aria-label", L("look"));
  sec.innerHTML = '<div class="cr"><div class="cr-stage"><p class="cr-turn" aria-hidden="true"></p><div class="cr-zoom" role="group" aria-label="' + E(L("look_view")) + '"><button type="button" data-cr="zoom" data-z="0" aria-pressed="true">' + E(L("look_view_body")) + '</button><button type="button" data-cr="zoom" data-z="1" aria-pressed="false">' + E(L("look_view_face")) + '</button></div></div>' +
    '<div class="cr-panel"><header class="cr-top"><p class="cr-k">' + E(L("look")) + '</p><h2 class="cr-h"></h2><p class="cr-sub">' + E(L("look_sub")) + '</p></header>' +
    '<div class="cr-tabs" role="tablist" aria-label="' + E(L("look")) + '"></div><div class="cr-body" role="tabpanel"></div>' +
    '<footer class="cr-foot"><button type="button" class="cr-link" data-cr="random">' + E(L("look_random")) + '</button><button type="button" class="cr-link" data-cr="reset">' + E(L("look_reset")) + '</button><button type="button" class="cr-done" data-cr="done"><span>' + E(L("look_done")) + "</span></button></footer></div></div>";
  el.insertBefore(sec, el.querySelector(".st-load"));
  const $ = (s, r) => (r || sec).querySelector(s), $$ = (s, r) => [...(r || sec).querySelectorAll(s)];
  const stageEl = $(".cr-stage"), panelEl = $(".cr-panel"), tabsEl = $(".cr-tabs"), bodyEl = $(".cr-body"), hEl = $(".cr-h"), turnEl = $(".cr-turn"), doneEl = $("[data-cr='done']");
  const ST = { open: false, live: false, mode: "", cat: "body", resolve: null, changed: {}, random: false, reset: false, t: 0, yaw: 0.35, base: 0.35, held: 0, zoom: 0, zoomTo: 0, kick: 0, spin: 0, snap: null, rect: { x: 0, y: 0, w: 1, h: 1 }, W: 1, H: 1, lvT: 0 };
  const cats = () => CATS.filter(c => c.items.some(it => can(it.k)));
  const nth = i => (UI.look_nth || [])[i] || "";
  const tileName = (it, id) => L(it.name + id) || (opts.label[it.k + ":" + id]) || String(id).replace(/[-_]+/g, " ").replace(/\d+/g, "").trim().replace(/^./, c => c.toUpperCase()) || nth(0);
  function drawTabs() {
    const cs = cats(), pad = X.padNames();
    tabsEl.innerHTML = X.glyph(pad.prev) + cs.map(c => '<button type="button" role="tab" id="cr-tab-' + c.id + '" data-cr="cat" data-cat="' + c.id + '" aria-selected="' + (c.id === ST.cat) + '" tabindex="' + (c.id === ST.cat ? 0 : -1) + '">' + E(L("look_" + c.id)) + "</button>").join("") + X.glyph(pad.next);
    bodyEl.setAttribute("aria-labelledby", "cr-tab-" + ST.cat);
  }
  function drawBody(dir) {
    const c = CATS.find(x => x.id === ST.cat); let h = "";
    for (const it of c.items) {
      if (!can(it.k)) continue;
      const v = getK(look, it.k), id = "cr-" + it.k.replace(".", "-");
      if (it.type === "slider") {
        h += '<div class="cr-row cr-row--sl" data-k="' + it.k + '"><label class="cr-l" for="' + id + '">' + E(L(it.label)) + '</label><div class="cr-sl"><input id="' + id + '" type="range" min="0" max="100" step="5" value="' + Math.round(v * 100) + '" data-k="' + it.k + '" aria-valuetext="' + E(valueText(it, v)) + '" /><i class="cr-ticks" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></i></div><p class="cr-ends" aria-hidden="true"><span>' + E(L(it.lo)) + "</span><span>" + E(L(it.hi)) + "</span></p></div>";
      } else if (it.type === "swatch") {
        h += '<div class="cr-row" data-k="' + it.k + '"><p class="cr-l" id="' + id + '">' + E(L(it.label)) + '</p><div class="cr-sw" role="group" aria-labelledby="' + id + '">' + listOf(it).map((col, i) => '<button type="button" data-k="' + it.k + '" data-v="' + col + '" aria-pressed="' + sameCol(col, v) + '" aria-label="' + E(L(it.label) + ", " + nth(i)) + '" style="--c:' + col + '"></button>').join("") + "</div></div>";
      } else {
        h += '<div class="cr-row" data-k="' + it.k + '"><p class="cr-l" id="' + id + '">' + E(L(it.label)) + '</p><div class="cr-tiles" role="group" aria-labelledby="' + id + '">' + listOf(it).map(o => '<button type="button" data-k="' + it.k + '" data-v="' + E(o) + '" aria-pressed="' + (String(v) === o) + '">' + (it.k === "outfit" && opts.chip[o] ? '<i style="--c:' + opts.chip[o] + '" aria-hidden="true"></i>' : "") + "<span>" + E(tileName(it, o)) + "</span></button>").join("") + "</div></div>";
      }
    }
    bodyEl.innerHTML = h; bodyEl.scrollTop = 0;
    if (dir && !still()) { bodyEl.classList.remove("is-in-l", "is-in-r"); void bodyEl.offsetWidth; bodyEl.classList.add(dir > 0 ? "is-in-r" : "is-in-l"); }
  }
  function valueText(it, v) { return v < 0.34 ? L(it.lo) : v > 0.66 ? L(it.hi) : L("look_mid"); }
  /* the controls show the look (after Randomize, Reset or a body that changed its mind) without being drawn again */
  function sync() {
    for (const b of $$("[data-k][data-v]", bodyEl)) { const v = getK(look, b.dataset.k); b.setAttribute("aria-pressed", String(ITEM[b.dataset.k].type === "swatch" ? sameCol(v, b.dataset.v) : String(v) === b.dataset.v)); }
    for (const r of $$("input[data-k]", bodyEl)) { const v = getK(look, r.dataset.k); r.value = String(Math.round(v * 100)); r.setAttribute("aria-valuetext", valueText(ITEM[r.dataset.k], v)); }
  }
  function glyphs() { if (!ST.open) return; const f = document.activeElement, cat = f && f.dataset && f.dataset.cr === "cat"; drawTabs(); if (cat) { const t = $("[aria-selected='true']", tabsEl); if (t) t.focus({ preventScroll: true }); } turnEl.textContent = L(X.dev() === "pad" ? "look_turn_pad" : touch() ? "look_turn_touch" : "look_turn"); }
  function setCat(id, how) {
    const cs = cats(), i0 = cs.findIndex(c => c.id === ST.cat), i1 = cs.findIndex(c => c.id === id);
    if (i1 < 0 || id === ST.cat) return;
    ST.cat = id; drawTabs(); drawBody(i1 - i0);
    setZoom(cs[i1].zoom);
    AU.ui("tab"); X.hap("tap");
    if (how !== "touch" && !touch()) { const t = $("[aria-selected='true']", tabsEl); if (t) t.focus({ preventScroll: true }); }
  }
  function stepCat(d) { const cs = cats(), i = cs.findIndex(c => c.id === ST.cat); setCat(cs[(i + d + cs.length) % cs.length].id); }
  function setZoom(z) { ST.zoomTo = clamp(z, 0, 1); for (const b of $$("[data-cr='zoom']")) b.setAttribute("aria-pressed", String(+b.dataset.z === Math.round(ST.zoomTo))); }
  /* a choice: the tick, the tap and the small move, all in this frame */
  function chose(k, e, soft) {
    ST.changed[k ? CATS.find(c => c.items.some(it => it.k === k)).id : "body"] = true;
    push(k); persist();
    if (soft) { const t = performance.now(); if (t - ST.lvT < 90) return; ST.lvT = t; AU.ui("level"); X.hap("tap", 0.6); ST.kick = Math.max(ST.kick, 0.5); return; }
    AU.ui("toggle"); X.hap("tap"); ST.kick = 1;
    if (e && !still()) { e.classList.remove("is-pop"); void e.offsetWidth; e.classList.add("is-pop"); }
  }
  sec.addEventListener("input", e => {
    const r = e.target.closest("input[data-k]"); if (!r) return;
    const v = clamp(+r.value / 100, 0, 1); if (v === getK(look, r.dataset.k)) return;
    setK(look, r.dataset.k, v); r.setAttribute("aria-valuetext", valueText(ITEM[r.dataset.k], v)); chose(r.dataset.k, r, true);
  });
  sec.addEventListener("click", e => {
    const o = e.target.closest("[data-k][data-v]");
    if (o) {
      const k = o.dataset.k; if (String(getK(look, k)) === o.dataset.v) return;
      if (k === "body") { setBody(o.dataset.v); sync(); chose(null, o); return; }
      setK(look, k, o.dataset.v); sync(); chose(k, o); return;
    }
    const b = e.target.closest("[data-cr]"); if (!b) return;
    const k = b.dataset.cr;
    if (k === "cat") setCat(b.dataset.cat, e.detail === 0 ? "key" : "touch");
    else if (k === "zoom") setZoom(+b.dataset.z);
    else if (k === "random") random(b);
    else if (k === "reset") reset(b);
    else if (k === "done") finish("done");
  });
  /* another body: it keeps the height and the hair you set if it can wear them, and takes its own if you never touched them */
  function setBody(id) {
    const d0 = opts.defaults[look.body], d1 = opts.defaults[id];
    look.body = id;
    if (d1) { if (!d0 || Math.abs(look.height - d0.height) < 0.03) look.height = d1.height; if (!(opts.hairStyles[id] || []).includes(look.hair.style)) look.hair.style = d1.hair.style; }
  }
  function random(b) {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    for (const k of Object.keys(ITEM)) { if (!can(k)) continue; const it = ITEM[k], l = it.type === "slider" ? null : listOf(it); if (it.type === "slider") setK(look, k, Math.round((0.15 + Math.random() * 0.7) * 20) / 20); else if (l.length) setK(look, k, pick(l)); }
    for (const c of cats()) ST.changed[c.id] = true; ST.random = true;
    sync(); push(); persist();
    AU.ui("choice"); X.hap("select"); ST.kick = 1; if (!still()) { ST.spin = Math.PI * 2; if (b) { b.classList.remove("is-pop"); void b.offsetWidth; b.classList.add("is-pop"); } }
  }
  function reset(b) {
    look = JSON.parse(JSON.stringify(def)); ST.reset = true; ST.changed = {}; ST.random = false;
    sync(); push(); persist();
    AU.ui("toggle"); X.hap("tap"); ST.kick = 1; if (b && !still()) { b.classList.remove("is-pop"); void b.offsetWidth; b.classList.add("is-pop"); }
  }

  /* ---------- turning and zooming: a drag, a pinch, the wheel; the pad's right stick and triggers ---------- */
  const ptrs = new Map(); let pinch = 0;
  let tapT = 0;
  stageEl.addEventListener("pointerdown", e => { if (e.target.closest("button")) return; const now = performance.now(); if (now - tapT < 320 && !ptrs.size) ST.base = 0.35 + Math.round((ST.base - 0.35) / (Math.PI * 2)) * Math.PI * 2; tapT = now; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { stageEl.setPointerCapture(e.pointerId); } catch (x) {} if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } ST.held = 6; stageEl.classList.add("is-held"); });
  stageEl.addEventListener("pointermove", e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch > 0) setZoom(ST.zoomTo + (d - pinch) / 220); pinch = d; }
    else ST.base -= dx * 0.011;
    ST.held = 6;
  });
  const up = e => { ptrs.delete(e.pointerId); pinch = 0; if (!ptrs.size) stageEl.classList.remove("is-held"); };
  stageEl.addEventListener("pointerup", up); stageEl.addEventListener("pointercancel", up);
  stageEl.addEventListener("wheel", e => { e.preventDefault(); setZoom(ST.zoomTo - Math.sign(e.deltaY) * 0.34); ST.held = 3; }, { passive: false });
  stageEl.addEventListener("contextmenu", e => e.preventDefault());
  function pad(P, dt) {
    if (!ST.open) return;
    if (P.pe(4)) stepCat(-1); else if (P.pe(5)) stepCat(1);
    const rx = P.axis(2), ry = P.axis(3);
    if (Math.abs(rx) > 0.16) { ST.base += rx * 2.6 * dt; ST.held = 6; }
    const z = P.pv(7) - P.pv(6) - (Math.abs(ry) > 0.3 ? ry : 0);
    if (Math.abs(z) > 0.1) { setZoom(ST.zoomTo + z * 1.6 * dt); ST.held = 3; }
  }

  /* ---------- moving the focus: the D-pad, the left stick and the arrow keys. Up and down go between the rows (a row
     of swatches or tiles is walked in two dimensions), left and right move along one, and on a slider they set it ---------- */
  function groups() {
    const g = [$$("[data-cr='zoom']"), $$("[data-cr='cat']", tabsEl)];
    for (const row of $$(".cr-row", bodyEl)) g.push($$("input, button", row));
    g.push($$("button", $(".cr-foot")));
    return g.filter(a => a.length);
  }
  const mid = e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; };
  function focusOn(e) { if (!e) return false; e.focus({ preventScroll: true }); try { e.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (x) {} X.tick(); return true; }
  function nav(dir) {
    const G = groups(), cur = document.activeElement;
    let gi = G.findIndex(a => a.includes(cur));
    if (gi < 0) { focusOn($("[aria-selected='true']", tabsEl) || G[0][0]); return; }
    const g = G[gi], i = g.indexOf(cur);
    if (dir > 2) {
      if (cur.matches("input[type=range]")) { const v = clamp(+cur.value + (dir === 4 ? 5 : -5), 0, 100); if (v !== +cur.value) { cur.value = String(v); cur.dispatchEvent(new Event("input", { bubbles: true })); } return; }
      const n = g[i + (dir === 4 ? 1 : -1)];
      if (n) { focusOn(n); if (n.dataset.cr === "cat") n.click(); }
      return;
    }
    // up or down: the nearest in the same row group that sits on another line, else the next group
    const c = mid(cur), down = dir === 2;
    let best = null, bs = 1e9;
    for (const e of g) { if (e === cur) continue; const m = mid(e), dy = down ? m.y - c.y : c.y - m.y; if (dy < c.h * 0.5) continue; const s = dy * 3 + Math.abs(m.x - c.x); if (s < bs) { bs = s; best = e; } }
    if (best) { focusOn(best); return; }
    const ng = G[gi + (down ? 1 : -1)]; if (!ng) return;
    const sel = ng.find(e => e.getAttribute("aria-selected") === "true"); if (sel) { focusOn(sel); return; }
    const ys = ng.map(e => mid(e).y), edge = down ? Math.min(...ys) : Math.max(...ys);
    best = null; bs = 1e9;
    for (const e of ng) { const m = mid(e); if (Math.abs(m.y - edge) > m.h * 0.5) continue; const s = Math.abs(m.x - c.x); if (s < bs) { bs = s; best = e; } }
    focusOn(best || ng[0]);
  }
  /* A, or the chooser's button: press what has the focus */
  function press() { const a = document.activeElement; if (a && sec.contains(a) && !a.matches("input[type=range]")) a.click(); else if (!a || !sec.contains(a)) nav(2); }
  function key(e, k) {
    if (k === "escape") { e.preventDefault(); finish("back"); return true; }
    const d = { arrowup: 1, arrowdown: 2, arrowleft: 3, arrowright: 4 }[k];
    if (d) { e.preventDefault(); nav(d); return true; }
    if (!e.repeat && (k === "q" || k === "[" || k === "pageup")) { e.preventDefault(); stepCat(-1); return true; }
    if (!e.repeat && (k === "e" || k === "]" || k === "pagedown")) { e.preventDefault(); stepCat(1); return true; }
    return false;
  }
  /* the focus stays on this screen while it is up */
  sec.addEventListener("keydown", e => {
    if (e.key !== "Tab") return;
    const f = $$("button, input").filter(x => x.tabIndex >= 0 && x.getClientRects().length); if (!f.length) return;
    const a = document.activeElement, first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (a === first || !sec.contains(a))) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && (a === last || !sec.contains(a))) { e.preventDefault(); first.focus(); }
  });

  /* ---------- in and out ---------- */
  function snapshot() {
    const s = { cam: { p: camera.position.clone(), q: camera.quaternion.clone(), fov: camera.fov }, U: {}, C: {}, sharp: post.sharp, lamps: [], n: U.uLampN.value };
    for (const k of U_COL) s.U[k] = U[k].value.clone(); for (const k of U_NUM) s.U[k] = U[k].value; s.U.uMoonDir = U.uMoonDir.value.clone();
    const cu = post.comp.u; for (const k of COMP_KEYS) s.C[k] = cu[k].value; for (const k of COMP_VEC) s.C[k] = cu[k].value.clone();
    return s;
  }
  function restore(s) {
    if (!s) return;
    camera.position.copy(s.cam.p); camera.quaternion.copy(s.cam.q); camera.fov = s.cam.fov; camera.clearViewOffset(); camera.updateProjectionMatrix();
    for (const k of U_COL) U[k].value.copy(s.U[k]); for (const k of U_NUM) U[k].value = s.U[k]; U.uMoonDir.value.copy(s.U.uMoonDir);
    const cu = post.comp.u; for (const k of COMP_KEYS) cu[k].value = s.C[k]; for (const k of COMP_VEC) cu[k].value.copy(s.C[k]); post.sharp = s.sharp;
  }
  function studioOn() {
    for (const k of U_COL) U[k].value.set(STUDIO[k.slice(1).toLowerCase()]);
    U.uFogDen.value = STUDIO.den; U.uWetAll.value = 0; U.uSat.value = 1;
    applyGrade(post, STUDIO_GRADE);
    const cu = post.comp.u; cu.uBox.value = 0; cu.uDofK.value = 0; cu.uRange.value = 9;
  }
  function layout() {
    if (!ST.live) return;
    const a = el.getBoundingClientRect(), r = stageEl.getBoundingClientRect();
    ST.W = Math.max(1, a.width); ST.H = Math.max(1, a.height);
    // the body stands between the line at the top and the view buttons at the bottom
    const zr = $(".cr-zoom").getBoundingClientRect(), tr = turnEl.getBoundingClientRect();
    const top = Math.max(r.top, tr.bottom) + 6, bot = Math.min(r.bottom, zr.top) - 10;
    ST.rect = { x: r.left - a.left, y: top - a.top, w: Math.max(1, r.width), h: Math.max(40, bot - top) };
  }
  addEventListener("resize", () => { if (ST.live) requestAnimationFrame(layout); });
  /* mode "first": after the night, before the lot (Done reads as the way on); "pause": from the pause menu */
  async function open(mode) {
    if (ST.open) return false;
    let d; try { d = await getDoll(); } catch (e) { if (X.debug) console.warn("creator", e); return false; }
    ready(d);
    Object.assign(ST, { open: true, live: true, mode, changed: {}, random: false, reset: false, yaw: 0.35, base: 0.35, held: 0, zoom: 0, zoomTo: 0, kick: 0, spin: 0, t: 0 });
    const cs = cats(); ST.cat = cs.length ? cs[0].id : "body";
    hEl.textContent = L(mode === "first" ? "look_h" : "look_h_pause");
    $("span", doneEl).textContent = L(mode === "first" ? "look_go" : "look_done");
    drawTabs(); drawBody(0); setZoom(0);
    ST.snap = snapshot(); studioOn();
    sec.hidden = false; sec.dataset.mode = mode; el.classList.add("is-look"); glyphs();
    layout(); requestAnimationFrame(() => { sec.classList.add("is-on"); layout(); });
    push();
    if (!touch()) setTimeout(() => { if (ST.open && !sec.contains(document.activeElement)) { const t = $("[aria-selected='true']", tabsEl); if (t) t.focus({ preventScroll: true }); } }, 60);
    return new Promise(res => (ST.resolve = res));
  }
  /* Done is an arrival (the sound, the tap and the screen's move, together); Back, Esc and a skip leave without a sound */
  function finish(how) {
    if (!ST.open) return;
    ST.open = false; persist();
    const ch = ST.changed;
    X.track("story_look", { how: ST.mode, end: how, body: !!ch.body, face: !!ch.face, hair: !!ch.hair, outfit: !!ch.outfit, random: ST.random, reset: ST.reset });
    if (how === "done") { X.fx("arrive"); if (!still()) sec.classList.add("is-done"); }
    sec.classList.remove("is-on"); el.classList.remove("is-look"); ptrs.clear(); stageEl.classList.remove("is-held");
    const res = ST.resolve; ST.resolve = null;
    setTimeout(() => { if (!ST.open) { sec.hidden = true; sec.classList.remove("is-done"); } }, 320);
    if (res) res(how);
  }
  /* the studio's light, lens and camera handed back (the caller says when: at once from the pause menu, under the
     fade on the way to the lot) */
  function end() { if (!ST.live || ST.open) return; ST.live = false; restore(ST.snap); ST.snap = null; }

  /* ---------- a frame of the studio ---------- */
  const _t = new THREE.Vector3(), _h = new THREE.Vector3();
  function lamp(i, a, r, y, col, range) { U.uLampPos.value[i].set(Math.sin(a) * r, y, Math.cos(a) * r, range); U.uLampCol.value[i].set(col[0], col[1], col[2], 0); }
  function frame(dt) {
    if (!ST.live || !doll) return;
    ST.t += dt;
    // the turn: a slow sway about where you left it; a drag or the stick holds it still for a while; Randomize
    // takes it once round
    ST.held = Math.max(0, ST.held - dt);
    if (ST.spin > 0.01) { const s = Math.min(ST.spin, 9 * dt * ST.spin + 0.01); ST.base += s; ST.spin -= s; }
    const sway = still() ? 0 : Math.sin(ST.t * 0.42) * 0.5 * (1 - clamp(ST.held / 1.5, 0, 1));
    ST.sway = damp(ST.sway || 0, sway, 3, dt);
    ST.yaw = damp(ST.yaw, ST.base + ST.sway, still() ? 30 : 9, dt);
    ST.zoom = damp(ST.zoom, ST.zoomTo, still() ? 30 : 6, dt);
    ST.kick = damp(ST.kick, 0, 9, dt);
    doll.pos.set(0, 0, 0); doll.wantYaw = doll.yaw = 0; doll.speed = 0;
    doll.update(dt);
    // the frame: the whole body, or the head and shoulders, fitted to the part of the screen the panel leaves
    const tall = (doll.height || 1.78) * (doll.group.scale.y || 1);
    doll.headWorld(_h);
    const z = ST.zoom * ST.zoom * (3 - 2 * ST.zoom);
    const halfH = lerp(tall * 0.56, 0.21, z), halfW = lerp(0.5, 0.18, z);
    _t.set(0, lerp(tall * 0.5, _h.y - 0.03, z), 0);
    const fov = 30, tn = Math.tan(fov * Math.PI / 360), R = ST.rect;
    let dist = Math.max(halfH / tn * (ST.H / R.h), halfW / (tn * (ST.W / ST.H)) * (ST.W / R.w));
    dist *= 1 - (still() ? 0 : 0.018 * ST.kick);
    camera.fov = fov; camera.aspect = ST.W / ST.H;
    camera.setViewOffset(ST.W, ST.H, Math.round(ST.W / 2 - (R.x + R.w / 2)), Math.round(ST.H / 2 - (R.y + R.h / 2)), ST.W, ST.H);
    const a = ST.yaw, up = lerp(0.1, 0.02, z);
    camera.position.set(_t.x + Math.sin(a) * dist, _t.y + dist * up, _t.z + Math.cos(a) * dist); camera.lookAt(_t); camera.updateMatrixWorld();
    // three lamps that turn with the camera: a warm key high on one side, a cool fill low on the other, a rim behind
    lamp(0, a + 0.75, 2.9, 2.7, [1.75, 1.62, 1.42], 9); lamp(1, a - 1.05, 3.2, 1.3, [0.5, 0.58, 0.7], 9); lamp(2, a + Math.PI - 0.55, 2.6, 2.5, [1.3, 1.4, 1.6], 8); lamp(3, a + Math.PI + 0.9, 2.8, 1.9, [0.6, 0.54, 0.44], 8);
    for (let i = 4; i < MAXL; i++) { U.uLampPos.value[i].set(0, -100, 0, 1); U.uLampCol.value[i].set(0, 0, 0, 0); }
    U.uLampN.value = 4; U.uMoonDir.value.set(Math.sin(a + 0.5), 0.8, Math.cos(a + 0.5)).normalize();
    post.comp.u.uFocus.value = dist;
    post.render(stage, camera, ST.t);
  }

  return {
    el: sec, open, finish, end, frame, settle, pad, nav, press, key, glyphs, layout, applyTo,
    get isOpen() { return ST.open; }, get live() { return ST.live; },
    /* the first time only: once a look is kept (even the one you were given), the lot never asks again */
    wantFirst: () => !store.get(KEY),
    warm: () => getDoll().catch(() => null),
    debug: () => ({ open: ST.open, mode: ST.mode, cat: ST.cat, cats: opts ? cats().map(c => c.id) : [], real: !!(opts && opts.real), look: look ? JSON.parse(JSON.stringify(look)) : null, def: def ? JSON.parse(JSON.stringify(def)) : null, pending, out: look && opts ? outLook() : null, shown: opts ? Object.keys(ITEM).filter(can) : [], you: readBack(X.you()), doll: readBack(doll), zoom: +ST.zoom.toFixed(3), zoomTo: ST.zoomTo, yaw: +ST.yaw.toFixed(3), base: +ST.base.toFixed(3), live: ST.live, stored: load(), rect: ST.rect })
  };
}
