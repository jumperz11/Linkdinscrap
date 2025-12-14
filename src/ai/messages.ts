import OpenAI from 'openai';
import { ProfileData } from '../bot/scraper';
import { UserProfile } from './scorer';

// Initialize OpenAI client (lazy)
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
    if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable not set');
        }
        openaiClient = new OpenAI({ apiKey });
    }
    return openaiClient;
}

/**
 * Generate a personalized connection message
 */
export async function generateConnectionMessage(
    targetProfile: ProfileData,
    userProfile: UserProfile | null,
    maxLength: number = 300
): Promise<string> {
    try {
        const openai = getOpenAI();

        const prompt = `You are an expert at writing LinkedIn connection requests that get accepted.

SENDER'S PROFILE:
${userProfile ? `
Name: ${userProfile.name}
Headline: ${userProfile.headline}
Industry: ${userProfile.industry || 'Not specified'}
` : 'Professional looking to connect'}

RECIPIENT'S PROFILE:
Name: ${targetProfile.name}
Headline: ${targetProfile.headline || 'Professional'}
Company: ${targetProfile.company || 'Not specified'}
About: ${targetProfile.about ? targetProfile.about.substring(0, 200) : 'Not specified'}

Write a SHORT, personalized connection request that:
1. Is genuine and not salesy
2. Mentions something specific about THEIR profile
3. Explains why you want to connect
4. Is warm but professional
5. Is under ${maxLength} characters

Do NOT:
- Use generic phrases like "I came across your profile"
- Be too formal or corporate
- Ask for anything in the first message
- Use buzzwords or jargon

Return ONLY the message text, nothing else.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 150
        });

        let message = response.choices[0]?.message?.content?.trim() || '';

        // Remove quotes if present
        message = message.replace(/^["']|["']$/g, '');

        // Truncate if needed
        if (message.length > maxLength) {
            message = message.substring(0, maxLength - 3) + '...';
        }

        return message || generateFallbackMessage(targetProfile);

    } catch (error: any) {
        console.error('AI message generation error:', error.message);
        return generateFallbackMessage(targetProfile);
    }
}

/**
 * Fallback message when AI is not available
 */
function generateFallbackMessage(profile: ProfileData): string {
    const firstName = profile.name.split(' ')[0];
    const templates = [
        `Hi ${firstName}! Your background${profile.company ? ` at ${profile.company}` : ''} caught my attention. Would love to connect and exchange ideas.`,
        `Hi ${firstName}, I noticed we might have shared interests based on your profile. Let's connect!`,
        `Hi ${firstName}! Really impressed by your experience${profile.headline ? ` in ${profile.headline.split(' ')[0]}` : ''}. Would be great to connect.`
    ];

    return templates[Math.floor(Math.random() * templates.length)];
}

export default {
    generateConnectionMessage
};
