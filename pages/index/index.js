// ═══════════════════════════════════════════════════
//  SONA™ – 微信小程序版
//  移植自 web_app/index.html（canvas 2D + WebAudioContext）
//  · 3 首旋律（WebAudioContext oscillator，实验性 API）
//  · 点阵波形 + 粒子动画
//  · 倾斜 → BPM（wx.onDeviceMotionChange）
//  · 震动跟随律动（wx.vibrateShort，真机生效）
// ═══════════════════════════════════════════════════
// logical design space: LW is the fixed pixel-density baseline, LH follows the
// device aspect at runtime (edge-to-edge, equal scale, no distortion)
let LW = 135, LH = 240
let gCssW = 270, gCssH = 480, gS = 2, gDpr = 2   // screen mapping, set in onLoad
let gSafeTop = 0, gSafeBottom = 0                // CSS px insets (UI offset only, canvas stays full-screen)
let gSafeRight = 106                             // CSS px: WeChat '…' capsule button clearance (right)
// map a y designed for the 240-tall design space onto the actual LH
function ry(v) { return Math.round(v * LH / 240) }
// ── unified layout system (logical px; 1 logical px = gS CSS px) ──
function safeTopY() { return Math.round(gSafeTop / gS) }       // top content start (below status/Dynamic Island)
function safeBottomY() { return Math.round(gSafeBottom / gS) } // bottom content limit (above Home Indicator)
function safeRightX() { return Math.round(gSafeRight / gS) }   // right content limit (left of WeChat capsule)
function contentTop() { return safeTopY() }
function contentBottom() { return LH - safeBottomY() }
// ── corner-aware safe layout (iPhone R-corner + Dynamic Island + Home Indicator) ──
// logical corner radius ≈ 14% of LW (iPhone 14 Pro ≈ 55pt on 393pt ≈ 0.14); keeps a
// consistent visual relationship to the rounded corners on every iPhone aspect ratio
function cornerR() { return Math.max(9, Math.round(LW * 0.14)) }
// bottom-right play/pause status dot: hugs the R-corner pocket, never clipped by the
// corner curve and never below the Home-Indicator safe line (Safe Area + R Corner)
function statusDotPos() {
  const d = Math.max(Math.round(cornerR() * 0.6), safeBottomY())
  return { x: LW - d, y: LH - d }
}
// bottom-centre COMPOSE capsule rect — derived from contentBottom, clear of Home Indicator
function composeArea() {
  const botY = contentBottom()
  const w = 44, h = 13
  return { x: (LW - w) / 2, y: botY - ry(18), w, h }
}
// VIB ON/OFF pixel label rect (above the COMPOSE button)
function vibArea() {
  const txt = gVibOn ? 'VIB ON' : 'VIB OFF'
  const w = pixWidth(txt, 1)
  return { x: (LW - w) / 2, y: contentBottom() - ry(30), w, h: 5 }
}
// top-left pixel-capsule back button rect — below status bar / Dynamic Island
function backBtnArea() {
  return { x: 3, y: safeTopY(), w: 18, h: 14 }
}
// clamp a centred text's x so it stays inside [left, right] (top-row layering, never overlapped)
function centerClamp(txt, size, left, right) {
  const f = fontScale(size)
  const w = pixW(String(txt), f.s, f.tr)
  return Math.round(Math.max(left + w / 2, Math.min(right - w / 2, LW / 2)))
}
// ── typography grid: pixel font glyph height = 5 * size; consistent centering for any component ──
function fontScale(size) {
  if (typeof size === 'object') return { s: size.s, tr: size.tracking || 0 }
  if (typeof size === 'string') { const c = TYPO[size] || TYPO.S; return { s: c.s, tr: c.tracking || 0 } }
  return { s: size, tr: 0 }
}
function textCenterX(txt, cx, size) {
  const f = fontScale(size)
  return Math.round(cx - pixW(txt, f.s, f.tr) / 2)
}
function textCenterY(cy, h, size) {
  return Math.round(cy + (h - 5 * fontScale(size).s) / 2)
}

// ── palette (legacy constants kept; C_GREEN is a status color, intentionally not themed) ──
const C_BLACK = '#000', C_WHITE = '#fff', C_MAIN = '#5acbff', C_MAIN_LT = '#8edbff',
      C_MAIN_DK = '#3a9bd0', C_DIM = '#6b6d', C_MUTED = '#adf7', C_GREEN = '#07e000'

// ── theme (follows system light/dark; canvas only reads gTheme) ──
const THEME = {
  dark: {
    bg: '#04070b', surface: '#0d1a24', text: '#ffffff', textSecondary: '#8edbff',
    muted: '#5a6a76', accent: '#5acbff', accentLight: '#8edbff', accentDark: '#3a9bd0',
    grid: '#0d2533', particle: '#3a9bd0', border: '#16405c', toastBg: 'rgba(4,10,16,0.85)'
  },
  light: {
    bg: '#eef4f8', surface: '#ffffff', text: '#0e1a22', textSecondary: '#126f9e',
    muted: '#5a7a8c', accent: '#2e8fc7', accentLight: '#5acbff', accentDark: '#1c6a99',
    grid: '#d2e0e9', particle: '#2e8fc7', border: '#9fc3d8', toastBg: 'rgba(255,255,255,0.92)'
  }
}
let gTheme = THEME.dark   // default; set from system at launch
// accent as rgba() with a given alpha (capsule/btn/toast translucent fills)
function accentAlpha(a) { return 'rgba(' + hexRgb(gTheme.accent) + ',' + a + ')' }
function hexRgb(hex) {
  const h = String(hex).replace('#', '')
  return parseInt(h.substr(0, 2), 16) + ',' + parseInt(h.substr(2, 2), 16) + ',' + parseInt(h.substr(4, 2), 16)
}

// ── 3×5 pixel font ──
const PIX = {
  A: '111101111101101', B: '110101110101110', C: '111100100100111',
  D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '111100101101111', H: '101101111101101', I: '111010010010111',
  J: '001001001101111', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '101111111111101', O: '111101101101111',
  P: '110101110100100', Q: '111101101110011', R: '110101110101101',
  S: '111100111001111', T: '111010010010010', U: '101101101101111',
  V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111',
  '3': '111001011001111', '4': '101101111001001', '5': '111100111001111',
  '6': '111100111101111', '7': '111001010010010', '8': '111101111101111',
  '9': '111101111001111',
  '.': '000000000000010', ':': '000010000010000', 'x': '000101010101000',
  '<': '010110100110010', '>': '010011001011010', ' ': '000000000000000'
}
function pixWidth(txt, s) { return String(txt).length * 4 * s }
function drawPixText(x, y, s, color, txt) {
  ctx.fillStyle = color
  const up = String(txt).toUpperCase()
  let cx = x
  for (const ch of up) {
    const pat = PIX[ch] || PIX[' ']
    for (let r = 0; r < 5; r++) {
      const row = pat.substr(r * 3, 3)
      for (let c = 0; c < 3; c++) if (row[c] === '1') ctx.fillRect(cx + c * s, y + r * s, s, s)
    }
    cx += 4 * s
  }
}

