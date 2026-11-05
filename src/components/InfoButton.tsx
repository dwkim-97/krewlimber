import {Info, X} from 'lucide-react';
import {useId, useRef, type ReactNode} from 'react';
import {createPortal} from 'react-dom';

export function InfoButton({title, children}: {title: string; children: ReactNode}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  return (
    <>
      <button
        type="button"
        className="info-button"
        aria-label={`${title} 정보`}
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <Info size={17} />
      </button>
      {createPortal(
        <dialog
          ref={dialog}
          className="info-dialog"
          aria-labelledby={headingId}
          onClick={event => {
            if (event.target === event.currentTarget) dialog.current?.close();
          }}
        >
          <div className="info-dialog-content">
            <div className="info-dialog-heading">
              <h2 id={headingId}>{title}</h2>
              <button type="button" className="info-close" aria-label="닫기" onClick={() => dialog.current?.close()}>
                <X size={20} />
              </button>
            </div>
            <div className="info-dialog-description">{children}</div>
          </div>
        </dialog>,
        document.body
      )}
    </>
  );
}
