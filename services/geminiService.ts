
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { AI_SYSTEM_INSTRUCTION } from '../constants';

// Safe access to API_KEY to prevent ReferenceError: process is not defined
const getApiKey = () => {
  try {
    // @ts-ignore
    return (typeof process !== 'undefined' && process.env?.API_KEY) ? process.env.API_KEY : '';
  } catch (e) {
    return '';
  }
};

export class GeminiService {
  private ai: GoogleGenAI;
  private audioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();

  constructor() {
    const apiKey = getApiKey();
    this.ai = new GoogleGenAI({ apiKey });
  }

  async sendTextMessage(prompt: string, selectedItem: string, history: any[] = []) {
    const chat = this.ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: `${AI_SYSTEM_INSTRUCTION}\n\nدر حال حاضر کاربر در حال مشاهده این پدیده است: "${selectedItem}". تمام پاسخ‌های شما باید با این موضوع مرتبط باشد.`,
      },
    });
    
    const response = await chat.sendMessage({ message: prompt });
    return response.text;
  }

  async generateSpeech(text: string): Promise<AudioBuffer> {
    if (!this.outputAudioContext) {
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: `بخوان با لحنی بسیار صمیمی و دوستانه برای یک اپلیکیشن نجوم: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error('Failed to generate speech');

    return await this.decodeAudioData(
      this.decode(base64Audio),
      this.outputAudioContext,
      24000,
      1
    );
  }

  async connectVoice(selectedItem: string, callbacks: {
    onMessage?: (text: string, isUser: boolean) => void;
    onInterrupted?: () => void;
    onError?: (error: any) => void;
  }) {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    if (!this.outputAudioContext) {
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          const source = this.audioContext!.createMediaStreamSource(stream);
          const scriptProcessor = this.audioContext!.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = this.createBlob(inputData);
            sessionPromise.then((session) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(this.audioContext!.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.outputTranscription) {
            callbacks.onMessage?.(message.serverContent.outputTranscription.text, false);
          }
          if (message.serverContent?.inputTranscription) {
            callbacks.onMessage?.(message.serverContent.inputTranscription.text, true);
          }

          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio && this.outputAudioContext) {
            this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
            const audioBuffer = await this.decodeAudioData(
              this.decode(base64Audio),
              this.outputAudioContext,
              24000,
              1
            );
            const source = this.outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.outputAudioContext.destination);
            source.addEventListener('ended', () => this.sources.delete(source));
            source.start(this.nextStartTime);
            this.nextStartTime += audioBuffer.duration;
            this.sources.add(source);
          }

          if (message.serverContent?.interrupted) {
            this.sources.forEach(s => s.stop());
            this.sources.clear();
            this.nextStartTime = 0;
            callbacks.onInterrupted?.();
          }
        },
        onerror: (e) => callbacks.onError?.(e),
        onclose: () => console.log('Session closed'),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: `${AI_SYSTEM_INSTRUCTION}\n\nدر حال حاضر کاربر در حال مشاهده این پدیده است: "${selectedItem}". تمام پاسخ‌های شما باید با این موضوع مرتبط باشد.`,
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      }
    });

    return sessionPromise;
  }

  private createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: this.encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  }

  private encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  public async decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }
}
