import admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

setGlobalOptions({ region: 'asia-southeast1' });

if (admin.apps.length === 0) {
  const projectId = process.env.GCLOUD_PROJECT;
  admin.initializeApp({
    storageBucket: projectId ? `${projectId}.firebasestorage.app` : undefined,
  });
}

const THIS_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));

type CertificateRequestStatus = 'REQUESTED' | 'ISSUED';

type CertificateRequestType = 'COMPLETION' | 'RECOMMENDATION';

type CertificateRequestDoc = {
  internId: string;
  internName: string;
  internAvatar: string;
  internPosition?: string;
  internDepartment?: string;
  overrideInternName?: string | null;
  overrideInternPosition?: string | null;
  overrideInternDepartment?: string | null;
  overrideInternPeriod?: string | null;
  overrideSystemId?: string | null;
  overrideIssueDate?: string | null;
  overrideIssueDateTs?: admin.firestore.Timestamp | null;
  snapshotInternName?: string | null;
  snapshotInternPosition?: string | null;
  snapshotInternDepartment?: string | null;
  snapshotInternPeriod?: string | null;
  snapshotSystemId?: string | null;
  snapshotIssueDateTs?: admin.firestore.Timestamp | null;
  supervisorId: string | null;
  type: CertificateRequestType;
  status: CertificateRequestStatus;
  requestedAt?: unknown;
  issuedAt?: unknown;
  issuedById?: string;
  issuedByName?: string;
  issuedByRole?: 'SUPERVISOR' | 'HR_ADMIN';
  fileName?: string;
  storagePath?: string;
  templateId?: string;
  issuedPngPath?: string;
  issuedPdfPath?: string;
};

type CertificateTemplateDoc = {
  name: string;
  type: CertificateRequestType;
  backgroundPath?: string;
  active?: boolean;
  layout?: {
    canvas: { width: number; height: number };
    blocks: Array<{
      id: string;
      kind: 'text';
      x: number;
      y: number;
      width?: number;
      rotation?: number;
      fontSize: number;
      fontWeight?: number;
      color: string;
      opacity?: number;
      source:
        | { type: 'static'; text: string }
        | {
            type: 'field';
            key: 'internName' | 'position' | 'department' | 'internPeriod' | 'systemId' | 'issueDate';
          };
    }>;
  };
  layoutVersion?: number;
  updatedAt?: unknown;
  updatedBy?: string;
};

type UserDoc = {
  name?: string;
  department?: string;
  position?: string;
  internPeriod?: string;
  systemId?: string;
};

function assertAdmin(context: Parameters<typeof onCall>[0] extends any ? any : never) {
  const auth = context.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Please sign in.');
  if ((auth.token as any)?.admin !== true) throw new HttpsError('permission-denied', 'Admin only.');
}

async function getCallerRoles(uid: string): Promise<Array<'INTERN' | 'SUPERVISOR' | 'HR_ADMIN'>> {
  const snap = await admin.firestore().collection('users').doc(uid).get();
  const roles = (snap.exists ? (snap.data() as any)?.roles : null) as unknown;
  return Array.isArray(roles) ? (roles as Array<'INTERN' | 'SUPERVISOR' | 'HR_ADMIN'>) : [];
}

