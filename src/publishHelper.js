/**
 * Shared publish logic — used by both publish.js and deploy.js.
 */

import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { api } from './api.js';
import { getSkillsDir } from './config.js';

function bumpVersion(version) {
  const parts = (version || '1.0.0').split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join('.');
}

function compareVersions(a, b) {
  const pa = (a || '0.0.0').split('.').map(Number);
  const pb = (b || '0.0.0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

/**
 * Check if a skill exists on the server. Returns the skill data or null.
 */
export async function getServerSkill(name) {
  try {
    return await api.getSkill(name);
  } catch {
    return null;
  }
}

/**
 * Read local skill files. Returns { meta, skillContent, readme } or null.
 */
export function readLocalSkill(name) {
  const skillDir = join(getSkillsDir(), name);
  const jsonPath = join(skillDir, 'skill.json');
  const skillPath = join(skillDir, 'SKILL.md');
  const readmePath = join(skillDir, 'README.md');

  if (!existsSync(jsonPath) || !existsSync(skillPath)) {
    return null;
  }

  return {
    meta: JSON.parse(readFileSync(jsonPath, 'utf8')),
    skillContent: readFileSync(skillPath, 'utf8'),
    readme: existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '',
    jsonPath,
  };
}

/**
 * Publish a skill by name. Handles version bumping.
 *
 * @param {string} name - Skill slug
 * @param {object} options
 * @param {string} [options.changelog] - Changelog message
 * @param {boolean} [options.silent] - Suppress output (used when auto-publishing from deploy)
 * @returns {{ name: string, version: string, slug: string }}
 */
export async function publishSkillByName(name, { changelog, silent } = {}) {
  const local = readLocalSkill(name);
  if (!local) {
    throw new Error(`Skill "${name}" not found locally. Run \`provision teach\` first.`);
  }

  const { meta, skillContent, readme, jsonPath } = local;

  const checkSpinner = silent ? null : ora('Checking for existing version...').start();
  let localVersion = meta.version || '1.0.0';

  const existing = await getServerSkill(name);

  if (existing && existing.version) {
    const serverVersion = existing.version;

    if (compareVersions(localVersion, serverVersion) <= 0) {
      const newVersion = bumpVersion(serverVersion);
      if (checkSpinner) {
        checkSpinner.info(
          `Updating ${chalk.bold(name)} ${chalk.dim(`v${localVersion}`)} → ${chalk.bold(`v${newVersion}`)}`,
        );
      }
      localVersion = newVersion;
      meta.version = newVersion;
      writeFileSync(jsonPath, JSON.stringify(meta, null, 2));
    } else {
      if (checkSpinner) checkSpinner.succeed(`Publishing ${chalk.bold(name)} v${localVersion}`);
    }
  } else {
    if (checkSpinner) checkSpinner.succeed(`Publishing new skill ${chalk.bold(name)} v${localVersion}`);
  }

  const publishSpinner = silent ? null : ora('Publishing...').start();

  await api.publishSkill({
    name: meta.name || name,
    description: meta.description || '',
    skill_content: skillContent,
    readme,
    steps: meta.steps || [],
    tools: meta.tools || [],
    requires_env: meta.requires?.env || [],
    tags: meta.tags || [],
    version: localVersion,
    changelog: changelog || 'Published via CLI',
  });

  if (publishSpinner) {
    publishSpinner.succeed(`Published ${chalk.bold(name)} v${localVersion} to Provision`);
    console.log(chalk.dim(`  View at: https://provision.ai/skills/${name}`));
  }

  return { name, version: localVersion, slug: name };
}
