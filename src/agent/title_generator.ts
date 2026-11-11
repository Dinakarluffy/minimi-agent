/**
 * Generates concise, natural chat titles similar to ChatGPT, Claude, and Gemini.
 */
export async function generateChatTitle(firstPrompt: string, apiKey?: string): Promise<string> {
  const fallbackTitle = createFallbackTitle(firstPrompt);

  if (!apiKey || !apiKey.trim() || firstPrompt.trim().length < 5) {
    return fallbackTitle;
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${encodeURIComponent(
      apiKey.trim()
    )}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000); // 4-second timeout for title

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Generate a concise 3-5 word title for a chat that begins with this user prompt:
"${firstPrompt.trim()}"

Rules:
- Output ONLY the title text
- No quotes, no markdown, no leading or trailing punctuation
- Maximum 35 characters`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 20,
        },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      return fallbackTitle;
    }

    const data = (await response.json()) as any;
    const rawTitle = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!rawTitle) {
      return fallbackTitle;
    }

    // Clean up quotes or extraneous characters
    const clean = rawTitle
      .replace(/^["'`\s]+|["'`\s]+$/g, "")
      .replace(/[\r\n]+/g, " ")
      .trim();

    return clean.length > 0 && clean.length <= 40 ? clean : fallbackTitle;
  } catch {
    return fallbackTitle;
  }
}

export function createFallbackTitle(text: string): string {
  const clean = text.replace(/[\r\n\t]+/g, " ").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "New Conversation";
  const title = words.slice(0, 5).join(" ");
  return title.length > 35 ? title.slice(0, 32) + "..." : title;
}
