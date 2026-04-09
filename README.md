# Spotify MCP Explorer

A SvelteKit web application that connects to Spotify via a Model Context Protocol (MCP) server, exposed as REST API endpoints using [mcpo](https://github.com/open-webui/mcpo). The app fetches your current Spotify playback state and uses a local Ollama LLM to generate witty, personalized comments about what you're listening to.

## How It Works

1. A Spotify MCP server runs locally and handles Spotify Web API calls
2. mcpo wraps the MCP server and exposes it as REST endpoints
3. A SvelteKit frontend sends requests to the mcpo endpoints via a local proxy
4. Spotify data is passed to a local Ollama model which interprets and comments on it

## Prerequisites

- Node.js and npm
- Python and `uvx` available in your shell
- [Ollama](https://ollama.com) installed locally
- A Spotify Developer account with an app created at [developer.spotify.com](https://developer.spotify.com)

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/Adetoun-T/mcpo-example.git
cd mcpo-example
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

Create a `mcp_config.json` file in the project root (do not commit this file — it contains your credentials):

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

Replace `/path/to/spotify-mcp` with the actual path on your machine.

### 4. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Set the Ollama model in `.env`:
ollama_model=llama3.2:3b

### 5. Add redirect URI to Spotify Dashboard

In your Spotify Developer app settings, add `http://127.0.0.1:8888/callback` as an allowed redirect URI.

### 6. Pull the Ollama model

```bash
ollama pull llama3.2:3b
```

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

## Usage

1. Click **Get Auth URL** to generate a Spotify authorization link
2. Open the link in your browser and authorize the app
3. Copy the full callback URL from your browser's address bar and paste it into the app
4. Click **Complete Auth**
5. Click **What am I listening to?** to fetch your current track and get a witty Ollama commentary

## Tech Stack

- [SvelteKit](https://kit.svelte.dev) — frontend framework
- [mcpo](https://github.com/open-webui/mcpo) — MCP to REST proxy
- [sespinosa/spotify-mcp](https://github.com/sespinosa/spotify-mcp) — Spotify MCP server
- [Ollama](https://ollama.com) — local LLM inference
- Spotify Web API