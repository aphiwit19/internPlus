import React, { useRef } from 'react';
import { CheckCircle2, Upload, Loader2 } from 'lucide-react';
import { DocumentStatus } from '@/types';
import { useTranslation } from 'react-i18next';

interface DocumentCardProps {
  doc: DocumentStatus;
  onUpload: (id: string, file: File) => void;
}

const DocumentCard: React.FC<DocumentCardProps> = ({ doc, onUpload }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  const handleButtonClick = () => {
    if (!doc.isUploaded && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      // Simulate network delay
      setTimeout(() => {
        onUpload(doc.id, file);
        setIsUploading(false);
      }, 1000);
    }
  };

  return (
    <div className="bg-white p-3.5 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-colors shadow-sm">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept=".pdf,.jpg,.jpeg,.png"
      />
      
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors flex-shrink-0">
          {doc.icon}
        </div>
        <div className="overflow-hidden">
          <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{doc.label}</h5>
          <p className={`text-[11px] font-bold truncate ${doc.isUploaded ? 'text-slate-800' : 'text-slate-500'}`}>
            {doc.fileName || t('common.not_uploaded')}
          </p>
        </div>
      </div>

      <button 
        onClick={handleButtonClick}
        disabled={isUploading}
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
          doc.isUploaded 
            ? 'bg-green-50 text-green-500 border border-green-100 cursor-default' 
            : 'bg-blue-50 text-blue-500 border border-blue-100 hover:bg-blue-500 hover:text-white active:scale-90'
        }`}
      >
        {isUploading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : doc.isUploaded ? (
          <CheckCircle2 size={14} />
        ) : (
          <Upload size={14} />
        )}
      </button>
    </div>
  );
};

export default DocumentCard;
