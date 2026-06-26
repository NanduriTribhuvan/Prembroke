import clsx from 'clsx'

interface TabDef {
  id: string
  label: string
}

interface TabBarProps {
  tabs: TabDef[]
  active: string
  onTabChange: (id: string) => void
  size?: 'sm' | 'md'
}

export function TabBar({
  tabs,
  active,
  onTabChange,
  size = 'md',
}: TabBarProps): React.JSX.Element {
  return (
    <div className="inline-flex items-center rounded-md border border-edge bg-panel p-0.5 gap-0.5">
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              'rounded px-2.5 t-colors font-medium',
              size === 'sm'
                ? 'text-[length:var(--text-caption)] py-0.5'
                : 'text-[length:var(--text-label)] py-1',
              isActive
                ? 'text-accent bg-accent-soft'
                : 'text-muted hover:text-text',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