// ═══════════ Phase 2 — UI foundation systems (Retro Modern) ═══════════
// ── Typography System: retro pixel type, modern rhythm ──
const TYPO = {
  XL: { s: 4, tracking: 1 },   // Score / BPM / core numbers
  L:  { s: 3, tracking: 1 },   // Song name / page core titles
  M:  { s: 2, tracking: 0 },   // Button / Navigation
  S:  { s: 1, tracking: 0 }    // Metadata / Hint / secondary
}
function pixW(txt, s, tr) { const len = String(txt).length; return (len * 4 + (len - 1) * (tr || 0)) * s }
// unified pixel text API (drawPixText is kept as-is)
// style: { size:'XL'|'L'|'M'|'S'|number, color, align:'left'|'center'|'right', baseline:'top'|'middle'|'bottom', tracking }
function drawPixelText(txt, x, y, style) {
  const st = style || {}
  const cfg = (typeof st.size === 'string') ? (TYPO[st.size] || TYPO.S) : { s: st.size, tracking: 0 }
  const s = cfg.s
  const tr = (st.tracking !== undefined ? st.tracking : cfg.tracking) || 0
  const color = st.color || gTheme.text
  const str = String(txt).toUpperCase()
  let yy = y
  if (st.baseline === 'middle') yy = y - Math.round(2.5 * s)
  else if (st.baseline === 'bottom') yy = y - 5 * s
  const w = pixW(str, s, tr)
  let cx = x
  if (st.align === 'center') cx = x - w / 2
  else if (st.align === 'right') cx = x - w
  ctx.fillStyle = color
  for (let i = 0; i < str.length; i++) {
    const pat = PIX[str[i]] || PIX[' ']
    const ox = (i * 4 + i * tr) * s
    for (let r = 0; r < 5; r++) {
      const row = pat.substr(r * 3, 3)
      for (let c = 0; c < 3; c++) if (row[c] === '1') ctx.fillRect(cx + ox + c * s, yy + r * s, s, s)
    }
  }
}

// ── Spacing System (design-space units; SAFE_* mapped to dynamic LH via ry) ──
const SPACE_XS = 2, SPACE_S = 4, SPACE_M = 8, SPACE_L = 14, SPACE_XL = 22
const SAFE_TOP = ry(4), HEADER = ry(16), CONTENT = ry(40), CONTROL = ry(200), SAFE_BOTTOM = ry(224)

// ── Pixel UI state: press feedback + pixel ripple ──
let gPress = null, gFlash = 0
let gPixelRipples = []

function isPressed(x, y, w, h) {
  return !!(gPress && gFlash > 0.01 && gPress.x >= x && gPress.x <= x + w && gPress.y >= y && gPress.y <= y + h)
}
// pixel-step rectangle path (chamfered corners — flat, no border-radius)
function pixelRect(x, y, w, h, step) {
  const s = step || 1
  ctx.beginPath()
  ctx.moveTo(x + s, y); ctx.lineTo(x + w - s, y)
  ctx.lineTo(x + w, y + s); ctx.lineTo(x + w, y + h - s)
  ctx.lineTo(x + w - s, y + h); ctx.lineTo(x + s, y + h)
  ctx.lineTo(x, y + h - s); ctx.lineTo(x, y + s)
  ctx.closePath()
}
// flat pixel button: states normal | pressed | active | disabled
function drawPixelButton(x, y, w, h, text, style) {
  const st = style || {}
  const state = st.state || 'normal'
  const off = (state === 'pressed') ? 1 : 0
  const yy = y + off
  ctx.fillStyle = state === 'disabled' ? accentAlpha(0.06)
    : (state === 'active' || state === 'pressed') ? accentAlpha(0.30) : accentAlpha(0.14)
  pixelRect(x, yy, w, h, st.step || 1); ctx.fill()
  ctx.strokeStyle = state === 'disabled' ? gTheme.border
    : (state === 'active' || state === 'pressed') ? gTheme.accentLight : gTheme.accent
  ctx.lineWidth = 1
  pixelRect(x, yy, w, h, st.step || 1); ctx.stroke()
  drawPixelText(text, x + w / 2, textCenterY(yy, h, st.size || 'M'), { size: st.size || 'M', align: 'center', color: state === 'disabled' ? gTheme.muted : (st.fg || gTheme.text) })
}
// restrained pixel ripple: small pixel-diamond burst from the touch point
function drawPixelRipples() {
  if (!gPixelRipples.length) return
  for (let i = gPixelRipples.length - 1; i >= 0; i--) {
    const rp = gPixelRipples[i]
    const age = (Date.now() - rp.t0) / 200
    if (age >= 1) { gPixelRipples.splice(i, 1); continue }
    const rr = 1 + Math.round(age * 4)
    ctx.fillStyle = accentAlpha(0.6 * (1 - age))
    const rx = Math.round(rp.x), ryy = Math.round(rp.y)
    for (let dy = -rr; dy <= rr; dy++)
      for (let dx = -rr; dx <= rr; dx++)
        if (Math.abs(dx) + Math.abs(dy) === rr) ctx.fillRect(rx + dx, ryy + dy, 1, 1)
  }
}

// ═══════════ Phase 4 — unified Interaction Feedback System ═══════════
// one press → active → release → idle contract shared by every interactive element;
// all fx are time-based (Date.now / rAF), never setInterval, self-cleaning (no leaks)

