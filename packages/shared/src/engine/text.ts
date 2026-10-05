import { FUNCTIONS, INDICATORS, INDUSTRIES, LEVELS, PERSPECTIVES, THEMES, type TaxonomyEntry } from '../taxonomy';
import type { QueryInterpretation } from '../types';

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'company', 'do', 'for', 'from', 'give', 'how', 'i', 'in',
  'indicator', 'indicators', 'into', 'is', 'it', 'kpi', 'kpis', 'me', 'measure', 'measures', 'metric', 'metrics',
  'my', 'need', 'of', 'on', 'or', 'our', 'set', 'show', 'some', 'the', 'to', 'we', 'what', 'which', 'with', 'want',
  'good', 'best', 'key', 'performance', 'list', 'find', 'build', 'improve', 'improving', 'increase', 'reduce',
  'should', 'would', 'could', 'please', 'am', 'working', 'about', 'that', 'this', 'these', 'those', 'us',
]);

export const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9%&/+\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Very small suffix stemmer — enough to align "customers"/"customer", "retaining"/"retain". */
export const stem = (w: string): string => {
  if (w.length <= 3) return w;
  for (const suf of ['ations', 'ation', 'ings', 'ing', 'ies', 'ied', 'ers', 'er', 'es', 's', 'ed', 'ly']) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      const base = w.slice(0, -suf.length);
      return suf === 'ies' || suf === 'ied' ? `${base}y` : base;
    }
  }
  return w;
};

export const tokenize = (s: string, keepStopwords = false): string[] =>
  normalize(s)
    .split(/[\s/\-]+/)
    .filter((t) => t.length > 1 && (keepStopwords || !STOPWORDS.has(t)));

export const stems = (s: string): string[] => tokenize(s).map(stem);

const containsPhrase = (haystack: string, phrase: string): boolean => {
  const p = normalize(phrase);
  if (!p) return false;
  return new RegExp(`(^|\\s)${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s)`).test(haystack);
};

function detect<T extends string>(text: string, entries: TaxonomyEntry<T>[]): { ids: T[]; consumed: string[] } {
  const ids: T[] = [];
  const consumed: string[] = [];
  for (const e of entries) {
    // Longest cues first so "customer service" wins over "customer".
    const cue = [...e.cues].sort((a, b) => b.length - a.length).find((c) => containsPhrase(text, c));
    if (cue) {
      ids.push(e.id);
      consumed.push(...tokenize(cue, true));
    }
  }
  return { ids, consumed };
}

/** Extracts structured intent (industry, function, level, perspective, indicator, themes) from a natural-language query. */
export function interpretQuery(query: string): QueryInterpretation {
  const text = normalize(query);
  const industries = detect(text, INDUSTRIES);
  const functions = detect(text, FUNCTIONS);
  const levels = detect(text, LEVELS);
  const indicators = detect(text, INDICATORS);
  // "customer" alone is too generic to force a BSC perspective; only explicit perspective phrases count.
  const perspectives = detect(text, PERSPECTIVES.map((p) => ({ ...p, cues: p.cues.filter((c) => c.split(' ').length > 1) })));

  const themes: string[] = [];
  for (const [theme, cues] of Object.entries(THEMES)) {
    const cue = cues.find((c) => containsPhrase(text, c));
    if (cue) themes.push(theme);
  }

  const consumed = new Set(
    [...industries.consumed, ...functions.consumed, ...levels.consumed, ...indicators.consumed, ...perspectives.consumed].map(stem),
  );
  const terms = tokenize(text).filter((t) => !consumed.has(stem(t)));

  return {
    industries: industries.ids,
    functions: functions.ids,
    levels: levels.ids,
    perspectives: perspectives.ids,
    indicators: indicators.ids,
    themes,
    terms,
  };
}

/** Extracts numbers (supports "4%", "4.5", "4,5") in order of appearance. */
export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /(-?\d+(?:[.,]\d+)?)\s*(%|percent|pp)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = Number(m[1].replace(',', '.'));
    if (!Number.isNaN(n)) out.push(n);
  }
  return out;
}
