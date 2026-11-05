import {useState} from 'react';
import {PageHeading, ErrorNotice, Loading} from '@/components/ui';
import {TitleList} from '@/components/TitleList';
import {useResource} from '@/hooks/useResource';
import type {TitleBoard} from '@/types';
import {quarterLabel} from '@/consts/progression';

export function HallOfFame() {
  const [quarter, setQuarter] = useState('');
  const {data, loading, error, reload} = useResource<TitleBoard>(
    `/titles${quarter ? `?quarter=${encodeURIComponent(quarter)}` : ''}`
  );
  return (
    <div className="page-shell">
      <PageHeading title="명예의 전당">
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
      </PageHeading>
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
