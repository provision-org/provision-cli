import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { api } from '../api.js';
import { getSkillsDir } from '../config.js';

export function installCommand(program) {
  program
    .command('install <name>')
    .description('Install a skill from Provision marketplace')
    .action(async (name) => {
      const spinner = ora(`Fetching ${name}...`).start();

      let skill;
      try {
        skill = await api.pullSkill(name);
        spinner.succeed(`Found ${chalk.bold(skill.name)}`);
      } catch (err) {
        spinner.fail('Skill not found');
        console.error(chalk.red(err.message));
        process.exit(1);
      }

      // Save to local provision skills directory
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

      // Show skill info
      if (skill.description) {
        console.log(chalk.dim(`  ${skill.description}`));
      }
      if (skill.steps && skill.steps.length > 0) {
        console.log('');
        skill.steps.forEach((step, i) => {
          console.log(chalk.dim(`  ${i + 1}. ${step}`));
        });
      }
      console.log('');

      // Multi-select install targets
      const { targets } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'targets',
          message: 'Where would you like to install this skill?',
          choices: [
            { name: 'Claude Code (~/.claude/skills/)', value: 'claude-code' },
            { name: 'OpenClaw local (~/.openclaw/skills/)', value: 'openclaw' },
            { name: 'Cursor (.cursor/skills/)', value: 'cursor' },
            { name: 'Codex (.codex/skills/)', value: 'codex' },
          ],
        },
      ]);

      const home = process.env.HOME;
      const skillContent = skill.skill_content;

      if (targets.includes('claude-code')) {
        const dir = join(home, '.claude', 'skills');
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${name}.md`), skillContent);
        console.log(chalk.green(`✓ Installed to Claude Code (~/.claude/skills/${name}.md)`));
      }

      if (targets.includes('openclaw')) {
        const dir = join(home, '.openclaw', 'skills', name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'SKILL.md'), skillContent);
        console.log(chalk.green(`✓ Installed to OpenClaw (~/.openclaw/skills/${name}/)`));
      }

      if (targets.includes('cursor')) {
        const dir = join(process.cwd(), '.cursor', 'skills');
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${name}.md`), skillContent);
        console.log(chalk.green(`✓ Installed to Cursor (.cursor/skills/${name}.md)`));
      }

      if (targets.includes('codex')) {
        const dir = join(process.cwd(), '.codex', 'skills');
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${name}.md`), skillContent);
        console.log(chalk.green(`✓ Installed to Codex (.codex/skills/${name}.md)`));
      }

      if (targets.length === 0) {
        console.log(chalk.dim(`Saved to ${skillDir}`));
      }

      console.log('');
    });
}
