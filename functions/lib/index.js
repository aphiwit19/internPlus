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
function assertAdmin(context) {
    const auth = context.auth;
    if (!auth)
        throw new HttpsError('unauthenticated', 'Please sign in.');
    if (auth.token?.admin !== true)
        throw new HttpsError('permission-denied', 'Admin only.');
}
function escapeXml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}
function formatIssueDate(value) {
    if (!value)
        return '';
    const d = value instanceof Date ? value : value instanceof admin.firestore.Timestamp ? value.toDate() : new Date(String(value));
    if (Number.isNaN(d.getTime()))
        return '';
    // English date
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' });
}
function resolveFieldValue(key, ctx) {
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
            return formatIssueDate(ctx.issuedAt);
        default:
            return '';
    }
}
function buildSvgFromLayout(layout, target, ctx) {
    const srcW = layout.canvas?.width ?? target.width;
    const srcH = layout.canvas?.height ?? target.height;
    const sx = srcW ? target.width / srcW : 1;
    const sy = srcH ? target.height / srcH : 1;
    const sf = (sx + sy) / 2;
    const textNodes = layout.blocks
        .filter((b) => b && b.kind === 'text')
        .map((b) => {
        const raw = b.source.type === 'static'
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
        const align = b.align ?? 'left';
        // Konva uses y as the top of the text box, while SVG uses y as baseline.
        // sharp's SVG renderer may ignore dominant-baseline, so we convert explicitly.
        const y = yTop + fontSize;
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
function resolveStoragePathFromTemplate(tpl) {
    if (tpl.backgroundPath && typeof tpl.backgroundPath === 'string') {
        return tpl.backgroundPath;
    }
    throw new HttpsError('failed-precondition', 'Template has no backgroundPath');
}
function placeholderValueForField(key) {
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
        const templateId = String(request.data?.templateId ?? '');
        if (!templateId)
            throw new HttpsError('invalid-argument', 'Missing templateId');
        const db = admin.firestore();
        const bucket = admin.storage().bucket();
        const tplRef = db.collection('certificateTemplates').doc(templateId);
        const tplSnap = await tplRef.get();
        if (!tplSnap.exists)
            throw new HttpsError('not-found', 'certificateTemplates doc not found');
        const tpl = tplSnap.data();
        const backgroundStoragePath = resolveStoragePathFromTemplate(tpl);
        if (!tpl.layout || !Array.isArray(tpl.layout.blocks)) {
            throw new HttpsError('failed-precondition', 'Template has no layout');
        }
        let bgBuffer;
        try {
            [bgBuffer] = await bucket.file(backgroundStoragePath).download();
        }
        catch (err) {
            console.error('generateTemplatePreview:downloadBackgroundFailed', { templateId, backgroundStoragePath, err });
            throw new HttpsError('failed-precondition', `Unable to download background image at path: ${backgroundStoragePath}`);
        }
        const bgSharp = sharp(bgBuffer);
        let meta;
        try {
            meta = await bgSharp.metadata();
        }
        catch (err) {
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
                if (!b || b.kind !== 'text')
                    return b;
                if (b.source.type === 'field') {
                    return {
                        ...b,
                        source: { type: 'static', text: placeholderValueForField(b.source.key) },
                    };
                }
                return b;
            }),
        };
        const svgWithPlaceholders = buildSvgFromLayout(layoutWithPlaceholders, { width, height }, {
            type: tpl.type ?? 'COMPLETION',
            internName: '',
            internPosition: '',
            internDepartment: '',
            internPeriod: '',
            systemId: '',
            issuedAt: null,
        });
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
        });
        return { ok: true, previewPath };
    }
    catch (err) {
        if (err instanceof HttpsError)
            throw err;
        console.error('generateTemplatePreview:internalError', err);
        throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error');
    }
});
export const generateCertificate = onCall({ cors: true }, async (request) => {
    try {
        assertAdmin(request);
        const requestId = String(request.data?.requestId ?? '');
        const templateId = String(request.data?.templateId ?? '');
        if (!requestId)
            throw new HttpsError('invalid-argument', 'Missing requestId');
        if (!templateId)
            throw new HttpsError('invalid-argument', 'Missing templateId');
        const db = admin.firestore();
        const bucket = admin.storage().bucket();
        console.log('generateCertificate:start', {
            requestId,
            templateId,
            callerUid: request.auth?.uid,
        });
        const reqRef = db.collection('certificateRequests').doc(requestId);
        const reqSnap = await reqRef.get();
        if (!reqSnap.exists)
            throw new HttpsError('not-found', 'certificateRequests doc not found');
        const req = reqSnap.data();
        if (!req.internId)
            throw new HttpsError('failed-precondition', 'Request has no internId');
        const tplRef = db.collection('certificateTemplates').doc(templateId);
        const tplSnap = await tplRef.get();
        if (!tplSnap.exists)
            throw new HttpsError('not-found', 'certificateTemplates doc not found');
        const tpl = tplSnap.data();
        const backgroundStoragePath = resolveStoragePathFromTemplate(tpl);
        console.log('generateCertificate:resolvedTemplate', {
            requestId,
            templateId,
            type: req.type,
            backgroundStoragePath,
        });
        // Fetch intern profile (authoritative source)
        const userSnap = await db.collection('users').doc(req.internId).get();
        const user = (userSnap.exists ? userSnap.data() : {});
        const internName = user.name ?? req.internName ?? 'Intern';
        const internPosition = user.position ?? req.internPosition ?? '';
        const internDepartment = user.department ?? req.internDepartment ?? '';
        const internPeriod = user.internPeriod ?? '';
        const systemId = user.systemId ?? '';
        // Download background image
        let bgBuffer;
        try {
            [bgBuffer] = await bucket.file(backgroundStoragePath).download();
        }
        catch (err) {
            console.error('generateCertificate:downloadBackgroundFailed', { requestId, templateId, backgroundStoragePath, err });
            throw new HttpsError('failed-precondition', `Unable to download background image at path: ${backgroundStoragePath}. Please verify the Storage file exists and the path is correct.`);
        }
        const bgSharp = sharp(bgBuffer);
        let meta;
        try {
            meta = await bgSharp.metadata();
        }
        catch (err) {
            console.error('generateCertificate:backgroundMetadataFailed', { requestId, templateId, backgroundStoragePath, err });
            throw new HttpsError('failed-precondition', 'Background file is not a supported image (expected png/jpg). Please upload a valid image.');
        }
        const width = meta.width ?? 2480;
        const height = meta.height ?? 3508;
        const hasCustomLayout = Array.isArray(tpl.layout?.blocks) && tpl.layout.blocks.length > 0;
        // Fixed layout (Phase 1): simple centered text
        // Note: Thai font rendering depends on available fonts in the runtime.
        const fixedSvg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font-size: ${Math.round(width * 0.04)}px; font-family: Arial, sans-serif; font-weight: 700; fill: #111827; }
    .name { font-size: ${Math.round(width * 0.055)}px; font-family: Arial, sans-serif; font-weight: 800; fill: #111827; }
    .meta { font-size: ${Math.round(width * 0.022)}px; font-family: Arial, sans-serif; font-weight: 600; fill: #334155; }
  </style>

  <text x="50%" y="${Math.round(height * 0.30)}" text-anchor="middle" class="title">${escapeXml(req.type === 'COMPLETION' ? 'Certificate of Completion' : 'Recommendation Letter')}</text>

  <text x="50%" y="${Math.round(height * 0.45)}" text-anchor="middle" class="name">${escapeXml(internName)}</text>

  <text x="50%" y="${Math.round(height * 0.55)}" text-anchor="middle" class="meta">${escapeXml([internPosition, internDepartment].filter(Boolean).join(' • '))}</text>

  <text x="50%" y="${Math.round(height * 0.60)}" text-anchor="middle" class="meta">${escapeXml(internPeriod)}</text>

  <text x="50%" y="${Math.round(height * 0.92)}" text-anchor="middle" class="meta">${escapeXml(systemId)}</text>
</svg>`;
        const svg = hasCustomLayout
            ? buildSvgFromLayout(tpl.layout, { width, height }, {
                type: req.type,
                internName,
                internPosition,
                internDepartment,
                internPeriod,
                systemId,
                issuedAt: req.issuedAt ?? new Date(),
            })
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
            issuedById: request.auth.uid,
            issuedByName: request.auth.token?.name ?? 'Admin',
            issuedByRole: 'HR_ADMIN',
            issuedPngPath,
            issuedPdfPath,
        });
        console.log('generateCertificate:done', { requestId, issuedPngPath, issuedPdfPath });
        return {
            ok: true,
            issuedPngPath,
            issuedPdfPath,
        };
    }
    catch (err) {
        if (err instanceof HttpsError)
            throw err;
        console.error('generateCertificate:internalError', err);
        throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error');
    }
});
export const deleteCertificateTemplate = onCall({ cors: true }, async (request) => {
    try {
        assertAdmin(request);
        const templateId = String(request.data?.templateId ?? '');
        if (!templateId)
            throw new HttpsError('invalid-argument', 'Missing templateId');
        const db = admin.firestore();
        const bucket = admin.storage().bucket();
        const tplRef = db.collection('certificateTemplates').doc(templateId);
        const tplSnap = await tplRef.get();
        if (!tplSnap.exists) {
            return { ok: true, skipped: true };
        }
        const tpl = tplSnap.data();
        const path = tpl.backgroundPath;
        if (path) {
            try {
                await bucket.file(path).delete();
            }
            catch (err) {
                const e = err;
                if (String(e?.code ?? '').includes('404') || String(e?.message ?? '').toLowerCase().includes('not found')) {
                    // ignore
                }
                else {
                    console.error('deleteCertificateTemplate:deleteBackgroundFailed', { templateId, path, err });
                    throw new HttpsError('internal', e?.message ?? 'Failed to delete background');
                }
            }
        }
        await tplRef.delete();
        return { ok: true };
    }
    catch (err) {
        if (err instanceof HttpsError)
            throw err;
        throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error');
    }
});
export const deleteTemplateBackground = onCall({ cors: true }, async (request) => {
    try {
        assertAdmin(request);
        const templateId = String(request.data?.templateId ?? '');
        if (!templateId)
            throw new HttpsError('invalid-argument', 'Missing templateId');
        const db = admin.firestore();
        const bucket = admin.storage().bucket();
        const tplRef = db.collection('certificateTemplates').doc(templateId);
        const tplSnap = await tplRef.get();
        if (!tplSnap.exists)
            throw new HttpsError('not-found', 'certificateTemplates doc not found');
        const tpl = tplSnap.data();
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
        }
        catch (err) {
            const e = err;
            // Ignore not-found; still clear Firestore so UI does not keep pointing to a missing file.
            if (String(e?.code ?? '').includes('404') || String(e?.message ?? '').toLowerCase().includes('not found')) {
                // noop
            }
            else {
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
    }
    catch (err) {
        if (err instanceof HttpsError)
            throw err;
        throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error');
    }
});
