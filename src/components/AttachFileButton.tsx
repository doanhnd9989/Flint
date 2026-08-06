import { useRef, useState } from 'react'
import { Loader2, Paperclip } from 'lucide-react'
import { useIssueUpload } from '@/lib/useUpload'
import { uploadAsset, UploadError } from '@/lib/upload'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

/**
 * The paperclip Linear puts next to "add reaction" under an issue description:
 * opens the file picker and uploads whatever you choose onto the issue.
 * `variant="round"` matches the circular reaction button; "plain" is the flat
 * icon used inside the comment composer.
 */
export function AttachFileButton({
  issueId,
  variant = 'round',
  title = 'Attach files',
}: {
  issueId: string
  variant?: 'round' | 'plain'
  title?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const upload = useIssueUpload(issueId)

  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) upload(e.target.files)
          // Reset so picking the same file twice still fires a change.
          e.target.value = ''
        }}
      />
      <button
        type="button"
        title={title}
        onClick={() => input.current?.click()}
        className={cn(
          'flex items-center justify-center text-faint hover:text-fg',
          variant === 'round'
            ? 'h-6 w-6 rounded-full border border-border hover:bg-bg-hover'
            : 'h-6 w-6 rounded hover:bg-bg-hover',
        )}
      >
        <Paperclip size={14} />
      </button>
    </>
  )
}

/**
 * The paperclip inside a comment composer. Unlike {@link AttachFileButton} it
 * doesn't attach to the issue — it uploads and hands back markdown to splice
 * into the draft, which is what Linear does when you attach from a comment.
 */
export function ComposerAttachButton({ onInsert }: { onInsert: (markdown: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(files: FileList) {
    setBusy(true)
    for (const file of Array.from(files)) {
      try {
        const asset = await uploadAsset(file)
        const image = asset.contentType.startsWith('image/')
        onInsert(`${image ? '!' : ''}[${asset.filename}](${asset.url})`)
      } catch (err) {
        toast({
          title: file.name,
          message: err instanceof UploadError ? err.message : 'Upload failed',
        })
      }
    }
    setBusy(false)
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) pick(e.target.files)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        title="Attach files"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
      </button>
    </>
  )
}
