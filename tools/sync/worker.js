/* The whole server. One key, one value, a revision number to spot a clash.
 *
 * There is no account, no table and no user id, because the sync code is all
 * three: 110 bits of randomness, generated on the first device, and holding it
 * is the entirety of the authorisation. That is why any origin is allowed —
 * knowing the code is the point, and guessing one is not feasible — and why
 * the code must be treated as a secret, since anyone holding it has the
 * progress it names.
 *
 * Deploy: see README.md. It needs one KV namespace and nothing else.
 */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS },
});

/* A progress blob for a few hundred words is a few tens of kilobytes. A
 * megabyte is room to grow into and small enough that nobody can use this as
 * free file hosting. */
const MAX_BYTES = 1024 * 1024;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // The code has to look like a code. Anything else is not a near miss, it
    // is somebody poking at the endpoint.
    const match = new URL(request.url).pathname.match(/^\/v1\/([0-9a-z]{20,64})$/);
    if (!match) return json({ error: 'not found' }, 404);
    const key = `state:${match[1]}`;

    if (request.method === 'GET') {
      const stored = await env.IDIOMA.get(key, 'json');
      // A code nobody has written to yet is not an error; it is a first sync.
      return json(stored || { rev: 0, updatedAt: null, state: null });
    }

    if (request.method === 'PUT') {
      const raw = await request.text();
      if (raw.length > MAX_BYTES) return json({ error: 'too large' }, 413);

      let body;
      try { body = JSON.parse(raw); } catch { return json({ error: 'not json' }, 400); }
      if (!body || typeof body.state !== 'object' || body.state === null) {
        return json({ error: 'no state' }, 400);
      }

      const stored = await env.IDIOMA.get(key, 'json');
      const rev = stored ? stored.rev : 0;
      /* Someone else wrote since the client last read. Hand back the newer
       * version rather than a bare refusal, so the client can merge it and
       * retry without a second round trip. */
      if (typeof body.rev === 'number' && body.rev !== rev) {
        return json({ error: 'conflict', rev, state: stored ? stored.state : null }, 409);
      }

      const next = { rev: rev + 1, updatedAt: new Date().toISOString(), state: body.state };
      await env.IDIOMA.put(key, JSON.stringify(next));
      return json({ rev: next.rev, updatedAt: next.updatedAt });
    }

    return json({ error: 'method not allowed' }, 405);
  },
};
