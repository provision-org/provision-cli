/**
 * Offline skill generation — runs the two-step pipeline locally
 * using the user's own API keys. No Provision account needed.
 */

const VIDEO_SOP_PROMPT = `You are an expert process analyst watching a screen recording. Your job is to extract an exhaustive, comprehensive Standard Operating Procedure (SOP) that captures EVERYTHING the person does in this video.

## What to capture

### Every single action, in order
- Every URL visited (exact URL from the address bar when visible)
- Every click — what was clicked, where, what it was labeled
- Every keystroke — what was typed into which field
- Every selection from dropdowns, checkboxes, radio buttons
- Every tab switch, window switch, or application change
- Every scroll, wait, or page load
- Every copy-paste operation — what was copied and where it went
- Every right-click, hover, or keyboard shortcut used

### Authentication and login steps
- If the person logs into a website or tool, describe the full login flow as steps: navigate to login page, enter credentials, handle 2FA if present, verify successful login
- Do NOT extract usernames/passwords as environment variables — instead describe authentication as browser steps the agent should perform
- Note which services require authentication so the agent knows to check if it's already logged in

### Tacit knowledge and preferences
- If the person pauses or hesitates, note what they were looking at
- If they skip certain items or choose one option over another, note the preference and try to infer why
- If they speak or narrate, capture what they say — especially opinions, preferences, and reasoning
- If they compare options or evaluate results, note their criteria
- Note any patterns: do they always check something before proceeding? Do they follow a specific order?

### Tool and context awareness
- Name every application, website, browser extension, and tool shown
- Note the specific features used within each tool (e.g., "LinkedIn Sales Navigator advanced search" not just "LinkedIn")
- Capture any settings, filters, or configurations applied

### Data flow
- Track what information moves between applications
- Note every piece of data that gets extracted, copied, transformed, or entered elsewhere
- Identify inputs (what the person starts with) and outputs (what they produce)

## Output format

Write the SOP as a detailed, numbered document. Use this structure:

**Title:** [Descriptive name for this workflow]
**Purpose:** [What this workflow accomplishes]
**Tools Used:** [List every tool, website, and application observed]
**Accounts Required:** [List which services need login — NOT the credentials themselves]
**Prerequisites:** [What needs to be in place before starting]

**Detailed Steps:**
Write each step with enough detail that someone who has never done this task could follow along.
Group related steps into phases with headers like "Phase 1: Research" or "Phase 2: Data Entry."

**Key Preferences & Style Notes:** [Any subjective choices observed]
**Common Patterns:** [Any repeated sequences]
**Output/Deliverable:** [What the final result looks like]

## Critical rules
- Be EXHAUSTIVE. A 5-minute video should produce at least 2 pages of SOP. A 15-minute video should produce 5-10 pages.
- DO NOT summarize or abstract.
- Authentication should be described as BROWSER STEPS, not environment variables.
- Capture verbal commentary and narration.
- Write in imperative voice: "Navigate to..." not "The user navigates to..."`;

const SOP_TO_SKILL_PROMPT = (rawSop) => `You are an expert skill architect. Transform this raw SOP into a structured JSON skill definition.

## Important context
The AI agent has a full browser, persistent sessions, file system access, and CLI access.
Authentication should be handled as STEPS, not environment variables.
Only actual API keys (OPENAI_API_KEY, STRIPE_SECRET_KEY) should be in requires_env.

## The Raw SOP

${rawSop}

## Output JSON

Return JSON with this structure:
{
  "steps": ["Navigate to linkedin.com/sales. If not logged in, sign in.", ...],
  "tools": ["browser"],
  "websites": ["linkedin.com"],
  "accounts_required": ["LinkedIn account"],
  "requires_env": [],
  "suggested_name": "descriptive-skill-name",
  "tags": ["category1", "category2"],
  "description": "One-line description",
  "phases": ["Setup", "Research", "Execute"],
  "skill_content": "The complete SKILL.md file content",
  "readme": "README.md content"
}

Do NOT prefix steps with phase names. Keep steps clean and actionable.
Return ONLY valid JSON. No markdown code blocks.`;

