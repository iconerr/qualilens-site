import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

function stripHtml(html) {
  html = html.replace(/<(script|style|nav|footer)[^>]*>[\s\S]*?<\/\1>/gi, '');
  html = html.replace(/<[^>]+>/g, ' ');
  html = html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  return html.replace(/\s+/g, ' ').trim();
}

function stripMarkdown(md) {
  return md
    .replace(/^---\n[\s\S]*?\n---\n?/, '')   // frontmatter
    .replace(/^#{1,6}\s+/gm, '')              // headings
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // links
    .replace(/[*_`~]/g, '')                   // emphasis / code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')     // images
    .replace(/^\s*[-*+]\s+/gm, '')            // list markers
    .replace(/^\s*\d+\.\s+/gm, '')            // ordered list markers
    .replace(/^\s*>\s+/gm, '')                // blockquotes
    .replace(/\|/g, ' ')                      // table pipes
    .replace(/\s+/g, ' ')
    .trim();
}

// Build mode: collect from rendered HTML in dist
async function collectBuiltPages(dir, base = '') {
  const entries = [];
  let items;
  try {
    items = await readdir(dir, { withFileTypes: true });
  } catch {
    return entries;
  }
  for (const item of items) {
    const fullPath = join(dir, item.name);
    if (item.isDirectory() && item.name !== '_astro' && item.name !== 'pagefind') {
      entries.push(...await collectBuiltPages(fullPath, base + item.name + '/'));
    } else if (item.name === 'index.html') {
      const html = await readFile(fullPath, 'utf-8');
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      const title = titleMatch ? titleMatch[1].replace(/\s*[—|]\s*QualiLens.*$/, '').trim() : '';
      const body = mainMatch ? stripHtml(mainMatch[1]) : '';
      const content = body.slice(0, 10000);
      const url = '/' + base.replace(/\/$/, '') || '/';
      entries.push({ title, url, content });
    }
  }
  return entries;
}

// Dev mode: collect from source .md and .astro files
async function collectSourcePages(pagesDir) {
  const entries = [];

  async function walk(dir, base = '') {
    let items;
    try {
      items = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      const fullPath = join(dir, item.name);
      if (item.isDirectory()) {
        await walk(fullPath, base + item.name + '/');
      } else if (item.name.endsWith('.md')) {
        const raw = await readFile(fullPath, 'utf-8');
        const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
        let title = '';
        if (fmMatch) {
          const titleMatch = fmMatch[1].match(/title:\s*["']?(.+?)["']?\s*$/m);
          if (titleMatch) title = titleMatch[1].replace(/["']/g, '');
        }
        const content = stripMarkdown(raw).slice(0, 10000);
        const slug = item.name.replace(/\.md$/, '');
        const url = '/' + base + (slug === 'index' ? '' : slug);
        entries.push({ title, url: url.replace(/\/$/, '') || '/', content });
      } else if (item.name.endsWith('.astro')) {
        const raw = await readFile(fullPath, 'utf-8');
        // Extract title from <BaseLayout title="..."> or <h1>
        let title = '';
        const layoutTitle = raw.match(/title=["']([^"']+?)(?:\s*[—|]\s*QualiLens[^"']*)?["']/);
        if (layoutTitle) {
          title = layoutTitle[1].replace(/\s*[—|]\s*QualiLens.*$/, '').trim();
        } else {
          const h1Match = raw.match(/<h1[^>]*>([^<]+)<\/h1>/i);
          if (h1Match) title = h1Match[1].trim();
        }
        // Pull text from the entire file: string literals in script + template HTML.
        // Extract quoted strings from script block (catches FAQ items, etc.)
        const scriptMatch = raw.match(/^---\n([\s\S]*?)\n---/);
        const strings = [];
        if (scriptMatch) {
          const re = /["']([^"']{4,})["']/g;
          let m;
          while ((m = re.exec(scriptMatch[1])) !== null) {
            // Skip import paths and component refs
            if (m[1].startsWith('../') || m[1].startsWith('./') || m[1].endsWith('.astro')) continue;
            strings.push(stripHtml(m[1]));
          }
        }
        // Also get text from the template portion
        const template = raw.replace(/^---[\s\S]*?---\s*/, '');
        strings.push(stripHtml(template));
        const content = strings.join(' ').replace(/\s+/g, ' ').trim().slice(0, 10000);
        const slug = item.name.replace(/\.astro$/, '');
        const url = '/' + base + (slug === 'index' ? '' : slug);
        entries.push({ title, url: url.replace(/\/$/, '') || '/', content });
      }
    }
  }

  await walk(pagesDir);
  return entries;
}

export default function searchIndex() {
  return {
    name: 'search-index',
    hooks: {
      'astro:config:setup': ({ config, updateConfig }) => {
        const srcDir = typeof config.srcDir === 'string'
          ? config.srcDir
          : config.srcDir instanceof URL
            ? fileURLToPath(config.srcDir)
            : 'src';
        const pagesDir = join(srcDir, 'pages');

        updateConfig({
          vite: {
            plugins: [{
              name: 'search-index-dev',
              configureServer(server) {
                server.middlewares.use(async (req, res, next) => {
                  if (req.url === '/search-index.json') {
                    try {
                      const pages = await collectSourcePages(pagesDir);
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify(pages));
                    } catch (e) {
                      res.statusCode = 500;
                      res.end(JSON.stringify({ error: e.message }));
                    }
                    return;
                  }
                  next();
                });
              }
            }]
          }
        });
      },
      'astro:build:done': async ({ dir }) => {
        const outDir = dir.pathname;
        const pages = await collectBuiltPages(outDir);
        await writeFile(join(outDir, 'search-index.json'), JSON.stringify(pages));
        console.log(`Search index: ${pages.length} pages indexed`);
      }
    }
  };
}
