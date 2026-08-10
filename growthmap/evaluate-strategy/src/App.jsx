import { useEffect, useState } from 'react';
import { useAuth } from './lib/cloud/auth';
import { useProjectStore, roleOf } from './store/useProjectStore';
import { canEdit } from './domain/model';
import { useHashRoute, navigate } from './lib/useHashRoute';
import LoginGate from './components/Auth/LoginGate';
import ProjectPicker from './components/Projects/ProjectPicker';
import TopBar from './components/Shell/TopBar';
import SideNav from './components/Shell/SideNav';
import AssumptionsDrawer from './components/pages/AssumptionsDrawer';
import P01Dashboard from './components/pages/P01Dashboard';
import P02Longlist from './components/pages/P02Longlist';
import P03Criteria from './components/pages/P03Criteria';
import P04Scoring from './components/pages/P04Scoring';
import P05Matrix from './components/pages/P05Matrix';
import P07Plays from './components/pages/P07Plays';
import P08Templates from './components/pages/P08Templates';
import P09Bizplan from './components/pages/P09Bizplan';
import BizplanHub from './components/pages/BizplanHub';
import P10Rollup from './components/pages/P10Rollup';
import P11Sequencing from './components/pages/P11Sequencing';
import P12Consensus from './components/pages/P12Consensus';
import P13Check from './components/pages/P13Check';
import P14Handoff from './components/pages/P14Handoff';
import SettingsPage from './components/pages/SettingsPage';

const SELECTED_KEY = 'eva_selected_project';

export default function App() {
  const { user, loading } = useAuth();
  const [pid, setPid] = useState(() => localStorage.getItem(SELECTED_KEY) || null);

  const select = (next) => {
    if (next) localStorage.setItem(SELECTED_KEY, next);
    else localStorage.removeItem(SELECTED_KEY);
    setPid(next);
    navigate('dashboard');
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">載入中…</div>;
  }
  if (!user) return <LoginGate />;
  if (!pid) return <ProjectPicker user={user} onSelect={select} />;
  return <Workspace key={pid} pid={pid} user={user} onExit={() => select(null)} />;
}

function Workspace({ pid, user, onExit }) {
  const route = useHashRoute();
  const bind = useProjectStore((s) => s.bind);
  const project = useProjectStore((s) => s.project);
  const projectLoaded = useProjectStore((s) => s.projectLoaded);
  const storeError = useProjectStore((s) => s.error);

  useEffect(() => {
    bind(pid);
  }, [pid, bind]);

  // 換帳號防護：目前帳號不是成員（或專案被刪）→ 回選擇頁
  useEffect(() => {
    if (projectLoaded && (!project || !project.members?.[user.uid])) onExit();
  }, [projectLoaded, project, user.uid, onExit]);

  if (!projectLoaded || !project) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">載入專案中…</div>;
  }

  const role = roleOf(project, user.uid);
  const editable = canEdit(role); // coach＝唯讀（規則層同步強制）
  const ctx = { user, role, editable, pid };

  const page = (() => {
    switch (route.path) {
      case 'dashboard': return <P01Dashboard ctx={ctx} />;
      case 'longlist': return <P02Longlist ctx={ctx} />;
      case 'criteria': return <P03Criteria ctx={ctx} />;
      case 'scoring': return <P04Scoring ctx={ctx} />;
      case 'matrix': return <P05Matrix ctx={ctx} />;
      case 'plays':
        if (route.parts[1] && route.parts[2] === 'templates') return <P08Templates ctx={ctx} playId={route.parts[1]} />;
        if (route.parts[1] && route.parts[2] === 'bizplan') return <P09Bizplan ctx={ctx} playId={route.parts[1]} />;
        return <P07Plays ctx={ctx} />;
      case 'bizplan': return <BizplanHub ctx={ctx} />;
      case 'rollup': return <P10Rollup ctx={ctx} />;
      case 'sequencing': return <P11Sequencing ctx={ctx} />;
      case 'consensus': return <P12Consensus ctx={ctx} />;
      case 'check': return <P13Check ctx={ctx} />;
      case 'handoff': return <P14Handoff ctx={ctx} />;
      case 'settings': return <SettingsPage ctx={ctx} />;
      default: return <P01Dashboard ctx={ctx} />;
    }
  })();

  return (
    <div className="min-h-screen bg-slate-100">
      <TopBar ctx={ctx} onExit={onExit} />
      {storeError && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-1.5 text-xs text-red-700">
          雲端同步異常：{storeError}
        </div>
      )}
      <div className="flex">
        <SideNav ctx={ctx} activePath={route.path} />
        <main className="min-w-0 flex-1 px-4 py-5 lg:px-6">
          <div className="mx-auto max-w-[1440px]">{page}</div>
        </main>
      </div>
      <AssumptionsDrawer ctx={ctx} />
    </div>
  );
}
