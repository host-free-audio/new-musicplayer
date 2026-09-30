(() => {
  'use strict';

  /* ---------- State ---------- */
  const STORAGE_KEY = 'spool.playlists.v1';

  const state = {
    tracks: [],       // {id, name, artist, url, duration}
    playlists: [],    // {id, name, trackIds: []}
    queue: [],        // array of track ids representing current playback context
    queueIndex: -1,
    view: 'library',
    activePlaylistId: null,
    modalMode: null,  // 'newPlaylist' | 'addToPlaylist'
    pendingTrackId: null,
  };

  let idCounter = 1;
  const nextId = () => `upload:${idCounter++}`;

  function savePlaylists() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.playlists)); }
    catch (err) { /* localStorage unavailable — playlists just won't persist */ }
  }

  function loadPlaylists() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state.playlists = JSON.parse(raw);
    } catch (err) { state.playlists = []; }
  }

  /* ---------- DOM refs ---------- */
  const $ = (sel) => document.querySelector(sel);

  const fileInput = $('#fileInput');
  const trackList = $('#trackList');
  const emptyState = $('#emptyState');
  const libraryCount = $('#libraryCount');
  const libraryActions = $('#libraryActions');
  const shuffleAllBtn = $('#shuffleAllBtn');
  const playAllBtn = $('#playAllBtn');
  const searchInput = $('#searchInput');

  const playlistList = $('#playlistList');
  const playlistsOverview = $('#playlistsOverview');
  const playlistDetail = $('#playlistDetail');
  const playlistViewTitle = $('#playlistViewTitle');
  const playlistViewSubtitle = $('#playlistViewSubtitle');
  const libraryView = $('#libraryView');
  const playlistsView = $('#playlistsView');

  // Two alternating <audio> elements. Track transitions swap the "active"
  // reference to a standby element that we've already preloaded ahead of
  // time, instead of reassigning .src on the currently-playing element.
  // This matters specifically for background/lock-screen playback: mobile
  // Chrome can treat a src change on the live media session as starting a
  // brand-new playback that needs the app in the foreground to authorize,
  // which is what caused playback to stop partway into the next track.
  // Swapping to an element that already finished loading avoids that.
  const audioA = new Audio();
  const audioB = new Audio();
  audioA.preload = 'auto';
  audioB.preload = 'auto';
  let audio = audioA;     // the element currently playing
  let standby = audioB;   // the element being preloaded with the next track
  let standbyTrackId = null;
  audio.volume = 0.8;
  audioB.volume = 0.8;

  // Mini player (desktop full controls + mobile compact bar)
  const playerTrackHit = $('#playerTrackHit');
  const playerArt = $('#playerArt');
  const playerTitle = $('#playerTitle');
  const playerArtist = $('#playerArtist');
  const playBtn = $('#playBtn');
  const playIcon = $('#playIcon');
  const pauseIcon = $('#pauseIcon');
  const prevBtn = $('#prevBtn');
  const nextBtn = $('#nextBtn');
  const seekBar = $('#seekBar');
  const curTimeEl = $('#curTime');
  const durTimeEl = $('#durTime');
  const volumeBar = $('#volumeBar');
  const mobilePlayBtn = $('#mobilePlayBtn');
  const mobilePlayIcon = $('#mobilePlayIcon');
  const mobilePauseIcon = $('#mobilePauseIcon');

  // Full-screen Now Playing overlay
  const nowPlayingOverlay = $('#nowPlayingOverlay');
  const closeNowPlaying = $('#closeNowPlaying');
  const npAddBtn = $('#npAddBtn');
  const npTitle = $('#npTitle');
  const npArtist = $('#npArtist');
  const npSeekBar = $('#npSeekBar');
  const npCurTime = $('#npCurTime');
  const npDurTime = $('#npDurTime');
  const npPrevBtn = $('#npPrevBtn');
  const npPlayBtn = $('#npPlayBtn');
  const npPlayIcon = $('#npPlayIcon');
  const npPauseIcon = $('#npPauseIcon');
  const npNextBtn = $('#npNextBtn');
  const npVolumeBar = $('#npVolumeBar');

  // Mobile tabbar + action sheet
  const mobileAddBtn = $('#mobileAddBtn');
  const actionSheetOverlay = $('#actionSheetOverlay');
  const sheetNewPlaylistBtn = $('#sheetNewPlaylistBtn');
  const sheetCancelBtn = $('#sheetCancelBtn');

  // Playlist / add-to-playlist modal
  const modalOverlay = $('#modalOverlay');
  const modalTitle = $('#modalTitle');
  const modalInput = $('#modalInput');
  const modalPicker = $('#modalPlaylistPicker');
  const modalNewRow = $('#modalNewRow');
  const modalNewInput = $('#modalNewInput');
  const modalNewConfirm = $('#modalNewConfirm');
  const modalConfirm = $('#modalConfirm');
  const modalCancel = $('#modalCancel');

  /* ---------- Helpers ---------- */
  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function guessArtistAndTitle(filename) {
    const base = filename.replace(/\.[^/.]+$/, '');
    const parts = base.split(/\s*-\s*/);
    if (parts.length >= 2) {
      return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
    }
    return { artist: 'Unknown artist', title: base };
  }

  function trackById(id) { return state.tracks.find(t => t.id === id); }
  function playlistById(id) { return state.playlists.find(p => p.id === id); }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const musicNoteSvg = `<svg viewBox="0 0 24 24" fill="none"><path d="M9 18V5l11-2v13" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.5"/><circle cx="17" cy="16" r="3" stroke="currentColor" stroke-width="1.5"/></svg>`;
  const playGlyphSvg = `<svg viewBox="0 0 24 24" fill="none"><path d="M8 5v14l12-7L8 5z" fill="currentColor"/></svg>`;
  const plusGlyphSvg = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const removeGlyphSvg = `<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

  /* ---------- Upload ---------- */
  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (!file.type.startsWith('audio/')) return;
      const { artist, title } = guessArtistAndTitle(file.name);
      const url = URL.createObjectURL(file);
      const track = { id: nextId(), name: title, artist, url, duration: null };
      state.tracks.push(track);

      const probe = new Audio();
      probe.preload = 'metadata';
      probe.src = url;
      probe.addEventListener('loadedmetadata', () => {
        track.duration = probe.duration;
        renderCurrentView();
      }, { once: true });
    });
    fileInput.value = '';
    renderCurrentView();
    closeActionSheet();
  });

  /* ---------- Row builder (shared by library + playlist detail) ---------- */
  function buildTrackRow(track, queueIds, playlistContextId) {
    const row = document.createElement('div');
    row.className = 'track-row';
    if (isCurrentTrack(track.id)) row.classList.add('is-playing');

    const actionTitle = playlistContextId ? 'Remove from playlist' : 'Add to playlist';
    const actionGlyph = playlistContextId ? removeGlyphSvg : plusGlyphSvg;

    row.innerHTML = `
      <div class="row-art">
        ${musicNoteSvg}
        <div class="row-playing-badge"><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span></div>
      </div>
      <div class="row-meta">
        <span class="name"></span>
        <span class="sub"></span>
      </div>
      <span class="row-duration"></span>
      <button class="icon-btn row-action" title="${actionTitle}" aria-label="${actionTitle}">${actionGlyph}</button>
    `;
    row.querySelector('.name').textContent = track.name;
    row.querySelector('.sub').textContent = track.artist;
    row.querySelector('.row-duration').textContent = track.duration ? formatTime(track.duration) : '';

    row.addEventListener('click', (e) => {
      if (e.target.closest('.row-action')) return;
      playQueue(queueIds, queueIds.indexOf(track.id));
    });
    row.querySelector('.row-action').addEventListener('click', (e) => {
      e.stopPropagation();
      if (playlistContextId) removeTrackFromPlaylist(playlistContextId, track.id);
      else openAddToPlaylistModal(track.id);
    });
    return row;
  }

  /* ---------- Rendering: Library ---------- */
  function renderLibrary() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = state.tracks.filter(t =>
      !query || t.name.toLowerCase().includes(query) || t.artist.toLowerCase().includes(query)
    );

    libraryCount.textContent = state.tracks.length
      ? `${state.tracks.length} track${state.tracks.length === 1 ? '' : 's'}`
      : '';

    const hasTracks = state.tracks.length > 0;
    emptyState.classList.toggle('is-visible', !hasTracks);
    trackList.style.display = hasTracks ? 'flex' : 'none';
    libraryActions.hidden = !hasTracks;

    trackList.innerHTML = '';
    const allIds = state.tracks.map(t => t.id);
    filtered.forEach(track => trackList.appendChild(buildTrackRow(track, allIds)));

    renderPlaylistSidebar();
  }

  playAllBtn.addEventListener('click', () => {
    if (state.tracks.length === 0) return;
    playQueue(state.tracks.map(t => t.id), 0);
  });
  shuffleAllBtn.addEventListener('click', () => {
    if (state.tracks.length === 0) return;
    const ids = shuffle(state.tracks.map(t => t.id));
    playQueue(ids, 0);
  });

  /* ---------- Playlists ---------- */
  function renderPlaylistSidebar() {
    playlistList.innerHTML = '';
    if (state.playlists.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'playlist-empty-hint';
      hint.textContent = 'Create a playlist to organize tracks.';
      playlistList.appendChild(hint);
      return;
    }
    state.playlists.forEach(pl => {
      const li = document.createElement('li');
      li.innerHTML = `<span></span><span class="count"></span>`;
      li.querySelector('span').textContent = pl.name;
      li.querySelector('.count').textContent = pl.trackIds.length;
      li.addEventListener('click', () => openPlaylistDetail(pl.id));
      playlistList.appendChild(li);
    });
  }

  function renderPlaylistsOverview() {
    playlistsOverview.innerHTML = '';
    playlistDetail.hidden = true;
    playlistsOverview.hidden = false;
    playlistViewTitle.textContent = 'Playlists';
    playlistViewSubtitle.textContent = state.playlists.length
      ? `${state.playlists.length} playlist${state.playlists.length === 1 ? '' : 's'}`
      : 'Group tracks from your library into playlists.';

    if (state.playlists.length === 0) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'No playlists yet. Tap the + to create one.';
      playlistsOverview.appendChild(p);
      return;
    }

    state.playlists.forEach(pl => {
      const card = document.createElement('div');
      card.className = 'playlist-card';
      card.innerHTML = `
        <div class="stack">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 6h12M4 12h12M4 18h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="19" cy="16" r="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M21.4 16V6l-4 1.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <button class="icon-btn card-delete" title="Delete playlist" aria-label="Delete playlist">
          <svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0-1 13a1 1 0 01-1 1H8a1 1 0 01-1-1L6 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <span class="name"></span>
        <span class="sub"></span>
      `;
      card.querySelector('.name').textContent = pl.name;
      card.querySelector('.sub').textContent = `${pl.trackIds.length} track${pl.trackIds.length === 1 ? '' : 's'}`;
      card.addEventListener('click', () => openPlaylistDetail(pl.id));
      card.querySelector('.card-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${pl.name}"? This can't be undone.`)) deletePlaylist(pl.id);
      });
      playlistsOverview.appendChild(card);
    });
  }

  function openPlaylistDetail(playlistId) {
    const pl = playlistById(playlistId);
    if (!pl) return;
    state.activePlaylistId = playlistId;
    switchView('playlists');

    playlistsOverview.hidden = true;
    playlistDetail.hidden = false;
    playlistViewTitle.innerHTML = '';

    const backRow = document.createElement('div');
    backRow.className = 'back-row';
    backRow.innerHTML = `
      <button class="back-btn">← All playlists</button>
      <button class="icon-btn" id="detailDeleteBtn" title="Delete playlist" aria-label="Delete playlist">
        <svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0-1 13a1 1 0 01-1 1H8a1 1 0 01-1-1L6 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
    backRow.querySelector('.back-btn').addEventListener('click', () => {
      state.activePlaylistId = null;
      renderPlaylistsOverview();
      playlistViewTitle.textContent = 'Playlists';
      playlistViewSubtitle.textContent = '';
    });
    backRow.querySelector('#detailDeleteBtn').addEventListener('click', () => {
      if (confirm(`Delete "${pl.name}"? This can't be undone.`)) deletePlaylist(playlistId);
    });
    playlistViewTitle.appendChild(backRow);

    const h = document.createElement('div');
    h.textContent = pl.name;
    playlistViewTitle.appendChild(h);
    playlistViewSubtitle.textContent = `${pl.trackIds.length} track${pl.trackIds.length === 1 ? '' : 's'}`;

    playlistDetail.innerHTML = '';
    if (pl.trackIds.length === 0) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'This playlist is empty. Add tracks from your library using the + button on any track.';
      playlistDetail.appendChild(p);
      return;
    }

    const playAllRow = document.createElement('div');
    playAllRow.className = 'library-actions';
    playAllRow.style.marginBottom = '14px';
    playAllRow.innerHTML = `<button class="btn btn-primary btn-with-icon">${playGlyphSvg}Play all</button>`;
    playAllRow.querySelector('button').addEventListener('click', () => playQueue(pl.trackIds, 0));
    playlistDetail.appendChild(playAllRow);

    const tracks = pl.trackIds.map(trackById).filter(Boolean);
    tracks.forEach(track => playlistDetail.appendChild(buildTrackRow(track, pl.trackIds, pl.id)));
  }

  function createPlaylist(name) {
    const pl = { id: `pl:${nextId()}`, name: name || 'New playlist', trackIds: [] };
    state.playlists.push(pl);
    savePlaylists();
    renderPlaylistSidebar();
    if (state.view === 'playlists' && !state.activePlaylistId) renderPlaylistsOverview();
    return pl;
  }

  function addTrackToPlaylist(playlistId, trackId) {
    const pl = playlistById(playlistId);
    if (!pl) return;
    if (!pl.trackIds.includes(trackId)) pl.trackIds.push(trackId);
    savePlaylists();
    renderPlaylistSidebar();
    if (state.view === 'playlists') {
      if (state.activePlaylistId === playlistId) openPlaylistDetail(playlistId);
      else if (!state.activePlaylistId) renderPlaylistsOverview();
    }
  }

  function removeTrackFromPlaylist(playlistId, trackId) {
    const pl = playlistById(playlistId);
    if (!pl) return;
    pl.trackIds = pl.trackIds.filter(id => id !== trackId);
    savePlaylists();
    renderPlaylistSidebar();
    if (state.activePlaylistId === playlistId) openPlaylistDetail(playlistId);
  }

  function deletePlaylist(playlistId) {
    state.playlists = state.playlists.filter(p => p.id !== playlistId);
    savePlaylists();
    if (state.activePlaylistId === playlistId) {
      state.activePlaylistId = null;
      renderPlaylistsOverview();
    } else {
      renderPlaylistSidebar();
    }
  }

  // Uploaded-track IDs don't survive a reload (the files aren't stored anywhere),
  // so drop any playlist references to tracks that no longer exist in the library.
  function pruneMissingPlaylistTracks() {
    const validIds = new Set(state.tracks.map(t => t.id));
    let changed = false;
    state.playlists.forEach(pl => {
      const before = pl.trackIds.length;
      pl.trackIds = pl.trackIds.filter(id => validIds.has(id));
      if (pl.trackIds.length !== before) changed = true;
    });
    if (changed) savePlaylists();
  }

  /* ---------- View switching ---------- */
  function switchView(view) {
    state.view = view;
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.view === view);
    });
    libraryView.hidden = view !== 'library';
    playlistsView.hidden = view !== 'playlists';
    if (view === 'playlists' && !state.activePlaylistId) renderPlaylistsOverview();
  }

  function renderCurrentView() {
    renderLibrary();
    if (state.view === 'playlists') {
      if (state.activePlaylistId) openPlaylistDetail(state.activePlaylistId);
      else renderPlaylistsOverview();
    }
  }

  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activePlaylistId = null;
      switchView(btn.dataset.view);
    });
  });

  /* ---------- Mobile action sheet ---------- */
  function openActionSheet() { actionSheetOverlay.hidden = false; }
  function closeActionSheet() { actionSheetOverlay.hidden = true; }
  mobileAddBtn.addEventListener('click', openActionSheet);
  sheetCancelBtn.addEventListener('click', closeActionSheet);
  actionSheetOverlay.addEventListener('click', (e) => { if (e.target === actionSheetOverlay) closeActionSheet(); });
  sheetNewPlaylistBtn.addEventListener('click', () => {
    closeActionSheet();
    openNewPlaylistModal();
  });

  /* ---------- Modal ---------- */
  function openNewPlaylistModal() {
    state.modalMode = 'newPlaylist';
    modalTitle.textContent = 'New playlist';
    modalInput.hidden = false;
    modalInput.value = '';
    modalPicker.hidden = true;
    modalNewRow.hidden = true;
    modalConfirm.hidden = false;
    modalConfirm.textContent = 'Create';
    modalOverlay.hidden = false;
    modalInput.focus();
  }

  function openAddToPlaylistModal(trackId) {
    state.modalMode = 'addToPlaylist';
    state.pendingTrackId = trackId;
    modalTitle.textContent = 'Add to playlist';
    modalInput.hidden = true;
    modalConfirm.hidden = true;
    modalPicker.hidden = false;
    modalNewRow.hidden = false;
    modalNewInput.value = '';
    modalPicker.innerHTML = '';

    if (state.playlists.length === 0) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.style.fontSize = '0.85rem';
      p.textContent = 'No playlists yet — create one below.';
      modalPicker.appendChild(p);
    } else {
      state.playlists.forEach(pl => {
        const b = document.createElement('button');
        b.innerHTML = `<span></span><span class="count"></span>`;
        b.querySelector('span').textContent = pl.name;
        b.querySelector('.count').textContent = pl.trackIds.includes(trackId) ? '✓ added' : pl.trackIds.length;
        b.addEventListener('click', () => {
          addTrackToPlaylist(pl.id, state.pendingTrackId);
          closeModal();
        });
        modalPicker.appendChild(b);
      });
    }
    modalOverlay.hidden = false;
  }

  function closeModal() {
    modalOverlay.hidden = true;
    state.modalMode = null;
    state.pendingTrackId = null;
  }

  $('#newPlaylistBtn').addEventListener('click', openNewPlaylistModal);
  modalCancel.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

  modalConfirm.addEventListener('click', () => {
    if (state.modalMode === 'newPlaylist') {
      createPlaylist(modalInput.value.trim());
      closeModal();
    }
  });

  modalNewConfirm.addEventListener('click', () => {
    const name = modalNewInput.value.trim();
    if (!name) { modalNewInput.focus(); return; }
    const pl = createPlaylist(name);
    addTrackToPlaylist(pl.id, state.pendingTrackId);
    closeModal();
  });

  modalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') modalConfirm.click();
    if (e.key === 'Escape') closeModal();
  });
  modalNewInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') modalNewConfirm.click();
    if (e.key === 'Escape') closeModal();
  });

  /* ---------- Search ---------- */
  searchInput.addEventListener('input', renderLibrary);

  /* ---------- Playback ---------- */
  function isCurrentTrack(trackId) {
    return state.queueIndex >= 0 && state.queue[state.queueIndex] === trackId;
  }

  function playQueue(queueIds, index) {
    state.queue = queueIds.slice();
    state.queueIndex = index;
    loadAndPlayCurrent();
  }

  function loadAndPlayCurrent() {
    const trackId = state.queue[state.queueIndex];
    const track = trackById(trackId);
    if (!track) return;

    if (standbyTrackId === trackId && standby.readyState >= 2) {
      // Already preloaded in the standby element — swap instead of
      // reassigning src on the live element (see note above audioA/audioB).
      const temp = audio;
      audio = standby;
      standby = temp;
      standby.pause();
    } else {
      audio.src = track.url;
      audio.load();
    }

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err) => {
        console.warn('Spool: playback was blocked or failed to start.', err);
      });
    }
    updatePlayerUI(track);
    renderCurrentView();
    updateMediaSession(track);
    preloadNextTrack();
  }

  function preloadNextTrack() {
    if (state.queue.length < 2) return;
    const nextIndex = (state.queueIndex + 1) % state.queue.length;
    const upcomingTrackId = state.queue[nextIndex];
    if (standbyTrackId === upcomingTrackId) return; // already preloaded
    const nextTrack = trackById(upcomingTrackId);
    if (!nextTrack) return;
    standbyTrackId = upcomingTrackId;
    standby.src = nextTrack.url;
    standby.load();
  }

  function updatePlayerUI(track) {
    playerTitle.textContent = track.name;
    playerArtist.textContent = track.artist;
    npTitle.textContent = track.name;
    npArtist.textContent = track.artist;
    npAddBtn.disabled = false;
  }

  function setPlayingIcon(isPlaying) {
    playIcon.hidden = isPlaying;
    pauseIcon.hidden = !isPlaying;
    npPlayIcon.hidden = isPlaying;
    npPauseIcon.hidden = !isPlaying;
    mobilePlayIcon.hidden = isPlaying;
    mobilePauseIcon.hidden = !isPlaying;
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }

  function togglePlay() {
    if (!audio.src) return;
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  }

  playBtn.addEventListener('click', togglePlay);
  mobilePlayBtn.addEventListener('click', togglePlay);
  npPlayBtn.addEventListener('click', togglePlay);

  function playPrev() {
    if (state.queue.length === 0) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    state.queueIndex = (state.queueIndex - 1 + state.queue.length) % state.queue.length;
    standbyTrackId = null; // previous track wasn't preloaded — force a fresh load
    loadAndPlayCurrent();
  }
  function playNext() {
    if (state.queue.length === 0) return;
    state.queueIndex = (state.queueIndex + 1) % state.queue.length;
    loadAndPlayCurrent();
  }
  prevBtn.addEventListener('click', playPrev);
  nextBtn.addEventListener('click', playNext);
  npPrevBtn.addEventListener('click', playPrev);
  npNextBtn.addEventListener('click', playNext);

  function seekTo(value) {
    if (!isFinite(audio.duration)) return;
    audio.currentTime = (value / 100) * audio.duration;
  }
  seekBar.addEventListener('input', () => {
    seekBar.style.setProperty('--fill', seekBar.value + '%');
    npSeekBar.style.setProperty('--fill', seekBar.value + '%');
    seekTo(seekBar.value);
  });
  npSeekBar.addEventListener('input', () => {
    npSeekBar.style.setProperty('--fill', npSeekBar.value + '%');
    seekBar.style.setProperty('--fill', npSeekBar.value + '%');
    seekTo(npSeekBar.value);
  });

  function setVolume(v) {
    audioA.volume = Number(v);
    audioB.volume = Number(v);
    volumeBar.value = v;
    npVolumeBar.value = v;
  }
  volumeBar.addEventListener('input', () => setVolume(volumeBar.value));
  npVolumeBar.addEventListener('input', () => setVolume(npVolumeBar.value));

  npAddBtn.addEventListener('click', () => {
    const trackId = state.queue[state.queueIndex];
    if (trackId) openAddToPlaylistModal(trackId);
  });

  /* ---------- Shared listeners for both audio elements ---------- */
  // Both elements share these handlers; each checks it's reacting to the
  // currently-active element (`audio`) so events from the preloading
  // standby element (loadedmetadata, etc.) are ignored.
  function updateSeekUI(target) {
    if (target !== audio || !isFinite(audio.duration)) return;
    const pct = (audio.currentTime / audio.duration) * 100 || 0;
    seekBar.value = pct;
    npSeekBar.value = pct;
    seekBar.style.setProperty('--fill', pct + '%');
    npSeekBar.style.setProperty('--fill', pct + '%');
    const cur = formatTime(audio.currentTime);
    const dur = formatTime(audio.duration);
    curTimeEl.textContent = cur;
    durTimeEl.textContent = dur;
    npCurTime.textContent = cur;
    npDurTime.textContent = dur;
  }

  [audioA, audioB].forEach((el) => {
    el.addEventListener('play', (e) => { if (e.target === audio) setPlayingIcon(true); });
    el.addEventListener('pause', (e) => { if (e.target === audio) setPlayingIcon(false); });
    el.addEventListener('timeupdate', (e) => updateSeekUI(e.target));
    el.addEventListener('ended', (e) => { if (e.target === audio) playNext(); });
  });

  /* ---------- Now Playing full-screen overlay ---------- */
  function openNowPlaying() {
    if (!audio.src) return;
    nowPlayingOverlay.hidden = false;
  }
  function closeNowPlayingOverlay() { nowPlayingOverlay.hidden = true; }
  playerTrackHit.addEventListener('click', openNowPlaying);
  closeNowPlaying.addEventListener('click', closeNowPlayingOverlay);

  /* ---------- Media Session (lock-screen / notification controls) ---------- */
  function updateMediaSession(track) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.name,
        artist: track.artist,
        album: 'Spool',
      });
      navigator.mediaSession.setActionHandler('play', () => audio.play().catch(() => {}));
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('previoustrack', playPrev);
      navigator.mediaSession.setActionHandler('nexttrack', playNext);
    } catch (err) {
      // Media Session isn't fully supported in every browser — playback

      // itself still works fine without lock-screen controls.
      console.warn('Spool: Media Session setup failed.', err);
    }
  }

  /* ---------- Bundled songs (loaded from songs/manifest.json) ---------- */
  async function loadBundledSongs() {
    try {
      const res = await fetch('songs/manifest.json');
      if (!res.ok) return;
      const list = await res.json();
      if (!Array.isArray(list)) return;

      list.forEach(entry => {
        if (!entry || !entry.file) return;
        const url = 'songs/' + encodeURIComponent(entry.file);
        const fallback = guessArtistAndTitle(entry.file);
        const track = {
          id: `song:${entry.file}`,
          name: entry.title || fallback.title,
          artist: entry.artist || fallback.artist,
          url,
          duration: null,
        };
        state.tracks.push(track);

        const probe = new Audio();
        probe.preload = 'metadata';
        probe.src = url;
        probe.addEventListener('loadedmetadata', () => {
          track.duration = probe.duration;
          renderCurrentView();
        }, { once: true });
        probe.addEventListener('error', () => {
          // Keep the track in the library even if metadata probing failed —
          // removing it here would also silently vanish it from any playlist
          // that already references it. Playback itself may still work fine;
          // this only means we couldn't read its duration up front.
          console.warn(`Spool: couldn't read metadata for "${entry.file}". Check the filename in songs/manifest.json matches exactly (case-sensitive on GitHub Pages).`);
        }, { once: true });
      });

      pruneMissingPlaylistTracks();
      renderCurrentView();
    } catch (err) {
      // No manifest, or running from file:// without a server — uploads still work.
    }
  }

  /* ---------- Init ---------- */
  loadPlaylists();
  switchView('library');
  renderLibrary();
  loadBundledSongs();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // Service worker registration failing (e.g. on file:// or an
        // unsupported browser) shouldn't block the app from working.
      });
    });
  }
})();