// returns transition progress 0..1 for a ref value: 0 on the first frame after a change,
// ramps to 1 and stays done. Powers state wipes, page transitions, dot pulses, hints.
function fxProgress(key, cur, dur) {
  const e = gFx[key]
  if (!e || e.val !== cur) { gFx[key] = { val: cur, t0: Date.now(), done: false }; return 0 }
  if (e.done) return 1
  const a = (Date.now() - e.t0) / dur
  if (a >= 1) { e.done = true; return 1 }
  return a
}
// periodically drop finished fx entries (kept ~2s so the `done` state stays cheap)
function cleanupFx() {
  const now = Date.now()
  for (const k in gFx) { const e = gFx[k]; if (e.done && now - e.t0 > 2000) delete gFx[k] }
}
// brighten a control's base colour while it is pressed (unified press feedback)
function feedbackColor(hit, base) {
  return (hit && isPressed(hit.x, hit.y, hit.w, hit.h)) ? gTheme.accentLight : base
}
// core pixel-text renderer with optional horizontal reveal (0..1) and scan line (0..1)
function drawPixFX(txt, x, y, style, reveal, scan) {
  const st = style || {}
  const cfg = (typeof st.size === 'string') ? (TYPO[st.size] || TYPO.S) : { s: st.size, tracking: 0 }
  const s = cfg.s
  const tr = (st.tracking !== undefined ? st.tracking : cfg.tracking) || 0
  const color = st.color || gTheme.text
  const str = String(txt).toUpperCase()
  let yy = y
  if (st.baseline === 'middle') yy = y - Math.round(2.5 * s)
  else if (st.baseline === 'bottom') yy = y - 5 * s
  const w = pixW(str, s, tr)
  let cx = x
  if (st.align === 'center') cx = x - w / 2
  else if (st.align === 'right') cx = x - w
  ctx.fillStyle = color
  const revealW = Math.round(w * (reveal == null ? 1 : Math.max(0, Math.min(1, reveal))))
  for (let i = 0; i < str.length; i++) {
    const pat = PIX[str[i]] || PIX[' ']
    const ox = (i * 4 + i * tr) * s
    for (let r = 0; r < 5; r++) {
      const row = pat.substr(r * 3, 3)
      for (let c = 0; c < 3; c++) {
        if (row[c] !== '1') continue
        const px = cx + ox + c * s
        if (px - cx < revealW) ctx.fillRect(px, yy + r * s, s, s)
      }
    }
  }
  if (scan != null) {
    const sy = Math.round(yy + scan * 5 * s)
    ctx.fillStyle = gTheme.accentLight
    ctx.globalAlpha = 0.55 * (1 - scan)
    ctx.fillRect(cx, sy, w, s)
    ctx.globalAlpha = 1
  }
}
// hardware-display numeric refresh: a bright scan sweeps down + brief flash on value change
function drawNumberFx(txt, x, y, style, refKey) {
  const key = refKey || 'n'
  if (gNumPrev[key] !== txt) { gNumPrev[key] = txt; gNumFx[key] = Date.now() }
  let scan = 0
  const fx = gNumFx[key]
  if (fx) { const age = Date.now() - fx; if (age > 160) delete gNumFx[key]; else scan = age / 160 }
  drawPixFX(txt, x, y, style, 1, scan > 0 ? scan : null)
}
// pixel wipe reveal on state-text change (VIB, PLAY/STOP, title, hint)
function drawStateWipe(txt, x, y, style, refKey) {
  const p = fxProgress(refKey, txt, 140)
  drawPixFX(txt, x, y, style, (p >= 1) ? 1 : p, null)
}
// restrained pixel-fade page transition (~150ms): a gentle brightness dip that returns to
// normal. Deliberately NO scan band / wipe lines — keeps the Retro Pixel device look calm.
function drawPageTransition() {
  const p = fxProgress('page', gScr, 150)
  if (p >= 1) return
  const inv = 1 - p
  ctx.fillStyle = gTheme.bg
  ctx.globalAlpha = 0.10 * inv
  ctx.fillRect(0, 0, LW, LH)
  ctx.globalAlpha = 1
}

// ── note frequencies (A2..Fs5, same as firmware) ──
const R = 0
const A2 = 110, B2 = 123, Cs3 = 139, D3 = 147, E3 = 165, Fs3 = 185, Gs3 = 208, A3 = 220,
      B3 = 247, Cs4 = 277, D4 = 294, E4 = 330, F4 = 349, Fs4 = 370, G4 = 392, Gs4 = 415,
      A4 = 440, B4 = 494, Cs5 = 554, D5 = 587, E5 = 659, Fs5 = 740

// ── melodies (same as web / firmware) ──
const S1 = [
  A2,200,A2,200,A2,200,A2,200, A2,200,A2,200,E3,200,A2,200,
  A2,200,A2,200,A2,200,A2,200, A2,200,A2,200,Cs4,200,A2,200,
  A2,200,A2,200,A2,200,A2,200, A2,200,A2,200,E3,200,A2,200,
  A2,200,A2,200,A2,200,A2,200, A2,200,A2,200,Fs4,200,A2,200,
  D3,200,D3,200,D3,200,D3,200, D3,200,D3,200,A3,200,D3,200,
  D3,200,D3,200,D3,200,D3,200, D3,200,D3,200,F4,200,D3,200,
  E3,200,E3,200,E3,200,E3,200, E3,200,E3,200,B3,200,E3,200,
  E3,200,E3,200,E3,200,E3,200, E3,200,E3,200,Gs4,200,E3,200,
  R,400]
const S2 = [
  A2,240,R,240,A2,240,R,240, A2,240,R,240,A2,240,E3,240,
  A2,240,R,240,A2,240,R,240, A2,240,R,240,A2,240,Cs4,240,
  A2,240,R,240,A2,240,R,240, A2,240,R,240,A2,240,E3,240,
  A2,240,R,240,A2,240,R,240, A2,240,R,240,A2,240,Fs4,240,
  D3,240,D3,240,D3,240,D3,240, D3,240,D3,240,D3,240,A3,240,
  D3,240,D3,240,D3,240,D3,240, D3,240,D3,240,D3,240,F4,240,
  E3,240,E3,240,E3,240,E3,240, E3,240,E3,240,E3,240,Gs4,240,
  E3,240,E3,240,E3,240,E3,240, E3,240,E3,240,E3,240,A4,240,
  R,480]
const S3 = [
  A2,200,E3,200,A2,200,Cs4,200, A2,200,E3,200,A2,200,E4,200,
  A2,200,E3,200,A2,200,Fs4,200, A2,200,E3,200,A2,200,E4,200,
  A2,200,E3,200,A2,200,Cs4,200, A2,200,E3,200,A2,200,A4,200,
  A2,200,E3,200,A2,200,Fs4,200, A2,200,E3,200,A2,200,E4,200,
  D3,200,A3,200,D3,200,F4,200, D3,200,A3,200,D3,200,A4,200,
  D3,200,A3,200,D3,200,F4,200, D3,200,A3,200,D3,200,D5,200,
  E3,200,B3,200,E3,200,Gs4,200, E3,200,B3,200,E3,200,B4,200,
  E3,200,B3,200,E3,200,Gs4,200, E3,200,B3,200,E3,200,E5,200,
  R,400]
function notes(arr) { const out = []; for (let i = 0; i < arr.length; i += 2) out.push({ f: arr[i], d: arr[i + 1] }); return out }
const SONGS = [
  { title: 'Pulse', data: notes(S1) },
  { title: 'Beat', data: notes(S2) },
  { title: 'Groove', data: notes(S3) }
]

// ── state ──
let gScr = 'idle', gSt = 'stopped', gSongIdx = 0, gNoteIdx = 0,
    gTranspose = 0, gBpm = 1.0, gVibOn = true, gNoteT0 = 0
