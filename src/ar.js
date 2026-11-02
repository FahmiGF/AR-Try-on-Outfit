/**
 * Kontroler AR try-on.
 * - Kamera via getUserMedia.
 * - Deteksi pose via MediaPipe PoseLandmarker (dimuat dari CDN).
 * - Overlay pakaian SVG di <canvas>.
 * - Fallback mannequin jika kamera/model tidak tersedia.
 */

import { computeGarmentTransform, mannequinTransform } from './sizing.js';

const MEDIAPIPE_BUNDLE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
const MEDIAPIPE_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export class TryOnAR {
  constructor({ video, canvas, onStatus = () => {}, onMode = () => {} } = {}) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d') || null;
    this.onStatus = onStatus;
    this.onMode = onMode;

    this.stream = null;
    this.landmarker = null;
    this.running = false;
    this.raf = null;
    this.mode = 'idle';
    this.lastLandmarks = null;
    this.lastVideoTime = -1;
    this.detections = 0;

    this.garment = { type: 'tshirt', colorHex: '#24252a', image: null };
    this.scale = 1;
    this.offsetY = 0;
    this.opacity = 1;
    this.confidence = 0;

    this.bob = 0;
    this.fps = 0;
    this._frames = 0;
    this._fpsStart = 0;

    this._loop = this._loop.bind(this);
  }

  async start() {
    this.onStatus('Meminta akses kamera…');
    const cameraOk = await this._startCamera();
    if (cameraOk) {
      this.mode = 'ar';
      this.onStatus('Memuat model pose…');
      await this._loadModel();
      if (!this.landmarker) this.onStatus('AR tanpa pose: pakaian mengikuti layar. Pilih mode Mannequin.');
    } else {
      this.mode = 'mannequin';
      this.onStatus('Kamera tidak tersedia — memakai mode Mannequin.');
    }
    this.onMode(this.mode);
    this.running = true;
    this._fpsStart = performance.now();
    this.raf = requestAnimationFrame(this._loop);
    return this.mode;
  }

  async _startCamera() {
    if (!navigator?.mediaDevices?.getUserMedia) return false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play().catch(() => {});
      await new Promise((resolve) => {
        if (this.video.readyState >= 2) return resolve();
        this.video.onloadedmetadata = () => resolve();
        setTimeout(resolve, 2500);
      });
      return true;
    } catch {
      this.stream = null;
      return false;
    }
  }

  async _loadModel() {
    try {
      const vision = await import(/* @vite-ignore */ MEDIAPIPE_BUNDLE);
      const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
      this.landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      this.onStatus('AR aktif — berdiri 1,5–2 m dari kamera.');
    } catch {
      this.landmarker = null;
    }
  }

  setGarment({ type, colorHex, image } = {}) {
    if (type) this.garment.type = type;
    if (colorHex) this.garment.colorHex = colorHex;
    if (image !== undefined) this.garment.image = image;
  }

  setScale(value) {
    this.scale = Math.max(0.5, Math.min(2, Number(value) || 1));
  }

  setOffsetY(value) {
    this.offsetY = Math.max(-0.35, Math.min(0.35, Number(value) || 0));
  }

  setOpacity(value) {
    this.opacity = Math.max(0.2, Math.min(1, Number(value) || 1));
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.onMode(mode);
  }

  _loop(now) {
    if (!this.running) return;
    this.draw(now);
    this.raf = requestAnimationFrame(this._loop);
  }

  _syncCanvasSize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return { w, h, dpr };
  }

  draw(now = performance.now()) {
    if (!this.ctx) return;
    const { w, h } = this._syncCanvasSize();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Latar: video (mirror) atau gradien mannequin.
    if (this.mode === 'ar' && this.video.readyState >= 2) {
      this._drawMirroredVideo(ctx, w, h);
    } else {
      this._drawBackdrop(ctx, w, h, now);
    }

    // Deteksi pose.
    let landmarks = null;
    if (this.mode === 'ar' && this.landmarker && this.video.readyState >= 2) {
      if (this.video.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.video.currentTime;
        try {
          const result = this.landmarker.detectForVideo(this.video, now);
          landmarks = result?.landmarks?.[0] || null;
        } catch {
          landmarks = null;
        }
      } else {
        landmarks = this.lastLandmarks;
      }
      this.lastLandmarks = landmarks;
    }

    if (landmarks) this.detections += 1;
    this.confidence = landmarks ? 1 : 0;

    const img = this.garment.image;
    if (img && img.complete !== false) {
      if (this.mode === 'ar' && this.video.readyState >= 2) {
        const t = computeGarmentTransform(landmarks, { width: w, height: h, type: this.garment.type, padding: this.scale });
        if (t.visible) {
          this._drawGarment(ctx, img, {
            x: w - t.x,
            y: t.y + this.offsetY * h,
            width: t.width,
            height: t.height,
            angle: -t.angle,
          });
        } else {
          // Kamera hidup tapi pose belum terdeteksi: tampilkan panduan ringan.
          this._drawScanHint(ctx, w, h, now);
        }
      } else {
        const t = mannequinTransform({ width: w, height: h, type: this.garment.type, scale: this.scale });
        const bob = Math.sin(now / 900) * 0.006 * h;
        this._drawMannequin(ctx, w, h, now);
        this._drawGarment(ctx, img, { ...t, y: t.y + this.offsetY * h + bob, width: t.width, height: t.height });
      }
    }

    this._frames += 1;
    if (now - this._fpsStart >= 1000) {
      this.fps = Math.round((this._frames * 1000) / (now - this._fpsStart));
      this._frames = 0;
      this._fpsStart = now;
    }
  }

  _drawMirroredVideo(ctx, w, h) {
    const vw = this.video.videoWidth || 1280;
    const vh = this.video.videoHeight || 720;
    const scale = Math.max(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this.video, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.restore();

    // Vignette halus.
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(8,10,18,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  _drawBackdrop(ctx, w, h, now) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#241b2f');
    g.addColorStop(0.55, '#171425');
    g.addColorStop(1, '#0d0b14');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Lingkaran cahaya.
    const cx = w * 0.5;
    const cy = h * 0.42;
    const r = Math.min(w, h) * 0.32;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.5);
    glow.addColorStop(0, 'rgba(255,179,71,0.20)');
    glow.addColorStop(1, 'rgba(255,179,71,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Grid perspektif.
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i++) {
      const y = h * 0.55 + i * ((h * 0.45) / 12) ** 1.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  _drawMannequin(ctx, w, h, now) {
    const cx = w / 2;
    const top = h * 0.2;
    const bottom = h * 0.9;
    const headR = Math.min(w, h) * 0.055;
    const shoulder = w * 0.11;

    ctx.save();
    ctx.strokeStyle = 'rgba(245,238,226,0.55)';
    ctx.fillStyle = 'rgba(245,238,226,0.10)';
    ctx.lineWidth = Math.max(2, w * 0.004);

    // Kepala.
    ctx.beginPath();
    ctx.arc(cx, top + headR, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Leher.
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.35, top + headR * 1.9);
    ctx.lineTo(cx + headR * 0.35, top + headR * 1.9);
    ctx.stroke();

    // Torso.
    ctx.beginPath();
    ctx.moveTo(cx - shoulder, top + headR * 2.1);
    ctx.quadraticCurveTo(cx, top + headR * 2.6, cx + shoulder, top + headR * 2.1);
    ctx.lineTo(cx + shoulder * 0.82, bottom - h * 0.16);
    ctx.quadraticCurveTo(cx, bottom - h * 0.13, cx - shoulder * 0.82, bottom - h * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Lengan.
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * shoulder, top + headR * 2.1);
      ctx.quadraticCurveTo(cx + dir * shoulder * 1.5, top + headR * 6, cx + dir * shoulder * 1.35, bottom - h * 0.3);
      ctx.stroke();
    }

    // Kaki.
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * shoulder * 0.42, bottom - h * 0.14);
      ctx.lineTo(cx + dir * shoulder * 0.5, bottom);
      ctx.stroke();
    }

    // Alas.
    const floor = ctx.createLinearGradient(cx - w * 0.3, 0, cx + w * 0.3, 0);
    floor.addColorStop(0, 'rgba(255,179,71,0)');
    floor.addColorStop(0.5, 'rgba(255,179,71,0.35)');
    floor.addColorStop(1, 'rgba(255,179,71,0)');
    ctx.strokeStyle = floor;
    ctx.beginPath();
    ctx.ellipse(cx, bottom + 4, w * 0.24, h * 0.018, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  _drawGarment(ctx, img, t) {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle || 0);
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = Math.max(6, t.width * 0.06);
    ctx.shadowOffsetY = Math.max(4, t.height * 0.015);
    ctx.drawImage(img, -t.width / 2, -t.height / 2, t.width, t.height);
    ctx.restore();
  }

  _drawScanHint(ctx, w, h, now) {
    const cx = w / 2;
    const cy = h * 0.35;
    const size = Math.min(w, h) * 0.18;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,179,71,0.85)';
    ctx.lineWidth = Math.max(2, w * 0.003);
    const arm = size * 0.4;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath();
      ctx.moveTo(cx + sx * size, cy + sy * size - sy * arm);
      ctx.lineTo(cx + sx * size, cy + sy * size);
      ctx.lineTo(cx + sx * size - sx * arm, cy + sy * size);
      ctx.stroke();
    }
    const scanY = cy - size + ((now / 1400) % 1) * size * 2;
    ctx.strokeStyle = 'rgba(255,179,71,0.55)';
    ctx.beginPath();
    ctx.moveTo(cx - size, scanY);
    ctx.lineTo(cx + size, scanY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(245,238,226,0.75)';
    ctx.font = `500 ${Math.round(w * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Berdiri tegak, pastikan bahu & pinggul terlihat', cx, cy + size + w * 0.04);
    ctx.restore();
  }

  screenshot() {
    try {
      return this.canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    if (this.video) this.video.srcObject = null;
    this.mode = 'idle';
    this.onMode('idle');
  }
}

export function loadGarmentImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
