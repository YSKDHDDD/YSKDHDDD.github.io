import { RetroCard } from '@/components/notes/RetroCard'
import { Reveal } from '@/components/effects/Reveal'
import { retros } from '@/lib/content'

export default function Retro() {
  return (
    <div className="page-shell py-12 sm:py-16">
      <header className="max-w-[52ch]">
        <p className="font-mono text-label tracking-[0.14em] text-faint">RETROSPECTIVE</p>
        <h1 className="mt-4 text-h1 font-medium tracking-[-0.02em] text-fg">项目复盘</h1>
        <p className="mt-3 text-body text-muted">
          固定四段结构：问题与约束 → 关键决策 → 结果 → 如果重来。
          决策卡片里并排列出当时的选项，包括我选错的那个。
        </p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {retros.map((retro, index) => (
          <Reveal key={retro.slug} delay={index * 60}>
            <RetroCard retro={retro} className="h-full" />
          </Reveal>
        ))}
      </div>

      <p className="mt-8 border-t border-line pt-4 text-meta text-faint">
        共 {retros.length} 个复盘。每个都附一份可量化的结果表，指标来自真实构建与检查输出。
      </p>
    </div>
  )
}
