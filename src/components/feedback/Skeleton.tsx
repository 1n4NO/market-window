import { classNames } from '../../utils/classNames';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={classNames(
        'animate-pulse rounded-[18px] bg-[linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.07),rgba(255,255,255,0.04))]',
        className,
      )}
    />
  );
}
