/**
 * Voice input abstraction (Phase 2).
 *
 * The assistant UI already renders a microphone button bound to this service. Phase 1 ships the
 * `unavailable` implementation; Phase 2 plugs in on-device speech recognition (e.g.
 * `expo-speech-recognition`, which needs a development build) without touching the UI.
 * Permission strings are already declared in app.json.
 */
export interface VoiceInputService {
  readonly available: boolean;
  /** Starts listening; resolves with the final transcript. */
  listen(opts: { lang?: string; onPartial?: (text: string) => void }): Promise<string>;
  stop(): void;
}

class UnavailableVoiceInput implements VoiceInputService {
  readonly available = false;
  async listen(): Promise<string> {
    throw new Error('Voice input arrives in Phase 2. Use your keyboard’s dictation button in the meantime.');
  }
  stop() {}
}

export let voiceInput: VoiceInputService = new UnavailableVoiceInput();

export function registerVoiceInput(impl: VoiceInputService) {
  voiceInput = impl;
}
