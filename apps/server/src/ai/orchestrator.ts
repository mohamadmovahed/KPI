import Anthropic from '@anthropic-ai/sdk';
import {
  analyzeBalance,
  llmResponseSchema,
  runAssistant,
  type AiCard,
  type AiContext,
  type AiResponse,
  type BalanceReport,
  type KnowledgeBase,
} from '@kpi/shared';
import { z } from 'zod';
import { buildSystemPrompt, DOCUMENT_PROMPT } from './prompts';

const STRUCTURAL_CARDS: AiCard['kind'][] = ['driver-tree', 'balance', 'map-proposal', 'comparison'];

// JSON schema for structured outputs (mirrors llmResponseSchema minus engine-only cards).
const str = { type: 'string' } as const;
const strArr = { type: 'array', items: str } as const;
const cardSchemas = [
  {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'title', 'kpiId', 'why', 'indicator', 'complementIds'],
    properties: { kind: { type: 'string', enum: ['recommendation'] }, title: str, kpiId: str, why: str, indicator: { type: 'string', enum: ['leading', 'lagging'] }, complementIds: strArr },
  },
  {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'title', 'body'],
    properties: { kind: { type: 'string', enum: ['insight'] }, title: str, body: str, severity: { type: 'string', enum: ['info', 'warning', 'critical', 'positive'] } },
  },
  {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'title', 'items'],
    properties: { kind: { type: 'string', enum: ['checklist'] }, title: str, items: strArr },
  },
  {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'title', 'kpiIds'],
    properties: { kind: { type: 'string', enum: ['kpi-list'] }, title: str, kpiIds: strArr, note: str },
  },
];
const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'cards', 'followUps'],
  properties: { summary: str, cards: { type: 'array', items: { anyOf: cardSchemas } }, followUps: strArr },
};

const DOCUMENT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kpis', 'note'],
  properties: { kpis: strArr, note: str },
};
const documentSchema = z.object({ kpis: z.array(z.string()).max(200), note: z.string() });

export interface HistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface DocumentAnalysis {
  found: number;
  summary: string;
  items: { name: string; kpiId?: string; indicator?: 'leading' | 'lagging' }[];
  balance?: BalanceReport;
  engine: 'llm';
}

export type DocumentMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf';

export class AiUnavailableError extends Error {}

/**
 * AI layer. The deterministic engine always runs first (fast, offline-capable, grounded in the
 * KPI model). When an Anthropic key is configured, Claude refines the engine draft into a
 * consultant-grade answer using structured outputs; any failure falls back to the engine answer.
 */
export class AiOrchestrator {
  private client?: Anthropic;
  private system: string;

  constructor(
    private kb: KnowledgeBase,
    private opts: { apiKey?: string; model: string; log?: (msg: string, err?: unknown) => void },
  ) {
    if (opts.apiKey) this.client = new Anthropic({ apiKey: opts.apiKey, timeout: 60_000, maxRetries: 1 });
    this.system = buildSystemPrompt(kb);
  }

  get llmEnabled() {
    return Boolean(this.client);
  }

  async chat(message: string, ctx: AiContext, history: HistoryTurn[] = []): Promise<AiResponse> {
    const draft = runAssistant(this.kb, message, ctx);
    if (!this.client) return draft;
    try {
      return await this.refine(message, ctx, draft, history);
    } catch (err) {
      this.opts.log?.('LLM refinement failed; using engine answer', err);
      return draft;
    }
  }

  private referenceFor(message: string, draft: AiResponse, ctx: AiContext) {
    const ids = new Set<string>();
    this.kb.findMentions(message).forEach((k) => ids.add(k.id));
    for (const c of draft.cards) {
      if (c.kind === 'recommendation') ids.add(c.kpiId);
      if (c.kind === 'kpi-list') c.kpiIds.forEach((id) => ids.add(id));
    }
    this.kb.index.search(message, { limit: 6 }).hits.forEach((h) => ids.add(h.kpi.id));
    (ctx.kpiIds ?? []).forEach((id) => ids.add(id));
    return this.kb.require([...ids].slice(0, 14)).map((k) => ({
      id: k.id,
      name: k.name,
      definition: k.shortDefinition,
      formula: k.formula,
      indicator: k.indicator,
      perspective: k.perspective,
      levels: k.levels,
      direction: k.direction,
      drivers: k.drivers,
      leading: this.kb.graph.drivers(k.id).map((d) => d.id),
      outcomes: this.kb.graph.outcomes(k.id).map((d) => d.id),
      tradeoffs: k.tradeoffs.map((t) => t.text),
      gamingRisks: k.gamingRisks,
      benchmarks: k.benchmarks.map((b) => `${b.value}${b.illustrative ? ' (illustrative)' : ''}`),
    }));
  }

