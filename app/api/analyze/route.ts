import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function POST(req: Request) {
    try {
        const { tags, annotations } = await req.json();

        if (!tags || !annotations) {
            return Response.json({ error: "Missing data" }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
            return Response.json({
                error: "Configuration Error: GOOGLE_GENERATIVE_AI_API_KEY is missing. Please add it to your .env.local file."
            }, { status: 500 });
        }

        console.log("API Key loaded:", apiKey.substring(0, 4) + "...");

        const prompt = `
      Analyze how this expert classifies sentence structures and summarize their cognitive process in 3 lines.
      
      Tags used: ${tags.map((t: any) => t.label).join(', ')}
      
      Annotations:
      ${annotations.map((a: any) => `- "${a.text_content}" (Tag: ${a.tag_label})`).join('\n')}
    `;

        try {
            console.log("Attempting with gemini-2.5-flash-lite...");
            const { text } = await generateText({
                model: google('gemini-2.5-flash-lite'),
                prompt: prompt,
            });
            return Response.json({ analysis: text });
        } catch (firstError: any) {
            console.warn("gemini-2.5-flash-lite failed:", firstError.message);
            console.log("Attempting fallback to gemini-3-pro-preview...");

            try {
                const { text } = await generateText({
                    model: google('gemini-3-pro-preview'),
                    prompt: prompt,
                });
                return Response.json({ analysis: text });
            } catch (secondError: any) {
                console.error("All models failed.");
                // Return both errors to help debugging
                throw new Error(`Primary model failed: ${firstError.message}. Fallback model failed: ${secondError.message}`);
            }
        }
    } catch (error: any) {
        console.error("AI Analysis Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
