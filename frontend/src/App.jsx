import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireRole, homeFor, useAuth } from './components/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';

// Every page except Login is code-split so the first paint only ships what it needs.
const Verify = lazy(() => import('./pages/Verify.jsx'));
const Invite = lazy(() => import('./pages/Invite.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const Users = lazy(() => import('./pages/admin/Users.jsx'));
const Questions = lazy(() => import('./pages/admin/Questions.jsx'));
const Audit = lazy(() => import('./pages/admin/Audit.jsx'));
const ProctorDashboard = lazy(() => import('./pages/proctor/ProctorDashboard.jsx'));
const Candidates = lazy(() => import('./pages/proctor/Candidates.jsx'));
const Sessions = lazy(() => import('./pages/proctor/Sessions.jsx'));
const NewSession = lazy(() => import('./pages/proctor/NewSession.jsx'));
const SessionDetail = lazy(() => import('./pages/proctor/SessionDetail.jsx'));
const ProctorQuestionBank = lazy(() => import('./pages/proctor/QuestionBank.jsx'));
const CandidateHome = lazy(() => import('./pages/candidate/CandidateHome.jsx'));
const Result = lazy(() => import('./pages/candidate/Result.jsx'));
// Owned by the test-runner worker; heavy (editor, pyodide, sql.js) so it is code-split.
const TestRunner = lazy(() => import('./pages/candidate/TestRunner.jsx'));

function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}

const Fallback = () => <div className="page"><Spinner label="Loading…" /></div>;

export default function App() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify/:code" element={<Verify />} />
        <Route path="/t/:token" element={<Invite />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        <Route element={<RequireRole roles={['admin']}><Layout /></RequireRole>}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/questions" element={<Questions />} />
          <Route path="/admin/audit" element={<Audit />} />
        </Route>

        <Route element={<RequireRole roles={['proctor', 'admin']}><Layout /></RequireRole>}>
          <Route path="/proctor" element={<ProctorDashboard />} />
          <Route path="/proctor/sessions" element={<Sessions />} />
          <Route path="/proctor/sessions/new" element={<NewSession />} />
          <Route path="/proctor/sessions/:id" element={<SessionDetail />} />
          <Route path="/proctor/candidates" element={<Candidates />} />
          <Route path="/proctor/questions" element={<ProctorQuestionBank />} />
        </Route>

        <Route element={<RequireRole roles={['candidate']}><Layout /></RequireRole>}>
          <Route path="/candidate" element={<CandidateHome />} />
        </Route>

        <Route path="/test/:attemptId" element={<RequireRole roles={['candidate']}><TestRunner /></RequireRole>} />
        <Route path="/result/:attemptId" element={<RequireRole roles={['candidate']}><Layout /></RequireRole>}>
          <Route index element={<Result />} />
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Suspense>
  );
}
