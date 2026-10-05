import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Share } from 'react-native';
import { INDICATOR_LABEL, LEVEL_LABEL, PERSPECTIVE_LABEL, summaryToHtml, summaryToText, type ExecutiveSummary, type Kpi } from '@kpi/shared';

/** Quick-share formats for mobile: native share sheet, PDF, clipboard, email. */
export const share = {
  async text(message: string, title?: string) {
    await Share.share({ message, title });
  },

  async copy(text: string) {
    await Clipboard.setStringAsync(text);
  },

  async email(subject: string, body: string) {
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    await Linking.openURL(url);
  },

  /** Renders HTML to a PDF with the OS print engine and opens the share sheet. */
  async pdf(html: string, dialogTitle: string) {
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
    } else {
      await Print.printAsync({ uri });
    }
  },

  summaryText: summaryToText,
  summaryHtml: summaryToHtml,
};

export function kpiCardText(k: Kpi): string {
  return [
    k.name,
    `${INDICATOR_LABEL[k.indicator]} · ${PERSPECTIVE_LABEL[k.perspective]} · ${k.levels.map((l) => LEVEL_LABEL[l]).join('/')}`,
    '',
    k.shortDefinition,
    '',
    `Formula: ${k.formula}`,
    k.formulaExample ? `Example: ${k.formulaExample}` : '',
    '',
    `Why it matters: ${k.purpose}`,
    k.gamingRisks.length ? `Watch out: ${k.gamingRisks[0]}` : '',
    '',
    '— Shared from KPI Consultant',
  ]
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n');
}

export const shareSummary = {
  text: (s: ExecutiveSummary) => share.text(summaryToText(s), s.title),
  pdf: (s: ExecutiveSummary) => share.pdf(summaryToHtml(s), s.title),
  copy: (s: ExecutiveSummary) => share.copy(summaryToText(s)),
  email: (s: ExecutiveSummary) => share.email(s.title, summaryToText(s)),
};
