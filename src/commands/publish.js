import chalk from 'chalk';
import { getToken, sanitizeSkillName } from '../config.js';
import { publishSkillByName } from '../publishHelper.js';

export function publishCommand(program) {
  program
    .command('publish <name>')
    .description('Publish a local skill to your team on Provision')
    .option('-c, --changelog <message>', 'Changelog message for this version')
    .action(async (rawName, options) => {
      const name = sanitizeSkillName(rawName);
      if (!name) {
        console.error(chalk.red('Invalid skill name. Use lowercase letters, numbers, and hyphens only.'));
        process.exit(1);
      }

      if (!getToken()) {
        console.error(chalk.red('Not logged in. Run `npx @provision-ai/cli login` first.'));
        process.exit(1);
      }

      try {
        await publishSkillByName(name, { changelog: options.changelog });
      } catch (err) {
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });
}
