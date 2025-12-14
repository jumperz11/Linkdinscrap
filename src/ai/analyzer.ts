import OpenAI from 'openai';
import { Page } from 'playwright';
import { getPage } from '../bot/auth';
import { scrapeProfile, ProfileData } from '../bot/scraper';
import { userProfileQueries } from '../db/sqlite';
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
 * Navigate to and analyze the user's own LinkedIn profile
 */
export async function analyzeUserProfile(): Promise<UserProfile | null> {
    const page = getPage();
    if (!page) {
        throw new Error('Browser not initialized');
    }

    try {
        // Navigate to own profile
        await page.goto('https://www.linkedin.com/in/me/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        // Scrape profile data
        const profileData = await scrapeProfile(page);

        // Extract industry from profile (if visible)
        let industry = '';
        try {
            industry = await page.$eval(
                '.pv-text-details__right-panel .text-body-small',
                el => el.textContent?.trim() || ''
            ) || '';
        } catch (e) {
            // Industry not visible
        }

        // Use AI to summarize and extract key info
        const userProfile = await enrichUserProfile(profileData, industry);

        // Save to database
        userProfileQueries.save({
            linkedin_url: profileData.linkedin_url,
            name: profileData.name,
            headline: profileData.headline,
            industry: userProfile.industry,
            data: userProfile
        });

        console.log('✓ User profile analyzed:', userProfile.name);

        return userProfile;

    } catch (error: any) {
        console.error('Failed to analyze user profile:', error.message);
        return null;
    }
}

/**
 * Use AI to enrich user profile data
 */
async function enrichUserProfile(profile: ProfileData, industry: string): Promise<UserProfile> {
    try {
        const openai = getOpenAI();

        const prompt = `Analyze this LinkedIn profile and extract key professional information:

Name: ${profile.name}
Headline: ${profile.headline || 'Not specified'}
About: ${profile.about || 'Not specified'}
Experience: ${profile.experience?.map(e => `${e.title} at ${e.company}`).join(', ') || 'Not specified'}

Return a JSON object with:
{
  "name": "<name>",
  "headline": "<headline>",
  "industry": "<inferred industry>",
  "expertise": ["<key skill 1>", "<key skill 2>", "<key skill 3>"],
  "targetRoles": ["<ideal connection role 1>", "<ideal connection role 2>"],
  "summary": "<one sentence professional summary>"
}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 300
        });

        const content = response.choices[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const enriched = JSON.parse(jsonMatch[0]);
            return {
                name: profile.name,
                headline: profile.headline || '',
                industry: enriched.industry || industry,
                about: enriched.summary || profile.about,
                experience: profile.experience,
                skills: enriched.expertise || []
            };
        }
    } catch (error) {
        console.error('AI enrichment failed, using raw data');
    }

    // Fallback
    return {
        name: profile.name,
        headline: profile.headline || '',
        industry: industry,
        about: profile.about,
        experience: profile.experience
    };
}

/**
 * Get saved user profile from database
 */
export function getSavedUserProfile(): UserProfile | null {
    const saved = userProfileQueries.get();
    if (saved && saved.data) {
        return saved.data as UserProfile;
    }
    return null;
}

export default {
    analyzeUserProfile,
    getSavedUserProfile
};
