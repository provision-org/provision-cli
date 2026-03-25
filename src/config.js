import Conf from 'conf';
import { homedir } from 'os';
import { join, resolve, relative } from 'path';
import { mkdirSync, existsSync } from 'fs';

const config = new Conf({
  projectName: 'provision',
  cwd: join(homedir(), '.provision'),
  configFileMode: 0o600, // Owner read/write only — protects auth token
});

// --- Auth ---

export function getToken() {
  return config.get('token');
}

export function setToken(token) {
  config.set('token', token);
}

export function clearToken() {
  config.delete('token');
}

// --- API URL (validated) ---

const ALLOWED_HOSTS = ['provision.ai', 'www.provision.ai'];

export function getApiUrl() {
  const url = config.get('apiUrl', 'https://provision.ai');

  // Validate that the URL points to a trusted Provision domain
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      console.error('Warning: apiUrl must use https. Falling back to default.');
      return 'https://provision.ai';
    }

    // Allow localhost/127.0.0.1 for development
    const host = parsed.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.test')) {
      return url;
    }

    // Allow *.provision.ai
    if (host === 'provision.ai' || host.endsWith('.provision.ai')) {
      return url;
    }

    console.error(`Warning: apiUrl host "${host}" is not a trusted Provision domain. Falling back to default.`);
    return 'https://provision.ai';
  } catch {
    return 'https://provision.ai';
  }
}

export function setApiUrl(url) {
  config.set('apiUrl', url);
}

// --- Skills directory ---

export function getSkillsDir() {
  const dir = join(homedir(), '.provision', 'skills');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// --- Skill name sanitization ---

/**
 * Sanitize a skill name to prevent path traversal.
 * Strips .., /, \, and any non-alphanumeric/hyphen/underscore characters.
 * Returns null if the name is invalid after sanitization.
 */
export function sanitizeSkillName(name) {
  if (!name || typeof name !== 'string') return null;

  const trimmed = name.trim();

  // Reject if it contains any path traversal or separator characters
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) return null;

  // Only allow lowercase alphanumeric, hyphens, underscores
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(trimmed)) return null;

  // Double-check: resolved path must stay within skills directory
  const skillsDir = getSkillsDir();
  const resolved = resolve(skillsDir, trimmed);
  if (!resolved.startsWith(skillsDir)) return null;

  return trimmed;
}

export default config;
