# GESTURE AI: Spatial Spotify Controller with AI Feedback

A touchless, hand-tracking interface that transforms physical gestures into real-time Spotify playback commands, enriched with witty AI commentary on your current listening.

---

## Tagline

Control your music with your hands — no touch required. GESTURE AI uses computer vision and a local LLM to turn your gestures into Spotify commands and roast your music taste in real time.

---

## Project Description

GESTURE AI is a SvelteKit web application that combines hand-tracking via ml5.js HandPose with the Spotify Web API through a Model Context Protocol (MCP) server. The app detects 21 hand landmarks through your webcam at 30+ FPS and maps them to Spotify playback commands — play, pause, skip, go back, and volume control. At the same time, a locally running Ollama LLM (Google Gemma) watches what you're listening to and generates witty, personalized commentary about your music taste whenever the track changes.

Key features:
- Real-time hand gesture detection using ml5.js HandPose
- Touchless Spotify playback control (play, pause, next, previous, volume up/down)
- MCP-based Spotify integration via mcpo REST proxy
- Automatic AI commentary on current track using a local Ollama model
- Activity log showing all gesture detections and Spotify events
- Dark editorial UI inspired by music magazines

---

## Target Audience

This project is for music lovers, developers, and HCI enthusiasts who want to explore novel interaction paradigms for everyday media control. It is most useful in contexts where touching a keyboard or phone is inconvenient — cooking, working out, presenting, or just wanting a hands-free experience at a desk. It also serves as a reference implementation for developers interested in combining MCP servers, computer vision, and local LLMs in a single SvelteKit application.

---

## Motivation

This project grew out of a frustration with the friction of traditional media controls — pausing music mid-workout, skipping a song while cooking, or adjusting volume during a presentation all require breaking focus to find a device. The goal was to build an interface that felt invisible: one where the act of controlling music was as natural as a hand gesture.

The project also explores several research questions:
- Can hand gesture recognition be reliable enough for everyday use in a browser-based application?
- How does real-time AI commentary change the way users relate to their listening habits?
- What does it feel like to interact with a system that reacts to your music taste with personality?

---

## Human-Centered Design Analysis

### Affordances and Anti-Affordances
The camera feed and gesture legend make it immediately clear that the interface responds to hand movements — the visual presence of the camera and the labeled gesture grid afford physical interaction. The absence of any keyboard shortcuts or buttons for playback control is an intentional anti-affordance that pushes the user toward gesture-based interaction.

### Intentional Constraints
A 1.5-second cooldown between gesture recognitions prevents accidental double-triggers. The interface only responds to gestures with a confidence score above 0.1, filtering out noise. Authentication must be completed before any music controls are accessible, ensuring the system is always in a valid state before interaction begins.

### Signifiers
The gesture legend in the bottom-left of the camera feed acts as a persistent reference guide — each gesture is shown with its emoji, name, and action label. The active gesture card highlights in acid green (`#c8ff00`) when detected, signaling to the user which gesture the system is currently reading. The status indicators in the header (Camera, ml5 HandPose, Spotify) use pulsing green dots to communicate system readiness.

### Visual and Interactive Cues
Corner bracket overlays on the camera feed signal the active tracking area. The gesture label at the bottom of the feed updates in real time. A large flash overlay appears center-screen whenever a gesture is recognized and acted upon, providing immediate confirmation. The progress bar and playback controls update in real time, reflecting the current state of Spotify playback.

### System Response to User Input
Each recognized gesture triggers an immediate MCP API call to Spotify and a flash confirmation on screen. The activity log records every gesture detection and Spotify event with timestamps, giving the user a transparent view of system activity. The Ollama commentary updates automatically whenever the track changes, without any user action required.

### Feedback Loops
The combination of the gesture flash, the activity log entry, and the Spotify state update (track name, play/pause button state) creates a three-layer feedback loop that reinforces the connection between gesture and outcome. The Ollama commentary adds a delayed but memorable feedback loop — the system "reacting" to what you're listening to encourages users to pay attention to their own music choices.

---

## Installation

