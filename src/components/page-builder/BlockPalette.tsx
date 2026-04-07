'use client';

const blockTypes = [
  { type: 'HERO', label: 'Hero', icon: '🎯', description: 'Large hero section with image, heading, and CTA' },
  { type: 'TEXT', label: 'Text', icon: '📝', description: 'Rich text content block' },
  { type: 'IMAGE', label: 'Image', icon: '🖼️', description: 'Single image with optional caption' },
  { type: 'GALLERY', label: 'Gallery', icon: '📸', description: 'Image grid gallery' },
  { type: 'VIDEO', label: 'Video', icon: '🎬', description: 'Embedded video (YouTube, Vimeo)' },
  { type: 'BEFORE_AFTER', label: 'Before/After', icon: '↔️', description: 'Compare two images side by side' },
  { type: 'FAQ', label: 'FAQ', icon: '❓', description: 'Frequently asked questions accordion' },
  { type: 'REVIEWS', label: 'Reviews', icon: '⭐', description: 'Customer reviews section' },
  { type: 'CTA', label: 'Call to Action', icon: '📢', description: 'Call to action with button' },
  { type: 'CUSTOM_HTML', label: 'Custom HTML', icon: '💻', description: 'Custom HTML/embed code' },
  { type: 'SPACER', label: 'Spacer', icon: '↕️', description: 'Empty space between blocks' },
];

interface BlockPaletteProps {
  onAddBlock: (type: string) => void;
}

export function BlockPalette({ onAddBlock }: BlockPaletteProps) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="font-semibold text-gray-900 mb-3 text-sm">Add Block</h3>
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
