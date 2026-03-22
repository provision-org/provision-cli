import chalk from 'chalk';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getSkillsDir } from '../config.js';

export function skillsCommand(program) {
  const cmd = program
    .command('skills')
    .description('Manage local skills');

  cmd
    .command('list')
    .description('List local skills')
    .action(() => {
      const dir = getSkillsDir();
      const skills = readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => {
          const jsonPath = join(dir, d.name, 'skill.json');
          if (existsSync(jsonPath)) {
            const meta = JSON.parse(readFileSync(jsonPath, 'utf8'));
            return { name: d.name, ...meta };
          }
          return { name: d.name, description: '(no metadata)' };
        });

      if (skills.length === 0) {
        console.log(chalk.dim('No local skills. Run `provision teach` to create one.'));
        return;
      }

      console.log(chalk.bold(`\n${skills.length} local skill(s):\n`));
      skills.forEach(s => {
        console.log(`  ${chalk.cyan(s.name)} ${chalk.dim(`v${s.version || '?'}`)}`);
        if (s.description) console.log(`  ${chalk.dim(s.description)}`);
        console.log('');
      });
    });

  cmd
    .command('info <name>')
    .description('Show skill details')
    .action((name) => {
      const skillDir = join(getSkillsDir(), name);
      const jsonPath = join(skillDir, 'skill.json');

      if (!existsSync(jsonPath)) {
        console.error(chalk.red(`Skill "${name}" not found locally.`));
        process.exit(1);
      }

      const meta = JSON.parse(readFileSync(jsonPath, 'utf8'));
      console.log(chalk.bold(`\n${meta.name} v${meta.version || '1.0.0'}\n`));
      if (meta.description) console.log(`  ${meta.description}\n`);
      if (meta.steps) {
        console.log(chalk.dim('  Steps:'));
        meta.steps.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
      }
      if (meta.requires?.env?.length) {
        console.log(chalk.dim(`\n  Requires: ${meta.requires.env.join(', ')}`));
      }
      if (meta.tools?.length) {
        console.log(chalk.dim(`  Tools: ${meta.tools.join(', ')}`));
      }
      console.log('');
    });
}
