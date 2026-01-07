import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { firestoreDb } from '@/firebase';
import { PostProgramAccessLevel } from '@/types';
import { collection, deleteField, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';

type WithdrawnUserRow = {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  withdrawalReason?: string;
  withdrawalDetail?: string;
  postProgramAccessLevel?: PostProgramAccessLevel;
  postProgramRetentionPeriod?: string;
  withdrawalRequestedAt?: any;
};

interface WithdrawnWithdrawalUsersPageProps {
  lang: 'EN' | 'TH';
}

const WithdrawnWithdrawalUsersPage: React.FC<WithdrawnWithdrawalUsersPageProps> = ({ lang }) => {
  const navigate = useNavigate();

  const t = {
    EN: {
      title: 'Withdrawn Withdrawal Users',
      subtitle: 'Manage post-program access for withdrawal users who are already WITHDRAWN.',
      back: 'Back to System Settings',
      empty: 'No withdrawn withdrawal users',
      access: 'Access Level',
      retention: 'Retention',
      unsaved: 'Unsaved changes',
      save: 'Save',
      cancel: 'Cancel',
      restore: 'Restore',
      restoreConfirm: 'Restore this user to ACTIVE?',
      restoreFail: 'Failed to restore user.',
      saveConfirm: 'Save changes?',
      saveFail: 'Failed to save changes.',
    },
    TH: {
      title: 'ผู้ใช้ที่ถอนตัว (Withdrawal)',
      subtitle: 'จัดการสิทธิ์หลังจบโปรแกรมสำหรับผู้ใช้ที่เป็น WITHDRAWN จาก Withdrawal',
      back: 'กลับไปตั้งค่าระบบ',
      empty: 'ไม่มีผู้ใช้ withdrawn แบบ withdrawal',
      access: 'ระดับการเข้าถึง',
      retention: 'ระยะเวลาเก็บข้อมูล',
      unsaved: 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก',
      save: 'บันทึก',
      cancel: 'ยกเลิก',
      restore: 'คืนค่า',
      restoreConfirm: 'ต้องการคืนสถานะผู้ใช้นี้เป็น ACTIVE ใช่ไหม?',
      restoreFail: 'ไม่สามารถคืนสถานะผู้ใช้ได้',
      saveConfirm: 'บันทึกการเปลี่ยนแปลงใช่ไหม?',
      saveFail: 'ไม่สามารถบันทึกการเปลี่ยนแปลงได้',
    },
  }[lang];

  const [users, setUsers] = useState<WithdrawnUserRow[]>([]);
  const [accessOverrides, setAccessOverrides] = useState<Record<string, PostProgramAccessLevel>>({});
  const [retentionOverrides, setRetentionOverrides] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const q = query(collection(firestoreDb, 'users'), where('lifecycleStatus', '==', 'WITHDRAWN'));
    return onSnapshot(q, (snap) => {
      const rows = snap.docs
        .map((d) => {
          const data = d.data() as {
            name?: string;
            avatar?: string;
            email?: string;
            withdrawalReason?: string;
            withdrawalDetail?: string;
            postProgramAccessLevel?: PostProgramAccessLevel;
            postProgramRetentionPeriod?: string;
            withdrawalRequestedAt?: any;
          };
          return {
            id: d.id,
            name: data.name || 'Unknown',
            avatar: data.avatar || `https://picsum.photos/seed/${encodeURIComponent(d.id)}/100/100`,
            email: data.email,
            withdrawalReason: data.withdrawalReason,
            withdrawalDetail: data.withdrawalDetail,
            postProgramAccessLevel: data.postProgramAccessLevel,
            postProgramRetentionPeriod: data.postProgramRetentionPeriod,
            withdrawalRequestedAt: data.withdrawalRequestedAt,
          };
        })
        .filter((u) => Boolean(u.withdrawalRequestedAt));
      setUsers(rows);
    });
  }, []);

  const handleCancel = (userId: string) => {
    if (
      dirty[userId] === true &&
      !window.confirm(lang === 'EN' ? 'Discard unsaved changes?' : 'ยกเลิกการเปลี่ยนแปลงที่ยังไม่บันทึกใช่ไหม?')
    )
      return;

    setAccessOverrides((prev) => {
      if (!prev[userId]) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    setRetentionOverrides((prev) => {
      if (!prev[userId]) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    setDirty((prev) => ({ ...prev, [userId]: false }));
  };

  const handleSave = async (userId: string) => {
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    if (!window.confirm(t.saveConfirm)) return;

    const nextLevel = accessOverrides[userId] ?? u.postProgramAccessLevel;
    const nextRetention = retentionOverrides[userId] ?? u.postProgramRetentionPeriod;

    try {
      await updateDoc(doc(firestoreDb, 'users', userId), {
        ...(nextLevel ? { postProgramAccessLevel: nextLevel } : {}),
        ...(nextRetention ? { postProgramRetentionPeriod: nextRetention } : {}),
        updatedAt: serverTimestamp(),
      });
      setDirty((prev) => ({ ...prev, [userId]: false }));
    } catch {
      alert(t.saveFail);
    }
  };

  const handleRestore = async (userId: string) => {
    if (!window.confirm(t.restoreConfirm)) return;
    try {
      await updateDoc(doc(firestoreDb, 'users', userId), {
        lifecycleStatus: 'ACTIVE',
        withdrawalRequestedAt: deleteField(),
        withdrawalReason: deleteField(),
        withdrawalDetail: deleteField(),
        postProgramAccessLevel: deleteField(),
        postProgramRetentionPeriod: deleteField(),
        updatedAt: serverTimestamp(),
      });
      handleCancel(userId);
    } catch {
      alert(t.restoreFail);
    }
  };

  const sorted = useMemo(() => {
    return [...users].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden relative p-4 md:p-8 lg:p-10">
      <div className="max-w-[1700px] mx-auto w-full flex flex-col h-full">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="text-3xl font-black text-slate-900 tracking-tight leading-none">{t.title}</div>
            <div className="text-slate-500 text-sm font-medium">{t.subtitle}</div>
          </div>
          <button
            onClick={() => navigate('/admin/system-settings')}
            className="px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
          >
            {t.back}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
          {sorted.length === 0 ? (
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm text-center">
              <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{t.empty}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((u) => {
                const isDirty = dirty[u.id] === true;
                const accessValue = accessOverrides[u.id] ?? u.postProgramAccessLevel ?? 'LIMITED';
                const retentionValue = retentionOverrides[u.id] ?? u.postProgramRetentionPeriod ?? '6 Months post-offboard';

                return (
                  <div key={u.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-start gap-6">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <img src={u.avatar} className="w-14 h-14 rounded-2xl object-cover ring-2 ring-white" alt="" />
                        <div className="min-w-0">
                          <div className="text-base font-black text-slate-900 truncate">{u.name}</div>
                          {u.email && <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{u.email}</div>}
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{u.withdrawalReason || 'Early withdrawal'}</div>
                          {u.withdrawalDetail && (
                            <div className="text-[11px] text-slate-500 font-medium italic pt-2 break-words">{u.withdrawalDetail}</div>
                          )}
                        </div>
                      </div>

                      <div className="w-full md:w-[520px] grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{t.access}</div>
                          <select
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-700"
                            value={accessValue}
                            onChange={(e) => {
                              setAccessOverrides((prev) => ({ ...prev, [u.id]: e.target.value as PostProgramAccessLevel }));
                              setDirty((prev) => ({ ...prev, [u.id]: true }));
                            }}
                          >
                            <option value="REVOCATION">REVOCATION</option>
                            <option value="LIMITED">LIMITED</option>
                            <option value="EXTENDED">EXTENDED</option>
                          </select>
                        </div>

                        <div>
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{t.retention}</div>
                          <input
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[10px] font-black tracking-widest text-slate-700"
                            value={retentionValue}
                            onChange={(e) => {
                              setRetentionOverrides((prev) => ({ ...prev, [u.id]: e.target.value }));
                              setDirty((prev) => ({ ...prev, [u.id]: true }));
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 items-stretch">
                        <button
                          onClick={() => void handleRestore(u.id)}
                          className="px-5 py-3 bg-white border border-slate-200 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:border-rose-200 transition-all"
                        >
                          {t.restore}
                        </button>

                        {isDirty && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => void handleSave(u.id)}
                              className="px-5 py-3 bg-[#111827] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
                            >
                              {t.save}
                            </button>
                            <button
                              onClick={() => handleCancel(u.id)}
                              className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                            >
                              {t.cancel}
                            </button>
                          </div>
                        )}

                        {isDirty && (
                          <div className="text-[10px] font-black text-amber-700 uppercase tracking-widest">{t.unsaved}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WithdrawnWithdrawalUsersPage;
