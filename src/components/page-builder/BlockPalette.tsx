'use client';

import { useTranslations } from 'next-intl';

interface BlockPaletteProps {
  onAddBlock: (type: string) => void;
}

export function BlockPalette({ onAddBlock }: BlockPaletteProps) {
  const t = useTranslations('components');
  const blockTypes = [
    { type: 'HERO', label: t('blockHero'), icon: '🎯' },
    { type: 'TEXT', label: t('blockText'), icon: '📝' },
    { type: 'IMAGE', label: t('blockImage'), icon: '🖼️' },
    { type: 'GALLERY', label: t('blockGallery'), icon: '📸' },
    { type: 'VIDEO', label: t('blockVideo'), icon: '🎬' },
    { type: 'BEFORE_AFTER', label: t('blockBeforeAfter'), icon: '↔️' },
    { type: 'FAQ', label: t('blockFaq'), icon: '❓' },
    { type: 'REVIEWS', label: t('blockReviews'), icon: '⭐' },
    { type: 'CTA', label: t('blockCta'), icon: '📢' },
    { type: 'CUSTOM_HTML', label: t('blockCustomHtml'), icon: '💻' },
    { type: 'SPACER', label: t('blockSpacer'), icon: '↕️' },
  ];
  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="font-semibold text-gray-900 mb-3 text-sm">{t('addBlock')}</h3>
      <div className="grid grid-cols-2 gap-2">
        {blockTypes.map((block) => (
          <button
            key={block.type}
            onClick={() => onAddBlock(block.type)}
            className="flex items-center gap-2 p-2.5 rounded-lg border text-left hover:bg-blue-50 hover:border-blue-300 transition text-xs"
          >
            <span className="text-lg">{block.icon}</span>
            <div>
              <div className="font-medium text-gray-900">{block.label}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
