<script>
  import { onDestroy, onMount, tick } from 'svelte';

  // ─── APP PHASE ──────────────────────────────────────────────────
  let phase = $state('setup');

  // ─── AUTH STATE ─────────────────────────────────────────────────
  let authUrl = $state('');
  let callbackUrl = $state('');
  let authStatus = $state('');
  let authLoading = $state(false);
  let completeAuthLoading = $state(false);
  let authError = $state('');

  // ─── SPOTIFY STATE ──────────────────────────────────────────────
  let isPlaying = $state(false);
  let currentTrack = $state(null);
  let trackProgress = $state(0);
  let volume = $state(70);
  let spotStatus = $state('idle');
  let pollTimer = null;

  // ─── GESTURE / CAMERA STATE ─────────────────────────────────────
  let canvasEl = $state('');
  let videoEl = $state('');
  let hands = $state([]);
  let camStatus = $state('idle');
  let mlStatus = $state('idle');
  let gestureLabel = $state('—');
  let gestureEmoji = $state('');
  let flashMsg = $state(null);
  let flashTimer = null;
  let animFrame = null;

  let lastGesture = $state('');
  let lastGestureTime = 0;
  const COOLDOWN = 1500;

  // ─── LLM STATE ──────────────────────────────────────────────────
  let playbackInterpretation = $state('');
  let playbackInterpretLoading = $state(false);
  let lastInterpretedTrackId = $state('');

  // ─── LOG ────────────────────────────────────────────────────────
  let logs = $state([]);
  function addLog(source, msg) {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    logs = [{ ts, source, msg, id: Math.random() }, ...logs].slice(0, 30);
  }

  // ─── DERIVED ────────────────────────────────────────────────────
  let elapsed = $derived(currentTrack ? msToTime(currentTrack.duration_ms * (trackProgress / 100)) : '0:00');
  let total = $derived(currentTrack ? msToTime(currentTrack.duration_ms) : '0:00');
  let albumArt = $derived(currentTrack?.album?.images?.[0]?.url ?? null);

  // ─── HELPERS ────────────────────────────────────────────────────
  function msToTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await response.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch {}
    if (!response.ok) {
      throw new Error(typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2));
    }
    return parsed;
  }

  async function mcpo(path, body = {}) {
    return postJson('/api/mcpo', { path, body });
  }

  // ─── AUTH ───────────────────────────────────────────────────────
  async function getAuthUrl() {
    authLoading = true;
    authError = '';
    authUrl = '';
    try {
      const result = await mcpo('/spotify/spotify_auth_url', {
        scopes: [
          'user-read-private',
          'user-read-email',
          'user-read-playback-state',
          'user-modify-playback-state',
          'user-read-currently-playing',
          'playlist-read-private',
          'playlist-read-collaborative'
        ],
        usePKCE: false
      });
      try {
        const parsed = JSON.parse(result.content);
        authUrl = parsed.url;
      } catch {
        authUrl = result.content;
      }
    } catch (e) {
      authError = e.message;
    } finally {
      authLoading = false;
    }
  }

  async function completeAuth() {
    completeAuthLoading = true;
    authStatus = '';
    try {
      const result = await mcpo('/spotify/spotify_complete_auth', { callbackUrl });
      authStatus = result.content;
      await launch();
    } catch (e) {
      authError = e.message;
    } finally {
      completeAuthLoading = false;
    }
  }

  // ─── LAUNCH ─────────────────────────────────────────────────────
  async function launch() {
    phase = 'app';
    await tick();
    try {
      await initCamera();
      await initML5();
      spotStatus = 'active';
      addLog('Spotify', 'Connected via MCP');
      startPoll();
    } catch (err) {
      addLog('System', `Launch Error: ${err.message}`);
    }
  }

  // ─── CAMERA ─────────────────────────────────────────────────────
  async function initCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      videoEl.srcObject = stream;
      await new Promise(r => videoEl.onloadedmetadata = r);
      videoEl.play();
      camStatus = 'active';
      addLog('Camera', 'Webcam ready');
    } catch (e) {
      camStatus = 'error';
      addLog('Camera', `Error: ${e.message}`);
    }
  }

  // ─── ML5 HANDPOSE ───────────────────────────────────────────────
  async function initML5() {
    mlStatus = 'loading';
    addLog('ml5', 'Loading HandPose model…');
    try {
      if (!videoEl || videoEl.readyState < 2) await tick();
      const hp = await ml5.handPose({ flipped: true });
      hp.detectStart(videoEl, (results) => { hands = results; });
      mlStatus = 'active';
      addLog('ml5', 'HandPose active');
      startDrawLoop();
    } catch (err) {
      mlStatus = 'error';
      addLog('ml5', `Model Error: ${err.message}`);
    }
  }

  function startDrawLoop() {
    const ctx = canvasEl?.getContext('2d');
    if (!ctx) return;
    const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
    function draw() {
      if (!videoEl || videoEl.readyState < 2 || !canvasEl) {
        animFrame = requestAnimationFrame(draw);
        return;
      }
      ctx.save();
      ctx.translate(canvasEl.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      ctx.restore();
      if (hands && hands.length > 0) {
        for (const hand of hands) {
          ctx.strokeStyle = '#c8ff00';
          ctx.lineWidth = 3;
          for (const [a, b] of CONNECTIONS) {
            const kpA = hand.keypoints[a];
            const kpB = hand.keypoints[b];
            if (kpA && kpB) {
              ctx.beginPath();
              ctx.moveTo(kpA.x, kpA.y);
              ctx.lineTo(kpB.x, kpB.y);
              ctx.stroke();
            }
          }
          ctx.fillStyle = '#ffffff';
          for (const kp of hand.keypoints) {
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      const activeHand = hands.find(h => h.confidence > 0.1);
      if (activeHand) {
        classifyAndAct(activeHand);
      } else {
        gestureLabel = '—';
        gestureEmoji = '';
      }
      animFrame = requestAnimationFrame(draw);
    }
    draw();
  }

  // ─── GESTURE CLASSIFICATION ─────────────────────────────────────
  function classifyGesture(kps) {
    if (!kps || kps.length < 21) return null;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const palmSize = dist(kps[0], kps[9]);
    const isUp = (tip, pip) => dist(kps[tip], kps[0]) > dist(kps[pip], kps[0]) + (palmSize * 0.2);
    const f = [
      dist(kps[4], kps[0]) > dist(kps[2], kps[0]) + (palmSize * 0.1),
      isUp(8, 6),
      isUp(12, 10),
      isUp(16, 14),
      isUp(20, 18)
    ];
    const fingerCount = f.slice(1).filter(Boolean).length;
    const totalCount = f.filter(Boolean).length;
    if (!f[0]) {
      if (fingerCount === 0) return { name: 'fist', emoji: '✊', label: 'Pause' };
    }
    if (f[0]) {
      if (totalCount === 5) return { name: 'open_hand', emoji: '✋', label: 'Play' };
      if (fingerCount === 0) {
        return kps[4].y < kps[2].y
          ? { name: 'vol_up', emoji: '👍', label: 'Vol +' }
          : { name: 'vol_down', emoji: '👎', label: 'Vol -' };
      }
      if (f[1]) {
        const horizontalDiff = kps[8].x - kps[5].x;
        if (horizontalDiff > 45) return { name: 'next', emoji: '👉', label: 'Next' };
        if (horizontalDiff < -45) return { name: 'prev', emoji: '👈', label: 'Prev' };
      }
    }
    return null;
  }

  function classifyAndAct(hand) {
    const g = classifyGesture(hand.keypoints);
    if (!g) { gestureLabel = '—'; gestureEmoji = ''; return; }
    gestureLabel = g.label;
    gestureEmoji = g.emoji;
    const now = Date.now();
    if (g.name === lastGesture && now - lastGestureTime < COOLDOWN) return;
    lastGesture = g.name;
    lastGestureTime = now;
    showFlash(`${g.emoji} ${g.label.toUpperCase()}`);
    addLog('Gesture', `Detected: ${g.name}`);
    if (g.name === 'fist') spotifyPause();
    else if (g.name === 'open_hand') spotifyPlay();
    else if (g.name === 'next') spotifyNext();
    else if (g.name === 'prev') spotifyPrev();
    else if (g.name === 'vol_up') spotifyAdjVol(10);
    else if (g.name === 'vol_down') spotifyAdjVol(-10);
  }

  function showFlash(msg) {
    flashMsg = msg;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => flashMsg = null, 900);
  }

  // ─── SPOTIFY VIA MCP ────────────────────────────────────────────
  async function spotifyPlay() {
    try {
      await mcpo('/spotify/spotify_play', {});
      isPlaying = true;
      addLog('Spotify', 'Playing');
    } catch (e) { addLog('Spotify', 'Play error'); }
  }

  async function spotifyPause() {
    try {
      await mcpo('/spotify/spotify_pause', {});
      isPlaying = false;
      addLog('Spotify', 'Paused');
    } catch (e) { addLog('Spotify', 'Pause error'); }
  }

  async function spotifyNext() {
    try {
      await mcpo('/spotify/spotify_next', {});
      addLog('Spotify', 'Next');
    } catch (e) { addLog('Spotify', 'Next error'); }
  }

  async function spotifyPrev() {
    try {
      await mcpo('/spotify/spotify_previous', {});
      addLog('Spotify', 'Previous');
    } catch (e) { addLog('Spotify', 'Prev error'); }
  }

  async function spotifyAdjVol(delta) {
    volume = Math.max(0, Math.min(100, volume + delta));
    try {
      await mcpo('/spotify/spotify_set_volume', { volumePercent: volume });
      addLog('Spotify', `Volume: ${volume}`);
    } catch (e) { addLog('Spotify', 'Volume error'); }
  }

  async function spotifyToggle() {
    if (isPlaying) await spotifyPause();
    else await spotifyPlay();
  }

  // ─── POLL ───────────────────────────────────────────────────────
  function startPoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        const result = await mcpo('/spotify/spotify_get_playback_state', {});
        const s = JSON.parse(result.content);
        if (s && s.item) {
          isPlaying = s.is_playing;
          currentTrack = s.item;
          trackProgress = (s.progress_ms / s.item.duration_ms) * 100;

          // get LLM comment when track changes
          if (s.item.id !== lastInterpretedTrackId) {
            lastInterpretedTrackId = s.item.id;
            getTrackComment(result.content);
          }
        }
      } catch (e) { /* silent */ }
    }, 3000);
  }

  // ─── LLM COMMENT ────────────────────────────────────────────────
  async function getTrackComment(content) {
    playbackInterpretLoading = true;
    playbackInterpretation = '';
    try {
      const result = await postJson('/api/interpret', { tool: 'spotify-playback', content });
      playbackInterpretation = result.content;
    } catch (e) {
      playbackInterpretation = '';
    } finally {
      playbackInterpretLoading = false;
    }
  }

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
    if (animFrame) cancelAnimationFrame(animFrame);
  });
