const SCHEMA = sanitizeSchema({ resources: [
  { name: 'Posts', fields: [{ name: 'authorId', type: 'ref', ref: 'users', required: true }, { name: 'title', type: 'title', required: true }, { name: 'status', type: 'enum', values: ['draft', 'published'], required: true }, { name: 'views', type: 'int', min: 0, max: 100 }, { name: 'tags', type: 'tags' }] },
  { name: 'users', fields: [{ name: 'name', type: 'fullName', required: true }, { name: 'email', type: 'email', unique: true }, { name: 'score', type: 'bogus' }] },
  { name: 'comments', fields: [{ name: 'postId', type: 'ref', ref: 'posts', required: true }, { name: 'body', type: 'sentence', required: true }, { name: 'ghostId', type: 'ref', ref: 'ghosts' }] },
] });
const fresh = () => ({ schema: SCHEMA, db: generateDb(SCHEMA, 42, 20) });
const req = (st, m, p, b, o) => handleRequest(st, m, p, b, o);

test('sanitizeSchema normalizes names, adds ids and drops broken refs', () => {
  assert.deepEq(SCHEMA.resources.map((r) => r.name), ['posts', 'users', 'comments']);
  assert.eq(SCHEMA.resources[0].fields[0].type, 'id');
  assert.eq(findRes(SCHEMA, 'users').fields.find((f) => f.name === 'score').type, 'sentence');
  assert.eq(findRes(SCHEMA, 'comments').fields.find((f) => f.name === 'ghostId').type, 'int');
  assert.deepEq(topoOrder(SCHEMA).map((r) => r.name), ['users', 'posts', 'comments']);
});

test('generateDb is deterministic, respects ranges and points refs at real rows', () => {
  const a = generateDb(SCHEMA, 7, 15), b = generateDb(SCHEMA, 7, 15);
  assert.eq(JSON.stringify(a), JSON.stringify(b));
  assert.ok(JSON.stringify(generateDb(SCHEMA, 8, 15)) !== JSON.stringify(a));
  assert.eq(a.posts.length, 15);
  assert.ok(a.posts.every((p) => p.views >= 0 && p.views <= 100 && ['draft', 'published'].includes(p.status)));
  assert.ok(a.posts.every((p) => a.users.some((u) => u.id === p.authorId)));
  assert.eq(new Set(a.users.map((u) => u.email)).size, 15, 'unique emails');
});

test('list endpoint filters, sorts, paginates, projects and expands', () => {
  const st = fresh();
  const [s1, r1] = req(st, 'GET', '/posts?status=published&sort=-views&limit=3&expand=author');
  assert.eq(s1, 200);
  assert.ok(r1.data.length <= 3 && r1.data.every((p) => p.status === 'published'));
  assert.ok(r1.data.every((p, i, a) => !i || a[i - 1].views >= p.views));
  assert.ok(r1.data[0].author && r1.data[0].author.id === r1.data[0].authorId);
  assert.eq(r1.meta.total, st.db.posts.filter((p) => p.status === 'published').length);
  const [, r2] = req(st, 'GET', '/posts?views_gte=50&fields=id,views&limit=100');
  assert.ok(r2.data.every((p) => p.views >= 50 && Object.keys(p).join() === 'id,views'));
  assert.eq(req(st, 'GET', '/posts?nope=1')[0], 400);
  assert.eq(req(st, 'GET', '/posts?page=2&limit=5')[1].data[0].id, 6);
});

test('item, nested and missing routes', () => {
  const st = fresh();
  assert.eq(req(st, 'GET', '/users/1')[1].id, 1);
  assert.eq(req(st, 'GET', '/users/999')[0], 404);
  assert.eq(req(st, 'GET', '/widgets')[0], 404);
  const [s, r] = req(st, 'GET', '/users/1/posts?limit=100');
  assert.eq(s, 200);
  assert.eq(r.meta.total, st.db.posts.filter((p) => p.authorId === 1).length);
  assert.ok(Array.isArray(req(st, 'GET', '/posts/1?expand=comments')[1].comments));
});

