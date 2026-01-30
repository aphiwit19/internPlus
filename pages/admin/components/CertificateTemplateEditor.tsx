import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Stage, Layer, Text as KonvaText, Image as KonvaImage, Rect } from 'react-konva';
import { doc, updateDoc } from 'firebase/firestore';

import { firestoreDb } from '@/firebase';
import { Language } from '@/types';

export type CertificateRequestType = 'COMPLETION' | 'RECOMMENDATION';

export type TemplateFieldKey =
  | 'internName'
  | 'position'
  | 'department'
  | 'internPeriod'
  | 'systemId'
  | 'issueDate';

export type TemplateTextSource = { type: 'static'; text: string } | { type: 'field'; key: TemplateFieldKey };

export type TemplateTextBlock = {
  id: string;
  kind: 'text';
  x: number;
  y: number;
  width?: number;
  align?: 'left' | 'center' | 'right';
  fontSize: number;
  fontWeight?: 400 | 600 | 700 | 800;
  color: string;
  opacity?: number;
  source: TemplateTextSource;
};

export type CertificateTemplateLayout = {
  canvas: { width: number; height: number };
  blocks: TemplateTextBlock[];
};

export type CertificateTemplateDoc = {
  name?: string;
  type?: CertificateRequestType;
  backgroundPath?: string;
  backgroundUrl?: string;
  active?: boolean;
  isActive?: boolean;
  layout?: CertificateTemplateLayout;
  layoutVersion?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  updatedBy?: string;
};

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function useHtmlImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = url;
  }, [url]);
  return image;
}

const FIELD_LABELS: Record<TemplateFieldKey, string> = {
  internName: 'Intern Name',
  position: 'Position',
  department: 'Department',
  internPeriod: 'Internship Period',
  systemId: 'System ID',
  issueDate: 'Issue Date',
};

type Props = {
  lang: Language;
  templateId: string;
  template: CertificateTemplateDoc;
  backgroundUrl: string | null;
  onBack: () => void;
};

