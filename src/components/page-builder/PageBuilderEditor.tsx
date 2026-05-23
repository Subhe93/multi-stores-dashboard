'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BlockPalette } from './BlockPalette';

interface Block {
  id: string;
  type: string;
  settings: any;
  sort_order: number;
  translations: { locale: string; content: any }[];
}

interface PageBuilderEditorProps {
  pageId: string;
  initialBlocks?: Block[];
}

export function PageBuilderEditor({ pageId, initialBlocks = [] }: PageBuilderEditorProps) {
  const t = useTranslations('components');
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);

  const addBlock = (type: string) => {
    const newBlock: Block = {
      id: `temp-${Date.now()}`,
      type,
      settings: {},
      sort_order: blocks.length,
      translations: [{ locale: 'en', content: {} }],
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (
      (direction === 'up' && idx === 0) ||
      (direction === 'down' && idx === blocks.length - 1)
    ) return;

    const newBlocks = [...blocks];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newBlocks[idx], newBlocks[swapIdx]] = [newBlocks[swapIdx]!, newBlocks[idx]!];
    setBlocks(newBlocks);
  };

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Main editor area */}
      <div className="col-span-2 space-y-3">
        {blocks.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <p className="text-gray-400 mb-2">{t('noBlocksYet')}</p>
            <p className="text-sm text-gray-400">{t('addBlocksFromPalette')}</p>
          </div>
        ) : (
          blocks.map((block, idx) => (
            <div key={block.id} className="bg-white rounded-xl border p-4 group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {block.type}
                  </span>
                  <span className="text-xs text-gray-400">{t('blockNumber', { number: idx + 1 })}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => moveBlock(block.id, 'up')}
                    className="p-1 hover:bg-gray-100 rounded text-xs"
                    disabled={idx === 0}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveBlock(block.id, 'down')}
                    className="p-1 hover:bg-gray-100 rounded text-xs"
                    disabled={idx === blocks.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeBlock(block.id)}
                    className="p-1 hover:bg-red-50 text-red-500 rounded text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Block content editor placeholder */}
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500">
                {t('editBlockContent', { type: block.type.toLowerCase() })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sidebar — Block palette */}
      <div className="space-y-4">
        <BlockPalette onAddBlock={addBlock} />

        <button className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          {t('savePage')}
        </button>
      </div>
    </div>
  );
}
