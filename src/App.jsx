import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, ConfirmProvider, ToastProvider, useAuth } from './context/AppContext';
import { ConfigProvider } from './context/ConfigContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DealLayout from './pages/DealLayout';
import CompanyLayout from './pages/CompanyLayout';
import CompanyStrategy from './pages/CompanyStrategy';
import Home from './pages/Home';
import CkbPage from './pages/Ckb';
import Members from './pages/Members';
import CompanyProfile from './pages/profile/CompanyProfile';
import Stage2 from './pages/stage2/Stage2';
import Stage3Hub from './pages/stage3/Stage3';
import Stage3Doc from './pages/stage3/Documents';
import StageOneRedirect from './pages/StageOneRedirect';

function RequireAuth({ children }) {
  const { isAuthed } = useAuth();
  return isAuthed ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ConfigProvider>
          <ToastProvider>
            <ConfirmProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />

                {/* Dashboard — the landing page after login (PRD §4). */}
                <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />

                {/* Company-scoped routes (C1): a company is independent of any
                    deal and may hold several concurrent raises, so the profile
                    and strategy hang off the company. */}
                <Route path="/companies/:companyId" element={<RequireAuth><CompanyLayout /></RequireAuth>}>
                  <Route index element={<Navigate to="profile" replace />} />
                  <Route path="profile" element={<CompanyProfile />} />
                  <Route path="strategy" element={<CompanyStrategy />} />
                </Route>

                {/* Deal-scoped workspace. */}
                <Route path="/deals/:dealId" element={<RequireAuth><DealLayout /></RequireAuth>}>
                  <Route index element={<Home />} />
                  <Route path="ckb" element={<CkbPage />} />
                  <Route path="members" element={<Members />} />
                  {/* Stage 1 is now the company-scoped Company Profile —
                      anyone landing on the old deal path is forwarded. */}
                  <Route path="stage/1" element={<StageOneRedirect />} />
                  <Route path="stage/2" element={<Stage2 />} />
                  <Route path="stage/3" element={<Stage3Hub />} />
                  <Route path="stage/3/:doc" element={<Stage3Doc />} />
                </Route>

                {/* Legacy paths kept alive for one release so existing
                    bookmarks and shared links don't break. */}
                <Route path="/start" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
            </ConfirmProvider>
          </ToastProvider>
        </ConfigProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
