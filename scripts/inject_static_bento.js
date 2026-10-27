import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { projects, categories } from '../src/data/projects.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const indexPath = path.join(__dirname, '..', 'index.html');
const downloadsPath = path.join(__dirname, '..', 'src', 'data', 'github_downloads.json');

let downloadsData = { projects: {} };
if (fs.existsSync(downloadsPath)) {
  try {
    downloadsData = JSON.parse(fs.readFileSync(downloadsPath, 'utf8'));
  } catch (e) {
    console.warn('Could not parse github_downloads.json:', e);
  }
}

let html = fs.readFileSync(indexPath, 'utf8');

const catLabels = Object.fromEntries(categories.map(c => [c.id, c.label]));

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const staticCards = projects.map(p => {
  const hasDl = Array.isArray(p.githubRepos) && p.githubRepos.length > 0;
  const dlCount = hasDl ? (downloadsData.projects[p.id] ?? '–') : null;
  const dlBadge = hasDl ? `
              <span class="stat-pill dl-pill" title="מספר הורדות מ-GitHub">
                <i class="fa-solid fa-download" aria-hidden="true"></i>
                <span class="dl-num" data-id="${p.id}">${dlCount}</span>
              </span>` : '';

  return `        <article class="project-card accent-${p.colorClass || 'bl'}" data-id="${p.id}" tabindex="0" role="button" aria-haspopup="dialog">
          <div class="card-head">
            <div class="card-icon" aria-hidden="true"><i class="${p.icon}"></i></div>
            <span class="card-pill">${escapeHtml(catLabels[p.category] || p.category)}</span>
          </div>
          <h3 class="card-title">${escapeHtml(p.title)}</h3>
          <p class="card-sub">${escapeHtml(p.subtitle)}</p>
          <div class="card-meta-bar">
            <div class="card-stats">
              <span class="stat-pill" title="מספר צפיות">
                <i class="fa-regular fa-eye" aria-hidden="true"></i>
                <span class="vc-num" data-id="${p.id}">–</span>
              </span>
              <button type="button" class="card-like-btn" data-id="${p.id}" title="אהבתי את הפרויקט" aria-label="אהבתי את הפרויקט ${escapeHtml(p.title)}">
                <i class="fa-regular fa-heart" aria-hidden="true"></i>
                <span class="lk-num">–</span>
              </button>${dlBadge}
            </div>
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

const bentoOpenTag = '<div class="bento" id="bento" aria-live="polite">';
const emptyStateTag = '<p class="empty-state" id="empty-state" hidden>';

const startIndex = html.indexOf(bentoOpenTag);
const endIndex = html.indexOf(emptyStateTag);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not locate bento or empty-state in index.html!');
  process.exit(1);
}

const before = html.substring(0, startIndex);
const after = html.substring(endIndex);

const newBentoBlock = `${bentoOpenTag}\n${staticCards}\n      </div>\n      `;

html = before + newBentoBlock + after;
fs.writeFileSync(indexPath, html, 'utf8');
console.log('Successfully injected pre-rendered static cards with download counts into index.html safely!');
