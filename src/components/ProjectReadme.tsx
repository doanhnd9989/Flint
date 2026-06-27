import { useState } from 'react'
import { useStoreShallow } from '@/lib/store'
import { Markdown } from '@/lib/markdown'
import { MentionInput } from '@/components/MentionInput'

// Editable long-form project brief (Linear's project Overview "Brief").
export function ProjectReadme({ projectId }: { projectId: string }) {
  const { projects, setProjectReadme } = useStoreShallow((s) => ({
    projects: s.projects,
    setProjectReadme: s.setProjectReadme,
  }))
  const project = projects.find((p) => p.id === projectId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  if (!project) return null
  const readme = project.readme ?? ''

  function startEdit() {
    setDraft(readme)
    setEditing(true)
  }
  function save() {
    setProjectReadme(projectId, draft.trim())
    setEditing(false)
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase text-faint">Brief</h3>
        {!editing && readme && (
          <button
            onClick={startEdit}
            className="text-[11px] text-muted hover:text-fg"
          >
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <MentionInput
            value={draft}
            onChange={setDraft}
            placeholder="Write a project brief…"
            minHeight={120}
            className="w-full resize-none bg-transparent text-[13px] text-fg outline-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={save}
              className="rounded-md bg-accent px-3 py-1 text-[12px] text-white"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-[12px] text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : readme ? (
        <Markdown source={readme} />
      ) : (
        <button
          onClick={startEdit}
          className="text-[13px] text-faint hover:text-fg"
        >
          Add a project brief…
        </button>
      )}
    </section>
  )
}
