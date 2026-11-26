import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { projects, categories } from '../src/data/projects.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetFiles = [
  path.join(__dirname, '..', 'index.html'),
  path.join(__dirname, '..', 'clean.html'),
  path.join(__dirname, '..', 'original.html')
];

const catLabels = Object.fromEntries(categories.map(c => [c.id, c.label]));

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const staticCards = projects.map(p => {
  const priceBadgeHtml = p.price ? `<span class="card-price-badge"><i class="fa-solid fa-tag"></i> ${escapeHtml(p.price)}</span>` : '';

  return `        <article class="project-card accent-${p.colorClass || 'bl'}" data-id="${p.id}" tabindex="0" role="button" aria-haspopup="dialog">
          <div class="card-head">
            <div class="card-icon" aria-hidden="true"><i class="${p.icon}"></i></div>
            <div class="card-badges-wrap" style="display:flex;align-items:center;gap:0.4rem;">
              ${priceBadgeHtml}
              <span class="card-pill">${escapeHtml(catLabels[p.category] || p.category)}</span>
            </div>
          </div>
          <h3 class="card-title">${escapeHtml(p.title)}</h3>
          <p class="card-sub">${escapeHtml(p.subtitle)}</p>
          <div class="card-meta-bar">
            <div class="card-action-links">
              <a href="./p/${p.id}.html" class="card-page-link" title="לפרטים המלאים" aria-label="לפרטים מלאים אודות ${escapeHtml(p.title)}" onclick="event.stopPropagation();">
                <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
              </a>
              <div class="card-action-link">
                <span>לפרטים</span>
                <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
              </div>
            </div>
          </div>
        </article>`;
}).join('\n');

const emptyStateTag = '<p class="empty-state" id="empty-state" hidden>';

for (const filePath of targetFiles) {
  if (!fs.existsSync(filePath)) continue;
  let html = fs.readFileSync(filePath, 'utf8');

  const bentoMatch = html.match(/<div class="bento[^"]*" id="bento" aria-live="polite">/);
  if (!bentoMatch) {
    console.error(`Could not locate bento in ${path.basename(filePath)}!`);
    process.exit(1);
  }

  const bentoOpenTag = bentoMatch[0];
  const startIndex = bentoMatch.index;
  const endIndex = html.indexOf(emptyStateTag, startIndex);

  if (endIndex === -1) {
    console.error(`Could not locate empty-state in ${path.basename(filePath)}!`);
    process.exit(1);
  }

  const before = html.substring(0, startIndex);
  const after = html.substring(endIndex);

  const newBentoBlock = `${bentoOpenTag}\n${staticCards}\n      </div>\n      `;

  html = before + newBentoBlock + after;
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`Successfully injected pre-rendered static cards into ${path.basename(filePath)}!`);
}
