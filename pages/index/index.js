// ═══════════════════════════════════════════════════
//  SONA™ – 微信小程序版
//  移植自 web_app/index.html（canvas 2D + WebAudioContext）
//  · 3 首旋律（WebAudioContext oscillator，实验性 API）
//  · 点阵波形 + 粒子动画
//  · 倾斜 → BPM（wx.onDeviceMotionChange）
//  · 震动跟随律动（wx.vibrateShort，真机生效）
// ═══════════════════════════════════════════════════
const LW = 135, LH = 240

// ── palette ──
const C_BLACK = '#000', C_WHITE = '#fff', C_MAIN = '#5acbff', C_MAIN_LT = '#8edbff',
      C_MAIN_DK = '#3a9bd0', C_DIM = '#6b6d', C_MUTED = '#adf7', C_GREEN = '#07e0'

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
  '<': '000010111010000', ' ': '000000000000000'
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
    setTimeout(function () { try { osc.stop() } catch (e) { } }, durMs + 30)
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
function backToIdle() { gSt = 'stopped'; gScr = 'idle'; gBpm = 1.0; stopAudio() }

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
function drawIdle(t) {
  ctx.fillStyle = '#04070b'; ctx.fillRect(0, 0, LW, LH)
  // drifting dust upward
  for (let i = 0; i < 12; i++) {
    const yy = LH - ((t * 0.02 + i * 20) % (LH + 30))
    const xx = LW / 2 + Math.sin(t * 0.001 + i * 1.7) * 60
    ctx.fillStyle = (i % 3 === 0) ? '#1d5f86' : '#0d2533'
    ctx.fillRect(xx | 0, yy | 0, 1, 1)
  }
  if (gLogoOk && gLogo) {
    const ar = gLogo.width / Math.max(1, gLogo.height)
    let lw = 88, lh = lw / ar
    ctx.drawImage(gLogo, (LW - lw) / 2, 96 - lh / 2, lw, lh)
  } else {
    drawPixText((LW - pixWidth('SONA', 4)) / 2, 100 - 10, 4, '#fff', 'SONA')
  }
  const a = 0.5 + 0.5 * Math.sin(t * 0.003)
  ctx.globalAlpha = 0.28 + 0.42 * a
  drawPixText((LW - pixWidth('Tap to start', 1)) / 2, 210, 1, '#7d8d99', 'Tap to start')
  ctx.globalAlpha = 1
  // create entry (top-right)
  drawCapsule(LW - 3 - 42, 3, 42, 14, 'CREATE', '#fff')
  drawRipples(t)
}
function drawAurora(t) {
  const cx = LW / 2
  const flow = t * 0.004 * gBpm
  const amp = 12 + gPulse * 6 + gShake * 16
  const breathe = 0.75 + 0.25 * Math.sin(t * 0.003 * gBpm)
  const rainbowHue = gRainbow ? ((t * 0.05) % 360) : -1
  for (let li = 0; li < 3; li++) {
    const phase = flow + li * 2.1
    let col = (li === 1) ? C_WHITE : C_DIM
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
    const py = (i * 4) % LH
    let pcol = (i % 4 === 0) ? C_WHITE : C_MAIN_DK
    if (rainbowHue >= 0) pcol = 'hsl(' + ((rainbowHue + i * 12) % 360) + ',85%,65%)'
    ctx.fillStyle = pcol
    ctx.fillRect(px | 0, py, 1, 1)
  }
  ctx.fillStyle = '#18364e'; ctx.fillRect(cx, 4, 1, LH - 8)
}
function drawCapsule(cx, cy, w, h, text, color) {
  ctx.fillStyle = 'rgba(90,203,255,0.18)'
  roundRectPath(cx, cy, w, h, h / 2); ctx.fill()
  ctx.strokeStyle = C_MAIN; ctx.lineWidth = 1
  roundRectPath(cx, cy, w, h, h / 2); ctx.stroke()
  drawPixText((cx + w - pixWidth(text, 1)) / 2, cy + (h - 5) / 2, 1, color, text)
}
function drawHUD(t) {
  // back: pixel '<' icon in a small pill (no text) — tap to go home
  drawCapsule(3, 3, 22, 14, '<', C_WHITE)
  // speed: pixel text top-right (no pill)
  drawPixText(LW - 3 - pixWidth('x' + gBpm.toFixed(1), 1), 4, 1, C_MAIN_LT, 'x' + gBpm.toFixed(1))
  // song title (uppercase pixel)
  drawPixText((LW - pixWidth(SONGS[gSongIdx].title, 1)) / 2, 3, 1, C_MUTED, SONGS[gSongIdx].title)
  // play/pause dot
  ctx.fillStyle = gSt === 'playing' ? C_GREEN : C_DIM
  ctx.beginPath(); ctx.arc(LW - 7, LH - 8, 2, 0, Math.PI * 2); ctx.fill()
  // breathing halo on the play dot
  if (gSt === 'playing') {
    const p = 0.5 + 0.5 * Math.sin(t * 0.005)
    ctx.strokeStyle = 'rgba(7,224,0,' + (0.4 * p).toFixed(2) + ')'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(LW - 7, LH - 8, 2 + 2 * p, 0, Math.PI * 2); ctx.stroke()
  }
  // vibrator status: pixel text bottom-centre (no pill)
  const vibTxt = gVibOn ? 'VIB ON' : 'VIB OFF'
  drawPixText((LW - pixWidth(vibTxt, 1)) / 2, LH - 12, 1, gVibOn ? C_GREEN : C_DIM, vibTxt)
  if (gSt !== 'playing') drawPixText((LW - pixWidth('Tap to play', 1)) / 2, LH / 2 + 40, 1, C_MAIN, 'Tap to play')
}
// touch ripple effect (expanding fading ring)
function drawRipples(t) {
  if (!gRipples.length) return
  for (let i = gRipples.length - 1; i >= 0; i--) {
    const rp = gRipples[i]
    const age = (t - rp.t0) / 300
    if (age >= 1) { gRipples.splice(i, 1); continue }
    const rad = 5 + age * 20
    ctx.strokeStyle = 'rgba(90,203,255,' + (0.5 * (1 - age)).toFixed(2) + ')'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(rp.x, rp.y, rad, 0, Math.PI * 2); ctx.stroke()
  }
}
function drawPlayer(t) { ctx.clearRect(0, 0, LW, LH); drawAurora(t); drawHUD(t); drawRipples(t) }
// ═══════════ composer (step sequencer) ═══════════
function enterComposer() {
  gScr = 'composer'
  gSeqPlay = false; gSeqStep = 0
  stopAudio()
}
function drawComposer(t) {
  ctx.fillStyle = '#04070b'; ctx.fillRect(0, 0, LW, LH)
  // top controls (pixel text in pills)
  drawCapsule(3, 3, 44, 14, 'BPM ' + gSeqBpm, '#fff')
  drawCapsule(LW / 2 - 22, 3, 44, 14, gSeqPlay ? 'STOP' : 'PLAY', '#fff')
  drawCapsule(LW - 3 - 42, 3, 42, 14, 'CLEAR', '#fff')
  // grid
  const gx = 26, gy = 32, cw = (LW - 26) / 8, ch = 22
  for (let r = 0; r < 8; r++) {
    drawPixText(2, gy + r * ch + 8, 1, '#7d8d99', SEQ_NOTES[r])
    for (let s = 0; s < 8; s++) {
      const x = gx + s * cw, y = gy + r * ch
      const on = gSeq[r][s]
      const isStep = gSeqPlay && s === gSeqStep
      ctx.fillStyle = on ? (isStep ? C_MAIN_LT : C_MAIN) : (isStep ? '#1a4a63' : '#0d1a24')
      ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2)
      ctx.strokeStyle = '#16405c'; ctx.lineWidth = 0.5
      ctx.strokeRect(x + 1, y + 1, cw - 2, ch - 2)
    }
  }
  // bottom: back pill (pixel <) + hint
  drawCapsule(3, LH - 17, 22, 14, '<', '#fff')
  drawPixText(LW - 4 - pixWidth('TAP GRID TO COMPOSE', 1), LH - 12, 1, C_DIM, 'TAP GRID TO COMPOSE')
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
  else drawPlayer(t)
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
  engine()
  if (gScr === 'composer') updateSeq()
  if (gPulse > 0.01) gPulse *= 0.88
  render(t || 0)
  if (cv) cv.requestAnimationFrame(loop)
}

