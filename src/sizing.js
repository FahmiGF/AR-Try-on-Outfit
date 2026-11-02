/**
 * Size recommendation + AR garment transform math.
 * Semua fungsi murni (tanpa DOM/canvas) supaya bisa diuji terpisah.
 */

export const SIZE_CHART = {
  S: { chestMin: 84, chestMax: 92, heightMin: 150, heightMax: 162, weightMin: 45, weightMax: 55 },
  M: { chestMin: 92, chestMax: 100, heightMin: 162, heightMax: 170, weightMin: 55, weightMax: 65 },
  L: { chestMin: 100, chestMax: 108, heightMin: 170, heightMax: 178, weightMin: 65, weightMax: 78 },
  XL: { chestMin: 108, chestMax: 118, heightMin: 178, heightMax: 190, weightMin: 78, weightMax: 95 },
};

/**
 * Rekomendasi ukuran dari data tubuh.
 * Skor tiap ukuran memakai jarak ke rentang ideal; data yang tidak diisi diabaikan.
 */
export function recommendSize({ height = 0, weight = 0, chest = 0, fit = 'regular' } = {}) {
  const order = Object.keys(SIZE_CHART);
  let bestIndex = 1;
  let bestScore = Infinity;

  for (const [index, size] of order.entries()) {
    const chart = SIZE_CHART[size];
    let score = 0;
    let used = 0;

    const distance = (value, min, max) => {
      if (!value) return 0;
      if (value < min) return min - value;
      if (value > max) return value - max;
      return 0;
    };

    if (chest) {
      score += distance(chest, chart.chestMin, chart.chestMax) * 2.2;
      used += 1;
    }
    if (weight) {
      score += distance(weight, chart.weightMin, chart.weightMax) * 1.4;
      used += 1;
    }
    if (height) {
      score += distance(height, chart.heightMin, chart.heightMax) * 1.1;
      used += 1;
    }

    if (used === 0) score = index === 1 ? 0 : index;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  // Preferensi fit menggeser satu ukuran dari hasil pengukuran reguler:
  // oversize naik satu ukuran, slim turun satu ukuran.
  const fitOffset = fit === 'oversize' ? 1 : fit === 'slim' ? -1 : 0;
  const shifted = Math.max(0, Math.min(order.length - 1, bestIndex + fitOffset));
  return order[shifted];
}

export function sizeConfidence({ height = 0, weight = 0, chest = 0 } = {}) {
  const fields = [height, weight, chest].filter(Boolean).length;
  return Math.round((fields / 3) * 100);
}

const LANDMARK = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
};

function visible(point, threshold = 0.35) {
  return Boolean(point) && (point.visibility === undefined || point.visibility >= threshold);
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Hitung posisi/ukuran/rotasi gambar pakaian dari 33 landmark MediaPipe Pose.
 * Landmark memakai koordinat ternormalisasi (0..1) milik MediaPipe.
 *
 * @returns {{
 *   visible: boolean,
 *   x: number, y: number,          // pusat gambar (piksel)
 *   width: number, height: number, // ukuran gambar (piksel)
 *   angle: number,                 // rotasi (radian)
 *   shoulderWidth: number,         // piksel
 *   torsoLength: number,           // piksel
 * }}
 */
export function computeGarmentTransform(landmarks, { width = 720, height = 1280, type = 'tshirt', padding = 1.18 } = {}) {
  if (!Array.isArray(landmarks) || landmarks.length < 25) {
    return { visible: false, x: width / 2, y: height / 2, width: 0, height: 0, angle: 0, shoulderWidth: 0, torsoLength: 0 };
  }

  const ls = landmarks[LANDMARK.leftShoulder];
  const rs = landmarks[LANDMARK.rightShoulder];
  const lh = landmarks[LANDMARK.leftHip];
  const rh = landmarks[LANDMARK.rightHip];

  if (!visible(ls) || !visible(rs) || !visible(lh) || !visible(rh)) {
    return { visible: false, x: width / 2, y: height / 2, width: 0, height: 0, angle: 0, shoulderWidth: 0, torsoLength: 0 };
  }

  const shoulderMid = midpoint(ls, rs);
  const hipMid = midpoint(lh, rh);
  const shoulderWidth = Math.hypot((ls.x - rs.x) * width, (ls.y - rs.y) * height);
  const torsoLength = Math.hypot((shoulderMid.x - hipMid.x) * width, (shoulderMid.y - hipMid.y) * height);

  if (shoulderWidth < 8 || torsoLength < 8) {
    return { visible: false, x: width / 2, y: height / 2, width: 0, height: 0, angle: 0, shoulderWidth, torsoLength };
  }

  const angle = Math.atan2((rs.y - ls.y) * height, (rs.x - ls.x) * width);

  const widthFactor = {
    tshirt: 1.02,
    polo: 1.02,
    kemeja: 1.06,
    flannel: 1.06,
    hoodie: 1.16,
    sweater: 1.14,
    dress: 1.1,
    jacket: 1.14,
  }[type] ?? 1.04;

  const lengthFactor = {
    tshirt: 0.94,
    polo: 0.94,
    kemeja: 1.02,
    flannel: 1.02,
    hoodie: 1.1,
    sweater: 1.05,
    dress: 1.85,
    jacket: 1.06,
  }[type] ?? 0.96;

  const garmentWidth = shoulderWidth * widthFactor * padding;
  const garmentHeight = torsoLength * lengthFactor * padding;

  // Pusat vertikal: bahu + sebagian panjang torso. Dress melebar ke bawah.
  const anchor = type === 'dress' ? 0.34 : type === 'jacket' || type === 'hoodie' ? 0.2 : 0.22;
  const cx = (shoulderMid.x + (hipMid.x - shoulderMid.x) * anchor) * width;
  const cy = (shoulderMid.y + (hipMid.y - shoulderMid.y) * anchor) * height;

  return {
    visible: true,
    x: cx,
    y: cy,
    width: garmentWidth,
    height: garmentHeight,
    angle,
    shoulderWidth,
    torsoLength,
  };
}

/**
 * Transformasi mode mannequin/fallback: pakaian diletakkan di tengah kanvas
 * dengan tinggi tertentu, tanpa landmark.
 */
export function mannequinTransform({ width = 720, height = 1280, type = 'tshirt', scale = 1 } = {}) {
  const lengthFactor = { dress: 1.5, hoodie: 1.15, sweater: 1.1, jacket: 1.1 }[type] || 1;
  const h = Math.min(height * 0.52 * lengthFactor * scale, height * 0.78);
  const w = h * (320 / 360);
  return { visible: true, x: width / 2, y: height * 0.47, width: w, height: h, angle: 0 };
}
