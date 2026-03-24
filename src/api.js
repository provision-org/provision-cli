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
    // Re-read baseUrl each time in case it was updated
    const baseUrl = getApiUrl();
    const url = `${baseUrl}/api/cli${path}`;
    const options = { method, headers: this.headers };
    if (body) options.body = JSON.stringify(body);

    if (process.env.PROVISION_DEBUG) {
      console.error(`[DEBUG] ${method} ${url}`);
      console.error(`[DEBUG] Token: ${this.token ? this.token.slice(0, 8) + '...' : 'none'}`);
    }

    const response = await fetch(url, options);

    if (process.env.PROVISION_DEBUG) {
      console.error(`[DEBUG] Status: ${response.status}`);
    }

    if (response.status === 401) {
      throw new Error('Not authenticated. Run `provision login` first.');
    }

    if (!response.ok) {
      const text = await response.text();
      if (process.env.PROVISION_DEBUG) {
        console.error(`[DEBUG] Response body: ${text.slice(0, 500)}`);
      }
      let data = {};
      try { data = JSON.parse(text); } catch {}
      throw new Error(data.message || `API error: ${response.status}`);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Unexpected response from server. You may need to log in again: npx @provision-ai/cli login');
    }
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

  async editSkill(skillContent, modification) {
    return this.request('POST', '/skills/edit', { skill_content: skillContent, modification });
  }

  async deleteSkill(slug) {
    return this.request('DELETE', `/skills/${slug}`);
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
