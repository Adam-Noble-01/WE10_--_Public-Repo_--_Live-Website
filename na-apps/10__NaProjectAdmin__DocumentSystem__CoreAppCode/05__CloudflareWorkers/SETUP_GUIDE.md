# Cloudflare Workers Setup Guide

## Noble Architecture - Project Admin API

---

## Quick Start

### Step 1: Install Wrangler CLI

Open PowerShell and run:

```powershell
npm install -g wrangler
```

### Step 2: Login to Cloudflare

```powershell
wrangler login
```

This will open your browser - sign in with your Cloudflare account.

### Step 3: Deploy the Worker

Navigate to this folder and run:

```powershell
cd D:\WE10_--_Public-Repo_--_Live-Website\na-apps\10__NaProjectAdmin__DocumentSystem__CoreAppCode\05__CloudflareWorkers
wrangler deploy
```

Or simply double-click `deploy.bat`.

### Step 4: Note Your Worker URL

After deployment, Wrangler will display your worker URL:

```
Published na-projectadmin-api (X.XX sec)
  https://na-projectadmin-api.<your-subdomain>.workers.dev
```

**Copy this URL** - you'll need to update the app configuration with it.

---

## File Structure

The Cloudflare Workers code follows Noble Architecture naming conventions:

```
05__CloudflareWorkers/
├── src/
│   ├── CloudflareWorker__Main__.js       # Main entry point & router
│   └── handlers/
│       ├── CloudflareHandler__Auth__.js       # PIN authentication
│       ├── CloudflareHandler__R2__.js         # R2 bucket operations
│       └── CloudflareHandler__Signature__.js  # Signature storage/retrieval
├── wrangler.toml                          # Wrangler configuration
├── package.json                           # Node.js package config
├── deploy.bat                             # Windows deployment script
└── SETUP_GUIDE.md                         # This file
```

---

## Configuration

### Update App Config with Worker URL

After deployment, update this file:
`03__Src__AppModules/02__AppData/AppConfiguration__MainAppSettings__.json`

Change the `workerBaseUrl` to match your deployed worker URL:

```json
"CloudflareConfig": {
    "workerBaseUrl": "https://na-projectadmin-api.<your-subdomain>.workers.dev/"
}
```

---

## Testing the Worker

### Health Check

```powershell
curl https://na-projectadmin-api.<your-subdomain>.workers.dev/health
```

Expected response:
```json
{"status":"ok","service":"na-projectadmin-api"}
```

### Test IP Endpoint

```powershell
curl https://na-projectadmin-api.<your-subdomain>.workers.dev/ip
```

---

## R2 Bucket Setup

Your R2 bucket `noble-architecture-cdn` should already exist. The worker will use it to:

1. **Read** project configurations
2. **Store** signature records
3. **Log** authentication attempts

### Bucket Structure

The worker expects this structure in R2:

```
NaProjectPortal/
├── 26-Projects/
│   └── AA00__ExampleProject/
│       └── 10__ProjectAdmin__AppContent/
│           ├── ProjectAdmin__ProjectConfig__.json
│           ├── ProjectAdmin__Quotation__.json
│           └── ProjectAdmin__SpecialTerms__.json
├── Signatures/
│   └── 26/
│       └── AA00/
│           └── SIG__31-Jan-2026__QUO__ABC123.json
└── Logs/
    └── Auth/
        └── 2026-01-31/
            └── AA00_1706745600000.json
```

---

## API Endpoints

| Endpoint | Method | Handler | Purpose |
|----------|--------|---------|---------|
| `/health` | GET | Main | Health check |
| `/ip` | GET | Main | Get client IP |
| `/projectadmin/auth` | POST | Auth | Validate project PIN |
| `/projectadmin/signature` | POST | Signature | Store signature record |
| `/projectadmin/signature` | GET | Signature | Retrieve signatures |
| `/projectadmin/signature` | DELETE | Signature | Purge signatures (admin) |
| `/r2/read` | POST | R2 | Read file from R2 |
| `/r2/write` | POST | R2 | Write file to R2 |
| `/r2/list` | POST | R2 | List files in R2 |
| `/r2/delete` | POST | R2 | Delete file from R2 |

---

## Setting Up a Custom Domain (Optional)

To use `api.noble-architecture.com` instead of the workers.dev URL:

1. Go to Cloudflare Dashboard → Workers & Pages
2. Click on `na-projectadmin-api`
3. Go to "Settings" → "Triggers"
4. Click "Add Custom Domain"
5. Enter: `api.noble-architecture.com`
6. Cloudflare will configure the DNS automatically

Then update the config:
```json
"workerBaseUrl": "https://api.noble-architecture.com/"
```

---

## Troubleshooting

### "Bucket not found" Error

Ensure your R2 bucket `noble-architecture-cdn` exists:
1. Go to Cloudflare Dashboard → R2
2. Check the bucket exists and matches the name in `wrangler.toml`

### CORS Errors

The worker is configured to allow requests from:
- `https://www.noble-architecture.com` (production)
- `localhost` and `127.0.0.1` (development)
- `null` origin (file:// protocol)

For other origins, modify `CORS_ORIGIN` in `wrangler.toml`.

### Authentication Failures

Check that:
1. Project config JSON exists in R2 at the correct path
2. PIN is correctly set in `ProjectAdmin__ProjectConfig__.json`

### "Failed to fetch" Error

If the Editor Tools show "Failed to fetch":
1. Ensure the worker is deployed: `wrangler deploy`
2. Check the browser console (F12) for detailed errors
3. Try running from localhost instead of file://

---

## Local Development

Run the worker locally for testing:

```powershell
wrangler dev
```

This starts a local server (usually at `http://localhost:8787`).

**Note:** R2 access in local mode may require additional setup.

---

## Module Dependencies

The Worker modules follow this import structure:

```
CloudflareWorker__Main__.js
├── imports CloudflareHandler__Auth__.js
├── imports CloudflareHandler__R2__.js
└── imports CloudflareHandler__Signature__.js
```

The client-side app communicates with the Worker via HTTP:

```
CloudflareIntegration__ApiClient__.js
    └── HTTP requests → Worker endpoints
```

---

## Files Created

| File | Purpose | Git Status |
|------|---------|------------|
| `wrangler.toml` | Worker configuration | ✅ Committed |
| `package.json` | Node.js dependencies | ✅ Committed |
| `src/*.js` | Worker source code | ✅ Committed |
| `.gitignore` | Protects sensitive files | ✅ Committed |
| `.dev.vars` | Local dev secrets | ❌ Ignored |
| `CREDENTIALS_BACKUP.txt` | Your credentials backup | ❌ Ignored |

---

## Security Notes

1. **Never commit** your API token to Git
2. **Store credentials** in a password manager
3. The `.gitignore` file protects sensitive files from being uploaded
4. Authentication logs are stored in R2 for audit purposes
5. The DELETE endpoint for signatures is for admin use only

---

## Support

For issues with Cloudflare Workers:
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

---

*Created: 31-Jan-2026*
*Updated: 31-Jan-2026*
*Author: Noble Architecture*
