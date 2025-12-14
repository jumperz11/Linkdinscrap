import OpenAI from 'openai';
import { ProfileData } from '../bot/scraper';

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

export interface UserProfile {
    name: string;
    headline: string;
    industry?: string;
    about?: string;
    experience?: Array<{
        title: string;
        company: string;
        duration?: string;
    }>;
    skills?: string[];
}

export interface ScoreResult {
    score: number;
    reason: string;
    category: 'high' | 'medium' | 'low';
}

/**
 * Score a profile based on how well it matches the user's profile and search intent
 */
export async function scoreProfile(
    targetProfile: ProfileData,
    userProfile: UserProfile | null,
    searchKeywords: string
): Promise<ScoreResult> {
    try {
        const openai = getOpenAI();

        const prompt = `You are an expert at evaluating LinkedIn connections for professional networking.

USER'S PROFILE:
${userProfile ? `
Name: ${userProfile.name}
Headline: ${userProfile.headline}
Industry: ${userProfile.industry || 'Not specified'}
About: ${userProfile.about || 'Not specified'}
Experience: ${userProfile.experience?.map(e => `${e.title} at ${e.company}`).join(', ') || 'Not specified'}
` : 'Not analyzed yet'}

SEARCH KEYWORDS: ${searchKeywords}

TARGET PROFILE TO EVALUATE:
Name: ${targetProfile.name}
Headline: ${targetProfile.headline || 'Not specified'}
Company: ${targetProfile.company || 'Not specified'}
Location: ${targetProfile.location || 'Not specified'}
About: ${targetProfile.about || 'Not specified'}
Connections: ${targetProfile.connection_count || 'Unknown'}
Mutual Connections: ${targetProfile.mutual_connections || 0}

Score this profile from 0-100 based on:
1. Relevance to search keywords (40%)
2. Professional alignment with user (30%)
3. Networking potential (mutual connections, activity) (20%)
4. Seniority/influence level (10%)

Respond with ONLY a JSON object in this exact format:
{"score": <number>, "reason": "<brief explanation>", "category": "<high|medium|low>"}

Categories: high (75-100), medium (50-74), low (0-49)`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 200
        });

        const content = response.choices[0]?.message?.content || '';

        // Parse JSON response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            return {
                score: Math.min(100, Math.max(0, result.score)),
                reason: result.reason || 'AI evaluated',
                category: result.category || (result.score >= 75 ? 'high' : result.score >= 50 ? 'medium' : 'low')
            };
        }

        // Fallback if parsing fails
        return { score: 50, reason: 'Could not parse AI response', category: 'medium' };

    } catch (error: any) {
        console.error('AI scoring error:', error.message);
        // Fallback to keyword-based scoring
        return fallbackScoring(targetProfile, searchKeywords);
    }
}

/**
 * Fallback scoring when AI is not available
 */
function fallbackScoring(profile: ProfileData, keywords: string): ScoreResult {
    let score = 50;
    const reasons: string[] = [];

    const keywordList = keywords.toLowerCase().split(',').map(k => k.trim());
    const searchText = `${profile.headline} ${profile.about} ${profile.company}`.toLowerCase();

    for (const keyword of keywordList) {
        if (keyword && searchText.includes(keyword)) {
            score += 15;
            reasons.push(`Matches: ${keyword}`);
        }
    }

    if (profile.mutual_connections && profile.mutual_connections > 5) {
        score += 10;
        reasons.push(`${profile.mutual_connections} mutual connections`);
    }

    if (profile.connection_count && profile.connection_count > 500) {
        score += 5;
        reasons.push('Active networker');
    }

    score = Math.min(100, score);

    return {
        score,
        reason: reasons.join('; ') || 'Base score',
        category: score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low'
    };
}

export default {
    scoreProfile
};
