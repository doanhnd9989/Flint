import {
  Activity,
  Archive,
  BarChart3,
  Bell,
  Box,
  Building2,
  CircleDot,
  CircleUser,
  FileText,
  Goal,
  History,
  Inbox,
  IterationCw,
  Layers as LayersIcon,
  Layers3,
  Map as MapIcon,
  Megaphone,
  PenSquare,
  Rocket,
  Search,
  Star,
  Tag as TagIcon,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Icon for a configurable sidebar row, keyed by `SIDEBAR_ITEMS[].key`. Shared by
 * the sidebar itself and the Customize sidebar dialog so both stay in sync.
 */
export function sidebarItemIcon(key: string, size = 15): ReactNode {
  switch (key) {
    case 'search':
      return <Search size={size} />
    case 'inbox':
      return <Inbox size={size} />
    case 'my-issues':
      return <CircleDot size={size} />
    case 'drafts':
      return <PenSquare size={size} />
    case 'recent':
      return <History size={size} />
    case 'reminders':
      return <Bell size={size} />
    case 'profile':
      return <CircleUser size={size} />
    case 'all-issues':
      return <Layers3 size={size} />
    case 'initiatives':
      return <Goal size={size} />
    case 'projects':
      return <Box size={size} />
    case 'customers':
      return <Building2 size={size} />
    case 'releases':
      return <Rocket size={size} />
    case 'members':
      return <Users size={size} />
    case 'documents':
      return <FileText size={size} />
    case 'roadmap':
      return <MapIcon size={size} />
    case 'changelog':
      return <Megaphone size={size} />
    case 'cycles':
      return <IterationCw size={size} />
    case 'pulse':
      return <Activity size={size} />
    case 'insights':
      return <BarChart3 size={size} />
    case 'views':
      return <LayersIcon size={size} />
    case 'labels':
      return <TagIcon size={size} />
    case 'teams':
      return <Building2 size={size} />
    case 'favorites':
      return <Star size={size} />
    case 'archive':
      return <Archive size={size} />
    default:
      return <CircleDot size={size} />
  }
}
