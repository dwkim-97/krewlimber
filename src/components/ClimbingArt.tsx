export function ClimbingArt() {
  return (
    <div className="climbing-art" aria-label="여러 홀드를 따라 함께 오르는 클라이밍 루트 일러스트" role="img">
      <div className="art-coordinate">ROUTE / KREW-01</div>
      <svg viewBox="0 0 560 560" aria-hidden="true">
        <defs>
          <pattern id="wall-grid" width="38" height="38" patternUnits="userSpaceOnUse">
            <circle cx="19" cy="19" r="1.5" fill="#a2aa8f" opacity=".45" />
          </pattern>
        </defs>
        <path d="M84 55 457 26 537 167 495 505 119 542 24 347Z" fill="#e4e6d9" stroke="#bac0ac" strokeWidth="1" />
        <path d="M84 55 457 26 537 167 495 505 119 542 24 347Z" fill="url(#wall-grid)" />
        <path d="m84 55 193 175L119 542M277 230l260-63M277 230l218 275" fill="none" stroke="#c6ccbb" />
        <path
          d="M162 451c-13-57 47-59 41-116S323 300 312 237s110-49 111-131"
          fill="none"
          stroke="#3d4734"
          strokeWidth="2"
          strokeDasharray="6 8"
        />
        <g fill="#c9ef61" stroke="#252e1b" strokeWidth="2.5" strokeLinejoin="round">
          <path d="m129 438 25-17 38 10 9 23-19 17-42-6Z" />
          <path d="m178 326 9-30 30-6 20 20-3 25-39 7Z" />
          <path d="m292 229 19-18 35 12 5 22-22 15-31-9Z" />
          <path d="m394 104 14-30 34-5 19 23-9 24-40 3Z" />
        </g>
        <g fill="#9da78e">
          <path d="m97 165 22-16 24 6 7 18-33 14Z" />
          <path d="m380 383 28-8 20 26-13 18-30-5Z" />
          <path d="m448 256 21-8 22 15-6 19-29-1Z" />
          <path d="m243 457 23-11 28 16-1 20-39 3Z" />
        </g>
        <g fill="#22281e">
          <circle cx="116" cy="167" r="3" />
          <circle cx="162" cy="445" r="3" />
          <circle cx="205" cy="316" r="3" />
          <circle cx="319" cy="237" r="3" />
          <circle cx="428" cy="95" r="3" />
          <circle cx="404" cy="401" r="3" />
        </g>
        <g stroke="#242c20" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="m269 316-30 46-38-33" />
          <path d="m281 321 35 35-6 47" />
          <path d="m284 273 28-21 8-20" />
          <path d="m264 277-29 15-29 18" />
        </g>
        <path d="m263 269 26-4 12 57-42 8-10-29Z" fill="#d4fb65" stroke="#242c20" strokeWidth="3" />
        <circle cx="273" cy="247" r="18" fill="#242c20" />
        <path d="m258 242 28-8" stroke="#d4fb65" strokeWidth="5" />
        <path d="m193 323 12 14m98 67 18 3" stroke="#242c20" strokeWidth="10" strokeLinecap="round" />
        <g fill="#4e5943" fontFamily="monospace" fontSize="12">
          <text x="108" y="490">
            01 / START
          </text>
          <text x="386" y="52">
            TOP / 04
          </text>
        </g>
        <circle cx="426" cy="94" r="44" fill="none" stroke="#86976b" strokeWidth="1" strokeDasharray="3 5" />
      </svg>
      <div className="art-tag">
        <span className="live-dot" /> ONE MORE TRY.<span>↗</span>
      </div>
      <div className="art-sticker">
        ALL
        <br />
        LEVELS
        <br />
        <span>WELCOME</span>
      </div>
    </div>
  );
}
