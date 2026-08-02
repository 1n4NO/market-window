import type { SVGProps } from 'react';

type FlagProps = SVGProps<SVGSVGElement>;

function FlagFrame(props: FlagProps) {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props} />;
}

function IndiaFlag(props: FlagProps) {
  return (
    <FlagFrame {...props}>
      <rect width="32" height="32" fill="#ffffff" />
      <rect width="32" height="10.67" y="0" fill="#f28c28" />
      <rect width="32" height="10.67" y="21.33" fill="#138808" />
      <circle cx="16" cy="16" r="3.7" stroke="#1a4e8a" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="1.1" fill="#1a4e8a" />
    </FlagFrame>
  );
}

function JapanFlag(props: FlagProps) {
  return (
    <FlagFrame {...props}>
      <rect width="32" height="32" fill="#ffffff" />
      <circle cx="16" cy="16" r="7.8" fill="#d11f2f" />
    </FlagFrame>
  );
}

function UnitedKingdomFlag(props: FlagProps) {
  return (
    <FlagFrame {...props}>
      <rect width="32" height="32" fill="#1b3b8e" />
      <path d="M0 4.2 4.2 0 32 27.8 27.8 32z" fill="#ffffff" />
      <path d="M27.8 0 32 4.2 4.2 32 0 27.8z" fill="#ffffff" />
      <path d="M0 6.5 6.5 0 32 25.5 25.5 32z" fill="#cf2b37" />
      <path d="M25.5 0 32 6.5 6.5 32 0 25.5z" fill="#cf2b37" />
      <rect x="13.7" width="4.6" height="32" fill="#ffffff" />
      <rect y="13.7" width="32" height="4.6" fill="#ffffff" />
      <rect x="14.8" width="2.4" height="32" fill="#cf2b37" />
      <rect y="14.8" width="32" height="2.4" fill="#cf2b37" />
    </FlagFrame>
  );
}

function UnitedStatesFlag(props: FlagProps) {
  return (
    <FlagFrame {...props}>
      <rect width="32" height="32" fill="#ffffff" />
      {Array.from({ length: 7 }, (_, index) => (
        <rect key={index} y={index * 4.57} width="32" height="2.28" fill="#bf0a30" />
      ))}
      <rect width="14.5" height="12.5" fill="#183a8f" />
      <circle cx="7.2" cy="6.2" r="0.6" fill="#ffffff" />
      <circle cx="9.5" cy="8.1" r="0.6" fill="#ffffff" />
      <circle cx="11.8" cy="5.9" r="0.6" fill="#ffffff" />
      <circle cx="7.8" cy="9.5" r="0.6" fill="#ffffff" />
      <circle cx="10.2" cy="11.1" r="0.6" fill="#ffffff" />
    </FlagFrame>
  );
}

function HongKongFlag(props: FlagProps) {
  return (
    <FlagFrame {...props}>
      <rect width="32" height="32" fill="#de1f2f" />
      <g transform="translate(16 16)">
        <circle r="5.7" fill="#ffffff" opacity="0.96" />
        <ellipse cx="0" cy="-5.2" rx="1.7" ry="3.4" fill="#ffffff" transform="rotate(0)" />
        <ellipse cx="0" cy="-5.2" rx="1.7" ry="3.4" fill="#ffffff" transform="rotate(72)" />
        <ellipse cx="0" cy="-5.2" rx="1.7" ry="3.4" fill="#ffffff" transform="rotate(144)" />
        <ellipse cx="0" cy="-5.2" rx="1.7" ry="3.4" fill="#ffffff" transform="rotate(216)" />
        <ellipse cx="0" cy="-5.2" rx="1.7" ry="3.4" fill="#ffffff" transform="rotate(288)" />
        <circle r="1.05" fill="#de1f2f" />
      </g>
    </FlagFrame>
  );
}

function GermanyFlag(props: FlagProps) {
  return (
    <FlagFrame {...props}>
      <rect width="32" height="10.67" y="0" fill="#111111" />
      <rect width="32" height="10.67" y="10.67" fill="#c91f37" />
      <rect width="32" height="10.66" y="21.34" fill="#f0c33c" />
    </FlagFrame>
  );
}

export function MarketFlagIcon({ marketId, className }: { marketId: string; className?: string }) {
  const shared = {
    className,
    preserveAspectRatio: 'none' as const,
  };

  switch (marketId) {
    case 'nse':
      return <IndiaFlag {...shared} />;
    case 'tse':
      return <JapanFlag {...shared} />;
    case 'lse':
      return <UnitedKingdomFlag {...shared} />;
    case 'nyse':
      return <UnitedStatesFlag {...shared} />;
    case 'hkex':
      return <HongKongFlag {...shared} />;
    case 'xetra':
      return <GermanyFlag {...shared} />;
    default:
      return <IndiaFlag {...shared} />;
  }
}
