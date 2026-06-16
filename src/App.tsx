import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { CommandMenu } from '@/components/CommandMenu'
import { CreateIssueModal } from '@/components/CreateIssueModal'
import { IssuePeek } from '@/components/IssuePeek'
import { BulkActionBar } from '@/components/BulkActionBar'
import { IssueContextMenu } from '@/components/IssueContextMenu'
import { useThemeEffect } from '@/lib/useTheme'
import { useShortcuts } from '@/lib/useShortcuts'
import { useStore } from '@/lib/store'
import { IssuesView } from '@/views/IssuesView'
import { IssueDetail } from '@/views/IssueDetail'
import { MyIssues } from '@/views/MyIssues'
import { Inbox } from '@/views/Inbox'
import { ProjectsView } from '@/views/ProjectsView'
import { ProjectDetail } from '@/views/ProjectDetail'
import { SettingsView } from '@/views/SettingsView'
import { ViewsView } from '@/views/ViewsView'

function Shell() {
  useThemeEffect()
  useShortcuts()
  const location = useLocation()
  // Clear bulk selection when navigating between views.
  useEffect(() => {
    useStore.getState().clearSelection()
  }, [location.pathname])
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-fg">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-bg-secondary">
        <Outlet />
      </main>
      <CommandMenu />
      <CreateIssueModal />
      <IssuePeek />
      <BulkActionBar />
      <IssueContextMenu />
    </div>
  )
}

function DefaultRedirect() {
  const teamKey = useStore((s) => s.teams[0].key)
  return <Navigate to={`/team/${teamKey}/active`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<DefaultRedirect />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/my-issues" element={<MyIssues />} />
          <Route path="/projects" element={<ProjectsView />} />
          <Route path="/project/:id" element={<ProjectDetail />} />
          <Route path="/views" element={<ViewsView />} />
          <Route path="/team/:teamKey/active" element={<IssuesView />} />
          <Route path="/team/:teamKey/projects" element={<ProjectsView />} />
          <Route path="/issue/:identifier" element={<IssueDetail />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="*" element={<DefaultRedirect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