const TEXT_SKILL_PROMPT = (description) => `You are a skill architect for AI agents. Given a user's description of a workflow, create a structured skill definition.

The AI agent has a full browser, persistent sessions, file system access, and CLI access.
Authentication should be browser steps, not environment variables.

User's description:
${description}

Return JSON with:
{
  "steps": ["step 1", "step 2", ...],
  "tools": ["browser", "exec"],
  "requires_env": [],
  "suggested_name": "skill-name",
  "tags": ["tag1", "tag2"],
  "description": "One-line description",
  "skill_content": "The full SKILL.md content",
  "readme": "README.md content"
}

Return ONLY valid JSON.`;

/**
 * Get the API key from flags or environment variables.
 */
export function getOfflineKeys() {
  return {
    gemini: process.env.GEMINI_API_KEY || null,
    anthropic: process.env.ANTHROPIC_API_KEY || null,
    openai: process.env.OPENAI_API_KEY || null,
  };
}

/**
 * Check if offline mode is available (at least one key configured).
 */
export function canRunOffline(keys) {
  return !!(keys.gemini || keys.anthropic || keys.openai);
}

/**
 * Step 1: Extract SOP from video using Gemini.
 */
export async function extractSopFromVideo(videoData, mimeType, geminiKey) {
  const base64 = videoData.toString('base64');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: VIDEO_SOP_PROMPT },
          ],
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 16384 },
      }),
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Gemini API failed: ${err?.error?.message || response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (text.length < 100) {
    throw new Error('Gemini returned insufficient content from the video.');
  }

  return text;
}

/**
 * Step 2: Structure SOP into skill using Claude, OpenAI, or Gemini.
 */
export async function structureSop(rawSop, keys) {
  const prompt = SOP_TO_SKILL_PROMPT(rawSop);

  // Try Anthropic first
  if (keys.anthropic) {
    try {
      return await structureViaClaude(prompt, keys.anthropic);
    } catch (e) {
      if (process.env.PROVISION_DEBUG) {
        console.error(`[DEBUG] Claude failed: ${e.message}, trying fallback`);
      }
    }
  }

  // Try OpenAI
  if (keys.openai) {
    try {
      return await structureViaOpenAI(prompt, keys.openai);
    } catch (e) {
      if (process.env.PROVISION_DEBUG) {
        console.error(`[DEBUG] OpenAI failed: ${e.message}, trying fallback`);
      }
    }
  }

  // Fall back to Gemini for structuring
  if (keys.gemini) {
    return await structureViaGemini(prompt, keys.gemini);
  }

  throw new Error('No API key available for skill structuring. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY.');
}

/**
 * Generate skill from text description (no video).
 */
export async function generateFromText(description, keys) {
  const prompt = TEXT_SKILL_PROMPT(description);

  if (keys.anthropic) {
    try { return await structureViaClaude(prompt, keys.anthropic); } catch {}
  }
  if (keys.openai) {
    try { return await structureViaOpenAI(prompt, keys.openai); } catch {}
  }
  if (keys.gemini) {
    return await structureViaGemini(prompt, keys.gemini);
  }

  throw new Error('No API key available. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY.');
}

async function structureViaClaude(prompt, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) throw new Error(`Claude API: ${response.status}`);

  const data = await response.json();
  let content = data?.content?.[0]?.text || '{}';
  content = content.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '');
  const result = JSON.parse(content);
  if (!result?.steps?.length) throw new Error('Empty result from Claude');
  return result;
}

async function structureViaOpenAI(prompt, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-nano',
      messages: [
        { role: 'system', content: 'You are a skill architect. Respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API: ${response.status}`);

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '{}';
  const result = JSON.parse(content);
  if (!result?.steps?.length) throw new Error('Empty result from OpenAI');
  return result;
}

async function structureViaGemini(prompt, apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      }),
    },
  );

  if (!response.ok) throw new Error(`Gemini API: ${response.status}`);

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const result = JSON.parse(text);
  if (!result?.steps?.length) throw new Error('Empty result from Gemini');
  return result;
}
