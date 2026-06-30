import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom'
import { useEffect, useState } from 'react'
import { PanelLeft, Loader2 } from 'lucide-react'
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
import { MemberDetailView } from '@/views/MemberDetailView'
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
import { Landing } from '@/views/Landing'
import { Login } from '@/views/Login'
import { Register } from '@/views/Register'
import { ApiDocs } from '@/views/ApiDocs'
import { AdminView } from '@/views/AdminView'
import { ApiKeysView } from '@/views/ApiKeysView'
import { RequireAuth, RequireAdmin } from '@/components/RequireAuth'
import { useAuth } from '@/lib/auth'
import { hydrateWorkspace, startWorkspaceSync } from '@/lib/sync'

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

/** Root route: marketing landing for visitors, redirect into the app for
 *  authenticated users. Landing is prerendered to static HTML at `/`. */
function RootGate() {
  const user = useAuth((s) => s.user)
  return user ? <DefaultRedirect /> : <Landing />
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

/** Full-screen splash while the auth session bootstraps. */
function BootSplash() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg text-muted">
      <Loader2 className="animate-spin" />
    </div>
  )
}

export default function App() {
  const ready = useAuth((s) => s.ready)
  const user = useAuth((s) => s.user)
  const bootstrap = useAuth((s) => s.bootstrap)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  // Once authenticated, hydrate the workspace from the server (source of truth)
  // and start persisting changes back. Gate the app behind a splash until done.
  useEffect(() => {
    if (!ready || !user || hydrated) return
    let cancelled = false
    void hydrateWorkspace().then(() => {
      if (cancelled) return
      startWorkspaceSync()
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [ready, user, hydrated])

  const wsReady = !user || hydrated
  if (!ready || !wsReady) return <BootSplash />

  return (
    <BrowserRouter>
      <Routes>
        {/* Public — landing lives at the root for SEO; logged-in users are
            redirected into the app by RootGate. */}
        <Route path="/" element={<RootGate />} />
        <Route path="/welcome" element={<Navigate to="/" replace />} />
        <Route path="/api-docs" element={<ApiDocs />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* Self-service API key management (any authenticated user) */}
        <Route
          path="/api-keys"
          element={
            <RequireAuth>
              <ApiKeysView />
            </RequireAuth>
          }
        />
        {/* Admin console lives outside the product Shell (its own chrome) */}
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <RequireAdmin>
                <AdminView />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        {/* Authenticated app */}
        <Route
          element={
            <RequireAuth>
              <Shell />
            </RequireAuth>
          }
        >
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
          <Route path="/member/:userId" element={<MemberDetailView />} />
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
