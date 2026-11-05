import {Award, Flag, Sparkles, Users} from 'lucide-react';
import {Avatar} from '@/components/ui';
import type {Honor} from '@/types';
import {HONOR_LABELS} from '@/consts';

export function HonorCard({honor, index}: {honor: Honor; index: number}) {
  const Icon = honor.kind === 'send' ? Flag : honor.kind === 'growth' ? Sparkles : Users;
  return (
    <article className="honor-card">
      <div className={`honor-art honor-art-${index % 3}`}>
        <span>{HONOR_LABELS[honor.kind]}</span>
        <Icon size={63} strokeWidth={1.2} />
        <Award className="honor-stamp" size={26} />
      </div>
      <div className="honor-body">
        <time dateTime={honor.achievedAt}>{honor.achievedAt.replaceAll('-', '.')}</time>
        <h3>{honor.title}</h3>
        <p>{honor.description}</p>
        <div className="honor-person">
          <Avatar name={honor.nickname} index={index} />
          <strong>{honor.nickname}</strong>
          <span className="grade-tag">{honor.grade}</span>
        </div>
      </div>
    </article>
  );
}
