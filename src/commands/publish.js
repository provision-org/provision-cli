import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { api } from '../api.js';
import { getSkillsDir, getToken } from '../config.js';

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

export function publishCommand(program) {
  program
    .command('publish <name>')
    .description('Publish a local skill to your team on Provision')
    .option('-c, --changelog <message>', 'Changelog message for this version')
    .action(async (name, options) => {
      if (!getToken()) {
        console.error(chalk.red('Not logged in. Run `npx @provision-ai/cli login` first.'));
        process.exit(1);
      }

      const skillDir = join(getSkillsDir(), name);
      const jsonPath = join(skillDir, 'skill.json');
      const skillPath = join(skillDir, 'SKILL.md');
      const readmePath = join(skillDir, 'README.md');

      if (!existsSync(jsonPath) || !existsSync(skillPath)) {
        console.error(chalk.red(`Skill "${name}" not found locally. Run \`provision teach\` first.`));
        process.exit(1);
      }

      const meta = JSON.parse(readFileSync(jsonPath, 'utf8'));
      const skillContent = readFileSync(skillPath, 'utf8');
      const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '';

      // Check if skill already exists on server and auto-bump if needed
      const checkSpinner = ora('Checking for existing version...').start();
      let localVersion = meta.version || '1.0.0';

      try {
        const slug = name;
        const existing = await api.getSkill(slug);

        if (existing && existing.version) {
          const serverVersion = existing.version;

          if (compareVersions(localVersion, serverVersion) <= 0) {
            const newVersion = bumpVersion(serverVersion);
            console.log('');
            checkSpinner.info(
              `Updating ${chalk.bold(name)} ${chalk.dim(`v${localVersion}`)} -> ${chalk.bold(`v${newVersion}`)}`
            );
            localVersion = newVersion;

            // Persist bumped version locally
            meta.version = newVersion;
            writeFileSync(jsonPath, JSON.stringify(meta, null, 2));
          } else {
            checkSpinner.succeed(`Publishing ${chalk.bold(name)} v${localVersion}`);
          }
        } else {
          checkSpinner.succeed(`Publishing new skill ${chalk.bold(name)} v${localVersion}`);
        }
      } catch (err) {
        // Skill doesn't exist on server yet — that's fine
        checkSpinner.succeed(`Publishing new skill ${chalk.bold(name)} v${localVersion}`);
      }

      const spinner = ora('Publishing...').start();

      try {
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
          changelog: options.changelog || 'Published via CLI',
        });

        spinner.succeed(`Published ${chalk.bold(name)} v${localVersion} to Provision`);
        console.log(chalk.dim(`  View at: https://provision.ai/skills/${name}`));
      } catch (err) {
        spinner.fail('Failed to publish');
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });
}
