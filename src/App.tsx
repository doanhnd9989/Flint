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
import { CreateInitiativeModal } from '@/components/CreateInitiativeModal'
import { IssuePeek } from '@/components/IssuePeek'
import { BulkActionBar } from '@/components/BulkActionBar'
import { IssueContextMenu } from '@/components/IssueContextMenu'
import { HelpOverlay } from '@/components/HelpOverlay'
import { Toaster } from '@/components/Toaster'
import { useThemeEffect } from '@/lib/useTheme'
import { useShortcuts } from '@/lib/useShortcuts'
import { useStore } from '@/lib/store'
import { IssuesView } from '@/views/IssuesView'
import { CyclesView } from '@/views/CyclesView'
import { TriageView } from '@/views/TriageView'
import { IssueDetail } from '@/views/IssueDetail'
import { MyIssues } from '@/views/MyIssues'
import { Inbox } from '@/views/Inbox'
import { ProjectsView } from '@/views/ProjectsView'
import { ProjectDetail } from '@/views/ProjectDetail'
import { InitiativesView } from '@/views/InitiativesView'
import { InitiativeDetail } from '@/views/InitiativeDetail'
import { RoadmapView } from '@/views/RoadmapView'
import { SettingsView } from '@/views/SettingsView'
import { ViewsView } from '@/views/ViewsView'
import { SavedViewScreen } from '@/views/SavedViewScreen'
import { SearchView } from '@/views/SearchView'

function Shell() {
  useThemeEffect()
  useShortcuts()
  const location = useLocation()
  // Clear bulk selection + keyboard row focus when navigating between views.
  useEffect(() => {
    useStore.getState().clearSelection()
    useStore.getState().setFocusedIssue(null)
  }, [location.pathname])
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-fg">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-bg-secondary">
        <Outlet />
      </main>
      <CommandMenu />
      <CreateIssueModal />
      <CreateInitiativeModal />
      <IssuePeek />
      <BulkActionBar />
      <IssueContextMenu />
      <HelpOverlay />
      <Toaster />
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
          <Route path="/search" element={<SearchView />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/my-issues" element={<MyIssues />} />
          <Route path="/projects" element={<ProjectsView />} />
          <Route path="/project/:id" element={<ProjectDetail />} />
          <Route path="/initiatives" element={<InitiativesView />} />
          <Route path="/initiative/:id" element={<InitiativeDetail />} />
          <Route path="/roadmap" element={<RoadmapView />} />
          <Route path="/views" element={<ViewsView />} />
          <Route path="/view/:id" element={<SavedViewScreen />} />
          <Route path="/team/:teamKey/active" element={<IssuesView />} />
          <Route path="/team/:teamKey/triage" element={<TriageView />} />
          <Route path="/team/:teamKey/cycles" element={<CyclesView />} />
          <Route path="/team/:teamKey/projects" element={<ProjectsView />} />
          <Route path="/issue/:identifier" element={<IssueDetail />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="*" element={<DefaultRedirect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
