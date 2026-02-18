import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Text as KonvaText, Image as KonvaImage, Rect, Transformer } from 'react-konva';
import Konva from 'konva';
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
  rotation?: number;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: 400 | 600 | 700 | 800;
  color: string;
  opacity?: number;
  source: TemplateTextSource;
};

export type CertificateTemplateLayout = {
  canvas: { width: number; height: number };
  background?: {
    cx: number;
    cy: number;
    scale: number;
    rotation: number;
  };
  blocks: TemplateTextBlock[];
};

export type CertificateTemplateDoc = {
  name?: string;
  type?: CertificateRequestType;
  backgroundPath?: string;
  backgroundUrl?: string;
  isDraft?: boolean;
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

const FIELD_KEYS_FOR_EDITOR = (Object.keys(FIELD_LABELS) as TemplateFieldKey[]).filter((k) => k !== 'systemId');

const FONT_FAMILIES = [
  'Arial',
  'Times New Roman',
  'Georgia',
  'Tahoma',
  'Verdana',
  'TH Sarabun New',
  'Cormorant Garamond',
  'Cormorant Garamond Light',
  'Cormorant Garamond Regular',
  'Cormorant Garamond Medium',
  'Cormorant Garamond SemiBold',
  'Cormorant Garamond Bold',
  'DM Serif Display',
  'Yeseva One',
] as const;

const FONT_FAMILIES_FORCE_400 = new Set<string>([
  'Cormorant Garamond Light',
  'Cormorant Garamond Regular',
  'Cormorant Garamond Medium',
  'Cormorant Garamond SemiBold',
  'Cormorant Garamond Bold',
  'DM Serif Display',
  'Yeseva One',
]);

type Props = {
  lang: Language;
  templateId: string;
  template: CertificateTemplateDoc;
  backgroundUrl: string | null;
  onBack: () => void;
  onSave?: (layout: CertificateTemplateLayout, previewPng: Blob | null, name: string) => Promise<void>;
};

export default function CertificateTemplateEditor({ lang, templateId, template, backgroundUrl, onBack, onSave }: Props) {
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
          scale: 'Scale',
          rotation: 'Rotation',
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
          scale: 'ขนาด',
          rotation: 'การหมุน',
          noneSelected: 'เลือกชิ้นงานเพื่อแก้ไข',
        },
      }[lang]),
    [lang],
  );

  const image = useHtmlImage(backgroundUrl);
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const textNodeRefs = useRef<Record<string, Konva.Text | null>>({});
  const bgNodeRef = useRef<Konva.Image | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [layout, setLayout] = useState<CertificateTemplateLayout>({
    canvas: { width: 2480, height: 3508 },
    background: undefined,
    blocks: [],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<'block' | 'background' | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameDraft, setNameDraft] = useState((template.name ?? '').toString());
  const [isExportingPreview, setIsExportingPreview] = useState(false);
  const [windowH, setWindowH] = useState<number>(() => (typeof window !== 'undefined' ? window.innerHeight : 900));
  const [viewportW, setViewportW] = useState<number>(0);

  const dataUrlToBlob = useCallback((dataUrl: string): Blob | null => {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const match = parts[0]?.match(/data:(.*?);base64/);
    const mime = match?.[1] ?? 'image/png';
    const bin = atob(parts[1] ?? '');
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }, []);

  const initialLayout = useMemo<CertificateTemplateLayout>(() => {
    const w = image?.naturalWidth ?? template.layout?.canvas.width ?? 2480;
    const h = image?.naturalHeight ?? template.layout?.canvas.height ?? 3508;
    const bg = (template.layout as any)?.background as CertificateTemplateLayout['background'] | undefined;
    return {
      canvas: { width: w, height: h },
      background: {
        cx: bg?.cx ?? w / 2,
        cy: bg?.cy ?? h / 2,
        scale: bg?.scale ?? 1,
        rotation: bg?.rotation ?? 0,
      },
      blocks: template.layout?.blocks ?? [],
    };
  }, [image?.naturalHeight, image?.naturalWidth, template.layout?.blocks, template.layout?.canvas.height, template.layout?.canvas.width]);

  useEffect(() => {
    setLayout(initialLayout);
    setSelectedId(null);
    setSelectedKind(null);
  }, [initialLayout]);

  useEffect(() => {
    setNameDraft((template.name ?? '').toString());
  }, [template.name]);

  useEffect(() => {
    const fontsApi: any = (document as any)?.fonts;
    if (!fontsApi || typeof fontsApi.ready?.then !== 'function') return;

    const families = Array.from(
      new Set(
        layout.blocks
          .map((b) => (typeof (b as any)?.fontFamily === 'string' ? String((b as any).fontFamily) : ''))
          .filter(Boolean),
      ),
    );

    let cancelled = false;
    (async () => {
      // Ensure fonts are loaded before drawing; Konva won't always repaint automatically when fonts arrive.
      await Promise.all(
        families.map(async (ff) => {
          if (typeof fontsApi.load !== 'function') return;
          // Prefer the full font shorthand, which some browsers use for matching.
          try {
            await fontsApi.load(`normal 400 20px "${ff}"`);
            await fontsApi.load(`italic 400 20px "${ff}"`);
          } catch {
            // ignore
          }
        }),
      );

      try {
        await fontsApi.ready;
      } catch {
        // ignore
      }

      for (const ff of families) {
        try {
          if (typeof fontsApi.check === 'function' && !fontsApi.check(`20px "${ff}"`)) {
            console.warn('CertificateTemplateEditor:fontNotAvailable', ff);
          }
        } catch {
          // ignore
        }
      }
      if (cancelled) return;

      const stage = stageRef.current;
      if (!stage) return;
      for (const layer of stage.getLayers()) {
        layer.batchDraw();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [layout.blocks]);

  useEffect(() => {
    const onResize = () => setWindowH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setViewportW(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    setViewportW(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const selected = useMemo(() => layout.blocks.find((b) => b.id === selectedId) ?? null, [layout.blocks, selectedId]);
  const background = layout.background ?? { cx: layout.canvas.width / 2, cy: layout.canvas.height / 2, scale: 1, rotation: 0 };

  const stageScale = useMemo(() => {
    const paddingW = 32;
    const maxW = Math.max(320, (viewportW || 0) - paddingW);
    const maxH = Math.max(320, Math.floor(windowH * 0.65));
    const sx = maxW / layout.canvas.width;
    const sy = maxH / layout.canvas.height;
    return Math.min(1, sx, sy);
  }, [layout.canvas.height, layout.canvas.width, viewportW, windowH]);

  const displayText = useCallback((block: TemplateTextBlock) => {
    if (block.source.type === 'static') return block.source.text;
    return `{{${block.source.key}}}`;
  }, []);

  const measureTextWidth = useCallback((text: string, fontSize: number, fontFamily: string) => {
    const t = new Konva.Text({ text, fontSize, fontFamily, fontStyle: 'normal' });
    return t.width();
  }, []);

  const updateBlock = useCallback((id: string, patch: Partial<TemplateTextBlock>) => {
    setLayout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }, []);

  const updateBackground = useCallback((patch: Partial<NonNullable<CertificateTemplateLayout['background']>>) => {
    setLayout((prev) => {
      const cur = prev.background ?? {
        cx: prev.canvas.width / 2,
        cy: prev.canvas.height / 2,
        scale: 1,
        rotation: 0,
      };

      const nextBg = {
        ...cur,
        ...patch,
        scale: Math.max(0.05, Number((patch as any)?.scale ?? cur.scale) || cur.scale),
        rotation: Number((patch as any)?.rotation ?? cur.rotation) || 0,
        cx: Number((patch as any)?.cx ?? cur.cx) || cur.cx,
        cy: Number((patch as any)?.cy ?? cur.cy) || cur.cy,
      };

      const scaleRatio = cur.scale ? nextBg.scale / cur.scale : 1;
      const rotDeltaDeg = nextBg.rotation - cur.rotation;
      const rotDelta = (rotDeltaDeg * Math.PI) / 180;
      const cos = Math.cos(rotDelta);
      const sin = Math.sin(rotDelta);

      const nextBlocks = prev.blocks.map((b) => {
        const vx = b.x - cur.cx;
        const vy = b.y - cur.cy;
        const svx = vx * scaleRatio;
        const svy = vy * scaleRatio;
        const rvx = svx * cos - svy * sin;
        const rvy = svx * sin + svy * cos;

        const nextX = nextBg.cx + rvx;
        const nextY = nextBg.cy + rvy;

        return {
          ...b,
          x: Math.round(nextX),
          y: Math.round(nextY),
          width: b.width != null ? Math.max(20, Math.round(b.width * scaleRatio)) : undefined,
          fontSize: Math.max(6, Math.round((b.fontSize ?? 20) * scaleRatio)),
          rotation: Math.round(((b.rotation ?? 0) + rotDeltaDeg) * 100) / 100,
        };
      });

      return { ...prev, background: nextBg, blocks: nextBlocks };
    });
  }, []);

  const addStaticText = () => {
    const baseX = Math.round(layout.canvas.width * 0.1);
    const baseY = Math.round(layout.canvas.height * 0.2);
    const maxY = layout.blocks.reduce((acc, b) => Math.max(acc, b.y), 0);
    const nextY = Math.min(layout.canvas.height - 60, Math.max(baseY, maxY + 60));

    const fontSize = 20;
    const fontFamily = 'Arial';
    const block: TemplateTextBlock = {
      id: makeId(),
      kind: 'text',
      x: baseX,
      y: nextY,
      width: Math.round(layout.canvas.width * 0.6),
      rotation: 0,
      fontSize,
      fontFamily,
      color: '#111827',
      source: { type: 'static', text: 'New text\n(second line)' },
    };
    setLayout((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
    setSelectedId(null);
    setSelectedKind(null);
  };

  const addFieldText = () => {
    const baseX = Math.round(layout.canvas.width * 0.1);
    const baseY = Math.round(layout.canvas.height * 0.3);
    const maxY = layout.blocks.reduce((acc, b) => Math.max(acc, b.y), 0);
    const nextY = Math.min(layout.canvas.height - 60, Math.max(baseY, maxY + 60));

    const fontSize = 20;
    const fontFamily = 'Arial';
    const placeholder = '{{internName}}';
    const measuredWidth = Math.ceil(measureTextWidth(placeholder, fontSize, fontFamily));

    const block: TemplateTextBlock = {
      id: makeId(),
      kind: 'text',
      x: baseX,
      y: nextY,
      width: Math.max(20, Math.min(layout.canvas.width - baseX, measuredWidth + 8)),
      rotation: 0,
      fontSize,
      fontFamily,
      color: '#111827',
      source: { type: 'field', key: 'internName' },
    };
    setLayout((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
    setSelectedId(null);
    setSelectedKind(null);
  };

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const node =
      selectedKind === 'background'
        ? bgNodeRef.current
        : selectedKind === 'block' && selectedId
          ? textNodeRefs.current[selectedId]
          : null;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, selectedKind, layout.blocks, layout.background]);

  const removeSelected = () => {
    if (!selectedId) return;
    setLayout((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== selectedId) }));
    setSelectedId(null);
    setSelectedKind(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const normalizedLayout: CertificateTemplateLayout = {
        ...layout,
        background: {
          cx: Number((layout.background as any)?.cx ?? layout.canvas.width / 2) || layout.canvas.width / 2,
          cy: Number((layout.background as any)?.cy ?? layout.canvas.height / 2) || layout.canvas.height / 2,
          scale: Math.max(0.05, Number((layout.background as any)?.scale ?? 1) || 1),
          rotation: Number((layout.background as any)?.rotation ?? 0) || 0,
        },
        blocks: layout.blocks.map((b) => {
          const { align: _align, ...rest } = b as any;
          return { ...rest, rotation: (b as any).rotation ?? 0 } as TemplateTextBlock;
        }),
      };

      let previewPng: Blob | null = null;
      try {
        const canExportPreview = (() => {
          if (!backgroundUrl) return true;
          if (backgroundUrl.startsWith('blob:')) return true;
          if (backgroundUrl.startsWith('data:')) return true;
          try {
            const u = new URL(backgroundUrl);
            // If background is cross-origin and CORS isn't configured, canvas becomes tainted.
            return u.origin === window.location.origin;
          } catch {
            return true;
          }
        })();

        if (canExportPreview) {
          setIsExportingPreview(true);
          await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
          const stage = stageRef.current;
          if (stage && typeof stage.toDataURL === 'function') {
            const dataUrl = stage.toDataURL({ pixelRatio: 2 });
            previewPng = dataUrlToBlob(dataUrl);
          }
        } else {
          previewPng = null;
        }
      } catch {
        previewPng = null;
      } finally {
        setIsExportingPreview(false);
      }

      if (onSave) {
        await onSave(normalizedLayout, previewPng, nameDraft.trim() || (template.name ?? templateId));
      } else {
        const ref = doc(firestoreDb, 'certificateTemplates', templateId);
        const nextVersion = (template.layoutVersion ?? 0) + 1;
        await updateDoc(ref, {
          layout: normalizedLayout,
          layoutVersion: nextVersion,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.title}</div>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            className="mt-1 w-full max-w-md px-4 py-2 rounded-2xl border border-slate-200 text-sm font-black text-slate-900"
            placeholder={lang === 'TH' ? 'ชื่อ Template' : 'Template name'}
          />
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
          <div className="bg-white border border-slate-100 rounded-[2rem] p-4 shadow-sm">
            <div ref={viewportRef} className="w-full flex justify-center p-3 bg-slate-50 rounded-2xl">
              <Stage
                ref={stageRef}
                width={layout.canvas.width * stageScale}
                height={layout.canvas.height * stageScale}
                onMouseDown={(e) => {
                  const clickedOnEmpty = e.target === e.target.getStage();
                  if (clickedOnEmpty) {
                    setSelectedId(null);
                    setSelectedKind(null);
                  }
                }}
              >
                <Layer scaleX={stageScale} scaleY={stageScale}>
                  {image ? (
                    <KonvaImage
                      ref={(node) => {
                        bgNodeRef.current = node;
                      }}
                      x={background.cx}
                      y={background.cy}
                      offsetX={layout.canvas.width / 2}
                      offsetY={layout.canvas.height / 2}
                      width={layout.canvas.width}
                      height={layout.canvas.height}
                      scaleX={background.scale}
                      scaleY={background.scale}
                      rotation={background.rotation}
                      image={image}
                      draggable={selectedKind === 'background'}
                      listening
                      onMouseDown={() => {
                        setSelectedId(null);
                        setSelectedKind('background');
                      }}
                      onDragEnd={(e) => {
                        updateBackground({ cx: Math.round(e.target.x()), cy: Math.round(e.target.y()) });
                      }}
                      onTransformEnd={(e) => {
                        const node = e.target as unknown as Konva.Image;
                        const sx = node.scaleX();
                        const nextScale = Math.max(0.05, Number(sx) || 1);
                        const nextRotation = Math.round(node.rotation());
                        const nextCx = Math.round(node.x());
                        const nextCy = Math.round(node.y());

                        updateBackground({ cx: nextCx, cy: nextCy, scale: nextScale, rotation: nextRotation });
                      }}
                    />
                  ) : (
                    <Rect x={0} y={0} width={layout.canvas.width} height={layout.canvas.height} fill="#f8fafc" />
                  )}

                  {layout.blocks.map((b) => (
                    <KonvaText
                      key={b.id}
                      ref={(node) => {
                        textNodeRefs.current[b.id] = node;
                      }}
                      x={b.x}
                      y={b.y}
                      width={b.width}
                      text={displayText(b)}
                      fontSize={b.fontSize}
                      fontFamily={b.fontFamily ?? 'Arial'}
                      fontStyle="normal"
                      fill={b.color}
                      opacity={b.opacity ?? 1}
                      rotation={b.rotation ?? 0}
                      align="left"
                      draggable
                      onTransformEnd={(e) => {
                        const node = e.target as unknown as Konva.Text;
                        const scaleX = node.scaleX();
                        const scaleY = node.scaleY();

                        const nextWidth = Math.max(20, Math.round((node.width() || 0) * scaleX));
                        const nextFontSize = Math.max(6, Math.round((b.fontSize ?? 16) * scaleY));
                        const nextRotation = Math.round(node.rotation());

                        node.scaleX(1);
                        node.scaleY(1);

                        updateBlock(b.id, {
                          x: Math.round(node.x()),
                          y: Math.round(node.y()),
                          width: nextWidth,
                          fontSize: nextFontSize,
                          rotation: nextRotation,
                        });
                      }}
                      onDragEnd={(e) => {
                        updateBlock(b.id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) });
                        setSelectedId(null);
                        setSelectedKind(null);
                      }}
                      onMouseDown={() => {
                        setSelectedId(b.id);
                        setSelectedKind('block');
                      }}
                      listening
                    />
                  ))}

                  <Transformer
                    ref={transformerRef}
                    rotateEnabled
                    keepRatio={selectedKind === 'background'}
                    enabledAnchors={
                      selectedKind === 'background'
                        ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
                        : ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right']
                    }
                    boundBoxFunc={(oldBox, newBox) => {
                      if (newBox.width < 20) return oldBox;
                      return newBox;
                    }}
                  />
                </Layer>
              </Stage>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t.properties}</div>

            {!selected && selectedKind !== 'background' ? (
              <div className="text-sm text-slate-500 font-bold">{t.noneSelected}</div>
            ) : (
              <div className="space-y-4">
                {selectedKind === 'background' ? (
                  <>
                    <div>
                      <div className="text-xs font-black text-slate-600 mb-2">{t.scale}</div>
                      <input
                        type="number"
                        value={background.scale}
                        step={0.05}
                        onChange={(e) => updateBackground({ scale: Math.max(0.05, Number(e.target.value) || 0.05) })}
                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-800"
                      />
                    </div>

                    <div>
                      <div className="text-xs font-black text-slate-600 mb-2">{t.rotation}</div>
                      <input
                        type="number"
                        value={background.rotation}
                        onChange={(e) => updateBackground({ rotation: Number(e.target.value) || 0 })}
                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-800"
                      />
                    </div>
                  </>
                ) : (
                  <>
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
                          {FIELD_KEYS_FOR_EDITOR.map((k) => (
                            <option key={k} value={k}>
                              {FIELD_LABELS[k]}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

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
                      <div className="text-xs font-black text-slate-600 mb-2">{lang === 'TH' ? 'ฟอนต์' : 'Font'}</div>
                      <select
                        value={selected.fontFamily ?? 'Arial'}
                        onChange={(e) => {
                          const ff = e.target.value;
                          updateBlock(selected.id, {
                            fontFamily: ff,
                            fontWeight: FONT_FAMILIES_FORCE_400.has(ff) ? 400 : selected.fontWeight,
                          });
                        }}
                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-800"
                      >
                        {FONT_FAMILIES.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
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
                        <div className="text-xs font-black text-slate-600 mb-2">{t.rotation}</div>
                        <input
                          type="number"
                          value={selected.rotation ?? 0}
                          onChange={(e) => updateBlock(selected.id, { rotation: Number(e.target.value) || 0 })}
                          className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-800"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={removeSelected}
                      className="w-full px-4 py-3 rounded-2xl bg-rose-50 text-rose-700 border border-rose-100 text-xs font-black"
                    >
                      {t.delete}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