  private async refine(message: string, ctx: AiContext, draft: AiResponse, history: HistoryTurn[]): Promise<AiResponse> {
    const engineDraft = { intent: draft.intent, summary: draft.summary, cards: draft.cards.filter((c) => !STRUCTURAL_CARDS.includes(c.kind)) };
    const payload = {
      question: message,
      context: { industry: ctx.industry, project: ctx.projectName, projectKpiIds: ctx.kpiIds },
      engineDraft,
      reference: this.referenceFor(message, draft, ctx),
    };

    const messages: Anthropic.Beta.BetaMessageParam[] = [
      ...history.slice(-6).map((t) => ({ role: t.role, content: t.text }) as Anthropic.Beta.BetaMessageParam),
      { role: 'user', content: JSON.stringify(payload) },
    ];
    // The API requires the first message to be from the user.
    while (messages.length && messages[0].role !== 'user') messages.shift();

    const response = await this.client!.beta.messages.create({
      model: this.opts.model,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: this.system, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: RESPONSE_JSON_SCHEMA } },
      messages,
    });

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      throw new Error(`LLM stopped: ${response.stop_reason}`);
    }
    const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text;
    if (!text) throw new Error('LLM returned no text');
    const parsed = llmResponseSchema.parse(JSON.parse(text));

    // Guard against invented KPI ids.
    const known = (id: string) => this.kb.byId.has(id);
    const cards: AiCard[] = [];
    for (const c of parsed.cards) {
      if (c.kind === 'recommendation') {
        if (!known(c.kpiId)) continue;
        cards.push({ ...c, complementIds: c.complementIds.filter(known) });
      } else if (c.kind === 'kpi-list') {
        const kpiIds = c.kpiIds.filter(known);
        if (kpiIds.length) cards.push({ ...c, kpiIds });
      } else if (c.kind === 'insight' || c.kind === 'checklist') {
        cards.push(c);
      }
    }
    // Keep engine-computed structural cards (driver trees, balance reports, maps, comparisons).
    cards.push(...draft.cards.filter((c) => STRUCTURAL_CARDS.includes(c.kind)));

    return {
      intent: draft.intent,
      summary: parsed.summary,
      cards: cards.length ? cards : draft.cards,
      followUps: parsed.followUps.slice(0, 3),
      engine: 'llm',
      createdAt: new Date().toISOString(),
    };
  }

  /** Reads KPIs from a photo/screenshot/PDF and classifies them against the knowledge base. */
  async analyzeDocument(data: Buffer, mediaType: DocumentMediaType): Promise<DocumentAnalysis> {
    if (!this.client) throw new AiUnavailableError('Document analysis requires the AI service to be configured.');
    const b64 = data.toString('base64');
    const source: Anthropic.Beta.BetaContentBlockParam =
      mediaType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
        : { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } };

    const response = await this.client.beta.messages.create({
      model: this.opts.model,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: DOCUMENT_JSON_SCHEMA } },
      messages: [{ role: 'user', content: [source, { type: 'text', text: DOCUMENT_PROMPT }] }],
    });
    if (response.stop_reason === 'refusal') throw new AiUnavailableError('The document could not be analysed.');
    const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '{"kpis":[],"note":""}';
    const parsed = documentSchema.parse(JSON.parse(text));
    return this.classifyNames(parsed.kpis, parsed.note);
  }

  /** Maps free-text KPI names to the knowledge base and summarises the leading/lagging mix. */
  classifyNames(names: string[], note = ''): DocumentAnalysis {
    const items = names.map((name) => {
      const match = this.kb.findMentions(name)[0] ?? this.kb.index.search(name, { limit: 1 }).hits.find((h) => h.score >= 20)?.kpi;
      return { name, kpiId: match?.id, indicator: match?.indicator };
    });
    const matched = this.kb.require([...new Set(items.flatMap((i) => (i.kpiId ? [i.kpiId] : [])))]);
    const leading = items.filter((i) => i.indicator === 'leading').length;
    const lagging = items.filter((i) => i.indicator === 'lagging').length;
    const unknown = items.length - leading - lagging;
    const summary = items.length
      ? `I found ${items.length} KPI${items.length === 1 ? '' : 's'}. ${lagging} ${lagging === 1 ? 'is a lagging indicator' : 'are lagging indicators'}, while ${leading === 0 ? 'none are' : `only ${leading} ${leading === 1 ? 'is a' : 'are'}`} leading${leading === 1 ? ' indicator' : ' indicators'}${unknown ? ` (${unknown} not in the library yet)` : ''}.`
      : note || 'No KPIs were found in this document.';
    return {
      found: items.length,
      summary,
      items,
      balance: matched.length ? analyzeBalance(matched, { graph: this.kb.graph, library: this.kb.kpis }) : undefined,
      engine: 'llm',
    };
  }
}
