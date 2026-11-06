import {MapPin, Search, X} from 'lucide-react';
import {useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ErrorNotice, Loading} from '@/components/ui';
import {useResource} from '@/hooks/useResource';
import type {Gym, GymCatalog} from '@/types/climbing';

export function GymPicker({
  gym,
  onSelect,
  disabled,
}: {
  gym: Gym | null;
  onSelect: (gym: Gym) => void;
  disabled: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('전체');
  const {data, loading, error, reload} = useResource<GymCatalog>('/gyms');
  const normalize = (value: string) => value.toLowerCase().replace(/\s/g, '');
  const results =
    data?.gyms.filter(
      item =>
        (region === '전체' || item.region === region) &&
        normalize(`${item.name}${item.address}${item.franchiseName}${item.aliases.join(' ')}`).includes(
          normalize(query)
        )
    ) ?? [];
  return (
    <>
      <button
        type="button"
        className="gym-select-button"
        disabled={disabled}
        aria-label="암장 선택"
        onClick={() => dialog.current?.showModal()}
      >
        <MapPin size={20} />
        <span>
          {gym ? gym.name : '암장 선택'}
          {gym && <small>{gym.address}</small>}
        </span>
        <Search size={17} />
      </button>
      {createPortal(
        <dialog
          ref={dialog}
          className="gym-dialog"
          aria-labelledby={headingId}
          onClick={event => {
            if (event.target === event.currentTarget) dialog.current?.close();
          }}
        >
          <div className="gym-dialog-header">
            <h2 id={headingId}>암장 선택</h2>
            <button type="button" className="icon-button" aria-label="닫기" onClick={() => dialog.current?.close()}>
              <X size={20} />
            </button>
          </div>
          <div className="gym-search-tools">
            <label className="search-field">
              <Search size={18} />
              <input
                autoFocus
                aria-label="암장 검색"
                placeholder="암장·지점·지역 검색"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </label>
            <select aria-label="암장 지역" value={region} onChange={e => setRegion(e.target.value)}>
              <option>전체</option>
              <option>서울</option>
              <option>경기</option>
            </select>
          </div>
          <div className="gym-results" role="list" aria-label="암장 검색 결과">
            {loading ? (
              <Loading />
            ) : error ? (
              <ErrorNotice message={error} retry={reload} />
            ) : results.length ? (
              results.map(item => (
                <div className="gym-result" role="listitem" key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(item);
                      dialog.current?.close();
                    }}
                  >
                    <strong>{item.name}</strong>
                    <small>{item.address}</small>
                  </button>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`${item.name} 카카오맵`}>
                    지도 ↗
                  </a>
                </div>
              ))
            ) : (
              <p className="gym-no-result">검색 결과가 없어요. 지점명이나 지역을 바꿔보세요.</p>
            )}
          </div>
          {data && (
            <p className="gym-catalog-note">
              카카오맵 업체명 · {data.gyms.length}곳 · {data.verifiedAt} 확인
              <br />
              {data.coverageNote}
            </p>
          )}
        </dialog>,
        document.body
      )}
    </>
  );
}
