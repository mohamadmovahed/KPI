import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { newId, runAssistant, type AiContext, type ChatMessage } from '@kpi/shared';
import { persistStorage } from '@/lib/storage';
import { api, ApiError } from '@/services/api';
import { getKb } from '@/services/knowledgeBase';
import { useAuth } from './auth';
import { useNetwork } from './network';

export type AnswerSource = 'ai' | 'offline' | 'guest';

interface ChatState {
  messages: (ChatMessage & { source?: AnswerSource; error?: string })[];
  pending: boolean;
  /** Active project scope for balance reviews etc. */
  projectId?: string;
  setProject: (id?: string) => void;
  send: (text: string, context: AiContext) => Promise<void>;
  clear: () => void;
}

/**
 * AI conversation. Signed in + online → server AI (LLM-refined). Otherwise the on-device
 * deterministic engine answers and the UI clearly labels it, so the assistant stays useful in
 * meetings without connectivity. Conversations are cached locally for offline reference.
 */
export const useChat = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      pending: false,
      setProject: (projectId) => set({ projectId }),
      clear: () => set({ messages: [] }),

      async send(text, context) {
        const t = text.trim();
        if (!t || get().pending) return;
        const userMsg: ChatMessage = { id: newId('msg'), role: 'user', text: t, createdAt: new Date().toISOString() };
        set((s) => ({ messages: [...s.messages, userMsg], pending: true }));

        const signedIn = useAuth.getState().status === 'signedIn';
        const online = useNetwork.getState().online;
        const history = get()
          .messages.slice(-9, -1)
          .map((m) => ({ role: m.role, text: m.role === 'assistant' ? (m.response?.summary ?? m.text) : m.text }));

        let source: AnswerSource = signedIn ? (online ? 'ai' : 'offline') : 'guest';
        let error: string | undefined;
        let response;
        if (source === 'ai') {
          try {
            response = await api.chat(t, context, history);
          } catch (e) {
            error = e instanceof ApiError && e.status !== 0 ? e.message : 'The AI service is unreachable, so this answer comes from the offline engine.';
            source = 'offline';
          }
        }
        response ??= runAssistant(getKb(), t, context);

        const reply = { id: newId('msg'), role: 'assistant' as const, text: response.summary, response, source, error, createdAt: new Date().toISOString() };
        set((s) => ({ messages: [...s.messages, reply].slice(-120), pending: false }));
      },
    }),
    { name: 'chat', storage: persistStorage, partialize: ({ messages, projectId }) => ({ messages, projectId }) },
  ),
);
