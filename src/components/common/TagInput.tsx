'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ tags, onChange, placeholder = 'Type and press Enter' }: TagInputProps) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const val = input.trim();
    if (!val || tags.includes(val)) return;
    onChange([...tags, val]);
    setInput('');
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1.5 min-h-[36px] border rounded-md bg-background focus-within:ring-2 focus-within:ring-ring">
      {tags.map((tag, i) => (
        <Badge key={i} variant="outline" className="text-xs gap-1 pr-0.5 bg-blue-50 text-blue-700 border-blue-200">
          {tag}
          <button type="button" onClick={() => removeTag(i)} className="hover:text-red-500 transition p-0.5">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      <input
        className="flex-1 min-w-[100px] text-sm bg-transparent outline-none placeholder:text-muted-foreground px-1"
        placeholder={tags.length === 0 ? placeholder : ''}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); addTag(); }
          if (e.key === 'Backspace' && !input && tags.length > 0) {
            removeTag(tags.length - 1);
          }
        }}
        onBlur={() => { if (input.trim()) addTag(); }}
      />
    </div>
  );
}
