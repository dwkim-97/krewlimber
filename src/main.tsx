import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter, Link, Route, Routes} from 'react-router-dom';
import {ClimbingRecords} from '@/pages/ClimbingRecords';
import {Admin} from '@/pages/Admin';
import {Auth} from '@/pages/Auth';
import {HallOfFame} from '@/pages/HallOfFame';
import {Home} from '@/pages/Home';
import {Me} from '@/pages/Me';
import {Members} from '@/pages/Members';
import {Notices, NoticeDetail, NoticeEditor} from '@/pages/Notices';
import {Market, ProductDetail} from '@/pages/Market';
import {MyOrders} from '@/pages/MyOrders';
import {ProductCreate, ProductEdit} from '@/pages/ProductCreate';
import {Layout} from '@/components/Layout';
import {Protected} from '@/components/Protected';
import {EmptyState} from '@/components/ui';
import {SessionProvider} from '@/components/SessionProvider';
import './styles.css';
import './styles/climbing.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route
              index
              element={
                <Protected access="member">
                  <Home />
                </Protected>
              }
            />
            <Route
              path="notices"
              element={
                <Protected access="member">
                  <Notices />
                </Protected>
              }
            />
            <Route
              path="notices/new"
              element={
                <Protected access="admin">
                  <NoticeEditor />
                </Protected>
              }
            />
            <Route
              path="notices/:id/edit"
              element={
                <Protected access="admin">
                  <NoticeEditor />
                </Protected>
              }
            />
            <Route
              path="notices/:id"
              element={
                <Protected access="member">
                  <NoticeDetail />
                </Protected>
              }
            />
            <Route
              path="market"
              element={
                <Protected access="member">
                  <Market />
                </Protected>
              }
            />
            <Route
              path="market/new"
              element={
                <Protected access="admin">
                  <ProductCreate />
                </Protected>
              }
            />
            <Route
              path="market/:id/edit"
              element={
                <Protected access="admin">
                  <ProductEdit />
                </Protected>
              }
            />
            <Route
              path="market/:id"
              element={
                <Protected access="member">
                  <ProductDetail />
                </Protected>
              }
            />
            <Route
              path="me/orders"
              element={
                <Protected access="member">
                  <MyOrders />
                </Protected>
              }
            />
            <Route
              path="climbs"
              element={
                <Protected access="member">
                  <ClimbingRecords />
                </Protected>
              }
            />
            <Route path="login" element={<Auth key="login" mode="login" />} />
            <Route path="signup" element={<Auth key="signup" mode="signup" />} />
            <Route path="recover" element={<Auth key="recover" mode="recover" />} />
            <Route
              path="hall-of-fame"
              element={
                <Protected access="member">
                  <HallOfFame />
                </Protected>
              }
            />
            <Route
              path="members"
              element={
                <Protected access="member">
                  <Members />
                </Protected>
              }
            />
            <Route
              path="me"
              element={
                <Protected access="user">
                  <Me />
                </Protected>
              }
            />
            <Route
              path="admin"
              element={
                <Protected access="admin">
                  <Admin />
                </Protected>
              }
            />
            <Route
              path="*"
              element={
                <div className="page-shell">
                  <EmptyState
                    title="잠깐, 루트를 벗어났어요"
                    description="찾으시는 페이지가 없거나 주소가 변경되었어요."
                  >
                    <Link to="/" className="button button-dark">
                      홈으로 돌아가기
                    </Link>
                  </EmptyState>
                </div>
              }
            />
          </Route>
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>
);
