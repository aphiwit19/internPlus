import React, { useEffect, useMemo, useState } from 'react';

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import LeaveRequestCore from '@/pages/shared/LeaveRequestCore';
import { Language, UserRole } from '@/types';

import { firestoreDb } from '@/firebase';

interface AdminLeaveRequestPageProps {
  lang: Language;
  role: UserRole;
}

const LeaveRequestPage: React.FC<AdminLeaveRequestPageProps> = ({ lang, role }) => {
  const [quotaDays, setQuotaDays] = useState<number>(39);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const t = useMemo(
    () =>
      ({
        EN: {
          title: 'Internship Leave Quota',
          subtitle: 'Set the maximum number of leave days allowed during the internship period.',
          label: 'Total leave days (overall)',
          save: 'Save',
          saving: 'Saving...',
        },
        TH: {
          title: 'กำหนดโควตาการลา (ช่วงฝึกงาน)',
          subtitle: 'กำหนดจำนวนวันลารวมสูงสุดที่อนุญาตในช่วงฝึกงาน',
          label: 'จำนวนวันลารวมทั้งหมด',
          save: 'บันทึก',
          saving: 'กำลังบันทึก...',
        },
      }[lang]),
    [lang],
  );

  useEffect(() => {
    const load = async () => {
      try {
        const ref = doc(firestoreDb, 'config', 'systemSettings');
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const data = snap.data() as { totalLeaveQuotaDays?: unknown };
        const value = Number(data.totalLeaveQuotaDays);
        if (Number.isFinite(value) && value > 0) {
          setQuotaDays(value);
        }
      } catch {
        // ignore
      } finally {
        setIsLoadingConfig(false);
      }
    };
    void load();
  }, []);

  const handleSaveQuota = async () => {
    if (!Number.isFinite(quotaDays) || quotaDays <= 0) {
      alert(lang === 'EN' ? 'Please enter a valid number of days.' : 'กรุณาระบุจำนวนวันที่ถูกต้อง');
      return;
    }
    setIsSavingConfig(true);
    try {
      const ref = doc(firestoreDb, 'config', 'systemSettings');
      await setDoc(
        ref,
        {
          totalLeaveQuotaDays: quotaDays,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      alert(lang === 'EN' ? 'Saved.' : 'บันทึกแล้ว');
    } catch {
      alert(lang === 'EN' ? 'Failed to save.' : 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <LeaveRequestCore
      lang={lang}
      role={role}
      headerTitle={lang === 'EN' ? 'Admin Approval Center' : 'ศูนย์อนุมัติ (แอดมิน)'}
      headerSubtitle={
        lang === 'EN'
          ? 'Review and manage leave requests across the entire organization.'
          : 'ตรวจสอบและจัดการคำขอลาทั้งหมดในระบบ'
      }
      sidePanel={
        <div className="bg-white rounded-[3.5rem] p-10 md:p-12 border border-slate-100 shadow-sm">
          <div className="flex flex-col gap-8">
            <div>
              <h4 className="text-2xl font-black text-slate-900 tracking-tight">{t.title}</h4>
              <p className="text-sm text-slate-500 font-medium mt-2">{t.subtitle}</p>
            </div>

            <div>
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{t.label}</label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min={1}
                  step={1}
                  disabled={isLoadingConfig || isSavingConfig}
                  value={quotaDays}
                  onChange={(e) => setQuotaDays(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none focus:ring-8 focus:ring-blue-500/10 transition-all"
                />
                <button
                  onClick={handleSaveQuota}
                  disabled={isLoadingConfig || isSavingConfig}
                  className="px-7 py-4 bg-blue-600 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingConfig ? t.saving : t.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
};

export default LeaveRequestPage;
