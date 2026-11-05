import {ArrowUpRight, Flag, LoaderCircle, RefreshCw} from 'lucide-react';
import {Link} from 'react-router-dom';
import type {ReactNode} from 'react';

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          <span />
          {eyebrow}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

export function EmptyState({title, description, children}: {title: string; description: string; children?: ReactNode}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Flag size={27} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}

export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> 잠시만 기다려주세요.
    </div>
  );
}

export function ErrorNotice({message, retry}: {message: string; retry: (() => void) | null}) {
  return (
    <div className="notice error" role="alert">
      {message}
      {retry && (
        <button className="text-button" onClick={retry}>
          <RefreshCw size={15} /> 다시 시도
        </button>
      )}
    </div>
  );
}

export function Avatar({name, index}: {name: string; index: number}) {
  return (
    <div className={`avatar avatar-${index % 4}`} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function TextLink({to, children}: {to: string; children: ReactNode}) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowUpRight size={18} />
    </Link>
  );
}
