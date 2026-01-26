export interface CertRequest {
  id: string;
  internName: string;
  avatar: string;
  type: 'Completion' | 'Recommendation';
  date: string;
  status: 'PENDING' | 'ISSUED';
}

export interface AllowanceClaim {
  id: string;
  internId: string;
  internName: string;
  avatar: string;
  bankName?: string;
  bankAccountNumber?: string;
  monthKey?: string;
  amount: number;
  period: string;
  breakdown: { wfo: number; wfh: number; leaves: number };
  status: 'PENDING' | 'APPROVED' | 'PAID';
  paymentDate?: string;
  paidAtMs?: number;
  isPayoutLocked?: boolean;
  lockReason?: string;
}

export interface InternRecord {
  id: string;
  name: string;
  avatar: string;
  position: string;
  dept: string;
  status: 'Active' | 'Onboarding' | 'Completed' | 'WITHDRAWAL_REQUESTED' | 'OFFBOARDING_REQUESTED' | 'WITHDRAWN' | 'COMPLETED_REPORTED';
  lifecycleStatus?: string;
  bankName?: string;
  bankAccountNumber?: string;
  supervisor: {
    name: string;
    avatar: string;
    id: string;
  } | null;
}

export interface Mentor {
  id: string;
  name: string;
  avatar: string;
  dept: string;
}
