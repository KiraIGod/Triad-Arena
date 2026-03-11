type TurnCountdownProps = {
  remaining: number;
  className?: string;
};

export default function TurnCountdown({ remaining, className }: TurnCountdownProps) {
  return <span className={className}>{remaining}s</span>;
}
