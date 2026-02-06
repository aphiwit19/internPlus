import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

import { UserProfile, Language } from '@/types';
import ProfileCard from '@/components/ProfileCard';
import { firestoreDb } from '@/firebase';

interface SupervisorProfilePageProps {
  user: UserProfile;
  lang: Language;
}

const SupervisorProfilePage: React.FC<SupervisorProfilePageProps> = ({ user, lang: _lang }) => {
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));
  const internCount = user.assignedInterns?.length ?? 0;

  const [isEditing, setIsEditing] = useState(false);
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
            <ProfileCard user={user} lang={_lang} enableAvatarUpload />
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

export default SupervisorProfilePage;
