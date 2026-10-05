import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { newId, runAssistant, type AiContext, type ChatMessage } from '@kpi/shared';
import { persistStorage } from '@/lib/storage';
import { getKb } from '@/services/knowledgeBase';

interface ChatState {
  messages: ChatMessage[];
  /** Active project scope for balance reviews etc. */
  projectId?: string;
  setProject: (id?: string) => void;
  send: (text: string, context: AiContext) => void;
  clear: () => void;
}

/** Assistant conversation. Answers come from the on-device engine and are kept locally. */
export const useChat = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      setProject: (projectId) => set({ projectId }),
      clear: () => set({ messages: [] }),

      send(text, context) {
        const t = text.trim();
        if (!t) return;
        const now = new Date().toISOString();
        const response = runAssistant(getKb(), t, context);
        const userMsg: ChatMessage = { id: newId('msg'), role: 'user', text: t, createdAt: now };
        const reply: ChatMessage = { id: newId('msg'), role: 'assistant', text: response.summary, response, createdAt: now };
        set({ messages: [...get().messages, userMsg, reply].slice(-120) });
      },
    }),
    { name: 'chat', storage: persistStorage, partialize: ({ messages, projectId }) => ({ messages, projectId }) },
  ),
);
