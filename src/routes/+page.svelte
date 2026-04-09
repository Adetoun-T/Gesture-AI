<script>
  let authUrl = $state('');
  let callbackUrl = $state('');
  let authStatus = $state('');
  let authLoading = $state(false);
  let completeAuthLoading = $state(false);
  let authError = $state('');
  let completeAuthError = $state('');

  let playbackLoading = $state(false);
  let playbackInterpretLoading = $state(false);
  let playbackError = $state('');
  let playbackInterpretError = $state('');
  let playbackResult = $state('');
  let playbackInterpretation = $state('');

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

  async function interpretResult(tool, content) {
    const result = await postJson('/api/interpret', { tool, content });
    return result.content;
  }

  async function getAuthUrl() {
    authLoading = true;
    authError = '';
    authUrl = '';
    try {
      const result = await postJson('/api/mcpo', {
        path: '/spotify/spotify_auth_url',
        body: {
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
        }
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
    completeAuthError = '';
    authStatus = '';
    try {
      const result = await postJson('/api/mcpo', {
        path: '/spotify/spotify_complete_auth',
        body: { callbackUrl }
      });
      authStatus = result.content;
    } catch (e) {
      completeAuthError = e.message;
    } finally {
      completeAuthLoading = false;
    }
  }

  async function runGetPlayback() {
    playbackLoading = true;
    playbackError = '';
    playbackInterpretError = '';
    playbackResult = '';
    playbackInterpretation = '';
    try {
      const result = await postJson('/api/mcpo', {
        path: '/spotify/spotify_get_playback_state',
        body: {}
      });
      playbackResult = result.content;
      playbackInterpretLoading = true;
      try {
        playbackInterpretation = await interpretResult('spotify-playback', playbackResult);
      } catch (e) {
        playbackInterpretError = e.message;
      }
    } catch (e) {
      playbackError = e.message;
    } finally {
      playbackInterpretLoading = false;
      playbackLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Now Playing</title>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
</svelte:head>

<div class="page">
  <header>
    <h1>NOW PLAYING</h1>
    <span class="badge">● Spotify MCP Explorer</span>
  </header>

  <section>
    <div class="section-label">Connect Spotify</div>
    <p class="step">01 — Generate auth URL</p>
    <button disabled={authLoading} onclick={getAuthUrl} class="btn btn-green">
      {authLoading ? 'Loading...' : 'Get Auth URL'}
    </button>
    {#if authError}<p class="error">{authError}</p>{/if}
    {#if authUrl}
      <div class="auth-url"><a href={authUrl} target="_blank">{authUrl}</a></div>
      <p class="step">02 — Paste callback URL after authorizing</p>
      <label class="field-label">Callback URL</label>
      <input class="input" bind:value={callbackUrl} type="text" spellcheck="false" placeholder="http://127.0.0.1:8888/callback?code=..." />
      <div style="margin-top: 8px;">
        <button disabled={completeAuthLoading} onclick={completeAuth} class="btn">
          {completeAuthLoading ? 'Connecting...' : 'Complete Auth'}
        </button>
      </div>
      {#if completeAuthError}<p class="error">{completeAuthError}</p>{/if}
      {#if authStatus}<pre class="raw">{authStatus}</pre>{/if}
    {/if}
  </section>

  <section>
    <div class="section-label">Now Playing</div>
    <button disabled={playbackLoading} onclick={runGetPlayback} class="btn btn-green">
      {playbackLoading ? 'Loading...' : 'What am I listening to?'}
    </button>
    {#if playbackError}<p class="error">{playbackError}</p>{/if}
    {#if playbackInterpretError}<p class="error">{playbackInterpretError}</p>{/if}

    <div class="split">
      <div class="split-col">
        <label class="field-label">Raw response</label>
        <pre class="raw">{playbackResult || 'Response will appear here.'}</pre>
      </div>
      <div class="split-col">
        <label class="field-label">Ollama says —</label>
        <div class="interpretation">
          {playbackInterpretLoading ? 'Thinking of something witty...' : playbackInterpretation || 'Interpretation will appear here.'}
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');

  :global(body) {
    margin: 0;
    background: #0a0a0a;
    color: #f0ede6;
    font-family: 'DM Sans', sans-serif;
  }

  .page {
    max-width: 64rem;
    margin: 0 auto;
    padding: 2rem 1rem 4rem;
  }

  header {
    border-bottom: 1px solid #2a2a2a;
    padding-bottom: 1.5rem;
    margin-bottom: 2.5rem;
    display: flex;
    align-items: baseline;
    gap: 1rem;
  }

  h1 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 56px;
    letter-spacing: 3px;
    color: #f0ede6;
    line-height: 1;
    margin: 0;
    font-weight: 400;
  }

  .badge {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: #1db954;
    letter-spacing: 3px;
    text-transform: uppercase;
  }

  section {
    margin-bottom: 3rem;
  }

  .section-label {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #444;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #1a1a1a;
  }

  .step {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: #1db954;
    letter-spacing: 2px;
    margin: 0 0 8px;
  }

  .field-label {
    display: block;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #444;
    margin-bottom: 4px;
  }

  .input {
    background: #111;
    border: 1px solid #222;
    color: #f0ede6;
    font-family: 'DM Mono', monospace;
    font-size: 13px;
    padding: 10px 14px;
    width: 100%;
    box-sizing: border-box;
    outline: none;
  }

  .input:focus {
    border-color: #1db954;
  }

  .btn {
    background: transparent;
    border: 1px solid #f0ede6;
    color: #f0ede6;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 10px 20px;
    cursor: pointer;
  }

  .btn:hover:enabled {
    background: #f0ede6;
    color: #0a0a0a;
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .btn-green {
    border-color: #1db954;
    color: #1db954;
  }

  .btn-green:hover:enabled {
    background: #1db954;
    color: #0a0a0a;
  }

  .split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 1rem;
  }

  .split-col {
    display: flex;
    flex-direction: column;
  }

  .raw {
    background: #0f0f0f;
    border-left: 2px solid #1db954;
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    color: #666;
    padding: 1rem;
    white-space: pre-wrap;
    word-break: break-word;
    min-height: 200px;
    margin: 0;
    line-height: 1.6;
    flex: 1;
  }

  .interpretation {
    background: #0f0f0f;
    border-left: 2px solid #ff6b35;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: #c8c4bc;
    padding: 1rem;
    min-height: 200px;
    line-height: 1.7;
    font-style: italic;
    flex: 1;
  }

  .auth-url {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: #1db954;
    word-break: break-all;
    margin: 8px 0 1rem;
    padding: 8px;
    background: #0f0f0f;
    border: 1px solid #1a2a1a;
  }

  .auth-url a {
    color: #1db954;
    text-decoration: none;
  }

  .error {
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    color: #ff4444;
    margin: 4px 0;
  }
</style>