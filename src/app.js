const { $, $$, h, esc, busy, toast, download, store } = Kit;
let schema = sanitizeSchema(store.get('mockforge.schema', null) || DEMO_SCHEMA);
let draft = JSON.parse(JSON.stringify(schema));
let db = {};
let overrides = store.get('mockforge.overrides', [{ method: 'GET', path: '/users/:id', status: 503, delay: 0, body: '', rate: 1, enabled: false }]);
let history = store.get('mockforge.history', []);
let exportKind = 'ts', curRes = null;
const BASE = 'https://mock.local';
const saveSchema = () => store.set('mockforge.schema', schema);
const saveOv = () => store.set('mockforge.overrides', overrides);

/* ================= data ================= */
function generate() {
  db = generateDb(schema, +$('#seed').value || 1, Math.max(1, Math.min(500, +$('#rows').value || 25)));
  renderAll();
}
function renderAll() { renderEditor(); renderER(); renderData(); renderExport(); renderEndpoints(); }
function renderData() {
  const tabs = $('#resTabs');
  tabs.innerHTML = '';
  if (!curRes || !db[curRes]) curRes = schema.resources[0]?.name;
  schema.resources.forEach((r) => tabs.append(h('button', { class: 'btn sm' + (r.name === curRes ? ' primary' : ''), onclick: () => { curRes = r.name; renderData(); } }, `${r.name} (${db[r.name]?.length || 0})`)));
  const res = findRes(schema, curRes);
  if (!res) { $('#dataTable').innerHTML = ''; return; }
  const rows = db[curRes] || [], cols = res.fields.map((f) => f.name);
  $('#dataTable').innerHTML = `<table><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${rows.slice(0, 200).map((row) => `<tr>${cols.map((c) => `<td title="${esc(JSON.stringify(row[c]))}">${esc(Array.isArray(row[c]) ? row[c].join(', ') : row[c] ?? '')}</td>`).join('')}</tr>`).join('')}</table>${rows.length > 200 ? `<p class="small muted">Showing 200 of ${rows.length}.</p>` : ''}`;
}
$('#regen').onclick = generate;
$('#seed').onchange = generate;
$('#rows').onchange = generate;
$('#dataCsv').onclick = () => {
  const res = findRes(schema, curRes), q = (v) => `"${String(Array.isArray(v) ? v.join('|') : v ?? '').replace(/"/g, '""')}"`;
  download(curRes + '.csv', [res.fields.map((f) => f.name).join(','), ...db[curRes].map((r) => res.fields.map((f) => q(r[f.name])).join(','))].join('\n'), 'text/csv');
};

