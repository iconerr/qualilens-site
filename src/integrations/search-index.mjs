import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

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

async function collectPages(dir, base = '') {
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
      entries.push(...await collectPages(fullPath, base + item.name + '/'));
    } else if (item.name === 'index.html') {
      const html = await readFile(fullPath, 'utf-8');
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      const title = titleMatch ? titleMatch[1].replace(/\s*[—|]\s*QualiLens.*$/, '').trim() : '';
      const body = mainMatch ? stripHtml(mainMatch[1]) : '';
      const content = body.slice(0, 2000);
      const url = '/' + base.replace(/\/$/, '') || '/';
      entries.push({ title, url, content });
    }
  }
  return entries;
}

export default function searchIndex() {
  return {
    name: 'search-index',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const outDir = dir.pathname;
        const pages = await collectPages(outDir);
        await writeFile(join(outDir, 'search-index.json'), JSON.stringify(pages));
        console.log(`Search index: ${pages.length} pages indexed`);
      }
    }
  };
}
