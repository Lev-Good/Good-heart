import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mapping of project IDs to their GitHub repository name(s) under Lev-Good
export const PROJECT_GITHUB_REPOS = {
  'personal-kiosk': ['Lev-Good/personal-kiosk'],
  'shitufa': ['Lev-Good/shitufa-releases'],
  'daily-tasks': ['Lev-Good/daily-tasks'],
  'torah-ai': ['Lev-Good/torahai-releases'],
  'purification-board': ['Lev-Good/Purification-board-releases', 'Lev-Good/Purification-board'],
  'authenticator': ['Lev-Good/authenticator-app'],
  'goodmusic': ['Lev-Good/goodmusic-releases'],
  'between-times': ['Lev-Good/Between-times'],
  'work-clock': ['Lev-Good/work-clock-releases'],
  'channel-center': ['Lev-Good/Channel-Center-Website']
};

function updateProjectInContent(content, id, release) {
  if (!release || !release.tag) return content;
  const { tag, version, exeUrl, zipUrl } = release;

  // Find project block
  const idToken = `"id": "${id}"`;
  const startIdx = content.indexOf(idToken);
  if (startIdx === -1) return content;

  let nextProjIdx = content.indexOf('\n    {\n    "id":', startIdx);
  if (nextProjIdx === -1) {
    nextProjIdx = content.indexOf('\n];', startIdx);
  }
  if (nextProjIdx === -1) nextProjIdx = content.length;

  let block = content.slice(startIdx, nextProjIdx);

  // 1. If exeUrl exists, update GitHub exe download URL in this block
  if (exeUrl) {
    // Replace URL matching github.com/.../releases/download/.../*.exe or releases/latest
    block = block.replace(
      /("url":\s*")https:\/\/github\.com\/[^"]+\/releases\/(download\/[^"]+\.exe|latest)(")/g,
      `$1${exeUrl}$3`
    );

    // Update version badge in link text if present, or add if it matches specific patterns
    if (version) {
      if (/("text":\s*"[^"]*?\(v)[^)]+(\)[^"]*")/g.test(block)) {
        block = block.replace(
          /("text":\s*"[^"]*?\(v)[^)]+(\)[^"]*")/g,
          `$1${version}$2`
        );
      } else if (block.includes('הורדה מ-GitHub Releases <i class="fa-solid fa-download"></i>')) {
        block = block.replace(
          'הורדה מ-GitHub Releases <i class="fa-solid fa-download"></i>',
          `הורדה מ-GitHub Releases (v${version}) <i class="fa-solid fa-download"></i>`
        );
      }
    }
  }

  // 2. If zipUrl exists, update GitHub zip download URL in this block
  if (zipUrl) {
    block = block.replace(
      /("url":\s*")https:\/\/github\.com\/[^"]+\/releases\/download\/[^"]+\.zip(")/g,
      `$1${zipUrl}$2`
    );
    if (version) {
      block = block.replace(
        /("text":\s*"[^"]*?\(ZIP v)[^)]+(\)[^"]*")/g,
        `$1${version}$2`
      );
    }
  }

  return content.slice(0, startIdx) + block + content.slice(nextProjIdx);
}

async function run() {
  let token = process.env.GITHUB_TOKEN || '';
  if (!token) {
    try {
      token = execSync('gh auth token', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {}
  }

  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'Lev-Good-Portfolio'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const projectsPath = path.join(__dirname, '..', 'src', 'data', 'projects.js');
  let projectsContent = fs.readFileSync(projectsPath, 'utf8');

  // Ensure githubRepos field is present in projects.js
  for (const [id, repos] of Object.entries(PROJECT_GITHUB_REPOS)) {
    const idPattern = new RegExp(`("id":\\s*"${id}",[\\s\\S]*?"colorClass":\\s*"[^"]+",)(\\s*"githubRepos":\\s*\\[[^\\]]*\\],)?`);
    if (idPattern.test(projectsContent)) {
      projectsContent = projectsContent.replace(
        idPattern,
        `$1\n    "githubRepos": ${JSON.stringify(repos)},`
      );
    }
  }

  // Fetch live download counts and latest release info from GitHub API
  const counts = {};
  const latestReleases = {};
  let totalAll = 0;

  for (const [id, repos] of Object.entries(PROJECT_GITHUB_REPOS)) {
    let projectTotal = 0;
    for (const repo of repos) {
      try {
        const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`, { headers });
        if (!res.ok) {
          console.warn(`Warning: Failed to fetch releases for ${repo} (${res.status})`);
          continue;
        }
        const releases = await res.json();
        if (Array.isArray(releases)) {
          // Filter out drafts
          const published = releases.filter(r => !r.draft);
          if (published.length > 0) {
            const latest = published[0];
            const exeAsset = (latest.assets || []).find(a => a.name.endsWith('.exe') && !a.name.endsWith('.blockmap'));
            const zipAsset = (latest.assets || []).find(a => a.name.endsWith('.zip'));

            const currentPublishedAt = latestReleases[id]?.publishedAt ? new Date(latestReleases[id].publishedAt) : new Date(0);
            const thisPublishedAt = new Date(latest.published_at || 0);

            if (!latestReleases[id] || (exeAsset && thisPublishedAt >= currentPublishedAt)) {
              latestReleases[id] = {
                tag: latest.tag_name,
                version: latest.tag_name ? latest.tag_name.replace(/^v/, '') : '',
                name: latest.name || latest.tag_name,
                publishedAt: latest.published_at,
                exeUrl: exeAsset ? exeAsset.browser_download_url : null,
                zipUrl: zipAsset ? zipAsset.browser_download_url : null,
                htmlUrl: latest.html_url
              };
            }
          }

          for (const rel of releases) {
            for (const asset of (rel.assets || [])) {
              projectTotal += (asset.download_count || 0);
            }
          }
        }
      } catch (err) {
        console.warn(`Error fetching ${repo}:`, err.message);
      }
    }
    counts[id] = projectTotal;
    totalAll += projectTotal;
    console.log(`  ${id}: ${projectTotal} downloads (Latest: ${latestReleases[id]?.tag || 'none'})`);
  }

  // Update projects.js with latest release links & version text
  for (const [id, release] of Object.entries(latestReleases)) {
    projectsContent = updateProjectInContent(projectsContent, id, release);
  }
  fs.writeFileSync(projectsPath, projectsContent, 'utf8');
  console.log('Updated src/data/projects.js with latest release download URLs & versions.');

  const output = {
    updatedAt: new Date().toISOString(),
    totalDownloads: totalAll,
    projects: counts,
    latestReleases
  };

  const outPath = path.join(__dirname, '..', 'src', 'data', 'github_downloads.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Saved ${outPath} (Total across tracked projects: ${totalAll})`);
}

run();
