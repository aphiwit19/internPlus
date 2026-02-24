import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Rocket, 
  CreditCard, 
  Lock, 
  Plus, 
  Trash2, 
  Check, 
  ChevronRight, 
  Save, 
  AlertCircle, 
  Users,
  Calendar,
  Clock,
  ShieldCheck,
  Briefcase,
  Layers,
  Percent,
  Calculator,
  ChevronDown,
  X,
  Upload,
  PenTool,
  ExternalLink,
  MousePointer2,
  FileText,
  MessageSquare,
  Video,
  CheckCircle2,
  Workflow,
  Globe,
  Monitor,
  Trophy,
  History,
  Tag,
  Paperclip,
  FileSearch,
  Settings2,
  Edit3,
  Settings,
  Zap,
  Navigation,
  FileBadge,
  FileCheck,
  GraduationCap,
  Coins,
  ShieldAlert,
  Key,
  Fingerprint,
  Eye,
  EyeOff,
  Circle,
  ClipboardList
} from 'lucide-react';
import { NAV_ITEMS } from '@/constants';
import { Language, PostProgramAccessLevel, UserRole } from '@/types';
import { useAppContext } from '@/app/AppContext';
import { firestoreDb, firebaseStorage } from '@/firebase';
import { normalizeAvatarUrl } from '@/app/avatar';
import { PageId } from '@/pageTypes';
import { collection, deleteField, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

import PolicyTrainingManager from '@/pages/admin/components/PolicyTrainingManager';

type SettingsTab = 'onboarding' | 'policy' | 'allowance' | 'access' | 'evaluation';

type ProcessType = 'DOC_UPLOAD' | 'NDA_SIGN' | 'MODULE_LINK' | 'EXTERNAL_URL';

type EvaluationLabels = {
  technical: string;
  communication: string;
  punctuality: string;
  initiative: string;
  overallComments: string;
  workPerformance: string;
};

 type DashboardPreviewLabels = {
   metrics: string[];
   comments: string[];
 };

type WithdrawalUserRow = {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  withdrawalReason?: string;
  withdrawalDetail?: string;
  postProgramAccessLevel?: PostProgramAccessLevel;
  postProgramRetentionPeriod?: string;
  updatedAt?: any;
};

type CompletedOffboardingUserRow = {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  postProgramAccessLevel?: PostProgramAccessLevel;
  postProgramRetentionPeriod?: string;
  offboardingRequestedAt?: any;
};

type PendingUserOperation =
  | {
      type: 'APPLY_WITHDRAWAL';
      userId: string;
      accessLevel: PostProgramAccessLevel;
      retentionPeriod: string;
      name: string;
      avatar: string;
      email?: string;
      withdrawalReason?: string;
      withdrawalDetail?: string;
    }
  | {
      type: 'APPLY_OFFBOARDING';
      userId: string;
      accessLevel: PostProgramAccessLevel;
      retentionPeriod: string;
      name: string;
      avatar: string;
      email?: string;
      offboardingTasks?: any[];
    }
  | {
      type: 'UPDATE_POST_PROGRAM';
      userId: string;
      accessLevel?: PostProgramAccessLevel;
      retentionPeriod?: string;
      name: string;
      avatar: string;
      email?: string;
      offboardingTasks?: any[];
    }
  | {
      type: 'RESTORE_ACTIVE';
      userId: string;
      name: string;
      avatar: string;
      email?: string;
    };

interface RoadmapStep {
  id: string;
  title: string;
  active: boolean;
  type: ProcessType;
  targetPage?: PageId;
  externalUrl?: string;
  attachedDocuments: string[];
}

const DEFAULT_ONBOARDING_STEPS: RoadmapStep[] = [
  { id: '1', title: 'Submit Documents (ID, Transcript)', active: true, type: 'DOC_UPLOAD', targetPage: 'profile', attachedDocuments: ['Standard_Verification_Pack.pdf', 'Educational_Consent_Form.pdf'] },
  { id: '2', title: 'Sign Policy & NDA Documents', active: true, type: 'NDA_SIGN', targetPage: 'training', attachedDocuments: ['Company_NDA_v2024.pdf', 'IT_Security_Policy.pdf'] },
  { id: '3', title: 'Check First Project Assignment', active: true, type: 'MODULE_LINK', targetPage: 'assignment', attachedDocuments: [] },
  { id: '4', title: 'Mid-term Performance Sync', active: true, type: 'MODULE_LINK', targetPage: 'feedback', attachedDocuments: [] },
];

interface SystemSettingsPageProps {
  lang: Language;
}

const SystemSettingsPage: React.FC<SystemSettingsPageProps> = ({ lang }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('onboarding');
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const saveNoticeTimeoutRef = useRef<number | null>(null);
  const [didSaveRecently, setDidSaveRecently] = useState(false);
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepType, setNewStepType] = useState<ProcessType>('MODULE_LINK');
  const [newStepTargetPage, setNewStepTargetPage] = useState<PageId | undefined>(undefined);
  const [newStepExternalUrl, setNewStepExternalUrl] = useState('');

  const [evalEditHeadingsOpen, setEvalEditHeadingsOpen] = useState(true);
  const [evalEditPreviewOpen, setEvalEditPreviewOpen] = useState(true);

  const [dialog, setDialog] = useState<{
    open: boolean;
    mode: 'alert' | 'confirm';
    title?: string;
    message: string;
  } | null>(null);
  const dialogResolveRef = useRef<((v: boolean) => void) | null>(null);

  const t = {
    EN: {
      title: "System Settings",
      subtitle: "Global configuration for internship workflows and automation.",
      tabOnboarding: "Onboarding",
      tabPolicy: "Policy & Training",
      tabAllowance: "Allowance",
      tabAccess: "Access Control",
      tabEvaluation: "Evaluation Management",
      saveBtn: "Deploy Config",
      saving: "Saving...",
      reset: "Reset Default",
      disclaimer: "Settings affect all users in current program",
      engineTitle: "Onboarding Flow Engine",
      engineSub: "CONFIGURE INTERNAL PROCESS MAPPING",
      allowanceTitle: "Allowance Rules",
      allowanceSub: "FINANCIAL DISBURSEMENT LOGIC",
      accessTitle: "Post-Program Access Control",
      accessSub: "MANAGE USER STATUS AFTER OFFBOARDING",
      addStep: "Add Custom Roadmap Step",
      attachDoc: "Attached Templates",
      docsLimit: "No files attached yet",
      targetModule: "Target Module",
      // Onboarding expanded
      processTitle: "Process Title",
      stepLogicType: "Step Logic Type",
      docUploadOpt: "Document Submission (PDF/IMG)",
      ndaSignOpt: "E-Signature Confirmation",
      moduleLinkOpt: "Internal Feature Redirection",
      externalUrlOpt: "External Website Link",
      serveTemplates: "Serve multiple templates for this step",
      addTemplate: "Add New Template",
      targetModuleInfo: "Ensuring a target module is correctly mapped allows the system to provide \"Next Action\" shortcuts on the intern's home screen.",
      doneEditing: "Done Editing",
      stepTitleLabel: "STEP TITLE",
      actionTypeLabel: "ACTION TYPE",
      externalUrlLabel: "EXTERNAL URL",
      targetModuleRedirection: "TARGET MODULE (REDIRECTION)",
      processIntelligence: "Process Intelligence",
      processIntelligenceDesc: "Mapping steps to actual modules ensures correct workspace redirection.",
      autoHandoff: "Auto-Handoff Active",
      customWorkflow: "CUSTOM WORKFLOW STEP",
      integrateNewStep: "Integrate New Step",
      integrateStep: "Integrate Step",
      modulePrefix: "MODULE",
      filesLabel: "FILES",
      // Allowance expanded
      monthlyPayPeriod: "MONTHLY PAY PERIOD",
      cutoffWindow: "Cutoff window & payout date",
      cutoffDesc: "Used for monthly claim calculation and planned payout date.",
      periodStart: "Period Start",
      periodEnd: "Period End",
      plannedPayoutDate: "Planned Payout Date",
      payoutFrequency: "PAYOUT FREQUENCY",
      monthlyOpt: "MONTHLY",
      endProgramOpt: "END PROGRAM",
      wfoRate: "WFO RATE (DAY)",
      wfhRate: "WFH RATE (DAY)",
      applyLocalTax: "APPLY WHT",
      financialDisclaimer: "Financial Disclaimer",
      financialDisclaimerDesc: "Changing calculation methods or rates mid-month will only affect future records. Existing \"Verified\" records will retain original values.",
      // Access control expanded
      standardAccessLevel: "STANDARD ACCESS LEVEL",
      immediateRevocation: "IMMEDIATE REVOCATION",
      immediateRevocationDesc: "Account locked instantly on finish",
      limitedRecommended: "LIMITED (RECOMMENDED)",
      limitedRecommendedDesc: "Only certificates and profile access",
      extendedView: "EXTENDED VIEW",
      extendedViewDesc: "Keep full read-only history",
      defaultRetentionPeriod: "DEFAULT RETENTION PERIOD",
      complianceNote: "COMPLIANT WITH ENTERPRISE DATA RETENTION POLICY V4.0",
      withdrawalRequestsLabel: "WITHDRAWAL REQUESTS",
      offboardingRequestsLabel: "OFFBOARDING REQUESTS",
      tasksCompleted: "tasks completed",
      manageWithdrawnUsers: "MANAGE WITHDRAWN USERS",
      offboardingUsersLabel: "OFFBOARDING USERS",
      withdrawalUsersLabel: "WITHDRAWAL USERS",
      usersCount: "users",
      noOffboardingUsers: "No offboarding users",
      noWithdrawalUsers: "No withdrawal users",
      completedProcess: "Completed process",
      earlyWithdrawal: "Early withdrawal",
      accessLevelLabel: "Access Level",
      retentionLabel: "Retention",
      postProgramAccessList: "POST-PROGRAM ACCESS LIST",
      optRevocation: "REVOCATION",
      optLimited: "LIMITED",
      optExtended: "EXTENDED",
    },
    TH: {
      title: "ตั้งค่าระบบ",
      subtitle: "การกำหนดค่าระดับโกลบอลสำหรับขั้นตอนการทำงานและระบบอัตโนมัติ",
      tabOnboarding: "การรับเข้าทำงาน",
      tabPolicy: "นโยบายและการฝึกอบรม",
      tabAllowance: "เบี้ยเลี้ยง",
      tabAccess: "การเข้าถึง",
      tabEvaluation: "จัดการแบบประเมิน",
      saveBtn: "ปรับใช้การตั้งค่า",
      saving: "กำลังบันทึก...",
      reset: "คืนค่าเริ่มต้น",
      disclaimer: "การตั้งค่าจะมีผลกับผู้ใช้ทุกคนในโปรแกรมปัจจุบัน",
      engineTitle: "เครื่องมือออกแบบการรับเข้าทำงาน",
      engineSub: "กำหนดค่าขั้นตอนการทำงานภายใน",
      allowanceTitle: "กฎระเบียบเบี้ยเลี้ยง",
      allowanceSub: "ตรรกะการจ่ายเงินสนับสนุน",
      accessTitle: "การควบคุมการเข้าถึงหลังจบโปรแกรม",
      accessSub: "จัดการสถานะผู้ใช้หลังจากการพ้นสภาพ",
      addStep: "เพิ่มขั้นตอนแผนผังงานใหม่",
      attachDoc: "แม่แบบเอกสารที่แนบ",
      docsLimit: "ยังไม่มีไฟล์ที่แนบ",
      targetModule: "โมดูลเป้าหมาย",
      // Onboarding expanded
      processTitle: "ชื่อขั้นตอน",
      stepLogicType: "ประเภทการทำงาน",
      docUploadOpt: "อัปโหลดเอกสาร (PDF/IMG)",
      ndaSignOpt: "ลงนามดิจิทัล",
      moduleLinkOpt: "เปลี่ยนเส้นทางภายในระบบ",
      externalUrlOpt: "ลิงก์เว็บไซต์ภายนอก",
      serveTemplates: "แนบแม่แบบหลายรายการสำหรับขั้นตอนนี้",
      addTemplate: "เพิ่มแม่แบบใหม่",
      targetModuleInfo: "การเชื่อมโยงโมดูลเป้าหมายอย่างถูกต้องช่วยให้ระบบแสดงทางลัด \"ขั้นตอนถัดไป\" บนหน้าหลักของนักศึกษา",
      doneEditing: "แก้ไขเสร็จ",
      stepTitleLabel: "ชื่อขั้นตอน",
      actionTypeLabel: "ประเภทการกระทำ",
      externalUrlLabel: "ลิงก์ภายนอก",
      targetModuleRedirection: "โมดูลเป้าหมาย (เปลี่ยนเส้นทาง)",
      processIntelligence: "ระบบอัจฉริยะ",
      processIntelligenceDesc: "การเชื่อมโยงขั้นตอนกับโมดูลจริงช่วยให้เปลี่ยนเส้นทางถูกต้อง",
      autoHandoff: "ส่งมอบอัตโนมัติเปิดใช้งาน",
      customWorkflow: "ขั้นตอนการทำงานที่กำหนดเอง",
      integrateNewStep: "เพิ่มขั้นตอนใหม่",
      integrateStep: "เพิ่มขั้นตอน",
      modulePrefix: "โมดูล",
      filesLabel: "ไฟล์",
      // Allowance expanded
      monthlyPayPeriod: "งวดจ่ายรายเดือน",
      cutoffWindow: "ช่วงคัตออฟและวันจ่าย",
      cutoffDesc: "ใช้สำหรับคำนวณเคลมรายเดือนและวันจ่ายที่วางแผนไว้",
      periodStart: "วันเริ่มต้น",
      periodEnd: "วันสิ้นสุด",
      plannedPayoutDate: "วันจ่ายที่วางแผน",
      payoutFrequency: "ความถี่การจ่าย",
      monthlyOpt: "รายเดือน",
      endProgramOpt: "จบโปรแกรม",
      wfoRate: "อัตรา WFO (วัน)",
      wfhRate: "อัตรา WFH (วัน)",
      applyLocalTax: "เรียกเก็บ VAT",
      financialDisclaimer: "ข้อจำกัดความรับผิดด้านการเงิน",
      financialDisclaimerDesc: "การเปลี่ยนวิธีคำนวณหรืออัตรากลางเดือนจะมีผลเฉพาะรายการในอนาคต รายการที่ \"ตรวจสอบแล้ว\" จะยังคงใช้ค่าเดิม",
      // Access control expanded
      standardAccessLevel: "ระดับการเข้าถึงมาตรฐาน",
      immediateRevocation: "เพิกถอนทันที",
      immediateRevocationDesc: "ล็อคบัญชีทันทีเมื่อเสร็จสิ้น",
      limitedRecommended: "จำกัด (แนะนำ)",
      limitedRecommendedDesc: "เข้าถึงเฉพาะใบรับรองและโปรไฟล์",
      extendedView: "ดูแบบขยาย",
      extendedViewDesc: "เก็บประวัติแบบอ่านอย่างเดียว",
      defaultRetentionPeriod: "ระยะเวลาเก็บรักษาเริ่มต้น",
      complianceNote: "สอดคล้องกับนโยบายการเก็บรักษาข้อมูลองค์กร V4.0",
      withdrawalRequestsLabel: "คำขอถอนตัว",
      offboardingRequestsLabel: "คำขอ Offboarding",
      tasksCompleted: "งานที่เสร็จแล้ว",
      manageWithdrawnUsers: "จัดการผู้ใช้ที่ถอนตัว",
      offboardingUsersLabel: "ผู้ใช้ OFFBOARDING",
      withdrawalUsersLabel: "ผู้ใช้ WITHDRAWAL",
      usersCount: "คน",
      noOffboardingUsers: "ไม่มีผู้ใช้ offboarding",
      noWithdrawalUsers: "ไม่มีผู้ใช้ withdrawal",
      completedProcess: "เสร็จสิ้นกระบวนการ",
      earlyWithdrawal: "ถอนตัวก่อนกำหนด",
      accessLevelLabel: "ระดับการเข้าถึง",
      retentionLabel: "ระยะเวลาเก็บรักษา",
      postProgramAccessList: "รายชื่อสิทธิ์หลังจบโปรแกรม",
      optRevocation: "เพิกถอนทันที",
      optLimited: "จำกัด",
      optExtended: "ขยาย",
    }
  }[lang];

  const [onboardingSteps, setOnboardingSteps] = useState<RoadmapStep[]>(DEFAULT_ONBOARDING_STEPS);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  // Allowance States
  const [payoutFreq, setPayoutFreq] = useState<'MONTHLY' | 'END_PROGRAM'>('MONTHLY');
  const [wfoRate, setWfoRate] = useState(100);
  const [wfhRate, setWfhRate] = useState(50);
  const [applyTax, setApplyTax] = useState(true);
  const [taxPercent, setTaxPercent] = useState(3);
  const [defaultPayoutDay, setDefaultPayoutDay] = useState<number | null>(null);

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const monthKeyFromDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  const payPeriodMonthOptions = Array.from({ length: 12 }, (_, idx) => {
    const base = new Date();
    const x = new Date(base.getFullYear(), base.getMonth() + idx, 1);
    return monthKeyFromDate(x);
  });

  const [dashboardPreviewLabelsByLang, setDashboardPreviewLabelsByLang] = useState<{ EN: DashboardPreviewLabels; TH: DashboardPreviewLabels }>({
    EN: {
      metrics: [
        'TECHNICAL PROFICIENCY',
        'TEAM COMMUNICATION',
        'PUNCTUALITY & RELIABILITY',
        'SELF-INITIATIVE',
      ],
      comments: [
        'OVERALL EVALUATION & COMMENTS',
        'WORK PERFORMANCE',
        'ADDITIONAL COMMENTS',
      ],
    },
    TH: {
      metrics: [
        'ทักษะด้านเทคนิค',
        'การสื่อสารและการทำงานร่วมกัน',
        'ความตรงต่อเวลาและความรับผิดชอบ',
        'ความริเริ่มและการแก้ปัญหา',
      ],
      comments: [
        'ภาพรวมและความคิดเห็น',
        'ผลงานการทำงาน',
        'ความคิดเห็นเพิ่มเติม',
      ],
    },
  });

  const [selectedPayPeriodMonthKey, setSelectedPayPeriodMonthKey] = useState(() => monthKeyFromDate(new Date()));
  const [payPeriodStartDate, setPayPeriodStartDate] = useState('');
  const [payPeriodEndDate, setPayPeriodEndDate] = useState('');
  const [payPeriodPlannedPayoutDate, setPayPeriodPlannedPayoutDate] = useState('');
  const [payPeriodError, setPayPeriodError] = useState<string | null>(null);

  const clampToMonth = (monthKey: string, day: number): string => {
    const [yRaw, mRaw] = monthKey.split('-');
    const y = Number(yRaw);
    const m = Number(mRaw);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return '';
    const max = new Date(y, m, 0).getDate();
    const safeDay = Math.min(Math.max(1, Math.floor(day)), max);
    return `${yRaw}-${String(m).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
  };

  // Access Control States
  const [accessLevel, setAccessLevel] = useState<'REVOCATION' | 'LIMITED' | 'EXTENDED'>('LIMITED');
  const [retentionPeriod, setRetentionPeriod] = useState('1 Month post-offboard');
  const displayRetention = (val: string) => {
    if (lang === 'TH' && val === '1 Month post-offboard') return '1 เดือนหลังพ้นสภาพ';
    if (lang === 'TH' && val === '6 Months post-offboard') return '6 เดือนหลังพ้นสภาพ';
    return val;
  };

  const [evaluationLabelsByLang, setEvaluationLabelsByLang] = useState<{ EN: EvaluationLabels; TH: EvaluationLabels }>({
    EN: {
      technical: 'TECHNICAL PROFICIENCY',
      communication: 'TEAM COMMUNICATION',
      punctuality: 'PUNCTUALITY & RELIABILITY',
      initiative: 'SELF-INITIATIVE',
      overallComments: 'OVERALL EVALUATION & COMMENTS',
      workPerformance: 'WORK PERFORMANCE',
    },
    TH: {
      technical: 'ทักษะด้านเทคนิค',
      communication: 'การสื่อสารและการทำงานร่วมกัน',
      punctuality: 'ความตรงต่อเวลาและความรับผิดชอบ',
      initiative: 'ความริเริ่มและการแก้ปัญหา',
      overallComments: 'ภาพรวมและความคิดเห็น',
      workPerformance: 'ผลงานการทำงาน',
    },
  });

  useEffect(() => {
    const ref = doc(firestoreDb, 'config', 'systemSettings');
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as {
          onboardingSteps?: RoadmapStep[];
          allowance?: {
            payoutFreq?: 'MONTHLY' | 'END_PROGRAM';
            wfoRate?: number;
            wfhRate?: number;
            applyTax?: boolean;
            taxPercent?: number;
            defaultPayoutDay?: number;
          };
          access?: {
            accessLevel?: 'REVOCATION' | 'LIMITED' | 'EXTENDED';
            retentionPeriod?: string;
          };
          evaluationLabels?: {
            EN?: Partial<EvaluationLabels>;
            TH?: Partial<EvaluationLabels>;
          };

          dashboardPreviewLabels?: {
            EN?: Partial<DashboardPreviewLabels>;
            TH?: Partial<DashboardPreviewLabels>;
          };
        };

        if (Array.isArray(data.onboardingSteps) && data.onboardingSteps.length > 0) {
          const ordered = [...data.onboardingSteps]
            .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0))
            .map((s) => ({
              ...s,
              active: s.active !== false,
            }));
          setOnboardingSteps(ordered);
        }

        if (data.allowance) {
          if (data.allowance.payoutFreq === 'MONTHLY' || data.allowance.payoutFreq === 'END_PROGRAM') setPayoutFreq(data.allowance.payoutFreq);
          if (typeof data.allowance.wfoRate === 'number') setWfoRate(data.allowance.wfoRate);
          if (typeof data.allowance.wfhRate === 'number') setWfhRate(data.allowance.wfhRate);
          if (typeof data.allowance.applyTax === 'boolean') setApplyTax(data.allowance.applyTax);
          if (typeof data.allowance.taxPercent === 'number') setTaxPercent(data.allowance.taxPercent);
          if (typeof data.allowance.defaultPayoutDay === 'number' && Number.isFinite(data.allowance.defaultPayoutDay)) {
            const d = Math.floor(data.allowance.defaultPayoutDay);
            setDefaultPayoutDay(d >= 1 && d <= 31 ? d : null);
          }
        }

        if (data.access) {
          if (data.access.accessLevel === 'REVOCATION' || data.access.accessLevel === 'LIMITED' || data.access.accessLevel === 'EXTENDED') {
            setAccessLevel(data.access.accessLevel);
          }
          setRetentionPeriod('1 Month post-offboard');
        }

        if (data.evaluationLabels) {
          setEvaluationLabelsByLang((prev) => ({
            EN: { ...prev.EN, ...(data.evaluationLabels?.EN ?? {}) },
            TH: { ...prev.TH, ...(data.evaluationLabels?.TH ?? {}) },
          }));
        }

        if (data.dashboardPreviewLabels) {
          setDashboardPreviewLabelsByLang((prev) => {
            const safeLang = (next: Partial<DashboardPreviewLabels> | undefined, fallback: DashboardPreviewLabels): DashboardPreviewLabels => {
              const nextMetrics = Array.isArray(next?.metrics) ? next?.metrics?.filter((x) => typeof x === 'string') : undefined;
              const nextComments = Array.isArray(next?.comments) ? next?.comments?.filter((x) => typeof x === 'string') : undefined;
              return {
                metrics: nextMetrics && nextMetrics.length > 0 ? nextMetrics : fallback.metrics,
                comments: nextComments && nextComments.length > 0 ? nextComments : fallback.comments,
              };
            };

            return {
              EN: safeLang(data.dashboardPreviewLabels?.EN, prev.EN),
              TH: safeLang(data.dashboardPreviewLabels?.TH, prev.TH),
            };
          });
        }
      },
      () => {
        // ignore
      },
    );
  }, []);

  useEffect(() => {
    const periodRef = doc(firestoreDb, 'payPeriods', selectedPayPeriodMonthKey);
    return onSnapshot(
      periodRef,
      (snap) => {
        if (!snap.exists()) {
          setPayPeriodStartDate('');
          setPayPeriodEndDate('');
          setPayPeriodPlannedPayoutDate(
            defaultPayoutDay != null ? clampToMonth(selectedPayPeriodMonthKey, defaultPayoutDay) : '',
          );
          setPayPeriodError(null);
          return;
        }
        const data = snap.data() as {
          periodStart?: string;
          periodEnd?: string;
          plannedPayoutDate?: string;
        };

        setPayPeriodStartDate(typeof data.periodStart === 'string' ? data.periodStart : '');
        setPayPeriodEndDate(typeof data.periodEnd === 'string' ? data.periodEnd : '');
        setPayPeriodPlannedPayoutDate(
          typeof data.plannedPayoutDate === 'string' && data.plannedPayoutDate
            ? data.plannedPayoutDate
            : defaultPayoutDay != null
              ? clampToMonth(selectedPayPeriodMonthKey, defaultPayoutDay)
              : '',
        );
        setPayPeriodError(null);
      },
      () => {
        // ignore
      },
    );
  }, [selectedPayPeriodMonthKey, defaultPayoutDay]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalUserRow[]>([]);
  const [withdrawnUsers, setWithdrawnUsers] = useState<WithdrawalUserRow[]>([]);
  const [completedOffboardingUsers, setCompletedOffboardingUsers] = useState<CompletedOffboardingUserRow[]>([]);
  const [withdrawnAccessOverrides, setWithdrawnAccessOverrides] = useState<Record<string, PostProgramAccessLevel>>({});
  const [withdrawnRetentionOverrides, setWithdrawnRetentionOverrides] = useState<Record<string, string>>({});
  const [withdrawnDirty, setWithdrawnDirty] = useState<Record<string, boolean>>({});
  const [pendingUserOperations, setPendingUserOperations] = useState<Record<string, PendingUserOperation>>({});
  const [offboardingRequests, setOffboardingRequests] = useState<any[]>([]);

  // Add state to store users by type
  const [withdrawalUsers, setWithdrawalUsers] = useState<any[]>([]);

  // Track last visit to Access Control tab
  const [lastAccessControlTabVisit, setLastAccessControlTabVisit] = useState<number>(() => {
    const stored = localStorage.getItem('lastAccessControlTabVisit');
    return stored ? parseInt(stored, 10) : 0;
  });

  // Calculate notification count for Access Control tab - only count requests after last visit
  const accessControlNotificationCount = useMemo(() => {
    let count = 0;
    
    withdrawalRequests.forEach((req) => {
      const updatedAt = req.updatedAt as any;
      if (updatedAt?.toDate) {
        const timestamp = updatedAt.toDate().getTime();
        if (timestamp > lastAccessControlTabVisit) {
          count++;
        }
      }
    });
    
    offboardingRequests.forEach((req) => {
      const updatedAt = req.updatedAt as any;
      if (updatedAt?.toDate) {
        const timestamp = updatedAt.toDate().getTime();
        if (timestamp > lastAccessControlTabVisit) {
          count++;
        }
      }
    });
    
    return count;
  }, [withdrawalRequests, offboardingRequests, lastAccessControlTabVisit]);

  // Track when user visits Access Control tab
  useEffect(() => {
    if (activeTab === 'access') {
      const now = Date.now();
      setLastAccessControlTabVisit(now);
      localStorage.setItem('lastAccessControlTabVisit', String(now));
    }
  }, [activeTab]);

  useEffect(() => {
    const q = query(collection(firestoreDb, 'users'), where('lifecycleStatus', '==', 'WITHDRAWAL_REQUESTED'));
    return onSnapshot(q, (snap) => {
      setWithdrawalRequests(
        snap.docs.map((d) => {
          const data = d.data() as {
            name?: string;
            avatar?: string;
            email?: string;
            withdrawalReason?: string;
            withdrawalDetail?: string;
            updatedAt?: any;
          };
          return {
            id: d.id,
            name: data.name || 'Unknown',
            avatar: normalizeAvatarUrl(data.avatar),
            email: data.email,
            withdrawalReason: data.withdrawalReason,
            withdrawalDetail: data.withdrawalDetail,
            updatedAt: data.updatedAt,
          };
        }),
      );
    });
  }, []);

  useEffect(() => {
    const q = query(collection(firestoreDb, 'users'), where('lifecycleStatus', '==', 'OFFBOARDING_REQUESTED'));
    return onSnapshot(q, (snap) => {
      setOffboardingRequests(
        snap.docs.map((d) => {
          const data = d.data() as {
            name?: string;
            avatar?: string;
            email?: string;
            offboardingTasks?: any[];
            offboardingRequestedAt?: any;
            updatedAt?: any;
          };
          return {
            id: d.id,
            name: data.name || 'Unknown',
            avatar: normalizeAvatarUrl(data.avatar),
            email: data.email,
            offboardingTasks: data.offboardingTasks || [],
            offboardingRequestedAt: data.offboardingRequestedAt,
            updatedAt: data.updatedAt,
          };
        }),
      );
    });
  }, []);

  useEffect(() => {
    const q = query(collection(firestoreDb, 'users'), where('lifecycleStatus', '==', 'WITHDRAWN'));
    return onSnapshot(q, (snap) => {
      const users = snap.docs.map((d) => {
        const data = d.data() as {
          name?: string;
          avatar?: string;
          email?: string;
          withdrawalReason?: string;
          withdrawalDetail?: string;
          postProgramAccessLevel?: PostProgramAccessLevel;
          postProgramRetentionPeriod?: string;
          roles?: UserRole[];
          withdrawalRequestedAt?: any;
        };
        return {
          id: d.id,
          name: data.name || 'Unknown',
          avatar: normalizeAvatarUrl(data.avatar),
          email: data.email,
          withdrawalReason: data.withdrawalReason,
          withdrawalDetail: data.withdrawalDetail,
          postProgramAccessLevel: data.postProgramAccessLevel,
          postProgramRetentionPeriod: data.postProgramRetentionPeriod,
          roles: data.roles || [],
          withdrawalRequestedAt: data.withdrawalRequestedAt,
        };
      });
      setWithdrawnUsers(users);
      
      // Separate users by type
      const withdrawal = users.filter(u => u.withdrawalRequestedAt);
      
      console.log('🔍 Debug - Withdrawn Users:', users);
      console.log('🔴 Withdrawal Users:', withdrawal);
      
      setWithdrawalUsers(withdrawal);
    });
  }, []);

  useEffect(() => {
    const q = query(collection(firestoreDb, 'users'), where('lifecycleStatus', '==', 'COMPLETED'));
    return onSnapshot(
      q,
      (snap) => {
        const users = snap.docs
          .map((d) => {
            const data = d.data() as {
              name?: string;
              avatar?: string;
              email?: string;
              postProgramAccessLevel?: PostProgramAccessLevel;
              postProgramRetentionPeriod?: string;
              offboardingRequestedAt?: any;
            };
            return {
              id: d.id,
              name: data.name || 'Unknown',
              avatar: normalizeAvatarUrl(data.avatar),
              email: data.email,
              postProgramAccessLevel: data.postProgramAccessLevel,
              postProgramRetentionPeriod: data.postProgramRetentionPeriod,
              offboardingRequestedAt: data.offboardingRequestedAt,
            };
          })
          .filter((u) => Boolean(u.offboardingRequestedAt));
        users.sort((a, b) => a.name.localeCompare(b.name));
        setCompletedOffboardingUsers(users);
      },
      () => setCompletedOffboardingUsers([]),
    );
  }, []);

  const stageSelectWithdrawalUser = (u: WithdrawalUserRow) => {
    setPendingUserOperations((prev) => ({
      ...prev,
      [u.id]: {
        type: 'APPLY_WITHDRAWAL',
        userId: u.id,
        accessLevel: accessLevel as PostProgramAccessLevel,
        retentionPeriod,
        name: u.name,
        avatar: u.avatar,
        email: u.email,
        withdrawalReason: u.withdrawalReason,
        withdrawalDetail: u.withdrawalDetail,
      },
    }));
  };

  const stageSelectOffboardingUser = (u: any) => {
    // Add to POST-PROGRAM ACCESS LIST instead of MANAGE WITHDRAWN USERS
    setPendingUserOperations((prev) => ({
      ...prev,
      [u.id]: {
        type: 'UPDATE_POST_PROGRAM',
        userId: u.id,
        accessLevel: accessLevel as PostProgramAccessLevel,
        retentionPeriod,
        name: u.name,
        avatar: u.avatar,
        email: u.email,
        offboardingTasks: u.offboardingTasks,
      },
    }));
  };

  const updatePendingApply = (
    userId: string,
    updates: Partial<Pick<Extract<PendingUserOperation, { type: 'APPLY_WITHDRAWAL' }>, 'accessLevel' | 'retentionPeriod'>>,
  ) => {
    setPendingUserOperations((prev) => {
      const existing = prev[userId];
      if (!existing || existing.type !== 'APPLY_WITHDRAWAL') return prev;
      return {
        ...prev,
        [userId]: {
          ...existing,
          ...updates,
        },
      };
    });
  };

  const selectedUserIds = new Set(
    (Object.values(pendingUserOperations) as PendingUserOperation[])
      .filter((op) => op.type === 'APPLY_WITHDRAWAL' || op.type === 'UPDATE_POST_PROGRAM')
      .map((op) => op.userId),
  );

  const stageUpdateWithdrawnUser = (u: WithdrawalUserRow) => {
    setPendingUserOperations((prev) => ({
      ...prev,
      [u.id]: {
        type: 'UPDATE_POST_PROGRAM',
        userId: u.id,
        accessLevel: u.postProgramAccessLevel,
        retentionPeriod: u.postProgramRetentionPeriod,
        name: u.name,
        avatar: u.avatar,
        email: u.email,
        withdrawalReason: u.withdrawalReason,
        withdrawalDetail: u.withdrawalDetail,
      },
    }));
  };

  const updatePendingUpdate = (
    userId: string,
    updates: Partial<Pick<Extract<PendingUserOperation, { type: 'UPDATE_POST_PROGRAM' }>, 'accessLevel' | 'retentionPeriod'>>,
  ) => {
    setPendingUserOperations((prev) => {
      const existing = prev[userId];
      if (!existing || existing.type !== 'UPDATE_POST_PROGRAM') return prev;
      return {
        ...prev,
        [userId]: {
          ...existing,
          ...updates,
        },
      };
    });
  };

  const stageRestoreWithdrawnUser = (u: WithdrawalUserRow) => {
    setPendingUserOperations((prev) => ({
      ...prev,
      [u.id]: {
        type: 'RESTORE_ACTIVE',
        userId: u.id,
        name: u.name,
        avatar: u.avatar,
        email: u.email,
      },
    }));
  };

  const clearPendingUserOperation = (userId: string) => {
    setPendingUserOperations((prev) => {
      if (!prev[userId]) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const openAlert = (message: string, title?: string) => {
    setDialog({ open: true, mode: 'alert', title, message });
  };

  const openConfirm = (message: string, title?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      dialogResolveRef.current = resolve;
      setDialog({ open: true, mode: 'confirm', title, message });
    });
  };

  const closeDialog = (result: boolean) => {
    const r = dialogResolveRef.current;
    dialogResolveRef.current = null;
    setDialog(null);
    if (r) r(result);
  };

  useEffect(() => {
    return () => {
      if (saveNoticeTimeoutRef.current != null) {
        window.clearTimeout(saveNoticeTimeoutRef.current);
        saveNoticeTimeoutRef.current = null;
      }
    };
  }, []);

  const handleCancelWithdrawnEdit = async (userId: string) => {
    if (withdrawnDirty[userId] === true) {
      const ok = await openConfirm(
        lang === 'EN' ? 'Discard unsaved changes?' : 'ยกเลิกการเปลี่ยนแปลงที่ยังไม่บันทึกใช่ไหม?',
        lang === 'EN' ? 'Confirm' : 'ยืนยัน',
      );
      if (!ok) return;
    }
    setWithdrawnAccessOverrides((prev) => {
      if (!prev[userId]) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    setWithdrawnRetentionOverrides((prev) => {
      if (!prev[userId]) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    setWithdrawnDirty((prev) => ({ ...prev, [userId]: false }));
  };

  const handleSaveWithdrawnEdit = async (userId: string) => {
    const u = withdrawnUsers.find((x) => x.id === userId);
    if (!u) return;

    const ok = await openConfirm(lang === 'EN' ? 'Save changes?' : 'บันทึกการเปลี่ยนแปลงใช่ไหม?', lang === 'EN' ? 'Confirm' : 'ยืนยัน');
    if (!ok) return;

    const nextLevel = withdrawnAccessOverrides[userId] ?? u.postProgramAccessLevel;
    const nextRetention = withdrawnRetentionOverrides[userId] ?? u.postProgramRetentionPeriod;

    try {
      await updateDoc(doc(firestoreDb, 'users', userId), {
        ...(nextLevel ? { postProgramAccessLevel: nextLevel } : {}),
        ...(nextRetention ? { postProgramRetentionPeriod: nextRetention } : {}),
        updatedAt: serverTimestamp(),
      });
      setWithdrawnDirty((prev) => ({ ...prev, [userId]: false }));
    } catch {
      openAlert(lang === 'EN' ? 'Failed to save changes.' : 'ไม่สามารถบันทึกการเปลี่ยนแปลงได้', lang === 'EN' ? 'Error' : 'เกิดข้อผิดพลาด');
    }
  };

  const handleRestoreCompletedOffboardingImmediate = async (userId: string) => {
    const ok = await openConfirm(
      lang === 'EN' ? 'Restore this user to ACTIVE?' : 'ต้องการคืนสถานะผู้ใช้นี้เป็น ACTIVE ใช่ไหม?',
      lang === 'EN' ? 'Confirm' : 'ยืนยัน',
    );
    if (!ok) return;

    try {
      await updateDoc(doc(firestoreDb, 'users', userId), {
        lifecycleStatus: 'ACTIVE',
        offboardingRequestedAt: deleteField(),
        completionReportedAt: deleteField(),
        postProgramAccessLevel: deleteField(),
        postProgramRetentionPeriod: deleteField(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      openAlert(lang === 'EN' ? 'Failed to restore user.' : 'ไม่สามารถคืนสถานะผู้ใช้ได้', lang === 'EN' ? 'Error' : 'เกิดข้อผิดพลาด');
    }
  };

  const handleRestoreWithdrawnImmediate = async (userId: string) => {
    const ok = await openConfirm(
      lang === 'EN' ? 'Restore this user to ACTIVE?' : 'ต้องการคืนสถานะผู้ใช้นี้เป็น ACTIVE ใช่ไหม?',
      lang === 'EN' ? 'Confirm' : 'ยืนยัน',
    );
    if (!ok) return;

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
      handleCancelWithdrawnEdit(userId);
    } catch {
      openAlert(lang === 'EN' ? 'Failed to restore user.' : 'ไม่สามารถคืนสถานะผู้ใช้ได้', lang === 'EN' ? 'Error' : 'เกิดข้อผิดพลาด');
    }
  };



  const handleSave = async () => {
    setIsSaving(true);
    setSaveNotice(null);
    try {
      const orderedSteps = [...onboardingSteps].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
      const sanitizedSteps: RoadmapStep[] = orderedSteps.map((s) => {
        const base: RoadmapStep = {
          id: s.id,
          title: s.title,
          active: s.active,
          type: s.type,
          attachedDocuments: Array.isArray(s.attachedDocuments) ? s.attachedDocuments : [],
        };

        if (s.type === 'EXTERNAL_URL') {
          return {
            ...base,
            ...(s.externalUrl ? { externalUrl: s.externalUrl } : {}),
          };
        }

        return {
          ...base,
          ...(s.targetPage ? { targetPage: s.targetPage } : {}),
        };
      });
      const batch = writeBatch(firestoreDb);

      const ref = doc(firestoreDb, 'config', 'systemSettings');
      batch.set(
        ref,
        {
          onboardingSteps: sanitizedSteps,
          allowance: {
            payoutFreq,
            wfoRate,
            wfhRate,
            applyTax,
            taxPercent,
            ...(defaultPayoutDay != null ? { defaultPayoutDay } : {}),
          },
          access: {
            accessLevel,
            retentionPeriod: '1 Month post-offboard',
          },
          evaluationLabels: evaluationLabelsByLang,
          dashboardPreviewLabels: dashboardPreviewLabelsByLang,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      if (activeTab === 'allowance') {
        const isIso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
        const start = payPeriodStartDate.trim();
        const end = payPeriodEndDate.trim();
        const payout = payPeriodPlannedPayoutDate.trim();

        if (start && !isIso(start)) {
          setPayPeriodError('Period start date must be in YYYY-MM-DD format.');
          setIsSaving(false);
          return;
        }
        if (end && !isIso(end)) {
          setPayPeriodError('Period end date must be in YYYY-MM-DD format.');
          setIsSaving(false);
          return;
        }
        if (payout && !isIso(payout)) {
          setPayPeriodError('Planned payout date must be in YYYY-MM-DD format.');
          setIsSaving(false);
          return;
        }
        if (start && end && start > end) {
          setPayPeriodError('Period end date must be on or after period start date.');
          setIsSaving(false);
          return;
        }

        const payPeriodRef = doc(firestoreDb, 'payPeriods', selectedPayPeriodMonthKey);
        batch.set(
          payPeriodRef,
          {
            monthKey: selectedPayPeriodMonthKey,
            ...(start ? { periodStart: start } : {}),
            ...(end ? { periodEnd: end } : {}),
            ...(payout ? { plannedPayoutDate: payout } : {}),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      for (const op of Object.values(pendingUserOperations) as PendingUserOperation[]) {
        const userRef = doc(firestoreDb, 'users', op.userId);
        if (op.type === 'APPLY_WITHDRAWAL') {
          batch.update(userRef, {
            lifecycleStatus: 'WITHDRAWN',
            postProgramAccessLevel: op.accessLevel,
            postProgramRetentionPeriod: op.retentionPeriod,
            withdrawalRequestedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (op.type === 'APPLY_OFFBOARDING') {
          batch.update(userRef, {
            lifecycleStatus: 'COMPLETED',
            postProgramAccessLevel: op.accessLevel,
            postProgramRetentionPeriod: op.retentionPeriod,
            offboardingRequestedAt: serverTimestamp(),
            completionReportedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (op.type === 'UPDATE_POST_PROGRAM') {
          // Check if this is an offboarding user by checking if they have offboardingTasks
          if (op.offboardingTasks) {
            batch.update(userRef, {
              lifecycleStatus: 'COMPLETED',
              ...(op.accessLevel ? { postProgramAccessLevel: op.accessLevel } : {}),
              ...(op.retentionPeriod ? { postProgramRetentionPeriod: op.retentionPeriod } : {}),
              offboardingRequestedAt: serverTimestamp(),
              completionReportedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            // Regular withdrawal user
            batch.update(userRef, {
              lifecycleStatus: 'WITHDRAWN',
              ...(op.accessLevel ? { postProgramAccessLevel: op.accessLevel } : {}),
              ...(op.retentionPeriod ? { postProgramRetentionPeriod: op.retentionPeriod } : {}),
              withdrawalRequestedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } else if (op.type === 'RESTORE_ACTIVE') {
          batch.update(userRef, {
            lifecycleStatus: 'ACTIVE',
            withdrawalRequestedAt: deleteField(),
            withdrawalReason: deleteField(),
            withdrawalDetail: deleteField(),
            offboardingRequestedAt: deleteField(),
            postProgramAccessLevel: deleteField(),
            postProgramRetentionPeriod: deleteField(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();

      {
        const legacyRetention = '6 Months post-offboard';
        const nextRetention = '1 Month post-offboard';
        const snap = await getDocs(
          query(collection(firestoreDb, 'users'), where('postProgramRetentionPeriod', '==', legacyRetention)),
        );

        let migrateBatch = writeBatch(firestoreDb);
        let opCount = 0;
        for (const d of snap.docs) {
          migrateBatch.update(doc(firestoreDb, 'users', d.id), {
            postProgramRetentionPeriod: nextRetention,
            updatedAt: serverTimestamp(),
          });
          opCount += 1;
          if (opCount >= 450) {
            await migrateBatch.commit();
            migrateBatch = writeBatch(firestoreDb);
            opCount = 0;
          }
        }
        if (opCount > 0) {
          await migrateBatch.commit();
        }
      }

      setPayPeriodError(null);

      setDidSaveRecently(true);
      setSaveNotice({
        type: 'success',
        message: lang === 'EN' ? 'Configuration deployed successfully.' : 'บันทึกและปรับใช้การตั้งค่าสำเร็จ',
      });
      if (saveNoticeTimeoutRef.current != null) window.clearTimeout(saveNoticeTimeoutRef.current);
      saveNoticeTimeoutRef.current = window.setTimeout(() => {
        setSaveNotice(null);
        setDidSaveRecently(false);
        saveNoticeTimeoutRef.current = null;
      }, 3500);
    } catch (err) {
      console.error(err);
      setSaveNotice({
        type: 'error',
        message: lang === 'EN' ? 'Failed to save settings.' : 'ไม่สามารถบันทึกการตั้งค่าได้',
      });
      openAlert(lang === 'EN' ? 'Failed to save settings.' : 'ไม่สามารถบันทึกการตั้งค่าได้', lang === 'EN' ? 'Error' : 'เกิดข้อผิดพลาด');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    const ok = await openConfirm(
      lang === 'EN'
        ? 'Are you sure you want to reset all settings to default?'
        : 'คุณแน่ใจหรือไม่ว่าต้องการล้างการตั้งค่าทั้งหมดเป็นค่าเริ่มต้น?',
      lang === 'EN' ? 'Confirm' : 'ยืนยัน',
    );
    if (ok) setOnboardingSteps(DEFAULT_ONBOARDING_STEPS);
  };

  const handleToggleStep = (id: string) => {
    setOnboardingSteps((steps) =>
      steps.map((s) => (s.id === id ? { ...s, active: !(s.active !== false) } : s)),
    );
  };

  const handleUpdateStep = (id: string, updates: Partial<RoadmapStep>) => {
    setOnboardingSteps(steps => steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleCreateNewStep = () => {
    const title = newStepTitle.trim();
    if (!title) {
      openAlert(lang === 'EN' ? 'Please enter Step Title.' : 'กรุณากรอกชื่อขั้นตอน', lang === 'EN' ? 'Missing information' : 'ข้อมูลไม่ครบ');
      return;
    }
    if (newStepType === 'EXTERNAL_URL' && !newStepExternalUrl.trim()) {
      openAlert(lang === 'EN' ? 'Please enter External URL.' : 'กรุณากรอกลิงก์ภายนอก', lang === 'EN' ? 'Missing information' : 'ข้อมูลไม่ครบ');
      return;
    }
    if (newStepType !== 'EXTERNAL_URL' && !newStepTargetPage) {
      openAlert(lang === 'EN' ? 'Please select Target Module.' : 'กรุณาเลือกโมดูลเป้าหมาย', lang === 'EN' ? 'Missing information' : 'ข้อมูลไม่ครบ');
      return;
    }

    const nextId = (Math.max(0, ...onboardingSteps.map(s => Number(s.id) || 0)) + 1).toString();
    setOnboardingSteps((prev) =>
      [...prev,
        {
          id: nextId,
          title,
          active: true,
          type: newStepType,
          targetPage: newStepType === 'EXTERNAL_URL' ? undefined : newStepTargetPage,
          externalUrl: newStepType === 'EXTERNAL_URL' ? newStepExternalUrl.trim() : undefined,
          attachedDocuments: [],
        },
      ].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0)),
    );

    setIsAddingStep(false);
    setNewStepTitle('');
    setNewStepType('MODULE_LINK');
    setNewStepTargetPage(undefined);
    setNewStepExternalUrl('');
  };

  const handleAttachFile = (id: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.multiple = true;
    input.onchange = (e: any) => {
      const files = Array.from(e.target.files as FileList);
      if (files.length > 0) {
        setOnboardingSteps(steps => steps.map(s => {
          if (s.id !== id) return s;
          const newFileNames = files.map(f => f.name);
          return { ...s, attachedDocuments: [...s.attachedDocuments, ...newFileNames] };
        }));
      }
    };
    input.click();
  };

  const handleRemoveDoc = (stepId: string, fileName: string) => {
    setOnboardingSteps(steps => steps.map(s => {
      if (s.id !== stepId) return s;
      return { ...s, attachedDocuments: s.attachedDocuments.filter(name => name !== fileName) };
    }));
  };

  const getProcessTypeIcon = (type: ProcessType) => {
    switch(type) {
      case 'DOC_UPLOAD': return <Upload size={14} className="text-blue-500" />;
      case 'NDA_SIGN': return <PenTool size={14} className="text-indigo-500" />;
      case 'MODULE_LINK': return <MousePointer2 size={14} className="text-amber-500" />;
      case 'EXTERNAL_URL': return <ExternalLink size={14} className="text-slate-500" />;
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden relative p-4 md:p-8 lg:p-10">
      <div className="max-w-[1700px] mx-auto w-full flex flex-col h-full">
        {dialog?.open ? (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-[2rem] overflow-hidden shadow-2xl border border-slate-100">
              <div className="p-6 sm:p-7 border-b border-slate-100 bg-slate-50/50 flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-slate-900 truncate">
                    {dialog.title ?? (lang === 'EN' ? 'Notification' : 'แจ้งเตือน')}
                  </div>
                  <div className="mt-2 text-sm font-bold text-slate-600 whitespace-pre-wrap break-words">{dialog.message}</div>
                </div>
                <button
                  type="button"
                  onClick={() => closeDialog(false)}
                  className="p-2 rounded-2xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                  aria-label={lang === 'EN' ? 'Close' : 'ปิด'}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 sm:p-7 flex items-center justify-end gap-3">
                {dialog.mode === 'confirm' ? (
                  <button
                    type="button"
                    onClick={() => closeDialog(false)}
                    className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                  >
                    {lang === 'EN' ? 'Cancel' : 'ยกเลิก'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => closeDialog(true)}
                  className="px-7 py-3 rounded-2xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                >
                  {lang === 'EN' ? 'OK' : 'ตกลง'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">{t.title}</h1>
            <p className="text-slate-500 text-sm font-medium pt-2">{t.subtitle}</p>
          </div>
          
          <div className="flex bg-white p-1 rounded-[1.5rem] border border-slate-200 shadow-sm overflow-x-auto scrollbar-hide">
             <TabBtn active={activeTab === 'onboarding'} onClick={() => setActiveTab('onboarding')} icon={<Rocket size={14}/>} label={t.tabOnboarding} />
             <TabBtn active={activeTab === 'policy'} onClick={() => setActiveTab('policy')} icon={<ShieldCheck size={14}/>} label={t.tabPolicy} />
             <TabBtn active={activeTab === 'allowance'} onClick={() => setActiveTab('allowance')} icon={<CreditCard size={14}/>} label={t.tabAllowance} />
             <TabBtn active={activeTab === 'access'} onClick={() => setActiveTab('access')} icon={<Lock size={14}/>} label={t.tabAccess} hasNotification={accessControlNotificationCount > 0} />
             <TabBtn active={activeTab === 'evaluation'} onClick={() => setActiveTab('evaluation')} icon={<ClipboardList size={14}/>} label={t.tabEvaluation} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-32 scrollbar-hide">
          
          {/* TAB: ONBOARDING */}
          {activeTab === 'onboarding' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500">
               <div className="lg:col-span-8">
                  <section className="bg-white rounded-[3.5rem] p-10 md:p-12 border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="mb-12">
                       <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t.engineTitle}</h2>
                       <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mt-2">{t.engineSub}</p>
                    </div>

                    <div className="space-y-4">
                       {onboardingSteps.map((step, idx) => (
                         <div key={step.id} className="space-y-2">
                           <div className={`flex items-center justify-between p-6 bg-[#F8FAFC]/80 border border-slate-100 rounded-[1.75rem] transition-all hover:bg-white hover:border-blue-200 hover:shadow-xl group relative ${editingStepId === step.id ? 'ring-4 ring-blue-500/10 border-blue-600 bg-white shadow-2xl' : ''}`}>
                              <div className="flex items-center gap-6 flex-1">
                                 <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-xs font-black text-slate-400 shadow-sm">
                                   {(idx + 1).toString().padStart(2, '0')}
                                 </div>
                                 <div className="flex-1">
                                    <h4 className={`text-[15px] font-bold tracking-tight transition-all ${step.active ? 'text-slate-900' : 'text-slate-300'}`}>{step.title}</h4>
                                    <div className="flex items-center gap-3 mt-1.5">
                                       <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-100 shadow-sm">
                                          {getProcessTypeIcon(step.type)}
                                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{step.type.replace('_', ' ')}</span>
                                       </div>
                                       {step.targetPage && (
                                         <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1">
                                            <ChevronRight size={10} strokeWidth={4}/> {t.modulePrefix}: {step.targetPage}
                                         </span>
                                       )}
                                       {step.attachedDocuments.length > 0 && (
                                         <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5 ml-2">
                                            <Paperclip size={10} strokeWidth={4}/> {step.attachedDocuments.length} {t.filesLabel}
                                         </span>
                                       )}
                                    </div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-4">
                                 <button 
                                   onClick={() => setEditingStepId(editingStepId === step.id ? null : step.id)} 
                                   className={`p-2.5 rounded-xl transition-all ${editingStepId === step.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:text-blue-600 hover:bg-blue-50'}`}
                                 >
                                   <Edit3 size={18}/>
                                 </button>
                                 <button
                                   type="button"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     handleToggleStep(step.id);
                                   }}
                                   aria-pressed={step.active !== false}
                                   className={`w-12 h-6 rounded-full relative transition-all cursor-pointer ${step.active !== false ? 'bg-blue-600 shadow-lg shadow-blue-500/20' : 'bg-slate-200'}`}
                                 >
                                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-md ${step.active !== false ? 'left-7' : 'left-1'}`}></div>
                                 </button>
                              </div>
                           </div>

                           {/* EXPANDED EDIT VIEW (RESTORED) */}
                           {editingStepId === step.id && (
                             <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] animate-in slide-in-from-top-4 duration-300 space-y-8 mx-2 mb-4">
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{t.processTitle}</label>
                                    <input 
                                      type="text" 
                                      className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                                      value={step.title}
                                      onChange={(e) => handleUpdateStep(step.id, { title: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{t.stepLogicType}</label>
                                    <select 
                                      className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none appearance-none"
                                      value={step.type}
                                      onChange={(e) => handleUpdateStep(step.id, { type: e.target.value as ProcessType })}
                                    >
                                      <option value="DOC_UPLOAD">{t.docUploadOpt}</option>
                                      <option value="NDA_SIGN">{t.ndaSignOpt}</option>
                                      <option value="MODULE_LINK">{t.moduleLinkOpt}</option>
                                      <option value="EXTERNAL_URL">{t.externalUrlOpt}</option>
                                    </select>
                                  </div>
                               </div>

                               {(step.type === 'NDA_SIGN' || step.type === 'DOC_UPLOAD') && (
                                 <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-6">
                                    <div className="flex items-center justify-between mb-2">
                                       <div className="flex items-center gap-4">
                                          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                             <FileSearch size={20}/>
                                          </div>
                                          <div>
                                             <h5 className="text-sm font-black text-slate-900 leading-none">{t.attachDoc}</h5>
                                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{t.serveTemplates}</p>
                                          </div>
                                       </div>
                                       <button 
                                          onClick={() => handleAttachFile(step.id)}
                                          className="px-6 py-3 bg-[#111827] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2 shadow-xl"
                                       >
                                          <Plus size={14}/> {t.addTemplate}
                                       </button>
                                    </div>

                                    <div className="space-y-2">
                                       {step.attachedDocuments.length > 0 ? (
                                         step.attachedDocuments.map((docName, dIdx) => (
                                          <div key={dIdx} className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 flex items-center justify-between group/doc hover:bg-white hover:border-blue-200 transition-all">
                                             <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-500 border border-slate-100 shadow-sm">
                                                  <FileText size={16} />
                                                </div>
                                                <span className="text-sm font-bold text-slate-800">{docName}</span>
                                             </div>
                                             <button 
                                               onClick={() => handleRemoveDoc(step.id, docName)}
                                               className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover/doc:opacity-100"
                                             >
                                                <Trash2 size={16}/>
                                             </button>
                                          </div>
                                         ))
                                       ) : (
                                         <div className="py-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3">
                                            <FileText size={32} className="text-slate-200" />
                                            <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{t.docsLimit}</p>
                                         </div>
                                       )}
                                    </div>
                                 </div>
                               )}

                               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  <div>
                                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{t.targetModule}</label>
                                     <div className="grid grid-cols-2 gap-2">
                                        {NAV_ITEMS.filter(n => n.roles.includes('INTERN')).map(item => (
                                          <button 
                                            key={item.id}
                                            onClick={() => handleUpdateStep(step.id, { targetPage: item.id })}
                                            className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-left flex items-center gap-2 border ${step.targetPage === item.id ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-blue-200 hover:bg-white'}`}
                                          >
                                            {item.icon} {item.label}
                                          </button>
                                        ))}
                                     </div>
                                  </div>
                                  <div className="flex flex-col justify-end">
                                     <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100 flex items-start gap-4">
                                        <AlertCircle size={20} className="text-blue-500 shrink-0"/>
                                        <p className="text-[11px] text-blue-700 leading-relaxed font-bold italic">
                                          {t.targetModuleInfo}
                                        </p>
                                     </div>
                                  </div>
                               </div>

                               <div className="pt-6 border-t border-slate-100 flex justify-end">
                                  <button onClick={() => setEditingStepId(null)} className="px-10 py-3 bg-[#111827] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl">{t.doneEditing}</button>
                               </div>
                             </div>
                           )}
                         </div>
                       ))}
                       
                       <button onClick={() => setIsAddingStep((v) => !v)} className="w-full py-6 border-4 border-dashed border-slate-100 text-slate-300 rounded-[2.25rem] font-black text-xs uppercase hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-3 group">
                          <Plus size={32}/> {t.addStep}
                       </button>

                       {isAddingStep && (
                         <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] animate-in slide-in-from-top-4 duration-300 space-y-8 mx-2 mt-4">
                           <div className="flex items-start justify-between gap-6">
                             <div>
                               <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">{t.customWorkflow}</div>
                               <h3 className="text-2xl font-black text-slate-900 tracking-tight">{t.integrateNewStep}</h3>
                             </div>
                             <button
                               type="button"
                               onClick={() => setIsAddingStep(false)}
                               className="p-3 rounded-2xl text-slate-300 hover:text-slate-600 hover:bg-white transition-all"
                               aria-label="Close"
                             >
                               <X size={20} />
                             </button>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{t.stepTitleLabel}</label>
                               <input
                                 type="text"
                                 className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 focus:border-blue-200 transition-all"
                                 placeholder={lang === 'EN' ? 'e.g. Upload Identity Files' : 'เช่น อัปโหลดเอกสารสำคัญ'}
                                 value={newStepTitle}
                                 onChange={(e) => setNewStepTitle(e.target.value)}
                               />
                             </div>

                             <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{t.actionTypeLabel}</label>
                               <select
                                 className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none appearance-none"
                                 value={newStepType}
                                 onChange={(e) => setNewStepType(e.target.value as ProcessType)}
                               >
                                 <option value="MODULE_LINK">{t.moduleLinkOpt}</option>
                                 <option value="DOC_UPLOAD">{t.docUploadOpt}</option>
                                 <option value="NDA_SIGN">{t.ndaSignOpt}</option>
                                 <option value="EXTERNAL_URL">{t.externalUrlOpt}</option>
                               </select>
                             </div>
                           </div>

                           {newStepType === 'EXTERNAL_URL' ? (
                             <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{t.externalUrlLabel}</label>
                               <input
                                 type="url"
                                 className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 focus:border-blue-200 transition-all"
                                 placeholder="https://..."
                                 value={newStepExternalUrl}
                                 onChange={(e) => setNewStepExternalUrl(e.target.value)}
                               />
                             </div>
                           ) : (
                             <div>
                               <div className="flex items-center justify-between mb-4">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.targetModuleRedirection}</label>
                                 {newStepTargetPage && (
                                   <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{String(newStepTargetPage).replace('-', ' ')}</div>
                                 )}
                               </div>
                               <div className="p-6 bg-white rounded-[2rem] border border-slate-100">
                                 <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                   {NAV_ITEMS.filter((n) => n.roles.includes('INTERN')).map((item) => (
                                     <button
                                       key={item.id}
                                       type="button"
                                       onClick={() => setNewStepTargetPage(item.id)}
                                       className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-left flex items-center gap-2 border ${newStepTargetPage === item.id ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-blue-200 hover:bg-white'}`}
                                     >
                                       {item.icon} {item.label}
                                     </button>
                                   ))}
                                 </div>
                               </div>
                             </div>
                           )}

                           <div className="pt-2 flex items-center justify-end gap-3">
                             <button
                               type="button"
                               onClick={() => setIsAddingStep(false)}
                               className="px-10 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                             >
                               {lang === 'EN' ? 'Cancel' : 'ยกเลิก'}
                             </button>
                             <button
                               type="button"
                               onClick={handleCreateNewStep}
                               className="px-10 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20"
                             >
                               {t.integrateStep}
                             </button>
                           </div>
                         </div>
                       )}
                    </div>
                 </section>
              </div>

              <div className="lg:col-span-4 space-y-8">
                 <div className="bg-[#0B0F19] rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden h-fit">
                    <h3 className="text-2xl font-black mb-4 tracking-tight">{t.processIntelligence}</h3>
                    <p className="text-slate-400 text-xs leading-relaxed mb-6 italic">{t.processIntelligenceDesc}</p>
                    <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] flex items-center gap-5">
                       <CheckCircle2 size={24} className="text-emerald-400"/>
                       <p className="text-[14px] font-black text-slate-100">{t.autoHandoff}</p>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {/* TAB: POLICY & TRAINING */}
          {activeTab === 'policy' && (
            <PolicyTrainingManager lang={lang} />
          )}

          {/* TAB: ALLOWANCE */}
          {activeTab === 'allowance' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500">
               <div className="lg:col-span-8">
                  <section className="bg-white rounded-[3.5rem] p-10 md:p-14 border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-6 mb-12">
                      <div className="w-16 h-16 bg-[#4F46E5] text-white rounded-[1.75rem] flex items-center justify-center shadow-xl shadow-indigo-100">
                        <Calculator size={32} />
                      </div>
                      <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{t.allowanceTitle}</h2>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mt-2">{t.allowanceSub}</p>
                      </div>
                    </div>

                    <div className="space-y-12">
                      <div className="bg-[#F8FAFC] border border-slate-200 rounded-[2rem] p-8">
                        <div className="flex items-start justify-between gap-6 flex-col md:flex-row md:items-center">
                          <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.monthlyPayPeriod}</div>
                            <div className="mt-2 text-lg font-black text-slate-900">{t.cutoffWindow}</div>
                            <div className="mt-2 text-[11px] font-bold text-slate-500">{t.cutoffDesc}</div>
                          </div>

                          <div className="flex items-center gap-3">
                            <select
                              value={selectedPayPeriodMonthKey}
                              onChange={(e) => setSelectedPayPeriodMonthKey(e.target.value)}
                              className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-black text-slate-700 outline-none"
                            >
                              {payPeriodMonthOptions.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {payPeriodError && (
                          <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-sm font-bold text-rose-700">
                            {payPeriodError}
                          </div>
                        )}

                        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                          <label className="space-y-2 block">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.periodStart}</div>
                            <input
                              type="date"
                              value={payPeriodStartDate}
                              onChange={(e) => setPayPeriodStartDate(e.target.value)}
                              className="w-full px-5 py-4 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                            />
                          </label>

                          <label className="space-y-2 block">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.periodEnd}</div>
                            <input
                              type="date"
                              value={payPeriodEndDate}
                              onChange={(e) => setPayPeriodEndDate(e.target.value)}
                              className="w-full px-5 py-4 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                            />
                          </label>

                          <label className="space-y-2 block">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.plannedPayoutDate}</div>
                            <input
                              type="date"
                              value={payPeriodPlannedPayoutDate}
                              onChange={(e) => setPayPeriodPlannedPayoutDate(e.target.value)}
                              className="w-full px-5 py-4 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                            />
                          </label>

                          <label className="space-y-2 block">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {lang === 'EN' ? 'Default payout day (auto-fill)' : 'กำหนดวันจ่ายเริ่มต้น (เติมให้อัตโนมัติ)'}
                            </div>
                            <input
                              type="number"
                              min={1}
                              max={31}
                              value={defaultPayoutDay ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (!raw) {
                                  setDefaultPayoutDay(null);
                                  return;
                                }
                                const n = Number(raw);
                                if (!Number.isFinite(n)) return;
                                const d = Math.floor(n);
                                setDefaultPayoutDay(d >= 1 && d <= 31 ? d : null);
                              }}
                              className="w-full px-5 py-4 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                            />
                            <div className="text-[11px] font-bold text-slate-400">
                              {lang === 'EN'
                                ? 'If a month has no payout date set, it will default to this day-of-month. You can still override per month.'
                                : 'ถ้าเดือนไหนยังไม่ได้กำหนดวันจ่าย ระบบจะเติมวันตามค่านี้ให้ (ยังแก้แยกเป็นรายเดือนได้)'}
                            </div>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">{t.payoutFrequency}</label>
                        <div className="flex gap-4">
                           <button 
                             onClick={() => setPayoutFreq('MONTHLY')}
                             className={`flex-1 p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-4 ${payoutFreq === 'MONTHLY' ? 'border-blue-600 bg-white shadow-xl shadow-blue-500/5' : 'border-slate-50 bg-[#F8FAFC]'}`}
                           >
                             <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${payoutFreq === 'MONTHLY' ? 'border-blue-600' : 'border-slate-200'}`}>
                                {payoutFreq === 'MONTHLY' && <div className="w-3 h-3 bg-blue-600 rounded-full"></div>}
                             </div>
                             <span className={`text-xs font-black uppercase tracking-widest ${payoutFreq === 'MONTHLY' ? 'text-slate-900' : 'text-slate-300'}`}>{t.monthlyOpt}</span>
                           </button>
                           <button 
                             onClick={() => setPayoutFreq('END_PROGRAM')}
                             className={`flex-1 p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-4 ${payoutFreq === 'END_PROGRAM' ? 'border-blue-600 bg-white shadow-xl shadow-blue-500/5' : 'border-slate-50 bg-[#F8FAFC]'}`}
                           >
                             <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${payoutFreq === 'END_PROGRAM' ? 'border-blue-600' : 'border-slate-200'}`}>
                                {payoutFreq === 'END_PROGRAM' && <div className="w-3 h-3 bg-blue-600 rounded-full"></div>}
                             </div>
                             <span className={`text-xs font-black uppercase tracking-widest ${payoutFreq === 'END_PROGRAM' ? 'text-slate-900' : 'text-slate-300'}`}>{t.endProgramOpt}</span>
                           </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">{t.wfoRate}</label>
                            <div className="relative group">
                               <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-bold group-focus-within:text-blue-600 transition-colors">฿</div>
                               <input 
                                 type="number" 
                                 className="w-full bg-[#F8FAFC] border border-slate-200 rounded-[1.5rem] pl-14 pr-6 py-4 text-sm font-black text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 focus:bg-white focus:border-blue-200 transition-all"
                                 value={wfoRate}
                                 onChange={e => setWfoRate(Number(e.target.value))}
                               />
                            </div>
                         </div>
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">{t.wfhRate}</label>
                            <div className="relative group">
                               <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-bold group-focus-within:text-blue-600 transition-colors">฿</div>
                               <input 
                                 type="number" 
                                 className="w-full bg-[#F8FAFC] border border-slate-200 rounded-[1.5rem] pl-14 pr-6 py-4 text-sm font-black text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 focus:bg-white focus:border-blue-200 transition-all"
                                 value={wfhRate}
                                 onChange={e => setWfhRate(Number(e.target.value))}
                               />
                            </div>
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="bg-[#EEF2FF] p-8 rounded-[2rem] border border-[#E0E7FF] relative">
                            <div className="flex items-center justify-between mb-8">
                               <span className="text-[10px] font-black text-[#4338CA] uppercase tracking-widest">{t.applyLocalTax}</span>
                               <button 
                                 onClick={() => setApplyTax(!applyTax)}
                                 className={`w-12 h-6 rounded-full relative transition-all ${applyTax ? 'bg-[#4338CA]' : 'bg-slate-300'}`}
                               >
                                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-md ${applyTax ? 'left-7' : 'left-1'}`}></div>
                               </button>
                            </div>
                            <div className="relative bg-white rounded-2xl border border-[#E0E7FF] flex items-center justify-between px-6 py-4">
                               <input 
                                 type="number" 
                                 className="w-full bg-transparent text-xl font-black text-[#4338CA] outline-none"
                                 value={taxPercent}
                                 onChange={e => setTaxPercent(Number(e.target.value))}
                               />
                               <span className="text-slate-300 font-black">%</span>
                            </div>
                         </div>
                      </div>
                    </div>
                  </section>
               </div>

               <div className="lg:col-span-4 animate-in slide-in-from-right-4 duration-500">
                  <div className="bg-[#FFFCF0] border border-[#FEF3C7] rounded-[3.5rem] p-10 relative overflow-hidden flex flex-col h-fit shadow-lg shadow-amber-900/5">
                     <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-8">
                        <AlertCircle size={24} />
                     </div>
                     <h3 className="text-2xl font-black text-[#92400E] mb-6 tracking-tight">{t.financialDisclaimer}</h3>
                     <p className="text-[#B45309] text-sm leading-relaxed font-medium italic">
                        {t.financialDisclaimerDesc}
                     </p>
                  </div>
               </div>
            </div>
          )}

          {/* TAB: ACCESS CONTROL (EXACT MATCH TO PREVIOUS GOOD STATE) */}
          {activeTab === 'access' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500">
               <div className="lg:col-span-8">
                  <section className="bg-white rounded-[3.5rem] p-10 md:p-14 border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="mb-12">
                       <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">{t.accessTitle}</h2>
                       <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mt-3">{t.accessSub}</p>
                    </div>

                    <div className="space-y-12">
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 block">{t.standardAccessLevel}</label>
                          <div className="space-y-3">
                             <AccessCard 
                               active={accessLevel === 'REVOCATION'} 
                               onClick={() => setAccessLevel('REVOCATION')} 
                               title={t.immediateRevocation} 
                               desc={t.immediateRevocationDesc} 
                             />
                             <AccessCard 
                               active={accessLevel === 'LIMITED'} 
                               onClick={() => setAccessLevel('LIMITED')} 
                               title={t.limitedRecommended} 
                               desc={t.limitedRecommendedDesc} 
                             />
                             <AccessCard 
                               active={accessLevel === 'EXTENDED'} 
                               onClick={() => setAccessLevel('EXTENDED')} 
                               title={t.extendedView} 
                               desc={t.extendedViewDesc} 
                             />
                          </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
                          <div>
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">{t.defaultRetentionPeriod}</label>
                             <div className="bg-[#F8FAFC] border border-slate-200 rounded-[1.75rem] flex items-center px-8 py-5 group hover:border-blue-300 transition-all cursor-pointer">
                                <Clock size={20} className="text-slate-300 mr-4" />
                                <span className="flex-1 text-[14px] font-bold text-slate-700">{displayRetention(retentionPeriod)}</span>
                             </div>
                          </div>
                          <div className="flex flex-col justify-end">
                             <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-[1.75rem] px-8 py-5 flex items-center gap-4">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                                   <ShieldCheck size={24} />
                                </div>
                                <span className="text-[11px] font-black text-blue-700 leading-tight uppercase italic">
                                   {t.complianceNote}
                                </span>
                              </div>
                           </div>
                        </div>

                       <div className="pt-8 border-t border-slate-100">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t.withdrawalRequestsLabel}</div>
                          <div className="space-y-3">
                            {withdrawalRequests.filter((u) => !selectedUserIds.has(u.id)).length === 0 ? (
                              <div className="py-10 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3">
                                <Users size={28} className="text-slate-200" />
                                <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{lang === 'EN' ? 'No withdrawal requests' : 'ยังไม่มีคำขอถอนตัว'}</p>
                              </div>
                            ) : (
                              withdrawalRequests
                                .filter((u) => !selectedUserIds.has(u.id))
                                .map((u) => (
                                  (() => {
                                    const pending = pendingUserOperations[u.id];
                                    const isSelected = pending?.type === 'APPLY_WITHDRAWAL';
                                    return (
                                      <div key={u.id} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col md:flex-row md:items-center gap-4">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                          <img src={u.avatar} className="w-12 h-12 rounded-xl object-cover ring-2 ring-white" alt="" />
                                          <div className="min-w-0">
                                            <div className="text-sm font-black text-slate-800 truncate">{u.name}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{u.withdrawalReason || '-'}</div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                          <button
                                            onClick={() => stageSelectWithdrawalUser(u)}
                                            disabled={isSelected}
                                            className="px-5 py-2 bg-[#111827] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
                                          >
                                            {isSelected ? (lang === 'EN' ? 'Selected' : 'เลือกแล้ว') : (lang === 'EN' ? 'Select' : 'เลือก')}
                                          </button>
                                        </div>

                                        {u.withdrawalDetail && (
                                          <div className="md:col-span-2 text-[11px] text-slate-500 font-medium italic pt-1 break-words">{u.withdrawalDetail}</div>
                                        )}
                                      </div>
                                    );
                                  })()
                                ))
                            )}
                          </div>
                       </div>

                       <div className="pt-8 border-t border-slate-100">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t.offboardingRequestsLabel}</div>
                          <div className="space-y-3">
                            {offboardingRequests.length === 0 ? (
                              <div className="py-10 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3">
                                <Users size={28} className="text-slate-200" />
                                <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{lang === 'EN' ? 'No offboarding requests' : 'ยังไม่มีคำขอแจ้งออกจากงาน'}</p>
                              </div>
                            ) : (
                              offboardingRequests
                                .filter((u) => !selectedUserIds.has(u.id))
                                .map((u) => (
                                  <div key={u.id} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col md:flex-row md:items-center gap-4">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                      <img src={u.avatar} className="w-12 h-12 rounded-xl object-cover ring-2 ring-white" alt="" />
                                      <div className="min-w-0">
                                        <div className="text-sm font-black text-slate-800 truncate">{u.name}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                                          {u.offboardingTasks?.filter((t: any) => t.status === 'COMPLETED').length || 0}/{u.offboardingTasks?.length || 0} {t.tasksCompleted}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => stageSelectOffboardingUser(u)}
                                        className="px-5 py-2 bg-[#111827] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
                                      >
                                        {lang === 'EN' ? 'Review' : 'ตรวจสอบ'}
                                      </button>
                                    </div>
                                  </div>
                                ))
                            )}
                          </div>
                       </div>

                         <div className="pt-10 border-t border-slate-100">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t.manageWithdrawnUsers}</div>
                          
                          {/* WITHDRAWAL USERS */}
                          <div>
                            <div className="flex items-center justify-between gap-4 mb-4">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                                <h4 className="text-sm font-bold text-slate-700">{t.withdrawalUsersLabel}</h4>
                                <span className="text-xs text-slate-400">({withdrawalUsers.length} {t.usersCount})</span>
                              </div>
                              <Link
                                to="/admin/withdrawn-withdrawal-users"
                                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all whitespace-nowrap"
                              >
                                {lang === 'EN' ? 'View all' : 'ดูทั้งหมด'}
                              </Link>
                            </div>
                            <div className="space-y-3">
                              {withdrawalUsers.length === 0 ? (
                                <div className="py-6 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3">
                                  <Users size={24} className="text-slate-200" />
                                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t.noWithdrawalUsers}</p>
                                </div>
                              ) : (
                                withdrawalUsers.slice(0, 3).map((u) => {
                                  const dirty = withdrawnDirty[u.id] === true;
                                  const accessValue = withdrawnAccessOverrides[u.id] ?? u.postProgramAccessLevel ?? 'LIMITED';
                                  const retentionValue = withdrawnRetentionOverrides[u.id] ?? u.postProgramRetentionPeriod ?? retentionPeriod;
                                  return (
                                    <div key={u.id} className="p-5 bg-rose-50 border border-rose-100 rounded-2xl flex flex-col gap-4">
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-4 min-w-0">
                                          <img src={u.avatar} className="w-12 h-12 rounded-xl object-cover ring-2 ring-white" alt="" />
                                          <div className="min-w-0">
                                            <div className="text-sm font-black text-slate-800 truncate">{u.name}</div>
                                            <div className="flex items-center gap-2">
                                              <span className="px-2 py-1 bg-rose-100 text-rose-600 text-[8px] font-black uppercase rounded-full">WITHDRAWAL</span>
                                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{u.withdrawalReason || t.earlyWithdrawal}</div>
                                            </div>
                                          </div>
                                        </div>

                                        <button
                                          onClick={() => void handleRestoreWithdrawnImmediate(u.id)}
                                          className="px-4 py-2 bg-white border border-slate-200 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:border-rose-200 transition-all whitespace-nowrap"
                                        >
                                          {lang === 'EN' ? 'Restore' : 'คืนค่า'}
                                        </button>
                                      </div>

                                      {u.withdrawalDetail && (
                                        <div className="text-[11px] text-slate-500 font-medium italic break-words">{u.withdrawalDetail}</div>
                                      )}

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.accessLevelLabel}</div>
                                          <select
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700"
                                            value={accessValue as PostProgramAccessLevel}
                                            onChange={(e) => {
                                              setWithdrawnAccessOverrides((prev) => ({ ...prev, [u.id]: e.target.value as PostProgramAccessLevel }));
                                              setWithdrawnDirty((prev) => ({ ...prev, [u.id]: true }));
                                            }}
                                          >
                                            <option value="REVOCATION">{t.optRevocation}</option>
                                            <option value="LIMITED">{t.optLimited}</option>
                                            <option value="EXTENDED">{t.optExtended}</option>
                                          </select>
                                        </div>

                                        <div className="space-y-1">
                                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.retentionLabel}</div>
                                          <input
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black tracking-widest text-slate-700"
                                            value={displayRetention(retentionValue)}
                                            onChange={(e) => {
                                              setWithdrawnRetentionOverrides((prev) => ({ ...prev, [u.id]: e.target.value }));
                                              setWithdrawnDirty((prev) => ({ ...prev, [u.id]: true }));
                                            }}
                                          />
                                        </div>
                                      </div>

                                      {dirty && (
                                        <div className="flex items-center justify-between gap-3 bg-white border border-amber-200 rounded-2xl p-4">
                                          <div className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                                            {lang === 'EN' ? 'Unsaved changes' : 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก'}
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <button
                                              onClick={() => void handleSaveWithdrawnEdit(u.id)}
                                              className="px-5 py-2 bg-[#111827] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
                                            >
                                              {lang === 'EN' ? 'Save' : 'บันทึก'}
                                            </button>
                                            <button
                                              onClick={() => handleCancelWithdrawnEdit(u.id)}
                                              className="px-5 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                                            >
                                              {lang === 'EN' ? 'Cancel' : 'ยกเลิก'}
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* OFFBOARDING USERS */}
                          <div className="mt-8">
                            <div className="flex items-center justify-between gap-4 mb-4">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <h4 className="text-sm font-bold text-slate-700">{t.offboardingUsersLabel}</h4>
                                <span className="text-xs text-slate-400">({completedOffboardingUsers.length} {t.usersCount})</span>
                              </div>
                              <Link
                                to="/admin/withdrawn-offboarding-users"
                                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all whitespace-nowrap"
                              >
                                {lang === 'EN' ? 'View all' : 'ดูทั้งหมด'}
                              </Link>
                            </div>
                            <div className="space-y-3">
                              {completedOffboardingUsers.length === 0 ? (
                                <div className="py-6 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3">
                                  <Users size={24} className="text-slate-200" />
                                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t.noOffboardingUsers}</p>
                                </div>
                              ) : (
                                completedOffboardingUsers.slice(0, 3).map((u) => (
                                  <div key={u.id} className="p-5 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col gap-4">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex items-center gap-4 min-w-0">
                                        <img src={u.avatar} className="w-12 h-12 rounded-xl object-cover ring-2 ring-white" alt="" />
                                        <div className="min-w-0">
                                          <div className="text-sm font-black text-slate-800 truncate">{u.name}</div>
                                          <div className="flex items-center gap-2">
                                            <span className="px-2 py-1 bg-blue-100 text-blue-600 text-[8px] font-black uppercase rounded-full">OFFBOARDING</span>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{t.completedProcess}</div>
                                          </div>
                                        </div>
                                      </div>

                                      <button
                                        onClick={() => void handleRestoreCompletedOffboardingImmediate(u.id)}
                                        className="px-4 py-2 bg-white border border-slate-200 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 hover:border-blue-200 transition-all whitespace-nowrap"
                                      >
                                        {lang === 'EN' ? 'Restore' : 'คืนค่า'}
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                       </div>
                    </div>
                  </section>
               </div>

               {/* Right Sidebar: Whitelist */}
               <div className="lg:col-span-4 space-y-8 animate-in slide-in-from-right-4 duration-500">
                  <div className="bg-white border border-slate-100 rounded-[3.5rem] p-10 flex flex-col h-full shadow-sm">
                     <div className="flex items-center gap-3 mb-8">
                        <Plus size={20} className="text-slate-400" />
                        <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">{t.postProgramAccessList}</h3>
                     </div>
                     <p className="text-slate-400 text-xs leading-relaxed font-medium mb-10">
                        {lang === 'EN' ? 'Selected withdrawal and offboarding requests waiting for deploy.' : 'รายการที่ถูกเลือกเพื่อกำหนดสิทธิ์ (รอกด Deploy)'}
                     </p>

                     <div className="space-y-3 mb-10 flex-1">
                        {(Object.values(pendingUserOperations) as PendingUserOperation[]).filter((op) => op.type === 'APPLY_WITHDRAWAL' || op.type === 'UPDATE_POST_PROGRAM').length === 0 ? (
                          <div className="py-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3">
                            <History size={32} className="text-slate-200" />
                            <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{lang === 'EN' ? 'No selected users yet' : 'ยังไม่มีรายชื่อที่ถูกเลือก'}</p>
                          </div>
                        ) : (
                          (Object.values(pendingUserOperations) as PendingUserOperation[])
                            .filter((op) => op.type === 'APPLY_WITHDRAWAL' || op.type === 'UPDATE_POST_PROGRAM')
                            .map((op) => (
                              <div key={op.userId} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-3 hover:bg-white hover:border-blue-100 transition-all">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <img src={op.avatar} className="w-10 h-10 rounded-xl object-cover ring-2 ring-white" alt="" />
                                    <div className="min-w-0">
                                      <div className="text-sm font-black text-slate-800 truncate">{op.name}</div>
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 text-[8px] font-black uppercase rounded-full ${op.type === 'APPLY_WITHDRAWAL' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                                          {op.type === 'APPLY_WITHDRAWAL' ? 'WITHDRAWAL' : 'OFFBOARDING'}
                                        </span>
                                        {op.type === 'APPLY_WITHDRAWAL' && (op as any).withdrawalReason && (
                                          <span className="text-[10px] text-slate-400 truncate">{(op as any).withdrawalReason}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => clearPendingUserOperation(op.userId)}
                                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-white rounded-xl p-3 border border-slate-100">
                                    <div className="text-[10px] text-slate-400 uppercase mb-1">{t.accessLevelLabel}</div>
                                    <div className="text-sm font-black text-slate-800">{op.accessLevel}</div>
                                  </div>
                                  <div className="bg-white rounded-xl p-3 border border-slate-100">
                                    <div className="text-[10px] text-slate-400 uppercase mb-1">{t.retentionLabel}</div>
                                    <div className="text-sm font-black text-slate-800">{displayRetention(op.retentionPeriod)}</div>
                                  </div>
                                </div>
                              </div>
                            ))
                        )}
                     </div>

                     <button className="w-full py-5 border-2 border-dashed border-blue-200 text-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-all" disabled>
                        {lang === 'EN' ? 'ADD USER (COMING SOON)' : 'เพิ่มรายชื่อ (เร็วๆ นี้)'}
                     </button>
                  </div>
               </div>
            </div>
          )}

          {/* TAB: EVALUATION */}
          {activeTab === 'evaluation' && (
            <div className="animate-in fade-in duration-500">
              <div>
                <section className="bg-white rounded-[3.5rem] p-10 md:p-12 border border-slate-100 shadow-sm relative overflow-hidden">
                  <div className="mb-12">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t.tabEvaluation}</h2>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mt-2">
                      {lang === 'TH' ? 'จัดการหัวข้อการประเมินที่ใช้ทั้งระบบ' : 'Manage global evaluation headings used across the app'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem]">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{lang === 'TH' ? 'ตัวอย่าง (Dashboard)' : 'PREVIEW (DASHBOARD)'} </div>
                      <div className="mt-6 space-y-6">
                        {dashboardPreviewLabelsByLang[lang].metrics.map((label, idx) => {
                          const widths = ['78%', '72%', '85%', '66%', '74%', '81%', '69%', '90%'];
                          const colors = ['bg-blue-600', 'bg-indigo-600', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-cyan-600', 'bg-violet-600', 'bg-lime-600'];
                          return (
                            <div key={`${label}-${idx}`}>
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3">{label}</div>
                              <div className="h-3 w-full bg-white rounded-full border border-slate-200 overflow-hidden">
                                <div className={`h-full ${colors[idx % colors.length]}`} style={{ width: widths[idx % widths.length] }} />
                              </div>
                            </div>
                          );
                        })}

                        {dashboardPreviewLabelsByLang[lang].comments.map((label, idx) => (
                          <div key={`${label}-${idx}`} className={idx === 0 ? 'pt-2' : undefined}>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">{label}</div>
                            <div className="text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-2xl p-4">
                              {lang === 'TH' ? 'ตัวอย่างข้อความความคิดเห็น' : 'Sample evaluation comments'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem]">
                      <button
                        type="button"
                        onClick={() => setEvalEditHeadingsOpen((v) => !v)}
                        className="w-full flex items-center justify-between gap-4 px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-white hover:border-blue-200 transition-all"
                      >
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{lang === 'TH' ? 'แก้ไขหัวข้อ (EN/TH)' : 'EDIT HEADINGS (EN/TH)'} </div>
                        <ChevronDown
                          size={20}
                          className={`text-slate-500 transition-transform ${evalEditHeadingsOpen ? 'rotate-0' : '-rotate-90'}`}
                        />
                      </button>

                      {evalEditHeadingsOpen && (
                      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">EN</div>
                          <div className="mt-4 space-y-4">
                            <input
                              value={evaluationLabelsByLang.EN.technical}
                              onChange={(e) =>
                                setEvaluationLabelsByLang((p) => ({ ...p, EN: { ...p.EN, technical: e.target.value } }))
                              }
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                            />
                            <input
                              value={evaluationLabelsByLang.EN.communication}
                              onChange={(e) =>
                                setEvaluationLabelsByLang((p) => ({ ...p, EN: { ...p.EN, communication: e.target.value } }))
                              }
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                            />
                            <input
                              value={evaluationLabelsByLang.EN.punctuality}
                              onChange={(e) =>
                                setEvaluationLabelsByLang((p) => ({ ...p, EN: { ...p.EN, punctuality: e.target.value } }))
                              }
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                            />
                            <input
                              value={evaluationLabelsByLang.EN.initiative}
                              onChange={(e) =>
                                setEvaluationLabelsByLang((p) => ({ ...p, EN: { ...p.EN, initiative: e.target.value } }))
                              }
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                            />
                            <input
                              value={evaluationLabelsByLang.EN.overallComments}
                              onChange={(e) =>
                                setEvaluationLabelsByLang((p) => ({ ...p, EN: { ...p.EN, overallComments: e.target.value } }))
                              }
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                            />
                            <input
                              value={evaluationLabelsByLang.EN.workPerformance}
                              onChange={(e) =>
                                setEvaluationLabelsByLang((p) => ({ ...p, EN: { ...p.EN, workPerformance: e.target.value } }))
                              }
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">TH</div>
                          <div className="mt-4 space-y-4">
                            <input
                              value={evaluationLabelsByLang.TH.technical}
                              onChange={(e) =>
                                setEvaluationLabelsByLang((p) => ({ ...p, TH: { ...p.TH, technical: e.target.value } }))
                              }
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                            />
                            <input
                              value={evaluationLabelsByLang.TH.communication}
                              onChange={(e) =>
                                setEvaluationLabelsByLang((p) => ({ ...p, TH: { ...p.TH, communication: e.target.value } }))
                              }
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                            />
                            <input
                              value={evaluationLabelsByLang.TH.punctuality}
                              onChange={(e) =>
                                setEvaluationLabelsByLang((p) => ({ ...p, TH: { ...p.TH, punctuality: e.target.value } }))
                              }
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                            />
                            <input
                              value={evaluationLabelsByLang.TH.initiative}
                              onChange={(e) =>
                                setEvaluationLabelsByLang((p) => ({ ...p, TH: { ...p.TH, initiative: e.target.value } }))
                              }
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                            />
                            <input
                              value={evaluationLabelsByLang.TH.overallComments}
                              onChange={(e) =>
                                setEvaluationLabelsByLang((p) => ({ ...p, TH: { ...p.TH, overallComments: e.target.value } }))
                              }
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                            />
                            <input
                              value={evaluationLabelsByLang.TH.workPerformance}
                              onChange={(e) =>
                                setEvaluationLabelsByLang((p) => ({ ...p, TH: { ...p.TH, workPerformance: e.target.value } }))
                              }
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                            />
                          </div>
                        </div>
                      </div>
                      )}

                        <div className="pt-6">
                          <button
                            type="button"
                            onClick={() => setEvalEditPreviewOpen((v) => !v)}
                            className="w-full flex items-center justify-between gap-4 px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-white hover:border-blue-200 transition-all"
                          >
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{lang === 'TH' ? 'แก้ไขพรีวิว (EN/TH)' : 'EDIT PREVIEW (EN/TH)'}</div>
                            <ChevronDown
                              size={20}
                              className={`text-slate-500 transition-transform ${evalEditPreviewOpen ? 'rotate-0' : '-rotate-90'}`}
                            />
                          </button>

                          {evalEditPreviewOpen && (
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">EN</div>

                                <div className="mt-4">
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3">{lang === 'TH' ? 'หัวข้อคะแนน' : 'METRICS'}</div>
                                  <div className="space-y-3">
                                    {dashboardPreviewLabelsByLang.EN.metrics.map((val, idx) => (
                                      <div key={`en-metric-${idx}`} className="flex items-center gap-3">
                                        <input
                                          value={val}
                                          onChange={(e) =>
                                            setDashboardPreviewLabelsByLang((p) => ({
                                              ...p,
                                              EN: {
                                                ...p.EN,
                                                metrics: p.EN.metrics.map((x, i) => (i === idx ? e.target.value : x)),
                                              },
                                            }))
                                          }
                                          className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setDashboardPreviewLabelsByLang((p) => ({
                                              ...p,
                                              EN: {
                                                ...p.EN,
                                                metrics: p.EN.metrics.filter((_, i) => i !== idx),
                                              },
                                            }))
                                          }
                                          className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all"
                                          disabled={dashboardPreviewLabelsByLang.EN.metrics.length <= 1}
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDashboardPreviewLabelsByLang((p) => ({
                                          ...p,
                                          EN: {
                                            ...p.EN,
                                            metrics: [...p.EN.metrics, lang === 'TH' ? 'หัวข้อคะแนนใหม่' : 'NEW METRIC'],
                                          },
                                        }))
                                      }
                                      className="w-full py-4 border-2 border-dashed border-slate-200 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                    >
                                      <Plus size={16} /> {lang === 'TH' ? 'เพิ่มหัวข้อคะแนน' : 'ADD METRIC'}
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-6">
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3">{lang === 'TH' ? 'หัวข้อคอมเม้นต์' : 'COMMENTS'}</div>
                                  <div className="space-y-3">
                                    {dashboardPreviewLabelsByLang.EN.comments.map((val, idx) => (
                                      <div key={`en-comment-${idx}`} className="flex items-center gap-3">
                                        <input
                                          value={val}
                                          onChange={(e) =>
                                            setDashboardPreviewLabelsByLang((p) => ({
                                              ...p,
                                              EN: {
                                                ...p.EN,
                                                comments: p.EN.comments.map((x, i) => (i === idx ? e.target.value : x)),
                                              },
                                            }))
                                          }
                                          className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setDashboardPreviewLabelsByLang((p) => ({
                                              ...p,
                                              EN: {
                                                ...p.EN,
                                                comments: p.EN.comments.filter((_, i) => i !== idx),
                                              },
                                            }))
                                          }
                                          className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all"
                                          disabled={dashboardPreviewLabelsByLang.EN.comments.length <= 1}
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDashboardPreviewLabelsByLang((p) => ({
                                          ...p,
                                          EN: {
                                            ...p.EN,
                                            comments: [...p.EN.comments, lang === 'TH' ? 'หัวข้อคอมเม้นต์ใหม่' : 'NEW COMMENT'],
                                          },
                                        }))
                                      }
                                      className="w-full py-4 border-2 border-dashed border-slate-200 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                    >
                                      <Plus size={16} /> {lang === 'TH' ? 'เพิ่มหัวข้อคอมเม้นต์' : 'ADD COMMENT'}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">TH</div>

                                <div className="mt-4">
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3">{lang === 'TH' ? 'หัวข้อคะแนน' : 'METRICS'}</div>
                                  <div className="space-y-3">
                                    {dashboardPreviewLabelsByLang.TH.metrics.map((val, idx) => (
                                      <div key={`th-metric-${idx}`} className="flex items-center gap-3">
                                        <input
                                          value={val}
                                          onChange={(e) =>
                                            setDashboardPreviewLabelsByLang((p) => ({
                                              ...p,
                                              TH: {
                                                ...p.TH,
                                                metrics: p.TH.metrics.map((x, i) => (i === idx ? e.target.value : x)),
                                              },
                                            }))
                                          }
                                          className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setDashboardPreviewLabelsByLang((p) => ({
                                              ...p,
                                              TH: {
                                                ...p.TH,
                                                metrics: p.TH.metrics.filter((_, i) => i !== idx),
                                              },
                                            }))
                                          }
                                          className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all"
                                          disabled={dashboardPreviewLabelsByLang.TH.metrics.length <= 1}
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDashboardPreviewLabelsByLang((p) => ({
                                          ...p,
                                          TH: {
                                            ...p.TH,
                                            metrics: [...p.TH.metrics, 'หัวข้อคะแนนใหม่'],
                                          },
                                        }))
                                      }
                                      className="w-full py-4 border-2 border-dashed border-slate-200 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                    >
                                      <Plus size={16} /> {lang === 'TH' ? 'เพิ่มหัวข้อคะแนน' : 'ADD METRIC'}
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-6">
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3">{lang === 'TH' ? 'หัวข้อคอมเม้นต์' : 'COMMENTS'}</div>
                                  <div className="space-y-3">
                                    {dashboardPreviewLabelsByLang.TH.comments.map((val, idx) => (
                                      <div key={`th-comment-${idx}`} className="flex items-center gap-3">
                                        <input
                                          value={val}
                                          onChange={(e) =>
                                            setDashboardPreviewLabelsByLang((p) => ({
                                              ...p,
                                              TH: {
                                                ...p.TH,
                                                comments: p.TH.comments.map((x, i) => (i === idx ? e.target.value : x)),
                                              },
                                            }))
                                          }
                                          className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setDashboardPreviewLabelsByLang((p) => ({
                                              ...p,
                                              TH: {
                                                ...p.TH,
                                                comments: p.TH.comments.filter((_, i) => i !== idx),
                                              },
                                            }))
                                          }
                                          className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all"
                                          disabled={dashboardPreviewLabelsByLang.TH.comments.length <= 1}
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDashboardPreviewLabelsByLang((p) => ({
                                          ...p,
                                          TH: {
                                            ...p.TH,
                                            comments: [...p.TH.comments, 'หัวข้อคอมเม้นต์ใหม่'],
                                          },
                                        }))
                                      }
                                      className="w-full py-4 border-2 border-dashed border-slate-200 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                    >
                                      <Plus size={16} /> {lang === 'TH' ? 'เพิ่มหัวข้อคอมเม้นต์' : 'ADD COMMENT'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    </div>
                  </section>
              </div>
            </div>
          )}

        </div>

        {/* Global Action Footer */}
        <div className="fixed bottom-0 left-0 right-0 lg:left-72 bg-white/80 backdrop-blur-md border-t border-slate-100 p-6 z-40 flex justify-center">
           <div className="max-w-[1700px] w-full flex justify-between items-center px-4 md:px-10">
              <div className="flex items-center gap-4 text-slate-400">
                <AlertCircle size={18} className="text-amber-500" />
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">{t.disclaimer}</span>
              </div>
              <div className="flex gap-4">
                <button onClick={handleReset} className="px-10 py-3.5 bg-slate-100 text-slate-500 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all">{t.reset}</button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-14 py-3.5 bg-[#111827] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-2xl flex items-center gap-3"
                >
                  {isSaving ? (
                    <>
                      <Clock className="animate-spin" size={18} /> {t.saving}
                    </>
                  ) : didSaveRecently ? (
                    <>
                      <CheckCircle2 size={18} /> {lang === 'EN' ? 'Saved' : 'บันทึกแล้ว'}
                    </>
                  ) : (
                    <>
                      <Save size={18} /> {t.saveBtn}
                    </>
                  )}
                </button>
              </div>
           </div>

           {saveNotice && (
             <div className="absolute -top-4 left-0 right-0 flex justify-center px-6">
               <div
                 className={`max-w-[1700px] w-full px-5 py-3 rounded-2xl border text-sm font-bold shadow-lg ${
                   saveNotice.type === 'success'
                     ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                     : 'bg-rose-50 border-rose-100 text-rose-700'
                 }`}
               >
                 {saveNotice.message}
               </div>
             </div>
           )}
        </div>
      </div>

    </div>
  );
};

// --- SUB-COMPONENTS ---

const TabBtn = ({ active, onClick, icon, label, hasNotification }: any) => (
  <button onClick={onClick} className={`relative flex items-center gap-1.5 px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all whitespace-nowrap ${active ? 'bg-[#111827] text-white shadow-xl' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}>
    {icon} {label}
    {hasNotification && (
      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
    )}
  </button>
);

const AccessCard = ({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) => (
  <button 
    onClick={onClick}
    className={`w-full p-6 rounded-[1.75rem] border-2 transition-all flex items-center gap-6 text-left group ${
      active ? 'border-blue-600 bg-white shadow-xl shadow-blue-500/5' : 'border-slate-50 bg-[#F8FAFC]'
    }`}
  >
    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${active ? 'border-blue-600' : 'border-slate-200'}`}>
       {active && <div className="w-3 h-3 bg-blue-600 rounded-full"></div>}
    </div>
    <div>
       <p className={`text-xs font-black uppercase tracking-widest mb-1 ${active ? 'text-slate-900' : 'text-slate-400'}`}>{title}</p>
       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{desc}</p>
    </div>
  </button>
);

export default SystemSettingsPage;
