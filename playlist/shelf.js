let catalogue;
let lyricCatalogue;

export async function mountPlaylistShelf(host, back, homeMusic) {
  catalogue ??= fetch(new URL('tracks.json?v=5', import.meta.url)).then(response => {
    if (!response.ok) throw Error('Playlist unavailable');
    return response.json();
  }).catch(error => {
    catalogue = undefined;
    throw error;
  });
  lyricCatalogue ??= fetch(new URL('lyrics.json?v=1', import.meta.url)).then(response => {
    if (!response.ok) throw Error('Playlist lyrics unavailable');
    return response.json();
  }).catch(() => {
    lyricCatalogue = undefined;
    return {};
  });
  const [tracks, lyricsByTrack] = await Promise.all([catalogue, lyricCatalogue]);
  if (!host.isConnected) return;

  host.innerHTML = `
    <div class="cd-browser">
      <div class="cd-shelf" role="group" aria-label="Browse playlist covers"></div>
      <div class="cd-caption">
        <button type="button" data-step="-1" aria-label="Previous cover">←</button>
        <div><strong></strong><small></small></div>
        <button type="button" data-step="1" aria-label="Next cover">→</button>
      </div>
      <section class="cd-home-lyrics" aria-label="同步歌詞" hidden></section>
    </div>
    <div class="cd-player" hidden>
      <div class="cd-player-title">
        <p>Selected track</p><h3></h3><small></small>
        <section class="cd-lyrics" aria-label="Lyrics" hidden>
          <div class="cd-lyrics-header"><h4>Lyrics</h4><button type="button" disabled>回到開頭</button></div>
          <div class="cd-lyrics-lines" tabindex="0"></div>
        </section>
      </div>
      <button class="cd-case cd-player-art" type="button" aria-label="Back to covers"></button>
      <div class="cd-transport" role="group" aria-label="Playback controls">
        <button class="cd-control cd-play" type="button" aria-label="Play">
          <span aria-hidden="true">PLAY</span>
        </button>
        <div class="cd-timeline">
          <input class="cd-range cd-seek" type="range" min="0" max="0" step="0.1" value="0" aria-label="Playback position" disabled>
          <div class="cd-times"><span>0:00</span><span>–:––</span></div>
        </div>
        <div class="cd-volume">
          <button class="cd-control cd-mute" type="button" aria-label="Mute">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z"/><path class="cd-sound-icon" d="M16 9a4 4 0 010 6m2-8a7 7 0 010 10"/><path class="cd-muted-icon" d="m16 10 4 4m0-4-4 4"/></svg>
          </button>
          <input class="cd-range cd-level" type="range" min="0" max="100" value="80" aria-label="Volume">
        </div>
        <p class="cd-playback-status" role="status" hidden></p>
      </div>
    </div>`;
  const browser = host.querySelector('.cd-browser');
  const player = host.querySelector('.cd-player');
  const shelf = host.querySelector('.cd-shelf');
  const title = host.querySelector('.cd-caption strong');
  const meta = host.querySelector('.cd-caption small');
  const homeLyrics = host.querySelector('.cd-home-lyrics');
  const trackTitle = player.querySelector('h3');
  const trackArtist = player.querySelector('small');
  const playerCover = player.querySelector('.cd-player-art');
  const lyrics = player.querySelector('.cd-lyrics');
  const restart = lyrics.querySelector('button');
  const lyricsLines = lyrics.querySelector('.cd-lyrics-lines');
  const transport = host.querySelector('.cd-transport');
  const play = transport.querySelector('.cd-play');
  const playLabel = play.firstElementChild;
  const seek = transport.querySelector('.cd-seek');
  const [elapsed, duration] = transport.querySelectorAll('.cd-times span');
  const mute = transport.querySelector('.cd-mute');
  const level = transport.querySelector('.cd-level');
  const playbackStatus = transport.querySelector('.cd-playback-status');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const { signal } = controller;
  const swatches = ['#373c51', '#6f3a3b', '#4c5048', '#706151', '#464650', '#465764', '#633a45'];
  const wrap = index => (index % tracks.length + tracks.length) % tracks.length;
  let visible = new Set();
  let nextVisible = new Set();
  let selected = -1;
  let position = 0;
  let target = 0;
  let frame = 0;
  let lastFrame = 0;
  let geometry;
  let drag;
  let suppressClick = false;
  let wheelStop;
  let lastLyricLines;
  let lastLyricIndex = -1;
  let audio;
  let stream;
  let volume = .8;
  let muted = false;
  let preview;
  let previewTimer;
  let returning = false;

  function trackStream(track) {
    return 'https://music.163.com/song/media/outer/url?id=' + track.id + '.mp3';
  }

  function releaseAudio(media) {
    media.pause();
    media.removeAttribute('src');
    media.load();
  }

  function stopPreview() {
    clearTimeout(previewTimer);
    if (!preview) return;
    const media = preview;
    preview = undefined;
    releaseAudio(media);
  }

  function queuePreview() {
    if (selected < 0 || browser.hidden || returning || frame || drag?.moved || wheelStop || document.hidden) return;
    const track = tracks[selected];
    previewTimer = setTimeout(() => {
      const media = new Audio(trackStream(track));
      preview = media;
      media.volume = volume;
      media.muted = muted;
      media.addEventListener('timeupdate', () => {
        if (preview === media && media.currentTime >= 12) stopPreview();
      });
      media.addEventListener('ended', () => {
        if (preview === media) stopPreview();
      }, {once:true});
      media.play().catch(() => {
        if (preview === media) stopPreview();
      });
    }, 3000);
  }

  function setText(element, value, language) {
    element.textContent = value;
    element.lang = language || '';
  }

  function updateHomeLyrics() {
    const {lines, index} = homeMusic.currentCue();
    if (homeMusic.audio.paused || index < 0) {
      homeLyrics.hidden = true;
      return;
    }
    homeLyrics.hidden = false;
    if (lines === lastLyricLines && index === lastLyricIndex) return;
    lastLyricLines = lines;
    lastLyricIndex = index;
    const cues = document.createElement('div');
    cues.className = 'cd-home-lyric-cues';
    for (const offset of [-1, 0, 1]) {
      const line = document.createElement('p');
      line.textContent = lines[index + offset]?.text || '';
      cues.append(line);
    }
    homeLyrics.replaceChildren(cues);
  }

  function cover(track) {
    const insert = document.createElement('span');
    insert.className = 'cd-insert';
    const label = document.createElement('span');
    setText(label, track.title, track.titleLang);
    const image = document.createElement('img');
    image.alt = '';
    image.hidden = true;
    image.draggable = false;
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('load', () => { image.hidden = false; }, { once:true });
    insert.append(label, image);
    return {insert, image};
  }

  const books = tracks.map((track, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cd-book';
    button.hidden = index !== 0;
    button.tabIndex = -1;
    button.setAttribute('aria-label', 'Select ' + track.title);
    button.innerHTML = '<span class="cd-spine"><b></b><small></small></span><span class="cd-case" hidden></span>';
    const spine = button.firstElementChild;
    const face = button.lastElementChild;
    spine.style.setProperty('--cd-inlay', swatches[index % swatches.length]);
    setText(spine.firstElementChild, track.title, track.titleLang);
    spine.lastElementChild.textContent = String(index + 1).padStart(2, '0');
    const {insert, image} = cover(track);
    face.append(insert);
    button.addEventListener('click', () => {
      const center = Math.round(position);
      if (index === selected && Math.abs(target - position) < .2) {
        showPlayer(track, face);
      } else {
        const half = Math.floor(tracks.length / 2);
        move(center + wrap(index - center + half) - half);
      }
    });
    return {button, spine, face, image};
  });
  shelf.replaceChildren(...books.map(book => book.button));

  function updateSelection(index) {
    if (selected === index) return;
    if (selected >= 0) {
      books[selected].button.tabIndex = -1;
      books[selected].button.classList.remove('is-selected');
      books[selected].button.setAttribute('aria-label', 'Select ' + tracks[selected].title);
    }
    selected = index;
    const {button} = books[index];
    button.tabIndex = 0;
    button.classList.add('is-selected');
    button.setAttribute('aria-label', 'Open player for ' + tracks[index].title);
    const track = tracks[index];
    setText(title, track.title, track.titleLang);
    setText(meta, track.artist + ' · ' + String(index + 1).padStart(2, '0') + ' / ' + tracks.length, track.artistLang);
  }

  function primeCovers(index) {
    for (const offset of [0, -1, 1]) {
      const nearby = wrap(index + offset);
      const {cover} = tracks[nearby];
      const {image} = books[nearby];
      if (cover && !image.hasAttribute('src')) image.src = cover;
    }
  }

  function measure() {
    if (browser.hidden) return;
    const shelfWidth = shelf.clientWidth;
    if (!shelfWidth) return;
    const {offsetHeight:height, offsetWidth:width} = books[Math.max(0, selected)].button;
    const compact = shelfWidth < 540;
    const radius = compact ? 5 : 8;
    const reach = Math.min(shelfWidth * .46, height * 1.65);
    const nearest = Math.min(width * .5 + height * .06, reach * .93);
    geometry = {height, radius, nearest, spread:(reach - nearest) / (1 - Math.exp(-(radius - 1) / 6)),
      dragUnit:compact ? 26 : 38};
    render();
    if (!frame && !drag?.moved && !wheelStop) primeCovers(selected);
  }

  function render() {
    if (!geometry || browser.hidden) return;
    const {height, radius, nearest, spread} = geometry;
    const limit = radius + .65;
    const center = Math.round(position);
    updateSelection(wrap(center));
    nextVisible.clear();
    for (let slot = Math.ceil(position - limit); slot <= Math.floor(position + limit); slot++) {
      const index = wrap(slot);
      const book = books[index];
      const {button, spine, face} = book;
      nextVisible.add(index);
      if (button.hidden) button.hidden = false;
      const relative = slot - position;
      const distance = Math.abs(relative);
      const direction = Math.sign(relative);
      const x = distance < 1 ? distance * (nearest + (1 - distance) * (nearest - spread / 6))
        : nearest + spread * (1 - Math.exp(-(distance - 1) / 6));
      const scale = 1 / (1 + (distance / (radius * .6)) ** 1.65);
      const opening = Math.max(0, 1 - distance);
      const front = opening ** 2 * (3 - 2 * opening);
      button.style.transform = `translate3d(calc(-50% + ${direction * x}px), ${(1 - scale) * height * .21}px, 0) scale(${scale})`;
      const opacity = Math.min(1, (limit - distance) / .65);
      if (book.opacity !== opacity) {
        button.style.opacity = opacity;
        book.opacity = opacity;
      }
      const depth = 80 - Math.abs(slot - center);
      if (book.depth !== depth) {
        button.style.zIndex = depth;
        book.depth = depth;
      }
      if (face.hidden !== (front === 0)) face.hidden = front === 0;
      if (front > 0) face.style.transform = `rotateY(${direction * 79 * (1 - front)}deg)`;
      if (book.front !== front) {
        if (front > 0) face.style.opacity = front;
        spine.style.opacity = 1 - front;
        book.front = front;
      }
    }
    for (const index of visible) {
      if (!nextVisible.has(index)) books[index].button.hidden = true;
    }
    const previousVisible = visible;
    visible = nextVisible;
    nextVisible = previousVisible;
  }

  function tick(now) {
    const dt = Math.min(.05, lastFrame ? (now - lastFrame) / 1000 : .016);
    lastFrame = now;
    position += (target - position) * (1 - Math.exp(-(drag?.moved ? 29 : 11.6) * dt));
    if (Math.abs(position - target) < .009) position = target;
    render();
    frame = position === target ? 0 : requestAnimationFrame(tick);
    if (!frame) {
      lastFrame = 0;
      queuePreview();
    }
  }

  function move(index, immediate = false) {
    stopPreview();
    target = index;
    if (!drag?.moved && !wheelStop && Number.isInteger(index)) primeCovers(index);
    if (immediate || motion.matches) {
      cancelAnimationFrame(frame);
      frame = lastFrame = 0;
      position = target;
      render();
      queuePreview();
    } else if (!frame) frame = requestAnimationFrame(tick);
  }

  function followPlayback(audio, lines, nodes) {
    let index = -1;
    let restoreLine;

    function updateCue(event) {
      if (!audio.isConnected) return;
      const next = lines.findLastIndex(line => line.t <= audio.currentTime);
      if (next === index) return;
      restoreLine?.();
      restoreLine = undefined;
      nodes[index]?.removeAttribute('aria-current');
      index = next;
      const active = nodes[index];
      active?.setAttribute('aria-current', 'true');
      if (active && !audio.paused && !audio.seeking && event.type !== 'seeked' && !motion.matches) {
        restoreLine = rollLyric(active);
      }
      lyricsLines.classList.toggle('has-active-line', Boolean(active));
      lyricsLines.scrollTo({
        top: active ? active.offsetTop - (lyricsLines.clientHeight - active.offsetHeight) / 2 : 0,
        behavior: motion.matches || event.type === 'seeked' ? 'instant' : 'smooth'
      });
    }

    for (const event of ['playing', 'timeupdate', 'seeked']) audio.addEventListener(event, updateCue);
  }

  function rollLyric(line) {
    const text = line.textContent;
    if (!text.trim() || !Element.prototype.animate || !Intl.Segmenter) return;

    const accessible = document.createElement('span');
    accessible.className = 'cd-lyric-readable';
    accessible.textContent = text;
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    const words = new Intl.Segmenter(undefined, {granularity:'word'});
    const graphemes = new Intl.Segmenter();
    const reels = [];
    const symbols = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (const {segment:word} of words.segment(text)) {
      if (!word.trim()) {
        visual.append(word);
        continue;
      }
      const group = document.createElement('span');
      if (/^[\p{Script=Latin}\p{Mark}\d’'-]{1,16}$/u.test(word)) group.className = 'cd-lyric-word';
      for (const {segment:glyph} of graphemes.segment(word)) {
        const slot = document.createElement('span');
        slot.className = 'cd-lyric-slot';
        const measure = document.createElement('span');
        measure.textContent = glyph;
        const reel = document.createElement('span');
        reel.className = 'cd-lyric-reel';
        const steps = 4 + reels.length % 3;
        for (let step = 0; step <= steps; step++) {
          const face = document.createElement('span');
          face.textContent = step === steps ? glyph : symbols[Math.floor(Math.random() * symbols.length)];
          reel.append(face);
        }
        slot.append(measure, reel);
        group.append(slot);
        reels.push({reel, steps});
      }
      visual.append(group);
    }
    line.replaceChildren(accessible, visual);

    const animations = reels.map(({reel, steps}, i) => reel.animate([
      {transform:'translateY(0)'}, {transform:'translateY(-' + (steps * 1.5) + 'em)'},
    ], {
      duration:440 + (i % 5) * 23, delay:Math.min(i, 18) * 14,
      easing:'cubic-bezier(.22,.61,.36,1)', fill:'both',
    }));
    function restore() {
      if (line.contains(visual)) line.textContent = text;
      for (const animation of animations) animation.cancel();
    }
    Promise.allSettled(animations.map(animation => animation.finished)).then(restore);
    return restore;
  }

  function formatTime(seconds) {
    const time = Math.floor(seconds);
    return Math.floor(time / 60) + ':' + String(time % 60).padStart(2, '0');
  }

  function showStatus(message) {
    playbackStatus.textContent = message;
    playbackStatus.hidden = !message;
  }

  function updateTransport() {
    const playing = audio && !audio.paused && !audio.ended && !audio.error;
    const action = playing ? 'Pause' : 'Play';
    if (play.getAttribute('aria-label') !== action) {
      play.setAttribute('aria-label', action);
      playLabel.textContent = action.toUpperCase();
    }
    const length = Number.isFinite(audio?.duration) && !audio.error ? audio.duration : 0;
    const time = length ? Math.min(audio.currentTime, length) : 0;
    seek.disabled = restart.disabled = !length;
    seek.max = length;
    seek.value = time;
    seek.setAttribute('aria-valuetext', formatTime(time) + ' / ' + (length ? formatTime(length) : '–:––'));
    seek.style.setProperty('--fill', (length ? time / length * 100 : 0) + '%');
    elapsed.textContent = formatTime(time);
    duration.textContent = length ? formatTime(length) : '–:––';
  }

  function updateVolume() {
    const silent = muted || volume === 0;
    mute.toggleAttribute('data-muted', silent);
    mute.setAttribute('aria-label', silent ? 'Unmute' : 'Mute');
    level.value = muted ? 0 : Math.round(volume * 100);
    level.style.setProperty('--fill', level.value + '%');
    if (audio) {
      audio.volume = volume;
      audio.muted = muted;
    }
  }

  function clearTransport() {
    const media = audio;
    audio = undefined;
    if (!media) return;
    releaseAudio(media);
    media.remove();
  }

  function showPlayer(track, face) {
    const origin = face.getBoundingClientRect();
    stopPreview();
    clearTimeout(wheelStop);
    wheelStop = undefined;
    cancelAnimationFrame(frame);
    frame = lastFrame = 0;
    position = target = Math.round(position);
    const {insert, image} = cover(track);
    if (track.cover) image.src = track.cover;
    playerCover.replaceChildren(insert);
    setText(trackTitle, track.title, track.titleLang);
    setText(trackArtist, track.artist, track.artistLang);
    const suppliedLines = lyricsByTrack[track.id];
    const publishedLines = suppliedLines ?? homeMusic.lyricsFor(track.title);
    const lineNodes = publishedLines.map(({text}) => {
      const line = document.createElement('p');
      line.textContent = text;
      return line;
    });
    lyricsLines.replaceChildren(...lineNodes);
    lyricsLines.scrollTop = 0;
    lyricsLines.classList.remove('has-active-line');
    lyrics.hidden = !publishedLines.length;
    homeMusic.audio.pause();
    browser.hidden = true;
    player.hidden = false;
    const media = document.createElement('audio');
    audio = media;
    stream = trackStream(track);
    media.hidden = true;
    transport.append(media);
    updateTransport();
    updateVolume();
    showStatus('');
    if (publishedLines.length) followPlayback(media, publishedLines, lineNodes);
    for (const event of ['durationchange', 'timeupdate', 'play', 'pause', 'ended', 'error', 'playing', 'waiting']) {
      media.addEventListener(event, () => {
        if (audio !== media) return;
        updateTransport();
        if (event === 'error') showStatus('Playback unavailable. Press play to retry.');
        else if (event === 'waiting' && !media.paused) showStatus('Loading…');
        else if (event === 'playing' || (event === 'pause' && !media.error)) showStatus('');
      });
    }
    back.setAttribute('aria-label', 'Back to covers');
    if (!motion.matches && origin.width) {
      const bounds = player.getBoundingClientRect();
      const inset = [origin.top - bounds.top, bounds.right - origin.right, bounds.bottom - origin.bottom, origin.left - bounds.left]
        .map(value => Math.max(0, value) + 'px').join(' ');
      player.animate([{clipPath:`inset(${inset})`},{clipPath:'inset(0)'}], {
        duration:595, easing:'cubic-bezier(.22,.74,.26,1)'
      });
    }
    back.focus({preventScroll:true});
  }

  function returnToCovers(event) {
    if (player.hidden) return;
    event.stopImmediatePropagation();
    if (returning) return;
    clearTransport();
    browser.hidden = false;
    measure();

    function finish() {
      player.hidden = true;
      player.inert = browser.inert = false;
      browser.removeAttribute('data-returning');
      returning = false;
      if (!host.isConnected) return;
      back.setAttribute('aria-label', 'Back to Playlist');
      queuePreview();
      books[selected].button.focus({preventScroll:true});
    }

    const from = playerCover.getBoundingClientRect();
    const to = books[selected].face.getBoundingClientRect();
    if (motion.matches || !playerCover.animate || !from.width || !to.width) {
      finish();
      return;
    }
    returning = true;
    player.inert = browser.inert = true;
    browser.setAttribute('data-returning', '');
    for (const animation of player.getAnimations()) animation.cancel();
    const transform = 'translate(' + (to.left - from.left) + 'px,' + (to.top - from.top) + 'px) scale(' +
      (to.width / from.width) + ',' + (to.height / from.height) + ')';
    const travel = playerCover.animate([
      {transform:'none', transformOrigin:'top left'},
      {transform, transformOrigin:'top left'},
    ], {duration:470, easing:'cubic-bezier(.22,.74,.26,1)'});
    const fade = [{opacity:1}, {opacity:0}];
    const fades = [trackTitle.parentElement, transport].map(section =>
      section.animate(fade, {duration:200, fill:'forwards'}));
    travel.finished.then(finish, finish).finally(() => {
      for (const animation of fades) animation.cancel();
    });
  }

  back.addEventListener('click', returnToCovers, {capture:true, signal});
  playerCover.addEventListener('click', returnToCovers);
  play.addEventListener('click', () => {
    const media = audio;
    if (!media) return;
    if (!media.paused && !media.ended) {
      media.pause();
      return;
    }
    if (!media.hasAttribute('src') || media.error) media.src = stream;
    showStatus('');
    media.play().catch(error => {
      if (audio === media && error.name !== 'AbortError') {
        updateTransport();
        showStatus('Playback unavailable. Press play to retry.');
      }
    });
  });
  seek.addEventListener('input', () => {
    if (audio && !seek.disabled) {
      audio.currentTime = Number(seek.value);
      updateTransport();
    }
  });
  mute.addEventListener('click', () => {
    muted = !(muted || volume === 0);
    if (!muted && volume === 0) volume = .8;
    updateVolume();
  });
  level.addEventListener('input', () => {
    volume = Number(level.value) / 100;
    muted = false;
    updateVolume();
  });
  restart.addEventListener('click', () => {
    if (audio && !restart.disabled) audio.currentTime = 0;
  });
  host.addEventListener('keydown', event => {
    if (event.key === 'Escape') returnToCovers(event);
  });
  for (const arrow of host.querySelectorAll('[data-step]')) {
    arrow.addEventListener('click', () => move(Math.round(target) + Number(arrow.dataset.step)));
  }
  shelf.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    move(Math.round(target) + (event.key === 'ArrowLeft' ? -1 : 1), true);
    books[selected].button.focus({preventScroll:true});
  });
  shelf.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    drag = {id:event.pointerId, x:event.clientX, y:event.clientY, start:position, moved:false};
  });
  shelf.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId || !geometry) return;
    const distance = drag.x - event.clientX;
    if (!drag.moved && Math.abs(distance) < Math.max(10, Math.abs(drag.y - event.clientY))) return;
    if (!drag.moved) {
      drag.moved = true;
      clearTimeout(wheelStop);
      wheelStop = undefined;
      shelf.setPointerCapture(event.pointerId);
    }
    move(drag.start + distance / geometry.dragUnit);
  });
  function endDrag(event) {
    if (drag?.id !== event.pointerId) return;
    const moved = drag.moved;
    drag = undefined;
    if (moved) {
      suppressClick = true;
      move(Math.round(target));
    }
  }
  for (const name of ['pointerup','pointercancel']) shelf.addEventListener(name, endDrag);
  shelf.addEventListener('lostpointercapture', event => { if (event.target === shelf) endDrag(event); });
  shelf.addEventListener('click', event => {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.stopImmediatePropagation();
  }, true);
  shelf.addEventListener('wheel', event => {
    if (event.ctrlKey) return;
    event.preventDefault();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    clearTimeout(wheelStop);
    wheelStop = setTimeout(() => {
      wheelStop = undefined;
      move(Math.round(target));
    }, 130);
    move(target + delta * (event.deltaMode === 1 ? .22 : .012));
  }, {passive:false});
  const resize = new ResizeObserver(measure);
  resize.observe(shelf);
  measure();
  queuePreview();
  document.addEventListener('visibilitychange', () => {
    stopPreview();
    if (!document.hidden) queuePreview();
  }, {signal});
  for (const name of ['timeupdate', 'playing', 'pause', 'emptied']) {
    homeMusic.audio.addEventListener(name, updateHomeLyrics, {signal});
  }
  updateHomeLyrics();

  return () => {
    controller.abort();
    resize.disconnect();
    clearTimeout(wheelStop);
    stopPreview();
    clearTransport();
    cancelAnimationFrame(frame);
  };
}
