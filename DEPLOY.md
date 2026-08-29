# Deploying QualiLens.org to Cloudflare Pages

## Option A: Git integration (recommended)

This connects a GitHub repo to Cloudflare Pages so every push deploys automatically.

### 1. Push the Website folder to a GitHub repo

Either create a dedicated repo (e.g., `qualilens-site`) or add the `Website/` folder to the existing `iconerr/qualilens` repo.

### 2. Connect in Cloudflare

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com).
2. Go to **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Select the repository.
4. Configure the build:

| Setting              | Value                                     |
|----------------------|-------------------------------------------|
| **Framework preset** | Astro                                     |
| **Build command**    | `npm run build`                           |
| **Build output**     | `dist`                                    |
| **Root directory**   | `Website` (only if the site is a subfolder in a larger repo) |
| **Node version**     | 22 (set via environment variable `NODE_VERSION = 22`) |

5. Click **Save and Deploy**.

### 3. Add the custom domain

1. In the Pages project, go to **Custom domains**.
2. Add `qualilens.org`.
3. Since the domain is already on Cloudflare, DNS records are added automatically.
4. Add `www.qualilens.org` and set it to redirect to the apex domain.

## Option B: Direct upload

If you prefer not to connect a repo:

```bash
cd Website
npm install
npm run build
npx wrangler pages deploy dist --project-name=qualilens-site
```

You will need `wrangler` authenticated with your Cloudflare account:

```bash
npx wrangler login
```

Then add the custom domain in the Cloudflare dashboard as in step 3 above.

## Local preview

```bash
cd Website
npm install      # first time only
npm run dev      # dev server at localhost:4321
npm run build    # production build into dist/
npm run preview  # preview the production build
```

## Notes

- The site is static HTML with no server-side rendering. Cloudflare Pages serves it from its global CDN.
- The `site` field in `astro.config.mjs` is set to `https://qualilens.org` for canonical URLs and sitemap generation.
- The `.gitignore` already excludes `dist/`, `node_modules/`, and `.astro/`.
