import chalk from 'chalk';
import { clearToken } from '../config.js';

export function logoutCommand(program) {
  program
    .command('logout')
    .description('Log out of your Provision account')
    .action(() => {
      clearToken();
      console.log(chalk.green('✓ Logged out'));
    });
}
