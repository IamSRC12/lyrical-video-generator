
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const outputFile = path.join(rootDir, 'full_codebase.txt');
const artifactFile = 'C:/Users/Crystal/.gemini/antigravity-ide/brain/903e3fe0-f3bd-404d-b7fd-b4039ca209c3/full_codebase.txt';

const includeExts = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.css', '.example']);
const excludeDirs = new Set(['node_modules', '.next', '.git', 'remotion-bundle', 'data']);

let combinedContent = '# AI Lyrical Video Generator — Complete Integrated Full-Stack Codebase\n\n';

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (!excludeDirs.has(entry.name)) {
        walk(fullPath);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (includeExts.has(ext) || entry.name === 'Dockerfile' || entry.name === '.env.example') {
        if (entry.name === 'package-lock.json') continue;
        const content = fs.readFileSync(fullPath, 'utf8');
        combinedContent += '================================================================================\n';
        combinedContent += `FILE: ${relPath}\n`;
        combinedContent += '================================================================================\n\n';
        combinedContent += content;
        combinedContent += '\n\n';
      }
    }
  }
}

walk(rootDir);

fs.writeFileSync(outputFile, combinedContent, 'utf8');
fs.writeFileSync(artifactFile, combinedContent, 'utf8');

console.log(`Successfully generated full codebase text file (${combinedContent.length} bytes, ~${Math.round(combinedContent.length/1024)} KB)`);


