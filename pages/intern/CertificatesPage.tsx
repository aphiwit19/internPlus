 
 import React, { useEffect, useMemo, useState } from 'react';
import { 
  Award, 
  FileText, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  Info,
  ExternalLink,
  Stamp
} from 'lucide-react';
 import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
 import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { Language } from '@/types';

 import { useAppContext } from '@/app/AppContext';
 import { firestoreDb, firebaseStorage } from '@/firebase';

interface CertificateItem {
  id: string;
  type: 'COMPLETION' | 'RECOMMENDATION';
  title: string;
  description: string;
  status: 'ready' | 'pending' | 'requestable' | 'locked';
  requestId?: string;
  fileName?: string;
  storagePath?: string;
}

 type CertificateRequestStatus = 'REQUESTED' | 'ISSUED';

 type CertificateRequestDoc = {
   internId: string;
   internName: string;
   internAvatar: string;
   internPosition?: string;
   internDepartment?: string;
   supervisorId: string | null;
   type: 'COMPLETION' | 'RECOMMENDATION';
   status: CertificateRequestStatus;
   requestedAt?: unknown;
   issuedAt?: unknown;
   issuedById?: string;
   issuedByName?: string;
   issuedByRole?: 'SUPERVISOR' | 'HR_ADMIN';
   fileName?: string;
   storagePath?: string;
 };

interface CertificatesPageProps {
  lang: Language;
}

