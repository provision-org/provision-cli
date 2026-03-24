/**
 * Offline skill generation — runs locally using a Gemini API key.
 * No Provision account needed. Free key at aistudio.google.com/apikey
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
- If the person logs into a website or tool, describe the full login flow as steps
- Do NOT extract usernames/passwords as environment variables — describe authentication as browser steps
- Note which services require authentication

### Tacit knowledge and preferences
- If the person pauses or hesitates, note what they were looking at
- If they skip certain items or choose one option over another, note the preference
- If they speak or narrate, capture what they say — especially opinions, preferences, and reasoning
- Note any patterns: do they always check something before proceeding?

### Tool and context awareness
- Name every application, website, browser extension, and tool shown
- Note the specific features used within each tool
- Capture any settings, filters, or configurations applied

### Data flow
- Track what information moves between applications
- Identify inputs (what the person starts with) and outputs (what they produce)

## Output format

Write the SOP as a detailed, numbered document with:
**Title**, **Purpose**, **Tools Used**, **Accounts Required**, **Prerequisites**, **Detailed Steps** (grouped into phases), **Key Preferences & Style Notes**, **Common Patterns**, **Output/Deliverable**

## Critical rules
- Be EXHAUSTIVE. A 5-minute video = 2+ pages. A 15-minute video = 5-10 pages.
- DO NOT summarize or abstract.
- Authentication = BROWSER STEPS, not environment variables.
- Capture verbal commentary and narration.
- Write in imperative voice.`;

const SOP_TO_SKILL_PROMPT = (rawSop) => `You are an expert skill architect. Transform this raw SOP into a structured JSON skill definition.

The AI agent has a full browser, persistent sessions, file system access, and CLI access.
Authentication should be handled as STEPS, not environment variables. Only actual API keys should be in requires_env.

## The Raw SOP

${rawSop}

## Output

Return JSON:
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
 * Get the Gemini API key from environment.
 */
export function getOfflineKey() {
  return process.env.GEMINI_API_KEY || null;
}

/**
 * Check if offline mode is available.
 */
export function canRunOffline() {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Call Gemini API (shared helper).
 */
async function callGemini(apiKey, contents, useJsonFormat = false) {
  const config = { temperature: 0.3, maxOutputTokens: 16384 };
  if (useJsonFormat) {
    config.responseMimeType = 'application/json';
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: config }),
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Gemini API failed: ${err?.error?.message || response.status}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Step 1: Extract SOP from video using Gemini.
 */
export async function extractSopFromVideo(videoData, mimeType, apiKey) {
  const text = await callGemini(apiKey, [{
    parts: [
      { inline_data: { mime_type: mimeType, data: videoData.toString('base64') } },
      { text: VIDEO_SOP_PROMPT },
    ],
  }]);

  if (text.length < 100) {
    throw new Error('Gemini returned insufficient content from the video.');
  }

  return text;
}

/**
 * Step 2: Structure SOP into skill using Gemini.
 */
export async function structureSop(rawSop, apiKey) {
  const prompt = SOP_TO_SKILL_PROMPT(rawSop);
  const text = await callGemini(apiKey, [{ parts: [{ text: prompt }] }], true);

  const result = JSON.parse(text);
  if (!result?.steps?.length) {
    throw new Error('Failed to structure skill from SOP.');
  }
  return result;
}

/**
 * Generate skill from text description using Gemini.
 */
export async function generateFromText(description, apiKey) {
  const prompt = TEXT_SKILL_PROMPT(description);
  const text = await callGemini(apiKey, [{ parts: [{ text: prompt }] }], true);

  const result = JSON.parse(text);
  if (!result?.steps?.length) {
    throw new Error('Failed to generate skill.');
  }
  return result;
}
