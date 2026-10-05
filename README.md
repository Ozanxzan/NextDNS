# Nazuaf NextDNS Control Center

A modern/futuristic self-hosted dashboard for managing a NextDNS profile through the official NextDNS API.

## Features

- Profile selector
- Overview dashboard
- 24h and 7d analytics
- Status, domains, reasons, devices, protocols, query types, IP versions, DNSSEC and encryption analytics
- Live DNS logs through NextDNS SSE streaming
- Log search/filter
- Device overview
- Allowlist / denylist add and delete
- Security settings
- Privacy settings
- Parental control settings
- Advanced profile JSON editor
- Dark/light mode
- Responsive mobile layout
- Cloudflare Pages Function proxy so the NextDNS API key never reaches the browser

## Deploy on Cloudflare Pages

This project is intentionally dependency-free.

1. Create a new GitHub repository and upload all files.
2. In Cloudflare Pages, connect the repository.
3. Framework preset: **None**
4. Build command: **leave empty**
5. Build output directory: **/** (the repository root)
6. Deploy.
7. In Cloudflare Pages → Settings → Environment variables, add a **Secret**:
   - Name: `NEXTDNS_API_KEY`
   - Value: generate a fresh key from the NextDNS account page.
8. Redeploy.

The `functions/api/nextdns.js` file is automatically deployed as a Pages Function.

## Security

Never put the NextDNS API key in `app.js`, HTML, GitHub, or any client-side environment variable.

The browser calls `/api/nextdns`, and the Pages Function adds `X-Api-Key` server-side.

If an API key has ever been exposed in a screenshot, repository, browser source, or chat, rotate it and use a fresh secret.

## Notes

The official NextDNS API is documented as beta and may change. This dashboard deliberately keeps the API proxy small so endpoint changes can be adapted in one place.

The dashboard uses the official API endpoints for profiles, analytics and logs. Logs support the NextDNS `/logs/stream` SSE endpoint.

## Local development

For Pages Functions, use Wrangler:

```bash
npx wrangler pages dev .
```

Then set a local secret in `.dev.vars`:

```text
NEXTDNS_API_KEY=replace_with_your_key
```

Do not commit `.dev.vars`.

## License

MIT
