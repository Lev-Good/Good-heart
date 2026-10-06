import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mainJsPath = path.join(__dirname, '..', 'src', 'js', 'main.js');
const raw = fs.readFileSync(mainJsPath, 'utf8');

// Normalize CRLF to LF for matching
let js = raw.replace(/\r\n/g, '\n');

// 1. Bump version
js = js.replace("projects.js?v=2.2.1", "projects.js?v=2.3.0");

// 2. Card action links
const oldCardAction = `        <div class="card-action-link">
          <span>לפרטים</span>
          <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
        </div>`;

const newCardAction = `        <div class="card-action-links">
          <a href="./p/\${p.id}.html" class="card-page-link" title="פתח דף ייעודי מלא" aria-label="דף ייעודי עבור \${escapeHtml(p.title)}" onclick="event.stopPropagation();">
            <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
          </a>
          <div class="card-action-link">
            <span>לפרטים</span>
            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
          </div>
        </div>`;

if (js.includes(oldCardAction)) {
  js = js.replace(oldCardAction, newCardAction);
  console.log("Replaced card action in main.js");
} else {
  console.log("Could not find oldCardAction");
}

// 3. Drawer action
const oldDrawer = `  const links = $('#drawer-links');
  links.innerHTML = (p.links || [])
    .map((l) => {
      const cls = l.className === 'btn-primary' ? 'btn-primary' : 'btn-secondary';
      const external = /^https?:/i.test(l.url) || l.url.startsWith('mailto:');
      const rel = external && !l.url.startsWith('mailto:') ? 'noopener noreferrer' : undefined;
      const target = external && !l.url.startsWith('mailto:') ? '_blank' : undefined;
      return \`<a class="\${cls}" href="\${escapeAttr(l.url)}"\${target ? \` target="\${target}"\` : ''}\${rel ? \` rel="\${rel}"\` : ''}>\${l.text}</a>\`;
    })
    .join('');`;

const newDrawer = `  const links = $('#drawer-links');
  const projectButtons = (p.links || [])
    .map((l) => {
      const cls = l.className === 'btn-primary' ? 'btn-primary' : 'btn-secondary';
      const external = /^https?:/i.test(l.url) || l.url.startsWith('mailto:');
      const rel = external && !l.url.startsWith('mailto:') ? 'noopener noreferrer' : undefined;
      const target = external && !l.url.startsWith('mailto:') ? '_blank' : undefined;
      return \`<a class="\${cls}" href="\${escapeAttr(l.url)}"\${target ? \` target="\${target}"\` : ''}\${rel ? \` rel="\${rel}"\` : ''}>\${l.text}</a>\`;
    });

  // כפתור דף ייעודי מלא
  projectButtons.push(\`<a class="btn-secondary" href="./p/\${p.id}.html" style="border-style: dashed;"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i> פתח דף ייעודי מלא לפרויקט</a>\`);

  links.innerHTML = projectButtons.join('');`;

if (js.includes(oldDrawer)) {
  js = js.replace(oldDrawer, newDrawer);
  console.log("Replaced drawer links in main.js");
} else {
  console.log("Could not find oldDrawer");
}

fs.writeFileSync(mainJsPath, js, 'utf8');
console.log("Done updating main.js!");
