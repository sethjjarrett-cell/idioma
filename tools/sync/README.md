# Syncing between a phone and a laptop

One JSON blob, one secret code, no account. The app keeps working exactly as
it does now if you never set this up.

## What you run, once

You need a Cloudflare account. The free tier is far more than this uses: a
sync is one read and one write, and the allowance is 100,000 reads and 1,000
writes a day.

```bash
npm install -g wrangler
wrangler login

cd tools/sync
wrangler kv namespace create IDIOMA        # prints an id
# paste that id into wrangler.toml
wrangler deploy                            # prints your worker's URL
```

That is the whole server. Then in the app, under the `⋯` menu:

1. Paste the worker URL into **Sync URL**.
2. Press **New code**. Write the code down.
3. On the other device, paste the same URL and type the same code.

Both devices now sync on load, after every round, and whenever you press
**Sync now**.

## What the code is

Twenty-two characters from `crypto.getRandomValues`, about 110 bits. There is
no account behind it: the code *is* the authorisation, and it names an
unguessable box. Two consequences worth being clear about:

- **Anyone you give the code to has your progress.** Treat it like a
  password, because that is what it is.
- The endpoint allows any origin, which is safe for the same reason it has no
  login: knowing the code is the point. If you would rather lock it to your
  own site, change `access-control-allow-origin` in `worker.js` to
  `https://yourname.github.io` and redeploy.

There is nothing personal in the blob — no name, no email, just which Spanish
words you know.

## How two devices agree

Merging happens on the client, in `sync.js`, and is tested in
`tests/test-sync.mjs`. The rules:

| | |
|---|---|
| A word's progress | whichever device **touched it last** wins |
| Words you added | union; on the same id, the younger save wins |
| Settings | the younger save wins |
| Rounds done | the higher of the two, never the sum |

"Touched last" rather than "further along" is deliberate. Taking the higher
level would quietly undo every wrong answer, because a level that went down
went down for a reason. And a disable is a touch too, which is why a progress
row carries `changedAt` as well as `lastSeen` — without it, disabling a word
on the laptop would be switched back on by the phone.

Merging is safe to repeat: merging the same pair twice, or a state with
itself, changes nothing. That is what lets it run on every page load without
keeping any history.

## When it goes wrong

Every failure is survivable and none of them blocks a card. Offline, endpoint
down, wrong code, private browsing with no storage: the app falls back to
exactly its behaviour with no sync configured, and the menu says what
happened. A clash with another device mid-write returns the newer version so
the client can merge it and retry, once.

## Other places it would run

The worker is forty lines and the contract is two routes, `GET /v1/{code}`
and `PUT /v1/{code}`. Deno Deploy, Val Town, a Raspberry Pi with a file per
code — anything that can hold a string against a key. Cloudflare is here
because the free tier is generous and the deploy is one command.
