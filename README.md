# OpenClose (static PWA)
Client-only AI chat. Data lives in your browser (IndexedDB); the browser calls your OpenAI-compatible endpoints directly. No backend, no accounts, no paid services.

## Run locally
    npx serve public        # or: python3 -m http.server -d public 8000
Open http://localhost:3000 (or :8000). Service workers need localhost or HTTPS.

## Deploy (free)
- **Cloudflare Pages**: connect the repo, build command empty, output directory `public`. `public/_headers` is applied automatically.
- **Vercel**: import the repo as a static project; `vercel.json` sets output to `public`.
- **GitHub Pages / any static host**: upload the contents of `public/`. All paths are relative, so subpaths work.
No secrets or endpoints are in the repo: add models in the app (Models > Add model).

## Model server requirements
The server must allow browser requests (CORS) from your site's origin, and be HTTPS if your site is HTTPS (localhost is exempt). Ollama: set `OLLAMA_ORIGINS`. LM Studio: enable CORS. vLLM: `--allowed-origins`. The connection test reports CORS failures explicitly.

## Backup
Settings > Export all data (versioned JSON; API keys excluded unless ticked). Import validates before touching data, with merge or replace (replace asks for confirmation).

## Security & offline
Stored API keys are plaintext in the browser profile. Offline, the interface and saved chats open; generating replies needs a reachable model endpoint. The service worker only caches the app's own static files, never model responses or credentials.

## Tests
    npm install && npm test     # backup/restore, context boundary, SSE parser, error mapping
