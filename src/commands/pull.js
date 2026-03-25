import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { api } from '../api.js';
import { getSkillsDir, sanitizeSkillName } from '../config.js';

export function pullCommand(program) {
  program
    .command('pull <name>')
    .description('Download a skill from Provision marketplace')
    .action(async (rawName) => {
      const name = sanitizeSkillName(rawName);
      if (!name) {
        console.error(chalk.red('Invalid skill name. Use lowercase letters, numbers, and hyphens only.'));
        process.exit(1);
      }
      const spinner = ora(`Pulling ${name}...`).start();

      try {
        const skill = await api.pullSkill(name);

        const skillDir = join(getSkillsDir(), name);
        mkdirSync(skillDir, { recursive: true });

        writeFileSync(join(skillDir, 'SKILL.md'), skill.skill_content);
        writeFileSync(join(skillDir, 'skill.json'), JSON.stringify({
          name: skill.name,
          version: skill.version,
          description: skill.description,
          steps: skill.steps,
          tools: skill.tools,
          requires: { env: skill.requires_env || [] },
          tags: skill.tags || [],
        }, null, 2));
        if (skill.readme) {
          writeFileSync(join(skillDir, 'README.md'), skill.readme);
        }

        spinner.succeed(`Downloaded ${chalk.bold(name)} to ${skillDir}`);
      } catch (err) {
        spinner.fail('Failed to pull');
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });
}
