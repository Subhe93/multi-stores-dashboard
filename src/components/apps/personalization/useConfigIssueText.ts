'use client';

import { useTranslations } from 'next-intl';
import { locateConfigIssue, type ConfigIssue, type ConfigIssueArea } from '@/lib/personalization';

export interface ConfigIssueText {
  /** One friendly line per distinct issue ("Pricing: Prices cannot be negative."). */
  lines: string[];
  /** Area of the first issue, used to jump to the matching dialog tab. */
  firstArea?: ConfigIssueArea;
}

export interface ConfigIssueContext {
  /** Option names by `variant_option_config` index, to name product option issues. */
  optionNames?: readonly string[];
}

/**
 * Turns the `errors[]` of PERSONALIZATION_CONFIG_INVALID (`{path, code}`) into
 * friendly lines that name the dialog tab (and the field, sub-field or product
 * option when the path carries one) instead of raw validator codes.
 */
export function useConfigIssueText() {
  const t = useTranslations('customField');
  return (issues: readonly ConfigIssue[], context: ConfigIssueContext = {}): ConfigIssueText => {
    const lines: string[] = [];
    let firstArea: ConfigIssueArea | undefined;
    for (const issue of issues) {
      const { area, field, child, option, value } = locateConfigIssue(issue.path);
      firstArea ??= area;
      const codeKey = `configIssue.${issue.code ?? ''}`;
      const message = issue.code && t.has(codeKey) ? t(codeKey) : t('configIssue.generic');
      let line: string;
      if (area === 'productOptions') {
        const optionName = option !== undefined
          ? context.optionNames?.[option] || t('configIssueOptionNumber', { n: option + 1 })
          : undefined;
        line = optionName && value
          ? t('configIssueOptionValueLine', { option: optionName, value, message })
          : optionName
            ? t('configIssueOptionLine', { option: optionName, message })
            : t('configIssueLine', { area: t('configIssueArea.productOptions'), message });
      } else {
        const areaLabel = t(`tabs.${area}`);
        const subject = field !== undefined && child !== undefined
          ? t('configIssueChildOf', { field, n: child + 1 })
          : child !== undefined
            ? t('configIssueChild', { n: child + 1 })
            : field;
        line = subject
          ? t('configIssueFieldLine', { field: subject, area: areaLabel, message })
          : t('configIssueLine', { area: areaLabel, message });
      }
      if (!lines.includes(line)) lines.push(line);
    }
    return { lines, firstArea };
  };
}
