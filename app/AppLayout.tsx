import React, { useEffect, useMemo, useState } from 'react';

import { Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';



import Header from '@/components/Header';

import Sidebar from '@/components/Sidebar';

import { PageId } from '@/pageTypes';

import { UserRole } from '@/types';



import { signOut } from 'firebase/auth';

import { collection, doc, getDocs, onSnapshot, query, where, type DocumentData, type Query } from 'firebase/firestore';



import { firebaseAuth, firestoreDb } from '@/firebase';



import { Toaster } from 'sonner';



import { useAppContext } from './AppContext';

import { isPageId, pageIdToPath, RoleSlug, slugToRole } from './routeUtils';



export default function AppLayout() {

  const navigate = useNavigate();

  const { roleSlug, pageId } = useParams<{ roleSlug: RoleSlug; pageId: string }>();

  const { user, setUser, activeRole, setActiveRole, lang, toggleLang } = useAppContext();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [approvedLeaveCount, setApprovedLeaveCount] = useState(0);

  const [lastLeavePageVisit, setLastLeavePageVisit] = useState<number>(() => {

    const stored = localStorage.getItem('lastLeavePageVisit');

    return stored ? parseInt(stored, 10) : 0;

  });

  const [newAssignmentCount, setNewAssignmentCount] = useState(0);

  const [lastAssignmentPageVisit, setLastAssignmentPageVisit] = useState<number>(() => {

    const stored = localStorage.getItem('lastAssignmentPageVisit');

    return stored ? parseInt(stored, 10) : 0;

  });

  const [newFeedbackCount, setNewFeedbackCount] = useState(0);

  const [lastFeedbackPageVisit, setLastFeedbackPageVisit] = useState<number>(() => {

    const stored = localStorage.getItem('lastFeedbackPageVisit');

    return stored ? parseInt(stored, 10) : 0;

  });

  const [newEvaluationCount, setNewEvaluationCount] = useState(0);

  const [lastEvaluationPageVisit, setLastEvaluationPageVisit] = useState<number>(() => {

    const stored = localStorage.getItem('lastEvaluationPageVisit');

    return stored ? parseInt(stored, 10) : 0;

  });

  const [newCertificatesCount, setNewCertificatesCount] = useState(0);

  const [lastCertificatesPageVisit, setLastCertificatesPageVisit] = useState<number>(() => {

    const stored = localStorage.getItem('lastCertificatesPageVisit');

    return stored ? parseInt(stored, 10) : 0;

  });

  const [newAllowanceCount, setNewAllowanceCount] = useState(0);

  const [lastAllowancePageVisit, setLastAllowancePageVisit] = useState<number>(() => {

    const stored = localStorage.getItem('lastAllowancePageVisit');

    return stored ? parseInt(stored, 10) : 0;

  });

  const [newAppointmentRequestCount, setNewAppointmentRequestCount] = useState(0);

  const [lastAppointmentRequestPageVisit, setLastAppointmentRequestPageVisit] = useState<number>(() => {

    const stored = localStorage.getItem('lastAppointmentRequestPageVisit');

    return stored ? parseInt(stored, 10) : 0;

  });

  const [newSystemSettingsCount, setNewSystemSettingsCount] = useState(0);

  const [lastSystemSettingsPageVisit, setLastSystemSettingsPageVisit] = useState<number>(() => {

    const stored = localStorage.getItem('lastSystemSettingsPageVisit');

    return stored ? parseInt(stored, 10) : 0;

  });

  const [newInternManagementCount, setNewInternManagementCount] = useState(0);

  const [lastManageInternsPageVisit, setLastManageInternsPageVisit] = useState<number>(() => {

    const stored = localStorage.getItem('lastManageInternsPageVisit');

    if (!stored) return 0;

    const parsed = parseInt(stored, 10);

    return Number.isFinite(parsed) ? parsed : 0;

  });

  const [lastManageInternsPageVisitAdmin, setLastManageInternsPageVisitAdmin] = useState<number>(() => {

    const stored = localStorage.getItem('lastManageInternsPageVisit_admin');

    if (!stored) return 0;

    const parsed = parseInt(stored, 10);

    return Number.isFinite(parsed) ? parsed : 0;

  });



  useEffect(() => {

    if (roleSlug) {

      const role = slugToRole(roleSlug);

      if (role && role !== activeRole) {

        setActiveRole(role);

      }

    }

  }, [roleSlug, activeRole, setActiveRole]);



  useEffect(() => {

    if (!user) {

      setApprovedLeaveCount(0);

      return;

    }



    const leaveRef = collection(firestoreDb, 'leaveRequests');

    let q: Query<DocumentData>;

    let lastVisitKey = 'lastLeavePageVisit';



    if (activeRole === 'INTERN') {

      q = query(leaveRef, where('internId', '==', user.id), where('status', '==', 'APPROVED'));

    } else if (activeRole === 'SUPERVISOR') {

      q = query(leaveRef, where('supervisorId', '==', user.id), where('status', '==', 'PENDING'));

      lastVisitKey = 'lastLeavePageVisit_supervisor';

    } else if (activeRole === 'HR_ADMIN') {

      q = query(leaveRef, where('status', '==', 'PENDING'));

      lastVisitKey = 'lastLeavePageVisit_admin';

    } else {

      setApprovedLeaveCount(0);

      return;

    }



    const storedVisit = localStorage.getItem(lastVisitKey);

    const lastVisit = storedVisit ? parseInt(storedVisit, 10) : 0;



    return onSnapshot(

      q,

      (snap) => {

        let count = 0;

        console.log(`🔍 Leave Notification Debug [${activeRole}]:`, {

          totalDocs: snap.size,

          lastVisit,

          lastVisitKey

        });

        

        snap.forEach((doc) => {

          const data = doc.data();

          

          if (activeRole === 'INTERN') {

            const approvedAtStr = data.approvedAt as string | undefined;

            const updatedAtTimestamp = data.updatedAt as any;

            

            let timestamp = 0;

            if (updatedAtTimestamp?.toDate) {

              timestamp = updatedAtTimestamp.toDate().getTime();

            } else if (approvedAtStr) {

              timestamp = new Date(approvedAtStr + 'T00:00:00').getTime();

            }

            

            if (timestamp > lastVisit) {

              count++;

            }

          } else {

            const requestedAtStr = data.requestedAt as string | undefined;

            const createdAtTimestamp = data.createdAt as any;

            

            let timestamp = 0;

            if (createdAtTimestamp?.toDate) {

              timestamp = createdAtTimestamp.toDate().getTime();

            } else if (requestedAtStr) {

              timestamp = new Date(requestedAtStr + 'T00:00:00').getTime();

            }

            

            console.log(`  - Doc ${doc.id}:`, {

              internName: data.internName,

              status: data.status,

              requestedAt: requestedAtStr,

              createdAt: createdAtTimestamp?.toDate?.().toISOString(),

              timestamp,

              lastVisit,

              isNew: timestamp > lastVisit

            });

            

            if (timestamp > lastVisit) {

              count++;

            }

          }

        });

        

        console.log(`  ✅ Final count: ${count}`);

        setApprovedLeaveCount(count);

      },

      () => {

        setApprovedLeaveCount(0);

      }

    );

  }, [user, activeRole, lastLeavePageVisit]);



  useEffect(() => {

    if (!user || activeRole !== 'INTERN') {

      setNewAssignmentCount(0);

      return;

    }



    const assignedRef = collection(firestoreDb, 'users', user.id, 'assignmentProjects');

    const personalRef = collection(firestoreDb, 'users', user.id, 'personalProjects');



    let assignedCount = 0;

    let personalCount = 0;



    const countNewItems = () => {

      setNewAssignmentCount(assignedCount + personalCount);

    };



    const unsubAssigned = onSnapshot(

      assignedRef,

      (snap) => {

        assignedCount = 0;

        snap.forEach((doc) => {

          const data = doc.data();

          const createdAtStr = data.createdAt as any;

          const updatedAtStr = data.updatedAt as any;

          

          let timestamp = 0;

          if (updatedAtStr?.toDate) {

            timestamp = updatedAtStr.toDate().getTime();

          } else if (createdAtStr?.toDate) {

            timestamp = createdAtStr.toDate().getTime();

          }

          

          if (timestamp > lastAssignmentPageVisit) {

            assignedCount++;

          }

        });

        countNewItems();

      },

      () => {

        assignedCount = 0;

        countNewItems();

      }

    );



    const unsubPersonal = onSnapshot(

      personalRef,

      (snap) => {

        personalCount = 0;

        snap.forEach((doc) => {

          const data = doc.data();

          const createdAtStr = data.createdAt as any;

          const updatedAtStr = data.updatedAt as any;

          

          let timestamp = 0;

          if (updatedAtStr?.toDate) {

            timestamp = updatedAtStr.toDate().getTime();

          } else if (createdAtStr?.toDate) {

            timestamp = createdAtStr.toDate().getTime();

          }

          

          if (timestamp > lastAssignmentPageVisit) {

            personalCount++;

          }

        });

        countNewItems();

      },

      () => {

        personalCount = 0;

        countNewItems();

      }

    );



    return () => {

      unsubAssigned();

      unsubPersonal();

    };

  }, [user, activeRole, lastAssignmentPageVisit]);



  useEffect(() => {

    if (!user || activeRole !== 'INTERN') {

      setNewFeedbackCount(0);

      return;

    }



    const feedbackRef = collection(firestoreDb, 'users', user.id, 'feedbackMilestones');



    return onSnapshot(

      feedbackRef,

      (snap) => {

        let count = 0;

        snap.forEach((doc) => {

          const data = doc.data();

          const supervisorReviewedAt = data.supervisorReviewedAt as any;

          

          let timestamp = 0;

          if (supervisorReviewedAt?.toDate) {

            timestamp = supervisorReviewedAt.toDate().getTime();

          }

          

          if (timestamp > lastFeedbackPageVisit && (data.status === 'reviewed' || data.supervisorPerformance)) {

            count++;

          }

        });

        setNewFeedbackCount(count);

      },

      () => {

        setNewFeedbackCount(0);

      }

    );

  }, [user, activeRole, lastFeedbackPageVisit]);



  useEffect(() => {

    if (!user) {

      setNewEvaluationCount(0);

      return;

    }



    let lastVisitKey = 'lastEvaluationPageVisit';

    

    if (activeRole === 'SUPERVISOR') {

      lastVisitKey = 'lastEvaluationPageVisit_supervisor';

    } else if (activeRole === 'HR_ADMIN') {

      lastVisitKey = 'lastEvaluationPageVisit_admin';

    }



    const storedVisit = localStorage.getItem(lastVisitKey);

    const lastVisit = storedVisit ? parseInt(storedVisit, 10) : 0;



    if (activeRole === 'INTERN') {

      // Disable notification listener for intern to avoid permission issues

      // Intern notifications are handled on the evaluation page itself

      setNewEvaluationCount(0);

      return;

    } else if (activeRole === 'SUPERVISOR') {

      // For supervisor: query by supervisorId to match security rules

      const evalRef = collection(firestoreDb, 'universityEvaluations');

      const q = query(evalRef, where('supervisorId', '==', user.id));

      

      return onSnapshot(

        q,

        (snap) => {

          console.log('🔍 Supervisor Evaluation Notification Debug:', {

            totalDocs: snap.size,

            lastVisit,

            lastVisitKey

          });

          

          let count = 0;

          snap.forEach((doc) => {

            const data = doc.data();

            

            // Check for submitted delivery details OR appointment request

            const submissionStatus = data.submissionStatus;

            const submittedAt = data.submittedAt as any;

            const appointmentRequest = data.appointmentRequest as any;

            

            console.log(`  - Doc ${doc.id} (${data.internName}):`, {

              submissionStatus,

              submittedAt: submittedAt?.toDate?.().toISOString(),

              submittedTimestamp: submittedAt?.toDate?.().getTime(),

              appointmentStatus: appointmentRequest?.status,

              appointmentUpdatedAt: appointmentRequest?.updatedAt?.toDate?.().toISOString(),

              appointmentTimestamp: appointmentRequest?.updatedAt?.toDate?.().getTime(),

              lastVisit,

              willCountDelivery: submissionStatus === 'SUBMITTED' && submittedAt?.toDate?.().getTime() > lastVisit,

              willCountAppointment: appointmentRequest?.status === 'REQUESTED' && appointmentRequest?.updatedAt?.toDate?.().getTime() > lastVisit

            });

            

            // Count if delivery details were submitted after last visit

            if (submissionStatus === 'SUBMITTED' && submittedAt?.toDate) {

              const timestamp = submittedAt.toDate().getTime();

              if (timestamp > lastVisit) {

                count++;

                return;

              }

            }

            

            // OR count if appointment request is pending

            if (appointmentRequest?.status === 'REQUESTED') {

              const updatedAt = appointmentRequest.updatedAt as any;

              if (updatedAt?.toDate) {

                const timestamp = updatedAt.toDate().getTime();

                if (timestamp > lastVisit) {

                  count++;

                }

              }

            }

          });

          

          console.log(`  ✅ Supervisor Evaluation Final count: ${count}`);

          setNewEvaluationCount(count);

        },

        (error) => {

          console.error('❌ Supervisor Evaluation Error:', error);

          setNewEvaluationCount(0);

        }

      );

    } else if (activeRole === 'HR_ADMIN') {

      // For admin: read entire collection

      const evalRef = collection(firestoreDb, 'universityEvaluations');

      

      return onSnapshot(

        evalRef,

        (snap) => {

          console.log('🔍 Admin Evaluation Notification Debug:', {

            totalDocs: snap.size,

            lastVisit,

            lastVisitKey

          });

          

          let count = 0;

          snap.forEach((doc) => {

            const data = doc.data();

            

            // Check for submitted delivery details OR appointment request

            const submissionStatus = data.submissionStatus;

            const submittedAt = data.submittedAt as any;

            const appointmentRequest = data.appointmentRequest as any;

            

            console.log(`  - Doc ${doc.id} (${data.internName}):`, {

              submissionStatus,

              submittedAt: submittedAt?.toDate?.().toISOString(),

              submittedTimestamp: submittedAt?.toDate?.().getTime(),

              appointmentStatus: appointmentRequest?.status,

              appointmentUpdatedAt: appointmentRequest?.updatedAt?.toDate?.().toISOString(),

              appointmentTimestamp: appointmentRequest?.updatedAt?.toDate?.().getTime(),

              lastVisit,

              willCountDelivery: submissionStatus === 'SUBMITTED' && submittedAt?.toDate?.().getTime() > lastVisit,

              willCountAppointment: appointmentRequest?.status === 'REQUESTED' && appointmentRequest?.updatedAt?.toDate?.().getTime() > lastVisit

            });

            

            // Count if delivery details were submitted after last visit

            if (submissionStatus === 'SUBMITTED' && submittedAt?.toDate) {

              const timestamp = submittedAt.toDate().getTime();

              if (timestamp > lastVisit) {

                count++;

                return;

              }

            }

            

            // OR count if appointment request is pending

            if (appointmentRequest?.status === 'REQUESTED') {

              const updatedAt = appointmentRequest.updatedAt as any;

              if (updatedAt?.toDate) {

                const timestamp = updatedAt.toDate().getTime();

                if (timestamp > lastVisit) {

                  count++;

                }

              }

            }

          });

          

          console.log(`  ✅ Admin Evaluation Final count: ${count}`);

          setNewEvaluationCount(count);

        },

        (error) => {

          console.error('❌ Admin Evaluation Error:', error);

          setNewEvaluationCount(0);

        }

      );

    } else {

      setNewEvaluationCount(0);

      return;

    }

  }, [user, activeRole, lastEvaluationPageVisit]);



  useEffect(() => {

    if (!user) {

      setNewCertificatesCount(0);

      return;

    }



    const certRef = collection(firestoreDb, 'certificateRequests');

    let q: Query<DocumentData>;

    let lastVisitKey = 'lastCertificatesPageVisit';



    if (activeRole === 'INTERN') {

      q = query(certRef, where('internId', '==', user.id), where('status', '==', 'ISSUED'));

    } else if (activeRole === 'SUPERVISOR') {

      q = query(certRef, where('supervisorId', '==', user.id), where('status', '==', 'REQUESTED'));

      lastVisitKey = 'lastCertificatesPageVisit_supervisor';

    } else if (activeRole === 'HR_ADMIN') {

      q = query(certRef, where('status', '==', 'REQUESTED'));

      lastVisitKey = 'lastCertificatesPageVisit_admin';

    } else {

      setNewCertificatesCount(0);

      return;

    }



    const storedVisit = localStorage.getItem(lastVisitKey);

    const lastVisit = storedVisit ? parseInt(storedVisit, 10) : 0;



    return onSnapshot(

      q,

      (snap) => {

        let count = 0;

        snap.forEach((doc) => {

          const data = doc.data();

          

          if (activeRole === 'INTERN') {

            const issuedAt = data.issuedAt as any;

            

            let timestamp = 0;

            if (issuedAt?.toDate) {

              timestamp = issuedAt.toDate().getTime();

            }

            

            if (timestamp > lastVisit) {

              count++;

            }

          } else {

            const requestedAt = data.requestedAt as any;

            

            let timestamp = 0;

            if (requestedAt?.toDate) {

              timestamp = requestedAt.toDate().getTime();

            }

            

            if (timestamp > lastVisit) {

              count++;

            }

          }

        });

        setNewCertificatesCount(count);

      },

      () => {

        setNewCertificatesCount(0);

      }

    );

  }, [user, activeRole, lastCertificatesPageVisit]);



  useEffect(() => {

    if (!user || activeRole !== 'INTERN') {

      setNewAllowanceCount(0);

      return;

    }



    const allowanceRef = collection(firestoreDb, 'allowanceClaims');

    const q = query(allowanceRef, where('internId', '==', user.id));



    return onSnapshot(

      q,

      (snap) => {

        let count = 0;

        snap.forEach((doc) => {

          const data = doc.data();

          const status = data.status;

          const approvedAt = data.approvedAt as any;

          

          let timestamp = 0;

          if (approvedAt?.toDate) {

            timestamp = approvedAt.toDate().getTime();

          }

          

          if ((status === 'APPROVED' || status === 'PAID') && timestamp > lastAllowancePageVisit) {

            count++;

          }

        });

        setNewAllowanceCount(count);

      },

      () => {

        setNewAllowanceCount(0);

      }

    );

  }, [user, activeRole, lastAllowancePageVisit]);



  useEffect(() => {

    if (!user || activeRole !== 'SUPERVISOR') {

      setNewAppointmentRequestCount(0);

      return;

    }



    const evalRef = collection(firestoreDb, 'universityEvaluations');

    const q = query(evalRef, where('supervisorId', '==', user.id));



    return onSnapshot(

      q,

      (snap) => {

        let count = 0;

        snap.forEach((doc) => {

          const data = doc.data();

          const appointmentRequest = data.appointmentRequest as any;



          if (!appointmentRequest) return;

          if (appointmentRequest.status !== 'REQUESTED') return;



          const updatedAt = appointmentRequest.updatedAt as any;

          if (updatedAt?.toDate) {

            const timestamp = updatedAt.toDate().getTime();

            if (timestamp > lastAppointmentRequestPageVisit) {

              count++;

            }

          }

        });

        setNewAppointmentRequestCount(count);

      },

      () => {

        setNewAppointmentRequestCount(0);

      }

    );

  }, [user, activeRole, lastAppointmentRequestPageVisit]);



  useEffect(() => {

    if (!user || activeRole !== 'HR_ADMIN') {

      setNewSystemSettingsCount(0);

      return;

    }



    const usersRef = collection(firestoreDb, 'users');

    const q = query(

      usersRef,

      where('lifecycleStatus', 'in', ['WITHDRAWAL_REQUESTED', 'OFFBOARDING_REQUESTED'])

    );



    return onSnapshot(

      q,

      (snap) => {

        let count = 0;

        snap.forEach((doc) => {

          const data = doc.data();

          const updatedAt = data.updatedAt as any;



          if (updatedAt?.toDate) {

            const timestamp = updatedAt.toDate().getTime();

            if (timestamp > lastSystemSettingsPageVisit) {

              count++;

            }

          }

        });

        setNewSystemSettingsCount(count);

      },

      () => {

        setNewSystemSettingsCount(0);

      }

    );

  }, [user, activeRole, lastSystemSettingsPageVisit]);



  useEffect(() => {

    if (!user || (activeRole !== 'SUPERVISOR' && activeRole !== 'HR_ADMIN')) {

      setNewInternManagementCount(0);

      return;

    }



    const usersRef = collection(firestoreDb, 'users');



    const isSupervisor = activeRole === 'SUPERVISOR';

    const lastPageAck = isSupervisor ? lastManageInternsPageVisit : lastManageInternsPageVisitAdmin;

    const q = isSupervisor

      ? query(usersRef, where('supervisorId', '==', user.id))

      : query(usersRef, where('roles', 'array-contains', 'INTERN'));



    let internUnsubs: Array<() => void> = [];



    const clearInternListeners = () => {

      internUnsubs.forEach((u) => u());

      internUnsubs = [];

    };



    const unsubUsers = onSnapshot(

      q,

      (snap) => {

        clearInternListeners();



        const flagsByIntern = new Map<string, { feedback: boolean; handoffAssigned: boolean; handoffPersonal: boolean }>();



        const setFlag = (internId: string, key: 'feedback' | 'handoffAssigned' | 'handoffPersonal', value: boolean) => {

          const prev = flagsByIntern.get(internId) ?? { feedback: false, handoffAssigned: false, handoffPersonal: false };

          flagsByIntern.set(internId, { ...prev, [key]: value });

        };



        const recomputeCount = () => {

          let count = 0;

          flagsByIntern.forEach((f) => {

            if (f.feedback || f.handoffAssigned || f.handoffPersonal) count += 1;

          });

          setNewInternManagementCount(count);

        };



        const internIds = snap.docs

          .filter((d) => (d.data() as any)?.hasLoggedIn !== false)

          .map((d) => d.id)

          .filter(Boolean);

        internIds.forEach((internId) => {

          flagsByIntern.set(internId, { feedback: false, handoffAssigned: false, handoffPersonal: false });



          const lastViewedKey = isSupervisor ? `lastInternViewed_${internId}` : `lastAdminInternViewed_${internId}`;

          const storedLastViewed = localStorage.getItem(lastViewedKey);

          const lastViewedTimestamp = storedLastViewed ? parseInt(storedLastViewed, 10) : 0;

          const lastAck = Math.max(lastPageAck, Number.isFinite(lastViewedTimestamp) ? lastViewedTimestamp : 0);



          let unsubFeedback: (() => void) | null = null;

          if (isSupervisor) {

            const feedbackRef = collection(firestoreDb, 'users', internId, 'feedbackMilestones');

            unsubFeedback = onSnapshot(

              feedbackRef,

              (fsnap) => {

                let hasNew = false;

                fsnap.forEach((d) => {

                  const data = d.data() as any;



                  const status = String(data?.status ?? '');

                  if (status !== 'submitted') return;

                  if (data?.supervisorReviewedAt) return;



                  let ts = 0;

                  const submittedAt = data?.submittedAt as any;

                  const updatedAt = data?.updatedAt as any;



                  if (submittedAt?.toDate) {

                    ts = submittedAt.toDate().getTime();

                  } else if (updatedAt?.toDate) {

                    ts = updatedAt.toDate().getTime();

                  } else {

                    const submissionDate = data?.submissionDate as string | undefined;

                    if (!submissionDate) {

                      hasNew = true;

                      return;

                    }

                    const parsed = new Date(`${submissionDate}T23:59:59.999`).getTime();

                    if (!Number.isFinite(parsed)) {

                      hasNew = true;

                      return;

                    }

                    ts = parsed;

                  }



                  if (ts > lastAck) hasNew = true;

                });



                setFlag(internId, 'feedback', hasNew);

                recomputeCount();

              },

              () => {

                setFlag(internId, 'feedback', false);

                recomputeCount();

              },

            );

          }



          const computeHandoffHasNew = (psnap: any) => {

            let hasNew = false;

            psnap.forEach((d: any) => {

              const data = d.data() as any;

              const status = String(data?.handoffLatest?.status ?? '');

              if (status !== 'SUBMITTED') return;



              const submittedAt = data?.handoffLatest?.submittedAt as any;

              if (!submittedAt?.toDate) {

                hasNew = true;

                return;

              }

              const ts = submittedAt.toDate().getTime();

              if (!Number.isFinite(ts)) {

                hasNew = true;

                return;

              }

              if (ts > lastAck) hasNew = true;

            });

            return hasNew;

          };



          const assignedRef = collection(firestoreDb, 'users', internId, 'assignmentProjects');

          const unsubAssigned = onSnapshot(

            assignedRef,

            (psnap) => {

              const hasNew = computeHandoffHasNew(psnap);

              setFlag(internId, 'handoffAssigned', hasNew);

              recomputeCount();

            },

            () => {

              setFlag(internId, 'handoffAssigned', false);

              recomputeCount();

            },

          );



          const personalRef = collection(firestoreDb, 'users', internId, 'personalProjects');

          const unsubPersonal = onSnapshot(

            personalRef,

            (psnap) => {

              const hasNew = computeHandoffHasNew(psnap);

              setFlag(internId, 'handoffPersonal', hasNew);

              recomputeCount();

            },

            () => {

              setFlag(internId, 'handoffPersonal', false);

              recomputeCount();

            },

          );



          if (unsubFeedback) internUnsubs.push(unsubFeedback);

          internUnsubs.push(unsubAssigned, unsubPersonal);

        });



        recomputeCount();

      },

      () => {

        clearInternListeners();

        setNewInternManagementCount(0);

      },

    );



    return () => {

      clearInternListeners();

      unsubUsers();

    };

  }, [user, activeRole, lastManageInternsPageVisit, lastManageInternsPageVisitAdmin]);



  const activeId = useMemo<PageId>(() => {

    if (pageId && isPageId(pageId)) return pageId;

    return 'dashboard';

  }, [pageId]);



  useEffect(() => {

    if (activeId === 'leave' && activeRole === 'INTERN') {

      const now = Date.now();

      setLastLeavePageVisit(now);

      localStorage.setItem('lastLeavePageVisit', String(now));

    }

    if (activeId === 'leave' && activeRole === 'SUPERVISOR') {

      const now = Date.now();

      setLastLeavePageVisit(now);

      localStorage.setItem('lastLeavePageVisit_supervisor', String(now));

    }

    if (activeId === 'leave' && activeRole === 'HR_ADMIN') {

      const now = Date.now();

      setLastLeavePageVisit(now);

      localStorage.setItem('lastLeavePageVisit_admin', String(now));

    }

    if (activeId === 'assignment' && activeRole === 'INTERN') {

      const now = Date.now();

      setLastAssignmentPageVisit(now);

      localStorage.setItem('lastAssignmentPageVisit', String(now));

    }

    if (activeId === 'feedback' && activeRole === 'INTERN') {

      const now = Date.now();

      setLastFeedbackPageVisit(now);

      localStorage.setItem('lastFeedbackPageVisit', String(now));

    }

    if (activeId === 'evaluation' && activeRole === 'INTERN') {

      const now = Date.now();

      setLastEvaluationPageVisit(now);

      localStorage.setItem('lastEvaluationPageVisit', String(now));

    }

    if ((activeId === 'evaluation' || activeId === 'university-evaluation') && activeRole === 'SUPERVISOR') {

      const now = Date.now();

      setLastEvaluationPageVisit(now);

      localStorage.setItem('lastEvaluationPageVisit_supervisor', String(now));

    }

    if ((activeId === 'evaluation' || activeId === 'university-evaluation') && activeRole === 'HR_ADMIN') {

      const now = Date.now();

      setLastEvaluationPageVisit(now);

      localStorage.setItem('lastEvaluationPageVisit_admin', String(now));

    }

    if (activeId === 'certificates' && activeRole === 'INTERN') {

      const now = Date.now();

      setLastCertificatesPageVisit(now);

      localStorage.setItem('lastCertificatesPageVisit', String(now));

    }

    if (activeId === 'certificates' && activeRole === 'SUPERVISOR') {

      const now = Date.now();

      setLastCertificatesPageVisit(now);

      localStorage.setItem('lastCertificatesPageVisit_supervisor', String(now));

    }

    if (activeId === 'certificates' && activeRole === 'HR_ADMIN') {

      const now = Date.now();

      setLastCertificatesPageVisit(now);

      localStorage.setItem('lastCertificatesPageVisit_admin', String(now));

    }

    if (activeId === 'allowance' && activeRole === 'INTERN') {

      const now = Date.now();

      setLastAllowancePageVisit(now);

      localStorage.setItem('lastAllowancePageVisit', String(now));

    }

    if (activeId === 'appointment-requests' && activeRole === 'SUPERVISOR') {

      const now = Date.now();

      setLastAppointmentRequestPageVisit(now);

      localStorage.setItem('lastAppointmentRequestPageVisit', String(now));

    }

    if (activeId === 'system-settings' && activeRole === 'HR_ADMIN') {

      const now = Date.now();

      setLastSystemSettingsPageVisit(now);

      localStorage.setItem('lastSystemSettingsPageVisit', String(now));

    }

    if (activeId === 'manage-interns' && activeRole === 'SUPERVISOR') {

      const now = Date.now();

      setLastManageInternsPageVisit(now);

      localStorage.setItem('lastManageInternsPageVisit', String(now));

    }

  }, [activeId, activeRole]);



  const handleLogout = () => {

    void signOut(firebaseAuth).finally(() => {

      setUser(null);

      navigate('/login', { replace: true });

    });

  };



  const handleRoleSwitch = (newRole: UserRole) => {

    setActiveRole(newRole);

    navigate(pageIdToPath(newRole, 'dashboard'), { replace: true });

  };



  if (!user) return <Navigate to="/login" replace />;



  return (

    <div className="h-screen bg-slate-50 flex overflow-hidden text-slate-900">

      <Toaster position="top-right" richColors closeButton />

      <Sidebar

        activeId={activeId}

        activeRole={activeRole}

        onNavigate={(id) => {

          if (id === 'manage-interns' && activeRole === 'SUPERVISOR') {

            const now = Date.now();

            setLastManageInternsPageVisit(now);

            localStorage.setItem('lastManageInternsPageVisit', String(now));

          }

          if (id === 'manage-interns' && activeRole === 'HR_ADMIN') {

            const now = Date.now();

            setLastManageInternsPageVisitAdmin(now);

            localStorage.setItem('lastManageInternsPageVisit_admin', String(now));

          }

          navigate(pageIdToPath(activeRole, id));

          if (window.innerWidth < 1024) setIsSidebarOpen(false);

        }}

        onRoleSwitch={user.roles.length > 1 ? handleRoleSwitch : undefined}

        isOpen={isSidebarOpen}

        onClose={() => setIsSidebarOpen(false)}

        user={user}

        onLogout={handleLogout}

        lang={lang}

        leaveNotificationCount={approvedLeaveCount}

        assignmentNotificationCount={newAssignmentCount}

        feedbackNotificationCount={newFeedbackCount}

        evaluationNotificationCount={newEvaluationCount}

        certificatesNotificationCount={newCertificatesCount}

        allowanceNotificationCount={newAllowanceCount}

        appointmentRequestNotificationCount={newAppointmentRequestCount}

        systemSettingsNotificationCount={newSystemSettingsCount}

        internManagementNotificationCount={newInternManagementCount}

      />



      <div className="flex-1 flex flex-col h-screen relative overflow-hidden transition-all duration-300 lg:ml-72">

        <Header

          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}

          lang={lang}

          onLangToggle={toggleLang}

          user={user}

        />



        <main className="flex-1 overflow-hidden">

          <Outlet />

        </main>

      </div>

    </div>

  );

}

