# Getting a `GFW_API_KEY`

The EUDR panel on `/sell` needs a Global Forest Watch Data API key for the
per-plot zonal statistics. The map layers do **not** need one — those tiles are
public — so without a key the map still draws and only the numbers are missing.

There is no "create API key" button in the web UI. The key is issued by the Data
API itself, over three HTTP requests. This file is written down because the
official guide moved when GFW rebranded to Global Nature Watch and the current
page does not spell out the token step.

Everything below was checked against the live OpenAPI spec at
<https://data-api.globalforestwatch.org/openapi.json> (GFW DATA API 0.3.0) on
18 September 2026.

---

## Step 1 — create an account

```bash
curl -X POST https://data-api.globalforestwatch.org/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{"name": "Your Name", "email": "you@example.com"}'
```

Both fields are required. Identity is handled by the RW API (Resource Watch),
which GFW shares an account system with — so **if you already have a Global
Forest Watch or Resource Watch login, skip this step and use that password.**

You will get a confirmation email. Open it and set a password. The account is
not usable until you do.

## Step 2 — exchange the password for a bearer token

Note the content type: this endpoint takes **form encoding**, not JSON. Sending
JSON here is the step that most often fails silently with a 422.

```bash
curl -X POST https://data-api.globalforestwatch.org/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=you@example.com" \
  -d "password=YOUR_PASSWORD"
```

The response carries `access_token`. It is short-lived and is only used for the
next step — it is not the key the app wants.

## Step 3 — issue the API key

```bash
curl -X POST https://data-api.globalforestwatch.org/auth/apikey \
  -H "Authorization: Bearer ACCESS_TOKEN_FROM_STEP_2" \
  -H "Content-Type: application/json" \
  -d '{
        "alias": "plotproof",
        "organization": "PlotProof",
        "email": "you@example.com",
        "domains": []
      }'
```

`alias`, `organization` and `email` are required. The response contains
`data.api_key` — **that** is the value for `GFW_API_KEY`.

### About `domains` — read this before you set it

`domains` is an allowlist checked against the `Origin` header of each request.
It is the field that causes the most trouble, and for this app the right answer
is the empty list:

- PlotProof calls the Data API **from the server**, in
  `app/api/eudr/assess/route.ts`. Server-to-server requests send no `Origin`
  header, so a domain allowlist has nothing to match and will reject the call.
- An empty list is explicitly allowed. The documented cost is that the key is
  placed in the lowest rate-limiting tier, which is ample here: the app makes
  three queries per plot check, not per page view.
- If you later add domains, note the spec's own warnings: no port numbers,
  `example.com` and `www.example.com` count as different domains, and a wildcard
  such as `*.example.com` matches subdomains **only**, not the root.

### Expiry

Default keys are valid for **one year**. Only admin accounts may set
`never_expires`. Put a reminder somewhere — when it lapses the panel will say
the check cannot run, which is correct behaviour but an unhelpful surprise.

## Step 4 — install it

```
# .env.local
GFW_API_KEY=<data.api_key from step 3>
```

Restart the dev server. The app sends it as the `x-api-key` header; see
`app/api/eudr/assess/route.ts`.

## Checking it worked

```bash
curl "https://data-api.globalforestwatch.org/auth/apikey/YOUR_KEY/validate" \
  -H "x-api-key: YOUR_KEY"
```

Or list the keys on your account:

```bash
curl https://data-api.globalforestwatch.org/auth/apikeys \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

A real end-to-end check is better: open `/sell`, choose rubber, coffee or cocoa
with an EU buyer, attach an attested plot, and press the check. A working key
returns areas in hectares. A missing or rejected key makes the panel say the
check could not run — it never reports zeros, because "no data" and "no
deforestation" are not the same answer.

## Other endpoints on the account

- `GET /auth/apikey/{api_key}` — details for one key
- `DELETE /auth/apikey/{api_key}` — revoke one

## Why this could not be done for you

Step 1 sends a confirmation email to an address, and step 2 needs the password
set from that email. Both belong to the account holder.
