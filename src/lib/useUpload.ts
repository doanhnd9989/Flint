import { useCallback } from 'react'
import { nanoid } from 'nanoid'
import { useStore } from './store'
import { toast } from './toast'
import { formatBytes, kindForFile, uploadAsset, UploadError } from './upload'

/**
 * Attaching files to an issue: uploads each one, showing a progress row in the
 * attachments list while it goes and adding the attachment when it lands.
 * Shared by everything that can attach — the paperclip under the description,
 * the attachments section, and a drop onto the issue itself.
 */
export function useIssueUpload(issueId: string) {
  return useCallback(
    async (files: Iterable<File>) => {
      const list = Array.from(files)
      if (!list.length) return
      const s = useStore.getState()

      await Promise.all(
        list.map(async (file) => {
          const id = `up_${nanoid(8)}`
          s.startUpload({ id, issueId, name: file.name, size: file.size, progress: 0 })
          try {
            const asset = await uploadAsset(file, (p) =>
              useStore.getState().setUploadProgress(id, p),
            )
            useStore.getState().addAttachment(issueId, {
              name: asset.filename,
              kind: kindForFile(asset.filename, asset.contentType),
              url: asset.url,
              size: formatBytes(asset.size),
              sizeBytes: asset.size,
              contentType: asset.contentType,
            })
            useStore.getState().clearUpload(id)
          } catch (err) {
            const message = err instanceof UploadError ? err.message : 'Upload failed'
            useStore.getState().failUpload(id, message)
            toast({ title: file.name, message })
          }
        }),
      )
    },
    [issueId],
  )
}
