# mock-api-generator

[![tests](https://github.com/dguywhoknows/mock-api-generator/actions/workflows/tests.yml/badge.svg)](https://github.com/dguywhoknows/mock-api-generator/actions/workflows/tests.yml)

Describe an API in plain English and get a schema, realistic relational fake data, a working in-browser REST simulator, and TypeScript/OpenAPI exports.

Live: https://dguywhoknows.github.io/mock-api-generator/

## Overview

Mock Forge is for frontend developers who can't wait for the backend. Describe the API ("a blogging platform: users write posts, readers leave comments…") and the AI designs typed resources with relations, enums, ranges and constraints. A seeded fake-data engine fills them in dependency order, so every foreign key points at a real row. The built-in REST simulator handles GET, POST, PUT, PATCH and DELETE with filtering operators, full-text search, multi-key sorting, pagination, field projection, relation expansion, nested routes, schema validation with 422 errors, simulated latency and a chaos mode. You can export TypeScript interfaces, OpenAPI 3, JSON Schema or a json-server db.json.

## Pages

- **Schema**
- **Data**
- **Console**
- **Routes**
- **Export**
- **Settings**

## Features

- AI schema design with 29 field types, refs, enums, ranges, required/nullable/unique
- Seeded, reproducible fake data generated in topological (FK-safe) order
- REST simulator: CRUD, filters (_gte/_lte/_ne/_like), q search, multi-sort, page/limit, fields, expand, nested routes
- Validation engine with 422 details (types, enums, ranges, emails, FK existence, uniqueness, unknown fields)
- Latency simulation and chaos mode (random 500s) for resilience testing
- Syntax-highlighted JSON console with one-click example requests
- Exports: TypeScript interfaces, OpenAPI 3.0, JSON Schema, db.json
- Schema page: editable resources and fields (types, required/nullable/unique, ranges, enum values, references) with a live entity-relationship diagram; data regenerates as you edit
- Data page: browse generated rows per resource, change the seed and row count, download CSV
- Console page: request history, and copyable curl and fetch snippets for the current request
- Routes page: per-route overrides with path patterns (:id, *), forced status codes, artificial delay, custom bodies and a hit rate, for testing error and loading states
- Exports: SQL (CREATE TABLE with NOT NULL, UNIQUE, CHECK and foreign keys, plus INSERTs in dependency order) and Mock Service Worker handlers, alongside TypeScript, OpenAPI 3, JSON Schema and db.json

## How it works

LLM calls are used for:

- Natural-language → typed API schema (JSON), sanitized and repaired locally

Everything else (data generation, routing, querying, validation, exports) runs locally in the browser.

## Getting started

No build step and no dependencies. Serve the folder with any static server:

```bash
git clone https://github.com/dguywhoknows/mock-api-generator.git
cd mock-api-generator
python -m http.server 8000
```

Then open http://localhost:8000.

`index.html` is the public home page, `login.html` handles accounts and `app.html` is the app.

### Telling the app what to do

Every page has an **Ask AI** box (Ctrl/Cmd+K). Type a request in plain words and the model plans a sequence of
calls to the app's own functions, runs them and reports back. The **Instructions** tab stores standing
preferences that are added to every AI request the app makes.

### Configuration

`src/lib/config.js` is generated from the build settings: the Supabase project (accounts) and the AI proxy URL.
Signed-in users get the built-in AI through the proxy, which keeps the provider key as a server-side secret.
Without those settings the app runs for guests, in demo mode, or with a personal [Groq](https://console.groq.com/keys)
or [OpenRouter](https://openrouter.ai/keys) key entered under **Settings → Model provider** (stored only in this
browser and sent only to that provider).

## Testing

`src/core.js` holds the app's logic as pure functions and is covered by 9 unit tests.

```bash
node tests/run-node.js        # CI runs this on every push
```

Or open `tests/index.html` in a browser ([live](https://dguywhoknows.github.io/mock-api-generator/tests/)).

## Project structure

```
index.html           public home page (generated)
login.html           sign-in and sign-up (generated)
app.html             the app: markup for every page
src/app.js           UI, page wiring and event handlers
src/core.js          pure logic with no DOM access (unit-tested)
src/demo.js          sample responses used when no API key is configured
src/lib/ai.js        LLM client: Groq / OpenRouter, streaming, JSON mode, retries
src/lib/dom.js       DOM helpers, namespaced storage, markdown renderer
src/lib/router.js    hash router and the Settings page
src/lib/copilot.js   AI command box that drives the app's own functions
src/lib/auth.js      accounts (Supabase Auth) and the sign-in gate
styles/base.css      design tokens and shared components
styles/app.css       app-specific styles
tests/               unit tests (browser runner + Node runner for CI)
```

## Tech

- Topological sort for relational data generation
- URL/query parsing with an operator mini-language
- OpenAPI 3 + JSON Schema generators
- Seeded generator, REST simulator, override matching and exporters in src/core.js covered by unit tests run in the browser and in CI
- Vanilla JavaScript, no framework or bundler
- Deployed with GitHub Pages

## License

MIT
