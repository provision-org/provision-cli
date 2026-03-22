import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { api } from '../api.js';
import { getSkillsDir } from '../config.js';

export function publishCommand(program) {
  program
    .command('publish <name>')
    .description('Publish a local skill to your team on Provision')
    .action(async (name) => {
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
          version: meta.version || '1.0.0',
        });

        spinner.succeed(`Published ${chalk.bold(name)} to Provision`);
        console.log(chalk.dim(`  View at: https://provision.ai/skills/${name}`));
      } catch (err) {
        spinner.fail('Failed to publish');
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });
}
