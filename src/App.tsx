import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom'
import { useEffect } from 'react'
import { PanelLeft } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { CommandMenu } from '@/components/CommandMenu'
import { CreateIssueModal } from '@/components/CreateIssueModal'
import { CreateInitiativeModal } from '@/components/CreateInitiativeModal'
import { CreateProjectModal } from '@/components/CreateProjectModal'
import { CreateDocumentModal } from '@/components/CreateDocumentModal'
import { CreateViewModal } from '@/components/CreateViewModal'
import { IssuePeek } from '@/components/IssuePeek'
import { BulkActionBar } from '@/components/BulkActionBar'
import { IssueContextMenu } from '@/components/IssueContextMenu'
import { AddLinkModal } from '@/components/AddLinkModal'
import { HelpOverlay } from '@/components/HelpOverlay'
import { RelationPicker } from '@/components/RelationPicker'
import { Toaster } from '@/components/Toaster'
import { useThemeEffect, usePreferenceEffect } from '@/lib/useTheme'
import { useShortcuts } from '@/lib/useShortcuts'
import { useStore } from '@/lib/store'
import { IssuesView } from '@/views/IssuesView'
import { ArchiveView } from '@/views/ArchiveView'
import { RecentView } from '@/views/RecentView'
import { FavoritesView } from '@/views/FavoritesView'
import { TeamsDirectoryView } from '@/views/TeamsDirectoryView'
import { AllIssuesView } from '@/views/AllIssuesView'
import { RemindersView } from '@/views/RemindersView'
import { LabelsDirectoryView } from '@/views/LabelsDirectoryView'
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
import { InsightsView } from '@/views/InsightsView'
import { ActiveCyclesView } from '@/views/ActiveCyclesView'
import { PulseView } from '@/views/PulseView'
import { LabelView } from '@/views/LabelView'
import { TeamOverviewView } from '@/views/TeamOverviewView'
import { CustomersView } from '@/views/CustomersView'
import { CustomerDetail } from '@/views/CustomerDetail'
import { ReleasesView } from '@/views/ReleasesView'
import { MembersDirectoryView } from '@/views/MembersDirectoryView'
import { ChangelogView } from '@/views/ChangelogView'
import { ProfileView } from '@/views/ProfileView'
import { ShareIssueModal } from '@/components/ShareIssueModal'
import { MoveIssueModal } from '@/components/MoveIssueModal'
import { DocumentsView } from '@/views/DocumentsView'
import { DocumentDetail } from '@/views/DocumentDetail'
import { SettingsView } from '@/views/SettingsView'
import { ViewsView } from '@/views/ViewsView'
import { SavedViewScreen } from '@/views/SavedViewScreen'
import { SearchView } from '@/views/SearchView'

function Shell() {
  useThemeEffect()
  usePreferenceEffect()
  useShortcuts()
  const location = useLocation()
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed)
  // Clear bulk selection + keyboard row focus when navigating between views.
  useEffect(() => {
    useStore.getState().clearSelection()
    useStore.getState().setFocusedIssue(null)
  }, [location.pathname])
  // Linear replaces the app sidebar with the settings nav while in Settings.
  const inSettings = location.pathname.startsWith('/settings')
  const showSidebar = !inSettings && !sidebarCollapsed
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-fg">
      {showSidebar && <Sidebar />}
      {!inSettings && sidebarCollapsed && (
        <button
          type="button"
          title="Expand sidebar (⌘/)"
          onClick={() => useStore.getState().toggleSidebar()}
          className="absolute left-1.5 top-2.5 z-30 flex h-7 w-7 items-center justify-center rounded-md bg-bg-secondary text-muted hover:bg-bg-hover hover:text-fg"
        >
          <PanelLeft size={16} />
        </button>
      )}
      <main
        className={
          'flex-1 overflow-hidden bg-bg-secondary' +
          (!inSettings && sidebarCollapsed ? ' pl-10' : '')
        }
      >
        <Outlet />
      </main>
      <CommandMenu />
      <CreateIssueModal />
      <CreateInitiativeModal />
      <CreateProjectModal />
      <CreateDocumentModal />
      <CreateViewModal />
      <IssuePeek />
      <BulkActionBar />
      <IssueContextMenu />
      <AddLinkModal />
      <ShareIssueModal />
      <MoveIssueModal />
      <HelpOverlay />
      <RelationPicker />
      <Toaster />
    </div>
  )
}

function DefaultRedirect() {
  const teamKey = useStore((s) => s.teams[0].key)
  const homeView = useStore((s) => s.preferences.homeView)
  const to =
    homeView === 'my-issues'
      ? '/my-issues'
      : homeView === 'inbox'
        ? '/inbox'
        : `/team/${teamKey}/active`
  return <Navigate to={to} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<DefaultRedirect />} />
          <Route path="/search" element={<SearchView />} />
          <Route path="/archive" element={<ArchiveView />} />
          <Route path="/recent" element={<RecentView />} />
          <Route path="/favorites" element={<FavoritesView />} />
          <Route path="/teams" element={<TeamsDirectoryView />} />
          <Route path="/all-issues" element={<AllIssuesView />} />
          <Route path="/reminders" element={<RemindersView />} />
          <Route path="/labels" element={<LabelsDirectoryView />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/my-issues" element={<MyIssues />} />
          <Route path="/my-issues/:tab" element={<MyIssues />} />
          <Route path="/projects" element={<ProjectsView />} />
          <Route path="/project/:id" element={<ProjectDetail />} />
          <Route path="/initiatives" element={<InitiativesView />} />
          <Route path="/initiative/:id" element={<InitiativeDetail />} />
          <Route path="/roadmap" element={<RoadmapView />} />
          <Route path="/insights" element={<InsightsView />} />
          <Route path="/cycles" element={<ActiveCyclesView />} />
          <Route path="/pulse" element={<PulseView />} />
          <Route path="/label/:id" element={<LabelView />} />
          <Route path="/customers" element={<CustomersView />} />
          <Route path="/customer/:id" element={<CustomerDetail />} />
          <Route path="/releases" element={<ReleasesView />} />
          <Route path="/members" element={<MembersDirectoryView />} />
          <Route path="/changelog" element={<ChangelogView />} />
          <Route path="/profile" element={<ProfileView />} />
          <Route path="/documents" element={<DocumentsView />} />
          <Route path="/document/:id" element={<DocumentDetail />} />
          <Route path="/views" element={<ViewsView />} />
          <Route path="/view/:id" element={<SavedViewScreen />} />
          <Route path="/team/:teamKey/overview" element={<TeamOverviewView />} />
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