/* ================= schema editor ================= */
let editTimer = null;
function schemaChanged() {
  clearTimeout(editTimer);
  editTimer = setTimeout(() => { schema = sanitizeSchema(draft); saveSchema(); generate(); }, 350);
}
function renderEditor() {
  const box = $('#editor');
  $('#schemaInfo').textContent = `${schema.resources.length} resources · ${schema.resources.reduce((a, r) => a + r.fields.length, 0)} fields`;
  if (box.contains(document.activeElement)) return;
  box.innerHTML = '';
  draft.resources.forEach((r) => {
    const body = h('tbody', {});
    r.fields.forEach((f) => {
      const set = (k, v) => { if (v === '' || v === false || v == null) delete f[k]; else f[k] = v; schemaChanged(); };
      const props = h('div', { class: 'row props' },
        ...['required', 'nullable', 'unique'].map((k) => h('label', { class: 'chk small' }, h('input', { type: 'checkbox', checked: !!f[k], disabled: f.type === 'id', onchange: (e) => set(k, e.target.checked) }), k)),
        ...(['int', 'float', 'price'].includes(f.type) ? [h('input', { class: 'input', type: 'number', placeholder: 'min', value: f.min ?? '', 'aria-label': 'Minimum', onchange: (e) => set('min', e.target.value === '' ? null : +e.target.value) }), h('input', { class: 'input', type: 'number', placeholder: 'max', value: f.max ?? '', 'aria-label': 'Maximum', onchange: (e) => set('max', e.target.value === '' ? null : +e.target.value) })] : []),
        ...(f.type === 'enum' ? [h('input', { class: 'input', style: 'width:180px', placeholder: 'a, b, c', value: (f.values || []).join(', '), 'aria-label': 'Values', onchange: (e) => set('values', e.target.value.split(',').map((s) => s.trim()).filter(Boolean)) })] : []),
        ...(f.type === 'ref' ? [h('select', { 'aria-label': 'Referenced resource', onchange: (e) => set('ref', e.target.value) }, draft.resources.map((x) => h('option', { value: x.name, selected: x.name === f.ref }, x.name)))] : []));
      body.append(h('tr', {},
        h('td', {}, h('input', { class: 'input mono', value: f.name, disabled: f.type === 'id', 'aria-label': 'Field name', onchange: (e) => { f.name = e.target.value; schemaChanged(); } })),
        h('td', {}, h('select', { disabled: f.type === 'id', 'aria-label': 'Type', onchange: (e) => { f.type = e.target.value; if (f.type === 'ref' && !f.ref) f.ref = draft.resources.find((x) => x !== r)?.name || r.name; schemaChanged(); renderSoon(); } }, TYPES.filter((t) => t !== 'id' || f.type === 'id').map((t) => h('option', { value: t, selected: t === f.type }, t)))),
        h('td', {}, props),
        h('td', {}, f.type === 'id' ? '' : h('button', { class: 'btn ghost sm', 'aria-label': 'Remove field', onclick: () => { r.fields = r.fields.filter((x) => x !== f); schemaChanged(); renderSoon(); } }, '×'))));
    });
    box.append(h('div', { class: 'card ed' },
      h('div', { class: 'row between rh' }, h('input', { class: 'input', value: r.name, 'aria-label': 'Resource name', onchange: (e) => { const old = r.name; r.name = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') || old; draft.resources.forEach((x) => x.fields.forEach((f) => { if (f.ref === old) f.ref = r.name; })); schemaChanged(); } }),
        h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { r.fields.push({ name: 'field' + r.fields.length, type: 'word' }); schemaChanged(); renderSoon(); } }, 'Add field'), h('button', { class: 'btn ghost sm danger', onclick: () => { if (!confirm(`Delete /${r.name}?`)) return; draft.resources = draft.resources.filter((x) => x !== r); schemaChanged(); renderSoon(); } }, 'Delete'))),
      h('table', {}, body)));
  });
}
const renderSoon = () => setTimeout(() => { document.activeElement?.blur(); renderEditor(); }, 400);
$('#addRes').onclick = () => { let n = 'items', i = 2; while (findRes(draft, n)) n = 'items' + i++; draft.resources.push({ name: n, fields: [{ name: 'id', type: 'id' }, { name: 'name', type: 'title', required: true }, { name: 'createdAt', type: 'datetime' }] }); schemaChanged(); renderSoon(); };
function renderER() {
  const rs = schema.resources, colW = 210, gap = 70, rowH = 20, headH = 28, cols = Math.min(rs.length, 4);
  const pos = {};
  let maxH = 0;
  rs.forEach((r, i) => { const x = 10 + (i % cols) * (colW + gap), y = 10 + Math.floor(i / cols) * 0; pos[r.name] = { x, y, h: headH + r.fields.length * rowH + 6 }; maxH = Math.max(maxH, pos[r.name].h); });
  const rowsCount = Math.ceil(rs.length / cols);
  rs.forEach((r, i) => { pos[r.name].y = 10 + Math.floor(i / cols) * (maxH + 40); });
  const W = 20 + cols * colW + (cols - 1) * gap, H = 20 + rowsCount * (maxH + 40);
  let s = '<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--accent)"/></marker></defs>';
  rs.forEach((r) => {
    const p = pos[r.name];
    s += `<rect x="${p.x}" y="${p.y}" width="${colW}" height="${p.h}" rx="8" fill="var(--panel)" stroke="var(--line)"/><rect x="${p.x}" y="${p.y}" width="${colW}" height="${headH}" rx="8" fill="var(--panel-2)"/><text x="${p.x + 10}" y="${p.y + 19}" font-weight="700">/${esc(r.name)}</text>`;
    r.fields.forEach((f, j) => { const y = p.y + headH + j * rowH + 15; s += `<text x="${p.x + 10}" y="${y}">${esc(f.name)}</text><text x="${p.x + colW - 10}" y="${y}" text-anchor="end" style="fill:var(--muted)">${esc(f.type === 'ref' ? '→ ' + f.ref : f.type)}</text>`; });
  });
  rs.forEach((r) => r.fields.forEach((f, j) => {
    if (f.type !== 'ref' || !pos[f.ref]) return;
    const a = pos[r.name], b = pos[f.ref], y1 = a.y + headH + j * rowH + 11;
    const leftward = b.x < a.x || (b.x === a.x);
    const x1 = leftward ? a.x : a.x + colW, x2 = leftward ? b.x + colW : b.x, y2 = b.y + headH / 2;
    const c = b.x === a.x ? -60 : 0;
    s += `<path d="M${x1} ${y1} C ${(x1 + x2) / 2 + c} ${y1}, ${(x1 + x2) / 2 + c} ${y2}, ${x2} ${y2}" fill="none" stroke="var(--accent)" stroke-width="1.6" marker-end="url(#arr)"/>`;
  }));
  $('#er').innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Entity relationships">${s}</svg>`;
}
const DESIGN_PROMPT = `You are an API designer. Turn the description into resources for a REST mock. Use plural lowercase resource names. Field types must be one of: ${TYPES.join(', ')}.
Extra props: int/float/price → "min","max"; enum → "values":[...]; ref → "ref":"<resource name>" (name the field like authorId); any field → "required":true, "nullable":true, "unique":true.
Always include "id" (type id) and createdAt (datetime). 3-8 fields per resource, realistic. Return JSON {"resources":[{"name":"","fields":[{"name":"","type":""}]}]}.`;
$('#design').onclick = (e) => busy(e.currentTarget, async () => {
  const out = await AI.chat([{ role: 'system', content: DESIGN_PROMPT }, { role: 'user', content: $('#desc').value }], { json: true, temperature: 0.3, demo: DEMO_SCHEMA });
  schema = sanitizeSchema(out);
  draft = JSON.parse(JSON.stringify(schema));
  saveSchema();
  document.activeElement?.blur();
  generate();
  toast(`Designed ${schema.resources.length} resources`);
});

