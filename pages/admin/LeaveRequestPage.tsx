import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { Award, CheckCircle2, Clock, CreditCard, UserX, Users } from 'lucide-react';

import { useNavigate } from 'react-router-dom';

import LeaveRequestCore from '@/pages/shared/LeaveRequestCore';
import { Language, UserRole } from '@/types';

import { firestoreDb } from '@/firebase';

interface AdminLeaveRequestPageProps {
  lang: Language;
  role: UserRole;
}

const LeaveRequestPage: React.FC<AdminLeaveRequestPageProps> = ({ lang, role }) => {
  const { t: i18t } = useTranslation();
  const tr = (key: string) => String(i18t(key));
  const navigate = useNavigate();
  const [quotaDays, setQuotaDays] = useState<number>(39);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveNotice, setSaveNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const saveNoticeTimeoutRef = useRef<number | null>(null);

  const TabBtn = ({
    active,
    onClick,
    icon,
    label,
    hasNotification,
  }: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    hasNotification?: boolean;
  }) => {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`relative flex items-center gap-2 px-6 py-3 rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
          active ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-900'
        }`}
      >
        {icon}
        {label}
        {hasNotification && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
        )}
      </button>
    );
  };

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

  useEffect(() => {
    return () => {
      if (saveNoticeTimeoutRef.current != null) {
        window.clearTimeout(saveNoticeTimeoutRef.current);
        saveNoticeTimeoutRef.current = null;
      }
    };
  }, []);

  const handleSaveQuota = async () => {
    setSaveNotice(null);
    if (!Number.isFinite(quotaDays) || quotaDays <= 0) {
      setSaveNotice({
        type: 'error',
        message: lang === 'EN' ? 'Please enter a valid number of days.' : 'กรุณาระบุจำนวนวันที่ถูกต้อง',
      });
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
      setSaveNotice({ type: 'success', message: lang === 'EN' ? 'Saved.' : 'บันทึกแล้ว' });
      if (saveNoticeTimeoutRef.current != null) window.clearTimeout(saveNoticeTimeoutRef.current);
      saveNoticeTimeoutRef.current = window.setTimeout(() => {
        setSaveNotice(null);
        saveNoticeTimeoutRef.current = null;
      }, 3000);
    } catch {
      setSaveNotice({ type: 'error', message: lang === 'EN' ? 'Failed to save.' : 'บันทึกไม่สำเร็จ' });
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
      topNav={
        <div className="flex bg-white p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm overflow-x-auto scrollbar-hide">
          <TabBtn active={false} onClick={() => navigate('/admin/dashboard?tab=roster')} icon={<Users size={16} />} label={tr('admin_dashboard.tab_roster')} />
          <TabBtn active={false} onClick={() => navigate('/admin/dashboard?tab=attendance')} icon={<Clock size={16} />} label={tr('admin_dashboard.tab_attendance')} />
          <TabBtn active onClick={() => void 0} icon={<UserX size={16} />} label={tr('admin_dashboard.tab_absences')} />
          <TabBtn active={false} onClick={() => navigate('/admin/certificates')} icon={<Award size={16} />} label={tr('admin_dashboard.tab_certs')} />
          <TabBtn active={false} onClick={() => navigate('/admin/dashboard?tab=allowances')} icon={<CreditCard size={16} />} label={tr('admin_dashboard.tab_payouts')} />
        </div>
      }
      sidePanel={
        <div className="bg-white rounded-[3.5rem] p-10 md:p-12 border border-slate-100 shadow-sm">
          <div className="flex flex-col gap-8">
            <div>
              <h4 className="text-2xl font-black text-slate-900 tracking-tight">{t.title}</h4>
              <p className="text-sm text-slate-500 font-medium mt-2">{t.subtitle}</p>
            </div>

            {saveNotice && (
              <div
                className={`p-4 rounded-2xl border text-sm font-bold flex items-center gap-3 ${
                  saveNotice.type === 'success'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-rose-50 border-rose-100 text-rose-700'
                }`}
              >
                {saveNotice.type === 'success' ? <CheckCircle2 size={18} /> : null}
                <span className="whitespace-pre-line">{saveNotice.message}</span>
              </div>
            )}

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
