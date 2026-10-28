import * as React from 'react'
import { cn } from '@/lib/utils'

type TabsContextValue = {
  value: string
  setValue: (value: string) => void
  baseId: string
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext(component: string) {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error(`<${component}> 必须放在 <Tabs> 内部使用`)
  }
  return context
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, children, defaultValue = '', value, onValueChange, ...props }, ref) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
    const isControlled = value !== undefined
    const currentValue = isControlled ? value : uncontrolledValue
    const baseId = React.useId()

    const setValue = React.useCallback(
      (next: string) => {
        if (!isControlled) setUncontrolledValue(next)
        onValueChange?.(next)
      },
      [isControlled, onValueChange]
    )

    const contextValue = React.useMemo(
      () => ({ value: currentValue, setValue, baseId }),
      [currentValue, setValue, baseId]
    )

    return (
      <TabsContext.Provider value={contextValue}>
        <div ref={ref} className={cn('w-full', className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    )
  }
)
Tabs.displayName = 'Tabs'

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { setValue } = useTabsContext('TabsList')

    // 键盘左右方向键在标签间切换，符合 WAI-ARIA tablist 模式
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      const supported = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
      if (!supported.includes(event.key)) return

      const tabs = Array.from(
        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
      )
      if (tabs.length === 0) return

      const activeIndex = tabs.findIndex((tab) => tab === document.activeElement)
      if (activeIndex === -1) return

      event.preventDefault()

      let nextIndex = activeIndex
      if (event.key === 'ArrowRight') nextIndex = (activeIndex + 1) % tabs.length
      if (event.key === 'ArrowLeft') nextIndex = (activeIndex - 1 + tabs.length) % tabs.length
      if (event.key === 'Home') nextIndex = 0
      if (event.key === 'End') nextIndex = tabs.length - 1

      const nextTab = tabs[nextIndex]
      nextTab.focus()
      setValue(nextTab.dataset.value ?? '')
    }

    return (
      <div
        ref={ref}
        role="tablist"
        onKeyDown={handleKeyDown}
        className={cn(
          'inline-flex h-12 items-center justify-center gap-1 rounded-xl bg-slate-800/50 p-1 text-slate-400',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TabsList.displayName = 'TabsList'

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, children, value, ...props }, ref) => {
    const { value: activeValue, setValue, baseId } = useTabsContext('TabsTrigger')
    const isActive = activeValue === value

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={`${baseId}-trigger-${value}`}
        aria-controls={`${baseId}-panel-${value}`}
        aria-selected={isActive}
        tabIndex={isActive ? 0 : -1}
        data-state={isActive ? 'active' : 'inactive'}
        data-value={value}
        onClick={() => setValue(value)}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium',
          'outline-none transition-all duration-200',
          'hover:bg-slate-700/50 hover:text-white',
          'focus-visible:ring-2 focus-visible:ring-indigo-500',
          'data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-pink-500',
          'data-[state=active]:text-white data-[state=active]:shadow-lg',
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
TabsTrigger.displayName = 'TabsTrigger'

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, children, value, ...props }, ref) => {
    const { value: activeValue, baseId } = useTabsContext('TabsContent')
    const isActive = activeValue === value

    // 非激活面板不挂载，避免多段内容同时显示
    if (!isActive) return null

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`${baseId}-panel-${value}`}
        aria-labelledby={`${baseId}-trigger-${value}`}
        tabIndex={0}
        className={cn(
          'mt-3 animate-fade-in outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
