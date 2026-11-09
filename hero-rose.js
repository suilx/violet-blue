export function createRosePainter() {
  const points = [];
  const whorls = [
    { count: 3, reach: 0.38, rise: 1.18, curl: 0.08 },
    { count: 4, reach: 0.62, rise: 1.16, curl: 0.15 },
    { count: 5, reach: 0.88, rise: 1.08, curl: 0.24 },
    { count: 6, reach: 1.19, rise: 0.94, curl: 0.30 },
    { count: 7, reach: 1.51, rise: 0.79, curl: 0.36 },
  ];

  for (const [layer, { count, reach, rise, curl }] of whorls.entries()) {
    for (let petal = 0; petal < count; petal += 1) {
      const angle = petal * Math.PI * 2 / count + layer * 0.91;
      const ripple = Math.sin(angle * 3 + layer);
      for (let row = 0; row <= 48; row += 1) {
        const t = row / 48;
        const spread = Math.pow(Math.sin(Math.PI * 0.80 * t), 0.72);
        const lip = t ** 5;
        for (let column = -25; column <= 25; column += 1) {
          const u = column / 25;
          const edge = u * u;
          const theta = angle + u * spread * Math.PI * 1.33 / count + t * (0.32 - 0.055 * layer);
          const radius = 0.07 + 0.045 * layer + reach * t * (1 - 0.24 * edge + 0.07 * ripple);
          const y = 0.65 - rise * t + (curl + 0.10 * ripple) * lip
            + t * (0.26 * edge + 0.07 * u) + 0.045 * lip * Math.sin(u * 7 + angle);
          const weight = 0.24 + 0.23 * t + 0.47 * lip + 0.12 * edge + 0.04 * ripple;
          points.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius, weight);
        }
      }
    }
  }

  for (let row = 0; row <= 120; row += 1) {
    const t = row / 120;
    const y = 0.54 + 2.70 * t;
    const stemX = -0.43 * t * t;
    for (let side = 0; side < 14; side += 1) {
      const angle = side * Math.PI / 7;
      points.push(stemX + 0.065 * Math.cos(angle), y, 0.065 * Math.sin(angle), 0.69);
    }
  }

  for (const [direction, base, length] of [[-1, 1.62, 0.87], [1, 2.02, 1.05]]) {
    for (let row = 0; row <= 36; row += 1) {
      const t = row / 36;
      const width = 0.27 * Math.sin(Math.PI * t) * (0.94 + 0.06 * Math.cos(t * 36));
      for (let column = -13; column <= 13; column += 1) {
        const u = column / 13;
        points.push(direction * length * t - 0.10, base - 0.61 * t + 0.21 * t * t,
          direction * 0.39 * t + u * width, 0.47 + 0.25 * (1 - Math.abs(u)));
      }
    }
  }

  const samples = Float32Array.from(points);
  let depths = new Float32Array(0);
  let weights = new Float32Array(0);
  let activeCells = new Uint32Array(0);

  return function paintRose(width, height, pitch, camera, yaw, tilt, paintDot) {
    const columns = Math.floor(width / pitch) + 1;
    const rows = Math.floor(height / pitch) + 1;
    const startX = (width - (columns - 1) * pitch) / 2;
    const center = width / 2;
    const lens = width * 0.88;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const cp = Math.cos(tilt);
    const sp = Math.sin(tilt);
    if (depths.length !== columns * rows) {
      depths = new Float32Array(columns * rows);
      weights = new Float32Array(columns * rows);
      activeCells = new Uint32Array(columns * rows);
    }
    depths.fill(Infinity);
    let activeCount = 0;

    for (let i = 0; i < samples.length; i += 4) {
      const x = samples[i];
      const y = samples[i + 1];
      const z = samples[i + 2];
      const yawDepth = -x * s + z * c;
      const depth = camera + y * sp + yawDepth * cp;
      const scale = lens / depth;
      const column = Math.round((center + (x * c + z * s) * scale - startX) / pitch);
      const row = Math.round((center + (y * cp - yawDepth * sp) * scale) / pitch);
      if (column < 0 || column >= columns || row < 0 || row >= rows) continue;
      const cell = row * columns + column;
      if (depth >= depths[cell]) continue;
      if (depths[cell] === Infinity) activeCells[activeCount++] = cell;
      depths[cell] = depth;
      weights[cell] = samples[i + 3] * (1 + (camera - depth) * 0.10);
    }

    for (let i = 0; i < activeCount; i += 1) {
      const cell = activeCells[i];
      const row = Math.floor(cell / columns);
      const column = cell % columns;
      const shade = Math.min(1, weights[cell]);
      paintDot(startX + column * pitch, row * pitch, shade * 0.78);
    }
  };
}
