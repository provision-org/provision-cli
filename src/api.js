import { getToken, getApiUrl } from './config.js';

class ProvisionAPI {
  constructor() {
    this.baseUrl = getApiUrl();
  }

  get token() {
    return getToken();
  }

  get headers() {
    const h = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'provision-cli/0.1.0',
    };
    if (this.token) {
      h['Authorization'] = `Bearer ${this.token}`;
    }
    return h;
  }

  async request(method, path, body = null) {
    const url = `${this.baseUrl}/api/cli${path}`;
    const options = { method, headers: this.headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);

    if (response.status === 401) {
      throw new Error('Not authenticated. Run `provision login` first.');
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || `API error: ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async whoami() {
    return this.request('GET', '/whoami');
  }

  // Skills
  async generateSkill(description) {
    return this.request('POST', '/skills/generate', { description });
  }

  async publishSkill(skillData) {
    return this.request('POST', '/skills/publish', skillData);
  }

  async listTeamSkills() {
    return this.request('GET', '/skills');
  }

  async getSkill(slug) {
    return this.request('GET', `/skills/${slug}`);
  }

  async pullSkill(slug) {
    return this.request('GET', `/skills/${slug}/download`);
  }

  async searchSkills(query) {
    return this.request('GET', `/skills/search?q=${encodeURIComponent(query)}`);
  }

  // Agents
  async listAgents() {
    return this.request('GET', '/agents');
  }

  async deploySkill(agentId, skillSlug) {
    return this.request('POST', `/agents/${agentId}/skills`, { skill: skillSlug });
  }
}

export const api = new ProvisionAPI();
