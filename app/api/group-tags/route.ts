import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function POST(req: Request) {
    try {
        const { tags } = await req.json();

        if (!tags || !Array.isArray(tags)) {
            return Response.json({ error: "Invalid tags data" }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
            return Response.json({ error: "API Key missing" }, { status: 500 });
        }

        const prompt = `
      Group the following tags into semantically similar categories.
      Create at most 6 groups.
      If a tag doesn't fit well into the main groups, put it in an "Etc" group.
      
      Tags: ${tags.join(', ')}
      
      Return ONLY a JSON object with this structure:
      {
        "groups": [
          { "name": "Group Name", "tags": ["tag1", "tag2"] }
        ]
      }
    `;

        try {
            const { text } = await generateText({
                model: google('gemini-2.5-flash-lite'),
                prompt: prompt,
            });

            // Clean up markdown code blocks if present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanText);

            return Response.json(result);
        } catch (error: any) {
            console.error("Gemini grouping failed:", error);
            // Fallback or error
            return Response.json({ error: "AI grouping failed", details: error.message }, { status: 500 });
        }
    } catch (error: any) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
