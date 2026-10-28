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
  'purification-board': ['Lev-Good/Purification-board', 'Lev-Good/Purification-board-releases'],
  'authenticator': ['Lev-Good/authenticator-app'],
  'goodmusic': ['Lev-Good/goodmusic-releases'],
  'between-times': ['Lev-Good/Between-times'],
  'work-clock': ['Lev-Good/work-clock-releases'],
  'channel-center': ['Lev-Good/Channel-Center-Website']
};

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

  // 1. Update src/data/projects.js to ensure githubRepos field is present
  const projectsPath = path.join(__dirname, '..', 'src', 'data', 'projects.js');
  let projectsContent = fs.readFileSync(projectsPath, 'utf8');

  for (const [id, repos] of Object.entries(PROJECT_GITHUB_REPOS)) {
    // Check if githubRepos is already in this project block
    const idPattern = new RegExp(`("id":\\s*"${id}",[\\s\\S]*?"colorClass":\\s*"[^"]+",)(\\s*"githubRepos":\\s*\\[[^\\]]*\\],)?`);
    if (idPattern.test(projectsContent)) {
      projectsContent = projectsContent.replace(
        idPattern,
        `$1\n    "githubRepos": ${JSON.stringify(repos)},`
      );
    }
  }
  fs.writeFileSync(projectsPath, projectsContent, 'utf8');
  console.log('Updated src/data/projects.js with githubRepos metadata.');

  // 2. Fetch live download counts from GitHub API
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
          if (releases.length > 0 && !latestReleases[id]) {
            const latest = releases[0];
            const exeAsset = (latest.assets || []).find(a => a.name.endsWith('.exe') && !a.name.endsWith('.blockmap'));
            latestReleases[id] = {
              tag: latest.tag_name,
              exeUrl: exeAsset ? exeAsset.browser_download_url : null
            };
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
    console.log(`  ${id}: ${projectTotal} downloads`);
  }

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