</script>

<svelte:head>
  <title>GESTURE — Music Control</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;700;800;900&display=swap" rel="stylesheet" />
  <script src="https://unpkg.com/ml5@1/dist/ml5.min.js"></script>
</svelte:head>

<style>
  @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.2} }
  @keyframes flash-pop {
    0%  {opacity:0;transform:translate(-50%,-50%) scale(.75)}
    18% {opacity:1;transform:translate(-50%,-50%) scale(1.06)}
    55% {opacity:1;transform:translate(-50%,-50%) scale(1)}
    100%{opacity:0;transform:translate(-50%,-50%) scale(.9)}
  }
  .anim-pulse { animation: pulse-dot 2s ease-in-out infinite; }
  .anim-flash { animation: flash-pop .85s ease forwards; }
  .font-display { font-family: 'Syne', sans-serif; }
</style>

<!-- FLASH OVERLAY -->
{#if flashMsg}
  <div class="anim-flash font-display fixed z-[8000] pointer-events-none font-black
              bg-[#c8ff00] text-[#08080b] px-8 py-3 tracking-tight whitespace-nowrap"
       style="top:50%;left:50%;transform:translate(-50%,-50%);font-size:clamp(1.8rem,5vw,3rem)">
    {flashMsg}
  </div>
{/if}

<!-- ═══════════════ SETUP / LOGIN SCREEN ═══════════════ -->
{#if phase === 'setup'}
<section class="min-h-screen bg-[#08080b] flex flex-col items-center justify-center px-6 py-16 gap-10">

  <div class="text-center">
    <h1 class="font-display font-black tracking-tighter leading-none text-[#c8ff00]"
        style="font-size:clamp(3.5rem,9vw,7rem)">
      GEST<span class="text-white">URE</span>
    </h1>
    <p class="mt-3 text-[0.64rem] tracking-[0.25em] uppercase text-[#666680]">
      ml5.js HandPose · Spotify MCP · SvelteKit + Tailwind
    </p>
  </div>

  <div class="bg-[#111116] border border-[#222230] p-7 max-w-lg w-full flex flex-col gap-4">
    <div class="flex items-baseline gap-3 border-b border-[#222230] pb-4 w-full">
      <span class="font-display font-black text-3xl text-[#c8ff00] opacity-40 leading-none">01</span>
      <h2 class="font-display font-bold text-[0.75rem] tracking-widest uppercase">Connect Spotify</h2>
    </div>

    <p class="text-[0.69rem] text-[#666680] leading-relaxed">
      Click below to generate your Spotify authorization URL.
    </p>

    <button
      disabled={authLoading}
      onclick={getAuthUrl}
      class="bg-[#c8ff00] text-[#08080b] font-display font-extrabold text-[0.8rem] tracking-widest uppercase
             px-10 py-3.5 border-0 cursor-pointer transition-all w-full
             hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(200,255,0,.3)] active:translate-y-0 disabled:opacity-40 disabled:cursor-default">
      {authLoading ? 'Loading...' : '🎵 Get Auth URL'}
    </button>

    {#if authError}<p class="text-[0.69rem] text-[#ff3b5c] font-['DM_Mono',monospace]">{authError}</p>{/if}

    {#if authUrl}
      <div class="flex items-baseline gap-3 border-b border-[#222230] pb-4 w-full mt-2">
        <span class="font-display font-black text-3xl text-[#c8ff00] opacity-40 leading-none">02</span>
        <h2 class="font-display font-bold text-[0.75rem] tracking-widest uppercase">Authorize & Paste Callback</h2>
      </div>

      <p class="text-[0.69rem] text-[#666680] leading-relaxed">
        Open the link below, authorize, then paste the full callback URL here.
      </p>

      <div class="bg-[#08080b] border border-[#1a2a1a] p-3 break-all">
        <a href={authUrl} target="_blank"
           class="font-['DM_Mono',monospace] text-[11px] text-[#c8ff00] no-underline">{authUrl}</a>
      </div>

      <input
        bind:value={callbackUrl}
        type="text"
        spellcheck="false"
        placeholder="http://127.0.0.1:8888/callback?code=..."
        class="w-full bg-[#08080b] border border-[#222230] text-[#f0ede6] font-['DM_Mono',monospace] text-[13px] px-3.5 py-2.5 outline-none focus:border-[#c8ff00] box-border"
      />

      <button
        disabled={completeAuthLoading}
        onclick={completeAuth}
        class="bg-[#c8ff00] text-[#08080b] font-display font-extrabold text-[0.8rem] tracking-widest uppercase
               px-10 py-3.5 border-0 cursor-pointer transition-all w-full
               hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(200,255,0,.3)] active:translate-y-0 disabled:opacity-40 disabled:cursor-default">
        {completeAuthLoading ? 'Connecting...' : '🔗 Complete Auth & Launch'}
      </button>

      {#if authStatus}
        <pre class="bg-[#08080b] border-l-2 border-[#c8ff00] font-['DM_Mono',monospace] text-[11px] text-[#555570] p-3 whitespace-pre-wrap break-words">{authStatus}</pre>
      {/if}
    {/if}
  </div>

</section>

<!-- ═══════════════ MAIN APP ═══════════════ -->
{:else}
<div class="min-h-screen bg-[#08080b] p-5 grid gap-5 items-start"
     style="grid-template-columns:1fr 380px;grid-template-rows:auto 1fr">

  <!-- HEADER -->
  <header class="col-span-2 flex items-center justify-between pb-5 border-b border-[#222230]">
    <div class="font-display font-black tracking-tighter text-[#c8ff00] leading-none text-[1.6rem]">
      GEST<span class="text-white">URE</span>
    </div>
    <div class="flex items-center gap-5">
      {#each [
        { label:'Camera',       state:camStatus },
        { label:'ml5 HandPose', state:mlStatus  },
        { label:'Spotify',      state:spotStatus },
      ] as s}
        <div class="flex items-center gap-2 text-[0.59rem] tracking-[0.1em] uppercase text-[#666680]">
          <span class="w-2 h-2 rounded-full inline-block
            {s.state==='active'  ? 'bg-[#c8ff00] shadow-[0_0_6px_#c8ff00] anim-pulse' : ''}
            {s.state==='error'   ? 'bg-[#ff3b5c]' : ''}
            {s.state==='loading' ? 'bg-orange-400 anim-pulse' : ''}
            {s.state==='idle'    ? 'bg-[#4a4a60]' : ''}
          "></span>
          {s.label}
        </div>
      {/each}
    </div>
  </header>

  <!-- LEFT COLUMN -->
  <div class="flex flex-col gap-5">

    <!-- Camera -->
    <div class="bg-[#111116] border border-[#222230] p-5 flex flex-col gap-4">
      <div class="flex items-center gap-2 font-display font-bold text-[0.57rem] tracking-[0.2em] uppercase text-[#666680]">
        <span class="w-2 h-2 rounded-full bg-[#c8ff00] shadow-[0_0_6px_#c8ff00] anim-pulse"></span>
        Live Hand Tracking
      </div>

      <div class="relative bg-black overflow-hidden" style="aspect-ratio:4/3">
        <!-- svelte-ignore a11y_media_has_caption -->
        <video bind:this={videoEl} autoplay playsinline muted
          class="absolute opacity-0 pointer-events-none" width="640" height="480"></video>
        <canvas bind:this={canvasEl} width="640" height="480" class="w-full h-full block"></canvas>
        <span class="absolute top-2.5 left-2.5   w-4 h-4 border-t-2 border-l-2 border-[#c8ff00] opacity-60 pointer-events-none"></span>
        <span class="absolute top-2.5 right-2.5  w-4 h-4 border-t-2 border-r-2 border-[#c8ff00] opacity-60 pointer-events-none"></span>
        <span class="absolute bottom-2.5 left-2.5  w-4 h-4 border-b-2 border-l-2 border-[#c8ff00] opacity-60 pointer-events-none"></span>
        <span class="absolute bottom-2.5 right-2.5 w-4 h-4 border-b-2 border-r-2 border-[#c8ff00] opacity-60 pointer-events-none"></span>
        <div class="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-4 py-1.5 font-display font-bold
                    text-[0.62rem] tracking-[0.1em] uppercase whitespace-nowrap pointer-events-none
                    {gestureLabel !== '—'
                      ? 'bg-[#08080b]/90 border border-[#c8ff00] text-[#c8ff00] shadow-[0_0_16px_rgba(200,255,0,.15)]'
                      : 'bg-[#08080b]/90 border border-[#222230] text-[#4a4a60]'}">
          {gestureEmoji} {gestureLabel}
        </div>
      </div>

      <div class="grid grid-cols-3 gap-1.5">
        {#each [
          ['✊','fist','Pause'],['✋','open_hand','Play'],
          ['👉','next','Next'],['👈','prev','Prev'],
          ['👍','vol_up','Vol +'],['👎','vol_down','Vol −'],
        ] as [emoji, name, label]}
          <div class="border p-2.5 text-center transition-all
            {lastGesture === name ? 'border-[#c8ff00] bg-[#c8ff00]/10' : 'border-[#222230] bg-[#08080b]'}">
            <span class="block text-xl mb-1">{emoji}</span>
            <span class="block font-display font-bold text-[0.49rem] tracking-widest uppercase
              {lastGesture === name ? 'text-[#c8ff00]' : 'text-[#4a4a60]'}">{label}</span>
          </div>
        {/each}
      </div>
    </div>

  </div>

  <!-- RIGHT COLUMN -->
  <div class="flex flex-col gap-5">

    <!-- Now Playing -->
    <div class="bg-[#111116] border border-[#222230] p-5 flex flex-col gap-4">
      <p class="font-display font-bold text-[0.57rem] tracking-[0.2em] uppercase text-[#666680]">⚡ Now Playing</p>

      <div class="flex gap-4 items-start">
        {#if albumArt}
          <div class="relative flex-shrink-0 w-16 h-16">
            <img src={albumArt} alt="album art" class="w-16 h-16 object-cover block relative z-10" />
            <div class="absolute -inset-1 blur-xl opacity-35 z-0 bg-cover bg-center"
                 style="background-image:url({albumArt})"></div>
          </div>
        {:else}
          <div class="w-16 h-16 bg-[#18181f] border border-[#222230] flex items-center justify-center text-2xl text-[#4a4a60] flex-shrink-0">♪</div>
        {/if}
        <div class="flex-1 overflow-hidden">
          <div class="font-display font-extrabold text-[0.95rem] text-white truncate leading-snug mb-0.5">{currentTrack?.name ?? '—'}</div>
          <div class="text-[0.7rem] text-[#666680] truncate">{currentTrack?.artists?.map(a => a.name).join(', ') ?? 'No active playback'}</div>
          <div class="text-[0.62rem] text-[#4a4a60] truncate mt-0.5">{currentTrack?.album?.name ?? ''}</div>
        </div>
      </div>

      <!-- PROGRESS BAR -->
      <div class="flex flex-col gap-1.5">
        <div class="h-px bg-[#222230] relative">
          <div class="absolute inset-y-0 left-0 bg-[#c8ff00] transition-[width] duration-1000 ease-linear" style="width:{trackProgress}%"></div>
          <div class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#c8ff00] transition-[left] duration-1000" style="left:{trackProgress}%"></div>
        </div>
        <div class="flex justify-between text-[0.6rem] text-[#666680]">
          <span>{elapsed}</span><span>{total}</span>
        </div>
      </div>

      <!-- CONTROLS -->
      <div class="flex items-center justify-center gap-3">
        <button onclick={spotifyPrev}
          class="w-10 h-10 flex items-center justify-center border border-[#222230] text-white bg-transparent cursor-pointer text-base transition-colors hover:border-[#c8ff00] hover:text-[#c8ff00]">⏮</button>
        <button onclick={spotifyToggle}
          class="flex items-center justify-center border border-[#c8ff00] text-[#c8ff00] bg-transparent cursor-pointer text-xl transition-colors hover:bg-[#c8ff00]/10"
          style="width:52px;height:52px">
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onclick={spotifyNext}
          class="w-10 h-10 flex items-center justify-center border border-[#222230] text-white bg-transparent cursor-pointer text-base transition-colors hover:border-[#c8ff00] hover:text-[#c8ff00]">⏭</button>
      </div>

      <!-- VOLUME -->
      <div class="flex items-center gap-3 text-base">
        <span>🔉</span>
        <input type="range" min="0" max="100" value={volume}
          oninput={e => spotifyAdjVol(+e.target.value - volume)} class="flex-1" />
        <span>🔊</span>
        <span class="text-[0.65rem] text-[#666680] w-7 text-right tabular-nums">{volume}</span>
      </div>

      <!-- OLLAMA COMMENT -->
      {#if currentTrack}
        <div class="border-t border-[#222230] pt-4 mt-1">
          <span class="font-['DM_Mono',monospace] text-[10px] tracking-[3px] uppercase text-[#444460]">Ollama says —</span>
          <p class="font-['DM_Sans',sans-serif] text-[13px] text-[#c8c4bc] italic leading-relaxed mt-1 min-h-[2rem]">
            {playbackInterpretLoading ? 'Thinking of something witty...' : playbackInterpretation || ''}
          </p>
        </div>
      {/if}
    </div>

    <!-- Activity Log -->
    <div class="bg-[#111116] border border-[#222230] px-5 py-4 flex flex-col gap-2 max-h-36 overflow-y-auto">
      <p class="font-display font-bold text-[0.55rem] tracking-[0.2em] uppercase text-[#4a4a60] flex-shrink-0">Activity Log</p>
      {#each logs as entry (entry.id)}
        <div class="text-[0.61rem] leading-relaxed flex gap-1.5 flex-wrap">
          <span class="text-[#c8ff00] opacity-60">[{entry.ts}]</span>
          <span class="text-[#3baaff] opacity-75">[{entry.source}]</span>
          <span class="text-[#666680]">{entry.msg}</span>
        </div>
      {/each}
    </div>

  </div>
</div>
{/if}