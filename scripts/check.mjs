// Structural checks that `claude plugin validate` does not cover: the Claude and
// Codex marketplaces must list the same plugins, and each plugin's two manifests
// and skill folders must agree on names. Principle skills load only through an
// explicit reference, so they must disable model invocation. Skill text must not
// name a harness or model outside the tier map.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const errors = [];
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));
// Skill text stays harness-neutral. Only the tier map names harnesses and models.
const modelTierMap = join("principle-choose-model-tier", "SKILL.md");
const harnessTerms = /\b(cursor|grok|claude|codex|opus|sonnet|haiku|fable|gemini|gpt)\b|\.mdc\b/i;

const claudeMarket = readJson(".claude-plugin/marketplace.json");
const codexMarket = readJson(".agents/plugins/marketplace.json");
if (claudeMarket.name !== codexMarket.name) {
  errors.push(`marketplace names differ: ${claudeMarket.name} vs ${codexMarket.name}`);
}

const claudePlugins = new Map(claudeMarket.plugins.map((p) => [p.name, p.source]));
const codexPlugins = new Map(codexMarket.plugins.map((p) => [p.name, p.source.path]));
for (const name of new Set([...claudePlugins.keys(), ...codexPlugins.keys()])) {
  const path = claudePlugins.get(name);
  if (path !== codexPlugins.get(name)) {
    errors.push(`${name}: path differs between marketplaces (${path} vs ${codexPlugins.get(name)})`);
    continue;
  }
  for (const manifest of [".claude-plugin/plugin.json", ".codex-plugin/plugin.json"]) {
    const rel = join(path, manifest);
    if (!existsSync(join(root, rel))) errors.push(`${rel}: missing`);
    else if (readJson(rel).name !== name) errors.push(`${rel}: name must be ${name}`);
  }
  const skillsDir = join(root, path, "skills");
  for (const skill of existsSync(skillsDir) ? readdirSync(skillsDir) : []) {
    const file = join(skillsDir, skill, "SKILL.md");
    if (!existsSync(file)) {
      errors.push(`${name}/skills/${skill}: missing SKILL.md`);
      continue;
    }
    const front = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    if (front.match(/^name:\s*(.+)$/m)?.[1].trim() !== skill) {
      errors.push(`${name}/skills/${skill}: frontmatter name must equal folder name`);
    }
    if (!front.match(/^description:\s*\S/m)) errors.push(`${name}/skills/${skill}: missing description`);
    if (skill.startsWith("principle-") && !front.match(/^disable-model-invocation:\s*true\s*$/m)) {
      errors.push(`${name}/skills/${skill}: principle skills must set disable-model-invocation: true`);
    }
  }
  for (const rel of existsSync(skillsDir) ? readdirSync(skillsDir, { recursive: true }) : []) {
    if (!rel.endsWith(".md") || rel === modelTierMap) continue;
    const term = readFileSync(join(skillsDir, rel), "utf8").match(harnessTerms)?.[0];
    if (term) errors.push(`${name}/skills/${rel}: names "${term}"; describe the action or a model tier instead`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(`✘ ${e}`);
  process.exit(1);
}
console.log("✔ structure checks passed");
