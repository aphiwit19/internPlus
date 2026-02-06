import React, { useMemo, useRef, useState, useEffect } from 'react';

import { 

  Layers, 

  ArrowRight, 

  Plus, 

  X, 

  Clock, 

  Calendar, 

  CheckCircle2, 

  Repeat, 

  Circle, 

  CalendarDays,

  Upload,

  Download,

  FileText,

  Trash2,

  RefreshCw,

  Play,

  Square,

  AlertCircle,

  Timer,

  Edit2,

  Zap,

  ChevronDown,

  ChevronLeft,

  ChevronRight

} from 'lucide-react';

import { Language, SubTask, TaskLog } from '@/types';



import { addDoc, collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';



import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';



import { firestoreDb, firebaseStorage } from '@/firebase';

import { useAppContext } from '@/app/AppContext';

import { useTranslation } from 'react-i18next';



interface Project {

  id: string;

  title: string;

  description: string;

  status: 'IN PROGRESS' | 'TODO';

  date: string;

  tasks: SubTask[];

  attachments?: Array<{ fileName: string; storagePath: string }>;

  handoffLatest?: {

    version?: number;

    status?: string;

    submittedAt?: unknown;

    files?: Array<{ fileName: string; storagePath: string }>;

    videos?: Array<{ type: 'upload'; title?: string; fileName: string; storagePath: string }>;

    links?: string[];

  };

}



type HandoffVideo = { type: 'upload'; title?: string; fileName: string; storagePath: string };



interface AssignmentPageProps {

  lang: Language;

}



const AssignmentPage: React.FC<AssignmentPageProps> = ({ lang: _lang }) => {

  const { user } = useAppContext();

  const { t } = useTranslation();

  const tr = (key: string, options?: any) => String(t(key, options));



  const [assignedProjects, setAssignedProjects] = useState<Project[]>([]);

  const [personalProjects, setPersonalProjects] = useState<Project[]>([]);

  const [lastVisit] = useState<number>(() => {

    const stored = localStorage.getItem('lastAssignmentPageVisit');

    return stored ? parseInt(stored, 10) : 0;

  });



  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(null);

  const [isPlanningTask, setIsPlanningTask] = useState(false);

  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const [isExtendingDeadline, setIsExtendingDeadline] = useState<string | null>(null);

  const [uploadTaskId, setUploadTaskId] = useState<string | null>(null);

  const [showShiftNotice, setShowShiftNotice] = useState(false);

  

  const [newTask, setNewTask] = useState({

    title: '',

    type: 'SINGLE' as 'SINGLE' | 'CONTINUE',

    startDate: new Date().toISOString().split('T')[0],

    startTime: '09:00',

    endDate: new Date().toISOString().split('T')[0],

    endTime: '18:00'

  });



  const [extensionDate, setExtensionDate] = useState({

    date: new Date().toISOString().split('T')[0],

    time: '18:00'

  });



  const [extensionTitle, setExtensionTitle] = useState('');



  const [newProject, setNewProject] = useState({ title: '', description: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);



  const [selectedProofFiles, setSelectedProofFiles] = useState<File[]>([]);

  const [proofLinkDraft, setProofLinkDraft] = useState('');

  const [selectedProofLinks, setSelectedProofLinks] = useState<string[]>([]);



  const [isSubmittingHandoff, setIsSubmittingHandoff] = useState(false);

  const [isHandoffOpen, setIsHandoffOpen] = useState(false);

  const [handoffLast, setHandoffLast] = useState<Project['handoffLatest'] | null>(null);

  const [handoffLinks, setHandoffLinks] = useState<string[]>([]);

  const [handoffLinkDraft, setHandoffLinkDraft] = useState('');

  const [handoffExistingFiles, setHandoffExistingFiles] = useState<Array<{ fileName: string; storagePath: string }>>([]);

  const [handoffExistingVideos, setHandoffExistingVideos] = useState<HandoffVideo[]>([]);

  const [handoffDocFiles, setHandoffDocFiles] = useState<File[]>([]);

  const [handoffVideoFiles, setHandoffVideoFiles] = useState<File[]>([]);



  const [projectsPage, setProjectsPage] = useState(1);



  const [delayRemarkDrafts, setDelayRemarkDrafts] = useState<Record<string, string>>({});



  const TASKS_PER_PAGE = 6;

  const [tasksPage, setTasksPage] = useState(1);



  const openProjectAttachment = async (a: { fileName: string; storagePath: string }) => {

    const url = await getDownloadURL(storageRef(firebaseStorage, a.storagePath));

    window.open(url, '_blank');

  };



  const openStoragePath = async (path: string) => {

    const url = await getDownloadURL(storageRef(firebaseStorage, path));

    window.open(url, '_blank');

  };



  const allProjects = useMemo(() => {

    return {

      assigned: assignedProjects,

      personal: personalProjects,

    };

  }, [assignedProjects, personalProjects]);



  const selectedProject = useMemo(() => {

    if (!selectedProjectKey) return null;

    const [kind, id] = selectedProjectKey.split(':', 2);

    if (kind === 'assigned') return allProjects.assigned.find((p) => p.id === id) ?? null;

    if (kind === 'personal') return allProjects.personal.find((p) => p.id === id) ?? null;

    return null;

  }, [allProjects.assigned, allProjects.personal, selectedProjectKey]);



  const tasksPageCount = useMemo(() => {

    const count = Math.ceil((selectedProject?.tasks?.length ?? 0) / TASKS_PER_PAGE);

    return count > 0 ? count : 1;

  }, [TASKS_PER_PAGE, selectedProject?.tasks?.length]);



  useEffect(() => {

    setTasksPage(1);

  }, [selectedProject?.id]);



  useEffect(() => {

    setTasksPage((prev) => {

      if (prev < 1) return 1;

      if (prev > tasksPageCount) return tasksPageCount;

      return prev;

    });

  }, [tasksPageCount]);



  const pagedTasks = useMemo(() => {

    const tasks = selectedProject?.tasks ?? [];

    const start = (tasksPage - 1) * TASKS_PER_PAGE;

    return tasks.slice(start, start + TASKS_PER_PAGE);

  }, [TASKS_PER_PAGE, selectedProject?.tasks, tasksPage]);



  const selectedKind = useMemo(() => {

    if (!selectedProjectKey) return null;

    const [kind] = selectedProjectKey.split(':', 1);

    return kind === 'assigned' || kind === 'personal' ? kind : null;

  }, [selectedProjectKey]);



  const isSelectedAssigned = selectedKind === 'assigned';



  useEffect(() => {

    if (!user) return;



    const assignedRef = collection(firestoreDb, 'users', user.id, 'assignmentProjects');

    const unsubAssigned = onSnapshot(assignedRef, (snap) => {

      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, 'id'>) }));

      setAssignedProjects(list);

    });



    const personalRef = collection(firestoreDb, 'users', user.id, 'personalProjects');

    const unsubPersonal = onSnapshot(personalRef, (snap) => {

      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, 'id'>) }));

      setPersonalProjects(list);

    });



    return () => {

      unsubAssigned();

      unsubPersonal();

    };

  }, [user]);



  const calculateTotalWorkTime = (logs: TaskLog[]) => {

    let totalMs = 0;

    logs.forEach(log => {

      const start = new Date(log.startTime).getTime();

      const end = log.endTime ? new Date(log.endTime).getTime() : new Date().getTime();

      totalMs += (end - start);

    });

    const hours = totalMs / (1000 * 60 * 60);

    return hours.toFixed(1);

  };



  useEffect(() => {

    setDelayRemarkDrafts({});

  }, [selectedProject?.id]);



  useEffect(() => {

    if (!uploadTaskId || !selectedProject) return;

    const task = selectedProject.tasks.find((t) => t.id === uploadTaskId);

    if (!task) return;

    setDelayRemarkDrafts((prev) => {

      if (prev[uploadTaskId] !== undefined) return prev;

      if (task.delayRemark) return { ...prev, [uploadTaskId]: task.delayRemark };

      return prev;

    });

  }, [uploadTaskId, selectedProject]);



  const resetHandoffState = () => {

    setHandoffLinks([]);

    setHandoffLinkDraft('');

    setHandoffExistingFiles([]);

    setHandoffExistingVideos([]);

    setHandoffDocFiles([]);

    setHandoffVideoFiles([]);

  };



  useEffect(() => {

    if (!isHandoffOpen) return;

    const hl = selectedProject?.handoffLatest ?? null;

    setHandoffLast(hl);

    if (hl) {

      const links = Array.isArray(hl.links)

        ? hl.links

            .map((raw: any) => (typeof raw === 'string' ? raw : String(raw?.url ?? raw?.link ?? raw?.href ?? '')))

            .filter((u: string) => u.trim())

        : [];

      setHandoffLinks(links);



      const existingFiles = Array.isArray(hl.files)

        ? hl.files

            .map((raw: any) => ({ fileName: String(raw?.fileName ?? 'Document'), storagePath: String(raw?.storagePath ?? '') }))

            .filter((f: { storagePath: string }) => Boolean(f.storagePath))

        : [];

      setHandoffExistingFiles(existingFiles);



      const existingVideos: HandoffVideo[] = Array.isArray(hl.videos)

        ? hl.videos

            .map((raw: any) => {

              if (typeof raw === 'string') return { type: 'upload', fileName: 'Video', storagePath: raw } as HandoffVideo;

              return {

                type: 'upload',

                title: typeof raw?.title === 'string' ? raw.title : undefined,

                fileName: String(raw?.fileName ?? raw?.title ?? 'Video'),

                storagePath: String(raw?.storagePath ?? ''),

              } as HandoffVideo;

            })

            .filter((v: HandoffVideo) => Boolean(v.storagePath))

        : [];

      setHandoffExistingVideos(existingVideos);

    } else {

      setHandoffLinks([]);

      setHandoffExistingFiles([]);

      setHandoffExistingVideos([]);

    }

    setHandoffDocFiles([]);

    setHandoffVideoFiles([]);

  }, [isHandoffOpen, selectedProject?.id]);



  const handleSubmitHandoff = async () => {

    if (!user || !selectedProject || !selectedKind) return;

    if (isSubmittingHandoff) return;



    setIsSubmittingHandoff(true);

    try {

      const colName = selectedKind === 'assigned' ? 'assignmentProjects' : 'personalProjects';

      const projectRef = doc(firestoreDb, 'users', user.id, colName, selectedProject.id);

      const submissionsRef = collection(firestoreDb, 'users', user.id, colName, selectedProject.id, 'handoffSubmissions');



      const lastSnap = await getDocs(query(submissionsRef, orderBy('version', 'desc'), limit(1)));

      const lastVersion = lastSnap.docs[0]?.data()?.version;

      const nextVersion = (typeof lastVersion === 'number' ? lastVersion : 0) + 1;



      const submissionDocRef = await addDoc(submissionsRef, {

        version: nextVersion,

        status: 'SUBMITTED',

        links: handoffLinks.filter((l) => l.trim()),

        files: [],

        videos: [],

        submittedAt: serverTimestamp(),

        submittedById: user.id,

        submittedByName: user.name,

      });



      const uploadedFilesNew = await Promise.all(

        handoffDocFiles.map(async (f) => {

          const name = `${Date.now()}_${f.name}`;

          const path = `users/${user.id}/${colName}/${selectedProject.id}/handoff/v${nextVersion}/files/${name}`;

          await uploadBytes(storageRef(firebaseStorage, path), f);

          return { fileName: f.name, storagePath: path };

        }),

      );



      const uploadedVideosNew: HandoffVideo[] = await Promise.all(

        handoffVideoFiles.map(async (f) => {

          const name = `${Date.now()}_${f.name}`;

          const path = `users/${user.id}/${colName}/${selectedProject.id}/handoff/v${nextVersion}/videos/${name}`;

          await uploadBytes(storageRef(firebaseStorage, path), f);

          return { type: 'upload', title: f.name, fileName: f.name, storagePath: path };

        }),

      );



      const mergedFiles = [...handoffExistingFiles, ...uploadedFilesNew];

      const mergedVideos = [...handoffExistingVideos, ...uploadedVideosNew];

      const mergedLinks = handoffLinks.filter((l) => l.trim());



      const safeVideos = mergedVideos.map((v) => {

        const base = { type: v.type, fileName: v.fileName, storagePath: v.storagePath };

        return v.title ? { ...base, title: v.title } : base;

      });



      await updateDoc(submissionDocRef, {

        files: mergedFiles,

        videos: safeVideos,

        links: mergedLinks,

      });



      await updateDoc(projectRef, {

        handoffLatest: {

          version: nextVersion,

          status: 'SUBMITTED',

          submittedAt: serverTimestamp(),

          files: mergedFiles,

          videos: safeVideos,

          links: mergedLinks,

        },

        updatedAt: serverTimestamp(),

      });



      setIsHandoffOpen(false);

      resetHandoffState();

    } finally {

      setIsSubmittingHandoff(false);

    }

  };



  const updateSelectedProjectTasks = async (nextTasks: SubTask[]) => {

    if (!user || !selectedProject || !selectedKind) return;

    const colName = selectedKind === 'assigned' ? 'assignmentProjects' : 'personalProjects';

    await updateDoc(doc(firestoreDb, 'users', user.id, colName, selectedProject.id), {

      tasks: nextTasks,

      updatedAt: serverTimestamp(),

    });

  };



  const handleSubmitWithProof = async (taskId: string) => {

    console.log('🚀 handleSubmitWithProof called', { taskId, user: !!user, selectedProject: !!selectedProject, selectedKind });

    if (!user || !selectedProject || !selectedKind) {

      console.error('❌ Missing required data:', { user: !!user, selectedProject: !!selectedProject, selectedKind });

      return;

    }

    const now = new Date();

    const colName = selectedKind === 'assigned' ? 'assignmentProjects' : 'personalProjects';



    const MAX_PROOF_BYTES = 20 * 1024 * 1024;

    const tooLarge = selectedProofFiles.find((f) => f.size > MAX_PROOF_BYTES) ?? null;

    if (tooLarge) {

      window.alert(

        tr('intern_assignment.errors.file_too_large', { name: tooLarge.name, mb: 20 } as any),
      );

      return;

    }



    const targetTask = selectedProject.tasks.find((t) => t.id === taskId);

    if (targetTask) {

      const overdueNow = !targetTask.actualEnd && now > new Date(targetTask.plannedEnd);

      const remarkFromDraft = (delayRemarkDrafts[taskId] ?? targetTask.delayRemark ?? '').trim();

      if (overdueNow && !remarkFromDraft) {

        window.alert(tr('intern_assignment.errors.remark_required'));

        return;

      }

    }



    const uploaded = [] as Array<{ fileName: string; storagePath: string }>;

    for (const f of selectedProofFiles) {

      const safeName = f.name;

      const path = `users/${user.id}/${colName}/${selectedProject.id}/${taskId}/${Date.now()}_${safeName}`;

      console.log('📤 Uploading file to Storage:', path);

      try {

        await uploadBytes(storageRef(firebaseStorage, path), f);

        uploaded.push({ fileName: safeName, storagePath: path });

        console.log('✅ File uploaded successfully:', safeName);

      } catch (error) {

        console.error('❌ Storage upload error:', error);

        throw error;

      }

    }



    const linkAttachments = selectedProofLinks

      .map((u) => u.trim())

      .filter((u) => u.length > 0)

      .filter((u) => u.startsWith('http://') || u.startsWith('https://'));



    const nextTasks = selectedProject.tasks.map((t) => {

      if (t.id !== taskId) return t;

      const pEnd = new Date(t.plannedEnd);

      let finalStatus: 'DONE' | 'DELAYED' = 'DONE';

      if (now > pEnd) finalStatus = 'DELAYED';



      const mergedAttachments = [...(t.attachments ?? []), ...uploaded, ...linkAttachments];



      const remarkFromDraft = (delayRemarkDrafts[taskId] ?? t.delayRemark ?? '').trim();



      return {

        ...t,

        status: finalStatus,

        reviewStatus: 'SUBMITTED' as const,

        actualEnd: now.toISOString(),

        isSessionActive: false,

        attachments: mergedAttachments,

        delayRemark: finalStatus === 'DELAYED' ? remarkFromDraft : (t.delayRemark ?? ''),

        timeLogs: t.isSessionActive

          ? t.timeLogs.map((l, i) => (i === t.timeLogs.length - 1 ? { ...l, endTime: now.toISOString() } : l))

          : t.timeLogs,

      };

    });



    console.log('💾 Updating Firestore document:', `users/${user.id}/${colName}/${selectedProject.id}`);

    try {

      await updateDoc(doc(firestoreDb, 'users', user.id, colName, selectedProject.id), {

        tasks: nextTasks,

        updatedAt: serverTimestamp(),

      });

      console.log('✅ Firestore document updated successfully');

    } catch (error) {

      console.error('❌ Firestore update error:', error);

      throw error;

    }



    setSelectedProofFiles([]);

    setSelectedProofLinks([]);

    setProofLinkDraft('');

    if (fileInputRef.current) fileInputRef.current.value = '';

    setUploadTaskId(null);

  };



  const handleToggleSession = (taskId: string) => {

    if (!selectedProject) return;



    const nextTasks = selectedProject.tasks.map((t) => {

      if (t.id !== taskId) return t;

      if (t.isSessionActive) {

        const lastLog = t.timeLogs[t.timeLogs.length - 1];

        return {

          ...t,

          isSessionActive: false,

          timeLogs: t.timeLogs.map((l) => (l.id === lastLog.id ? { ...l, endTime: new Date().toISOString() } : l)),

        };

      }



      const newLog: TaskLog = { id: Date.now().toString(), startTime: new Date().toISOString() };

      return {

        ...t,

        isSessionActive: true,

        timeLogs: [...t.timeLogs, newLog],

      };

    });



    void updateSelectedProjectTasks(nextTasks);

  };



  const handleFinishTask = (taskId: string) => {

    if (!selectedProject) return;

    const now = new Date();



    const nextTasks = selectedProject.tasks.map((t) => {

      if (t.id !== taskId) return t;

      const pEnd = new Date(t.plannedEnd);

      let finalStatus: 'DONE' | 'DELAYED' = 'DONE';

      if (now > pEnd) finalStatus = 'DELAYED';



      return {

        ...t,

        status: finalStatus,

        reviewStatus: 'SUBMITTED' as const,

        actualEnd: now.toISOString(),

        isSessionActive: false,

        timeLogs: t.isSessionActive

          ? t.timeLogs.map((l, i) => (i === t.timeLogs.length - 1 ? { ...l, endTime: now.toISOString() } : l))

          : t.timeLogs,

      };

    });



    void updateSelectedProjectTasks(nextTasks);

    setUploadTaskId(null);

  };



  const handleExtendDeadline = () => {

    if (!selectedProject || !isExtendingDeadline) return;

    

    const newDeadlineDate = new Date(`${extensionDate.date}T${extensionDate.time}`);

    const newDeadlineISO = newDeadlineDate.toISOString();

    let hasShiftedAnything = false;



    const updatedTasks = [...selectedProject.tasks];

      const taskIndex = updatedTasks.findIndex(t => t.id === isExtendingDeadline);

      if (taskIndex === -1) return;



      // Update the targeted task

      updatedTasks[taskIndex] = {

        ...updatedTasks[taskIndex],

        title: extensionTitle.trim() || updatedTasks[taskIndex].title,

        plannedEnd: newDeadlineISO,

      };



      // Propagation logic: shift subsequent tasks if they conflict

      let currentReferenceEnd = newDeadlineDate;



      for (let i = taskIndex + 1; i < updatedTasks.length; i++) {

        const subTask = updatedTasks[i];

        const subPlannedStart = new Date(subTask.plannedStart);

        

        // If current task's end is after the next task's start, we must shift the next task

        if (currentReferenceEnd > subPlannedStart) {

          hasShiftedAnything = true;

          const originalDuration = new Date(subTask.plannedEnd).getTime() - subPlannedStart.getTime();

          

          // Next task starts immediately after the previous one ends

          const newStart = new Date(currentReferenceEnd.getTime());

          const newEnd = new Date(newStart.getTime() + originalDuration);

          

          updatedTasks[i] = {

            ...subTask,

            plannedStart: newStart.toISOString(),

            plannedEnd: newEnd.toISOString()

          };

          

          // Update reference for the next iteration in the loop

          currentReferenceEnd = newEnd;

        }

      }



      if (hasShiftedAnything) {

        setShowShiftNotice(true);

        setTimeout(() => setShowShiftNotice(false), 4000);

      }



      void updateSelectedProjectTasks(updatedTasks);

    

    setIsExtendingDeadline(null);

    setExtensionTitle('');

  };



  const handleAddTask = () => {

    if (!selectedProject || !newTask.title) return;

    const pStart = new Date(`${newTask.startDate}T${newTask.startTime}`).toISOString();

    const pEnd = new Date(`${newTask.endDate}T${newTask.endTime}`).toISOString();

    

    const task: SubTask = {

      id: Date.now().toString(),

      title: newTask.title,

      type: newTask.type,

      status: 'IN_PROGRESS',

      plannedStart: pStart,

      plannedEnd: pEnd,

      timeLogs: [],

      attachments: [],

      isSessionActive: false

    };



    void updateSelectedProjectTasks([...(selectedProject.tasks ?? []), task]);

    setIsPlanningTask(false);

    setNewTask({ title: '', type: 'SINGLE', startDate: new Date().toISOString().split('T')[0], startTime: '09:00', endDate: new Date().toISOString().split('T')[0], endTime: '18:00' });

  };



  const handleCreatePersonalProject = async () => {

    if (!user) return;

    const title = newProject.title.trim();

    if (!title) return;



    const nowDate = new Date().toISOString().split('T')[0];

    await addDoc(collection(firestoreDb, 'users', user.id, 'personalProjects'), {

      title,

      description: newProject.description.trim(),

      status: 'TODO',

      date: nowDate,

      tasks: [],

      createdAt: serverTimestamp(),

      updatedAt: serverTimestamp(),

    } satisfies Omit<Project, 'id'> & { createdAt?: unknown; updatedAt?: unknown });



    setIsCreatingProject(false);

    setNewProject({ title: '', description: '' });

  };



  const MAX_ASSIGNMENT_GRID_ITEMS = 9;

  const MAX_PROJECT_CARDS = Math.max(0, MAX_ASSIGNMENT_GRID_ITEMS - 1);



  const pagedProjects = useMemo(() => {

    const allProjects = [...assignedProjects.map((p) => ({ kind: 'assigned' as const, p })), ...personalProjects.map((p) => ({ kind: 'personal' as const, p }))];

    

    return allProjects.sort((a, b) => {

      const getTimestamp = (item: typeof allProjects[0]) => {

        const updatedAtStr = (item.p as any).updatedAt;

        const createdAtStr = (item.p as any).createdAt;

        

        if (updatedAtStr?.toDate) {

          return updatedAtStr.toDate().getTime();

        } else if (createdAtStr?.toDate) {

          return createdAtStr.toDate().getTime();

        }

        return 0;

      };

      

      return getTimestamp(b) - getTimestamp(a);

    });

  }, [assignedProjects, personalProjects]);



  const isProjectNew = (project: Project) => {

    const createdAtStr = (project as any).createdAt;

    const updatedAtStr = (project as any).updatedAt;

    

    let timestamp = 0;

    if (updatedAtStr?.toDate) {

      timestamp = updatedAtStr.toDate().getTime();

    } else if (createdAtStr?.toDate) {

      timestamp = createdAtStr.toDate().getTime();

    }

    

    return timestamp > lastVisit;

  };



  const projectsPageCount = useMemo(() => {

    const count = Math.ceil(pagedProjects.length / MAX_PROJECT_CARDS);

    return count > 0 ? count : 1;

  }, [MAX_PROJECT_CARDS, pagedProjects.length]);



  useEffect(() => {

    setProjectsPage((prev) => {

      if (prev < 1) return 1;

      if (prev > projectsPageCount) return projectsPageCount;

      return prev;

    });

  }, [projectsPageCount]);



  const displayedProjectCards = useMemo(() => {

    const start = (projectsPage - 1) * MAX_PROJECT_CARDS;

    return pagedProjects.slice(start, start + MAX_PROJECT_CARDS);

  }, [MAX_PROJECT_CARDS, pagedProjects, projectsPage]);



  return (

    <div className="h-full w-full flex flex-col bg-[#F8FAFC] p-4 md:p-8 lg:p-12 overflow-hidden relative">

      

      {/* Shift Timeline Notification */}

      {showShiftNotice && (

        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] bg-[#111827] text-white px-8 py-4 rounded-[1.5rem] shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-12 duration-500">

           <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">

             <Zap size={20} fill="currentColor" />

           </div>

           <p className="text-[13px] font-black uppercase tracking-widest leading-none">{tr('intern_assignment.shift_message')}</p>

        </div>

      )}



      <div className="max-w-[1600px] mx-auto w-full overflow-y-auto scrollbar-hide pb-20">

        <div className="mb-12">

          <h1 className="text-3xl font-black text-[#0F172A] tracking-tight mb-2">{tr('intern_assignment.title')}</h1>

          <p className="text-slate-400 text-sm font-medium">{tr('intern_assignment.subtitle')}</p>

        </div>



        <div className="space-y-10">

          <section>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

              {displayedProjectCards.map(({ kind, p: project }) => {

                const isNew = isProjectNew(project);

                return (

                <div

                  key={`${kind}:${project.id}`}

                  onClick={() => setSelectedProjectKey(`${kind}:${project.id}`)}

                  className={`bg-white rounded-[3rem] p-10 border shadow-sm hover:shadow-xl transition-all cursor-pointer group relative ${

                    isNew ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-100 hover:border-blue-100'

                  }`}

                >

                  {isNew && (

                    <div className="absolute -top-3 -right-3 z-10">

                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg animate-pulse">

                        <span className="w-1.5 h-1.5 bg-white rounded-full"></span>

                        {tr('intern_assignment.badges.new')}

                      </span>

                    </div>

                  )}

                  <div className="flex justify-between items-start mb-8">

                    <div className="flex items-center gap-3">

                      <span

                        className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${

                          project.status === 'IN PROGRESS'

                            ? 'bg-amber-50 text-amber-600 border-amber-100'

                            : 'bg-blue-50 text-blue-600 border-blue-100'

                        }`}

                      >

                        {project.status}

                      </span>

                      <span className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border bg-slate-50 text-slate-600 border-slate-100">

                        {kind === 'assigned' ? tr('intern_assignment.badges.assigned') : tr('intern_assignment.badges.personal')}

                      </span>

                    </div>

                    <Layers className="text-slate-100 group-hover:text-blue-500 transition-colors" size={24} />

                  </div>

                  <h3 className="text-xl font-black text-slate-900 mb-4 tracking-tight leading-tight">{project.title}</h3>

                  <p className="text-sm text-slate-400 font-medium leading-relaxed mb-12 line-clamp-2">{project.description}</p>

                  <div className="flex items-center justify-between pt-2">

                    <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{project.date}</span>

                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">

                      <ArrowRight size={18} />

                    </div>

                  </div>

                </div>

              );

              })}



              <button

                onClick={() => setIsCreatingProject(true)}

                className="border-4 border-dashed border-slate-100 rounded-[2.5rem] p-10 flex flex-col items-center justify-center gap-4 text-slate-300 hover:bg-white hover:border-blue-200 hover:text-blue-500 transition-all group min-h-[320px]"

              >

                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">

                  <Plus size={32} />

                </div>

                <span className="text-xs font-black uppercase tracking-widest">{tr('intern_assignment.actions.create_new_project')}</span>

              </button>

            </div>



            {projectsPageCount > 1 && (

              <div className="pt-10 flex justify-center">

                <div className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2">

                  <button

                    type="button"

                    onClick={() => setProjectsPage((p) => Math.max(1, p - 1))}

                    disabled={projectsPage <= 1}

                    className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"

                  >

                    <ChevronLeft size={18} />

                  </button>



                  {Array.from({ length: projectsPageCount }, (_, i) => i + 1).map((p) => (

                    <button

                      key={p}

                      type="button"

                      onClick={() => setProjectsPage(p)}

                      className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${

                        p === projectsPage

                          ? 'bg-slate-900 text-white border-slate-900'

                          : 'bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-200'

                      }`}

                    >

                      {p}

                    </button>

                  ))}



                  <button

                    type="button"

                    onClick={() => setProjectsPage((p) => Math.min(projectsPageCount, p + 1))}

                    disabled={projectsPage >= projectsPageCount}

                    className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"

                  >

                    <ChevronRight size={18} />

                  </button>

                </div>

              </div>

            )}

          </section>

        </div>

      </div>



      {/* --- PROJECT DETAIL MODAL --- */}

      {selectedProject && (

        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">

          <div className="bg-white w-full max-w-6xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)]">

            

            <div className="p-8 md:p-10 border-b border-slate-50 flex items-center justify-between bg-white relative z-10">

              <div className="flex items-center gap-6">

                <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.75rem] flex items-center justify-center shadow-xl shadow-blue-500/20">

                  <Layers size={32} />

                </div>

                <div>

                  <div className="flex items-center gap-3 mb-2">

                    <span className="text-[9px] font-black text-amber-50 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">{selectedProject.status}</span>

                  </div>

                  <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{selectedProject.title}</h2>

                </div>

              </div>

              <button onClick={() => setSelectedProjectKey(null)} className="w-12 h-12 flex items-center justify-center text-slate-300 hover:text-slate-900 rounded-full hover:bg-slate-50 transition-all"><X size={32} /></button>

            </div>



            <div className="flex-1 min-h-0 overflow-y-auto p-10 scrollbar-hide space-y-12 bg-white">

              <section>

                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">{tr('intern_assignment.sections.project_brief')}</h4>

                <p className="text-base text-slate-600 font-medium leading-relaxed max-w-3xl">{selectedProject.description}</p>



                {isSelectedAssigned && Array.isArray(selectedProject.attachments) && selectedProject.attachments.length > 0 && (

                  <div className="mt-8">

                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3">{tr('intern_assignment.sections.project_attachments')}</div>

                    <div className="flex flex-wrap gap-3">

                      {selectedProject.attachments.map((a, idx) => (

                        <button

                          key={`${a.storagePath}-${idx}`}

                          type="button"

                          onClick={() => void openProjectAttachment(a)}

                          className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 hover:bg-blue-50/20 transition-all"

                        >

                          <div className="w-10 h-10 bg-slate-50 text-blue-600 rounded-xl flex items-center justify-center border border-slate-100">

                            <FileText size={18} />

                          </div>

                          <div className="text-left">

                            <div className="text-[12px] font-black text-slate-900 max-w-[420px] truncate">{a.fileName}</div>

                            <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{tr('intern_assignment.common.click_to_open')}</div>

                          </div>

                          <div className="w-10 h-10 bg-[#111827] text-white rounded-xl flex items-center justify-center ml-2">

                            <Download size={18} />

                          </div>

                        </button>

                      ))}

                    </div>

                  </div>

                )}



              </section>



              <section>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">

                  <div>

                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">{tr('intern_assignment.sections.task_management')}</h4>

                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{tr('intern_assignment.sections.task_timeline')}</h3>

                  </div>

                  <button

                    onClick={() => setIsPlanningTask(true)}

                    className="flex items-center gap-3 px-8 py-3.5 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all"

                  >

                    <Plus size={18} strokeWidth={3} /> {tr('intern_assignment.actions.plan_new_task')}

                  </button>

                </div>



                <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">

                  <table className="w-full">

                    <thead>

                      <tr className="text-left bg-slate-50/40">

                        <th className="py-6 px-10 text-[10px] font-black text-slate-300 uppercase tracking-widest">{tr('intern_assignment.table.task_details')}</th>

                        <th className="py-6 px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">{tr('intern_assignment.table.plan')}</th>

                        <th className="py-6 px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">{tr('intern_assignment.table.time_tracking')}</th>

                        <th className="py-6 px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">{tr('intern_assignment.table.status')}</th>

                        <th className="py-6 px-10 text-[10px] font-black text-slate-300 uppercase tracking-widest text-right">{tr('intern_assignment.table.action')}</th>

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-slate-50">

                      {pagedTasks.map((task) => {

                        const totalHours = calculateTotalWorkTime(task.timeLogs);

                        const isOverdue = !task.actualEnd && new Date() > new Date(task.plannedEnd);

                        const isDone = task.status === 'DONE' || task.status === 'DELAYED';



                        return (

                          <tr key={task.id} className="group hover:bg-blue-50/10 transition-colors">

                            <td className="py-8 px-10">

                              <div className="flex items-center gap-5">

                                <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center ${isDone ? 'border-blue-50 bg-blue-50 text-blue-600' : 'border-amber-50 bg-amber-50 text-amber-500'}`}>

                                  {task.type === 'CONTINUE' ? <Repeat size={18} /> : <Circle size={18} strokeWidth={3} />}

                                </div>

                                <div>

                                  <h5 className="text-sm font-black text-slate-900 leading-none mb-1">{task.title}</h5>

                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{task.type}</p>

                                </div>

                              </div>

                            </td>

                            <td className="py-8 px-4">

                              <div className="flex flex-col gap-1.5">

                                <div className="flex items-center gap-2 text-slate-500 font-bold text-[12px]">

                                  <CalendarDays size={14} className="text-slate-300" />

                                  <span>{new Date(task.plannedEnd).toLocaleDateString()}</span>

                                </div>

                                <div className="flex items-center gap-2 text-slate-300 font-bold text-[10px] uppercase">

                                  <Clock size={12} />

                                  <span>{new Date(task.plannedEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>

                                </div>

                              </div>

                            </td>

                            <td className="py-8 px-4">

                              <div className="flex items-center gap-3">

                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${task.isSessionActive ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-50 text-slate-400'}`}>

                                  <Timer size={18} />

                                </div>

                                <div className="flex flex-col">

                                  <span className="text-[12px] font-black text-slate-900">{totalHours}H</span>

                                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{tr('intern_assignment.labels.logged_time')}</span>

                                </div>

                              </div>

                            </td>

                            <td className="py-8 px-4">

                              {isDone ? (

                                <div className="flex flex-col gap-1">

                                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg w-fit ${

                                    new Date(task.actualEnd!) <= new Date(task.plannedEnd) ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'

                                  }`}>

                                    {new Date(task.actualEnd!) <= new Date(task.plannedEnd) ? tr('intern_assignment.status.on_time') : tr('intern_assignment.status.delayed')}

                                  </span>

                                  <span className="text-[9px] font-bold text-slate-300 uppercase">{new Date(task.actualEnd!).toLocaleDateString()}</span>

                                </div>

                              ) : (

                                <span className={`text-[10px] font-black uppercase tracking-widest ${isOverdue ? 'text-rose-500' : 'text-blue-500'}`}>

                                  {isOverdue ? tr('intern_assignment.status.delayed') : tr('intern_assignment.status.in_progress')}

                                </span>

                              )}

                            </td>

                            <td className="py-8 px-10 text-right">

                              <div className="flex items-center justify-end gap-3">

                                {!isDone && (

                                  <>

                                    <button 

                                      onClick={() => handleToggleSession(task.id)}

                                      className={`p-3 rounded-xl transition-all shadow-sm ${task.isSessionActive ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}

                                      title={task.isSessionActive ? tr('intern_assignment.actions.stop_session') : tr('intern_assignment.actions.start_session')}

                                    >

                                      {task.isSessionActive ? <Square size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}

                                    </button>

                                    <button 

                                      onClick={() => {

                                        if (isOverdue) return;

                                        const end = new Date(task.plannedEnd);

                                        setExtensionDate({ date: end.toISOString().split('T')[0], time: end.toTimeString().slice(0,5) });

                                        setExtensionTitle(task.title);

                                        setIsExtendingDeadline(task.id);

                                      }}

                                      disabled={isOverdue}

                                      className={`p-3 bg-slate-50 text-slate-400 rounded-xl transition-all shadow-sm ${

                                        isOverdue

                                          ? 'opacity-40 cursor-not-allowed'

                                          : 'hover:bg-blue-50 hover:text-blue-600'

                                      }`}

                                      title={tr('intern_assignment.actions.extend_deadline')}

                                    >

                                      <Edit2 size={16} />

                                    </button>

                                    <button 

                                      onClick={() => setUploadTaskId(task.id)}

                                      className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-600 transition-all"

                                    >

                                      {tr('intern_assignment.actions.complete_finalize')}

                                    </button>

                                  </>

                                )}

                                {isDone && (

                                  <div className="flex items-center gap-2 text-emerald-500 font-black text-[11px] uppercase">

                                     <div className="w-8 h-8 rounded-full border-2 border-emerald-500 flex items-center justify-center shadow-sm"><CheckCircle2 size={18} strokeWidth={3} /></div>

                                     <span>{tr('intern_assignment.status.finished')}</span>

                                  </div>

                                )}

                              </div>

                            </td>

                          </tr>

                        );

                      })}

                    </tbody>

                  </table>



                  {tasksPageCount > 1 ? (

                    <div className="px-10 py-6 flex items-center justify-center gap-2 border-t border-slate-50 bg-white">

                      <button

                        type="button"

                        onClick={() => setTasksPage((p) => Math.max(1, p - 1))}

                        disabled={tasksPage <= 1}

                        className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-[11px] font-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"

                        aria-label={tr('intern_assignment.pagination.previous_page')}

                      >

                        {'<'}

                      </button>



                      {Array.from({ length: tasksPageCount }, (_, idx) => idx + 1).map((page) => {

                        const isActive = page === tasksPage;

                        return (

                          <button

                            key={page}

                            type="button"

                            onClick={() => setTasksPage(page)}

                            className={`px-3 py-2 rounded-xl border text-[11px] font-black transition-all ${

                              isActive

                                ? 'bg-slate-900 border-slate-900 text-white'

                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'

                            }`}

                            aria-current={isActive ? 'page' : undefined}

                          >

                            {page}

                          </button>

                        );

                      })}



                      <button

                        type="button"

                        onClick={() => setTasksPage((p) => Math.min(tasksPageCount, p + 1))}

                        disabled={tasksPage >= tasksPageCount}

                        className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-[11px] font-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"

                        aria-label={tr('intern_assignment.pagination.next_page')}

                      >

                        {'>'}

                      </button>

                    </div>

                  ) : null}

                </div>

              </section>

            </div>



            <div className="p-8 md:p-10 bg-slate-50/50 border-t border-slate-100 flex justify-end">

              <div className="flex flex-wrap items-center justify-end gap-3">

                <button

                  type="button"

                  onClick={() => setIsHandoffOpen(true)}

                  className="px-10 py-4 bg-white border border-slate-200 text-slate-700 rounded-[1.75rem] text-sm font-black uppercase hover:bg-slate-50 shadow-sm active:scale-95 transition-all"

                >

                  {tr('intern_assignment.actions.submit_handoff')}

                </button>

                <button onClick={() => setSelectedProjectKey(null)} className="px-16 py-4 bg-[#111827] text-white rounded-[1.75rem] text-sm font-black uppercase hover:bg-blue-600 shadow-2xl active:scale-95 transition-all">{tr('intern_assignment.actions.save_changes')}</button>

              </div>

            </div>

          </div>

        </div>

      )}



      {isHandoffOpen && selectedProject && (

        <div className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">

          <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden">

            <div className="p-8 border-b border-slate-100 flex items-center justify-between">

              <div>

                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{tr('intern_assignment.handoff.title')}</div>

                <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight">{selectedProject.title}</div>

              </div>

              <button

                type="button"

                onClick={() => {

                  if (isSubmittingHandoff) return;

                  setIsHandoffOpen(false);

                }}

                className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"

                disabled={isSubmittingHandoff}

              >

                <X size={18} />

              </button>

            </div>



            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto scrollbar-hide">

              <div className="space-y-4">

                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('intern_assignment.handoff.links')}</div>

                <input

                  value={handoffLinkDraft}

                  onChange={(e) => setHandoffLinkDraft(e.target.value)}

                  placeholder={tr('intern_assignment.handoff.placeholders.deliverable_url')}

                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"

                />

                <div className="flex justify-end">

                  <button

                    type="button"

                    onClick={() => {

                      const url = handoffLinkDraft.trim();

                      if (!url) return;

                      setHandoffLinks((prev) => [...prev, url]);

                      setHandoffLinkDraft('');

                    }}

                    className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"

                  >

                    {tr('intern_assignment.handoff.actions.add_link')}

                  </button>

                </div>



                {handoffLinks.length > 0 && (

                  <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-5 space-y-3">

                    {handoffLinks.map((url, idx) => (

                      <div key={`${url}-${idx}`} className="flex items-center justify-between gap-4">

                        <div className="min-w-0">

                          <div className="text-[12px] font-black text-slate-900 truncate">{tr('intern_assignment.handoff.link_label')}</div>

                          <div className="text-[10px] font-bold text-slate-400 truncate">{url}</div>

                        </div>

                        <button

                          type="button"

                          onClick={() => setHandoffLinks((prev) => prev.filter((_, i) => i !== idx))}

                          className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-slate-300 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all flex items-center justify-center shrink-0"

                        >

                          <Trash2 size={16} />

                        </button>

                      </div>

                    ))}

                  </div>

                )}

              </div>



              <div className="space-y-4">

                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('intern_assignment.handoff.documents')}</div>

                {handoffExistingFiles.length > 0 && (

                  <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-5 space-y-3">

                    {handoffExistingFiles.map((f, idx) => (

                      <div key={`${f.storagePath}-${idx}`} className="flex items-center justify-between gap-4">

                        <button

                          type="button"

                          onClick={() => void openStoragePath(f.storagePath)}

                          className="min-w-0 text-left hover:underline"

                        >

                          <div className="text-[12px] font-black text-slate-900 truncate">{f.fileName}</div>

                        </button>

                        <button

                          type="button"

                          onClick={() => setHandoffExistingFiles((prev) => prev.filter((_, i) => i !== idx))}

                          className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-slate-300 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all flex items-center justify-center shrink-0"

                        >

                          <Trash2 size={16} />

                        </button>

                      </div>

                    ))}

                  </div>

                )}

                <input

                  type="file"

                  multiple

                  onChange={(e) => {

                    const files = e.target.files ? Array.from(e.target.files) : [];

                    setHandoffDocFiles(files);

                  }}

                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700"

                />

                {handoffDocFiles.length > 0 && (

                  <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-5 space-y-3">

                    {handoffDocFiles.map((f) => (

                      <div key={`${f.name}-${f.size}-${f.lastModified}`} className="text-[12px] font-black text-slate-900 truncate">

                        {f.name}

                      </div>

                    ))}

                  </div>

                )}

              </div>



              <div className="space-y-4">

                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('intern_assignment.handoff.videos')}</div>

                {handoffExistingVideos.length > 0 && (

                  <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-5 space-y-3">

                    {handoffExistingVideos.map((v, idx) => (

                      <div key={`${v.storagePath}-${idx}`} className="flex items-center justify-between gap-4">

                        <button

                          type="button"

                          onClick={() => void openStoragePath(v.storagePath)}

                          className="min-w-0 text-left hover:underline"

                        >

                          <div className="text-[12px] font-black text-slate-900 truncate">{v.fileName}</div>

                        </button>

                        <button

                          type="button"

                          onClick={() => setHandoffExistingVideos((prev) => prev.filter((_, i) => i !== idx))}

                          className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-slate-300 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all flex items-center justify-center shrink-0"

                        >

                          <Trash2 size={16} />

                        </button>

                      </div>

                    ))}

                  </div>

                )}

                <input

                  type="file"

                  multiple

                  accept="video/*"

                  onChange={(e) => {

                    const files = e.target.files ? Array.from(e.target.files) : [];

                    setHandoffVideoFiles(files);

                  }}

                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700"

                />

                {handoffVideoFiles.length > 0 && (

                  <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-5 space-y-3">

                    {handoffVideoFiles.map((f) => (

                      <div key={`${f.name}-${f.size}-${f.lastModified}`} className="text-[12px] font-black text-slate-900 truncate">

                        {f.name}

                      </div>

                    ))}

                  </div>

                )}

              </div>

            </div>



            <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-3">

              <button

                type="button"

                onClick={() => {

                  if (isSubmittingHandoff) return;

                  setIsHandoffOpen(false);

                }}

                className="px-8 py-4 bg-white border border-slate-200 text-slate-700 rounded-[1.75rem] text-sm font-black uppercase hover:bg-slate-50 transition-all"

                disabled={isSubmittingHandoff}

              >

                {tr('intern_assignment.actions.cancel')}

              </button>

              <button

                type="button"

                onClick={() => void handleSubmitHandoff()}

                className="px-12 py-4 bg-blue-600 text-white rounded-[1.75rem] text-sm font-black uppercase hover:bg-blue-700 shadow-2xl shadow-blue-500/20 active:scale-95 transition-all"

                disabled={isSubmittingHandoff}

              >

                {isSubmittingHandoff ? tr('intern_assignment.handoff.submitting') : tr('intern_assignment.handoff.submit')}

              </button>

            </div>

          </div>

        </div>

      )}



      {/* --- EXTEND DEADLINE MODAL (Cascade Logic) --- */}

      {isExtendingDeadline && (

        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[#0B0F19]/80 backdrop-blur-xl animate-in fade-in duration-300">

           <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl space-y-10 animate-in zoom-in-95 duration-300">

              <div className="flex items-center gap-5">

                 <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[1.75rem] flex items-center justify-center shadow-sm">

                    <Clock size={32}/>

                 </div>

                 <div>

                    <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{tr('intern_assignment.actions.extend_deadline')}</h3>

                    <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mt-2">{tr('intern_assignment.labels.planned_target')}</p>

                 </div>

              </div>

              

              <div className="bg-blue-50/50 p-6 rounded-[1.5rem] border border-blue-100 flex items-start gap-4">

                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">

                   <Zap size={18} className="text-blue-600" fill="currentColor" />

                </div>

                <p className="text-[11px] text-blue-700 leading-relaxed font-bold italic">

                  {tr('intern_assignment.extend_modal.shift_hint')}

                </p>

              </div>



              <div className="grid grid-cols-2 gap-6">

                 <div className="col-span-2">

                    <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block">{tr('intern_assignment.fields.task_title')}</label>

                    <input

                      type="text"

                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 focus:bg-white transition-all"

                      value={extensionTitle}

                      onChange={(e) => setExtensionTitle(e.target.value)}

                    />

                 </div>

                 <div>

                    <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block">{tr('intern_assignment.extend_modal.new_target_date')}</label>

                    <div className="relative">

                      <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 focus:bg-white transition-all appearance-none" value={extensionDate.date} onChange={e => setExtensionDate({...extensionDate, date: e.target.value})} />

                      <Calendar size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />

                    </div>

                 </div>

                 <div>

                    <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block">{tr('intern_assignment.extend_modal.new_target_time')}</label>

                    <div className="relative">

                      <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 focus:bg-white transition-all appearance-none" value={extensionDate.time} onChange={e => setExtensionDate({...extensionDate, time: e.target.value})} />

                      <Clock size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />

                    </div>

                 </div>

              </div>



              <div className="flex gap-4">

                 <button onClick={() => {

                   setIsExtendingDeadline(null);

                   setExtensionTitle('');

                 }} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black text-xs uppercase tracking-widest">{tr('intern_assignment.actions.cancel')}</button>

                 <button onClick={handleExtendDeadline} className="flex-[2] py-5 bg-blue-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-500/20 active:scale-95 transition-all">

                    {tr('intern_assignment.extend_modal.apply_extension_shift')}

                 </button>

              </div>

           </div>

        </div>

      )}



      {/* --- TASK PLANNING MODAL --- */}

      {isPlanningTask && (

        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">

           <div className="bg-white w-full max-w-xl rounded-[3rem] p-10 shadow-2xl space-y-10">

              <div className="flex items-center justify-between">

                 <h3 className="text-3xl font-black text-slate-900 tracking-tight">{tr('intern_assignment.actions.plan_new_task')}</h3>

                 <button onClick={() => setIsPlanningTask(false)} className="text-slate-300 hover:text-slate-900 transition-colors"><X size={32}/></button>

              </div>

              <div className="space-y-8">

                 <div>

                    <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block">{tr('intern_assignment.fields.task_title')}</label>

                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 focus:bg-white transition-all" placeholder={tr('intern_assignment.placeholders.task_title')} value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />

                 </div>

                 <div className="grid grid-cols-2 gap-6">

                    <div>

                       <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block">{tr('intern_assignment.fields.tracking_mode')}</label>

                       <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">

                          <button onClick={() => setNewTask({...newTask, type: 'SINGLE'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${newTask.type === 'SINGLE' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>{tr('intern_assignment.tracking_modes.single')}</button>

                          <button onClick={() => setNewTask({...newTask, type: 'CONTINUE'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${newTask.type === 'CONTINUE' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>{tr('intern_assignment.tracking_modes.continue')}</button>

                       </div>

                    </div>

                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100">

                    <div className="space-y-4">

                       <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{tr('intern_assignment.fields.start_target')}</p>

                       <input type="date" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold" value={newTask.startDate} onChange={e => setNewTask({...newTask, startDate: e.target.value})} />

                       <input type="time" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold" value={newTask.startTime} onChange={e => setNewTask({...newTask, startTime: e.target.value})} />

                    </div>

                    <div className="space-y-4">

                       <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">{tr('intern_assignment.fields.end_target')}</p>

                       <input type="date" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold" value={newTask.endDate} onChange={e => setNewTask({...newTask, endDate: e.target.value})} />

                       <input type="time" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold" value={newTask.endTime} onChange={e => setNewTask({...newTask, endTime: e.target.value})} />

                    </div>

                 </div>

              </div>

              <div className="flex gap-4">

                 <button onClick={() => setIsPlanningTask(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black text-xs uppercase">{tr('intern_assignment.actions.cancel')}</button>

                 <button onClick={handleAddTask} className="flex-[2] py-5 bg-blue-600 text-white rounded-3xl font-black text-sm uppercase shadow-2xl shadow-blue-500/20">{tr('intern_assignment.actions.confirm_add_task')}</button>

              </div>

           </div>

        </div>

      )}



      {/* --- FINALIZE UPLOAD MODAL --- */}

      {uploadTaskId && (

        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">

           <div className="bg-white w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-[3.5rem] p-12 shadow-2xl space-y-10 animate-in zoom-in-95 duration-300">

              <div className="flex items-center gap-5">

                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center shadow-sm">

                   <Upload size={32} />

                </div>

                <div>

                   <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{tr('intern_assignment.proof_upload.title')}</h3>

                   <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mt-2">{tr('intern_assignment.proof_upload.subtitle')}</p>

                </div>

              </div>

              

              <button 

                onClick={() => fileInputRef.current?.click()}

                className="w-full py-16 border-4 border-dashed border-slate-100 rounded-[3rem] text-slate-400 font-black text-xs uppercase tracking-[0.2em] hover:border-blue-200 hover:text-blue-600 transition-all flex flex-col items-center justify-center gap-4 group"

              >

                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">

                   <Plus size={32}/>

                </div>

                {tr('intern_assignment.proof_upload.drop_files')}

              </button>



              <div className="text-[11px] font-bold text-slate-500 px-2">

                {tr('intern_assignment.proof_upload.max_per_file', { mb: 20 } as any)}

              </div>

              <input

                type="file"

                ref={fileInputRef}

                className="hidden"

                multiple

                onChange={(e) => {

                  const incoming = Array.from(e.target.files ?? []) as File[];

                  if (incoming.length === 0) return;

                  const MAX_PROOF_BYTES = 20 * 1024 * 1024;

                  const tooLarge = incoming.find((f) => f.size > MAX_PROOF_BYTES) ?? null;

                  if (tooLarge) {

                    window.alert(

                      tr('intern_assignment.errors.file_too_large', { name: tooLarge.name, mb: 20 } as any),
                    );

                    if (fileInputRef.current) fileInputRef.current.value = '';

                    return;

                  }

                  setSelectedProofFiles((prev) => {

                    const merged = [...prev, ...incoming];

                    const unique = new Map<string, File>();

                    merged.forEach((f) => unique.set(`${f.name}:${f.size}:${f.lastModified}`, f));

                    return Array.from(unique.values());

                  });

                }}

              />



              <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] space-y-4">

                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">

                  {tr('intern_assignment.proof_upload.attach_link')}

                </div>

                <div className="flex gap-3">

                  <input

                    value={proofLinkDraft}

                    onChange={(e) => setProofLinkDraft(e.target.value)}

                    className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5"

                    placeholder={tr('intern_assignment.proof_upload.placeholders.shareable_link')}

                  />

                  <button

                    type="button"

                    onClick={() => {

                      const v = proofLinkDraft.trim();

                      if (!v) return;

                      if (!v.startsWith('http://') && !v.startsWith('https://')) {

                        window.alert(tr('intern_assignment.errors.url_must_start_with_http'));

                        return;

                      }

                      setSelectedProofLinks((prev) => Array.from(new Set([...prev, v])));

                      setProofLinkDraft('');

                    }}

                    className="px-6 py-3 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all"

                  >

                    {tr('intern_assignment.proof_upload.add_link')}

                  </button>

                </div>

              </div>



              {selectedProofLinks.length > 0 && (

                <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem]">

                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">

                    {tr('intern_assignment.proof_upload.attached_links')}

                  </div>

                  <div className="space-y-2">

                    {selectedProofLinks.map((u) => (

                      <div key={u} className="flex items-center justify-between gap-4">

                        <button

                          type="button"

                          onClick={() => window.open(u, '_blank', 'noopener,noreferrer')}

                          className="min-w-0 text-left hover:underline"

                        >

                          <div className="text-[12px] font-black text-slate-900 truncate">{u}</div>

                        </button>

                        <button

                          type="button"

                          onClick={() => setSelectedProofLinks((prev) => prev.filter((x) => x !== u))}

                          className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-slate-300 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all flex items-center justify-center shrink-0"

                          title={tr('intern_assignment.actions.remove_link')}

                        >

                          <Trash2 size={16} />

                        </button>

                      </div>

                    ))}

                  </div>

                </div>

              )}



              {(() => {

                if (!selectedProject) return null;

                const task = selectedProject.tasks.find((t) => t.id === uploadTaskId);

                if (!task) return null;

                const isOverdue = !task.actualEnd && new Date() > new Date(task.plannedEnd);

                if (!isOverdue) return null;



                const value = delayRemarkDrafts[uploadTaskId] ?? (task.delayRemark ?? '');

                const isRemarkValid = Boolean(value.trim());



                return (

                  <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] space-y-3">

                    <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest">{tr('intern_assignment.proof_upload.delay_remark')}</div>

                    <textarea

                      value={value}

                      onChange={(e) => setDelayRemarkDrafts((prev) => ({ ...prev, [uploadTaskId]: e.target.value }))}

                      placeholder={tr('intern_assignment.proof_upload.delay_remark_placeholder')}

                      className={`w-full bg-white border rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-8 transition-all ${

                        isRemarkValid

                          ? 'border-slate-200 focus:ring-blue-500/5'

                          : 'border-rose-300 focus:ring-rose-500/10'

                      }`}

                      rows={3}

                    />

                  </div>

                );

              })()}



              {selectedProofFiles.length > 0 && (

                <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem]">

                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">

                    {tr('intern_assignment.proof_upload.selected_files')}

                  </div>

                  <div className="space-y-2">

                    {selectedProofFiles.map((f) => (

                      <div key={`${f.name}:${f.size}:${f.lastModified}`} className="flex items-center justify-between gap-4">

                        <div className="text-sm font-bold text-slate-700 truncate min-w-0">{f.name}</div>

                        <button

                          type="button"

                          onClick={() =>

                            setSelectedProofFiles((prev) => prev.filter((x) => `${x.name}:${x.size}:${x.lastModified}` !== `${f.name}:${f.size}:${f.lastModified}`))

                          }

                          className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-slate-300 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all flex items-center justify-center shrink-0"

                          title={tr('intern_assignment.actions.remove_file')}

                        >

                          <Trash2 size={16} />

                        </button>

                      </div>

                    ))}

                  </div>

                </div>

              )}



              <div className="flex gap-4">

                 <button

                  onClick={() => {

                    setUploadTaskId(null);

                    setSelectedProofFiles([]);

                    setSelectedProofLinks([]);

                    setProofLinkDraft('');

                    if (fileInputRef.current) fileInputRef.current.value = '';

                  }}

                  className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black text-xs uppercase tracking-widest"

                 >

                  {tr('intern_assignment.actions.cancel')}

                 </button>

                 <button 

                  onClick={() => void handleSubmitWithProof(uploadTaskId)}

                  disabled={(() => {

                    if (!selectedProject) return false;

                    const task = selectedProject.tasks.find((t) => t.id === uploadTaskId);

                    if (!task) return false;

                    const isOverdue = !task.actualEnd && new Date() > new Date(task.plannedEnd);

                    if (!isOverdue) return false;

                    const value = delayRemarkDrafts[uploadTaskId] ?? (task.delayRemark ?? '');

                    return !value.trim();

                  })()}

                  className={`flex-[2] py-5 text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-emerald-100 transition-all ${

                    (() => {

                      if (!selectedProject) return 'bg-emerald-500 hover:bg-emerald-600';

                      const task = selectedProject.tasks.find((t) => t.id === uploadTaskId);

                      if (!task) return 'bg-emerald-500 hover:bg-emerald-600';

                      const isOverdue = !task.actualEnd && new Date() > new Date(task.plannedEnd);

                      if (!isOverdue) return 'bg-emerald-500 hover:bg-emerald-600';

                      const value = delayRemarkDrafts[uploadTaskId] ?? (task.delayRemark ?? '');

                      return value.trim() ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-emerald-200 cursor-not-allowed';

                    })()

                  }`}

                 >

                   {tr('intern_assignment.actions.complete_finalize')}

                 </button>

              </div>

           </div>

        </div>

      )}



      {/* --- CREATE PROJECT MODAL --- */}

      {isCreatingProject && (

        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">

           <div className="bg-white w-full max-w-xl rounded-[3rem] p-10 shadow-2xl space-y-10 animate-in zoom-in-95 duration-300">

              <div className="flex items-center justify-between">

                 <h3 className="text-3xl font-black text-slate-900 tracking-tight">{tr('intern_assignment.actions.create_new_project')}</h3>

                 <button onClick={() => setIsCreatingProject(false)} className="text-slate-300 hover:text-slate-900 transition-colors"><X size={32}/></button>

              </div>

              <div className="space-y-6">

                 <div>

                    <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block">{tr('intern_assignment.create_project.project_title')}</label>

                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none" value={newProject.title} onChange={e => setNewProject({...newProject, title: e.target.value})} />

                 </div>

                 <div>

                    <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block">{tr('intern_assignment.create_project.description')}</label>

                    <textarea className="w-full bg-slate-50 border border-slate-200 rounded-[2rem] px-6 py-5 text-sm h-32 resize-none" value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} />

                 </div>

              </div>

              <div className="flex gap-4">

                 <button onClick={() => setIsCreatingProject(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black text-xs uppercase">{tr('intern_assignment.actions.cancel')}</button>

                 <button onClick={() => void handleCreatePersonalProject()} className="flex-[2] py-5 bg-blue-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-500/20">{tr('intern_assignment.create_project.initialize_project')}</button>

              </div>

           </div>

        </div>

      )}

    </div>

  );

};



export default AssignmentPage;

