'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Plus, Trash2, GripVertical, Pencil } from 'lucide-react';

export interface CustomField {
  id?: string;
  name: string;
  type: string;
  is_required: boolean;
  placeholder?: string;
  options?: any;
  validation_rules?: any;
  linked_validation?: any;
  sort_order: number;
  translations?: { locale: string; label: string; placeholder?: string }[];
}

interface CustomFieldManagerProps {
  fields: CustomField[];
  onAdd: (field: Omit<CustomField, 'sort_order'>) => void;
  onUpdate?: (id: string, field: Omit<CustomField, 'sort_order'>) => void;
  onDelete: (id: string) => void;
}

const fieldTypes = [
  { value: 'TEXT', label: 'Text', description: 'Short text input (name, title)' },
  { value: 'TEXTAREA', label: 'Textarea', description: 'Long text (message, description)' },
  { value: 'NUMBER', label: 'Number', description: 'Numeric value (jersey number, year)' },
  { value: 'IMAGE', label: 'Image Upload', description: 'Customer uploads an image' },
  { value: 'FILE', label: 'File Upload', description: 'Customer uploads any file' },
  { value: 'SELECT', label: 'Dropdown', description: 'Choose from options (font, shape)' },
  { value: 'COLOR', label: 'Color Picker', description: 'Choose a color' },
  { value: 'DATE', label: 'Date', description: 'Pick a date (anniversary, birthday)' },
  { value: 'MULTI_IMAGE', label: 'Multiple Images', description: 'Upload several images' },
];