### Prerequisites
- Node.js (v18 or higher) and npm
- Python and `uvx` available in your shell
- [Ollama](https://ollama.com) installed locally
- A Spotify Developer account with an app created at [developer.spotify.com](https://developer.spotify.com)
- Spotify Premium (required for playback control via the Spotify Web API)

### 1. Clone the repo
```bash
git clone https://github.com/Adetoun-T/Gesture-AI.git
cd Gesture-AI
npm install
```

### 2. Clone and build the Spotify MCP server
```bash
git clone https://github.com/sespinosa/spotify-mcp.git
cd spotify-mcp
npm install
npm run build
cd ..
```

### 3. Configure mcpo
Create a `mcp_config.json` file in the project root. Do not commit this file — it contains your credentials. Add it to `.gitignore` first:

```bash
echo "mcp_config.json" >> .gitignore
```

Then create the file:

```json
{
  "mcpServers": {
    "spotify": {
      "command": "node",
      "args": ["/path/to/spotify-mcp/dist/index.js"],
      "env": {
        "SPOTIFY_CLIENT_ID": "your_client_id",
        "SPOTIFY_CLIENT_SECRET": "your_client_secret",
        "SPOTIFY_REDIRECT_URI": "http://127.0.0.1:8888/callback",
        "SPOTIFY_PERSIST_TOKENS": "true"
      }
    }
  }
}
```

Replace `/path/to/spotify-mcp` with the actual absolute path on your machine.

### 4. Configure environment variables
```bash
cp .env.example .env
```

Set the Ollama model in `.env`: ollama_model=llama3.2:3b

### 5. Add redirect URI to Spotify Dashboard
In your Spotify Developer app settings, add `http://127.0.0.1:8888/callback` as an allowed redirect URI.

### 6. Pull the Ollama model
```bash
ollama pull llama3.2:3b
```

---

## Running the App

You need three terminals running simultaneously:

**Terminal 1 — Start Ollama:**
```bash
ollama serve
```

**Terminal 2 — Start mcpo:**
```bash
uvx mcpo --port 8000 --config ./mcp_config.json
```

**Terminal 3 — Start SvelteKit:**
```bash
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Usage

1. On the setup screen, click **Get Auth URL** to generate a Spotify authorization link
2. Open the link in your browser and log in to Spotify
3. After authorizing, copy the full callback URL from your browser's address bar and paste it into the app
4. Click **Complete Auth & Launch** — the app will transition to the main interface
5. Allow camera access when prompted
6. Wait for the Camera, ml5 HandPose, and Spotify status indicators to turn green
7. Use the following gestures to control playback:

| Gesture | Action |
|---|---|
| ✊ Fist | Pause |
| ✋ Open hand | Play |
| 👉 Point right | Next track |
| 👈 Point left | Previous track |
| 👍 Thumbs up | Volume up |
| 👎 Thumbs down | Volume down |

8. The AI commentary under "Now Playing" updates automatically whenever the track changes

---

## License

MIT License — see [LICENSE](./LICENSE) for details.

---

## Acknowledgments

**Technologies and Libraries:**
- [SvelteKit](https://kit.svelte.dev) — frontend framework
- [ml5.js](https://ml5js.org) — HandPose model for gesture detection
- [mcpo](https://github.com/open-webui/mcpo) — MCP to REST proxy
- [sespinosa/spotify-mcp](https://github.com/sespinosa/spotify-mcp) — Spotify MCP server
- [Ollama](https://ollama.com) — local LLM inference
- [Google Gemma / llama3.2](https://ollama.com/library/llama3.2) — language model
- Spotify Web API
- Tailwind CSS

**Design Inspiration:**
- Music editorial aesthetics (Pitchfork, The FADER)
- Don Norman's *The Design of Everyday Things* — HCD framework
- [aaronkutnick/mcpo-example](https://github.com/aaronkutnick/mcpo-example) — original mcpo SvelteKit template

---

## Roadmap

**Next steps:**
- Switch from Ollama to Claude API for faster, wittier commentary
- Merge with gesture project's direct Spotify OAuth for access to listening history and top artists
- Add top artists display with finger-count gesture selection (1–5 fingers to play top artist)
- Add gesture customization — let users remap gestures to actions

**Planned features:**
- Display recently played tracks alongside now playing
- Visual waveform or beat visualization synced to current track
- Mobile support with device camera

**Future improvements:**
- Improve gesture classification reliability in low-light conditions
- Add multi-hand support for more gesture combinations
- Explore fine-tuning a smaller model specifically for music commentary