let cv = null, ctx = null, gLogo = null, gLogoOk = false, actx = null
let gRipples = [], gPulse = 0   // fx: touch ripples + note pulse
// ── composer (8-step × 8-note step sequencer) ──
const SEQ_SCALE = [A3, B3, Cs4, D4, E4, Fs4, Gs4, A4]   // A minor
const SEQ_NOTES = ['A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G#4', 'A4']
let gSeq = []
for (let r = 0; r < 8; r++) gSeq.push(new Array(8).fill(false))
let gSeqBpm = 120, gSeqPlay = false, gSeqStep = 0, gSeqT0 = 0
let gLogoHits = 0, gRainbow = false   // easter egg
let gShake = 0   // shake → wider wave (NaN-safe, mirrors firmware)
let gToast = null, gPrev = 'idle'   // canvas pixel toast + composer back target
// ── Phase 4 unified fx state: time-based transitions, self-cleaning, no leaks ──
let gFx = {}              // state-transition fx (fxProgress)
let gNumPrev = {}, gNumFx = {}   // numeric-display scan tracking (stable refKeys)
let gRafId = 0, gLastT = 0       // rAF id + last-frame timestamp for time-based decay
let gHidden = false              // page hidden → animation loop fully stops (no background rendering)
// ── session (v1: in-memory data collection, NOT persisted) ──
let gSession = null        // active session while a track is playing
let currentSession = null  // finished session (memory only)

// ═══════════ audio (WebAudioContext, experimental API) ═══════════
function ensureAudio() {
  if (!actx) { try { actx = wx.createWebAudioContext() } catch (e) { } }
}
function playTone(f, durMs) {
  ensureAudio()
  if (!actx) return
  try {
    const freq = f * Math.pow(2, gTranspose / 12)
    const osc = actx.createOscillator(), g = actx.createGain()
    osc.type = 'sine'; osc.frequency.value = freq
    g.gain.setValueAtTime(0.6, actx.currentTime)
    osc.connect(g); g.connect(actx.destination)
    osc.start()
    // schedule the stop on the audio clock — no per-note timers (fewer timers, better perf)
    try { osc.stop(actx.currentTime + Math.max(0.01, durMs / 1000)) }
    catch (e) { setTimeout(function () { try { osc.stop() } catch (e2) { } }, durMs + 30) }
  } catch (e) { }
}
function stopAudio() { try { if (actx) actx.suspend() } catch (e) { } }

// ═══════════ vibration (real haptics on phone) ═══════════
function vibe(f) {
  if (!gVibOn || f < 20) return
  const s = 0.65 + Math.min(1, (f - 110) / 740) * 0.35
  wx.vibrateShort({ type: s > 0.75 ? 'heavy' : (s > 0.45 ? 'medium' : 'light') })
}
// light tap feedback for every interactive tap (真机触感)
function haptic(type) {
  wx.vibrateShort({ type: type || 'light' })
}

function startSong(idx) {
  ensureAudio()
  gSongIdx = ((idx % SONGS.length) + SONGS.length) % SONGS.length
  gNoteIdx = 0; gNoteT0 = Date.now(); gSt = 'playing'
  gPulse = 1
  const n = SONGS[gSongIdx].data[0]
  if (n.f >= 20) { playTone(n.f, n.d / gBpm); vibe(n.f) }
}
function backToIdle() {
  endSession()
  gSt = 'stopped'; gScr = currentSession ? 'result' : 'idle'; gBpm = 1.0; stopAudio()
}

// ═══════════ session (v1: in-memory data collection, no persistence) ═══════════
function startSession() {
  gSession = {
    sessionId: 'ses_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    songId: gSongIdx,
    songName: SONGS[gSongIdx].title,
    startTime: Date.now(),
    initialBpm: gBpm,
    minBpm: gBpm,
    maxBpm: gBpm,
    maxShake: 0   // fresh session: shake counter starts from 0, accumulates via updateSession
  }
}
// called every frame while a session is open — keeps min/max bpm + maxShake fresh
function updateSession() {
  if (!gSession) return
  if (gBpm < gSession.minBpm) gSession.minBpm = gBpm
  if (gBpm > gSession.maxBpm) gSession.maxBpm = gBpm
  if (gShake > gSession.maxShake) gSession.maxShake = gShake
}
// finalize the active session into currentSession (idempotent, memory only)
function endSession() {
  if (!gSession) return
  const end = Date.now()
  gSession.duration = end - gSession.startTime
  gSession.createdAt = end
  currentSession = gSession
  gSession = null
}

