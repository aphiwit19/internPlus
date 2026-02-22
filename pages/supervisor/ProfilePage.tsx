import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';

import { UserProfile, Language } from '@/types';
import ProfileCard from '@/components/ProfileCard';
import { firestoreDb, firebaseAuth } from '@/firebase';

interface SupervisorProfilePageProps {
  user: UserProfile;
  lang: Language;
}

const SupervisorProfilePage: React.FC<SupervisorProfilePageProps> = ({ user, lang: _lang }) => {
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));
  const internCount = user.assignedInterns?.length ?? 0;

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
    lineId: '',
  });

  useEffect(() => {
    setEditForm({
      name: user.name || '',
      phone: user.phone || '',
      department: user.department || '',
      position: user.position || '',
      lineId: user.lineId || '',
    });
  }, [user]);

  const handleSaveProfile = async () => {
    await updateDoc(doc(firestoreDb, 'users', user.id), {
      name: editForm.name,
      phone: editForm.phone,
      department: editForm.department,
      position: editForm.position,
      lineId: editForm.lineId,
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
      setPwError(tr('supervisor_profile.password.errors.user_not_found'));
      return;
    }

    if (!pwForm.currentPassword.trim() || !pwForm.newPassword.trim()) {
      setPwError(tr('supervisor_profile.password.errors.fill_all'));
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmNewPassword) {
      setPwError(tr('supervisor_profile.password.errors.confirm_mismatch'));
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwError(tr('supervisor_profile.password.errors.min_6'));
      return;
    }

    setIsPwSaving(true);
    try {
      const cred = EmailAuthProvider.credential(email, pwForm.currentPassword);
      await reauthenticateWithCredential(fbUser, cred);
      await updatePassword(fbUser, pwForm.newPassword);
      setPwSuccess(tr('supervisor_profile.password.success'));
      setPwForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      const code = String(e?.code ?? 'unknown');
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPwError(tr('supervisor_profile.password.errors.wrong_current'));
      } else if (code === 'auth/too-many-requests') {
        setPwError(tr('supervisor_profile.password.errors.too_many'));
      } else if (code === 'auth/requires-recent-login') {
        setPwError(tr('supervisor_profile.password.errors.relogin'));
      } else {
        setPwError(`${e?.message ?? tr('supervisor_profile.password.errors.generic')}`);
      }
    } finally {
      setIsPwSaving(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col p-4 md:p-6 lg:p-10 bg-[#F8FAFC]">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6 px-2">
        <div className="animate-in fade-in slide-in-from-left-4">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.35em] mb-2">{tr('supervisor_profile.breadcrumb')}</p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
            {tr('supervisor_profile.title')}
          </h1>
          <p className="text-slate-400 text-sm font-medium mt-3">
            {tr('supervisor_profile.subtitle')}
          </p>
        </div>

        <button
          onClick={() => setIsEditing(true)}
          className="px-8 py-4 bg-blue-600 text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
        >
          {tr('supervisor_profile.actions.edit')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
        <div className="grid grid-cols-12 gap-8 max-w-[1700px] mx-auto">
          <div className="col-span-12 lg:col-span-4">
            <ProfileCard user={user} lang={_lang} enableAvatarUpload hideInternshipPeriod />
          </div>

          <div className="col-span-12 lg:col-span-8 space-y-8">
            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                {tr('supervisor_profile.overview.title')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <StatTile
                  label={tr('supervisor_profile.overview.assigned_interns')}
                  value={String(internCount)}
                />
                <StatTile label={tr('supervisor_profile.overview.role')} value={tr('supervisor_profile.overview.role_value')} />
                <StatTile label={tr('supervisor_profile.overview.department')} value={user.department || '-'} />
              </div>
            </div>

            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  {tr('supervisor_profile.account_settings.title')}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ActionTile
                  title={tr('supervisor_profile.account_settings.edit_personal_info.title')}
                  subtitle={tr('supervisor_profile.account_settings.edit_personal_info.subtitle')}
                  onClick={() => setIsEditing(true)}
                />
              </div>
            </div>

            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">{tr('supervisor_profile.security.title')}</h3>
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50 border border-slate-100 rounded-[2rem] p-8">
                <div>
                  <div className="text-sm font-black text-slate-900 tracking-tight">{tr('supervisor_profile.security.change_password.title')}</div>
                  <div className="text-sm text-slate-500 font-medium mt-2">
                    {canChangePassword
                      ? tr('supervisor_profile.security.change_password.subtitle')
                      : tr('supervisor_profile.security.change_password.no_password_provider')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openChangePassword}
                  disabled={!canChangePassword}
                  className="px-8 py-4 bg-slate-900 text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95 disabled:opacity-50"
                >
                  {tr('supervisor_profile.security.change_password.button')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEditing && (
        <EditProfileModal
          lang={_lang}
          form={editForm}
          onChange={setEditForm}
          onClose={() => setIsEditing(false)}
          onSave={() => void handleSaveProfile()}
        />
      )}

      {isChangingPassword && (
        <ChangePasswordModal
          lang={_lang}
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
    <div className="text-4xl font-black text-slate-900 tracking-tighter mt-3">{value}</div>
  </div>
);

const ActionTile: React.FC<{ title: string; subtitle: string; onClick?: () => void }> = ({ title, subtitle, onClick }) => (
  <button onClick={onClick} className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 text-left hover:bg-white hover:shadow-xl hover:border-blue-100 transition-all">
    <div className="text-sm font-black text-slate-900 tracking-tight">{title}</div>
    <div className="text-sm text-slate-500 font-medium mt-3 leading-relaxed">{subtitle}</div>
  </button>
);

const EditProfileModal: React.FC<{
  lang: Language;
  form: { name: string; phone: string; department: string; position: string; lineId: string };
  onChange: (next: { name: string; phone: string; department: string; position: string; lineId: string }) => void;
  onClose: () => void;
  onSave: () => void;
}> = ({ lang, form, onChange, onClose, onSave }) => {
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, { ...(options ?? {}), lng: lang === 'TH' ? 'th' : 'en' }));

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]" onClick={onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{tr('supervisor_profile.edit_modal.title')}</h3>
            </div>
            <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all">
              <X size={18} />
            </button>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={tr('supervisor_profile.edit_modal.fields.name')} value={form.name} onChange={(v) => onChange({ ...form, name: v })} />
              <Field label={tr('supervisor_profile.edit_modal.fields.phone')} value={form.phone} onChange={(v) => onChange({ ...form, phone: v })} />
              <Field label={tr('supervisor_profile.edit_modal.fields.department')} value={form.department} onChange={(v) => onChange({ ...form, department: v })} />
              <Field label={tr('supervisor_profile.edit_modal.fields.position')} value={form.position} onChange={(v) => onChange({ ...form, position: v })} />
              <Field label={tr('supervisor_profile.edit_modal.fields.line_id')} value={form.lineId} onChange={(v) => onChange({ ...form, lineId: v })} />
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button onClick={onClose} className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all">
                {tr('supervisor_profile.edit_modal.actions.cancel')}
              </button>
              <button onClick={onSave} className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20">
                {tr('supervisor_profile.edit_modal.actions.save')}
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
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, { ...(options ?? {}), lng: lang === 'TH' ? 'th' : 'en' }));

  const [revealCurrent, setRevealCurrent] = useState(false);
  const [revealNext, setRevealNext] = useState(false);
  const [revealConfirm, setRevealConfirm] = useState(false);

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]" onClick={onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{tr('supervisor_profile.password.modal.title')}</h3>
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
                label={tr('supervisor_profile.password.modal.fields.current')}
                value={form.currentPassword}
                onChange={(v) => onChange({ ...form, currentPassword: v })}
                reveal={revealCurrent}
                onToggleReveal={() => setRevealCurrent((v) => !v)}
              />
              <div className="hidden md:block" />
              <PasswordField
                label={tr('supervisor_profile.password.modal.fields.next')}
                value={form.newPassword}
                onChange={(v) => onChange({ ...form, newPassword: v })}
                reveal={revealNext}
                onToggleReveal={() => setRevealNext((v) => !v)}
              />
              <PasswordField
                label={tr('supervisor_profile.password.modal.fields.confirm')}
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
                {tr('supervisor_profile.password.modal.actions.cancel')}
              </button>
              <button
                onClick={onSave}
                disabled={isSaving}
                className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 disabled:opacity-50"
              >
                {tr('supervisor_profile.password.modal.actions.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SupervisorProfilePage;
