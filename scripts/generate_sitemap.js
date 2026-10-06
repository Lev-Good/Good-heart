import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { projects } from '../src/data/projects.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sitemapPath = path.join(__dirname, '..', 'sitemap.xml');

const urls = [
  { loc: 'https://digital.levtov.uk/', changefreq: 'weekly', priority: '1.0' },
  { loc: 'https://digital.levtov.uk/work-clock.html', changefreq: 'monthly', priority: '0.9' },
  { loc: 'https://digital.levtov.uk/taharah/', changefreq: 'weekly', priority: '0.9' },
  { loc: 'https://digital.levtov.uk/privacy.html', changefreq: 'yearly', priority: '0.4' },
  { loc: 'https://digital.levtov.uk/work-clock-privacy.html', changefreq: 'yearly', priority: '0.3' },
  { loc: 'https://digital.levtov.uk/work-clock-terms.html', changefreq: 'yearly', priority: '0.3' },
  { loc: 'https://digital.levtov.uk/taharah/privacy.html', changefreq: 'yearly', priority: '0.3' },
  { loc: 'https://digital.levtov.uk/taharah/terms.html', changefreq: 'yearly', priority: '0.3' }
];

// Add all 33 individual project landing pages
projects.forEach(p => {
  urls.push({
    loc: `https://digital.levtov.uk/p/${p.id}.html`,
    changefreq: 'weekly',
    priority: '0.8'
  });
});

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
console.log(`Updated sitemap.xml with ${urls.length} URLs!`);