test('writes validate, create, update and delete', () => {
  const st = fresh();
  const [s1, r1] = req(st, 'POST', '/posts', '{"title": "", "status": "deleted", "extra": 1}');
  assert.eq(s1, 422);
  assert.deepEq(r1.details, ['authorId is required', 'title cannot be empty', 'status must be one of draft, published', 'unknown field "extra"']);
  assert.eq(req(st, 'POST', '/posts', '{bad')[0], 400);
  const [s2, r2] = req(st, 'POST', '/posts', '{"authorId": 1, "title": "Hi", "status": "draft"}');
  assert.eq(s2, 201); assert.eq(r2.id, 21);
  assert.eq(req(st, 'PATCH', '/posts/21', '{"views": 500}')[0], 422);
  assert.eq(req(st, 'PATCH', '/posts/21', '{"views": 5}')[1].views, 5);
  const email = st.db.users[1].email;
  assert.deepEq(req(st, 'PATCH', '/users/1', JSON.stringify({ email }))[1].details, ['email must be unique']);
  assert.eq(req(st, 'DELETE', '/posts/21')[0], 204);
  assert.eq(req(st, 'GET', '/posts/21')[0], 404);
  assert.eq(req(st, 'POST', '/users/1/posts', '{}')[0], 405);
});

test('route overrides match patterns, methods and rates', () => {
  assert.deepEq(matchRoute('/users/:id/posts', '/users/3/posts?x=1'), { id: '3' });
  assert.eq(matchRoute('/users/:id', '/users/3/posts'), null);
  assert.deepEq(matchRoute('/users/*', '/users/3/posts'), {});
  const st = fresh();
  const overrides = [{ method: 'GET', path: '/users/:id', status: 503, body: '' }, { method: '*', path: '/posts', status: 429, body: '{"error":"slow down"}', rate: 0.5 }];
  const [s, b] = req(st, 'GET', '/users/2', '', { overrides });
  assert.eq(s, 503); assert.eq(b.error, 'Service Unavailable');
  assert.eq(req(st, 'GET', '/users', '', { overrides })[0], 200);
  assert.eq(req(st, 'POST', '/posts', '{}', { overrides, random: () => 0.1 })[1].error, 'slow down');
  assert.eq(req(st, 'GET', '/posts', '', { overrides, random: () => 0.9 })[0], 200);
  assert.eq(req(st, 'GET', '/users/2', '', { overrides: [Object.assign({}, overrides[0], { enabled: false })] })[0], 200);
});

test('TypeScript, JSON Schema and OpenAPI exports', () => {
  const ts = toTypeScript(SCHEMA);
  assert.ok(ts.includes('export interface Post {\n  id: number;\n  authorId: number; // -> User.id'));
  assert.ok(ts.includes('status: "draft" | "published";'));
  assert.ok(ts.includes('views?: number;'));
  assert.eq(pascal('categories'), 'Category');
  const js = toJsonSchema(SCHEMA).User;
  assert.deepEq(js.required, ['id', 'name']);
  assert.eq(js.properties.email.format, 'email');
  const api = toOpenAPI(SCHEMA, 'Blog');
  assert.eq(api.openapi, '3.0.3');
  assert.ok(api.paths['/posts/{id}'].patch && api.paths['/comments'].post);
});

test('SQL export orders tables by dependency and escapes values', () => {
  const sql = toSQL(SCHEMA, { users: [{ id: 1, name: "O'Brien", email: null, score: 'x' }], posts: [], comments: [] });
  assert.ok(sql.indexOf('CREATE TABLE users') < sql.indexOf('CREATE TABLE posts'));
  assert.ok(sql.includes('  authorId INTEGER NOT NULL REFERENCES users(id)'));
  assert.ok(sql.includes("CHECK (status IN ('draft', 'published'))"));
  assert.ok(sql.includes("(1, 'O''Brien', NULL, 'x')"));
  assert.eq(sqlValue(['a']), `'["a"]'`); assert.eq(sqlValue(true), 'TRUE');
});

test('code snippets for curl, fetch and MSW', () => {
  assert.eq(curlFor('https://api.test/', 'GET', '/posts?limit=2'), "curl 'https://api.test/posts?limit=2'");
  assert.eq(curlFor('https://api.test', 'POST', '/posts', '{"a": "it\'s"}'), "curl -X POST 'https://api.test/posts' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"a\": \"it'\\''s\"}'");
  assert.ok(fetchFor('https://api.test', 'DELETE', '/posts/1').includes('method: "DELETE"'));
  const msw = toMSW(SCHEMA);
  assert.ok(msw.startsWith("import { http, HttpResponse } from 'msw';"));
  assert.ok(msw.includes("http.get('/comments/:id'"));
});
