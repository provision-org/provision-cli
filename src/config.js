import Conf from 'conf';
import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const config = new Conf({
  projectName: 'provision',
  cwd: join(homedir(), '.provision'),
});

export function getToken() {
  return config.get('token');
}

export function setToken(token) {
  config.set('token', token);
}

export function clearToken() {
  config.delete('token');
}

export function getApiUrl() {
  return config.get('apiUrl', 'https://provision.ai');
}

export function setApiUrl(url) {
  config.set('apiUrl', url);
}

export function getSkillsDir() {
  const dir = join(homedir(), '.provision', 'skills');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export default config;
