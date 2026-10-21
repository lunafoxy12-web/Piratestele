import { GoogleGenAI } from '@google/genai';

export interface TranslationResult {
  originalText: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedText: string;
  detectedLanguage?: string;
  audioBase64?: string; // WAV 24kHz mono base64 audio
  latencyMs: number;
}

export class TranslationService {
  private static aiInstance: GoogleGenAI | null = null;

  private static getAi(): GoogleGenAI {
    if (!this.aiInstance) {
      const key = process.env.GEMINI_API_KEY;
      this.aiInstance = new GoogleGenAI({
        ...(key ? { apiKey: key } : {}),
        httpOptions: { timeout: 10000 },
      });
    }
    return this.aiInstance;
  }

  /**
   * Prebuilt voices for different target languages and personas
   */
  private static getVoiceForLanguage(lang: string, gender: 'male' | 'female' = 'female'): string {
    const l = lang.toLowerCase();
    if (l.includes('urdu') || l.includes('arabic') || l.includes('persian')) {
      return gender === 'female' ? 'Kore' : 'Fenrir';
    }
    if (l.includes('es') || l.includes('spanish') || l.includes('french')) {
      return gender === 'female' ? 'Aoede' : 'Puck';
    }
    return gender === 'female' ? 'Kore' : 'Puck';
  }

  /**
   * Translates text between two conversational languages preserving natural intent, tone, and context.
   */
  public static async translateText(params: {
    text: string;
    sourceLanguage: string;
    targetLanguage: string;
    autoDetectSource?: boolean;
    context?: string;
  }): Promise<{ translatedText: string; detectedLanguage?: string }> {
    const { text, sourceLanguage, targetLanguage, autoDetectSource, context } = params;
    if (!text || !text.trim()) {
      return { translatedText: '' };
    }

    const prompt = `You are an ultra-fast, professional live conversational interpreter bridging a real-time telephone call between two people who speak different languages.

Task:
Translate the following spoken message accurately, fluently, and naturally.
${autoDetectSource ? 'First detect the spoken language. Then translate into ' + targetLanguage + '.' : `From: ${sourceLanguage} -> Into: ${targetLanguage}`}

Rules:
1. Preserve conversational nuance, natural polite expressions, questions, answers, and context.
2. Return ONLY the translated spoken sentence in the target language.
3. Do NOT include any explanations, pronunciation guides, notes, conversational pleasantries like "Sure", or formatting like quotes or asterisks.
4. Output must be clean text ready to be fed directly into Text-to-Speech audio synthesizer.

${context ? `Conversation Context: ${context}` : ''}

Original Utterance:
"${text.trim()}"`;

    const ai = this.getAi();
    let responseText = '';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: prompt,
        config: {
          temperature: 0.2,
        },
      });
      responseText = response.text || '';
    } catch (err: any) {
      console.warn('[TRANSLATION FLASH-LITE FALLBACK]', err?.message);
      // Fallback to gemini-flash-lite-latest
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: prompt,
        config: {
          temperature: 0.2,
        },
      });
      responseText = fallbackResponse.text || '';
    }

    let clean = responseText.trim();
    // Strip markdown formatting if any
    clean = clean.replace(/^\*+|\*+$/g, '').replace(/^"|"$/g, '').trim();

    return {
      translatedText: clean,
      detectedLanguage: autoDetectSource ? sourceLanguage : undefined,
    };
  }

  /**
   * Synthesizes natural speech audio in the specified target language using Gemini TTS.
   * Returns base64-encoded WAV audio (24kHz mono).
   */
  public static async synthesizeSpeech(params: {
    text: string;
    language: string;
    voice?: string;
  }): Promise<string | undefined> {
    const { text, language, voice } = params;
    if (!text || !text.trim()) return undefined;

    const voiceName = voice || this.getVoiceForLanguage(language);

    try {
      const ai = this.getAi();
      const ttsPromise = ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [{ text: text.trim() }],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TTS request timed out')), 25000)
      );

      const response = await Promise.race([ttsPromise, timeoutPromise]);
      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return audioBase64;
    } catch (err: any) {
      console.warn(`[TTS SYNTHESIS WARNING] Error generating audio for "${text.slice(0, 30)}":`, err?.message || err);
      return undefined;
    }
  }

  /**
   * End-to-end Bidirectional Pipeline:
   * Translates incoming utterance and generates speech in the target language.
   */
  public static async processBidirectionalTurn(params: {
    text: string;
    sourceLanguage: string;
    targetLanguage: string;
    autoDetect?: boolean;
    speaker: 'agent' | 'customer';
    generateAudio?: boolean;
    context?: string;
  }): Promise<TranslationResult> {
    const startTime = Date.now();
    const { text, sourceLanguage, targetLanguage, autoDetect, speaker, generateAudio = true, context } = params;

    const { translatedText, detectedLanguage } = await this.translateText({
      text,
      sourceLanguage,
      targetLanguage,
      autoDetectSource: autoDetect,
      context,
    });

    let audioBase64: string | undefined;
    if (generateAudio && translatedText) {
      try {
        // Agent speaks -> Customer hears Customer Language
        // Customer speaks -> Agent hears Agent Language
        audioBase64 = await this.synthesizeSpeech({
          text: translatedText,
          language: targetLanguage,
          voice: speaker === 'agent' ? 'Kore' : 'Puck',
        });
      } catch (ttsErr: any) {
        console.warn('[TTS SYNTHESIS FALLBACK NOTE]', ttsErr?.message || ttsErr);
        // Translation still succeeds; audio can be played via browser TTS or retried
      }
    }

    const latencyMs = Date.now() - startTime;

    return {
      originalText: text,
      sourceLanguage,
      targetLanguage,
      translatedText,
      detectedLanguage,
      audioBase64,
      latencyMs,
    };
  }
}
