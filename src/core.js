/* core.js — seeded fake data, schema handling, an in-memory REST simulator with route overrides, and code/schema exporters (pure, unit-tested). */

var WORDS = {
  first: ['Ava', 'Liam', 'Maya', 'Noah', 'Zoe', 'Ethan', 'Priya', 'Mateo', 'Yuki', 'Omar', 'Chloe', 'Leo', 'Amara', 'Lucas', 'Sofia', 'Kai', 'Nina', 'Arjun', 'Elena', 'Theo', 'Ines', 'Malik'],
  last: ['Smith', 'Patel', 'Garcia', 'Kim', 'Nguyen', 'Brown', 'Rossi', 'Müller', 'Okafor', 'Silva', 'Chen', 'Dubois', 'Khan', 'Lopez', 'Tanaka', 'Ivanova'],
  words: 'lorem system quantum river amber pixel orbit harbor velvet signal canvas summit echo lantern prism meadow vector beacon cobalt drift ember fable glacier horizon'.split(' '),
  nouns: 'guide story update recipe review tutorial journey release roadmap experiment checklist playbook'.split(' '),
  adjs: 'ultimate quick hidden modern practical surprising simple complete honest bold tiny weekly'.split(' '),
  topics: 'JavaScript coffee hiking design startups gardening climate music photography space cooking fitness'.split(' '),
  cities: [['Toronto', 'Canada'], ['Austin', 'USA'], ['Berlin', 'Germany'], ['Lisbon', 'Portugal'], ['Tokyo', 'Japan'], ['Nairobi', 'Kenya'], ['Sydney', 'Australia'], ['Mumbai', 'India'], ['Paris', 'France'], ['Seoul', 'South Korea']],
  companies: ['Globex', 'Initech', 'Umbrella Labs', 'Hooli', 'Stark Systems', 'Wayne Analytics', 'Acme Corp', 'Vandelay Imports'],
  jobs: ['Engineer', 'Designer', 'Product Manager', 'Data Scientist', 'Writer', 'Marketer', 'Founder', 'Analyst'],
  streets: ['Maple Ave', 'Oak St', 'King St W', 'Elm Rd', 'Harbour Blvd', 'Cedar Lane'],
  tags: ['news', 'howto', 'opinion', 'tech', 'life', 'travel', 'food', 'science', 'design', 'career'],
};
var TYPES = ['id', 'uuid', 'int', 'float', 'price', 'bool', 'enum', 'firstName', 'lastName', 'fullName', 'username', 'email', 'phone', 'url', 'imageUrl', 'city', 'country', 'address', 'company', 'jobTitle', 'title', 'word', 'sentence', 'paragraph', 'tags', 'date', 'datetime', 'color', 'ref'];
var STATUS_TEXT = { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict', 422: 'Unprocessable Entity', 429: 'Too Many Requests', 500: 'Internal Server Error', 503: 'Service Unavailable' };

function seededRng(seed) {
  var a = seed >>> 0;
  return function () { a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function faker(r) {
  var pick = function (a) { return a[Math.floor(r() * a.length)]; }, int = function (a, b) { return a + Math.floor(r() * (b - a + 1)); };
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  var sentence = function (n) { n = n || int(6, 12); var w = []; for (var i = 0; i < n; i++) w.push(pick(WORDS.words)); return cap(w.join(' ')) + '.'; };
  var date = function () { return new Date(Date.UTC(int(2023, 2026), int(0, 11), int(1, 28), int(0, 23), int(0, 59))).toISOString(); };
  var uuid = function () { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var v = Math.floor(r() * 16); return (c === 'x' ? v : (v & 3) | 8).toString(16); }); };
  return function gen(f, ctx) {
    var first = ctx.first || (ctx.first = pick(WORDS.first)), last = ctx.last || (ctx.last = pick(WORDS.last));
    var lo = f.min != null ? f.min : 0, hi = f.max != null ? f.max : 1000;
    switch (f.type) {
      case 'uuid': return uuid();
      case 'int': return int(lo, hi);
      case 'float': case 'price': { var a = f.min != null ? f.min : 1, b = f.max != null ? f.max : 500; return +(a + r() * (b - a)).toFixed(f.decimals != null ? f.decimals : 2); }
      case 'bool': return r() < (f.p != null ? f.p : 0.5);
      case 'enum': return pick(f.values && f.values.length ? f.values : ['a', 'b']);
      case 'firstName': return first;
      case 'lastName': return last;
      case 'fullName': return first + ' ' + last;
      case 'username': return (first + '.' + last + int(1, 99)).toLowerCase().replace(/[^a-z0-9.]/g, '');
      case 'email': return (first + '.' + last + int(1, 999) + '@example.com').toLowerCase().replace(/[^a-z0-9.@]/g, '');
      case 'phone': return '+1-' + int(200, 989) + '-' + int(200, 999) + '-' + String(int(0, 9999)).padStart(4, '0');
      case 'url': return 'https://' + pick(WORDS.words) + pick(WORDS.words) + '.example.com/' + pick(WORDS.words);
      case 'imageUrl': return 'https://picsum.photos/seed/' + int(1, 99999) + '/640/400';
      case 'city': return pick(WORDS.cities)[0];
      case 'country': return pick(WORDS.cities)[1];
      case 'address': return int(1, 999) + ' ' + pick(WORDS.streets) + ', ' + pick(WORDS.cities)[0];
      case 'company': return pick(WORDS.companies);
      case 'jobTitle': return pick(WORDS.jobs);
      case 'title': return cap('the ' + pick(WORDS.adjs) + ' ' + pick(WORDS.topics) + ' ' + pick(WORDS.nouns));
      case 'word': return pick(WORDS.words);
      case 'sentence': return sentence();
      case 'paragraph': { var p = [], n = int(3, 5); for (var i = 0; i < n; i++) p.push(sentence()); return p.join(' '); }
      case 'tags': { var t = [], k = int(1, 3); for (var j = 0; j < k; j++) { var x = pick(WORDS.tags); if (t.indexOf(x) < 0) t.push(x); } return t; }
      case 'date': return date().slice(0, 10);
      case 'datetime': return date();
      case 'color': return '#' + int(0, 0xffffff).toString(16).padStart(6, '0');
      default: return sentence(3);
    }
  };
}

/* ---------- schema ---------- */
function sanitizeSchema(s) {
  var out = { resources: [] };
  ((s && s.resources) || []).forEach(function (r) {
    var name = String(r.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'items';
    if (out.resources.some(function (x) { return x.name === name; })) return;
    var fields = (r.fields || []).filter(function (f) { return f && f.name; }).map(function (f) { return Object.assign({}, f, { name: String(f.name).replace(/[^A-Za-z0-9_]/g, ''), type: TYPES.indexOf(f.type) >= 0 ? f.type : 'sentence' }); });
    if (!fields.some(function (f) { return f.name === 'id'; })) fields.unshift({ name: 'id', type: 'id' });
    fields = fields.map(function (f) { return f.name === 'id' ? Object.assign({}, f, { type: 'id' }) : f; });
    out.resources.push({ name: name, fields: fields });
  });
  out.resources.forEach(function (r) { r.fields.forEach(function (f) { if (f.type === 'ref' && !out.resources.some(function (x) { return x.name === f.ref; })) { f.type = 'int'; delete f.ref; } }); });
  return out;
}
function findRes(schema, name) { return schema.resources.find(function (r) { return r.name === name; }); }
/* Parents before children so references point at existing ids. */
function topoOrder(schema) {
  var done = {}, out = [];
  var visit = function (r, depth) {
    if (done[r.name] || depth > 10) return;
    done[r.name] = 1;
    r.fields.forEach(function (f) { if (f.type === 'ref') { var t = findRes(schema, f.ref); if (t && t !== r) visit(t, depth + 1); } });
    out.push(r);
  };
  schema.resources.forEach(function (r) { visit(r, 0); });
  return out;
}
function generateDb(schema, seed, n) {
  var r = seededRng(seed || 1), gen = faker(r), db = {};
  topoOrder(schema).forEach(function (res) {
    db[res.name] = [];
    for (var i = 0; i < n; i++) {
      var ctx = {}, row = {};
      res.fields.forEach(function (f) {
        if (f.type === 'id') row[f.name] = i + 1;
        else if (f.type === 'ref') { var t = db[f.ref] || []; row[f.name] = t.length ? t[Math.floor(Math.pow(r(), 1.4) * t.length)].id : null; }
        else if (f.nullable && r() < 0.1) row[f.name] = null;
        else row[f.name] = gen(f, ctx);
      });
      if (res.fields.some(function (f) { return f.unique && f.type !== 'id'; })) {
        var clash = res.fields.filter(function (f) { return f.unique && f.type !== 'id'; }).some(function (f) { return db[res.name].some(function (x) { return x[f.name] === row[f.name]; }); });
        if (clash) res.fields.forEach(function (f) { if (f.unique && typeof row[f.name] === 'string') row[f.name] = row[f.name].replace(/@/, (i + 1) + '@').replace(/^([^@]*)$/, '$1-' + (i + 1)); });
      }
      db[res.name].push(row);
    }
  });
  return db;
}

/* ---------- REST simulator ---------- */
function relName(f) { return f.name.replace(/Id$|_id$/, ''); }
function validateBody(schema, db, res, body, partial) {
  if (typeof body !== 'object' || Array.isArray(body) || body === null) return ['Body must be a JSON object'];
  var errs = [];
  res.fields.forEach(function (f) {
    if (f.type === 'id') return;
    var v = body[f.name], t = f.type;
    if (v === undefined) { if (f.required && !partial) errs.push(f.name + ' is required'); return; }
    if (v === null) { if (!f.nullable) errs.push(f.name + ' cannot be null'); return; }
    if (f.required && typeof v === 'string' && !v.trim()) errs.push(f.name + ' cannot be empty');
    if (t === 'int' && !Number.isInteger(v)) errs.push(f.name + ' must be an integer');
    if ((t === 'float' || t === 'price') && typeof v !== 'number') errs.push(f.name + ' must be a number');
    if (t === 'bool' && typeof v !== 'boolean') errs.push(f.name + ' must be a boolean');
    if (t === 'enum' && (f.values || []).indexOf(v) < 0) errs.push(f.name + ' must be one of ' + (f.values || []).join(', '));
    if (t === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) errs.push(f.name + ' must be a valid email');
    if (t === 'tags' && !Array.isArray(v)) errs.push(f.name + ' must be an array');
    if ((t === 'date' || t === 'datetime') && isNaN(Date.parse(v))) errs.push(f.name + ' must be an ISO date');
    if (t === 'ref' && !(db[f.ref] || []).some(function (x) { return x.id === v; })) errs.push(f.name + ': ' + f.ref + ' ' + v + ' does not exist');
    if ((t === 'int' || t === 'float' || t === 'price') && typeof v === 'number' && ((f.min != null && v < f.min) || (f.max != null && v > f.max))) errs.push(f.name + ' must be between ' + f.min + ' and ' + f.max);
    if (f.unique && (db[res.name] || []).some(function (x) { return x[f.name] === v && x.id !== body.id; })) errs.push(f.name + ' must be unique');
  });
  Object.keys(body).forEach(function (k) { if (k !== 'id' && !res.fields.some(function (f) { return f.name === k; })) errs.push('unknown field "' + k + '"'); });
  return errs;
}
function expandRow(schema, db, res, row, expand) {
  if (!expand.length) return row;
  var out = Object.assign({}, row);
  res.fields.filter(function (f) { return f.type === 'ref' && expand.indexOf(relName(f)) >= 0; }).forEach(function (f) { out[relName(f)] = (db[f.ref] || []).find(function (x) { return x.id === row[f.name]; }) || null; });
  expand.filter(function (e) { return db[e]; }).forEach(function (child) {
    var cr = findRes(schema, child), fk = cr && cr.fields.find(function (f) { return f.type === 'ref' && f.ref === res.name; });
    if (fk) out[child] = db[child].filter(function (x) { return x[fk.name] === row.id; });
  });
  return out;
}
function project(row, fields) { if (!fields) return row; var keep = fields.split(','), o = {}; Object.keys(row).forEach(function (k) { if (keep.indexOf(k) >= 0) o[k] = row[k]; }); return o; }
function listRows(schema, db, res, rows, q, expand) {
  var out = rows.slice(), reserved = ['sort', 'page', 'limit', 'q', 'expand', 'fields'];
  var keys = Object.keys(q);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i], v = q[k];
    if (reserved.indexOf(k) >= 0) continue;
    var m = k.match(/^(.+?)_(gte|lte|gt|lt|ne|like)$/), field = m ? m[1] : k, op = m ? m[2] : 'eq';
    if (!res.fields.some(function (f) { return f.name === field; })) return [400, { error: 'Unknown filter field "' + field + '"' }];
    out = out.filter(function (row) {
      var x = row[field];
      if (Array.isArray(x)) return op === 'ne' ? x.indexOf(v) < 0 : x.indexOf(v) >= 0;
      var c = typeof x === 'number' ? Number(v) : typeof x === 'boolean' ? v === 'true' : v;
      return { eq: x == c, ne: x != c, gte: x >= c, lte: x <= c, gt: x > c, lt: x < c, like: String(x).toLowerCase().indexOf(String(v).toLowerCase()) >= 0 }[op];
    });
  }
  if (q.q) { var t = q.q.toLowerCase(); out = out.filter(function (row) { return Object.keys(row).some(function (key) { return String(row[key]).toLowerCase().indexOf(t) >= 0; }); }); }
  if (q.sort) {
    var sk = q.sort.split(',');
    out.sort(function (a, b) { for (var j = 0; j < sk.length; j++) { var d = sk[j].charAt(0) === '-' ? -1 : 1, f = sk[j].replace(/^-/, ''); if (a[f] < b[f]) return -d; if (a[f] > b[f]) return d; } return 0; });
  }
  var limit = Math.max(1, Math.min(100, +q.limit || 10)), page = Math.max(1, +q.page || 1), total = out.length;
  var data = out.slice((page - 1) * limit, page * limit).map(function (r) { return project(expandRow(schema, db, res, r, expand), q.fields); });
  return [200, { data: data, meta: { total: total, page: page, limit: limit, pages: Math.ceil(total / limit) } }];
}
/* "/users/:id/posts" matches "/users/3/posts"; "*" matches the rest. */
function matchRoute(pattern, path) {
  var p = pattern.split('?')[0].split('/').filter(Boolean), s = path.split('?')[0].split('/').filter(Boolean), params = {};
  for (var i = 0; i < p.length; i++) {
    if (p[i] === '*') return params;
    if (i >= s.length) return null;
    if (p[i].charAt(0) === ':') params[p[i].slice(1)] = s[i];
    else if (p[i] !== s[i]) return null;
  }
  return p.length === s.length ? params : null;
}
function findOverride(overrides, method, path) {
  return (overrides || []).find(function (o) { return o.enabled !== false && (o.method === '*' || o.method === method) && matchRoute(o.path, path); }) || null;
}
/* state = {schema, db}; mutates db for writes. Returns [status, payload]. opts: {overrides, random} */
function handleRequest(state, method, rawPath, bodyText, opts) {
  opts = opts || {};
  var schema = state.schema, db = state.db;
  var ov = findOverride(opts.overrides, method, rawPath.replace(/^\/*/, '/'));
  if (ov && (ov.rate == null || (opts.random || Math.random)() < ov.rate)) {
    var b = ov.body;
    if (typeof b === 'string') { try { b = b.trim() ? JSON.parse(b) : null; } catch (e) { b = { error: b }; } }
    return [+ov.status || 200, b == null && +ov.status !== 204 ? { error: STATUS_TEXT[ov.status] || 'Overridden' } : b, ov];
  }
  var url = new URL(rawPath.replace(/^\/*/, '/'), 'http://mock.local'), seg = url.pathname.split('/').filter(Boolean);
  var res = findRes(schema, seg[0]);
  if (!res) return [404, { error: 'No resource "' + (seg[0] || '') + '". Available: ' + schema.resources.map(function (r) { return '/' + r.name; }).join(', ') }];
  var rows = db[res.name], q = {};
  url.searchParams.forEach(function (v, k) { q[k] = v; });
  var expand = (q.expand || '').split(',').filter(Boolean), id = seg[1] != null ? Number(seg[1]) : null, body = null;
  if (['POST', 'PUT', 'PATCH'].indexOf(method) >= 0) { try { body = JSON.parse(bodyText || '{}'); } catch (e) { return [400, { error: 'Invalid JSON: ' + e.message }]; } }
  if (seg[2]) {
    var child = findRes(schema, seg[2]), fk = child && child.fields.find(function (f) { return f.type === 'ref' && f.ref === res.name; });
    if (!child || !fk) return [404, { error: 'No relation ' + res.name + ' -> ' + seg[2] }];
    if (!rows.some(function (x) { return x.id === id; })) return [404, { error: res.name + ' ' + id + ' not found' }];
    if (method !== 'GET') return [405, { error: 'Nested routes are read-only' }];
    return listRows(schema, db, child, db[child.name].filter(function (x) { return x[fk.name] === id; }), q, expand);
  }
  if (method === 'GET' && id == null) return listRows(schema, db, res, rows, q, expand);
  var row = id != null ? rows.find(function (x) { return x.id === id; }) : null;
  if (method === 'GET') return row ? [200, project(expandRow(schema, db, res, row, expand), q.fields)] : [404, { error: res.name + ' ' + id + ' not found' }];
  if (method === 'POST') {
    if (id != null) return [405, { error: 'POST to the collection, not an item' }];
    var errs = validateBody(schema, db, res, body, false);
    if (errs.length) return [422, { error: 'Validation failed', details: errs }];
    var created = Object.assign({ id: rows.reduce(function (a, x) { return Math.max(a, x.id); }, 0) + 1 }, body);
    if (res.fields.some(function (f) { return f.name === 'createdAt'; }) && !created.createdAt) created.createdAt = new Date().toISOString();
    rows.push(created);
    return [201, created];
  }
  if (method === 'PUT' || method === 'PATCH') {
    if (!row) return [404, { error: res.name + ' ' + id + ' not found' }];
    var e2 = validateBody(schema, db, res, Object.assign({}, body, { id: id }), method === 'PATCH');
    if (e2.length) return [422, { error: 'Validation failed', details: e2 }];
    if (method === 'PUT') Object.keys(row).forEach(function (k) { if (k !== 'id') delete row[k]; });
    Object.assign(row, body, { id: id });
    return [200, row];
  }
  if (method === 'DELETE') {
    if (!row) return [404, { error: res.name + ' ' + id + ' not found' }];
    rows.splice(rows.indexOf(row), 1);
    return [204, null];
  }
  return [405, { error: 'Method not allowed' }];
}

