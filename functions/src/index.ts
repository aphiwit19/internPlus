import admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

setGlobalOptions({ region: 'asia-southeast1' });

if (admin.apps.length === 0) {
  const projectId = process.env.GCLOUD_PROJECT;
  admin.initializeApp({
    storageBucket: projectId ? `${projectId}.firebasestorage.app` : undefined,
  });
}

type CertificateRequestStatus = 'REQUESTED' | 'ISSUED';

type CertificateRequestType = 'COMPLETION' | 'RECOMMENDATION';

type CertificateRequestDoc = {
  internId: string;
  internName: string;
  internAvatar: string;
  internPosition?: string;
  internDepartment?: string;
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
      align?: 'left' | 'center' | 'right';
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

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function formatIssueDate(value: admin.firestore.Timestamp | Date | string | undefined | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : value instanceof admin.firestore.Timestamp ? value.toDate() : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  // English date
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' });
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
      const y = Math.round((b.y ?? 0) * sy);
      const fontSize = Math.max(6, Math.round((b.fontSize ?? 24) * sf));
      const fontWeight = b.fontWeight ?? 600;
      const fill = b.color ?? '#111827';
      const opacity = b.opacity ?? 1;
      const align = b.align ?? 'left';

      const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
      const lines = String(raw ?? '').split('\n');
      const lineHeight = Math.round(fontSize * 1.2);

      const tspans = lines
        .map((line, idx) => {
          const dy = idx === 0 ? 0 : lineHeight;
          return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
        })
        .join('');

      return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${escapeXml(fill)}" opacity="${opacity}" font-size="${fontSize}" font-family="Arial, sans-serif" font-weight="${fontWeight}">${tspans}</text>`;
    })
    .join('\n');

  return `<svg width="${target.width}" height="${target.height}" xmlns="http://www.w3.org/2000/svg">\n${textNodes}\n</svg>`;
}

function resolveStoragePathFromTemplate(tpl: CertificateTemplateDoc): string {
  if (tpl.backgroundPath && typeof tpl.backgroundPath === 'string') {
    return tpl.backgroundPath;
  }

  throw new HttpsError('failed-precondition', 'Template has no backgroundPath');
}

export const generateCertificate = onCall({ cors: true }, async (request) => {
  try {
    assertAdmin(request);

    const requestId = String((request.data as any)?.requestId ?? '');
    const templateId = String((request.data as any)?.templateId ?? '');

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

    const internName = user.name ?? req.internName ?? 'Intern';
    const internPosition = user.position ?? req.internPosition ?? '';
    const internDepartment = user.department ?? req.internDepartment ?? '';
    const internPeriod = user.internPeriod ?? '';
    const systemId = user.systemId ?? '';

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
            issuedAt: req.issuedAt ?? null,
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
      bucket.file(issuedPngPath).save(issuedPng, { contentType: 'image/png' }),
      bucket.file(issuedPdfPath).save(Buffer.from(pdfBytes), { contentType: 'application/pdf' }),
    ]);

    await reqRef.update({
      status: 'ISSUED',
      templateId,
      issuedAt: admin.firestore.FieldValue.serverTimestamp(),
      issuedById: request.auth!.uid,
      issuedByName: (request.auth!.token as any)?.name ?? 'Admin',
      issuedByRole: 'HR_ADMIN',
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
