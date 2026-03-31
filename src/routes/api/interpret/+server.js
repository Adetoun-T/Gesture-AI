import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';

const FALLBACK_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const FALLBACK_OLLAMA_MODEL = 'gemma3:1b';
const ollamaBaseUrl = new URL(env.ollama_base_url || FALLBACK_OLLAMA_BASE_URL);
const ollamaModel = env.ollama_model || FALLBACK_OLLAMA_MODEL;
const toolPrompts = {
	fetch: 'Interpret this fetch tool response for a user. Give a short plain-English summary with the most important information.',
	time: 'Interpret this time tool response for a user. State the current time clearly and mention the timezone.'
};

function normalizeTool(input) {
	if (input !== 'fetch' && input !== 'time') {
		throw error(400, 'tool must be fetch or time');
	}

	return input;
}

function normalizeContent(input) {
	if (typeof input !== 'string' || input.trim().length === 0) {
		throw error(400, 'content is required');
	}

	return input.trim();
}

function buildPrompt(tool, content) {
	return `${toolPrompts[tool]}\n\nKeep the answer brief.\n\nTool: ${tool}\nResponse:\n${content}`;
}

export async function POST({ request, fetch }) {
	const payload = await request.json();
	const tool = normalizeTool(payload.tool);
	const content = normalizeContent(payload.content);

	const ollamaResponse = await fetch(`${ollamaBaseUrl.toString().replace(/\/$/, '')}/api/generate`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			model: ollamaModel,
			prompt: buildPrompt(tool, content),
			stream: false
		})
	});

	const text = await ollamaResponse.text();
	let parsed = text;

	try {
		parsed = JSON.parse(text);
	} catch {
		// Keep non-JSON error bodies as text.
	}

	if (!ollamaResponse.ok) {
		throw error(
			ollamaResponse.status,
			typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
		);
	}

	return json({
		content: typeof parsed === 'object' && parsed && 'response' in parsed ? parsed.response : text
	});
}