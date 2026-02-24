// @ts-ignore
import { translate } from '@vitalets/google-translate-api';

export async function translateText(text: string, targetLanguageCode: string): Promise<string> {
    try {
        const result = await translate(text, { to: targetLanguageCode });
        return result.text;
    } catch (error: any) {
        console.error('Translation error:', error);
        throw error;
    }
}