// ═══════════ init ═══════════
function initCanvas() {
  const q = wx.createSelectorQuery()
  q.select('#screen').fields({ node: true, size: true }).exec(function (res) {
    if (!res || !res[0]) return
    const canvas = res[0].node
    canvas.width = LW * 2
    canvas.height = LH * 2
    ctx = canvas.getContext('2d')
    ctx.scale(2, 2)
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
    // fit canvas to the actual screen (keep 135:240 aspect)
    const sys = wx.getSystemInfoSync()
    const pad = 12
    const availW = sys.windowWidth - pad * 2
    const availH = sys.windowHeight - pad * 2 - 40
    const scale = Math.min(availW / LW, availH / LH)
    const cw = Math.max(200, Math.floor(LW * scale))
    const ch = Math.max(360, Math.floor(LH * scale))
    this.setData({ canvasW: cw, canvasH: ch })
    this._cw = cw
    this._ch = ch
    // enable share (top-right ··· menu) — growth hook for personal devs
    try { wx.showShareMenu({ withShareTicket: true }) } catch (e) { }
    initShake()
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
  onUnload() { try { if (actx) actx.close() } catch (e) { } },
  onTouchStart(e) {
    const p = e.touches && e.touches[0]; if (!p) return
    const cw = this._cw || 270
    const ch = this._ch || 480
    this._x = p.x * LW / cw; this._y = p.y * LH / ch
    this._t0 = Date.now()
    gRipples.push({ x: this._x, y: this._y, t0: this._t0 })
  },
  onTouchEnd(e) {
    const now = Date.now()
    const held = now - (this._t0 || now)
    const end = e.changedTouches && e.changedTouches[0]
    const cw = this._cw || 270
    const dx = (end ? end.x * LW / cw : 0) - (this._x || 0)
    // ── composer interactions ──
    if (gScr === 'composer') {
      const x = this._x || 0, y = this._y || 0
      // back (bottom-left)
      if (y > LH - 17 && x < 42) { haptic('light'); backToIdle(); return }
      // top controls
      if (y < 17) {
        if (x < 50) { haptic('light'); gSeqBpm = (gSeqBpm + 20 > 180) ? 100 : gSeqBpm + 20; return }
        if (x > LW / 2 - 25 && x < LW / 2 + 25) {
          haptic('light')
          gSeqPlay = !gSeqPlay
          if (gSeqPlay) { gSeqStep = 0; gSeqT0 = Date.now(); ensureAudio() }
          else stopAudio()
          return
        }
        if (x > LW - 45) { haptic('light'); for (let r = 0; r < 8; r++) gSeq[r].fill(false); return }
        return
      }
      // grid tap
      if (y >= 32 && y < 32 + 8 * 22 && x >= 26) {
        const s = Math.min(7, Math.floor((x - 26) / ((LW - 26) / 8)))
        const r = Math.min(7, Math.floor((y - 32) / 22))
        haptic('light')
        gSeq[r][s] = !gSeq[r][s]
        if (gSeq[r][s]) { playTone(SEQ_SCALE[r], 200); vibe(SEQ_SCALE[r]) }
      }
      return
    }
    // ── player: back button (top-left, big tap target) ──
    if (gScr === 'player' && (this._x || 0) < 52 && (this._y || 0) < 22) {
      haptic('light'); backToIdle(); return
    }
    // swipe → next song
    if (gScr === 'player' && held < 400 && Math.abs(dx) > 25) {
      haptic('light')
      gSongIdx = (gSongIdx + 1) % SONGS.length
      this.toast('Track → ' + SONGS[gSongIdx].title)
      if (gSt === 'playing') startSong(gSongIdx)
      return
    }
    // ── vibrator status (bottom-centre pixel text) toggle ──
    if (gScr === 'player' && (this._y || 0) > LH - 16 && (this._y || 0) < LH - 2 &&
        (this._x || 0) > (LW - 40) / 2 && (this._x || 0) < (LW + 40) / 2) {
      gVibOn = !gVibOn; haptic('medium')
      this.toast(gVibOn ? 'Vib ON' : 'Vib OFF')
      return
    }
    // long press → back to idle
    if (gScr === 'player' && held > 500) { haptic('light'); backToIdle(); return }
    // double tap → toggle vibrator
    if (this._lastUp && now - this._lastUp < 350) {
      if (gScr === 'player') { gVibOn = !gVibOn; haptic('medium'); this.toast(gVibOn ? 'Vib ON' : 'Vib OFF') }
      this._lastUp = 0; return
    }
    this._lastUp = now
    if (gScr === 'idle') {
      // CREATE entry (top-right) → composer
      if ((this._x || 0) > LW - 3 - 45 && (this._y || 0) < 17) { haptic('light'); enterComposer(); return }
      // easter egg: tap the logo 5 times → rainbow mode
      if ((this._y || 0) > 55 && (this._y || 0) < 130 && (this._x || 0) > 20 && (this._x || 0) < 115) {
        gLogoHits++; haptic('light')
        if (gLogoHits >= 5) {
          gLogoHits = 0; gRainbow = true
          this.toast('Rainbow mode ON!')
        }
        return
      }
      gScr = 'player'; gSt = 'stopped'; gSongIdx = 0; gNoteIdx = 0; gBpm = 1.0; gVibOn = true
      haptic('medium')
      this.toast('Double-tap to toggle vib')
      initOrientation()
    } else {
      haptic('light')
      if (gSt === 'stopped') startSong(gSongIdx)
      else if (gSt === 'playing') { gSt = 'paused'; stopAudio() }
      else { gSt = 'playing'; gNoteT0 = Date.now() }
    }
  },
  toast(m) {
    this.setData({ toast: m })
    clearTimeout(this._toastT)
    this._toastT = setTimeout(function () { this.setData({ toast: '' }) }.bind(this), 1400)
  }
})
