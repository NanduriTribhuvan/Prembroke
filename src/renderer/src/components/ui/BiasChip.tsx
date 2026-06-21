import { Badge } from './Badge'

interface BiasChipProps {
  bias: 'long' | 'short' | 'neutral'
}

export function BiasChip({ bias }: BiasChipProps): React.JSX.Element {
  if (bias === 'long') {
    return <Badge tone="up">Long</Badge>
  }
  if (bias === 'short') {
    return <Badge tone="down">Short</Badge>
  }
  return <Badge tone="default">Neutral</Badge>
}
