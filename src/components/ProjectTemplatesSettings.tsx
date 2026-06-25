import { useState } from 'react';
import { cn } from '@/lib/utils';

// Session-local id helper for newly created templates.
const genId = () => Math.random().toString(36).slice(2, 9);

type Template = {
  id: string;
  emoji: string;
  name: string;
  desc: string;
};

// Session-local templates list — not persisted to the store.
const SEED: Template[] = [
  { id: genId(), emoji: '🚀', name: 'Product Launch', desc: '5 milestones · 12 starter issues' },
  { id: genId(), emoji: '🔬', name: 'Research Spike', desc: '2 milestones · 4 starter issues' },
  { id: genId(), emoji: '🛠️', name: 'Platform Migration', desc: '8 milestones · 30 starter issues' },
];

export function ProjectTemplatesSettings() {
  // Session-local: templates live in component state only.
  const [templates, setTemplates] = useState<Template[]>(SEED);

  const addTemplate = () =>
    setTemplates((prev) => [
      ...prev,
      { id: genId(), emoji: '📋', name: 'Untitled template', desc: '0 milestones · 0 starter issues' },
    ]);

  const duplicateTemplate = (id: string) =>
    setTemplates((prev) => {
      const src = prev.find((t) => t.id === id);
      if (!src) return prev;
      return [...prev, { ...src, id: genId() }];
    });

  const deleteTemplate = (id: string) =>
    setTemplates((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Templates</h1>
      <p className="mt-1 text-[13px] text-muted">
        Templates pre-fill new projects so teams start with a consistent structure.
      </p>

      <div className="mt-7 space-y-9">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-fg">Project templates</h2>
            <button
              type="button"
              onClick={addTemplate}
              className="rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
            >
              New template
            </button>
          </div>

          <div className="divide-y divide-border rounded-xl border border-border">
            {templates.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted">
                No project templates yet
              </div>
            ) : (
              templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <span className="text-[18px] leading-none">{t.emoji}</span>
                    <div>
                      <div className="text-[13px] font-medium text-fg">{t.name}</div>
                      <div className="mt-0.5 text-[12px] text-muted">{t.desc}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => duplicateTemplate(t.id)}
                      className={cn('text-[12px] text-muted hover:underline')}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTemplate(t.id)}
                      className="text-[12px] text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
