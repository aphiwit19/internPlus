import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';

import { UserProfile, Language } from '@/types';
import ProfileCard from '@/components/ProfileCard';
import { firestoreDb, firebaseAuth } from '@/firebase';

interface AdminProfilePageProps {
  user: UserProfile;
  lang: Language;
}

const AdminProfilePage: React.FC<AdminProfilePageProps> = ({ user, lang }) => {
  const roleLabel = user.roles.includes('HR_ADMIN') ? (lang === 'TH' ? 'ผู้ดูแลระบบ' : 'Administrator') : user.roles[0];

  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [isPwSaving, setIsPwSaving] = useState(false);

  const canChangePassword = useMemo(() => {
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) return false;
    const providers = Array.isArray(fbUser.providerData) ? fbUser.providerData.map((p) => p?.providerId).filter(Boolean) : [];
    return providers.includes('password');
  }, [user.id]);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    department: '',
    position: '',
  });

  useEffect(() => {
    setEditForm({
      name: user.name || '',
      phone: user.phone || '',
      department: user.department || '',
      position: user.position || '',
    });
  }, [user]);

  const handleSaveProfile = async () => {
    await updateDoc(doc(firestoreDb, 'users', user.id), {
      name: editForm.name,
      phone: editForm.phone,
      department: editForm.department,
      position: editForm.position,
    });
    setIsEditing(false);
  };

  const openChangePassword = () => {
    setPwError(null);
    setPwSuccess(null);
    setPwForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    setIsChangingPassword(true);
  };

  const handleChangePassword = async () => {
    if (isPwSaving) return;
    setPwError(null);
    setPwSuccess(null);

    const fbUser = firebaseAuth.currentUser;
    const email = fbUser?.email ?? '';
    if (!fbUser || !email) {
      setPwError(lang === 'TH' ? 'ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่' : 'User not found. Please sign in again.');
      return;
    }

    if (!pwForm.currentPassword.trim() || !pwForm.newPassword.trim()) {
      setPwError(lang === 'TH' ? 'กรุณากรอกรหัสผ่านให้ครบ' : 'Please fill in all password fields.');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmNewPassword) {
      setPwError(lang === 'TH' ? 'ยืนยันรหัสผ่านใหม่ไม่ตรงกัน' : 'New password confirmation does not match.');
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwError(lang === 'TH' ? 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' : 'New password must be at least 6 characters.');
      return;
    }

    setIsPwSaving(true);
    try {
      const cred = EmailAuthProvider.credential(email, pwForm.currentPassword);
      await reauthenticateWithCredential(fbUser, cred);
      await updatePassword(fbUser, pwForm.newPassword);
      setPwSuccess(lang === 'TH' ? 'เปลี่ยนรหัสผ่านสำเร็จ' : 'Password changed successfully.');
      setPwForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      const code = String(e?.code ?? 'unknown');
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPwError(lang === 'TH' ? 'รหัสผ่านเดิมไม่ถูกต้อง' : 'Current password is incorrect.');
      } else if (code === 'auth/too-many-requests') {
        setPwError(lang === 'TH' ? 'มีการลองหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง' : 'Too many attempts. Please try again later.');
      } else if (code === 'auth/requires-recent-login') {
        setPwError(lang === 'TH' ? 'กรุณาออกจากระบบและเข้าสู่ระบบใหม่ แล้วลองอีกครั้ง' : 'Please sign out and sign in again, then try again.');
      } else {
        setPwError(`${e?.message ?? (lang === 'TH' ? 'เปลี่ยนรหัสผ่านไม่สำเร็จ' : 'Failed to change password.')}`);
      }
    } finally {
      setIsPwSaving(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col p-4 md:p-6 lg:p-10 bg-[#F8FAFC]">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6 px-2">
        <div className="animate-in fade-in slide-in-from-left-4">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.35em] mb-2">{lang === 'TH' ? 'ตั้งค่า > บัญชี' : 'SETTINGS > ACCOUNT'}</p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{lang === 'TH' ? 'โปรไฟล์ผู้ดูแลระบบ' : 'Admin Profile'}</h1>
          <p className="text-slate-400 text-sm font-medium mt-3">
            {lang === 'TH' ? 'จัดการข้อมูลบัญชี และการตั้งค่าระบบที่เกี่ยวข้อง' : 'Manage your account details and system-related settings.'}
          </p>
        </div>

        <button
          onClick={() => setIsEditing(true)}
          className="px-8 py-4 bg-blue-600 text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
        >
          {lang === 'TH' ? 'แก้ไข' : 'EDIT'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
        <div className="grid grid-cols-12 gap-8 max-w-[1700px] mx-auto">
          <div className="col-span-12 lg:col-span-4">
            <ProfileCard user={user} lang={lang} enableAvatarUpload hideInternshipPeriod />
          </div>

          <div className="col-span-12 lg:col-span-8 space-y-8">
            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">{lang === 'TH' ? 'ภาพรวมผู้ดูแลระบบ' : 'Admin Overview'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <StatTile label={lang === 'TH' ? 'บทบาท' : 'Role'} value={String(roleLabel)} />
                <StatTile label={lang === 'TH' ? 'แผนก' : 'Department'} value={user.department || '-'} />
              </div>
            </div>

            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">{lang === 'TH' ? 'รายการที่แนะนำ' : 'Recommended'}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ActionTile
                  title={lang === 'TH' ? 'จัดการคำเชิญ' : 'Manage Invitations'}
                  subtitle={lang === 'TH' ? 'สร้างบัญชี intern/supervisor ใหม่ และกำหนดสิทธิ์' : 'Create intern/supervisor accounts and assign roles.'}
                />
                <ActionTile
                  title={lang === 'TH' ? 'ตั้งค่าระบบ' : 'System Settings'}
                  subtitle={lang === 'TH' ? 'ปรับ onboarding steps และค่าคอนฟิกระบบ' : 'Configure onboarding steps and system options.'}
                />
              </div>
            </div>

            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">{lang === 'TH' ? 'ความปลอดภัย' : 'Security'}</h3>
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50 border border-slate-100 rounded-[2rem] p-8">
                <div>
                  <div className="text-sm font-black text-slate-900 tracking-tight">{lang === 'TH' ? 'เปลี่ยนรหัสผ่าน' : 'Change password'}</div>
                  <div className="text-sm text-slate-500 font-medium mt-2">
                    {canChangePassword
                      ? lang === 'TH'
                        ? 'ต้องยืนยันรหัสผ่านเดิมก่อนจึงจะเปลี่ยนได้'
                        : 'You will be asked to confirm your current password before changing it.'
                      : lang === 'TH'
                        ? 'บัญชีนี้ไม่ได้ใช้การเข้าสู่ระบบแบบรหัสผ่าน'
                        : 'This account does not use password sign-in.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openChangePassword}
                  disabled={!canChangePassword}
                  className="px-8 py-4 bg-slate-900 text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95 disabled:opacity-50"
                >
                  {lang === 'TH' ? 'เปลี่ยนรหัสผ่าน' : 'CHANGE PASSWORD'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEditing && (
        <EditProfileModal
          lang={lang}
          form={editForm}
          onChange={setEditForm}
          onClose={() => setIsEditing(false)}
          onSave={() => void handleSaveProfile()}
        />
      )}

      {isChangingPassword && (
        <ChangePasswordModal
          lang={lang}
          form={pwForm}
          error={pwError}
          success={pwSuccess}
          isSaving={isPwSaving}
          onChange={setPwForm}
          onClose={() => setIsChangingPassword(false)}
          onSave={() => void handleChangePassword()}
        />
      )}
    </div>
  );
};

const StatTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8">
    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{label}</div>
    <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter mt-3 truncate">{value}</div>
  </div>
);

const ActionTile: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8">
    <div className="text-sm font-black text-slate-900 tracking-tight">{title}</div>
    <div className="text-sm text-slate-500 font-medium mt-3 leading-relaxed">{subtitle}</div>
  </div>
);

const EditProfileModal: React.FC<{
  lang: Language;
  form: { name: string; phone: string; department: string; position: string };
  onChange: (next: { name: string; phone: string; department: string; position: string }) => void;
  onClose: () => void;
  onSave: () => void;
}> = ({ lang, form, onChange, onClose, onSave }) => {
  const t = {
    EN: {
      title: 'Edit Profile',
      save: 'Save',
      cancel: 'Cancel',
      name: 'Name',
      phone: 'Phone',
      department: 'Department',
      position: 'Position',
    },
    TH: {
      title: 'แก้ไขโปรไฟล์',
      save: 'บันทึก',
      cancel: 'ยกเลิก',
      name: 'ชื่อ',
      phone: 'เบอร์โทร',
      department: 'แผนก',
      position: 'ตำแหน่ง',
    },
  }[lang];

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]" onClick={onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{t.title}</h3>
            </div>
            <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all">
              <X size={18} />
            </button>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t.name} value={form.name} onChange={(v) => onChange({ ...form, name: v })} />
              <Field label={t.phone} value={form.phone} onChange={(v) => onChange({ ...form, phone: v })} />
              <Field label={t.department} value={form.department} onChange={(v) => onChange({ ...form, department: v })} />
              <Field label={t.position} value={form.position} onChange={(v) => onChange({ ...form, position: v })} />
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button onClick={onClose} className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all">
                {t.cancel}
              </button>
              <button onClick={onSave} className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20">
                {t.save}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <label className="space-y-2">
    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
    />
  </label>
);

