import { useSearchParams } from 'react-router-dom'
import Life from './Life'
import LifeDetail from './LifeDetail'

/**
 * `/life` 的一个地址，两种视图。
 *
 * 列表和单条共用一个 pathname，靠 `?id=` 区分 —— 和 `/local` 是同一个做法。
 * 这样详情页在静态托管下不会先落到 404.html 再纠正，刷新不闪；
 * 而且记录本来就只在本机，地址不可分享，`/life/:id` 那套分层没有任何收益。
 *
 * 抽成这个小组件而不是让 Life 自己判断，是为了避免「同一个组件实例在列表态和详情态
 * 之间切换」——两边的 hooks 数量不一样，React 会直接报错。
 */
export default function LifeRoute() {
  const [params] = useSearchParams()
  return params.get('id') ? <LifeDetail /> : <Life />
}
