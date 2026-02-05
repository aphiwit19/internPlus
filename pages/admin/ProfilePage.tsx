import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';

import { UserProfile, Language } from '@/types';
import ProfileCard from '@/components/ProfileCard';
import { firestoreDb } from '@/firebase';

interface AdminProfilePageProps {
  user: UserProfile;
  lang: Language;
}

const AdminProfilePage: React.FC<AdminProfilePageProps> = ({ user, lang }) => {
  const roleLabel = user.roles.includes('HR_ADMIN') ? (lang === 'TH' ? 'ผู้ดูแลระบบ' : 'Administrator') : user.roles[0];

  const [isEditing, setIsEditing] = useState(false);
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
            <ProfileCard user={user} lang={lang} enableAvatarUpload />
          </div>

          <div className="col-span-12 lg:col-span-8 space-y-8">
            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">{lang === 'TH' ? 'ภาพรวมผู้ดูแลระบบ' : 'Admin Overview'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <StatTile label={lang === 'TH' ? 'บทบาท' : 'Role'} value={String(roleLabel)} />
                <StatTile label={lang === 'TH' ? 'แผนก' : 'Department'} value={user.department || '-'} />
                <StatTile label={lang === 'TH' ? 'รหัสระบบ' : 'System ID'} value={user.systemId} />
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

export default AdminProfilePage;