const PasswordField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  reveal: boolean;
  onToggleReveal: () => void;
}> = ({ label, value, onChange, reveal, onToggleReveal }) => (
  <label className="space-y-2">
    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
    <div className="relative">
      <input
        type={reveal ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pr-14 px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
      />
      <button
        type="button"
        onClick={onToggleReveal}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-all"
        aria-label={reveal ? 'Hide password' : 'Show password'}
      >
        {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  </label>
);

const ChangePasswordModal: React.FC<{
  lang: Language;
  form: { currentPassword: string; newPassword: string; confirmNewPassword: string };
  error: string | null;
  success: string | null;
  isSaving: boolean;
  onChange: (next: { currentPassword: string; newPassword: string; confirmNewPassword: string }) => void;
  onClose: () => void;
  onSave: () => void;
}> = ({ lang, form, error, success, isSaving, onChange, onClose, onSave }) => {
  const [revealCurrent, setRevealCurrent] = useState(false);
  const [revealNext, setRevealNext] = useState(false);
  const [revealConfirm, setRevealConfirm] = useState(false);

  const t = {
    EN: {
      title: 'Change Password',
      current: 'Current password',
      next: 'New password',
      confirm: 'Confirm new password',
      cancel: 'Cancel',
      save: 'Update',
    },
    TH: {
      title: 'เปลี่ยนรหัสผ่าน',
      current: 'รหัสผ่านเดิม',
      next: 'รหัสผ่านใหม่',
      confirm: 'ยืนยันรหัสผ่านใหม่',
      cancel: 'ยกเลิก',
      save: 'อัปเดต',
    },
  }[lang];

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]" onClick={onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{t.title}</h3>
            </div>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>
          <div className="p-8">
            {error ? <div className="mb-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl px-5 py-4 text-xs font-bold">{error}</div> : null}
            {success ? <div className="mb-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl px-5 py-4 text-xs font-bold">{success}</div> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PasswordField
                label={t.current}
                value={form.currentPassword}
                onChange={(v) => onChange({ ...form, currentPassword: v })}
                reveal={revealCurrent}
                onToggleReveal={() => setRevealCurrent((v) => !v)}
              />
              <div className="hidden md:block" />
              <PasswordField
                label={t.next}
                value={form.newPassword}
                onChange={(v) => onChange({ ...form, newPassword: v })}
                reveal={revealNext}
                onToggleReveal={() => setRevealNext((v) => !v)}
              />
              <PasswordField
                label={t.confirm}
                value={form.confirmNewPassword}
                onChange={(v) => onChange({ ...form, confirmNewPassword: v })}
                reveal={revealConfirm}
                onToggleReveal={() => setRevealConfirm((v) => !v)}
              />
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                onClick={onSave}
                disabled={isSaving}
                className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 disabled:opacity-50"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminProfilePage;
