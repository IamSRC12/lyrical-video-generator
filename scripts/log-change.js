import fs from "node:fs";
import path from "node:path";

const [relPath, action] = process.argv.slice(2);
if (!relPath || !action) {
  console.error("Usage: node scripts/log-change.js <relative-path> <Created|Modified|Deleted>");
  process.exit(1);
}

const fullPath = path.resolve(process.cwd(), relPath);
const fileContent = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

const entry = `================================================================================
TIMESTAMP: ${timestamp}
FILE PATH: ${relPath}
ACTION: ${action}
================================================================================
${fileContent}

================================================================================
`;

const logPath = path.resolve(process.cwd(), "code_history_log.txt");
const oldContent = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";
fs.writeFileSync(logPath, entry + oldContent, "utf8");
console.log(`Logged ${action} for ${relPath}`);
