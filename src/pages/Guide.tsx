import {ArrowUpRight, BookOpen} from 'lucide-react';
import {Link} from 'react-router-dom';
import '@/styles/guide.css';

const topics = [
  {id: 'membership', label: '가입 안내', summary: '카카오 모든 공동체가 함께해요'},
  {id: 'dues', label: '회비', summary: '월 2만 원 · 소속별 납부 방식 확인'},
  {id: 'meetups', label: '모임', summary: '매월 마지막 금요일 정기모임'},
  {id: 'support', label: '지원·정산', summary: '소모임 4명 이상 · 전날까지 등록'},
  {id: 'faq', label: 'FAQ·기타 활동', summary: '준비물부터 체험 신청까지'},
];

function External({href, children}: {href: string; children: React.ReactNode}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={14} aria-hidden="true" />
      <span className="guide-sr"> (새 창)</span>
    </a>
  );
}

export function GuideHighlights() {
  return (
    <section className="guide-highlights" aria-labelledby="guide-highlights-title">
      <div className="guide-heading">
        <div>
          <span className="guide-eyebrow">
            <BookOpen size={16} aria-hidden="true" /> 처음이라면 먼저 읽어주세요
          </span>
          <h2 id="guide-highlights-title">크루라이머 이용 안내</h2>
          <p>함께 운동하기 전에 알아두면 좋은 약속들.</p>
        </div>
        <Link className="button button-outline button-small" to="/guide">
          전체 안내 <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="guide-shortcuts">
        {topics.slice(1, 4).map(topic => (
          <Link key={topic.id} to={`/guide#${topic.id}`}>
            <strong>{topic.label}</strong>
            <span>{topic.summary}</span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function Guide() {
  return (
    <div className="page-shell guide-page">
      <header className="guide-intro">
        <span className="pill">
          <BookOpen size={14} aria-hidden="true" /> 크루의 약속
        </span>
        <h1>크루라이머 이용 안내</h1>
        <p>
          가입부터 함께 운동하고 정산하기까지.
          <br />
          크루라이머 회원이라면 알아두어야 할 운영 기준을 모았어요.
        </p>
        <p className="guide-source">기존 운영 시트 기준 · 문의: ed.el / eddie.joon / ellie.00</p>
      </header>
      <nav className="guide-toc" aria-label="이용 안내 목차">
        {topics.map((topic, i) => (
          <a key={topic.id} href={`#${topic.id}`}>
            <span>0{i + 1}</span>
            {topic.label}
          </a>
        ))}
      </nav>
      <div className="guide-sections">
        <section id="membership">
          <h2>01 가입 안내</h2>
          <p>카카오 모든 공동체를 회원으로 받고 있으며, 회비를 납부하는 경우에만 동호회 회원으로 인정합니다.</p>
          <ol>
            <li>카카오 소속은 마이카카오 → 동호회 → 크루라이머에서 가입을 요청해주세요.</li>
            <li>
              <External href="https://forms.gle/BVd7EU4ie3LhdC6p8">동호회 회원가입 폼</External>을 작성해주세요.
            </li>
            <li>급여 공제 대상이 아닌 공동체 회원은 아래 회비 안내에 따라 자동이체를 설정해주세요.</li>
            <li>ed.el에게 연락해 단톡방 초대 링크를 받아 입장해주세요.</li>
          </ol>
          <p className="guide-note">이 사이트의 계정 가입과 동호회 가입 절차는 별개입니다.</p>
        </section>
        <section id="dues">
          <h2>02 회비</h2>
          <div className="guide-facts">
            <div>
              <h3>카카오·엔터프라이즈</h3>
              <p>
                매월 <strong>2만 원</strong>
                <br />
                개인 급여에서 공제
              </p>
            </div>
            <div>
              <h3>그 외 공동체</h3>
              <p>
                매월 <strong>26일 · 2만 원</strong>
                <br />
                회비 계좌로 자동이체
              </p>
            </div>
          </div>
          <p>매월 26일에 다음 달 활동비를 납부하는 구조입니다. 회비 미납 시 운영상 불이익이 있을 수 있습니다.</p>
          <p>회비 계좌는 기존 운영 시트 또는 운영진에게 확인해주세요.</p>
        </section>
        <section id="meetups">
          <h2>03 함께 운동해요</h2>
          <h3>정기모임</h3>
          <p>
            운영진이 주최하는 공식 일정으로, 매월 놀금(마지막 금요일)에 진행합니다. 해당 주 투표로 장소를 정하고,
            14시~19시 사이에 자유롭게 와서 운동합니다. 희망자는 운동 후 저녁 식사에도 함께해요.
          </p>
          <p>신규 회원·체험 희망자를 위한 운영진 강습은 16시경부터 진행합니다.</p>
          <h3>소모임</h3>
          <p>회원 누구나 모임을 열 수 있습니다. 단톡방 일정에서 참여를 누르고, 서로 다른 퇴근 시간을 배려해주세요.</p>
          <ol>
            <li>최소 전날까지 단톡방 일정에 암장과 모임을 등록합니다.</li>
            <li>당일 참여 인원 전원이 나오도록 단체사진을 찍어 단톡방에 올립니다.</li>
            <li>
              모임 후 주최자가 <External href="https://forms.gle/VhHUUyghAa2fWu5C9">소모임 등록 폼</External>을
              작성합니다.
            </li>
          </ol>
          <p>비회원 게스트도 참여할 수 있어요. 단체결제 시 주최자에게 꼭 알려주세요.</p>
        </section>
        <section id="support">
          <h2>04 지원·정산 기준</h2>
          <h3>암장비 지원</h3>
          <p>
            기존 안내 기준: “소모임/정기모임 1회 2만 원을 지원합니다.” 개인이 먼저 결제하고 정산 후 환급받는 방식입니다.
            단체 할인 암장은 운영진이 별도로 취합합니다.
          </p>
          <p>
            교류전·내부행사 대관 시에는 대관비로 사용됩니다. 대관 행사에 참여한 달은 정기모임에 함께 참여해도 별도
            암장비 지원이 없다는 예시가 있습니다.
          </p>
          <p className="guide-note">지원 횟수와 한도 적용이 궁금하다면 정산 전에 운영진에게 확인해주세요.</p>
          <h3>소모임 정산 체크</h3>
          <ul>
            <li>
              <strong>4명 이상</strong> 모여야 정산 대상입니다. 4명 미만으로 운동하는 것은 자유입니다.
            </li>
            <li>
              <strong>최소 전날까지</strong> 일정을 등록해주세요. 당일 등록은 월말 정산에서 제외됩니다.
            </li>
            <li>
              참여자 전원이 나온 <strong>단체사진</strong>을 단톡방에 올려주세요.
            </li>
            <li>
              <strong>소모임 등록 폼</strong>을 제출해야 정산에 포함됩니다.
            </li>
          </ul>
        </section>
        <section id="faq">
          <h2>05 FAQ·기타 활동</h2>
          <details open>
            <summary>처음인데 잘 적응할 수 있을까요?</summary>
            <p>
              자유롭게 참여해서 운동하는 분위기예요. 외향적인 회원도, 내향적인 회원도 있으며 신규 회원의 적응을 돕는
              제도를 운영합니다.
            </p>
          </details>
          <details>
            <summary>얼마나 자주 모이나요?</summary>
            <p>참여는 자유이며, 평균적으로 매주 한 번 정도 모임이 열립니다.</p>
          </details>
          <details>
            <summary>장비는 무엇을 준비하나요?</summary>
            <p>
              편한 운동복과 암벽화가 필요합니다. 암벽화는 개인 구매하거나 암장에서 대여할 수 있어요. 기존 안내상
              대여비는 약 5천 원이며 암장별로 다를 수 있습니다.
            </p>
          </details>
          <details>
            <summary>입장료는 어떻게 결제하나요?</summary>
            <p>개인이 먼저 결제하고 매월 정산 후 환급받습니다. 단체 할인이 적용되는 곳은 운영진 안내를 따라주세요.</p>
          </details>
          <h3>운동 밖에서도 함께해요</h3>
          <ul>
            <li>교류전: 비정기적으로 다른 회사와 함께 운동합니다.</li>
            <li>원데이 클래스: 입문·기술 교육 등 주제별 내부 강의입니다.</li>
            <li>
              굿즈: <External href="https://crewlink.kr/product/list.html?cate_no=1334">티셔츠 구매</External> ·
              후드집업과 키링은 운영진에게 문의해주세요.
            </li>
            <li>
              체험 신청: <External href="https://open.kakao.com/o/glm9tAUh">체험·비회원 오픈채팅</External>
            </li>
          </ul>
        </section>
      </div>
      <footer className="guide-footer">
        <p>자세한 문의는 ed.el / eddie.joon / ellie.00에게 연락해주세요.</p>
        <External href="https://docs.google.com/spreadsheets/d/1jR1XEkqWteiWexQyiwp0gcnVd2ZyKtceyl_htu3yliE/edit?gid=2018781381#gid=2018781381">
          기존 운영 시트 확인
        </External>
        <a href="#main">맨 위로 ↑</a>
      </footer>
    </div>
  );
}
