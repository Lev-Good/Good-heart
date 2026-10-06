import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { projects, categories } from '../src/data/projects.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const catLabels = Object.fromEntries(categories.map(c => [c.id, c.label]));

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const staticCards = projects.map(p => `        <article class="project-card accent-${p.colorClass || 'bl'}" data-id="${p.id}" tabindex="0" role="button" aria-haspopup="dialog">
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
              </button>
            </div>
            <div class="card-action-links">
              <a href="./p/${p.id}.html" class="card-page-link" title="פתח דף ייעודי מלא" aria-label="דף ייעודי עבור ${escapeHtml(p.title)}" onclick="event.stopPropagation();">
                <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
              </a>
              <div class="card-action-link">
                <span>לפרטים</span>
                <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
              </div>
            </div>
          </div>
        </article>`).join('\n');

const bentoRegex = /<div class="bento" id="bento" aria-live="polite">[\s\S]*?<\/div>/;
const newBento = `<div class="bento" id="bento" aria-live="polite">\n${staticCards}\n      </div>`;

html = html.replace(bentoRegex, newBento);
fs.writeFileSync(indexPath, html, 'utf8');
console.log('Successfully injected pre-rendered static cards into index.html!');
