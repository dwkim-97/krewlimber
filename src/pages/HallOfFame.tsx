import {useState} from 'react';
import {PageHeading, ErrorNotice, Loading} from '@/components/ui';
import {TitleList} from '@/components/TitleList';
import {useResource} from '@/hooks/useResource';
import type {TitleBoard} from '@/types';
import {quarterLabel} from '@/consts/progression';

export function HallOfFame({embedded = false}: {embedded?: boolean} = {}) {
  const [quarter, setQuarter] = useState('');
  const {data, loading, error, reload} = useResource<TitleBoard>(
    `/titles${quarter ? `?quarter=${encodeURIComponent(quarter)}` : ''}`
  );
  return (
    <div className={embedded ? 'hall-of-fame-content' : 'page-shell'}>
      <div className="hall-of-fame-heading">
        {!embedded && <PageHeading title="명예의 전당" />}
        <label className="quarter-select">
          <span>분기</span>
          <select
            aria-label="명예의 전당 분기"
            value={quarter || data?.quarter || ''}
            onChange={event => setQuarter(event.target.value)}
          >
            {data?.quarters.map(value => (
              <option value={value} key={value}>
                {quarterLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorNotice message={error} retry={reload} />
      ) : (
        data && <TitleList categories={data.categories} />
      )}
    </div>
  );
}