async function assertHrAdminOrSupervisor(context: Parameters<typeof onCall>[0] extends any ? any : never): Promise<{ uid: string; roles: string[] }> {
  const auth = context.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Please sign in.');
  const uid = auth.uid;
  const roles = await getCallerRoles(uid);
  if (!roles.includes('HR_ADMIN') && !roles.includes('SUPERVISOR')) {
    throw new HttpsError('permission-denied', 'HR_ADMIN or SUPERVISOR only.');
  }
  return { uid, roles };
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

type EmbeddedFontSpec = {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  relativePath: string;
  mime: 'font/ttf' | 'font/otf';
  format: 'truetype' | 'opentype';
};

const EMBEDDED_FONTS: EmbeddedFontSpec[] = [
  {
    family: 'TH Sarabun New',
    weight: 400,
    style: 'normal',
    relativePath: 'front/thai/THSarabunNew.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'TH Sarabun New',
    weight: 700,
    style: 'normal',
    relativePath: 'front/thai/THSarabunNew Bold.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'TH Sarabun New',
    weight: 400,
    style: 'italic',
    relativePath: 'front/thai/THSarabunNew Italic.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'TH Sarabun New',
    weight: 700,
    style: 'italic',
    relativePath: 'front/thai/THSarabunNew BoldItalic.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond',
    weight: 400,
    style: 'normal',
    relativePath: 'front/eng/static/CormorantGaramond-Regular.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond',
    weight: 700,
    style: 'normal',
    relativePath: 'front/eng/static/CormorantGaramond-Bold.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond',
    weight: 400,
    style: 'italic',
    relativePath: 'front/eng/static/CormorantGaramond-Italic.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond',
    weight: 700,
    style: 'italic',
    relativePath: 'front/eng/static/CormorantGaramond-BoldItalic.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
];

const embeddedFontBase64Cache = new Map<string, string>();

function readFontBase64(relativePath: string): string {
  const cached = embeddedFontBase64Cache.get(relativePath);
  if (cached) return cached;

  // This file runs from lib/index.js in production. We copy src/front -> lib/front in the build script.
  const abs = path.resolve(THIS_FILE_DIR, relativePath);
  const buf = fs.readFileSync(abs);
  const b64 = buf.toString('base64');
  embeddedFontBase64Cache.set(relativePath, b64);
  return b64;
}

function buildEmbeddedFontStyleTag(fontFamiliesInUse: Set<string>): string {
  const faces = EMBEDDED_FONTS.filter((f) => fontFamiliesInUse.has(f.family));
  if (faces.length === 0) return '';

  const css = faces
    .map((f) => {
      const b64 = readFontBase64(f.relativePath);
      return (
        `@font-face{font-family:'${f.family}';src:url('data:${f.mime};base64,${b64}') format('${f.format}');font-weight:${f.weight};font-style:${f.style};}`
      );
    })
    .join('');

  return `<style>${css}</style>`;
}

function formatIssueDate(value: admin.firestore.Timestamp | Date | string | undefined | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : value instanceof admin.firestore.Timestamp ? value.toDate() : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  // English date
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' });
}

function parseDateOnlyToDate(value: string): Date | null {
  // Expected: YYYY-MM-DD (from <input type="date">)
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveFieldValue(key: 'internName' | 'position' | 'department' | 'internPeriod' | 'systemId' | 'issueDate', ctx: {
  internName: string;
  internPosition: string;
  internDepartment: string;
  internPeriod: string;
  systemId: string;
  issuedAt: unknown;
}): string {
  switch (key) {
    case 'internName':
      return ctx.internName;
    case 'position':
      return ctx.internPosition;
    case 'department':
      return ctx.internDepartment;
    case 'internPeriod':
      return ctx.internPeriod;
    case 'systemId':
      return ctx.systemId;
    case 'issueDate':
      return formatIssueDate(ctx.issuedAt as any);
    default:
      return '';
  }
}

function buildSvgFromLayout(
  layout: NonNullable<CertificateTemplateDoc['layout']>,
  target: { width: number; height: number },
  ctx: {
    type: CertificateRequestType;
    internName: string;
    internPosition: string;
    internDepartment: string;
    internPeriod: string;
    systemId: string;
    issuedAt: unknown;
  },
): string {
  const srcW = layout.canvas?.width ?? target.width;
  const srcH = layout.canvas?.height ?? target.height;
  const sx = srcW ? target.width / srcW : 1;
  const sy = srcH ? target.height / srcH : 1;
  const sf = (sx + sy) / 2;

  const fontFamiliesInUse = new Set<string>();
  for (const b of layout.blocks) {
    const ff = (b as any)?.fontFamily;
    if (typeof ff === 'string' && ff.trim()) fontFamiliesInUse.add(ff.trim());
  }
  const embeddedFontsStyle = buildEmbeddedFontStyleTag(fontFamiliesInUse);

  const textNodes = layout.blocks
    .filter((b) => b && b.kind === 'text')
    .map((b) => {
      const raw =
        b.source.type === 'static'
          ? b.source.text
          : resolveFieldValue(b.source.key, {
              internName: ctx.internName,
              internPosition: ctx.internPosition,
              internDepartment: ctx.internDepartment,
              internPeriod: ctx.internPeriod,
              systemId: ctx.systemId,
              issuedAt: ctx.issuedAt,
            });

      const x = Math.round((b.x ?? 0) * sx);
      const yTop = Math.round((b.y ?? 0) * sy);
      const fontSize = Math.max(6, Math.round((b.fontSize ?? 24) * sf));
      const fontWeight = b.fontWeight ?? 600;
      const fill = b.color ?? '#111827';
      const opacity = b.opacity ?? 1;
      const rotation = Number((b as any)?.rotation ?? 0) || 0;
      const fontFamily = typeof (b as any).fontFamily === 'string' && String((b as any).fontFamily).trim()
        ? String((b as any).fontFamily).trim()
        : 'Arial';

      // Konva uses y as the top of the text box, while SVG uses y as baseline.
      // sharp's SVG renderer may ignore dominant-baseline, so we convert explicitly.
      const y = yTop + fontSize;

      const anchor = 'start';
      const lines = String(raw ?? '').split('\n');
      const lineHeight = Math.round(fontSize * 1.2);

      const tspans = lines
        .map((line, idx) => {
          const dy = idx === 0 ? 0 : lineHeight;
          return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
        })
        .join('');

      const text = `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${escapeXml(fill)}" opacity="${opacity}" font-size="${fontSize}" font-family="${escapeXml(fontFamily)}, sans-serif" font-weight="${fontWeight}">${tspans}</text>`;

      // Konva rotates around the node origin (top-left). We rotate around (x, yTop).
      if (rotation) {
        return `<g transform="rotate(${rotation} ${x} ${yTop})">${text}</g>`;
      }
      return text;
    })
    .join('\n');

  return `<svg width="${target.width}" height="${target.height}" xmlns="http://www.w3.org/2000/svg">\n${embeddedFontsStyle}${textNodes}\n</svg>`;
}

function resolveStoragePathFromTemplate(tpl: CertificateTemplateDoc): string {
  if (tpl.backgroundPath && typeof tpl.backgroundPath === 'string') {
    return tpl.backgroundPath;
  }

  throw new HttpsError('failed-precondition', 'Template has no backgroundPath');
}

function placeholderValueForField(
  key: 'internName' | 'position' | 'department' | 'internPeriod' | 'systemId' | 'issueDate',
): string {
  switch (key) {
    case 'internName':
      return '{{internName}}';
    case 'position':
      return '{{position}}';
    case 'department':
      return '{{department}}';
    case 'internPeriod':
      return '{{internPeriod}}';
    case 'systemId':
      return '{{systemId}}';
    case 'issueDate':
      return '{{issueDate}}';
    default:
      return '';
  }
}

export const generateTemplatePreview = onCall({ cors: true }, async (request) => {
  try {
    assertAdmin(request);

    const templateId = String((request.data as any)?.templateId ?? '');
    if (!templateId) throw new HttpsError('invalid-argument', 'Missing templateId');

    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    const tplRef = db.collection('certificateTemplates').doc(templateId);
    const tplSnap = await tplRef.get();
    if (!tplSnap.exists) throw new HttpsError('not-found', 'certificateTemplates doc not found');
    const tpl = tplSnap.data() as CertificateTemplateDoc;

    const backgroundStoragePath = resolveStoragePathFromTemplate(tpl);

    if (!tpl.layout || !Array.isArray(tpl.layout.blocks)) {
      throw new HttpsError('failed-precondition', 'Template has no layout');
    }

    let bgBuffer: Buffer;
    try {
      [bgBuffer] = await bucket.file(backgroundStoragePath).download();
    } catch (err: unknown) {
      console.error('generateTemplatePreview:downloadBackgroundFailed', { templateId, backgroundStoragePath, err });
      throw new HttpsError('failed-precondition', `Unable to download background image at path: ${backgroundStoragePath}`);
    }

    const bgSharp = sharp(bgBuffer);
    let meta;
    try {
      meta = await bgSharp.metadata();
    } catch (err: unknown) {
      console.error('generateTemplatePreview:backgroundMetadataFailed', { templateId, backgroundStoragePath, err });
      throw new HttpsError('failed-precondition', 'Background file is not a supported image (expected png/jpg).');
    }

    const width = tpl.layout.canvas?.width ?? meta.width ?? 2480;
    const height = tpl.layout.canvas?.height ?? meta.height ?? 3508;

    const bg = bgSharp.resize(width, height, { fit: 'fill' });

    // Note: buildSvgFromLayout already resolves field values; we want placeholders instead.
    // So we re-map blocks on the fly by injecting placeholders via a cloned layout.
    const layoutWithPlaceholders = {
      ...tpl.layout,
      blocks: tpl.layout.blocks.map((b) => {
        if (!b || b.kind !== 'text') return b;
        if (b.source.type === 'field') {
          return {
            ...b,
            source: { type: 'static', text: placeholderValueForField(b.source.key) },
          };
        }
        return b;
      }),
    } as NonNullable<CertificateTemplateDoc['layout']>;

    const svgWithPlaceholders = buildSvgFromLayout(
      layoutWithPlaceholders,
      { width, height },
      {
        type: tpl.type ?? 'COMPLETION',
        internName: '',
        internPosition: '',
        internDepartment: '',
        internPeriod: '',
        systemId: '',
        issuedAt: null,
      },
    );

    const previewPng = await bg
      .composite([
        {
          input: Buffer.from(svgWithPlaceholders),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    const previewPath = `templates/previews/${templateId}/${Date.now()}_preview.png`;
    await bucket.file(previewPath).save(previewPng, {
      contentType: 'image/png',
      resumable: false,
      metadata: {
        cacheControl: 'no-store, max-age=0',
      },
    });

    await tplRef.update({
      previewPath,
      previewUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    } as any);

    return { ok: true, previewPath };
  } catch (err: unknown) {
    if (err instanceof HttpsError) throw err;
    console.error('generateTemplatePreview:internalError', err);
    throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error');
  }
});

export const generateCertificate = onCall({ cors: true }, async (request) => {
  try {
    const caller = await assertHrAdminOrSupervisor(request);

    const requestId = String((request.data as any)?.requestId ?? '');
    const templateId = String((request.data as any)?.templateId ?? '');
    const overridesRaw = ((request.data as any)?.overrides ?? null) as
      | {
          internName?: unknown;
          internPosition?: unknown;
          internDepartment?: unknown;
          internPeriod?: unknown;
          systemId?: unknown;
          issueDate?: unknown;
        }
      | null;

    if (!requestId) throw new HttpsError('invalid-argument', 'Missing requestId');
    if (!templateId) throw new HttpsError('invalid-argument', 'Missing templateId');

    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    console.log('generateCertificate:start', {
      requestId,
      templateId,
      callerUid: request.auth?.uid,
    });

    const reqRef = db.collection('certificateRequests').doc(requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) throw new HttpsError('not-found', 'certificateRequests doc not found');

    const req = reqSnap.data() as CertificateRequestDoc;
    if (!req.internId) throw new HttpsError('failed-precondition', 'Request has no internId');

    const overrides = overridesRaw
      ? {
          internName: typeof overridesRaw.internName === 'string' ? overridesRaw.internName : undefined,
          internPosition: typeof overridesRaw.internPosition === 'string' ? overridesRaw.internPosition : undefined,
          internDepartment: typeof overridesRaw.internDepartment === 'string' ? overridesRaw.internDepartment : undefined,
          internPeriod: typeof overridesRaw.internPeriod === 'string' ? overridesRaw.internPeriod : undefined,
          systemId: typeof overridesRaw.systemId === 'string' ? overridesRaw.systemId : undefined,
          issueDate: typeof overridesRaw.issueDate === 'string' ? overridesRaw.issueDate : undefined,
        }
      : null;

    if (caller.roles.includes('SUPERVISOR') && !caller.roles.includes('HR_ADMIN')) {
      if (req.supervisorId !== caller.uid) {
        throw new HttpsError('permission-denied', 'Supervisor can only generate certificates for assigned requests.');
      }
    }

    const tplRef = db.collection('certificateTemplates').doc(templateId);
    const tplSnap = await tplRef.get();
    if (!tplSnap.exists) throw new HttpsError('not-found', 'certificateTemplates doc not found');
    const tpl = tplSnap.data() as CertificateTemplateDoc;

    const backgroundStoragePath = resolveStoragePathFromTemplate(tpl);

    console.log('generateCertificate:resolvedTemplate', {
      requestId,
      templateId,
      type: req.type,
      backgroundStoragePath,
    });

    // Fetch intern profile (authoritative source)
    const userSnap = await db.collection('users').doc(req.internId).get();
    const user = (userSnap.exists ? (userSnap.data() as UserDoc) : {}) as UserDoc;

    const internName =
      (overrides?.internName ?? '').trim() || (req.overrideInternName ?? '').trim() || (req.snapshotInternName ?? '').trim() || user.name || req.internName || 'Intern';
    const internPosition =
      (overrides?.internPosition ?? '').trim() || (req.overrideInternPosition ?? '').trim() || (req.snapshotInternPosition ?? '').trim() || user.position || req.internPosition || '';
    const internDepartment =
      (overrides?.internDepartment ?? '').trim() || (req.overrideInternDepartment ?? '').trim() || (req.snapshotInternDepartment ?? '').trim() || user.department || req.internDepartment || '';
    const internPeriod =
      (overrides?.internPeriod ?? '').trim() || (req.overrideInternPeriod ?? '').trim() || (req.snapshotInternPeriod ?? '').trim() || user.internPeriod || '';
    const systemId =
      (overrides?.systemId ?? '').trim() || (req.overrideSystemId ?? '').trim() || (req.snapshotSystemId ?? '').trim() || user.systemId || '';

    const overrideIssueDateTs = overrides?.issueDate ? parseDateOnlyToDate(overrides.issueDate) : null;
    const issueDateTs =
      (overrideIssueDateTs ? admin.firestore.Timestamp.fromDate(overrideIssueDateTs) : null) ??
      req.overrideIssueDateTs ??
      req.snapshotIssueDateTs ??
      null;

    const legacyIssueDate = (req.overrideIssueDate ?? '').trim();
    const issueDateForRender = issueDateTs ?? (legacyIssueDate ? legacyIssueDate : null);

    // Download background image
    let bgBuffer: Buffer;
    try {
      [bgBuffer] = await bucket.file(backgroundStoragePath).download();
    } catch (err: unknown) {
      console.error('generateCertificate:downloadBackgroundFailed', { requestId, templateId, backgroundStoragePath, err });
      throw new HttpsError(
        'failed-precondition',
        `Unable to download background image at path: ${backgroundStoragePath}. Please verify the Storage file exists and the path is correct.`,
      );
    }

    const bgSharp = sharp(bgBuffer);
    let meta;
    try {
      meta = await bgSharp.metadata();
    } catch (err: unknown) {
      console.error('generateCertificate:backgroundMetadataFailed', { requestId, templateId, backgroundStoragePath, err });
      throw new HttpsError(
        'failed-precondition',
        'Background file is not a supported image (expected png/jpg). Please upload a valid image.',
      );
    }

    const width = meta.width ?? 2480;
    const height = meta.height ?? 3508;

    const hasCustomLayout = Array.isArray(tpl.layout?.blocks) && tpl.layout!.blocks.length > 0;

    // Fixed layout (Phase 1): simple centered text
    // Note: Thai font rendering depends on available fonts in the runtime.
    const fixedSvg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font-size: ${Math.round(width * 0.04)}px; font-family: Arial, sans-serif; font-weight: 700; fill: #111827; }
    .name { font-size: ${Math.round(width * 0.055)}px; font-family: Arial, sans-serif; font-weight: 800; fill: #111827; }
    .meta { font-size: ${Math.round(width * 0.022)}px; font-family: Arial, sans-serif; font-weight: 600; fill: #334155; }
  </style>

  <text x="50%" y="${Math.round(height * 0.30)}" text-anchor="middle" class="title">${escapeXml(
    req.type === 'COMPLETION' ? 'Certificate of Completion' : 'Recommendation Letter',
  )}</text>

  <text x="50%" y="${Math.round(height * 0.45)}" text-anchor="middle" class="name">${escapeXml(internName)}</text>

  <text x="50%" y="${Math.round(height * 0.55)}" text-anchor="middle" class="meta">${escapeXml(
    [internPosition, internDepartment].filter(Boolean).join(' • '),
  )}</text>

  <text x="50%" y="${Math.round(height * 0.60)}" text-anchor="middle" class="meta">${escapeXml(internPeriod)}</text>

  <text x="50%" y="${Math.round(height * 0.92)}" text-anchor="middle" class="meta">${escapeXml(systemId)}</text>
</svg>`;

    const svg = hasCustomLayout
      ? buildSvgFromLayout(
          tpl.layout!,
          { width, height },
          {
            type: req.type,
            internName,
            internPosition,
            internDepartment,
            internPeriod,
            systemId,
            issuedAt: issueDateForRender ?? req.issuedAt ?? new Date(),
          },
        )
      : fixedSvg;

    const issuedPng = await bgSharp
      .composite([
        {
          input: Buffer.from(svg),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    // Create PDF by embedding the PNG as full page
    const pdfDoc = await PDFDocument.create();
    const pngImage = await pdfDoc.embedPng(issuedPng);

    // Use pixel size as PDF points for phase 1 (works for download/printing; can refine later)
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(pngImage, { x: 0, y: 0, width, height });

    const pdfBytes = await pdfDoc.save();

    const issuedPngPath = `certificates/${req.internId}/${requestId}/certificate.png`;
    const issuedPdfPath = `certificates/${req.internId}/${requestId}/certificate.pdf`;

    await Promise.all([
      bucket.file(issuedPngPath).save(issuedPng, {
        contentType: 'image/png',
        resumable: false,
        metadata: { cacheControl: 'no-store, max-age=0' },
      }),
      bucket.file(issuedPdfPath).save(Buffer.from(pdfBytes), {
        contentType: 'application/pdf',
        resumable: false,
        metadata: { cacheControl: 'no-store, max-age=0' },
      }),
    ]);

    await reqRef.update({
      status: 'ISSUED',
      templateId,
      ...(overrides
        ? {
            overrideInternName: overrides.internName ?? null,
            overrideInternPosition: overrides.internPosition ?? null,
            overrideInternDepartment: overrides.internDepartment ?? null,
            overrideInternPeriod: overrides.internPeriod ?? null,
            overrideSystemId: overrides.systemId ?? null,
            overrideIssueDate: overrides.issueDate ?? null,
            ...(overrideIssueDateTs ? { overrideIssueDateTs: admin.firestore.Timestamp.fromDate(overrideIssueDateTs) } : { overrideIssueDateTs: null }),
            editedAt: admin.firestore.FieldValue.serverTimestamp(),
            editedById: caller.uid,
          }
        : {}),
      snapshotInternName: internName,
      snapshotInternPosition: internPosition,
      snapshotInternDepartment: internDepartment,
      snapshotInternPeriod: internPeriod,
      snapshotSystemId: systemId,
      snapshotIssueDateTs: issueDateTs,
      issuedAt: admin.firestore.FieldValue.serverTimestamp(),
      issuedById: caller.uid,
      issuedByName: (request.auth!.token as any)?.name ?? (caller.roles.includes('HR_ADMIN') ? 'Admin' : 'Supervisor'),
      issuedByRole: caller.roles.includes('HR_ADMIN') ? 'HR_ADMIN' : 'SUPERVISOR',
      issuedPngPath,
      issuedPdfPath,
    } satisfies Partial<CertificateRequestDoc>);

    console.log('generateCertificate:done', { requestId, issuedPngPath, issuedPdfPath });

    return {
      ok: true,
      issuedPngPath,
      issuedPdfPath,
    };
  } catch (err: unknown) {
    if (err instanceof HttpsError) throw err;
    console.error('generateCertificate:internalError', err);
    throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error');
  }
});

export const deleteCertificateTemplate = onCall({ cors: true }, async (request) => {
  try {
    assertAdmin(request);

    const templateId = String((request.data as any)?.templateId ?? '');
    if (!templateId) throw new HttpsError('invalid-argument', 'Missing templateId');

    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const tplRef = db.collection('certificateTemplates').doc(templateId);
    const tplSnap = await tplRef.get();

    if (!tplSnap.exists) {
      return { ok: true, skipped: true };
    }

    const tpl = tplSnap.data() as CertificateTemplateDoc;
    const path = tpl.backgroundPath;
    if (path) {
      try {
        await bucket.file(path).delete();
      } catch (err: unknown) {
        const e = err as { code?: number | string; message?: string };
        if (String(e?.code ?? '').includes('404') || String(e?.message ?? '').toLowerCase().includes('not found')) {
          // ignore
        } else {
          console.error('deleteCertificateTemplate:deleteBackgroundFailed', { templateId, path, err });
          throw new HttpsError('internal', e?.message ?? 'Failed to delete background');
        }
      }
    }

    await tplRef.delete();
    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error');
  }
});

export const deleteTemplateBackground = onCall({ cors: true }, async (request) => {
  try {
    assertAdmin(request);

    const templateId = String((request.data as any)?.templateId ?? '');
    if (!templateId) throw new HttpsError('invalid-argument', 'Missing templateId');

    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    const tplRef = db.collection('certificateTemplates').doc(templateId);
    const tplSnap = await tplRef.get();
    if (!tplSnap.exists) throw new HttpsError('not-found', 'certificateTemplates doc not found');

    const tpl = tplSnap.data() as CertificateTemplateDoc;
    const path = tpl.backgroundPath;
    if (!path) {
      // Idempotent: background already removed.
      await tplRef.update({
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: request.auth?.uid ?? null,
      });
      return { ok: true, skipped: true };
    }

    try {
      await bucket.file(path).delete();
    } catch (err: unknown) {
      const e = err as { code?: number | string; message?: string };
      // Ignore not-found; still clear Firestore so UI does not keep pointing to a missing file.
      if (String(e?.code ?? '').includes('404') || String(e?.message ?? '').toLowerCase().includes('not found')) {
        // noop
      } else {
        console.error('deleteTemplateBackground:deleteFailed', { templateId, path, err });
        throw new HttpsError('internal', e?.message ?? 'Failed to delete background');
      }
    }

    await tplRef.update({
      backgroundPath: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: request.auth?.uid ?? null,
    });

    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error');
  }
});
