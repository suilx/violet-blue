const canvas = document.getElementById("heroCross");
const stage = document.getElementById("stage");
const ink = canvas?.getContext("2d");

if (ink) mountCross();

function mountCross() {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const initialYaw = 0.27;
  const camera = 5.75;
  const turnSpeed = (Math.PI * 2) / 16;
  const radiusSteps = 32;
  const swellSteps = 16;
  const dropAtlas = document.createElement("canvas");
  const atlasInk = dropAtlas.getContext("2d");
  const shaft = [-0.34, -2.55, -0.37, 0.34, 2.55, 0.37];
  const beam = [-1.78, -1.34, -0.37, 1.78, -0.71, 0.37];
  let edge = 0;
  let canvasHeight = 0;
  let pitch = 0;
  let sampleRows = [];
  let step = 0;
  let atlasCell = 0;
  let dropSize = 0;
  let frame = 0;
  let lastPaint;
  let elapsed = 0;
  let hitDistance;
  let hitFace;

  canvas.hidden = false;
  canvas.nextElementSibling.setAttribute("hidden", "");

  function intersect(box, ox, oy, oz, ix, iy, iz) {
    const x0 = (box[0] - ox) * ix;
    const x1 = (box[3] - ox) * ix;
    const y0 = (box[1] - oy) * iy;
    const y1 = (box[4] - oy) * iy;
    const z0 = (box[2] - oz) * iz;
    const z1 = (box[5] - oz) * iz;
    const nearX = Math.min(x0, x1);
    const nearY = Math.min(y0, y1);
    const nearZ = Math.min(z0, z1);
    const near = Math.max(nearX, nearY, nearZ);
    const far = Math.min(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1));
    if (near < 0 || near > far || near >= hitDistance) return;
    hitDistance = near;
    hitFace = near === nearX ? Number(ix < 0)
      : near === nearY ? 2 + Number(iy < 0) : 4 + Number(iz < 0);
  }

  function inverse(value) {
    return 1 / (Math.abs(value) > 1e-8 ? value : (value < 0 ? -1e-8 : 1e-8));
  }

  function projectBounds(box, c, s, cp, sp) {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (let corner = 0; corner < 8; corner += 1) {
      const x = box[corner & 1 ? 3 : 0];
      const y = box[corner & 2 ? 4 : 1];
      const z = box[corner & 4 ? 5 : 2];
      const tiltAxis = y * sp + z * cp;
      const depth = camera - x * s + c * tiltAxis;
      if (depth <= 0) return { left: -Infinity, right: Infinity, top: -Infinity, bottom: Infinity };
      const u = (x * c + s * tiltAxis) / depth;
      const v = (y * cp - z * sp) / depth;
      left = Math.min(left, u);
      right = Math.max(right, u);
      top = Math.min(top, v);
      bottom = Math.max(bottom, v);
    }
    const pad = 1e-7;
    return { left: left - pad, right: right + pad, top: top - pad, bottom: bottom + pad };
  }

  function traceDrop(context, x, y, radius, swell) {
    const wide = radius * (1 - 0.16 * swell);
    const top = y - radius * (1 + 0.48 * swell);
    const bottom = y + radius * (1 - 0.10 * swell);
    const tip = x + radius * 0.19 * swell;
    const shoulder = y + radius * 0.22 * swell;
    const upperCurve = wide * (0.55 - 0.32 * swell);
    context.moveTo(tip, top);
    context.bezierCurveTo(tip + upperCurve, top, x + wide, shoulder - radius * 0.56, x + wide, shoulder);
    context.bezierCurveTo(x + wide, shoulder + radius * 0.55, x + wide * 0.55, bottom, x, bottom);
    context.bezierCurveTo(x - wide * 0.55, bottom, x - wide, shoulder + radius * 0.55, x - wide, shoulder);
    context.bezierCurveTo(x - wide, shoulder - radius * 0.56, tip - upperCurve, top, tip, top);
    context.closePath();
  }

  function buildDropAtlas(scale) {
    const maxRadius = pitch * 0.41;
    atlasCell = Math.ceil(maxRadius * 3 * scale) + 4;
    dropSize = atlasCell / scale;
    dropAtlas.width = atlasCell * radiusSteps;
    dropAtlas.height = atlasCell * swellSteps;
    atlasInk.fillStyle = "#261d1b";
    for (let row = 0; row < swellSteps; row += 1) {
      for (let column = 1; column < radiusSteps; column += 1) {
        atlasInk.beginPath();
        traceDrop(atlasInk, (column + 0.5) * atlasCell, (row + 0.5) * atlasCell,
          maxRadius * scale * column / (radiusSteps - 1), row / (swellSteps - 1));
        atlasInk.fill();
      }
    }
  }

  function paint(seconds) {
    if (!edge) return;
    const yaw = initialYaw + seconds * turnSpeed;
    const tilt = -0.12 + Math.sin(seconds * 0.42) * 0.07;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const cp = Math.cos(tilt);
    const sp = Math.sin(tilt);
    const ox = camera * s;
    const oy = -camera * c * sp;
    const oz = -camera * c * cp;
    const xLight = -0.43 * c + 0.66 * s;
    const yLight = -0.43 * s * sp - 0.60 * cp - 0.66 * c * sp;
    const zLight = -0.43 * s * cp + 0.60 * sp - 0.66 * c * cp;
    const light = [-xLight, xLight, -yLight, yLight, -zLight, zLight];

    ink.clearRect(0, 0, edge, canvasHeight);
    // Cast rays only where the two boxes can project onto the screen grid.
    const upright = projectBounds(shaft, c, s, cp, sp);
    const arm = projectBounds(beam, c, s, cp, sp);
    for (const { y, v, taper, span, dots } of sampleRows) {
      const hasShaft = v >= upright.top && v <= upright.bottom;
      const hasBeam = v >= arm.top && v <= arm.bottom;
      if (!hasShaft && !hasBeam) continue;
      const left = Math.min(hasShaft ? upright.left : Infinity, hasBeam ? arm.left : Infinity);
      const right = Math.max(hasShaft ? upright.right : -Infinity, hasBeam ? arm.right : -Infinity);
      const start = Math.max(0, Math.ceil(left / step) + span);
      const end = Math.min(dots.length - 1, Math.floor(right / step) + span);
      const yRay = cp * v + c * sp;
      const zRay = -sp * v + c * cp;
      const wave = seconds * 2.3 - v * 11.5;
      for (let column = start; column <= end; column += 1) {
        const { x, u, grain } = dots[column];
        const ix = inverse(c * u - s);
        const iy = inverse(s * sp * u + yRay);
        const iz = inverse(s * cp * u + zRay);
        hitDistance = Infinity;
        if (hasShaft && u >= upright.left && u <= upright.right) intersect(shaft, ox, oy, oz, ix, iy, iz);
        if (hasBeam && u >= arm.left && u <= arm.right) intersect(beam, ox, oy, oz, ix, iy, iz);
        if (!Number.isFinite(hitDistance)) continue;

        const shade = Math.max(0, light[hitFace]);
        const depth = (camera - hitDistance) * 0.019;
        const phase = 0.5 + 0.5 * Math.sin(wave + u * 4.5 + grain * 0.58);
        const swell = phase * phase * (3 - 2 * phase);
        const radius = pitch * Math.min(0.41,
          (0.20 + shade * 0.21 + depth + grain * 0.025) * (0.59 + 0.53 * swell));
        const radiusIndex = Math.round(radius * taper / (pitch * 0.41) * (radiusSteps - 1));
        if (!radiusIndex) continue;
        const swellIndex = Math.round(swell * (swellSteps - 1));
        ink.drawImage(dropAtlas, radiusIndex * atlasCell, swellIndex * atlasCell, atlasCell, atlasCell,
          x - dropSize / 2, y - dropSize / 2, dropSize, dropSize);
      }
    }
  }

  function measure() {
    const size = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!size || !height) return;
    const scale = Math.min(2, devicePixelRatio || 1, 1440 / size, 2160 / height);
    const pixels = Math.round(size * scale);
    if (size === edge && height === canvasHeight && canvas.width === pixels) return;
    edge = size;
    canvasHeight = height;
    canvas.width = pixels;
    canvas.height = Math.round(height * scale);
    ink.setTransform(pixels / size, 0, 0, canvas.height / height, 0, 0);
    pitch = Math.max(3.6, size / 105);
    buildDropAtlas(2 * pixels / size);
    const center = size / 2;
    const lens = size * 0.88;
    step = pitch / lens;
    const bound = Math.floor(center / pitch) - 1;
    const lastRow = Math.floor((height - center) / pitch) - 1;
    const extended = height > size + pitch;
    shaft[4] = extended ? Math.max(2.55, (height - center) * camera * 1.6 / lens) : 2.55;
    sampleRows = [];
    for (let row = -bound; row <= lastRow; row++) {
      const y = center + row * pitch;
      const taper = extended ? Math.sqrt(Math.min(1, (height - y) / (pitch * 14))) : 1;
      const rowBound = row <= bound ? bound : Math.ceil(bound * 0.8);
      const dots = [];
      for (let column = -rowBound; column <= rowBound; column++) {
        const dx = column * pitch;
        const noise = (Math.imul(column, 73856093) ^ Math.imul(row, 19349663)) >>> 0;
        dots.push({ x: center + dx, u: dx / lens, grain: (noise % 127) / 126 - 0.5 });
      }
      sampleRows.push({ y, v: row * step, taper, span: rowBound, dots });
    }
    paint(reducedMotion.matches ? 0 : elapsed);
  }

  const canTurn = () => !reducedMotion.matches && !document.hidden && !stage.inert;

  function tick(now) {
    frame = 0;
    if (!canTurn()) {
      lastPaint = undefined;
      return;
    }
    if (lastPaint === undefined || now - lastPaint >= 15) {
      if (lastPaint !== undefined) elapsed += Math.min(50, now - lastPaint) / 1000;
      lastPaint = now;
      paint(elapsed);
    }
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    if (canTurn()) {
      if (!frame) frame = requestAnimationFrame(tick);
      return;
    }
    cancelAnimationFrame(frame);
    frame = 0;
    lastPaint = undefined;
    if (reducedMotion.matches && !stage.inert) paint(0);
  }

  measure();
  new ResizeObserver(measure).observe(canvas);
  new MutationObserver(sync).observe(stage, { attributes: true, attributeFilter: ["inert"] });
  document.addEventListener("visibilitychange", sync);
  reducedMotion.addEventListener("change", sync);
  sync();
}