/* ================= console ================= */
async function send() {
  const method = $('#method').value, path = $('#path').value.trim().replace(/^(?!\/)/, '/'), body = $('#body').value;
  const t0 = performance.now();
  let status, payload, ov;
  if ($('#chaos').checked && Math.random() < 0.1) [status, payload] = [500, { error: 'Internal Server Error (chaos mode)' }];
  else [status, payload, ov] = handleRequest({ schema, db }, method, path, body, { overrides });
  const delay = (ov && +ov.delay) || ($('#latency').checked ? 80 + Math.random() * 220 : 0);
  if (delay) await new Promise((r) => setTimeout(r, delay));
  const ms = performance.now() - t0;
  $('#status').textContent = `${status} ${STATUS_TEXT[status] || ''}`;
  $('#status').className = 'tag ' + (status < 300 ? 'good' : status < 500 ? 'warn' : 'bad');
  $('#timing').textContent = `${ms.toFixed(0)} ms · ${method} ${path}${ov ? ' · override' : ''}`;
  $('#resp').innerHTML = payload == null ? '<span class="muted">(empty body)</span>' : highlight(JSON.stringify(payload, null, 2));
  history.unshift({ t: Date.now(), method, path, body: ['POST', 'PUT', 'PATCH'].includes(method) ? body : '', status });
  history = history.slice(0, 40);
  store.set('mockforge.history', history);
  if (method !== 'GET') { renderData(); renderEndpoints(); }
  renderHistory();
}
const highlight = (json) => esc(json).replace(/(&quot;(?:\\.|[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?/g, (m, str, colon, bool) => (str ? `<span class="${colon ? 'j-k' : 'j-s'}">${str}</span>${colon || ''}` : bool ? `<span class="j-b">${m}</span>` : `<span class="j-n">${m}</span>`));
let snipKind = 'curl';
function renderSnippet() { const m = $('#method').value, p = $('#path').value.trim().replace(/^(?!\/)/, '/'), b = $('#body').value; $('#snippet').textContent = snipKind === 'curl' ? curlFor(BASE, m, p, b) : fetchFor(BASE, m, p, b); }
function renderHistory() {
  $('#history').innerHTML = '';
  if (!history.length) $('#history').append(h('div', { class: 'muted' }, 'Requests you send appear here.'));
  history.slice(0, 12).forEach((x) => $('#history').append(h('div', { class: 'hist-row', title: 'Load this request', onclick: () => { $('#method').value = x.method; $('#method').onchange(); $('#path').value = x.path; $('#body').value = x.body || ''; renderSnippet(); } }, h('span', {}, x.method), h('span', { class: x.status < 300 ? '' : 'muted', style: `color:var(--${x.status < 300 ? 'good' : x.status < 500 ? 'warn' : 'bad'})` }, x.status), h('span', { style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, x.path))));
}
$('#send').onclick = (e) => busy(e.currentTarget, send);
$('#path').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#send').click(); });
['#path', '#body'].forEach((s) => $(s).addEventListener('input', renderSnippet));
$('#method').onchange = () => { $('#body').classList.toggle('hidden', !['POST', 'PUT', 'PATCH'].includes($('#method').value)); renderSnippet(); };
$$('#snipTabs button').forEach((b) => (b.onclick = () => { snipKind = b.dataset.s; $$('#snipTabs button').forEach((x) => x.classList.toggle('on', x === b)); renderSnippet(); }));
const EX = [
  ['GET', '/posts?status=published&sort=-views&limit=3&expand=author'],
  ['GET', '/users/2/posts?fields=id,title,status'],
  ['GET', '/posts?views_gte=20000&tags=tech&sort=title'],
  ['GET', '/posts/1?expand=comments'],
  ['POST', '/comments', '{"postId": 1, "authorId": 2, "body": "Great read!"}'],
  ['POST', '/posts', '{"title": "", "status": "deleted"}'],
  ['DELETE', '/comments/1'],
];
EX.forEach(([m, p, b]) => $('#examples').append(h('button', { class: 'btn sm ghost', onclick: () => { $('#method').value = m; $('#method').onchange(); $('#path').value = p; $('#body').value = b || ''; renderSnippet(); $('#send').click(); } }, `${m} ${p.split('?')[0]}`)));

/* ================= routes ================= */
function renderOverrides() {
  const t = $('#ovTable');
  t.innerHTML = '';
  t.append(h('tr', {}, ['On', 'Method', 'Path pattern', 'Status', 'Delay (ms)', 'Rate', 'Body (JSON)', ''].map((x) => h('th', {}, x))));
  if (!overrides.length) t.append(h('tr', {}, h('td', { colspan: 8, class: 'muted' }, 'No overrides. Requests go to the simulated API.')));
  overrides.forEach((o) => {
    const upd = (k, v) => { o[k] = v; saveOv(); };
    t.append(h('tr', {},
      h('td', {}, h('input', { type: 'checkbox', checked: o.enabled !== false, 'aria-label': 'Enabled', onchange: (e) => upd('enabled', e.target.checked) })),
      h('td', {}, h('select', { 'aria-label': 'Method', onchange: (e) => upd('method', e.target.value) }, ['*', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => h('option', { selected: m === o.method }, m)))),
      h('td', {}, h('input', { class: 'input mono', value: o.path, 'aria-label': 'Path', onchange: (e) => upd('path', e.target.value.trim().replace(/^(?!\/)/, '/')) })),
      h('td', {}, h('select', { 'aria-label': 'Status', onchange: (e) => upd('status', +e.target.value) }, Object.keys(STATUS_TEXT).map((s) => h('option', { value: s, selected: +s === +o.status }, `${s} ${STATUS_TEXT[s]}`)))),
      h('td', {}, h('input', { class: 'input', type: 'number', min: 0, max: 30000, value: o.delay || 0, style: 'width:90px', 'aria-label': 'Delay', onchange: (e) => upd('delay', +e.target.value) })),
      h('td', {}, h('select', { 'aria-label': 'Rate', onchange: (e) => upd('rate', +e.target.value) }, [1, 0.5, 0.25, 0.1].map((r) => h('option', { value: r, selected: r === (o.rate ?? 1) }, r === 1 ? 'always' : `${r * 100}%`)))),
      h('td', {}, h('textarea', { class: 'input', 'aria-label': 'Body', placeholder: 'default error body', onchange: (e) => upd('body', e.target.value) }, o.body || '')),
      h('td', {}, h('button', { class: 'btn ghost sm', 'aria-label': 'Remove override', onclick: () => { overrides = overrides.filter((x) => x !== o); saveOv(); renderOverrides(); } }, '×'))));
  });
}
$('#addOv').onclick = () => { overrides.push({ method: 'GET', path: '/' + (schema.resources[0]?.name || 'items'), status: 500, delay: 0, body: '', rate: 1, enabled: true }); saveOv(); renderOverrides(); };
function renderEndpoints() {
  $('#endpoints').innerHTML = schema.resources.map((r) => {
    const children = schema.resources.filter((c) => c.fields.some((f) => f.type === 'ref' && f.ref === r.name));
    return `<div style="padding:6px 0;border-bottom:1px solid var(--line)"><b class="mono">/${esc(r.name)}</b> <span class="muted">${db[r.name]?.length || 0} rows</span><div class="mono muted">GET POST /${esc(r.name)} · GET PUT PATCH DELETE /${esc(r.name)}/:id${children.map((c) => ` · GET /${esc(r.name)}/:id/${esc(c.name)}`).join('')}</div></div>`;
  }).join('');
}

/* ================= export ================= */
function renderExport() {
  const out = { ts: () => toTypeScript(schema), jsonschema: () => JSON.stringify(toJsonSchema(schema), null, 2), db: () => JSON.stringify(db, null, 2), openapi: () => JSON.stringify(toOpenAPI(schema, 'Mock API', $('#desc').value), null, 2), sql: () => toSQL(schema, db, 200), msw: () => toMSW(schema) }[exportKind]();
  $('#exportOut').textContent = out;
  $$('#exportKinds [data-x]').forEach((b) => b.classList.toggle('primary', b.dataset.x === exportKind));
}
$$('#exportKinds [data-x]').forEach((b) => (b.onclick = () => { exportKind = b.dataset.x; renderExport(); }));
$('#copyExport').onclick = () => navigator.clipboard.writeText($('#exportOut').textContent).then(() => toast('Copied'));
$('#dlExport').onclick = () => download({ ts: 'types.ts', openapi: 'openapi.json', jsonschema: 'schema.json', db: 'db.json', sql: 'schema.sql', msw: 'handlers.js' }[exportKind], $('#exportOut').textContent);

/* ================= boot ================= */
Router.on('routes', renderOverrides);
Router.on('export', renderExport);
generate();
renderOverrides();
renderHistory();
renderSnippet();