export default function CertificateTemplateEditor({ lang, templateId, template, backgroundUrl, onBack }: Props) {
  const t = useMemo(
    () =>
      ({
        EN: {
          title: 'Template Editor',
          back: 'Back',
          addStatic: 'Add Text',
          addField: 'Add Field',
          save: 'Save',
          delete: 'Delete',
          properties: 'Properties',
          text: 'Text',
          field: 'Field',
          fontSize: 'Font Size',
          fontWeight: 'Weight',
          color: 'Color',
          align: 'Align',
          left: 'Left',
          center: 'Center',
          right: 'Right',
          noneSelected: 'Select an item to edit',
        },
        TH: {
          title: 'ออกแบบ Template',
          back: 'ย้อนกลับ',
          addStatic: 'เพิ่มข้อความ',
          addField: 'เพิ่ม Field',
          save: 'บันทึก',
          delete: 'ลบ',
          properties: 'ตั้งค่า',
          text: 'ข้อความ',
          field: 'ฟิลด์',
          fontSize: 'ขนาดตัวอักษร',
          fontWeight: 'น้ำหนัก',
          color: 'สี',
          align: 'จัดชิด',
          left: 'ซ้าย',
          center: 'กลาง',
          right: 'ขวา',
          noneSelected: 'เลือกชิ้นงานเพื่อแก้ไข',
        },
      }[lang]),
    [lang],
  );

  const image = useHtmlImage(backgroundUrl);

  const initialLayout = useMemo<CertificateTemplateLayout>(() => {
    const w = image?.naturalWidth ?? template.layout?.canvas.width ?? 2480;
    const h = image?.naturalHeight ?? template.layout?.canvas.height ?? 3508;
    return {
      canvas: { width: w, height: h },
      blocks: template.layout?.blocks ?? [],
    };
  }, [image?.naturalHeight, image?.naturalWidth, template.layout?.blocks, template.layout?.canvas.height, template.layout?.canvas.width]);

  const [layout, setLayout] = useState<CertificateTemplateLayout>(initialLayout);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLayout(initialLayout);
    setSelectedId(null);
  }, [initialLayout]);

  const selected = useMemo(() => layout.blocks.find((b) => b.id === selectedId) ?? null, [layout.blocks, selectedId]);

  const stageScale = useMemo(() => {
    const maxW = 900;
    const maxH = 640;
    const sx = maxW / layout.canvas.width;
    const sy = maxH / layout.canvas.height;
    return Math.min(1, sx, sy);
  }, [layout.canvas.height, layout.canvas.width]);

  const displayText = useCallback((block: TemplateTextBlock) => {
    if (block.source.type === 'static') return block.source.text;
    return `{{${block.source.key}}}`;
  }, []);

  const updateBlock = useCallback((id: string, patch: Partial<TemplateTextBlock>) => {
    setLayout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }, []);

  const addStaticText = () => {
    const block: TemplateTextBlock = {
      id: makeId(),
      kind: 'text',
      x: Math.round(layout.canvas.width * 0.1),
      y: Math.round(layout.canvas.height * 0.2),
      fontSize: Math.round(layout.canvas.width * 0.03),
      fontWeight: 700,
      color: '#111827',
      align: 'left',
      source: { type: 'static', text: 'New text\n(second line)' },
    };
    setLayout((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
    setSelectedId(block.id);
  };

  const addFieldText = () => {
    const block: TemplateTextBlock = {
      id: makeId(),
      kind: 'text',
      x: Math.round(layout.canvas.width * 0.1),
      y: Math.round(layout.canvas.height * 0.3),
      fontSize: Math.round(layout.canvas.width * 0.035),
      fontWeight: 800,
      color: '#111827',
      align: 'left',
      source: { type: 'field', key: 'internName' },
    };
    setLayout((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
    setSelectedId(block.id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setLayout((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== selectedId) }));
    setSelectedId(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const ref = doc(firestoreDb, 'certificateTemplates', templateId);
      const nextVersion = (template.layoutVersion ?? 0) + 1;
      await updateDoc(ref, {
        layout,
        layoutVersion: nextVersion,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.title}</div>
          <div className="text-xl font-black text-slate-900 truncate">{template.name ?? templateId}</div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-black"
          >
            {t.back}
          </button>
          <button
            type="button"
            onClick={addStaticText}
            className="px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black"
          >
            {t.addStatic}
          </button>
          <button
            type="button"
            onClick={addFieldText}
            className="px-4 py-2 rounded-2xl bg-blue-600 text-white text-xs font-black"
          >
            {t.addField}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-black disabled:opacity-50"
          >
            {t.save}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="bg-white border border-slate-100 rounded-[2rem] p-4 shadow-sm overflow-hidden">
            <div className="w-full flex justify-center">
              <Stage
                width={layout.canvas.width * stageScale}
                height={layout.canvas.height * stageScale}
                onMouseDown={(e) => {
                  const clickedOnEmpty = e.target === e.target.getStage();
                  if (clickedOnEmpty) setSelectedId(null);
                }}
              >
                <Layer scaleX={stageScale} scaleY={stageScale}>
                  {image ? (
                    <KonvaImage x={0} y={0} width={layout.canvas.width} height={layout.canvas.height} image={image} />
                  ) : (
                    <Rect x={0} y={0} width={layout.canvas.width} height={layout.canvas.height} fill="#f8fafc" />
                  )}

                  {layout.blocks.map((b) => (
                    <KonvaText
                      key={b.id}
                      x={b.x}
                      y={b.y}
                      width={b.width}
                      text={displayText(b)}
                      fontSize={b.fontSize}
                      fontStyle={b.fontWeight && b.fontWeight >= 700 ? 'bold' : 'normal'}
                      fill={b.color}
                      opacity={b.opacity ?? 1}
                      align={b.align ?? 'left'}
                      draggable
                      onDragEnd={(e) => updateBlock(b.id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) })}
                      onMouseDown={() => setSelectedId(b.id)}
                      listening
                    />
                  ))}

                  {selected ? (
                    <Rect
                      x={selected.x - 8}
                      y={selected.y - 8}
                      width={(selected.width ?? 400) + 16}
                      height={Math.max(80, selected.fontSize * 2) + 16}
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dash={[10, 6]}
                      listening={false}
                    />
                  ) : null}
                </Layer>
              </Stage>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t.properties}</div>

            {!selected ? (
              <div className="text-sm text-slate-500 font-bold">{t.noneSelected}</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-black text-slate-600 mb-2">{selected.source.type === 'static' ? t.text : t.field}</div>

                  {selected.source.type === 'static' ? (
                    <textarea
                      value={selected.source.text}
                      onChange={(e) =>
                        updateBlock(selected.id, {
                          source: { type: 'static', text: e.target.value },
                        })
                      }
                      rows={6}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-800"
                    />
                  ) : (
                    <select
                      value={selected.source.key}
                      onChange={(e) =>
                        updateBlock(selected.id, {
                          source: { type: 'field', key: e.target.value as TemplateFieldKey },
                        })
                      }
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-800"
                    >
                      {Object.keys(FIELD_LABELS).map((k) => (
                        <option key={k} value={k}>
                          {FIELD_LABELS[k as TemplateFieldKey]}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-black text-slate-600 mb-2">{t.fontSize}</div>
                    <input
                      type="number"
                      value={selected.fontSize}
                      onChange={(e) => updateBlock(selected.id, { fontSize: Math.max(6, Number(e.target.value) || 0) })}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-800"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-black text-slate-600 mb-2">{t.fontWeight}</div>
                    <select
                      value={String(selected.fontWeight ?? 400)}
                      onChange={(e) => updateBlock(selected.id, { fontWeight: Number(e.target.value) as 400 | 600 | 700 | 800 })}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-800"
                    >
                      <option value="400">400</option>
                      <option value="600">600</option>
                      <option value="700">700</option>
                      <option value="800">800</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-black text-slate-600 mb-2">{t.color}</div>
                    <input
                      type="color"
                      value={selected.color}
                      onChange={(e) => updateBlock(selected.id, { color: e.target.value })}
                      className="w-full h-12 px-2 py-2 rounded-2xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-black text-slate-600 mb-2">{t.align}</div>
                    <select
                      value={selected.align ?? 'left'}
                      onChange={(e) => updateBlock(selected.id, { align: e.target.value as 'left' | 'center' | 'right' })}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-800"
                    >
                      <option value="left">{t.left}</option>
                      <option value="center">{t.center}</option>
                      <option value="right">{t.right}</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={removeSelected}
                  className="w-full px-4 py-3 rounded-2xl bg-rose-50 text-rose-700 border border-rose-100 text-xs font-black"
                >
                  {t.delete}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
