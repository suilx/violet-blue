let catalogue;

export async function mountPlaylistShelf(host, back, pauseHome) {
  catalogue ??= fetch(new URL('tracks.json?v=2', import.meta.url)).then(response => {
    if (!response.ok) throw Error('Playlist unavailable');
    return response.json();
  }).catch(error => {
    catalogue = undefined;
    throw error;
  });
  const tracks = await catalogue;
  if (!host.isConnected) return;

  host.innerHTML = `
    <div class="cd-browser">
      <div class="cd-shelf" role="group" aria-label="Browse playlist covers"></div>
      <div class="cd-caption">
        <button type="button" data-step="-1" aria-label="Previous cover">←</button>
        <div><strong></strong><small></small></div>
        <button type="button" data-step="1" aria-label="Next cover">→</button>
      </div>
    </div>
    <div class="cd-player" hidden>
      <div class="cd-player-title"><p>Selected track</p><h3></h3><small></small></div>
      <div class="cd-case cd-player-art"></div>
      <div class="cd-transport"></div>
    </div>`;
  const browser = host.querySelector('.cd-browser');
  const player = host.querySelector('.cd-player');
  const shelf = host.querySelector('.cd-shelf');
  const title = host.querySelector('.cd-caption strong');
  const meta = host.querySelector('.cd-caption small');
  const transport = host.querySelector('.cd-transport');
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

  function cover(track) {
    const insert = document.createElement('span');
    insert.className = 'cd-insert';
    const label = document.createElement('span');
    label.textContent = track.title;
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
    spine.firstElementChild.textContent = track.title;
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
    title.textContent = tracks[index].title;
    meta.textContent = tracks[index].artist + ' · ' + String(index + 1).padStart(2, '0') + ' / ' + tracks.length;
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
    if (!frame) lastFrame = 0;
  }

  function move(index, immediate = false) {
    target = index;
    if (!drag?.moved && !wheelStop && Number.isInteger(index)) primeCovers(index);
    if (immediate || motion.matches) {
      cancelAnimationFrame(frame);
      frame = lastFrame = 0;
      position = target;
      render();
    } else if (!frame) frame = requestAnimationFrame(tick);
  }

  function showPlayer(track, face) {
    const origin = face.getBoundingClientRect();
    clearTimeout(wheelStop);
    wheelStop = undefined;
    cancelAnimationFrame(frame);
    frame = lastFrame = 0;
    position = target = Math.round(position);
    const {insert, image} = cover(track);
    if (track.cover) image.src = track.cover;
    player.querySelector('.cd-player-art').replaceChildren(insert);
    player.querySelector('h3').textContent = track.title;
    player.querySelector('small').textContent = track.artist;
    const external = document.createElement('a');
    external.href = 'https://music.163.com/song?id=' + track.id;
    external.target = '_blank';
    external.rel = 'noopener noreferrer';
    external.textContent = 'Open in NetEase ↗';
    transport.replaceChildren(external);
    if (!track.externalOnly) {
      pauseHome();
      const embed = document.createElement('iframe');
      embed.title = 'NetEase player for ' + track.title;
      embed.allow = 'encrypted-media';
      embed.src = 'https://music.163.com/outchain/player?type=2&id=' + track.id + '&auto=0&height=86';
      transport.prepend(embed);
    }
    browser.hidden = true;
    player.hidden = false;
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
    transport.replaceChildren();
    player.hidden = true;
    browser.hidden = false;
    back.setAttribute('aria-label', 'Back to Playlist');
    measure();
    books[selected].button.focus({preventScroll:true});
  }

  back.addEventListener('click', returnToCovers, {capture:true, signal});
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

  return () => {
    controller.abort();
    resize.disconnect();
    clearTimeout(wheelStop);
    cancelAnimationFrame(frame);
  };
}
