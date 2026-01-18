import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function POST(req: Request) {
    try {
        const { tags } = await req.json();

        if (!tags || !Array.isArray(tags)) {
            return Response.json({ error: "Invalid tags data" }, { status: 400 });
        }

        const prompt = `
      You are a data analyst helper. 
      Group the following tags into semantic clusters. 
      Tags that mean the same thing or are very similar should be grouped together.
      Give each group a representative "Display Name".
      
      Tags: ${tags.join(', ')}
      
      Output JSON format:
      {
        "groups": [
          { "name": "Group Name", "tags": ["tag1", "tag2"] }
        ]
      }
    `;

        // Use the fallback logic similar to analyze route if needed, but for now stick to primary
        // Actually, let's use the robust logic we established: gemini-2.5-flash-lite
        try {
            const { text } = await generateText({
                model: google('gemini-2.5-flash-lite'),
                prompt: prompt,
            });

            // Clean up markdown code blocks if present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleanText);

            return Response.json(data);
        } catch (error: any) {
            console.warn("gemini-2.5-flash-lite failed:", error.message);
            // Fallback
            const { text } = await generateText({
                model: google('gemini-3-pro-preview'),
                prompt: prompt,
            });
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleanText);
            return Response.json(data);
        }

    } catch (error: any) {
        console.error("Tag Grouping Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
