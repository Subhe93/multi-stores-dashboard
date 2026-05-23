'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TiptapLink from '@tiptap/extension-link';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Undo,
  Redo,
  Link,
  Unlink,
  Minus,
  Code,
  Type,
  RemoveFormatting,
  FileCode,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  content?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  /** Writing direction of the edited content (follows the content locale, not the UI). */
  dir?: 'ltr' | 'rtl';
}

export function RichTextEditor({
  content = '',
  onChange,
  placeholder,
  dir = 'ltr',
}: RichTextEditorProps) {
  const t = useTranslations('components');
  const resolvedPlaceholder = placeholder ?? t('richTextPlaceholder');
  const [showSource, setShowSource] = useState(false);
  const [sourceHtml, setSourceHtml] = useState('');

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: resolvedPlaceholder }),
      TiptapLink.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-600 underline' } }),
    ],
    content,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-55 px-4 py-3 focus:outline-none [&_p.is-editor-empty:first-child::before]:text-muted-foreground [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:float-start [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:pointer-events-none',
      },
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt(t('enterUrl'), editor.getAttributes('link').href);
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const toggleSource = useCallback(() => {
    if (!editor) return;
    if (!showSource) { setSourceHtml(editor.getHTML()); }
    else { editor.commands.setContent(sourceHtml); }
    setShowSource(!showSource);
  }, [editor, showSource, sourceHtml]);

  useEffect(() => {
    if (!editor || editor.getHTML() === content) return;
    editor.commands.setContent(content || '');
  }, [content, editor]);

  if (!editor) return null;

  const Btn = ({ onClick, active, disabled, title, children }: {
    onClick: () => void; active?: boolean; disabled?: boolean; title?: string; children: React.ReactNode;
  }) => (
    <Button type="button" variant="ghost" size="icon" onClick={onClick} disabled={disabled} title={title}
      className={cn('h-7 w-7', active && 'bg-muted text-foreground')}>
      {children}
    </Button>
  );

  const Sep = () => <Separator orientation="vertical" className="h-5 mx-0.5" />;

  return (
    <div className="rounded-md border border-input overflow-hidden">
      <div className="flex items-center gap-0.5 p-1 border-b bg-zinc-50/50 flex-wrap">
        {/* Text formatting */}
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title={t('rteBold')}>
          <Bold className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title={t('rteItalic')}>
          <Italic className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title={t('rteStrikethrough')}>
          <Strikethrough className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title={t('rteInlineCode')}>
          <Code className="w-3.5 h-3.5" />
        </Btn>

        <Sep />

        {/* Headings */}
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title={t('rteHeading1')}>
          <Heading1 className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title={t('rteHeading2')}>
          <Heading2 className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title={t('rteHeading3')}>
          <Heading3 className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title={t('rteParagraph')}>
          <Type className="w-3.5 h-3.5" />
        </Btn>

        <Sep />

        {/* Lists & blocks */}
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title={t('rteBulletList')}>
          <List className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title={t('rteNumberedList')}>
          <ListOrdered className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title={t('rteBlockquote')}>
          <Quote className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title={t('rteCodeBlock')}>
          <FileCode className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title={t('rteHorizontalRule')}>
          <Minus className="w-3.5 h-3.5" />
        </Btn>

        <Sep />

        {/* Link */}
        <Btn onClick={setLink} active={editor.isActive('link')} title={t('rteInsertLink')}>
          <Link className="w-3.5 h-3.5" />
        </Btn>
        {editor.isActive('link') && (
          <Btn onClick={() => editor.chain().focus().unsetLink().run()} title={t('rteRemoveLink')}>
            <Unlink className="w-3.5 h-3.5" />
          </Btn>
        )}

        <Sep />

        {/* Actions */}
        <Btn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title={t('rteClearFormatting')}>
          <RemoveFormatting className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title={t('rteUndo')}>
          <Undo className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title={t('rteRedo')}>
          <Redo className="w-3.5 h-3.5" />
        </Btn>

        <div className="flex-1" />

        <Button type="button" variant={showSource ? 'secondary' : 'ghost'} size="sm" onClick={toggleSource} className="h-6 text-[10px] px-2">
          {'</>'}
        </Button>
      </div>

      {showSource ? (
        <textarea value={sourceHtml} onChange={(e) => setSourceHtml(e.target.value)}
          dir="ltr"
          className="w-full min-h-55 px-4 py-3 text-xs font-mono bg-zinc-950 text-green-400 focus:outline-none" spellCheck={false} />
      ) : (
        <div dir={dir}>
          <EditorContent editor={editor} />
        </div>
      )}

      <div className="flex items-center justify-end px-3 py-1.5 border-t bg-zinc-50/50 text-[10px] text-muted-foreground">
        <span>{showSource ? t('rteHtmlSource') : t('rteRichText')}</span>
      </div>
    </div>
  );
}
