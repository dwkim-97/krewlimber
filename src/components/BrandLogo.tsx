export function BrandLogo({size}: {size: 'header' | 'large'}) {
  return (
    <span className={`brand${size === 'large' ? ' brand-large' : ''}`}>
      <img src="/krewlimber-logo.svg" alt="KREWLIMBER" />
    </span>
  );
}
