import React from 'react';
import { Camera, Mail, GraduationCap, Phone, MapPin } from 'lucide-react';
import { UserProfile, Language } from '@/types';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { firestoreDb, firebaseStorage } from '@/firebase';
import { useTranslation } from 'react-i18next';

interface ProfileCardProps {
  user: UserProfile;
  lang: Language;
  enableAvatarUpload?: boolean;
  hideInternshipPeriod?: boolean;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ user, lang: _lang, enableAvatarUpload, hideInternshipPeriod }) => {
  const { t } = useTranslation();
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const [avatarUploadError, setAvatarUploadError] = React.useState<string | null>(null);

  const primaryRole = user.roles[0] ?? 'INTERN';
  const primaryRoleLabel =
    primaryRole === 'HR_ADMIN'
      ? t('roles.hr_admin')
      : primaryRole === 'SUPERVISOR'
        ? t('roles.supervisor')
        : t('roles.intern');

  const handleAvatarSelected = async (file: File | null) => {
    if (!enableAvatarUpload || !file) return;

    setAvatarUploadError(null);

    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      setAvatarUploadError(t('profile_card.errors.image_only'));
      return;
    }

    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setAvatarUploadError(t('profile_card.errors.image_max_5mb'));
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `avatars/${user.id}/${Date.now()}_${safeName}`;
      const ref = storageRef(firebaseStorage, path);
      await uploadBytes(ref, file);
      const url = await getDownloadURL(ref);
      await updateDoc(doc(firestoreDb, 'users', user.id), {
        avatar: url,
        updatedAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setAvatarUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? t('common.upload_failed')}`);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col items-center relative h-full transition-all group">
      {enableAvatarUpload ? (
        <input
          type="file"
          accept="image/*"
          className="hidden"
          id={`profile-card-avatar-upload-${user.id}`}
          onChange={(e) => void handleAvatarSelected(e.target.files?.[0] ?? null)}
        />
      ) : null}

      {avatarUploadError ? (
        <div className="w-full mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl px-5 py-4 text-sm font-bold">
          {avatarUploadError}
        </div>
      ) : null}

      {/* Profile Image with Camera overlay */}
      <div className="relative mb-8">
        <div className="w-36 h-36 rounded-[3.5rem] overflow-hidden ring-8 ring-slate-50 shadow-2xl transition-transform group-hover:scale-[1.02] duration-500">
          <img 
            src={user.avatar} 
            alt={user.name} 
            className="w-full h-full object-cover"
          />
        </div>
        <button
          type="button"
          disabled={!enableAvatarUpload || isUploadingAvatar}
          onClick={() => {
            if (!enableAvatarUpload) return;
            const input = document.getElementById(`profile-card-avatar-upload-${user.id}`) as HTMLInputElement | null;
            if (input) input.click();
          }}
          className="absolute bottom-1 right-1 bg-blue-600 text-white p-3 rounded-2xl shadow-xl border-4 border-white hover:bg-blue-700 transition-all hover:rotate-12 disabled:opacity-50"
        >
          <Camera size={18} />
        </button>
      </div>

      {/* Name and Role */}
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black text-slate-900 leading-tight tracking-tight">{user.name}</h2>
        <div className="flex items-center justify-center gap-2 mt-2">
          <p className="text-blue-600 font-black text-[11px] uppercase tracking-[0.2em]">{primaryRoleLabel}</p>
          <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
          <p className="text-slate-400 font-bold text-[11px] uppercase tracking-widest">{user.systemId}</p>
        </div>
      </div>

      {/* Position and Period Boxes */}
      <div className="w-full flex flex-col gap-3 mb-10">
        <div className="bg-[#F8FAFC] p-5 rounded-[1.75rem] border border-slate-100 flex flex-col justify-center transition-all hover:bg-white hover:shadow-lg hover:border-blue-100 group/item">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <div className="w-1.5 h-4 bg-blue-600 rounded-full opacity-40 group-hover/item:opacity-100 transition-opacity"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('profile_card.labels.current_position')}</span>
          </div>
          <p className="text-[14px] font-black text-slate-900 leading-tight tracking-tight">{user.position || t('common.not_assigned')}</p>
        </div>
        {!hideInternshipPeriod ? (
          <div className="bg-[#F8FAFC] p-5 rounded-[1.75rem] border border-slate-100 flex flex-col justify-center transition-all hover:bg-white hover:shadow-lg hover:border-blue-100 group/item">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <div className="w-1.5 h-4 bg-indigo-600 rounded-full opacity-40 group-hover/item:opacity-100 transition-opacity"></div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('profile_card.labels.internship_period')}</span>
            </div>
            <p className="text-[14px] font-black text-slate-900 leading-tight tracking-tight">{user.internPeriod || t('common.tbd')}</p>
          </div>
        ) : null}
      </div>

      {/* Detailed Info Rows */}
      <div className="w-full space-y-6 px-1 mt-auto">
        <div className="flex justify-between items-center group/row cursor-default">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover/row:text-blue-600 transition-colors">
               <GraduationCap size={16} />
             </div>
             <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{t('profile_card.labels.department')}</span>
          </div>
          <span className="text-[12px] font-black text-slate-800">{user.department}</span>
        </div>

        <div className="flex justify-between items-center group/row cursor-default">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover/row:text-blue-600 transition-colors">
               <Mail size={16} />
             </div>
             <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{t('profile_card.labels.email')}</span>
          </div>
          <span className="text-[12px] font-black text-slate-800 truncate max-w-[140px] text-right">{user.email}</span>
        </div>

        <div className="flex justify-between items-center group/row cursor-default">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover/row:text-blue-600 transition-colors">
               <Phone size={16} />
             </div>
             <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{t('profile_card.labels.phone')}</span>
          </div>
          <span className="text-[12px] font-black text-slate-800">{user.phone || '--'}</span>
        </div>
      </div>
      
      {/* Bottom Footer Decor */}
      <div className="mt-12 flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">
        <MapPin size={10} /> {t('common.hq_operations_sf')}
      </div>
    </div>
  );
};

export default ProfileCard;
