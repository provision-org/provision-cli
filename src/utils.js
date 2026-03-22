import chalk from 'chalk';
import { getToken } from './config.js';

export function requireAuth() {
  if (!getToken()) {
    console.error(chalk.red('Not authenticated. Run `provision login` first.'));
    process.exit(1);
  }
}