export function CustomFieldManager({ fields, onAdd, onUpdate, onDelete }: CustomFieldManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('TEXT');
  const [required, setRequired] = useState(false);
  const [labelEn, setLabelEn] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [maxLength, setMaxLength] = useState('');
  const [minLength, setMinLength] = useState('');
  const [pattern, setPattern] = useState('');
  const [allowedChars, setAllowedChars] = useState('');
  const [selectOptions, setSelectOptions] = useState('');
  // Linked validation
  const [linkedType, setLinkedType] = useState('');
  const [linkedTarget, setLinkedTarget] = useState('');
  const [linkedFillChar, setLinkedFillChar] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setName(''); setType('TEXT'); setRequired(false); setLabelEn(''); setLabelAr('');
    setPlaceholder(''); setMaxLength(''); setMinLength(''); setPattern('');
    setAllowedChars(''); setSelectOptions(''); setLinkedType(''); setLinkedTarget(''); setLinkedFillChar('');
  };

  const openEdit = (field: CustomField) => {
    setEditingId(field.id || null);
    setName(field.name);
    setType(field.type);
    setRequired(field.is_required);
    setLabelEn(field.translations?.find(t => t.locale === 'en')?.label || field.name);
    setLabelAr(field.translations?.find(t => t.locale === 'ar')?.label || '');
    setPlaceholder(field.placeholder || '');
    setMaxLength(field.validation_rules?.max_length ? String(field.validation_rules.max_length) : '');
    setMinLength(field.validation_rules?.min_length ? String(field.validation_rules.min_length) : '');
    setPattern(field.validation_rules?.pattern || '');
    setAllowedChars(field.validation_rules?.allowed_chars || '');
    setSelectOptions(Array.isArray(field.options) ? field.options.join(', ') : '');
    setLinkedType(field.linked_validation?.type || '');
    setLinkedTarget(field.linked_validation?.target_field_id || '');
    setLinkedFillChar(field.linked_validation?.fill_char || '');
    setShowForm(true);
  };

  const handleSave = () => {
    if (!name || !labelEn) return;

    const validationRules: any = {};
    if (maxLength) validationRules.max_length = parseInt(maxLength);
    if (minLength) validationRules.min_length = parseInt(minLength);
    if (pattern) validationRules.pattern = pattern;
    if (allowedChars) validationRules.allowed_chars = allowedChars;

    const linkedValidation = linkedType && linkedTarget ? {
      type: linkedType,
      target_field_id: linkedTarget,
      fill_char: linkedFillChar || undefined,
    } : undefined;

    const fieldData = {
      name,
      type,
      is_required: required,
      placeholder: placeholder || undefined,
      options: selectOptions ? selectOptions.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      validation_rules: Object.keys(validationRules).length > 0 ? validationRules : undefined,
      linked_validation: linkedValidation,
      translations: [
        { locale: 'en', label: labelEn, placeholder: placeholder || undefined },
        ...(labelAr ? [{ locale: 'ar', label: labelAr }] : []),
      ],
    };

    if (editingId && onUpdate) {
      onUpdate(editingId, fieldData);
    } else {
      onAdd(fieldData);
    }

    resetForm();
    setShowForm(false);
  };

  const typeIcon = (t: string) => fieldTypes.find(ft => ft.value === t)?.label || t;

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Customer Input Fields</CardTitle>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Fields that customers fill when ordering (name to engrave, image to print, etc.)
            </p>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="w-3 h-3 mr-1" /> Add Field
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {fields.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            No customer input fields defined.
          </div>
        ) : (
          <div className="space-y-2">
            {fields.map((field, i) => (
              <div key={field.id || i} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg border group">
                <GripVertical className="w-4 h-4 text-zinc-300 cursor-grab shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{field.translations?.[0]?.label || field.name}</p>
                    <Badge variant="secondary" className="text-[9px] shrink-0">{typeIcon(field.type)}</Badge>
                    {field.is_required && <Badge className="text-[9px] shrink-0">Required</Badge>}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">{field.name}</p>
                  {field.validation_rules && (
                    <div className="flex gap-1 mt-1">
                      {field.validation_rules.max_length && <Badge variant="outline" className="text-[8px]">Max: {field.validation_rules.max_length}</Badge>}
                      {field.validation_rules.pattern && <Badge variant="outline" className="text-[8px]">Pattern: {field.validation_rules.pattern}</Badge>}
                      {field.validation_rules.allowed_chars && <Badge variant="outline" className="text-[8px]">Chars: {field.validation_rules.allowed_chars}</Badge>}
                    </div>
                  )}
                  {field.linked_validation && (
                    <Badge variant="outline" className="text-[8px] mt-1 border-blue-200 text-blue-600">
                      Linked: {field.linked_validation.type} → {field.linked_validation.target_field_id}
                      {field.linked_validation.fill_char && ` (fill: ${field.linked_validation.fill_char})`}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500" onClick={() => openEdit(field)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => field.id && onDelete(field.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add Field Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit' : 'Add'} Customer Input Field</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2 max-h-[70vh] overflow-y-auto">
            {/* Basic */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3">Basic Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Internal Name *</Label>
                  <Input className="h-8 text-sm" placeholder="e.g. print_name, custom_image" value={name} onChange={e => setName(e.target.value)} />
                  <p className="text-[9px] text-muted-foreground">Used in code — no spaces, lowercase</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Field Type *</Label>
                  <SearchableSelect value={type} onChange={setType} options={fieldTypes} />
                </div>
              </div>
            </div>

            {/* Labels */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3">Labels (shown to customer)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">English Label *</Label>
                  <Input className="h-8 text-sm" placeholder="Name to Print" value={labelEn} onChange={e => setLabelEn(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Arabic Label</Label>
                  <Input className="h-8 text-sm" dir="rtl" placeholder="الاسم المطلوب" value={labelAr} onChange={e => setLabelAr(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Placeholder</Label>
                  <Input className="h-8 text-sm" placeholder="Enter your name..." value={placeholder} onChange={e => setPlaceholder(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Select Options */}
            {type === 'SELECT' && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Dropdown Options</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Options (comma separated)</Label>
                  <Input className="h-8 text-sm" placeholder="Classic, Modern, Script, Serif" value={selectOptions} onChange={e => setSelectOptions(e.target.value)} />
                </div>
              </div>
            )}

            {/* Validation */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3">Validation Rules</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Length</Label>
                  <Input type="number" className="h-8 text-sm" placeholder="15" value={maxLength} onChange={e => setMaxLength(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Min Length</Label>
                  <Input type="number" className="h-8 text-sm" placeholder="1" value={minLength} onChange={e => setMinLength(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5 mt-3">
                <Label className="text-xs">Validation Pattern</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { label: 'English only', pattern: '^[a-zA-Z\\s]+$', chars: 'a-zA-Z\\s' },
                    { label: 'English + ❤', pattern: '^[a-zA-Z❤\\s]+$', chars: 'a-zA-Z❤\\s' },
                    { label: 'UPPERCASE only', pattern: '^[A-Z\\s]+$', chars: 'A-Z\\s' },
                    { label: 'lowercase only', pattern: '^[a-z\\s]+$', chars: 'a-z\\s' },
                    { label: 'Numbers only', pattern: '^[0-9]+$', chars: '0-9' },
                    { label: 'English + Numbers', pattern: '^[a-zA-Z0-9\\s]+$', chars: 'a-zA-Z0-9\\s' },
                    { label: 'Arabic only', pattern: '^[\\u0600-\\u06FF\\s]+$', chars: '\\u0600-\\u06FF\\s' },
                    { label: 'Arabic + English', pattern: '^[a-zA-Z\\u0600-\\u06FF\\s]+$', chars: 'a-zA-Z\\u0600-\\u06FF\\s' },
                    { label: 'Email format', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', chars: '' },
                    { label: 'Phone (+xxx)', pattern: '^\\+?[0-9\\s\\-()]+$', chars: '0-9+\\-()\\s' },
                    { label: 'No special chars', pattern: '^[a-zA-Z0-9\\s]+$', chars: 'a-zA-Z0-9\\s' },
                    { label: 'Custom', pattern: '', chars: '' },
                  ].map(preset => (
                    <button key={preset.label} type="button"
                      onClick={() => { setPattern(preset.pattern); if (preset.chars) setAllowedChars(preset.chars); }}
                      className={`text-[10px] px-2 py-1 rounded-md border transition ${pattern === preset.pattern ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-zinc-50'}`}>
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Regex Pattern</Label>
                    <Input className="h-7 text-xs font-mono" placeholder='^[a-zA-Z]+$' value={pattern} onChange={e => setPattern(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Allowed Characters</Label>
                    <Input className="h-7 text-xs font-mono" placeholder='a-zA-Z❤' value={allowedChars} onChange={e => setAllowedChars(e.target.value)} />
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input type="checkbox" className="rounded accent-primary" checked={required} onChange={e => setRequired(e.target.checked)} />
                <span className="text-xs font-medium">Required — customer must fill this field</span>
              </label>
            </div>

            {/* Linked Validation */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3">Linked Validation (optional)</p>
              <p className="text-[10px] text-muted-foreground mb-2">Link this field to another field for cross-validation (e.g. couple bracelet — both names same length)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Validation Type</Label>
                  <SearchableSelect value={linkedType} onChange={setLinkedType} placeholder="None" options={[
                    { value: '', label: 'None' },
                    { value: 'equal_length', label: 'Equal Length', description: 'Both fields same character count' },
                    { value: 'max_combined', label: 'Max Combined', description: 'Combined length limit' },
                  ]} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Target Field Name</Label>
                  <Input className="h-8 text-sm font-mono" placeholder="name_2" value={linkedTarget} onChange={e => setLinkedTarget(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fill Character</Label>
                  <Input className="h-8 text-sm" placeholder="❤" value={linkedFillChar} onChange={e => setLinkedFillChar(e.target.value)} />
                  <p className="text-[9px] text-muted-foreground">Auto-fill to match length</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!name || !labelEn}>{editingId ? 'Save Changes' : 'Add Field'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
