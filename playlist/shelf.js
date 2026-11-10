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
        <p class="cd-shelf-hint">Swipe to browse · Tap cover to open</p>
      </div>
    </div>
    <div class="cd-player" hidden>
      <div class="cd-player-title">
        <p>Selected track</p><h3></h3><small></small>
      </div>
      <button class="cd-case cd-player-art" type="button" aria-label="Back to covers"></button>
      <section class="cd-lyrics" aria-label="Lyrics" hidden>
        <h4>Lyrics</h4>
        <div class="cd-lyric-window"><div class="cd-lyric-track"></div></div>
      </section>
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
  const trackTitle = player.querySelector('h3');
  const trackArtist = player.querySelector('small');
  const playerCover = player.querySelector('.cd-player-art');
  const lyrics = player.querySelector('.cd-lyrics');
  const lyricWindow = lyrics.querySelector('.cd-lyric-window');
  const lyricTrack = lyrics.querySelector('.cd-lyric-track');
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
  let audio;
  let stream;
  let volume = .8;
  let muted = false;
  let preview;
  let previewTimer;
  let previewFrame;
  let returning = false;
  let fadingAudio;
  let fadeFrame;
  let fadeTimer;
  let fadeUntil = 0;
  let lyricWidth;
  let stopFollowingLyrics;

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
    cancelAnimationFrame(previewFrame);
    if (!preview) return;
    const media = preview;
    preview = undefined;
    releaseAudio(media);
  }

  function queuePreview() {
    if (selected < 0 || browser.hidden || returning || frame || drag?.moved || wheelStop || document.hidden) return;
    const track = tracks[selected];
    previewTimer = setTimeout(() => {
      const media = new Audio();
      preview = media;
      media.volume = 0;
      media.muted = muted;
      const finish = () => {
        if (preview === media) stopPreview();
      };
      media.addEventListener('ended', finish, {once:true});
      media.addEventListener('error', finish, {once:true});
      media.addEventListener('loadedmetadata', () => {
        if (preview !== media) return;
        if (!Number.isFinite(media.duration) || media.duration <= 0) {
          finish();
          return;
        }
        const length = Math.min(12, media.duration);
        const start = (media.duration - length) / 2;
        const fade = Math.min(1.2, length / 2);
        media.currentTime = start;
        function update() {
          if (preview !== media) return;
          const elapsed = media.currentTime - start;
          if (elapsed >= length) {
            finish();
            return;
          }
          media.volume = volume * Math.max(0, Math.min(1, elapsed / fade, (length - elapsed) / fade));
          previewFrame = requestAnimationFrame(update);
        }
        stopFade();
        homeMusic.stopPlayback();
        media.play().then(update, finish);
      }, {once:true});
      media.src = trackStream(track);
    }, Math.max(1000, Math.max(fadeUntil, homeMusic.previewReadyAt()) - performance.now()));
  }

  function setText(element, value, language) {
    element.textContent = value;
    element.lang = language || '';
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
    const selectedCover = books[Math.max(0, selected)].button;
    selectedCover.hidden = false;
    const {offsetHeight:height, offsetWidth:width} = selectedCover;
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

  function fitLyrics() {
    for (const text of lyricTrack.querySelectorAll('.cd-lyric-text')) {
      text.style.fontSize = '';
      const {clientWidth, scrollWidth} = text;
      if (clientWidth && scrollWidth > clientWidth) {
        const size = parseFloat(getComputedStyle(text).fontSize);
        const minimum = text.parentElement.hasAttribute('aria-current') ? 18 : 14;
        text.style.fontSize = Math.max(minimum, size * clientWidth / scrollWidth - .5) + 'px';
      }
    }
  }

  function followPlayback(media, lines) {
    let index = -1;

    function renderLyrics(next, slide = false) {
      for (const animation of lyricTrack.getAnimations()) animation.cancel();
      const first = next - (slide ? 2 : 1);
      const rows = Array.from({length:slide ? 4 : 3}, (_, offset) => {
        const cue = first + offset;
        const row = document.createElement('p');
        row.className = 'cd-lyric-row';
        if (cue === next && lines[cue]) row.setAttribute('aria-current', 'true');
        if (slide && offset === 0) row.setAttribute('aria-hidden', 'true');
        const text = document.createElement('span');
        text.className = 'cd-lyric-text';
        text.textContent = lines[cue]?.text || '';
        row.append(text);
        return row;
      });
      lyricTrack.replaceChildren(...rows);
      fitLyrics();
      if (!slide) return;

      const timing = {duration:340, easing:'cubic-bezier(.22,.74,.26,1)'};
      const travel = lyricTrack.animate([
        {transform:'translateY(0)'}, {transform:'translateY(-25%)'},
      ], {...timing, fill:'forwards'});
      const colors = [{color:'var(--song-accent)'}, {color:'var(--song-muted)'}];
      rows[1].animate(colors, timing);
      rows[2].animate([...colors].reverse(), timing);
      travel.finished.then(() => {
        rows[0].remove();
        travel.cancel();
      }, () => {});
    }

    function updateCue(event) {
      if (audio !== media) return;
      const next = lines.findLastIndex(line => line.t <= media.currentTime);
      if (next === index) return;
      const slide = index >= 0 && next === index + 1 && !media.paused && !media.seeking &&
        event.type !== 'seeked' && !motion.matches && Boolean(lyricTrack.animate);
      renderLyrics(next, slide);
      index = next;
    }

    renderLyrics(index);
    const cues = new AbortController();
    for (const event of ['playing', 'timeupdate', 'seeked']) {
      media.addEventListener(event, updateCue, {signal:cues.signal});
    }
    return () => cues.abort();
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
    seek.disabled = !length;
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

  function stopFade() {
    cancelAnimationFrame(fadeFrame);
    clearTimeout(fadeTimer);
    fadeUntil = 0;
    if (!fadingAudio) return;
    releaseAudio(fadingAudio);
    fadingAudio.remove();
    fadingAudio = undefined;
  }

  function clearTransport(fade = false) {
    stopFade();
    stopFollowingLyrics?.();
    stopFollowingLyrics = undefined;
    const media = audio;
    audio = undefined;
    if (!media) return;
    if (fade && !media.paused && !media.ended && !media.muted && media.volume > 0) {
      fadingAudio = media;
      host.append(media);
      const initial = media.volume;
      const start = performance.now();
      const duration = 2000;
      fadeUntil = start + duration;
      function step(now) {
        const remaining = Math.max(0, 1 - (now - start) / duration);
        media.volume = initial * remaining;
        if (remaining > 0) fadeFrame = requestAnimationFrame(step);
        else stopFade();
      }
      fadeFrame = requestAnimationFrame(step);
      fadeTimer = setTimeout(stopFade, duration);
      return;
    }
    releaseAudio(media);
    media.remove();
  }

  function displayTrack(track, media) {
    stream = trackStream(track);
    const {insert, image} = cover(track);
    if (track.cover) image.src = track.cover;
    playerCover.replaceChildren(insert);
    setText(trackTitle, track.title, track.titleLang);
    setText(trackArtist, track.artist, track.artistLang);
    const suppliedLines = lyricsByTrack[track.id];
    const publishedLines = suppliedLines ?? homeMusic.lyricsFor(track.title);
    stopFollowingLyrics?.();
    lyricTrack.replaceChildren();
    lyrics.hidden = !publishedLines.length;
    stopFollowingLyrics = publishedLines.length ? followPlayback(media, publishedLines) : undefined;
  }

  function playTrack(media) {
    homeMusic.stopPlayback();
    if (!media.hasAttribute('src') || media.error) media.src = stream;
    stopFade();
    showStatus('');
    media.play().catch(error => {
      if (audio === media && error.name !== 'AbortError') {
        updateTransport();
        showStatus('Playback unavailable. Press play to retry.');
      }
    });
  }

  function showPlayer(track, face) {
    const origin = face.getBoundingClientRect();
    stopPreview();
    clearTimeout(wheelStop);
    wheelStop = undefined;
    cancelAnimationFrame(frame);
    frame = lastFrame = 0;
    position = target = Math.round(position);
    browser.hidden = true;
    player.hidden = false;
    const media = document.createElement('audio');
    audio = media;
    media.hidden = true;
    transport.append(media);
    displayTrack(track, media);
    updateTransport();
    updateVolume();
    showStatus('');
    for (const event of ['emptied', 'durationchange', 'timeupdate', 'play', 'pause', 'error', 'playing', 'waiting']) {
      media.addEventListener(event, () => {
        if (audio !== media) return;
        updateTransport();
        if (event === 'error') showStatus('Playback unavailable. Press play to retry.');
        else if (event === 'waiting' && !media.paused) showStatus('Loading…');
        else if (event === 'playing' || (event === 'pause' && !media.error)) showStatus('');
      });
    }
    media.addEventListener('ended', () => {
      if (audio !== media) return;
      position = target = Math.round(position) + 1;
      const next = wrap(position);
      updateSelection(next);
      displayTrack(tracks[next], media);
      media.src = stream;
      playTrack(media);
    });
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
    clearTransport(true);
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
    const fades = [trackTitle.parentElement, lyrics, transport].map(section =>
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
    playTrack(media);
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
  const resizeLyrics = new ResizeObserver(() => {
    const width = lyricWindow.clientWidth;
    if (width === lyricWidth) return;
    lyricWidth = width;
    fitLyrics();
  });
  resizeLyrics.observe(lyricWindow);
  measure();
  queuePreview();
  document.addEventListener('visibilitychange', () => {
    stopPreview();
    if (!document.hidden) queuePreview();
  }, {signal});

  return () => {
    controller.abort();
    resize.disconnect();
    resizeLyrics.disconnect();
    clearTimeout(wheelStop);
    stopPreview();
    clearTransport();
    cancelAnimationFrame(frame);
  };
}
