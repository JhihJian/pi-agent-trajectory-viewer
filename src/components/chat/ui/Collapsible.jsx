import React from 'react'

// 极简折叠：受控/非受控均可，展开状态通过 context 传给 trigger/content。

const CollapsibleContext = React.createContext(
  /** @type {{ open: boolean, toggle: () => void } | null} */ (null),
)

function useCollapsible() {
  const ctx = React.useContext(CollapsibleContext)
  if (!ctx) throw new Error('CollapsibleTrigger/Content 必须放在 Collapsible 内')
  return ctx
}

/**
 * @param {{ open?: boolean, onOpenChange?: (open: boolean) => void, className?: string, children: React.ReactNode }} props
 */
export function Collapsible({ open, onOpenChange, className, children }) {
  const [internal, setInternal] = React.useState(false)
  const isOpen = open ?? internal
  const toggle = React.useCallback(() => {
    const next = !isOpen
    if (open === undefined) setInternal(next)
    onOpenChange?.(next)
  }, [isOpen, open, onOpenChange])

  return (
    <CollapsibleContext.Provider value={{ open: isOpen, toggle }}>
      <div className={className} data-open={isOpen || undefined}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

/**
 * @param {{ className?: string, children: React.ReactNode }} props
 */
export function CollapsibleTrigger({ className, children }) {
  const { toggle } = useCollapsible()
  return (
    <button
      type="button"
      className={className ?? 'pi-chat-collapsible-trigger'}
      onClick={toggle}
    >
      {children}
    </button>
  )
}

/**
 * @param {{ className?: string, children: React.ReactNode }} props
 */
export function CollapsibleContent({ className, children }) {
  const { open } = useCollapsible()
  if (!open) return null
  return <div className={className ?? 'pi-chat-collapsible-content'}>{children}</div>
}