/* ---------- exporters ---------- */
function pascal(s) { return s.replace(/(^|_)(\w)/g, function (_, __, c) { return c.toUpperCase(); }).replace(/ies$/, 'y').replace(/s$/, ''); }
function tsType(f) {
  var base = { id: 'number', int: 'number', float: 'number', price: 'number', bool: 'boolean', tags: 'string[]', ref: 'number' }[f.type] || (f.type === 'enum' ? (f.values || []).map(function (v) { return JSON.stringify(v); }).join(' | ') || 'string' : 'string');
  return base + (f.nullable ? ' | null' : '');
}
function toTypeScript(schema) {
  return schema.resources.map(function (r) {
    return 'export interface ' + pascal(r.name) + ' {\n' + r.fields.map(function (f) { return '  ' + f.name + (f.required || f.type === 'id' ? '' : '?') + ': ' + tsType(f) + ';' + (f.type === 'ref' ? ' // -> ' + pascal(f.ref) + '.id' : ''); }).join('\n') + '\n}';
  }).join('\n\n') + '\n\nexport interface Page<T> {\n  data: T[];\n  meta: { total: number; page: number; limit: number; pages: number };\n}\n';
}
function jsonSchemaOf(r) {
  var prop = function (f) { return ({ id: { type: 'integer' }, int: { type: 'integer', minimum: f.min, maximum: f.max }, float: { type: 'number' }, price: { type: 'number', minimum: 0 }, bool: { type: 'boolean' }, enum: { type: 'string', enum: f.values }, tags: { type: 'array', items: { type: 'string' } }, ref: { type: 'integer', description: f.ref + '.id' }, email: { type: 'string', format: 'email' }, url: { type: 'string', format: 'uri' }, imageUrl: { type: 'string', format: 'uri' }, date: { type: 'string', format: 'date' }, datetime: { type: 'string', format: 'date-time' }, uuid: { type: 'string', format: 'uuid' } })[f.type] || { type: 'string' }; };
  var props = {};
  r.fields.forEach(function (f) { props[f.name] = f.nullable ? { anyOf: [prop(f), { type: 'null' }] } : prop(f); });
  return { type: 'object', properties: props, required: r.fields.filter(function (f) { return f.required || f.type === 'id'; }).map(function (f) { return f.name; }) };
}
function toJsonSchema(schema) { var o = {}; schema.resources.forEach(function (r) { o[pascal(r.name)] = jsonSchemaOf(r); }); return o; }
function toOpenAPI(schema, title, description) {
  var paths = {}, schemas = toJsonSchema(schema);
  schema.resources.forEach(function (r) {
    var ref = { $ref: '#/components/schemas/' + pascal(r.name) };
    paths['/' + r.name] = {
      get: { summary: 'List ' + r.name, parameters: ['page', 'limit', 'sort', 'q', 'expand', 'fields'].map(function (n) { return { name: n, in: 'query', schema: { type: n === 'page' || n === 'limit' ? 'integer' : 'string' } }; }), responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: ref }, meta: { type: 'object' } } } } } } } },
      post: { summary: 'Create a ' + pascal(r.name).toLowerCase(), requestBody: { required: true, content: { 'application/json': { schema: ref } } }, responses: { 201: { description: 'Created', content: { 'application/json': { schema: ref } } }, 422: { description: 'Validation failed' } } },
    };
    paths['/' + r.name + '/{id}'] = {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      get: { responses: { 200: { description: 'OK', content: { 'application/json': { schema: ref } } }, 404: { description: 'Not found' } } },
      put: { requestBody: { content: { 'application/json': { schema: ref } } }, responses: { 200: { description: 'Replaced' }, 404: { description: 'Not found' }, 422: { description: 'Validation failed' } } },
      patch: { requestBody: { content: { 'application/json': { schema: ref } } }, responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' }, 422: { description: 'Validation failed' } } },
      delete: { responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } } },
    };
  });
  return { openapi: '3.0.3', info: { title: title || 'Mock API', version: '1.0.0', description: description || '' }, paths: paths, components: { schemas: schemas } };
}
function sqlType(f) { return { id: 'INTEGER PRIMARY KEY', int: 'INTEGER', ref: 'INTEGER', float: 'REAL', price: 'NUMERIC(10,2)', bool: 'BOOLEAN', date: 'DATE', datetime: 'TIMESTAMP', tags: 'TEXT', uuid: 'UUID', paragraph: 'TEXT' }[f.type] || 'VARCHAR(255)'; }
function sqlValue(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (Array.isArray(v)) v = JSON.stringify(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function toSQL(schema, db, maxRows) {
  var out = [];
  topoOrder(schema).forEach(function (r) {
    var cols = r.fields.map(function (f) {
      var c = '  ' + f.name + ' ' + sqlType(f);
      if (f.type !== 'id' && (f.required) && !f.nullable) c += ' NOT NULL';
      if (f.unique && f.type !== 'id') c += ' UNIQUE';
      if (f.type === 'enum' && f.values && f.values.length) c += ' CHECK (' + f.name + ' IN (' + f.values.map(sqlValue).join(', ') + '))';
      if (f.type === 'ref') c += ' REFERENCES ' + f.ref + '(id)';
      return c;
    });
    out.push('CREATE TABLE ' + r.name + ' (\n' + cols.join(',\n') + '\n);');
  });
  if (db) topoOrder(schema).forEach(function (r) {
    var rows = (db[r.name] || []).slice(0, maxRows || 1000);
    if (!rows.length) return;
    var names = r.fields.map(function (f) { return f.name; });
    out.push('INSERT INTO ' + r.name + ' (' + names.join(', ') + ') VALUES\n' + rows.map(function (row) { return '  (' + names.map(function (n) { return sqlValue(row[n]); }).join(', ') + ')'; }).join(',\n') + ';');
  });
  return out.join('\n\n') + '\n';
}
/* Mock Service Worker v2 handlers backed by an in-memory copy of db.json. */
function toMSW(schema) {
  var lines = ["import { http, HttpResponse } from 'msw';", "import seed from './db.json';", '', 'const db = structuredClone(seed);', 'const nextId = (rows) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;', '', 'export const handlers = ['];
  schema.resources.forEach(function (r) {
    var n = r.name;
    lines.push(
      "  http.get('/" + n + "', ({ request }) => {",
      '    const url = new URL(request.url);',
      "    const limit = Number(url.searchParams.get('limit') ?? 10), page = Number(url.searchParams.get('page') ?? 1);",
      '    const rows = db.' + n + ';',
      '    return HttpResponse.json({ data: rows.slice((page - 1) * limit, page * limit), meta: { total: rows.length, page, limit } });',
      '  }),',
      "  http.get('/" + n + "/:id', ({ params }) => {",
      '    const row = db.' + n + '.find((r) => r.id === Number(params.id));',
      "    return row ? HttpResponse.json(row) : HttpResponse.json({ error: 'Not found' }, { status: 404 });",
      '  }),',
      "  http.post('/" + n + "', async ({ request }) => {",
      '    const row = { id: nextId(db.' + n + '), ...(await request.json()) };',
      '    db.' + n + '.push(row);',
      '    return HttpResponse.json(row, { status: 201 });',
      '  }),',
      "  http.delete('/" + n + "/:id', ({ params }) => {",
      '    db.' + n + ' = db.' + n + '.filter((r) => r.id !== Number(params.id));',
      '    return new HttpResponse(null, { status: 204 });',
      '  }),');
  });
  lines.push('];', '');
  return lines.join('\n');
}
function shq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
function curlFor(base, method, path, body) {
  var hasBody = ['POST', 'PUT', 'PATCH'].indexOf(method) >= 0 && body && body.trim();
  return 'curl' + (method === 'GET' ? '' : ' -X ' + method) + ' ' + shq(base.replace(/\/$/, '') + path) + (hasBody ? " \\\n  -H 'Content-Type: application/json' \\\n  -d " + shq(body.trim()) : '');
}
function fetchFor(base, method, path, body) {
  var hasBody = ['POST', 'PUT', 'PATCH'].indexOf(method) >= 0 && body && body.trim();
  var opts = method === 'GET' && !hasBody ? '' : ', {\n  method: ' + JSON.stringify(method) + (hasBody ? ",\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify(" + body.trim() + ')' : '') + '\n}';
  return 'const res = await fetch(' + JSON.stringify(base.replace(/\/$/, '') + path) + opts + ');\nconst data = ' + (method === 'DELETE' ? 'res.status' : 'await res.json()') + ';';
}
