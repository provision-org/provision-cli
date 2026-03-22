import chalk from 'chalk';
import { api } from '../api.js';

export function whoamiCommand(program) {
  program
    .command('whoami')
    .description('Show current user')
    .action(async () => {
      try {
        const user = await api.whoami();
        console.log(`${chalk.bold(user.name)} (${user.email})`);
        if (user.team) console.log(chalk.dim(`Team: ${user.team}`));
      } catch (err) {
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });
}
