const canvas = document.getElementById("heroCross");
const stage = document.getElementById("stage");
const ink = canvas?.getContext("2d");

if (ink) mountCross();

function mountCross() {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const initialYaw = 0.27;
  const camera = 5.75;
  const turnSpeed = (Math.PI * 2) / 18;
  const radiusSteps = 32;
  const dotAtlas = document.createElement("canvas");
  const atlasInk = dotAtlas.getContext("2d");
  const inkDuration = 2350;
  const shaft = [-0.34, -2.55, -0.37, 0.34, 2.55, 0.37];
  const beam = [-1.78, -1.34, -0.37, 1.78, -0.71, 0.37];
  const lowerBeam = [-0.28, 0.02, -0.34, 0.28, 0.53, 0.34];
  const looseBeamAngle = Math.PI / 6;
  let edge = 0;
  let canvasHeight = 0;
  let pitch = 0;
  let sampleRows = [];
  let step = 0;
  let atlasCell = 0;
  let dotSize = 0;
  let frame = 0;
  let lastPaint;
  let elapsed = 0;
  let beamProgress = 0;
  let beamFrom = 0;
  let beamTarget = 0;
  let beamStart = 0;
  let beamAngle = 0;
  let beamAngleFrom = 0;
  let beamAngleTarget = 0;
  let beamDrop = 0;
  let beamDropFrom = 0;
  let beamDropTarget = 0;
  let lowerBeamProgress = 0;
  let lowerBeamFrom = 0;
  let lowerBeamTarget = 0;
  let lowerBeamFall = 0;
  let lowerBeamFallFrom = 0;
  let inkColor = "#261d1b";
  let inkChannels = [38, 29, 27];
  let inkChange;
  let hitDistance;
  let hitFace;
  let paintRose;
  let roseLoad;
  let crossExited = false;

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

  function projectBounds(box, c, s, cp, sp, roll) {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (let corner = 0; corner < 8; corner += 1) {
      let x = box[corner & 1 ? 3 : 0];
      let y = box[corner & 2 ? 4 : 1];
      const z = box[corner & 4 ? 5 : 2];
      if (roll) {
        const height = y - roll.pivot;
        y = roll.pivot + x * roll.sin + height * roll.cos;
        x = x * roll.cos - height * roll.sin;
      }
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

  function buildDotAtlas(scale) {
    const maxRadius = pitch * 0.41;
    atlasCell = 2 * (Math.ceil(maxRadius * scale) + 1);
    dotSize = atlasCell / scale;
    dotAtlas.width = atlasCell * radiusSteps;
    dotAtlas.height = atlasCell;
    atlasInk.fillStyle = inkColor;
    for (let column = 1; column < radiusSteps; column += 1) {
      atlasInk.beginPath();
      atlasInk.arc((column + 0.5) * atlasCell, atlasCell / 2,
        maxRadius * scale * column / (radiusSteps - 1), 0, Math.PI * 2);
      atlasInk.fill();
    }
  }

  function updateInk() {
    if (!inkChange) return;
    const progress = reducedMotion.matches ? 1 : Math.min(1, (performance.now() - inkChange.start) / inkDuration);
    const eased = progress * progress * (3 - 2 * progress);
    inkChannels = inkChange.from.map((channel, index) =>
      Math.round(channel + (inkChange.to[index] - channel) * eased));
    const color = `rgb(${inkChannels.join(", ")})`;
    if (color !== inkColor) {
      inkColor = color;
      atlasInk.globalCompositeOperation = "source-in";
      atlasInk.fillStyle = color;
      atlasInk.fillRect(0, 0, dotAtlas.width, dotAtlas.height);
      atlasInk.globalCompositeOperation = "source-over";
    }
    if (progress === 1) inkChange = undefined;
  }

  function paint(seconds) {
    if (!edge || crossExited) return;
    updateInk();
    if (reducedMotion.matches) {
      beamFrom = beamTarget;
      beamAngleFrom = beamAngleTarget;
      beamDropFrom = beamDropTarget;
      lowerBeamFrom = lowerBeamTarget;
      lowerBeamFallFrom = 0;
    }
    const progress = Math.min(1, (elapsed - beamStart) / 1.06);
    const eased = progress * progress * (3 - 2 * progress);
    beamProgress = beamFrom + (beamTarget - beamFrom) * eased;
    beamAngle = beamAngleFrom + (beamAngleTarget - beamAngleFrom) * eased;
    if (!lowerBeamTarget && lowerBeamFrom > 0) {
      const fallTime = Math.min(1, (elapsed - beamStart) / 0.65);
      lowerBeamFall = lowerBeamFallFrom + (1 - lowerBeamFallFrom) * fallTime ** 2;
      lowerBeamProgress = fallTime < 1 ? lowerBeamFrom : 0;
    } else {
      lowerBeamProgress = lowerBeamFrom + (lowerBeamTarget - lowerBeamFrom) * eased;
      lowerBeamFall = lowerBeamFallFrom * (1 - eased);
    }
    lowerBeam[3] = 0.28 + 1.29 * lowerBeamProgress;
    lowerBeam[0] = -lowerBeam[3];
    let dropEase = eased;
    if (beamDropTarget > beamDropFrom) {
      const dropTime = Math.min(1, (elapsed - beamStart) / 0.87);
      dropEase = dropTime < 0.25 ? -0.055 * Math.sin(dropTime * Math.PI * 2)
        : -0.055 + 1.055 * ((dropTime - 0.25) / 0.75) ** 2;
    }
    beamDrop = beamDropFrom + (beamDropTarget - beamDropFrom) * dropEase;
    const dropDistance = (canvasHeight - edge / 2) / (edge * 0.88) * camera + 2.5;
    lowerBeam[1] = 0.02 + dropDistance * lowerBeamFall;
    lowerBeam[4] = 0.53 + dropDistance * lowerBeamFall;
    const beamOffset = 1.32 * beamProgress + dropDistance * beamDrop;
    beam[1] = -1.34 + beamOffset;
    beam[4] = -0.71 + beamOffset;

    const yaw = initialYaw + seconds * turnSpeed;
    ink.clearRect(0, 0, edge, canvasHeight);
    if (stage.classList.contains("song-rose")) {
      loadRose();
      if (paintRose) {
        paintRose(edge, canvasHeight, pitch, camera, yaw, 0.67, drawDot);
        return;
      }
    }
    const tilt = -0.12 + Math.sin(seconds * 0.375) * 0.07;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const cp = Math.cos(tilt);
    const sp = Math.sin(tilt);
    const ox = camera * s;
    const oy = -camera * sp * c;
    const oz = -camera * c * cp;
    const xLight = -0.43 * c + 0.66 * s;
    const yLight = -0.60 * cp + (-0.43 * s - 0.66 * c) * sp;
    const zLight = (-0.43 * s - 0.66 * c) * cp + 0.60 * sp;
    const light = [-xLight, xLight, -yLight, yLight, -zLight, zLight];
    const rollAngle = beamAngle + 0.36 * Math.max(0, beamDrop);
    const beamCos = Math.cos(rollAngle);
    const beamSin = Math.sin(rollAngle);
    const beamLightX = xLight * beamCos + yLight * beamSin;
    const beamLightY = yLight * beamCos - xLight * beamSin;
    const beamLight = rollAngle ? [-beamLightX, beamLightX, -beamLightY, beamLightY, -zLight, zLight] : light;

    // Cast rays only where the current shape can project onto the screen grid.
    const pivot = (beam[1] + beam[4]) / 2;
    const beamOriginX = ox * beamCos + (oy - pivot) * beamSin;
    const beamOriginY = pivot + (oy - pivot) * beamCos - ox * beamSin;
    const upright = projectBounds(shaft, c, s, cp, sp);
    const arm = beamDrop >= 1 ? null : projectBounds(beam, c, s, cp, sp,
      rollAngle ? { pivot, cos: beamCos, sin: beamSin } : undefined);
    const lowerArm = lowerBeamProgress > 0 ? projectBounds(lowerBeam, c, s, cp, sp) : null;
    const yStep = s * sp;
    const zStep = s * cp;
    for (const { y, v, taper, span, dots } of sampleRows) {
      const hasShaft = v >= upright.top && v <= upright.bottom;
      const hasBeam = arm && v >= arm.top && v <= arm.bottom;
      const hasLowerBeam = lowerArm && v >= lowerArm.top && v <= lowerArm.bottom;
      if (!hasShaft && !hasBeam && !hasLowerBeam) continue;
      const left = Math.min(hasShaft ? upright.left : Infinity, hasBeam ? arm.left : Infinity,
        hasLowerBeam ? lowerArm.left : Infinity);
      const right = Math.max(hasShaft ? upright.right : -Infinity, hasBeam ? arm.right : -Infinity,
        hasLowerBeam ? lowerArm.right : -Infinity);
      const start = Math.max(0, Math.ceil(left / step) + span);
      const end = Math.min(dots.length - 1, Math.floor(right / step) + span);
      const yRay = cp * v + c * sp;
      const zRay = -sp * v + c * cp;
      const wave = seconds * 2.05 - v * 11.5;
      for (let column = start; column <= end; column += 1) {
        const { x, u, grain } = dots[column];
        const dx = c * u - s;
        const dy = yStep * u + yRay;
        const dz = zStep * u + zRay;
        hitDistance = Infinity;
        let dotLight = light;
        const ix = inverse(dx);
        const iy = inverse(dy);
        const iz = inverse(dz);
        if (hasShaft && u >= upright.left && u <= upright.right) intersect(shaft, ox, oy, oz, ix, iy, iz);
        if (hasLowerBeam && u >= lowerArm.left && u <= lowerArm.right) intersect(lowerBeam, ox, oy, oz, ix, iy, iz);
        if (hasBeam && u >= arm.left && u <= arm.right) {
          const shaftDistance = hitDistance;
          if (rollAngle) {
            // Rotate the ray back into the beam's own frame around its nail.
            intersect(beam, beamOriginX, beamOriginY, oz,
              inverse(dx * beamCos + dy * beamSin),
              inverse(dy * beamCos - dx * beamSin), iz);
          } else {
            intersect(beam, ox, oy, oz, ix, iy, iz);
          }
          if (hitDistance < shaftDistance) dotLight = beamLight;
        }
        if (!Number.isFinite(hitDistance)) continue;

        const shade = Math.max(0, dotLight[hitFace]);
        const depth = (camera - hitDistance) * 0.019;
        const phase = 0.5 + 0.5 * Math.sin(wave + u * 4.5 + grain * 0.58);
        const swell = phase * phase * (3 - 2 * phase);
        const radius = pitch * Math.min(0.41,
          (0.20 + shade * 0.21 + depth + grain * 0.025) * (0.78 + 0.29 * swell));
        drawDot(x, y, radius * 0.91 * taper / (pitch * 0.41));
      }
    }
  }

  function drawDot(x, y, radius) {
    const radiusIndex = Math.round(radius * (radiusSteps - 1));
    if (!radiusIndex) return;
    ink.drawImage(dotAtlas, radiusIndex * atlasCell, 0, atlasCell, atlasCell,
      x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
  }

  function measure() {
    const size = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!size || !height) return;
    const scale = Math.min(2, devicePixelRatio || 1, 1440 / size, 2160 / height);
    const pixels = Math.round(size * scale);
    const fineGrid = stage.classList.contains("song-rose");
    const gridPitch = Math.max(3.2, size / (fineGrid ? 176 : 124));
    if (size === edge && height === canvasHeight && canvas.width === pixels && pitch === gridPitch) return;
    edge = size;
    canvasHeight = height;
    canvas.width = pixels;
    canvas.height = Math.round(height * scale);
    ink.setTransform(pixels / size, 0, 0, canvas.height / height, 0, 0);
    pitch = gridPitch;
    buildDotAtlas(2 * pixels / size);
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
    return true;
  }

  const canTurn = () => !crossExited && !reducedMotion.matches && !document.hidden && !stage.inert;

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

  function loadRose() {
    roseLoad ??= import("./hero-rose.js?v=2").then(({ createRosePainter }) => {
      paintRose = createRosePainter();
      if (stage.classList.contains("song-rose") && !frame) paint(reducedMotion.matches ? 0 : elapsed);
    }).catch(() => { /* Keep the cross visible if the rose module cannot load. */ });
  }

  stage.addEventListener("rose-request", loadRose);

  measure();
  new ResizeObserver(measure).observe(canvas);
  canvas.addEventListener("animationend", event => {
    if (!stage.classList.contains("song-cross-exit")) return;
    if (event.animationName !== "cross-hop-away" && event.animationName !== "cross-pole-fall") return;
    crossExited = true;
    sync();
  });
  new MutationObserver(() => {
    const wasExited = crossExited;
    if (!stage.classList.contains("song-cross-exit")) crossExited = false;
    const hex = stage.getAttribute("data-cross-ink") || "#261d1b";
    const color = Number.parseInt(hex.slice(1), 16);
    inkChange = {
      from: inkChannels,
      to: [color >> 16, (color >> 8) & 255, color & 255],
      start: performance.now(),
    };
    const target = Number(stage.classList.contains("song-inverted"));
    const angleTarget = stage.classList.contains("song-loose-cross") ? looseBeamAngle : 0;
    const dropTarget = Number(stage.classList.contains("song-drop-beam"));
    const lowerTarget = Number(stage.classList.contains("song-double-beam"));
    if (dropTarget && (wasExited || stage.classList.contains("song-pole-exit"))) {
      beamDrop = beamDropFrom = beamDropTarget = 1;
    }
    if (target !== beamTarget || angleTarget !== beamAngleTarget || dropTarget !== beamDropTarget ||
        lowerTarget !== lowerBeamTarget) {
      beamFrom = beamProgress;
      beamTarget = target;
      beamAngleFrom = beamAngle;
      beamAngleTarget = angleTarget;
      beamDropFrom = beamDrop;
      beamDropTarget = dropTarget;
      lowerBeamFrom = lowerBeamProgress;
      lowerBeamFallFrom = lowerBeamProgress > 0 ? lowerBeamFall : 0;
      lowerBeamTarget = lowerTarget;
      beamStart = elapsed;
    }
    if (!measure()) paint(reducedMotion.matches ? 0 : elapsed);
    sync();
  }).observe(stage, { attributes: true, attributeFilter: ["data-cross-ink"] });
  new MutationObserver(sync).observe(stage, { attributes: true, attributeFilter: ["inert"] });
  document.addEventListener("visibilitychange", sync);
  reducedMotion.addEventListener("change", sync);
  sync();
}
