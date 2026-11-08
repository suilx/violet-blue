function mountReel(root, embedded = false) {
  const reel = root.querySelector("#reel");
  const stage = root.querySelector("#stage");
  const chapterCount = 14;
  const cardTemplate = root.querySelector("#reel-card");
  const lanes = root.querySelectorAll(".card-lane");
  const clips = [
    { name: "The Word", file: "word" },
    { name: "The Light", file: "light" },
    { name: "The Deep", file: "deep" }
  ];
  const formatNumber = (value) => String(value).padStart(2, "0");
  const cards = Array.from({ length: chapterCount }, (_, index) => {
    const number = formatNumber(index + 1);
    const clip = clips[index % clips.length];
    const chapterName = `第 ${number} 幕`;
    const card = cardTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.chapter = String(index + 1);
    card.setAttribute("aria-label", index < clips.length ? `${chapterName} · ${clip.name}` : chapterName);
    const video = card.querySelector("video");
    video.poster = new URL(`media/${clip.file}.jpg`, import.meta.url).href;
    video.dataset.src = new URL(`media/${clip.file}.mp4`, import.meta.url).href;
    lanes[index % lanes.length].append(card);

    return card;
  });
  const videos = cards.map((card) => card.querySelector("video"));
  const layoutNoise = seededNoise(73);
  const cardLayouts = cards.map((card) => {
    const scale = 0.80 + layoutNoise() * 0.44;
    card.style.setProperty("--card-scale", scale.toFixed(3));
    return { driftX: layoutNoise() * 2 - 1, driftY: layoutNoise() * 2 - 1, x: 0, y: 0, edge: 0 };
  });
  const scriptureArt = root.querySelector("#scripture-art");
  const scriptureFallback = root.querySelector("#scripture-fallback");
  const scriptureFrame = root.querySelector("#scripture-frame");
  const scriptureInk = scriptureFrame.getContext("2d");
  const tileCover = root.querySelector("#tile-cover");
  const tileFront = root.querySelector("#tile-front");
  const tileBack = root.querySelector("#tile-back");
  const dots = root.querySelector("#lens-dots");
  const dotInk = dots.getContext("2d");
  const verses = root.querySelector("#verses");
  const frontVerses = root.querySelector("#verses-front");
  const scriptureCross = root.querySelector("#scripture-cross");
  const codaStem = root.querySelector("#coda-stem");
  const groundType = root.querySelector("#ground-type");
  const fieldCrosses = root.querySelector("#field-crosses");
  const epilogue = root.querySelector(".reel-epilogue");
  const epilogueWords = epilogue.querySelector(".epilogue-words");
  const groundFoot = epilogue.querySelector("#ground-foot");
  const epilogueStem = epilogue.querySelector("#epilogue-stem");
  const readMore = root.querySelector(".reel-read-more");
  const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  const revealEnd = 0.94;
  const cardEntry = 0.55;
  const chapterTravel = 0.82;
  const codaTravel = 1.85;
  const cardPitch = 0.36;
  const upperLane = 0.03;
  const lowerLane = -0.04;
  const fullTurn = Math.PI * 2;
  const chapterAngle = fullTurn / chapterCount;
  const lines = [
    "In the beginning was the Word.",
    "The light shineth in darkness.",
    "Darkness was upon the face of the deep.",
    "Let there be light.",
    "And the Word was with God.",
    "And the darkness comprehended it not.",
    "Upon the face of the waters.",
    "And there was light."
  ];
  const scripture = "IN THE BEGINNING WAS THE WORD, AND THE WORD WAS WITH GOD, AND THE WORD WAS GOD. THE SAME WAS IN THE BEGINNING WITH GOD. ALL THINGS WERE MADE BY HIM; AND WITHOUT HIM WAS NOT ANY THING MADE THAT WAS MADE. IN HIM WAS LIFE; AND THE LIFE WAS THE LIGHT OF MEN. AND THE LIGHT SHINETH IN DARKNESS; AND THE DARKNESS COMPREHENDED IT NOT. ";
  const svgNamespace = "http://www.w3.org/2000/svg";
  const scriptureWords = scripture.trim().split(" ");
  const crossRowPitch = 3.15;
  const crossBeamRow = -15;

  let width = 0;
  let height = 0;
  let tiles = [];
  let epilogueSize;
  const tileTurnLength = 0.12;
  let artwork;
  let artworkRequest = 0;
  let artworkKey;
  let crossBounds;
  let lastAperture;
  let lastScreenTravel;
  let lastMotion;
  let lastYaw;
  let lastReduced;
  let firstChapter = 0;
  let lastChapter = 0;
  let frame = 0;
  let chapter = -1;
  let playing = -1;

  const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
  const smooth = (value) => {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  };

  const verseStart = Math.floor(Math.random() * lines.length);
  const monumentPanels = [
    ["THE WORD", "WAS GOD"],
    ["THE FACE", "OF THE DEEP"],
    ["THE LIGHT", "SHINETH"],
    ["THE FIRST", "AND THE LAST"]
  ];
  const sectorCount = monumentPanels.length;
  const verseTracks = [
    { layer: verses, speed: 0.48, y: 22, offset: 0.34 },
    { layer: frontVerses, speed: 1.00, y: 41, offset: 0.29 },
    { layer: verses, speed: 0.26, y: 52, offset: -0.27 },
    { layer: verses, speed: 0.68, y: 81, offset: -0.30 },
    { layer: verses, speed: 0.48, y: 17, offset: 0.34, echo: true },
    { layer: verses, speed: 0.26, y: 57, offset: -0.27, echo: true },
    { layer: verses, speed: 0.33, y: 54, offset: 0.34, echo: true },
    { layer: verses, speed: 0.68, y: 86, offset: -0.30, echo: true },
    { layer: frontVerses, speed: 0.34, y: 17, offset: 0.09, monumentRow: 0 },
    { layer: frontVerses, speed: 0.22, y: 69, offset: -0.09, monumentRow: 1 }
  ].flatMap((track) => Array.from({ length: sectorCount }, (_, sector) => ({ ...track, sector })))
  .map(({ layer, speed, y, offset, echo, monumentRow, sector }, index) => {
    const monument = monumentPanels[sector][monumentRow];
    const phrase = document.createElement("p");
    phrase.className = "verse";
    if (echo) phrase.classList.add("is-echo");
    if (monument) {
      phrase.classList.add("monument");
      const rowScale = monumentRow === 0 ? 0.72 : 1;
      phrase.style.setProperty("--type-scale", (rowScale * Math.min(1.13, 8.5 / monument.length)).toFixed(2));
    }
    phrase.lang = "en";
    const segments = monument ? Array.from(monument) : lines[(verseStart + index) % lines.length].split(" ");
    const words = [];
    for (const [index, text] of segments.entries()) {
      if (index > 0 && !monument) phrase.append(" ");
      if (text === " ") {
        phrase.append(text);
        continue;
      }
      const element = document.createElement("span");
      element.textContent = text;
      phrase.append(element);
      words.push({ element, center: 0 });
    }
    phrase.style.top = `${y}%`;
    const foreground = layer === frontVerses;
    if (!monument) {
      phrase.style.setProperty("--verse-size", foreground
        ? "clamp(16px, 1.65vw, 27px)"
        : echo ? "clamp(10px, .86vw, 14px)" : "clamp(12px, 1.02vw, 17px)");
    }
    layer.append(phrase);
    return { phrase, words, speed, heading: sector * fullTurn / sectorCount + offset * 1.10,
      rise: (y - 50) * 1.75, depth: foreground ? 46 : monument ? -155 : -95 };
  });

  function updatePlayback() {
    const next = motionPreference.matches || document.hidden ? -1 : chapter;
    if (next === playing) return;
    if (playing >= 0) videos[playing].pause();
    playing = next;
    if (next < 0) return;

    const video = videos[next];
    if (!video.hasAttribute("src")) video.src = video.dataset.src;
    video.play().catch(() => {
      // The cover image stays visible if the browser cannot play the clip.
    });
  }

  function selectChapter(next) {
    if (chapter === next) return;
    chapter = next;
    updatePlayback();
  }

  function seededNoise(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function placeText(parent, text, x, y, size, angle, extent) {
    const line = document.createElementNS(svgNamespace, "text");
    line.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(1)})`);
    line.setAttribute("font-size", size.toFixed(2));
    line.setAttribute("textLength", extent.toFixed(2));
    line.setAttribute("lengthAdjust", "spacingAndGlyphs");
    line.textContent = text;
    parent.append(line);
    return line;
  }

  function buildScriptureCross() {
    const textRun = scripture + scripture;
    const bladeWidths = [129, 148, 158, 150, 132];
    const firstRow = -57;
    const lastRow = 53;
    let cursor = 0;
    const noise = seededNoise(2849);
    const extentAt = (row) => bladeWidths[row - crossBeamRow + 2] ?? 24;
    const addShard = (x, y, extent, fontSize, angle, opacity, mono) => {
      const count = Math.max(1, Math.round(extent / (fontSize * 0.58)));
      const text = textRun.slice(cursor, cursor + count).trim() || "I";
      const line = placeText(scriptureCross, text, x, y, fontSize, angle, extent);
      const groundTone = 1 - 0.67 * smooth((y - 142) / 25);
      line.setAttribute("opacity", (opacity * groundTone).toFixed(2));
      if (mono) line.setAttribute("class", "scripture-shard-mono");
      cursor = (cursor + count) % scripture.length;
    };

    // Leave loose type around the edges so the cross is found in the density.
    const edgeClusters = [-50, -42, -34, -25, crossBeamRow - 2, crossBeamRow + 1, 5, 17, 28, 40, 47];
    for (const [index, cluster] of edgeClusters.entries()) {
      const side = index % 2 ? -1 : 1;
      const aroundBeam = Math.abs(cluster - crossBeamRow) <= 2;
      for (let i = 0; i < 11; i += 1) {
        const row = Math.round(cluster + (noise() - 0.5) * (aroundBeam ? 4 : 11));
        const gap = 2 + noise() ** 1.65 * (row > 31 ? 9 : 18);
        const x = side * (extentAt(row) / 2 + gap);
        const y = row * crossRowPitch + (noise() - 0.5) * 8;
        addShard(x, y, 2 + noise() * 13, 2.2 + noise() * 2.1,
          (noise() - 0.5) * 58, 0.12 + noise() * 0.29, noise() > 0.7);
      }
    }

    for (let row = firstRow; row <= lastRow; row += 1) {
      const y = row * crossRowPitch;
      const extent = extentAt(row);
      const drift = 0.4 * Math.sin(row * 0.29);
      let edge = -extent / 2;
      while (edge < extent / 2) {
        const span = Math.min(extent / 2 - edge, 5 + noise() * 14);
        if (span < 1) break;
        const mono = noise() > 0.8;
        addShard(drift + edge + span / 2, y + (noise() - 0.5) * 2.9,
          span * (0.82 + noise() * 0.18), 2.45 + noise() ** 1.6 * 2.8,
          (noise() - 0.5) * (extent > 80 ? 31 : 17), 0.49 + noise() * 0.5, mono);
        edge += span + noise() * 0.5;
      }
    }
  }

  function groundAt(x) {
    return 782 + 57 * Math.sin((x - 404) / 338) + 12 * Math.sin((x + 34) / 139);
  }

  function buildGroundType() {
    const noise = seededNoise(719);
    let cursor = 0;
    const wordRun = scriptureWords.concat(scriptureWords);
    for (let depth = -12; depth < 325; depth += 4.1 + Math.max(0, depth) * 0.023) {
      let x = -45 + noise() * 40;
      const phase = noise() * fullTurn;
      while (x < 1570) {
        const size = (4.3 + Math.max(0, depth) * 0.033) * (0.74 + noise() * 0.67);
        const count = 2 + Math.floor(noise() * 7);
        const text = wordRun.slice(cursor, cursor + count).join(" ");
        cursor = (cursor + count) % scriptureWords.length;
        const extent = size * text.length * (0.47 + noise() * 0.10);
        const middle = x + extent / 2;
        const ridge = groundAt(middle);
        const drift = (6 + depth * 0.021) * Math.sin(middle / 53 + phase);
        const y = ridge + depth + drift + (noise() - 0.4) * size * 1.8;
        const angle = Math.atan2(groundAt(x + extent) - groundAt(x), extent) * 180 / Math.PI
          + (noise() - 0.5) * 20;
        if (y < 1040 && (depth > 15 || noise() > 0.26)) {
          const shade = Math.round(32 + noise() * 65 + 20 * Math.sin(middle * 0.013 + depth * 0.025));
          const line = placeText(groundType, text, x, y, size, angle, extent);
          line.setAttribute("fill", `rgb(${shade} ${shade} ${shade})`);
          line.setAttribute("opacity", (0.29 + 0.66 * smooth((depth + 16) / 92)).toFixed(2));
        }
        x += extent * (0.86 + noise() * 0.29);
      }
    }
  }

  const fieldMarkers = [
      { x: 225, height: 148, angle: 10, ink: 0.88, beam: 0.34 },
      { x: 618, height: 61, angle: 16, ink: 0.76, beam: 0.26 },
      { x: 816, height: 43, angle: -9, ink: 0.62, beam: 0.30 },
      { x: 910, height: 78, angle: 5, ink: 0.87, beam: 0.22 },
      { x: 1025, height: 52, angle: -14, ink: 0.68, beam: 0.29 },
      { x: 1160, height: 125, angle: 12, ink: 0.84, beam: 0.31 }
  ];

  function buildFieldCrosses() {
    const textRun = scripture + scripture;
    for (const { x, height, angle, ink, beam } of fieldMarkers) {
      const marker = document.createElementNS(svgNamespace, "g");
      marker.setAttribute("transform", `translate(${x} ${groundAt(x) + 7}) rotate(${angle})`);
      fieldCrosses.append(marker);
      const noise = seededNoise(x);
      let cursor = x % scripture.length;
      for (let rise = height; rise > 0; rise -= 2.3 + height * 0.015) {
        const along = 1 - rise / height;
        const arms = Math.max(0, 1 - Math.abs(along - beam) / 0.082);
        const extent = height * (0.043 + arms * 0.39 + noise() * 0.026);
        const size = 2.5 + height * 0.018 + noise() * 1.5;
        const count = Math.max(1, Math.round(extent / (size * 0.53)));
        const text = textRun.slice(cursor, cursor + count).trim() || "I";
        const line = placeText(marker, text, (noise() - 0.5) * 5, -rise, size,
          (noise() - 0.5) * 31, extent);
        line.setAttribute("opacity", (ink * (0.66 + noise() * 0.34)).toFixed(2));
        cursor = (cursor + count) % scripture.length;
      }
    }
  }

  function placeScripture() {
    // Match the bottom-aligned crop of the typographic field.
    const fieldScale = Math.max(width / 1536, height / 1024);
    const footX = width * (width < 640 ? 0.34 : 0.24);
    const fieldX = 768 + (footX - width / 2) / fieldScale;
    const footY = height - (1024 - groundAt(fieldX) - 15) * fieldScale;
    const scale = footY / 338;
    const horizontalScale = Math.min(scale * 0.84, width / 375, 3.1);
    const footRow = 168;
    const tilt = 7;
    const radians = tilt * Math.PI / 180;
    scriptureCross.setAttribute("transform",
      `translate(${footX} ${footY}) rotate(${tilt}) scale(${horizontalScale} ${scale}) translate(0 ${-footRow})`);
    const rise = (footRow - crossBeamRow * crossRowPitch) * scale;
    return { x: footX + rise * Math.sin(radians), y: footY - rise * Math.cos(radians),
      footX, footY, shaftWidth: 24 * horizontalScale, slope: Math.tan(radians) };
  }

  function buildTileWave(originX, originY) {
    const size = clamp(Math.round(width / 63), 12, 24);
    const columns = Math.max(1, Math.ceil(width / size));
    const rows = Math.max(1, Math.ceil(height / size));
    const seedColumn = Math.floor(originX / size);
    const seedRow = Math.floor(originY / size);
    const wave = Array.from({ length: rows * columns }, (_, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = column * size;
      const y = row * size;
      const dx = column - seedColumn;
      const dy = row - seedRow;
      const seed = Math.imul(column + 11, 374761393) ^ Math.imul(row + 5, 668265263);
      const mixed = Math.imul(seed ^ (seed >>> 16), 0x7feb352d);
      const grain = ((mixed ^ (mixed >>> 15)) >>> 0) / 4294967296;
      return {
        index, column, row, dx, dy, x, y,
        width: Math.min(size, width - x), height: Math.min(size, height - y),
        rank: Math.abs(dx) + Math.abs(dy), grain, horizontal: grain > 0.5, time: 0
      };
    });
    // Each tile takes its time from a nearer neighbor, so the wave grows out from one seed.
    const ordered = [...wave].sort((a, b) => a.rank - b.rank);
    let duration = 1;
    for (const tile of ordered) {
      if (!tile.rank) continue;
      const { index, column, row, dx, dy, grain } = tile;
      const across = Math.sign(dx);
      const down = Math.sign(dy) * columns;
      const horizontal = across ? wave[index - across].time + 1 : Infinity;
      const vertical = down ? wave[index - down].time + 1 : Infinity;
      const diagonal = across && down ? wave[index - across - down].time + 1.52 : Infinity;
      const current = Math.sin(column * 0.22 + row * 0.19) * Math.cos(row * 0.31 - column * 0.13);
      tile.time = Math.min(horizontal, vertical, diagonal) + 0.62 * current + 0.64 * (grain - 0.5);
      duration = Math.max(duration, tile.time);
    }
    for (const tile of wave) {
      const linger = tile.rank ? 0.10 * tile.grain ** 4 : 0;
      tile.time = tile.time / duration * (0.90 - tileTurnLength) + linger;
    }
    return wave.map((tile) => ({
      ...tile, cutout: `M${tile.x} ${tile.y}h${tile.width}v${tile.height}h-${tile.width}Z`
    }));
  }

  function buildCodaStem(cross, length) {
    codaStem.replaceChildren();
    epilogueStem.replaceChildren();
    const noise = seededNoise(413);
    const end = height + length;
    const step = clamp(cross.shaftWidth / 6, 6, 10);
    const fragments = scriptureWords.concat(scriptureWords);
    let cursor = 0;
    for (let y = cross.footY - 12; y < end + step / 2; y += step) {
      const tip = smooth((y - end + 105) / 105);
      const width = cross.shaftWidth * (0.94 - tip * 0.73);
      // A tall narrow viewport can bring the extended diagonal close to the edge.
      const x = Math.max(width / 2 + 4, cross.footX - (y - cross.footY) * cross.slope);
      const line = placeText(y < height ? codaStem : epilogueStem, fragments[cursor],
        x + (noise() - 0.5) * width * 0.21, y < height ? y : y - height,
        step * (0.96 + noise() * 0.29), (noise() - 0.5) * 17, width * (0.72 + noise() * 0.28));
      line.setAttribute("opacity", (0.72 + noise() * 0.24).toFixed(2));
      cursor = (cursor + 1) % scriptureWords.length;
    }
  }

  function measureEpilogue(cross) {
    const length = epilogueWords.clientHeight;
    const size = `${width}:${height}:${length}`;
    if (epilogueSize === size) return;
    epilogueSize = size;
    epilogueWords.setAttribute("viewBox", `0 0 ${width} ${length}`);
    epilogueWords.querySelector("#epilogue-paper").setAttribute("gradientTransform",
      `translate(0 ${-height}) scale(${width} ${height})`);
    groundFoot.replaceChildren();
    const noise = seededNoise(926);
    const words = scriptureWords.concat(scriptureWords);
    const startSize = clamp(width / 112, 12, 17);
    let cursor = 0;
    for (let depth = 9; depth < length * 0.92;) {
      const progress = depth / (length * 0.92);
      const size = startSize * (1 - 0.79 * progress);
      const ink = (1 - progress) ** 1.65;
      let x = -22 + noise() * 20;
      while (x < width) {
        const textSize = size * (0.85 + noise() * 0.36);
        const count = 2 + Math.floor(noise() * 7);
        const text = words.slice(cursor, cursor + count).join(" ");
        cursor = (cursor + count) % scriptureWords.length;
        const extent = text.length * textSize * (0.46 + noise() * 0.11);
        const drift = (Math.sin(x / 73 + depth * 0.027) * 8 + Math.sin(x / 211) * 13) * (1 - progress);
        const y = depth + drift + noise() * 10;
        if (noise() < 0.11 + ink * 0.88) {
          const line = placeText(groundFoot, text, x, y, textSize, (noise() - 0.5) * 16, extent);
          line.setAttribute("fill", "#393733");
          line.setAttribute("opacity", (ink * (0.44 + noise() * 0.49)).toFixed(2));
        }
        x += extent * (0.9 + noise() * 0.31 + progress * 2);
      }
      depth += Math.max(15, size * 0.82) + progress * 4;
    }
    buildCodaStem(cross, length);
  }

  async function prepareArtwork(density) {
    if (!scriptureInk) return;
    const key = `${width}:${height}:${density}`;
    if (artworkKey === key) return;
    artworkKey = key;
    const request = ++artworkRequest;
    artwork?.close();
    artwork = undefined;
    scriptureFallback.style.display = "";

    const pixelWidth = Math.round(width * density);
    const pixelHeight = Math.round(height * density);
    const source = document.createElementNS(svgNamespace, "svg");
    source.setAttribute("viewBox", `0 0 ${width} ${height}`);
    source.setAttribute("width", pixelWidth);
    source.setAttribute("height", pixelHeight);
    const defs = document.createElementNS(svgNamespace, "defs");
    scriptureArt.querySelectorAll("#paper-light, #paper-grain").forEach((node) => defs.append(node.cloneNode(true)));
    const paper = scriptureFallback.cloneNode(true);
    for (const layer of [groundType, fieldCrosses]) {
      const style = getComputedStyle(layer);
      const copy = paper.querySelector(`#${layer.id}`);
      for (const property of ["font-family", "font-weight", "fill", "text-anchor"]) {
        copy.style.setProperty(property, style.getPropertyValue(property));
      }
    }
    source.append(defs, paper);
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(source)], { type: "image/svg+xml" }));

    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (request !== artworkRequest) return;

      // Freeze the paper and field as pixels before reusing them across frames.
      const plate = document.createElement("canvas");
      plate.width = pixelWidth;
      plate.height = pixelHeight;
      const ink = plate.getContext("2d", { willReadFrequently: true });
      ink.drawImage(image, 0, 0);
      const bitmap = await createImageBitmap(ink.getImageData(0, 0, pixelWidth, pixelHeight));
      if (request !== artworkRequest) {
        bitmap.close();
        return;
      }
      scriptureFrame.width = pixelWidth;
      scriptureFrame.height = pixelHeight;
      scriptureInk.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
      artwork = bitmap;
      scriptureFallback.style.display = "none";
      lastAperture = undefined;
      scheduleDraw();
    } catch {
      // Keep the original SVG artwork active if snapshotting is unavailable.
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function drawTileWave(progress) {
    if (progress === lastAperture) return;
    lastAperture = progress;
    scriptureArt.style.visibility = progress >= 1 ? "hidden" : "visible";
    scriptureFrame.hidden = !artwork || progress >= 1;
    if (progress >= 1) return;

    if (artwork) {
      drawCanvasTiles(progress);
    }
    const cover = [`M0 0H${width}V${height}H0Z`];
    const front = [];
    const back = [];
    for (const tile of progress > 0 ? tiles : []) {
      if (artwork && (tile.x + tile.width <= crossBounds.left || tile.x >= crossBounds.right
        || tile.y + tile.height <= crossBounds.top || tile.y >= crossBounds.bottom)) continue;
      const turn = (progress - tile.time) / tileTurnLength;
      if (turn <= 0) continue;
      const { x, y, width: w, height: h, horizontal } = tile;
      if (turn >= 1) {
        cover.push(tile.cutout);
        continue;
      }
      const face = Math.abs(Math.cos(Math.PI * turn));
      const faceWidth = horizontal ? Math.round(w * face) : w;
      const faceHeight = horizontal ? h : Math.round(h * face);
      const left = x + Math.floor((w - faceWidth) / 2);
      const top = y + Math.floor((h - faceHeight) / 2);
      if (!faceWidth || !faceHeight) continue;
      const facePath = `M${left} ${top}h${faceWidth}v${faceHeight}h-${faceWidth}Z`;
      if (turn < 0.5) {
        if (!artwork) front.push(facePath);
      } else {
        cover.push(facePath);
        if (!artwork && face < 0.88) back.push(facePath);
      }
    }
    // The same cutouts expose the reel and clip the introductory lettering.
    tileCover.setAttribute("d", cover.join(""));
    tileFront.setAttribute("d", front.join(""));
    tileBack.setAttribute("d", back.join(""));
  }

  function drawCanvasTiles(progress) {
    scriptureInk.drawImage(artwork, 0, 0, width, height);
    if (progress <= 0) return;

    const front = new Path2D();
    const back = new Path2D();
    let run;
    for (const tile of tiles) {
      const turn = (progress - tile.time) / tileTurnLength;
      const { x, y, width: w, height: h, horizontal } = tile;
      // Erase fully turned tiles together when they share a row.
      if (turn >= 1 && run && run.y === y && run.right === x) {
        run.right += w;
        continue;
      }
      if (run) {
        scriptureInk.clearRect(run.left, run.y, run.right - run.left, run.height);
        run = undefined;
      }
      if (turn <= 0) continue;
      if (turn >= 1) {
        run = { left: x, right: x + w, y, height: h };
        continue;
      }
      const face = Math.abs(Math.cos(Math.PI * turn));
      const faceWidth = horizontal ? Math.round(w * face) : w;
      const faceHeight = horizontal ? h : Math.round(h * face);
      if (!faceWidth || !faceHeight) continue;
      const left = x + Math.floor((w - faceWidth) / 2);
      const top = y + Math.floor((h - faceHeight) / 2);
      if (turn < 0.5) front.rect(left, top, faceWidth, faceHeight);
      else {
        scriptureInk.clearRect(left, top, faceWidth, faceHeight);
        if (face < 0.88) back.rect(left, top, faceWidth, faceHeight);
      }
    }
    if (run) scriptureInk.clearRect(run.left, run.y, run.right - run.left, run.height);
    scriptureInk.fillStyle = "rgb(44 40 37 / 18%)";
    scriptureInk.fill(front);
    scriptureInk.fillStyle = "rgb(0 0 0 / 12%)";
    scriptureInk.fill(back);
  }

  function drawVerses(yaw, reduced) {
    const radius = width * 0.43;
    const lensDepth = Math.min(width * 0.28, 265);
    const degrees = 180 / Math.PI;
    for (const { phrase, words, speed, heading, rise, depth } of verseTracks) {
      const relative = heading - yaw + Math.sin(yaw) * (speed - 0.5) * 0.25;
      const bearing = Math.atan2(Math.sin(relative), Math.cos(relative));
      const inView = Math.abs(bearing) < 1.13;
      phrase.style.visibility = inView ? "visible" : "hidden";
      if (!inView) continue;
      const x = width * 0.66 * Math.tan(bearing);
      phrase.style.transform = `translate(calc(-50% + ${x}px), -50%)`;
      for (const { element, center } of words) {
        const angle = reduced ? 0 : clamp((x + center) / radius, -1.35, 1.35);
        const sine = Math.sin(angle);
        const cosine = Math.cos(angle);
        const bend = 1 - cosine;
        const shift = radius * (sine - angle);
        const z = depth + bend * lensDepth;
        const y = bend * rise;
        // Follow the local tangent so adjacent words keep their spacing on the curve.
        const slopeZ = sine * lensDepth / radius;
        const slopeY = sine * rise / radius;
        const flatLength = Math.hypot(cosine, slopeZ);
        const turn = -Math.atan2(slopeZ, cosine) * degrees;
        const tilt = Math.atan2(slopeY, flatLength) * degrees;
        const wordScale = Math.hypot(flatLength, slopeY);
        element.style.transform = reduced ? "none"
          : `translate3d(${shift}px, ${y}px, ${z}px) rotateY(${turn}deg) rotateZ(${tilt}deg) scaleX(${wordScale})`;
      }
    }
  }

  function drawDots(yaw, reduced) {
    if (!dotInk) return;
    dotInk.clearRect(0, 0, width, height);
    const step = clamp(width / 47, 19, 34);
    const centerX = width / 2;
    const centerY = height / 2;
    const interval = fullTurn / Math.round(fullTurn * width * 0.52 / step);
    const firstColumn = Math.ceil((yaw - 1.18) / interval);
    const lastColumn = Math.floor((yaw + 1.18) / interval);
    const strength = reduced ? 0 : 0.34;
    dotInk.beginPath();
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const bearing = column * interval - yaw;
      const dx = width * 0.52 * Math.tan(bearing);
      const pitch = reduced ? 1 : Math.cos(bearing);
      const columnDistance = (dx / (width * 0.54)) ** 2;
      for (let y = -height; y <= height; y += step) {
        const dy = y / pitch;
        const distance = columnDistance + (dy / (height * 0.54)) ** 2;
        const bend = 1 / Math.sqrt(1 + strength * distance);
        const px = centerX + dx * bend;
        const py = centerY + dy * bend;
        if (px < 0 || px > width || py < 0 || py > height) continue;
        const size = 1.75 * bend;
        dotInk.moveTo(px + size, py);
        dotInk.arc(px, py, size, 0, Math.PI * 2);
      }
    }
    dotInk.fillStyle = "rgb(16 14 18 / 56%)";
    dotInk.fill();
  }

  function draw() {
    frame = 0;
    const distance = embedded ? Math.max(0, -reel.getBoundingClientRect().top) : window.scrollY;
    const reelEnd = lastChapter + codaTravel;
    const screenTravel = Math.min(distance / height, reelEnd);
    const reduced = motionPreference.matches;
    if (screenTravel === lastScreenTravel && reduced === lastMotion && lastAperture !== undefined) return;
    lastScreenTravel = screenTravel;
    lastMotion = reduced;
    const open = smooth(screenTravel / revealEnd);
    const coda = screenTravel === reelEnd ? 1 : clamp((screenTravel - lastChapter) / codaTravel);
    const close = smooth(coda);
    const opening = reduced ? Number(open > 0.5) : open;
    const aperture = opening * (1 - (reduced ? Number(close > 0.5) : close));
    drawTileWave(aperture);
    if (embedded) codaStem.style.opacity = String(smooth((close - 0.48) / 0.49));

    const position = (screenTravel - firstChapter) / chapterTravel;
    const selected = clamp(Math.round(position), 0, cards.length - 1);

    const viewPosition = reduced ? selected : position;
    const turnPosition = coda ? chapterCount - 1 + (reduced ? Number(close > 0.5) : coda)
      : reduced ? selected : position < 0 ? position * 0.36 : position;
    const yaw = turnPosition * chapterAngle;
    const cardsAllowed = screenTravel >= cardEntry && coda < 1 && (!reduced || close < 0.5);
    let activeChapter = -1;
    cards.forEach((card, index) => {
      const layout = cardLayouts[index];
      const x = width * (layout.x + (index - viewPosition) * cardPitch);
      const visible = cardsAllowed && Math.abs(x) < layout.edge;
      if (visible) card.style.transform = `translate(${x}px, ${layout.y}px)`;
      if ((card.getAttribute("aria-hidden") === "true") === visible) {
        card.setAttribute("aria-hidden", String(!visible));
      }
      if (visible && index === selected && Math.abs(x) < width / 2) activeChapter = index;
    });
    selectChapter(activeChapter);
    if (aperture > 0 && (lastYaw !== yaw || lastReduced !== reduced)) {
      lastYaw = yaw;
      lastReduced = reduced;
      drawDots(yaw, reduced);
      drawVerses(yaw, reduced);
    }
  }

  function scheduleDraw() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function measure() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    if (!width || !height) return;
    const cross = placeScripture();
    tiles = buildTileWave(cross.x, cross.y);
    const lateralDrift = width <= 640 ? 0.036 : 0.066;
    const laneHeights = Array.from(lanes, (lane) => lane.clientHeight);
    cards.forEach((card, index) => {
      const layout = cardLayouts[index];
      const lane = index % 2;
      const clearance = Math.max(0, (laneHeights[lane] - card.offsetHeight) / 2 - 8);
      layout.x = (lane ? lowerLane : upperLane) + layout.driftX * lateralDrift;
      layout.y = layout.driftY * Math.min(clearance, height * 0.057, 62);
      layout.edge = (width + card.offsetWidth) / 2;
    });
    const density = Math.min(1.5, window.devicePixelRatio || 1);
    dots.width = Math.round(width * density);
    dots.height = Math.round(height * density);
    dotInk?.setTransform(density, 0, 0, density, 0, 0);
    const firstCard = cardLayouts[0];
    firstChapter = cardEntry + chapterTravel * ((firstCard.edge + 2) / width - firstCard.x) / cardPitch;
    lastChapter = firstChapter + chapterTravel * (chapterCount - 1);
    const closingPause = embedded ? height * 0.24 : 0;
    reel.style.setProperty("--reel-height", `${Math.ceil((lastChapter + codaTravel) * height + window.innerHeight + closingPause)}px`);
    scriptureArt.setAttribute("viewBox", `0 0 ${width} ${height}`);
    if (embedded) measureEpilogue(cross);
    const stageRect = stage.getBoundingClientRect();
    const crossRect = scriptureCross.getBoundingClientRect();
    const stemRect = codaStem.getBoundingClientRect();
    crossBounds = {
      left: (embedded ? Math.min(crossRect.left, stemRect.left) : crossRect.left) - stageRect.left - 2,
      right: crossRect.right - stageRect.left + 2,
      top: crossRect.top - stageRect.top - 2,
      bottom: (embedded ? Math.max(crossRect.bottom, stemRect.bottom) : crossRect.bottom) - stageRect.top + 2
    };
    lastAperture = lastYaw = undefined;
    prepareArtwork(density);
    for (const { phrase, words } of verseTracks) {
      const center = phrase.offsetWidth / 2;
      for (const word of words) {
        word.center = word.element.offsetLeft + word.element.offsetWidth / 2 - center;
      }
    }
    scheduleDraw();
  }

  if (embedded) {
    epilogue.hidden = false;
    readMore.addEventListener("click", () => root.host.dispatchEvent(new Event("reel-read-more")));
  }
  motionPreference.addEventListener("change", () => {
    updatePlayback();
    scheduleDraw();
  });
  document.addEventListener("visibilitychange", updatePlayback);
  window.addEventListener("scroll", scheduleDraw, { passive: true });
  window.addEventListener("resize", measure);
  buildGroundType();
  buildFieldCrosses();
  buildScriptureCross();
  measure();
  document.fonts.ready.then(measure);
}

export async function embedReel(host) {
  const revision = new URL(import.meta.url).search;
  const markupUrl = new URL("./index.html", import.meta.url);
  markupUrl.search = revision;
  const response = await fetch(markupUrl);
  if (!response.ok) throw new Error("Unable to load the reel.");
  const source = new DOMParser().parseFromString(await response.text(), "text/html");
  const markup = source.querySelector("#reel");
  const epilogue = source.querySelector(".reel-epilogue");
  const template = source.querySelector("#reel-card");
  if (!markup || !epilogue || !template) throw new Error("The reel is missing its markup.");

  const root = host.attachShadow({ mode: "open" });
  const fallback = document.createElement("slot");
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  const stylesheetUrl = new URL("./reel.css", import.meta.url);
  stylesheetUrl.search = revision;
  stylesheet.href = stylesheetUrl.href;
  const styled = new Promise((resolve, reject) => {
    stylesheet.onload = resolve;
    stylesheet.onerror = reject;
  });
  root.append(stylesheet, fallback);
  await styled;
  fallback.replaceWith(markup, epilogue, template);
  mountReel(root, true);
  if (location.hash === "#thirdPage") {
    host.scrollIntoView({ block: "start" });
  }
}

if (document.querySelector("#reel")) mountReel(document);
