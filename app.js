/* Snap Mockup – all logik för appen.
   Allt ritas på en <canvas> i full upplösning, och samma ritfunktion
   används när bilden sparas. */
(() => {
  'use strict';

  // ---------- Grundinställningar ----------
  const FORMATS = {
    iphone:  { w: 1179, h: 2556, topInset: 150, bottomInset: 80 },
    classic: { w: 1080, h: 1920, topInset: 70,  bottomInset: 30 },
  };
  const FONT = '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
  const STORE_KEY = 'snapmockup.v1';

  const $ = (s) => document.querySelector(s);
  const canvas = $('#canvas');
  const ctx = canvas.getContext('2d');
  const frame = $('#frame');
  const stage = $('#stage');
  const hint = $('#hint');

  let uid = 1;
  const newBar = (text = '', y = 0.62) => ({ id: uid++, text, y });

  const defaults = () => ({
    format: 'iphone',
    bars: [newBar('Skriv din text här', 0.62)],
    textSize: 46,
    sender: { name: 'Alex', time: '2 min', color: '#f7c948', avatar: null },
    ui: {
      status: true, clock: '14:32', battery: 78,
      top: true, bottom: true,
      placeholder: 'Skicka ett chattmeddelande',
    },
  });

  let state = defaults();
  let tab = 'image';
  let menuOpen = true;
  let selectedBarId = state.bars[0] ? state.bars[0].id : null;

  let img = null;            // uppladdad bild
  let imgT = null;           // { x, y, s, r } – mittpunkt, skala, rotation (radianer)
  let avatarImg = null;

  // ---------- Spara/läsa inställningar lokalt ----------
  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) { /* t.ex. privat läge – ignorera */ }
  }
  function restore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      const d = defaults();
      state = {
        ...d, ...s,
        sender: { ...d.sender, ...(s.sender || {}) },
        ui: { ...d.ui, ...(s.ui || {}) },
        bars: Array.isArray(s.bars) ? s.bars.map(b => ({ id: uid++, text: String(b.text || ''), y: +b.y || 0.5 })) : d.bars,
      };
      if (!FORMATS[state.format]) state.format = 'iphone';
      selectedBarId = state.bars[0] ? state.bars[0].id : null;
      if (state.sender.avatar) {
        const a = new Image();
        a.onload = () => { avatarImg = a; drawAvatarPreview(); requestDraw(); };
        a.src = state.sender.avatar;
      }
    } catch (e) { /* trasig data – kör med standardvärden */ }
  }

  // ---------- Storlek ----------
  const F = () => FORMATS[state.format];

  function setupCanvasSize() {
    const { w, h } = F();
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    layoutFrame();
  }

  function layoutFrame() {
    const { w, h } = F();
    const sw = stage.clientWidth - 32;
    const sh = stage.clientHeight - 20;
    if (sw <= 0 || sh <= 0) return;
    const scale = Math.min(sw / w, sh / h);
    frame.style.width = Math.floor(w * scale) + 'px';
    frame.style.height = Math.floor(h * scale) + 'px';
  }

  // ---------- Rita ----------
  let drawQueued = false;
  function requestDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => { drawQueued = false; render(ctx, false); });
  }

  function render(c, forExport) {
    const { w: W, h: H } = F();
    const u = W / 1080; // grundenhet så att allt skalar med bredden
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);

    // Bild
    if (img && imgT) {
      c.save();
      c.translate(imgT.x, imgT.y);
      c.rotate(imgT.r);
      c.scale(imgT.s, imgT.s);
      c.imageSmoothingQuality = 'high';
      c.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      c.restore();
    } else if (!forExport) {
      c.fillStyle = '#1a1a1e';
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#8b8b95';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = `600 ${56 * u}px ${FONT}`;
      c.fillText('Tryck här för att', W / 2, H / 2 - 40 * u);
      c.fillText('välja en bild', W / 2, H / 2 + 40 * u);
    }

    // Textrader
    drawBars(c, W, H, u, forExport);

    // Gränssnitt (ovanpå)
    const topY = drawStatusBar(c, W, H, u);
    if (state.ui.top) drawHeader(c, W, H, u, topY);
    if (state.ui.bottom) drawFooter(c, W, H, u);

    c.restore();
  }

  function wrapLines(c, text, maxW) {
    const out = [];
    const paragraphs = String(text).split('\n');
    for (const p of paragraphs) {
      const words = p.split(/ +/);
      let line = '';
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (c.measureText(test).width <= maxW || !line) {
          // ett enda väldigt långt ord – bryt på tecken
          if (!line && c.measureText(word).width > maxW) {
            let chunk = '';
            for (const ch of word) {
              if (c.measureText(chunk + ch).width > maxW && chunk) { out.push(chunk); chunk = ch; }
              else chunk += ch;
            }
            line = chunk;
          } else line = test;
        } else {
          out.push(line);
          line = word;
        }
      }
      out.push(line);
    }
    return out;
  }

  function drawBars(c, W, H, u, forExport) {
    const size = state.textSize * u;
    const lh = size * 1.28;
    const padY = size * 0.42;
    c.font = `500 ${size}px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const bar of state.bars) {
      const text = bar.text.trim() ? bar.text : (forExport ? '' : ' ');
      if (!bar.text.trim() && forExport) { bar._box = null; continue; }
      const lines = wrapLines(c, text, W - 80 * u);
      const bh = lines.length * lh + padY * 2;
      const cy = bar.y * H;
      const top = cy - bh / 2;
      bar._box = { top, bottom: top + bh };

      c.fillStyle = 'rgba(0,0,0,0.58)';
      c.fillRect(0, top, W, bh);
      c.fillStyle = '#fff';
      lines.forEach((ln, i) => {
        c.fillText(ln, W / 2, top + padY + lh * i + lh / 2 + size * 0.03);
      });

      if (!forExport && menuOpen && tab === 'text' && bar.id === selectedBarId) {
        c.save();
        c.strokeStyle = 'rgba(255,252,0,0.9)';
        c.lineWidth = 4 * u;
        c.setLineDash([16 * u, 12 * u]);
        c.strokeRect(2 * u, top + 2 * u, W - 4 * u, bh - 4 * u);
        c.restore();
      }
    }
  }

  // Statusfält: klocka, mottagning, wifi, batteri. Returnerar y där headern börjar.
  function drawStatusBar(c, W, H, u) {
    const f = F();
    const inset = f.topInset * u;
    if (!state.ui.status) return inset;
    const cy = state.format === 'iphone' ? inset * 0.45 : inset * 0.55;
    c.save();
    c.fillStyle = '#fff';
    c.shadowColor = 'rgba(0,0,0,0.35)';
    c.shadowBlur = 6 * u;
    c.textBaseline = 'middle';
    c.textAlign = 'center';
    c.font = `600 ${(state.format === 'iphone' ? 50 : 40) * u}px ${FONT}`;
    c.fillText(state.ui.clock || '', state.format === 'iphone' ? 170 * u : 110 * u, cy);

    // Höger sida, ritas från höger till vänster
    let x = W - (state.format === 'iphone' ? 80 : 50) * u;
    const k = state.format === 'iphone' ? 1 : 0.85;
    // Batteri
    const bw = 70 * u * k, bh = 34 * u * k;
    const bx = x - bw, by = cy - bh / 2;
    c.shadowBlur = 0;
    c.globalAlpha = 0.45;
    roundRect(c, bx, by, bw, bh, 9 * u * k); c.fill();
    c.globalAlpha = 1;
    roundRect(c, bx + bw + 3 * u, cy - 7 * u * k, 5 * u * k, 14 * u * k, 2 * u); c.globalAlpha = 0.45; c.fill(); c.globalAlpha = 1;
    const pct = Math.max(1, Math.min(100, +state.ui.battery || 0)) / 100;
    c.save();
    roundRect(c, bx, by, bw, bh, 9 * u * k); c.clip();
    c.fillStyle = pct <= 0.2 ? '#ff3b30' : '#fff';
    c.fillRect(bx, by, bw * pct, bh);
    c.restore();
    x = bx - 22 * u * k;

    // Wifi
    c.strokeStyle = '#fff';
    c.lineCap = 'round';
    c.lineWidth = 7 * u * k;
    const wx = x - 26 * u * k, wy = cy + 16 * u * k;
    for (let i = 0; i < 3; i++) {
      const r = (12 + i * 13) * u * k;
      c.beginPath();
      if (i === 0) { c.arc(wx, wy - 2 * u, 6 * u * k, 0, Math.PI * 2); c.fill(); continue; }
      c.arc(wx, wy, r, -Math.PI * 0.75, -Math.PI * 0.25);
      c.stroke();
    }
    x = wx - 50 * u * k;

    // Mottagning (4 staplar)
    const sw = 9 * u * k, gap = 5 * u * k;
    for (let i = 0; i < 4; i++) {
      const sh = (12 + i * 7) * u * k;
      const sx = x - (4 - i) * (sw + gap);
      roundRect(c, sx, cy + 17 * u * k - sh, sw, sh, 2.5 * u); c.fill();
    }
    c.restore();
    return inset;
  }

  function drawHeader(c, W, H, u, topY) {
    const y0 = topY + 10 * u;
    // svag mörk toning för läsbarhet
    const g = c.createLinearGradient(0, 0, 0, y0 + 220 * u);
    g.addColorStop(0, 'rgba(0,0,0,0.38)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, y0 + 220 * u);

    const d = 104 * u;
    const ax = 36 * u, ay = y0;
    drawAvatar(c, ax, ay, d);

    c.save();
    c.fillStyle = '#fff';
    c.shadowColor = 'rgba(0,0,0,0.45)';
    c.shadowBlur = 8 * u;
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    const tx = ax + d + 26 * u;
    c.font = `700 ${44 * u}px ${FONT}`;
    const maxW = W - tx - 140 * u;
    c.fillText(ellipsis(c, state.sender.name || '', maxW), tx, ay + d * 0.47);
    c.font = `500 ${33 * u}px ${FONT}`;
    c.globalAlpha = 0.9;
    c.fillText(ellipsis(c, state.sender.time || '', maxW), tx, ay + d * 0.47 + 46 * u);
    c.globalAlpha = 1;

    // tre prickar uppe till höger
    const dx = W - 70 * u, dy = ay + d / 2;
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      c.arc(dx + i * 20 * u, dy, 6.5 * u, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  function drawAvatar(c, x, y, d) {
    c.save();
    c.beginPath();
    c.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
    c.closePath();
    c.fillStyle = state.sender.color || '#f7c948';
    c.fill();
    c.clip();
    if (avatarImg) {
      const s = Math.max(d / avatarImg.naturalWidth, d / avatarImg.naturalHeight);
      const iw = avatarImg.naturalWidth * s, ih = avatarImg.naturalHeight * s;
      c.drawImage(avatarImg, x + (d - iw) / 2, y + (d - ih) / 2, iw, ih);
    } else {
      const initial = (state.sender.name || '?').trim().charAt(0).toUpperCase() || '?';
      c.fillStyle = readableOn(state.sender.color);
      c.font = `700 ${d * 0.46}px ${FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(initial, x + d / 2, y + d / 2 + d * 0.03);
    }
    c.restore();
  }

  function drawFooter(c, W, H, u) {
    const f = F();
    const rowH = 108 * u;
    const y = H - f.bottomInset * u - rowH - 20 * u;

    const g = c.createLinearGradient(0, y - 160 * u, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    c.fillStyle = g;
    c.fillRect(0, y - 160 * u, W, H - (y - 160 * u));

    c.save();
    // Kameraknapp
    const cx = 36 * u + rowH / 2, cy = y + rowH / 2;
    c.fillStyle = 'rgba(40,40,44,0.55)';
    c.beginPath(); c.arc(cx, cy, rowH / 2, 0, Math.PI * 2); c.fill();
    drawCameraIcon(c, cx, cy, 30 * u);

    // Textfält
    const px = 36 * u + rowH + 18 * u;
    const pw = W - px - 36 * u;
    c.fillStyle = 'rgba(40,40,44,0.55)';
    roundRect(c, px, y, pw, rowH, rowH / 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.font = `500 ${36 * u}px ${FONT}`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(ellipsis(c, state.ui.placeholder || '', pw - 200 * u), px + 40 * u, cy + 1 * u);

    // Ikoner i textfältet (smiley + klistermärke)
    drawSmiley(c, px + pw - 130 * u, cy, 24 * u);
    drawSticker(c, px + pw - 60 * u, cy, 24 * u);
    c.restore();
  }

  function drawCameraIcon(c, x, y, s) {
    c.save();
    c.strokeStyle = '#fff';
    c.lineWidth = s * 0.16;
    c.lineJoin = 'round';
    const w = s * 2, h = s * 1.5;
    roundRect(c, x - w / 2, y - h / 2 + s * 0.12, w, h, s * 0.3); c.stroke();
    c.beginPath(); c.moveTo(x - s * 0.4, y - h / 2 + s * 0.12); c.lineTo(x - s * 0.25, y - h / 2 - s * 0.15);
    c.lineTo(x + s * 0.25, y - h / 2 - s * 0.15); c.lineTo(x + s * 0.4, y - h / 2 + s * 0.12); c.stroke();
    c.beginPath(); c.arc(x, y + s * 0.15, s * 0.42, 0, Math.PI * 2); c.stroke();
    c.restore();
  }

  function drawSmiley(c, x, y, r) {
    c.save();
    c.strokeStyle = '#fff';
    c.fillStyle = '#fff';
    c.lineWidth = r * 0.16;
    c.lineCap = 'round';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(x - r * 0.35, y - r * 0.25, r * 0.12, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + r * 0.35, y - r * 0.25, r * 0.12, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x, y + r * 0.05, r * 0.5, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
    c.restore();
  }

  function drawSticker(c, x, y, r) {
    c.save();
    c.strokeStyle = '#fff';
    c.lineWidth = r * 0.16;
    c.lineJoin = 'round';
    const s = r;
    c.beginPath();
    c.moveTo(x - s, y - s + s * 0.3);
    c.quadraticCurveTo(x - s, y - s, x - s + s * 0.3, y - s);
    c.lineTo(x + s - s * 0.3, y - s);
    c.quadraticCurveTo(x + s, y - s, x + s, y - s + s * 0.3);
    c.lineTo(x + s, y + s * 0.15);
    c.lineTo(x + s * 0.15, y + s);
    c.lineTo(x - s + s * 0.3, y + s);
    c.quadraticCurveTo(x - s, y + s, x - s, y + s - s * 0.3);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.moveTo(x + s, y + s * 0.15);
    c.lineTo(x + s * 0.3, y + s * 0.15);
    c.quadraticCurveTo(x + s * 0.15, y + s * 0.15, x + s * 0.15, y + s * 0.3);
    c.lineTo(x + s * 0.15, y + s);
    c.stroke();
    c.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function ellipsis(c, text, maxW) {
    if (c.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && c.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  function readableOn(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#111';
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111' : '#fff';
  }

  // ---------- Bild: placering ----------
  function fitImage(mode) {
    if (!img) return;
    const { w: W, h: H } = F();
    const iw = img.naturalWidth, ih = img.naturalHeight;
    // ta hänsyn till nuvarande rotation om den är 90/270 grader
    const r = imgT ? imgT.r : 0;
    const cos = Math.abs(Math.cos(r)), sin = Math.abs(Math.sin(r));
    const bw = iw * cos + ih * sin, bh = iw * sin + ih * cos;
    const s = mode === 'contain' ? Math.min(W / bw, H / bh) : Math.max(W / bw, H / bh);
    imgT = { x: W / 2, y: H / 2, s, r };
    requestDraw();
  }

  function loadImageFile(file, cb) {
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      alert('Filen verkar inte vara en bild. Välj en JPG, PNG eller HEIC.');
      return;
    }
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => cb(im, url);
    im.onerror = () => { URL.revokeObjectURL(url); alert('Kunde inte läsa bilden. Prova en annan bild (JPG eller PNG).'); };
    im.src = url;
  }

  // ---------- Pekgester ----------
  const pointers = new Map();
  let gesture = null;
  let tapCandidate = null;

  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    const { w: W, h: H } = F();
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top) * (H / rect.height),
      cx: e.clientX, cy: e.clientY,
    };
  }

  function barAt(p) {
    // sök uppifrån (sist ritad = överst)
    for (let i = state.bars.length - 1; i >= 0; i--) {
      const b = state.bars[i];
      if (b._box && p.y >= b._box.top - 20 && p.y <= b._box.bottom + 20) return b;
    }
    return null;
  }

  function beginGesture() {
    const pts = [...pointers.values()];
    gesture = null;
    if (!pts.length) return;
    if (tab === 'image' && img && imgT) {
      if (pts.length === 1) {
        gesture = { type: 'pan', p0: pts[0], t0: { ...imgT } };
      } else {
        const [a, b] = pts;
        gesture = {
          type: 'pinch', t0: { ...imgT },
          m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          d0: Math.hypot(b.x - a.x, b.y - a.y) || 1,
          a0: Math.atan2(b.y - a.y, b.x - a.x),
        };
      }
    } else if (tab === 'text' && pts.length === 1) {
      const bar = barAt(pts[0]);
      if (bar) {
        if (selectedBarId !== bar.id) { selectedBarId = bar.id; renderBarList(); }
        gesture = { type: 'bar', bar, p0: pts[0], y0: bar.y };
        requestDraw();
      }
    }
  }

  function updateGesture() {
    if (!gesture) return;
    const pts = [...pointers.values()];
    const { h: H } = F();
    if (gesture.type === 'pan' && pts.length >= 1) {
      const p = pts[0];
      imgT.x = gesture.t0.x + (p.x - gesture.p0.x);
      imgT.y = gesture.t0.y + (p.y - gesture.p0.y);
    } else if (gesture.type === 'pinch' && pts.length >= 2) {
      const [a, b] = pts;
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const k = d / gesture.d0;
      const da = ang - gesture.a0;
      const t0 = gesture.t0;
      // punkten under fingrarna ska följa med fingrarna
      const vx = t0.x - gesture.m0.x, vy = t0.y - gesture.m0.y;
      const cos = Math.cos(da), sin = Math.sin(da);
      imgT.x = m.x + k * (vx * cos - vy * sin);
      imgT.y = m.y + k * (vx * sin + vy * cos);
      imgT.s = Math.max(0.01, t0.s * k);
      imgT.r = t0.r + da;
    } else if (gesture.type === 'bar' && pts.length >= 1) {
      const p = pts[0];
      const ny = gesture.y0 + (p.y - gesture.p0.y) / H;
      gesture.bar.y = Math.max(0.03, Math.min(0.97, ny));
    }
    requestDraw();
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const p = toCanvas(e);
    if (pointers.size === 0) tapCandidate = { cx: p.cx, cy: p.cy, t: Date.now(), p };
    else tapCandidate = null;
    if (!menuOpen) return; // gester bara när menyn är uppe
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    pointers.set(e.pointerId, p);
    beginGesture();
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = toCanvas(e);
    if (tapCandidate && Math.hypot(p.cx - tapCandidate.cx, p.cy - tapCandidate.cy) > 8) tapCandidate = null;
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, p);
    updateGesture();
  });

  function endPointer(e) {
    const wasTracked = pointers.delete(e.pointerId);
    if (wasTracked) {
      if (gesture && gesture.type === 'bar') persist();
      beginGesture(); // fortsätt smidigt med kvarvarande finger
    }
    if (e.type === 'pointerup' && tapCandidate && pointers.size === 0) {
      handleTap(tapCandidate.p);
    }
    if (pointers.size === 0) tapCandidate = null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  function handleTap(p) {
    if (!img) { $('#imageInput').click(); return; }
    if (!menuOpen) { setMenu(true); return; }
    if (tab === 'text') {
      const bar = barAt(p);
      if (bar) {
        selectedBarId = bar.id;
        renderBarList();
        const ta = document.querySelector(`.bar-item[data-id="${bar.id}"] textarea`);
        if (ta) { ta.focus(); ta.scrollIntoView({ block: 'nearest' }); }
        requestDraw();
      }
    }
  }

  // Mushjul på dator: zooma (håll Shift för att rotera)
  canvas.addEventListener('wheel', (e) => {
    if (tab !== 'image' || !img || !imgT) return;
    e.preventDefault();
    const p = toCanvas(e);
    if (e.shiftKey) {
      const da = (e.deltaY || e.deltaX) * 0.003;
      const vx = imgT.x - p.x, vy = imgT.y - p.y;
      const cos = Math.cos(da), sin = Math.sin(da);
      imgT.x = p.x + vx * cos - vy * sin;
      imgT.y = p.y + vx * sin + vy * cos;
      imgT.r += da;
    } else {
      const k = Math.exp(-e.deltaY * 0.0015);
      imgT.x = p.x + (imgT.x - p.x) * k;
      imgT.y = p.y + (imgT.y - p.y) * k;
      imgT.s *= k;
    }
    requestDraw();
  }, { passive: false });

  // Förhindra att Safari zoomar hela sidan vid nyp
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // ---------- Tips-bubbla ----------
  let hintTimer = null;
  function showHint(text) {
    hint.textContent = text;
    hint.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove('show'), 2600);
  }

  // ---------- Meny & flikar ----------
  function setTab(t) {
    tab = t;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.dataset.panel === t));
    if (t === 'image' && img) showHint('1 finger: flytta · 2 fingrar: zooma & rotera');
    if (t === 'text') showHint('Dra textraderna upp eller ner');
    requestDraw();
    requestAnimationFrame(layoutFrame);
  }
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

  function setMenu(open) {
    menuOpen = open;
    $('#sheet').classList.toggle('open', open);
    $('#toggleLabel').textContent = open ? 'Dölj meny' : 'Visa meny';
    pointers.clear();
    gesture = null;
    requestAnimationFrame(layoutFrame);
    requestDraw();
  }
  $('#toggleMenu').addEventListener('click', () => setMenu(!menuOpen));

  // ---------- Bild-fliken ----------
  function setMainImage(file) {
    loadImageFile(file, (im, url) => {
      if (img && img._url) URL.revokeObjectURL(img._url);
      im._url = url;
      img = im;
      imgT = null;
      fitImage('cover');
      setTab('image');
    });
  }
  ['#imageInput', '#imageInputAny'].forEach((sel) => {
    $(sel).addEventListener('change', (e) => {
      setMainImage(e.target.files && e.target.files[0]);
      e.target.value = '';
    });
  });

  // Bild som delats till appen från en annan app (Android: Dela → Snap Mockup)
  async function receiveSharedImage() {
    if (!/[?&]shared=1/.test(location.search) || !('caches' in window)) return;
    try {
      const c = await caches.open('snapmockup-shared');
      const res = await c.match('shared-image');
      if (res) {
        setMainImage(await res.blob());
        await c.delete('shared-image');
      }
    } catch (err) { /* ignorera */ }
    history.replaceState(null, '', location.pathname);
  }

  // Klistra in en bild som kopierats (t.ex. från appen Bilder)
  $('#pasteBtn').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) throw new Error('nosupport');
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) { setMainImage(await item.getType(type)); return; }
      }
      alert('Det finns ingen bild i urklipp. Kopiera en bild först (i Bilder: Dela → Kopiera).');
    } catch (err) {
      alert('Kunde inte läsa urklipp här. Prova att kopiera bilden igen, eller använd "Från Filer".');
    }
  });
  window.addEventListener('paste', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
    const f = [...(e.clipboardData ? e.clipboardData.files : [])].find((x) => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); setMainImage(f); }
  });

  $('#fitCover').addEventListener('click', () => fitImage('cover'));
  $('#fitContain').addEventListener('click', () => fitImage('contain'));
  const rotateBy = (deg) => {
    if (!imgT) return;
    imgT.r += deg * Math.PI / 180;
    requestDraw();
  };
  $('#rotLeft').addEventListener('click', () => rotateBy(-90));
  $('#rotRight').addEventListener('click', () => rotateBy(90));
  $('#straighten').addEventListener('click', () => {
    if (!imgT) return;
    const q = Math.PI / 2;
    imgT.r = Math.round(imgT.r / q) * q;
    requestDraw();
  });
  $('#formatSelect').addEventListener('change', (e) => {
    const { w: oW, h: oH } = F();
    state.format = e.target.value;
    const { w: W, h: H } = F();
    if (imgT) { imgT.x *= W / oW; imgT.y *= H / oH; imgT.s *= W / oW; }
    setupCanvasSize();
    persist();
    requestDraw();
  });

  // ---------- Text-fliken ----------
  function renderBarList() {
    const list = $('#barList');
    // behåll fokus om användaren skriver
    const active = document.activeElement;
    const activeId = active && active.closest && active.closest('.bar-item') ? +active.closest('.bar-item').dataset.id : null;
    const existing = new Map([...list.children].map(el => [+el.dataset.id, el]));
    const ids = new Set(state.bars.map(b => b.id));
    existing.forEach((el, id) => { if (!ids.has(id)) el.remove(); });

    state.bars.forEach((bar, i) => {
      let el = existing.get(bar.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'bar-item';
        el.dataset.id = bar.id;
        const ta = document.createElement('textarea');
        ta.rows = 1;
        ta.placeholder = 'Skriv text…';
        ta.addEventListener('input', () => {
          bar.text = ta.value;
          autoGrow(ta);
          persist();
          requestDraw();
        });
        ta.addEventListener('focus', () => {
          selectedBarId = bar.id;
          list.querySelectorAll('.bar-item').forEach(x => x.classList.toggle('selected', +x.dataset.id === bar.id));
          requestDraw();
        });
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn del';
        del.textContent = '🗑';
        del.title = 'Ta bort textrad';
        del.addEventListener('click', () => {
          state.bars = state.bars.filter(b => b.id !== bar.id);
          if (selectedBarId === bar.id) selectedBarId = state.bars[0] ? state.bars[0].id : null;
          renderBarList();
          persist();
          requestDraw();
        });
        el.append(ta, del);
      }
      const ta = el.querySelector('textarea');
      if (ta.value !== bar.text && bar.id !== activeId) ta.value = bar.text;
      el.classList.toggle('selected', bar.id === selectedBarId);
      list.appendChild(el); // rätt ordning
      autoGrow(ta);
    });
  }

  function autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight + 2, 160) + 'px';
  }

  $('#addBar').addEventListener('click', () => {
    // placera nya raden där det finns plats
    const used = state.bars.map(b => b.y);
    const candidates = [0.62, 0.45, 0.75, 0.3, 0.85, 0.2];
    const y = candidates.find(c => used.every(u => Math.abs(u - c) > 0.08)) ?? 0.5;
    const bar = newBar('', y);
    state.bars.push(bar);
    selectedBarId = bar.id;
    renderBarList();
    persist();
    requestDraw();
    const ta = document.querySelector(`.bar-item[data-id="${bar.id}"] textarea`);
    if (ta) ta.focus();
  });

  $('#textSize').addEventListener('input', (e) => {
    state.textSize = +e.target.value;
    persist();
    requestDraw();
  });

  // ---------- Avsändare-fliken ----------
  function bindText(sel, get, set) {
    const el = $(sel);
    el.value = get();
    el.addEventListener('input', () => { set(el.value); persist(); requestDraw(); drawAvatarPreview(); });
  }
  function bindCheck(sel, get, set) {
    const el = $(sel);
    el.checked = get();
    el.addEventListener('change', () => { set(el.checked); persist(); requestDraw(); });
  }

  function drawAvatarPreview() {
    const c = $('#avatarPreview').getContext('2d');
    c.clearRect(0, 0, 120, 120);
    drawAvatar(c, 0, 0, 120);
  }

  $('#avatarInput').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    loadImageFile(file, (im, url) => {
      // skala ner så den får plats att sparas lokalt
      const size = 256;
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const c = cv.getContext('2d');
      const s = Math.max(size / im.naturalWidth, size / im.naturalHeight);
      const w = im.naturalWidth * s, h = im.naturalHeight * s;
      c.drawImage(im, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      const data = cv.toDataURL('image/jpeg', 0.88);
      const a = new Image();
      a.onload = () => { avatarImg = a; drawAvatarPreview(); requestDraw(); };
      a.src = data;
      state.sender.avatar = data;
      persist();
    });
    e.target.value = '';
  });
  $('#avatarClear').addEventListener('click', () => {
    avatarImg = null;
    state.sender.avatar = null;
    persist();
    drawAvatarPreview();
    requestDraw();
  });

  // ---------- Spara-fliken ----------
  function exportBlob() {
    return new Promise((resolve) => {
      const { w, h } = F();
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      render(cv.getContext('2d'), true);
      cv.toBlob((b) => resolve(b), 'image/png');
    });
  }
  const fileName = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `snap-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
  };

  async function download() {
    const blob = await exportBlob();
    if (!blob) return alert('Kunde inte skapa bilden.');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  $('#downloadBtn').addEventListener('click', download);
  $('#shareBtn').addEventListener('click', async () => {
    const blob = await exportBlob();
    if (!blob) return alert('Kunde inte skapa bilden.');
    const file = new File([blob], fileName(), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); }
      catch (err) { if (err && err.name !== 'AbortError') download(); }
    } else {
      download();
    }
  });

  $('#resetAll').addEventListener('click', () => {
    if (!confirm('Vill du rensa allt och börja om?')) return;
    try { localStorage.removeItem(STORE_KEY); } catch (_) {}
    location.reload();
  });

  // ---------- Start ----------
  restore();

  $('#formatSelect').value = state.format;
  $('#textSize').value = state.textSize;
  bindText('#senderName', () => state.sender.name, v => state.sender.name = v);
  bindText('#senderTime', () => state.sender.time, v => state.sender.time = v);
  bindText('#avatarColor', () => state.sender.color, v => state.sender.color = v);
  bindText('#clock', () => state.ui.clock, v => state.ui.clock = v);
  bindText('#battery', () => state.ui.battery, v => state.ui.battery = v);
  bindText('#placeholder', () => state.ui.placeholder, v => state.ui.placeholder = v);
  bindCheck('#showStatus', () => state.ui.status, v => state.ui.status = v);
  bindCheck('#showTop', () => state.ui.top, v => state.ui.top = v);
  bindCheck('#showBottom', () => state.ui.bottom, v => state.ui.bottom = v);

  renderBarList();
  drawAvatarPreview();
  setupCanvasSize();
  receiveSharedImage();
  requestDraw();

  new ResizeObserver(() => layoutFrame()).observe(stage);
  window.addEventListener('resize', layoutFrame);

  // Gör appen installerbar och fungerande offline
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