// ═══════════ draw ═══════════
function roundRectPath(x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
function drawIdle() {
  ctx.fillStyle = gTheme.bg; ctx.fillRect(0, 0, LW, LH)
  // center: SONA logo as the visual anchor — buttery breathing on the SAME clock as the rAF loop
  const now = Date.now()
  const br = 1 + 0.010 * Math.sin(now * 0.0021)          // ~3s cycle, ±1%, continuous & smooth
  const ar = (gLogoOk && gLogo) ? (gLogo.width / Math.max(1, gLogo.height)) : 1
  const lw = 96 * br, lh = (96 * br) / ar                // float, no rounding jumps
  const lx = (LW - lw) / 2, ly = ry(118) - lh / 2
  if (gLogoOk && gLogo) {
    // extremely faint pixel glow breathing behind the logo (subtle, layered, flat)
    const glow = 1 + 0.012 * Math.sin(now * 0.0021 + 1.3)
    const gw = 100 * glow, gh = (100 * glow) / ar
    ctx.globalAlpha = 0.22 * (0.5 + 0.5 * Math.sin(now * 0.0021))
    ctx.drawImage(gLogo, (LW - gw) / 2, ry(118) - gh / 2, gw, gh)
    ctx.globalAlpha = 1
    ctx.drawImage(gLogo, lx, ly, lw, lh)
  } else {
    drawPixelText('SONA', LW / 2, ry(118), { size: 'XL', align: 'center', baseline: 'middle', color: gTheme.text })
  }
  // bottom: tap to start (soft breathing + press feedback, above Home Indicator)
  const a = 0.5 + 0.5 * Math.sin(now * 0.003)
  const tapHit = { x: 0, y: contentBottom() - ry(30), w: LW, h: ry(28) }
  ctx.globalAlpha = 0.28 + 0.42 * a
  drawPixelText('TAP TO START', LW / 2, contentBottom() - ry(20), { size: 'S', align: 'center', color: feedbackColor(tapHit, gTheme.muted) })
  ctx.globalAlpha = 1
  drawRipples()
}
function drawAurora(t) {
  const cx = LW / 2
  const flow = t * 0.004 * gBpm
  const amp = 12 + gPulse * 6 + gShake * 16
  const breathe = 0.75 + 0.25 * Math.sin(t * 0.003 * gBpm)
  const rainbowHue = gRainbow ? ((t * 0.05) % 360) : -1
  for (let li = 0; li < 3; li++) {
    const phase = flow + li * 2.1
    let col = (li === 1) ? gTheme.text : gTheme.muted
    if (rainbowHue >= 0) col = 'hsl(' + ((rainbowHue + li * 45) % 360) + ',85%,62%)'
    ctx.fillStyle = col
    for (let y = 2; y < LH - 2; y += 2) {
      const x = cx + amp * breathe * Math.sin(y * 0.055 + phase)
      if (x < 1 || x >= LW - 1) continue
      ctx.fillRect(x | 0, y, 1, 1)
    }
  }
  for (let i = 0; i < 30; i++) {
    const a = i * 0.21 + t * 0.002 * gBpm
    const px = cx + amp * breathe * Math.sin(a * 0.7 + i)
    const py = ((i * 4 + Math.sin(a * 1.7) * (4 + gPulse * 6)) % LH + LH) % LH
    let pcol = (i % 4 === 0) ? gTheme.text : gTheme.particle
    if (rainbowHue >= 0) pcol = 'hsl(' + ((rainbowHue + i * 12) % 360) + ',85%,65%)'
    ctx.fillStyle = pcol
    ctx.fillRect(px | 0, py, 1, 1)
  }
}
function drawCapsule(cx, cy, w, h, text, color) {
  const pressed = isPressed(cx, cy, w, h)
  const yy = cy + (pressed ? 1 : 0)
  ctx.fillStyle = pressed ? accentAlpha(0.30) : accentAlpha(0.18)
  roundRectPath(cx, yy, w, h, h / 2); ctx.fill()
  ctx.strokeStyle = pressed ? gTheme.accentLight : gTheme.accent; ctx.lineWidth = 1
  roundRectPath(cx, yy, w, h, h / 2); ctx.stroke()
  drawPixText(textCenterX(text, cx + w / 2, 1), textCenterY(yy, h, 1), 1, pressed ? gTheme.text : color, text)
}
// neat square button (small radius) with pixel text — for chrome controls
function drawBtn(cx, cy, w, h, text, color, active) {
  const pressed = isPressed(cx, cy, w, h)
  const yy = cy + (pressed ? 1 : 0)
  ctx.fillStyle = pressed ? accentAlpha(0.34) : (active ? accentAlpha(0.22) : accentAlpha(0.10))
  roundRectPath(cx, yy, w, h, 3); ctx.fill()
  ctx.strokeStyle = pressed ? gTheme.accentLight : gTheme.accent; ctx.lineWidth = 1
  roundRectPath(cx, yy, w, h, 3); ctx.stroke()
  drawPixText(textCenterX(text, cx + w / 2, 1), textCenterY(yy, h, 1), 1, pressed ? gTheme.text : color, text)
}
// small, low-key pixel-capsule back button with a pixel '<' arrow — unified chrome,
// vertically/horizontally centred via the shared pixel measurement (textCenterX/Y)
function drawPixelBack(x, y, w, h) {
  const pressed = isPressed(x, y, w, h)
  const yy = y + (pressed ? 1 : 0)
  ctx.fillStyle = pressed ? accentAlpha(0.30) : accentAlpha(0.10)
  roundRectPath(x, yy, w, h, h / 2); ctx.fill()
  ctx.strokeStyle = pressed ? gTheme.accentLight : gTheme.accent; ctx.lineWidth = 1
  roundRectPath(x, yy, w, h, h / 2); ctx.stroke()
  drawPixelText('<', x + w / 2, textCenterY(yy, h, 'S'), { size: 'S', align: 'center', color: gTheme.text })
}
// canvas pixel toast — fades in/out under "TAP TO PLAY", no system font
function drawToast() {
  if (!gToast) return
  const age = (Date.now() - gToast.t0) / 1400
  if (age >= 1) { gToast = null; return }
  const a = age < 0.15 ? age / 0.15 : (1 - age) / 0.85
  const txt = gToast.text
  const w = pixWidth(txt, 1) + 8
  ctx.globalAlpha = 0.9 * Math.max(0, Math.min(1, a))
  ctx.fillStyle = gTheme.toastBg
  roundRectPath((LW - w) / 2, ry(174), w, 12, 3); ctx.fill()
  ctx.strokeStyle = accentAlpha(0.35); ctx.lineWidth = 0.5
  roundRectPath((LW - w) / 2, ry(174), w, 12, 3); ctx.stroke()
  drawPixelText(txt, textCenterX(txt, LW / 2, 1), textCenterY(ry(174), 12, 1), { size: 1, color: gTheme.textSecondary })
  ctx.globalAlpha = 1
}
function drawHUD(t) {
  // top-left: small pixel-capsule back button — below status bar / Dynamic Island
  const bb = backBtnArea()
  drawPixelBack(bb.x, bb.y, bb.w, bb.h)
  const rowC = bb.y + bb.h / 2         // shared vertical centre of the top row
  // top-right: speed — hardware number refresh (scan) on change, left of WeChat capsule
  drawNumberFx('x' + gBpm.toFixed(1), LW - safeRightX(), rowC, { size: 'S', align: 'right', baseline: 'middle', color: gTheme.textSecondary }, 'spd')
  // top-centre: song title — pixel wipe reveal on song change, clamped between back/speed
  const title = SONGS[gSongIdx].title
  drawStateWipe(title, centerClamp(title, 'S', bb.x + bb.w + SPACE_M, LW - safeRightX() - SPACE_M), rowC, { size: 'S', align: 'center', baseline: 'middle', color: gTheme.muted }, 'title')
  // bottom-right: play/pause status dot — R-corner position + press & state-change feedback
  const dot = statusDotPos()
  const dotHit = { x: dot.x - 8, y: dot.y - 8, w: 16, h: 16 }
  const dotPress = isPressed(dotHit.x, dotHit.y, dotHit.w, dotHit.h)
  const stP = fxProgress('st', gSt, 180)          // brief pulse on play/pause/stop change
  const halo = (stP < 1) ? (1 - stP) : 0
  ctx.fillStyle = gSt === 'playing' ? C_GREEN : (dotPress ? gTheme.accentLight : gTheme.muted)
  ctx.beginPath(); ctx.arc(dot.x, dot.y, 2 + (dotPress ? 1 : 0), 0, Math.PI * 2); ctx.fill()
  if (gSt === 'playing' || dotPress || halo > 0.02) {
    const p = 0.5 + 0.5 * Math.sin(t * 0.005)
    const rr = 2 + 2 * (dotPress ? 2 : p) + halo * 3
    const aa = Math.min(0.6, (dotPress ? 0.7 : 0.4 * p) + halo * 0.5)
    ctx.strokeStyle = 'rgba(7,224,0,' + aa.toFixed(2) + ')'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(dot.x, dot.y, rr, 0, Math.PI * 2); ctx.stroke()
  }
  // bottom: vibrator status (pixel wipe + press) + COMPOSE entry (press capsule)
  const va = vibArea()
  const vibHit = { x: va.x - 6, y: va.y - 4, w: va.w + 12, h: va.h + 8 }
  drawStateWipe(gVibOn ? 'VIB ON' : 'VIB OFF', va.x, va.y, { size: 1, color: feedbackColor(vibHit, gVibOn ? C_GREEN : gTheme.muted) }, 'vib')
  const ca = composeArea()
  drawCapsule(ca.x, ca.y, ca.w, ca.h, 'COMPOSE', gTheme.textSecondary)
  // TAP TO PLAY hint (when not playing) — pixel wipe in + press feedback
  const hintP = fxProgress('hint', (gSt !== 'playing') ? 1 : 0, 140)
  if (gSt !== 'playing') {
    const hint = 'Tap to play'
    const hx = (LW - pixWidth(hint, 1)) / 2, hy = LH / 2 + 40
    const hit = { x: 0, y: hy - 8, w: LW, h: 24 }
    drawPixFX(hint, hx, hy, { size: 1, color: feedbackColor(hit, gTheme.accent) }, (hintP >= 1) ? 1 : hintP, null)
  }
}
// touch ripple effect (expanding fading ring)
function drawRipples() {
  if (!gRipples.length) return
  for (let i = gRipples.length - 1; i >= 0; i--) {
    const rp = gRipples[i]
    const age = (Date.now() - rp.t0) / 300   // Date.now() matches rp.t0 (set in onTouchStart)
    if (age >= 1) { gRipples.splice(i, 1); continue }
    const rad = 5 + age * 20
    ctx.strokeStyle = accentAlpha(0.5 * (1 - age))
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(rp.x, rp.y, rad, 0, Math.PI * 2); ctx.stroke()
  }
}
function drawPlayer(t) { ctx.fillStyle = gTheme.bg; ctx.fillRect(0, 0, LW, LH); drawAurora(t); drawHUD(t); drawRipples(t) }
// ═══════════ composer (step sequencer) ═══════════
function enterComposer() {
  gPrev = (gScr === 'player') ? 'player' : 'idle'
  gSeqPlay = false; gSeqStep = 0
  stopAudio()
  endSession()
  gScr = currentSession ? 'result' : 'composer'   // session ended → show result first
}
function drawComposer(t) {
  ctx.fillStyle = gTheme.bg; ctx.fillRect(0, 0, LW, LH)
  const topY = safeTopY()      // below status bar / Dynamic Island
  const botY = contentBottom() // above Home Indicator
  // top: minimal pixel labels — press feedback + number scan / state wipe on change
  const playCol = gSeqPlay ? C_GREEN : gTheme.text
  const bpmHit = { x: 0, y: topY, w: 50, h: ry(17) }
  drawNumberFx('BPM ' + gSeqBpm, 6, topY + ry(5), { size: 'S', color: feedbackColor(bpmHit, gTheme.textSecondary) }, 'cbpm')
  const playHit = { x: LW / 2 - 25, y: topY, w: 50, h: ry(17) }
  drawStateWipe(gSeqPlay ? 'STOP' : 'PLAY', LW / 2, topY + ry(5), { size: 'S', align: 'center', color: feedbackColor(playHit, playCol) }, 'seqplay')
  const clearHit = { x: LW - safeRightX() - 30, y: topY, w: 30, h: ry(17) }
  drawPixelText('CLEAR', LW - safeRightX(), topY + ry(5), { size: 'S', align: 'right', color: feedbackColor(clearHit, gTheme.muted) })
  ctx.fillStyle = gTheme.grid; ctx.fillRect(0, topY + ry(14), LW, 1)
  // grid: 8×8, roomier & calmer
  const gx = 12, gy = topY + ry(20), cell = 14, ch = 25
  for (let r = 0; r < 8; r++) {
    drawPixText(2, gy + r * ch + 8, 1, gTheme.muted, SEQ_NOTES[r])
    for (let s = 0; s < 8; s++) {
      const x = gx + s * cell, y = gy + r * ch
      const on = gSeq[r][s]
      const isStep = gSeqPlay && s === gSeqStep
      const cellPress = isPressed(x + 1, y + 2, cell - 2, ch - 4)
      ctx.fillStyle = on ? (cellPress ? gTheme.accentLight : (isStep ? gTheme.accentLight : gTheme.accent))
                         : (cellPress ? accentAlpha(0.4) : (isStep ? gTheme.grid : gTheme.surface))
      ctx.fillRect(x + 1, y + 2, cell - 2, ch - 4)
    }
  }
  // bottom: neat pixel-capsule back button + hint
  drawPixelBack(3, botY - ry(17), 20, 14)
  drawPixText(LW - 4 - pixWidth('TAP GRID', 1), botY - ry(12), 1, gTheme.muted, 'TAP GRID')
  drawRipples(t)
}
// ═══════════ result screen (v2: show the finished session) ═══════════
function fmtDur(ms) {
  const sec = Math.max(0, Math.round((ms || 0) / 1000))
  const m = Math.floor(sec / 60), s = sec % 60
  return m + ':' + (s < 10 ? '0' : '') + s
}
// AGAIN → replay current song in player with a FRESH session (new sessionId)
function playAgain() {
  const idx = currentSession ? currentSession.songId : gSongIdx
  currentSession = null
  gScr = 'player'
  startSong(idx)     // fresh playback from note 0
  startSession()     // brand new sessionId (gSession was cleared by endSession)
  gToast = null
}
// BACK → idle, drop the finished session (no persistence yet)
function resultBack() {
  currentSession = null
  backToIdle()
}
function drawResult(t) {
  ctx.fillStyle = gTheme.bg; ctx.fillRect(0, 0, LW, LH)
  const s = currentSession
  const topY = safeTopY()      // below status bar / Dynamic Island
  const botY = contentBottom() // above Home Indicator
  drawPixelText('SONA', LW / 2, topY + ry(30), { size: 'XL', align: 'center', color: gTheme.text })
  drawPixelText('YOUR SESSION', LW / 2, topY + ry(60), { size: 'S', align: 'center', color: gTheme.textSecondary })
  const name = s ? s.songName : '-'
  drawPixelText(name, LW / 2, topY + ry(78), { size: 'S', align: 'center', color: gTheme.accent })
  ctx.fillStyle = gTheme.grid; ctx.fillRect(6, topY + ry(94), LW - 12, 1)
  // duration (gBpm is an internal 0.1~8 multiplier, so no real BPM — show SPEED)
  drawPixelText('DURATION ' + fmtDur(s && s.duration), LW / 2, ry(106), { size: 'S', align: 'center', color: gTheme.muted })
  drawPixelText('SPEED', LW / 2, ry(130), { size: 'S', align: 'center', color: gTheme.muted })
  const lo = s ? s.minBpm.toFixed(1) : '0.0'
  const hi = s ? s.maxBpm.toFixed(1) : '0.0'
  drawNumberFx(lo + ' > ' + hi, LW / 2, ry(142), { size: 'S', align: 'center', color: gTheme.textSecondary }, 'rspeed')
  drawPixelText('MOVEMENT', LW / 2, ry(166), { size: 'S', align: 'center', color: gTheme.muted })
  const mv = s ? s.maxShake.toFixed(1) : '0.0'
  drawNumberFx(mv, LW / 2, ry(178), { size: 'S', align: 'center', color: gTheme.textSecondary }, 'rmov')
  // actions
  drawCapsule(LW / 2 - 52, botY - ry(32), 48, 16, 'AGAIN', gTheme.textSecondary)
  drawCapsule(LW / 2 + 4, botY - ry(32), 48, 16, 'BACK', gTheme.text)
  drawRipples(t)
}
function updateSeq() {
  if (!gSeqPlay) return
  const stepDur = 60000 / (gSeqBpm * 2)
  const now = Date.now()
  if (now - gSeqT0 >= stepDur) {
    gSeqStep = (gSeqStep + 1) % 8
    gSeqT0 = now
    for (let r = 0; r < 8; r++) {
      if (gSeq[r][gSeqStep]) {
        playTone(SEQ_SCALE[r], stepDur * 0.9)
        vibe(SEQ_SCALE[r])
        gPulse = 1
      }
    }
  }
}
function render(t) {
  if (gScr === 'idle') drawIdle(t)
  else if (gScr === 'composer') drawComposer(t)
  else if (gScr === 'result') drawResult(t)
  else drawPlayer(t)
  drawToast(t)
  drawPixelRipples()
  drawPageTransition()
}

// ═══════════ engine ═══════════
function engine() {
  if (gSt === 'playing') {
    const data = SONGS[gSongIdx].data
    const now = Date.now()
    const dur = data[gNoteIdx].d / gBpm
    if (now - gNoteT0 >= dur) {
      gNoteIdx++; if (gNoteIdx >= data.length) gNoteIdx = 0
      const n = data[gNoteIdx]
      if (n.f >= 20) { playTone(n.f, n.d / gBpm); vibe(n.f) }
      gPulse = 1
      gNoteT0 = now
    }
  }
}
function loop(t) {
  if (gHidden) { gRafId = 0; return }   // hard stop when page is hidden (no in-flight refires)
  const now = Date.now()
  const dt = (gLastT > 0) ? (now - gLastT) : 16   // time-based decay, frame-rate independent
  gLastT = now
  engine()
  if (gScr === 'composer') updateSeq()
  updateSession()   // track live min/max bpm + maxShake (no-op when no session)
  if (gFlash > 0.01) gFlash = Math.max(0, gFlash - dt / 1000 * 6)   // press flash ~167ms
  if (gPulse > 0.01) gPulse = Math.max(0, gPulse * Math.pow(0.001, dt / 1000))
  if (gRipples.length > 12) gRipples.length = 12
  if (gPixelRipples.length > 24) gPixelRipples.length = 24
  cleanupFx()
  render(t || 0)
  if (cv) gRafId = cv.requestAnimationFrame(loop)
}

// ═══════════ init ═══════════
// read system theme once + listen for changes (fallback dark; no page reload)
function initTheme() {
  let isLight = false
  try {
    const sys = wx.getSystemInfoSync()
    isLight = !!(sys && sys.theme === 'light')
  } catch (e) { }
  gTheme = isLight ? THEME.light : THEME.dark
  try {
    wx.onThemeChange(function (res) {
      gTheme = (res && res.theme === 'light') ? THEME.light : THEME.dark
    })
  } catch (e) { }
}
function initCanvas() {
  const q = wx.createSelectorQuery()
  q.select('#screen').fields({ node: true, size: true }).exec(function (res) {
    if (!res || !res[0]) return
    const canvas = res[0].node
    canvas.width = Math.round(gCssW * gDpr)
    canvas.height = Math.round(gCssH * gDpr)
    ctx = canvas.getContext('2d')
    ctx.scale(gDpr * gS, gDpr * gS)   // 1 logical px = gS CSS px, rendered crisp at device DPR
    cv = canvas
    try {
      gLogo = canvas.createImage()
      gLogo.onload = function () { gLogoOk = true }
      gLogo.src = '/images/logo.png'
    } catch (e) { }
    cv.requestAnimationFrame(loop)
  })
}
function initOrientation() {
  try {
    wx.startDeviceMotionListening({ interval: 'game' })
    wx.onDeviceMotionChange(function (res) {
      let beta = res.beta
      if (beta > 90) beta = 90
      if (beta < -90) beta = -90
      const target = beta >= 0 ? Math.pow(2, beta / 22) : Math.pow(2, beta / 26)
      gBpm += (Math.max(0.1, Math.min(8, target)) - gBpm) * 0.25
    })
  } catch (e) { }
}
// shake → wider wave (mirrors firmware), NaN-safe so it can never break rendering
function initShake() {
  try {
    wx.startAccelerometer({ interval: 'game' })
    wx.onAccelerometerChange(function (res) {
      if (!res || isNaN(res.x) || isNaN(res.y) || isNaN(res.z)) return
      const mag = Math.sqrt(res.x * res.x + res.y * res.y + res.z * res.z)
      let s = Math.abs(mag - 9.8) / 9.8
      if (s < 0.08) s = 0
      s = Math.min(1, s * 4)   // aggressive gain, clamped 0..1
      gShake += (s - gShake) * 0.4
      if (gShake < 0.02) gShake = 0
    })
  } catch (e) { }
}

Page({
  data: { canvasW: 270, canvasH: 480, toast: '' },
  onLoad() {
    // ── Edge-to-Edge: canvas background = whole viewport; Safe Area only offsets UI content ──
    let win = null
    try { win = (typeof wx.getWindowInfo === 'function') ? wx.getWindowInfo() : wx.getSystemInfoSync() } catch (e) { win = null }
    if (!win) win = { windowWidth: 375, windowHeight: 667, pixelRatio: 2 }
    const sw = Math.max(1, win.windowWidth || 375)
    const sh = Math.max(1, win.windowHeight || 667)
    const dpr = win.pixelRatio || 2
    // safe-area insets (CSS px) — used only to offset UI elements, never to shrink the canvas
    let safeTop = 0, safeBottom = 0
    if (win.safeArea && win.safeArea.top != null) safeTop = win.safeArea.top
    else if (win.statusBarHeight) safeTop = win.statusBarHeight
    if (win.safeArea && win.safeArea.bottom != null) safeBottom = Math.max(0, sh - win.safeArea.bottom)
    gSafeTop = Math.max(4, safeTop + 4)      // status bar / Dynamic Island clearance
    gSafeBottom = Math.max(4, safeBottom + 4)  // Home Indicator clearance
    // right inset so no UI ever sits under the WeChat '…' capsule button (top-right)
    let safeRight = 106
    try {
      const mb = wx.getMenuButtonBoundingClientRect()
      if (mb && mb.left > 0) safeRight = sw - mb.left + 8
    } catch (e) { }
    gSafeRight = Math.max(80, safeRight)
    // logical resolution: LW baseline fixed, LH follows the FULL viewport aspect (edge-to-edge)
    LW = 135
    LH = Math.max(135, Math.round(LW * sh / sw))
    const s = sw / LW                         // equal scale X & Y → no distortion
    const cw = sw, ch = sh
    gCssW = cw; gCssH = ch; gS = s; gDpr = dpr
    this.setData({ canvasW: cw, canvasH: ch })
    this._cw = cw
    this._ch = ch
    // enable share (top-right ··· menu) — growth hook for personal devs
    try { wx.showShareMenu({ withShareTicket: true }) } catch (e) { }
    initTheme()
    initShake()
    // seed page-transition tracker (no boot flash; transitions fire only on real navigation)
    gFx.page = { val: 'idle', t0: Date.now(), done: true }
    gLastT = 0
    initCanvas()
  },
  onShareAppMessage() {
    // share card copy adapts to current screen
    const title = gScr === 'composer'
      ? '我在 SONA™ 创作了一段旋律，来听听'
      : gScr === 'player'
        ? 'SONA™ · ' + SONGS[gSongIdx].title + ' 正在震动，来听听'
        : 'SONA™ 律动音乐 · 点一下就会震动的歌'
    return {
      title: title,
      path: '/pages/index/index',
      imageUrl: '/images/logo.png'
    }
  },
  onUnload() { try { if (actx) actx.close() } catch (e) { } endSession() },
  // page hidden → hard-stop the rAF loop + suspend audio (no background timers / rendering)
  onHide() {
    gHidden = true
    if (cv && gRafId && cv.cancelAnimationFrame) { try { cv.cancelAnimationFrame(gRafId) } catch (e) { } }
    gRafId = 0; gLastT = 0
    gPress = null; gFlash = 0
    gRipples.length = 0; gPixelRipples.length = 0
    try { if (actx) actx.suspend() } catch (e) { }
  },
  // page re-shown → rebuild the animation loop; resume audio only if it was playing
  onShow() {
    gHidden = false
    if (cv && !gRafId) { try { gRafId = cv.requestAnimationFrame(loop) } catch (e) { } }
    if (gSt === 'playing') { try { if (actx) actx.resume() } catch (e) { } }
  },
  onTouchStart(e) {
    const p = e.touches && e.touches[0]; if (!p) return
    const cw = this._cw || 270
    const ch = this._ch || 480
    this._x = p.x * LW / cw; this._y = p.y * LH / ch
    this._t0 = Date.now()
    gRipples.push({ x: this._x, y: this._y, t0: this._t0 })
    // press feedback: mark pressed point + accent flash + pixel ripple
    gPress = { x: this._x, y: this._y }
    gFlash = 1
    gPixelRipples.push({ x: this._x, y: this._y, t0: Date.now() })
  },
  onTouchEnd(e) {
    const now = Date.now()
    const held = now - (this._t0 || now)
    gPress = null; gFlash = 0   // release press feedback before running the action
    const end = e.changedTouches && e.changedTouches[0]
    const cw = this._cw || 270
    const dx = (end ? end.x * LW / cw : 0) - (this._x || 0)
    // ── result interactions ──
    if (gScr === 'result') {
      const x = this._x || 0, y = this._y || 0
      if (y > LH - safeBottomY() - ry(34) && y < LH - safeBottomY() - ry(14)) {
        if (x > LW / 2 - 54 && x < LW / 2 - 2) { haptic('light'); playAgain(); return }
        if (x > LW / 2 + 2 && x < LW / 2 + 54) { haptic('light'); resultBack(); return }
      }
      return
    }
    // ── composer interactions ──
    if (gScr === 'composer') {
      const x = this._x || 0, y = this._y || 0
      // back (bottom-left) → previous screen
      if (y > LH - safeBottomY() - ry(17) && x < 42) { haptic('light'); if (gPrev === 'player') { gScr = 'player'; gSt = 'stopped' } else backToIdle(); return }
      // top controls
      if (y < safeTopY() + ry(17)) {
        if (x < 50) { haptic('light'); gSeqBpm = (gSeqBpm + 20 > 180) ? 100 : gSeqBpm + 20; return }
        if (x > LW / 2 - 25 && x < LW / 2 + 25) {
          haptic('light')
          gSeqPlay = !gSeqPlay
          if (gSeqPlay) { gSeqStep = 0; gSeqT0 = Date.now(); ensureAudio() }
          else stopAudio()
          return
        }
        if (x > LW - safeRightX() - 30) { haptic('light'); for (let r = 0; r < 8; r++) gSeq[r].fill(false); return }
        return
      }
      // grid tap
      if (y >= safeTopY() + ry(20) && y < safeTopY() + ry(20) + 8 * 25 && x >= 12) {
        const s = Math.min(7, Math.floor((x - 12) / 14))
        const r = Math.min(7, Math.floor((y - safeTopY() - ry(20)) / 25))
        haptic('light')
        gSeq[r][s] = !gSeq[r][s]
        if (gSeq[r][s]) { playTone(SEQ_SCALE[r], 200); vibe(SEQ_SCALE[r]) }
      }
      return
    }
    // ── player: back button (top-left, big tap target) ──
    if (gScr === 'player' && (this._x || 0) < 52 && (this._y || 0) < safeTopY() + ry(22)) {
      haptic('light'); backToIdle(); return
    }
    // swipe → next song
    if (gScr === 'player' && held < 400 && Math.abs(dx) > 25) {
      haptic('light')
      gSongIdx = (gSongIdx + 1) % SONGS.length   // new song revealed by the title pixel-wipe
      if (gSt === 'playing') startSong(gSongIdx)
      return
    }
    // ── player bottom controls (hit areas derived from the same safe-area rects) ──
    if (gScr === 'player') {
      const ca = composeArea()
      const va = vibArea()
      // vibrator label (pixel text above COMPOSE) toggle — feedback via green indicator, no toast
      if ((this._y || 0) > va.y - 4 && (this._y || 0) < va.y + va.h + 4 &&
          (this._x || 0) > va.x - 6 && (this._x || 0) < va.x + va.w + 6) {
        gVibOn = !gVibOn; haptic('medium')
        return
      }
      // compose entry (bottom-centre capsule)
      if ((this._y || 0) > ca.y - 4 && (this._y || 0) < ca.y + ca.h + 4 &&
          (this._x || 0) > ca.x - 6 && (this._x || 0) < ca.x + ca.w + 6) {
        haptic('medium'); enterComposer(); return
      }
    }
    // long press → back to idle
    if (gScr === 'player' && held > 500) { haptic('light'); backToIdle(); return }
    // double tap → toggle vibrator (feedback via the green status indicator, no text toast)
    if (this._lastUp && now - this._lastUp < 350) {
      if (gScr === 'player') { gVibOn = !gVibOn; haptic('medium') }
      this._lastUp = 0; return
    }
    this._lastUp = now
    if (gScr === 'idle') {
      // easter egg: tap the logo 5 times → rainbow mode
      if ((this._y || 0) > ry(70) && (this._y || 0) < ry(172) && (this._x || 0) > 20 && (this._x || 0) < 115) {
        gLogoHits++; haptic('light')
        if (gLogoHits >= 5) {
          gLogoHits = 0; gRainbow = true
          this.toast('Rainbow mode ON!')
        }
        return
      }
      gScr = 'player'; gSt = 'stopped'; gSongIdx = 0; gNoteIdx = 0; gBpm = 1.0; gVibOn = true
      haptic('medium')
      initOrientation()
    } else {
      haptic('light')
      if (gSt === 'stopped') { startSong(gSongIdx); startSession(); gToast = null }   // start playing → open session + hide hint
      else if (gSt === 'playing') { gSt = 'paused'; stopAudio() }
      else { gSt = 'playing'; gNoteT0 = Date.now() }
    }
  },
  toast(m) {
    gToast = { text: m, t0: Date.now() }
  }
})
