# mcpo Example

SvelteKit example for testing two `mcpo`-exposed MCP tools from the browser:

- `fetch` via `POST /fetch/fetch`
- `time` via `POST /time/get_current_time`

The page lives in [src/routes/+page.svelte](src/routes/+page.svelte) and sends requests to a local SvelteKit proxy at [src/routes/api/mcpo/+server.js](src/routes/api/mcpo/+server.js), which forwards them to the `mcpo` server configured by `mcpo_base_url`.

## Prerequisites

- Node.js and npm
- `uvx` available in your shell
- Ollama installed locally

## Install

```sh
npm install
```

Create your local env file if needed:

```sh
cp .env.example .env
```

The default mcpo base URL is configured with `mcpo_base_url`.
The Ollama base URL is configured with `ollama_base_url`.
The Ollama model is configured with `ollama_model`.

## Start mcpo

This project expects `mcpo` to run on port `8000` using [mcp_config.json](mcp_config.json):

```sh
uvx mcpo --port 8000 --config ./mcp_config.json
```

Default env value:

```sh
mcpo_base_url=http://127.0.0.1:8000
ollama_base_url=http://127.0.0.1:11434
ollama_model=gemma3:1b
```

Configured MCP servers:

- `fetch` using `mcp-server-fetch`
- `time` using `mcp-server-time`

## Run the example

In a second terminal:

```sh
npm run dev
```

Then open the local Svelte app in your browser.

Make sure Ollama is running at `ollama_base_url` with the configured model available.

## What the page does

- Uses `mcpo_base_url` from `.env` for all proxied requests
- Sends browser requests to the local `/api/mcpo` proxy route
- The proxy forwards requests server-side to the local `mcpo` process
- Sends mcpo responses to `/api/interpret` for Ollama summarization using `ollama_base_url`
- Sends a fetch request with:
	- `url`
	- `max_length`
- Sends a time request with:
	- `timezone`
- Displays the raw response body and an Ollama interpretation

Default example inputs:

- Fetch URL: `https://en.wikipedia.org/wiki/Pizza`
- Timezone: `UTC`

## Build

```sh
npm run build
```

Preview the production build with:

```sh
npm run preview
```