const CertificatesPage: React.FC<CertificatesPageProps> = ({ lang }) => {
  const { user } = useAppContext();

  const t = {
    EN: {
      title: "Certificates",
      subtitle: "Request and download your official internship completion documents.",
      completionTitle: "Certificate of Completion",
      completionDesc: "Official document certifying your successful completion of the internPlus program with high honors.",
      letterTitle: "Internship Recommendation Letter",
      letterDesc: "A formal letter from your supervisor detailing your contributions, skills, and professional growth.",
      download: "Download Signed PDF",
      hrReview: "Awaiting issuance",
      request: "Request Document",
      requesting: "Requesting...",
      issued: "Issued",
      fileReady: "File Ready",
      loadError: "Failed to load certificate requests.",
      requestError: "Failed to request certificate.",
      verification: "Digital Seal & Verification",
      verificationSub: "All issued certificates are cryptographically signed and sealed.",
      seal: "Company Seal",
      authentic: "Authentic internPlus Emboss",
      authorized: "Authorized",
      signatures: "HR & Mentor Signature",
      validator: "Public QR Validator",
      guide: "Offboarding Guide",
      step1: "Ensure all tasks in Assignment are marked as completed.",
      step2: "Submit your final University Evaluation forms.",
      step3: "Requests usually take 3-5 business days.",
      noteTitle: "Important Note",
      noteDesc: "Physical certificates can be collected from HQ after digital issuance."
    },
    TH: {
      title: "ใบรับรอง",
      subtitle: "ขอและดาวน์โหลดเอกสารรับรองการฝึกงานอย่างเป็นทางการของคุณ",
      completionTitle: "วุฒิบัตรการฝึกงาน",
      completionDesc: "เอกสารอย่างเป็นทางการเพื่อรับรองการฝึกงานที่ internPlus ของคุณเสร็จสมบูรณ์พร้อมผลการประเมินระดับดีเยี่ยม",
      letterTitle: "จดหมายรับรองการฝึกงาน",
      letterDesc: "จดหมายรับรองอย่างเป็นทางการจากที่ปรึกษา ซึ่งระบุถึงผลงาน ทักษะ และการเติบโตทางวิชาชีพของคุณ",
      download: "ดาวน์โหลดไฟล์ PDF",
      hrReview: "รอการออกเอกสาร",
      request: "ขอเอกสาร",
      requesting: "กำลังส่งคำขอ...",
      issued: "ออกเอกสารแล้ว",
      fileReady: "ไฟล์พร้อมดาวน์โหลด",
      loadError: "ไม่สามารถโหลดรายการคำขอใบรับรองได้",
      requestError: "ไม่สามารถส่งคำขอใบรับรองได้",
      verification: "ตราประทับดิจิทัลและการตรวจสอบ",
      verificationSub: "ใบรับรองทั้งหมดได้รับการลงลายมือชื่อและประทับตราแบบเข้ารหัส",
      seal: "ตราประทับบริษัท",
      authentic: "ตราประทับนูน internPlus แท้",
      authorized: "ได้รับอนุญาตแล้ว",
      signatures: "ลายเซ็น HR และที่ปรึกษา",
      validator: "ตรวจสอบผ่าน QR Code",
      guide: "คู่มือการพ้นสภาพ",
      step1: "ตรวจสอบว่างานทั้งหมดในส่วน Assignment เสร็จสมบูรณ์แล้ว",
      step2: "ส่งเอกสารการประเมินผลจากมหาวิทยาลัยให้ครบถ้วน",
      step3: "การดำเนินการปกติใช้เวลา 3-5 วันทำการ",
      noteTitle: "หมายเหตุสำคัญ",
      noteDesc: "สามารถรับใบรับรองฉบับจริงได้ที่สำนักงานใหญ่หลังจากออกฉบับดิจิทัลแล้ว"
    }
  }[lang];

  const BASE_CERTIFICATES: CertificateItem[] = useMemo(
    () => [
      {
        id: 'cert-completion',
        type: 'COMPLETION',
        title: t.completionTitle,
        description: t.completionDesc,
        status: 'requestable',
      },
      {
        id: 'cert-recommendation',
        type: 'RECOMMENDATION',
        title: t.letterTitle,
        description: t.letterDesc,
        status: 'requestable',
      },
    ],
    [t.completionDesc, t.completionTitle, t.letterDesc, t.letterTitle],
  );

  const [certs, setCerts] = useState<CertificateItem[]>(BASE_CERTIFICATES);
  const [isRequesting, setIsRequesting] = useState<string | null>(null);
  const [requests, setRequests] = useState<Array<CertificateRequestDoc & { id: string }>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    setCerts(BASE_CERTIFICATES);
  }, [BASE_CERTIFICATES]);

  useEffect(() => {
    if (!user) return;
    setLoadError(null);
    const q = query(collection(firestoreDb, 'certificateRequests'), where('internId', '==', user.id));

    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => {
          const data = d.data() as CertificateRequestDoc;
          return { id: d.id, ...data };
        });

        items.sort((a, b) => {
          const ax = (a.requestedAt ?? '') as unknown as { toMillis?: () => number };
          const bx = (b.requestedAt ?? '') as unknown as { toMillis?: () => number };
          const am = typeof ax?.toMillis === 'function' ? ax.toMillis() : 0;
          const bm = typeof bx?.toMillis === 'function' ? bx.toMillis() : 0;
          return bm - am;
        });

        setRequests(items);
      },
      (err) => {
        const e = err as { code?: string; message?: string };
        setLoadError(`${t.loadError} ${e?.code ?? ''} ${e?.message ?? ''}`.trim());
      },
    );
  }, [user]);

  const effectiveCerts = useMemo(() => {
    const byType = new Map<string, (CertificateRequestDoc & { id: string })>();
    for (const r of requests) {
      if (!byType.has(r.type)) byType.set(r.type, r);
    }

    return certs.map((c) => {
      const latest = byType.get(c.type) ?? null;
      if (!latest) return { ...c, status: 'requestable' };
      if (latest.status === 'ISSUED') {
        return {
          ...c,
          status: 'ready',
          requestId: latest.id,
          fileName: latest.fileName,
          storagePath: latest.storagePath,
        };
      }
      return {
        ...c,
        status: 'pending',
        requestId: latest.id,
      };
    });
  }, [certs, requests]);

  const latestRequestByType = useMemo(() => {
    const byType = new Map<CertificateItem['type'], (CertificateRequestDoc & { id: string })>();
    for (const r of requests) {
      if (!byType.has(r.type)) byType.set(r.type, r);
    }
    return byType;
  }, [requests]);

  const handleRequest = async (cert: CertificateItem) => {
    if (!user) return;

    if (isRequesting) return;

    const existing = latestRequestByType.get(cert.type) ?? null;
    if (existing && existing.status === 'REQUESTED') {
      setRequestError(lang === 'TH' ? 'คุณได้ส่งคำขอเอกสารนี้แล้ว กรุณารอการออกเอกสาร' : 'You already requested this document. Please wait for issuance.');
      return;
    }

    setIsRequesting(cert.id);
    setRequestError(null);
    try {
      await addDoc(collection(firestoreDb, 'certificateRequests'), {
        internId: user.id,
        internName: user.name,
        internAvatar: user.avatar,
        internPosition: user.position,
        internDepartment: user.department,
        supervisorId: user.supervisorId ?? null,
        type: cert.type,
        status: 'REQUESTED',
        requestedAt: serverTimestamp(),
      } satisfies CertificateRequestDoc);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setRequestError(`${t.requestError} ${e?.code ?? ''} ${e?.message ?? ''}`.trim());
    } finally {
      setIsRequesting(null);
    }
  };

  const handleDownload = async (cert: CertificateItem) => {
    if (!cert.storagePath) return;
    const url = await getDownloadURL(storageRef(firebaseStorage, cert.storagePath));
    window.open(url, '_blank');
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden relative p-6 md:p-10">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
        {loadError ? (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
            {loadError}
          </div>
        ) : null}

        {requestError ? (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
            {requestError}
          </div>
        ) : null}

        <div className="mb-12">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t.title}</h1>
          <p className="text-slate-500 text-sm mt-1">{t.subtitle}</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-24 overflow-y-auto scrollbar-hide">
          <div className="lg:col-span-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {effectiveCerts.map((cert) => (
                <div key={cert.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative overflow-hidden group">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 ${cert.type === 'COMPLETION' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                    {cert.type === 'COMPLETION' ? <Award size={28} /> : <FileText size={28} />}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3 leading-tight">{cert.title}</h3>
                  <p className="text-slate-500 text-[13px] leading-relaxed mb-8 flex-1">{cert.description}</p>
                  <div className="pt-6 border-t border-slate-50">
                    {cert.status === 'ready' ? (
                      <button onClick={() => void handleDownload(cert)} className="w-full bg-blue-600 text-white py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm shadow-xl hover:bg-blue-700 active:scale-95">
                        {t.download}
                      </button>
                    ) : cert.status === 'pending' ? (
                      <div className="w-full bg-slate-50 text-slate-400 py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs border border-slate-100 italic"><Clock size={16} className="animate-spin" /> {t.hrReview}</div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRequest(cert);
                        }}
                        disabled={isRequesting !== null}
                        className="w-full bg-slate-900 text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isRequesting === cert.id ? (
                          <>
                            <Clock size={16} className="animate-spin" /> {t.requesting}
                          </>
                        ) : (
                          <>
                            {t.request} <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><ShieldCheck size={24} /></div>
                <div><h3 className="text-lg font-bold text-slate-900">{t.verification}</h3><p className="text-xs text-slate-500">{t.verificationSub}</p></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 text-center"><Stamp className="mx-auto mb-2 text-blue-400" size={24} /><p className="text-[10px] font-black text-slate-400 uppercase mb-1">{t.seal}</p><p className="text-[11px] font-bold text-slate-800">{t.authentic}</p></div>
                <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 text-center"><CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={24} /><p className="text-[10px] font-black text-slate-400 uppercase mb-1">{t.authorized}</p><p className="text-[11px] font-bold text-slate-800">{t.signatures}</p></div>
                <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 text-center"><ExternalLink className="mx-auto mb-2 text-slate-300" size={24} /><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Validator</p><p className="text-[11px] font-bold text-slate-800">{t.validator}</p></div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden h-fit">
              <h4 className="text-xl font-bold mb-8 relative z-10">{t.guide}</h4>
              <div className="space-y-6 relative z-10">
                <div className="flex items-start gap-4"><div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-blue-400">1</div><p className="text-xs text-slate-300 leading-relaxed font-medium">{t.step1}</p></div>
                <div className="flex items-start gap-4"><div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-blue-400">2</div><p className="text-xs text-slate-300 leading-relaxed font-medium">{t.step2}</p></div>
                <div className="flex items-start gap-4"><div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-blue-400">3</div><p className="text-xs text-slate-300 leading-relaxed font-medium">{t.step3}</p></div>
              </div>
            </div>
            <div className="bg-amber-50 rounded-[2rem] p-8 border border-amber-100">
              <div className="flex items-center gap-3 mb-4"><Info size={20} className="text-amber-500" /><h4 className="font-bold text-amber-900 text-sm">{t.noteTitle}</h4></div>
              <p className="text-xs text-amber-700/80 leading-relaxed font-medium">{t.noteDesc}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificatesPage;
