import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../api/types';
import { ErrorBox, Loading } from './Status';
import type { Feedback } from '../hooks/useAction';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    // Leave the private page first, so it doesn't redirect to login with a "return to" path.
    navigate('/');
    await logout();
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="Art Studio home">
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-name">Art Studio</span>
          </Link>
          <nav aria-label="Main">
            <NavLink to="/" end>
              Paintings
            </NavLink>
            {user?.role === 'customer' && (
              <>
                <NavLink to="/wall-booking">Book a wall</NavLink>
                <NavLink to="/pottery/new">Request pottery</NavLink>
                <NavLink to="/account">My account</NavLink>
              </>
            )}
            {user?.role === 'studio' && <NavLink to="/studio">Studio dashboard</NavLink>}
          </nav>
          <div className="session">
            {user ? (
              <>
                <span className="user-chip">
                  <span className="avatar" aria-hidden="true">
                    {user.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span>
                    {user.name} <span className="role-tag">· {user.role}</span>
                  </span>
                </span>
                <button type="button" className="secondary small" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login">Log in</NavLink>
                <Link to="/register" className="button small">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <span>Art Studio · Paintings, wall murals and handmade pottery</span>
          <span>Prices in INR</span>
        </div>
      </footer>
    </>
  );
}

/**
 * Sends logged-out visitors to the login page and shows a message for the
 * wrong role. This only shapes the UI; the API enforces the real rules.
 */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <ErrorBox message="You do not have permission to view this page." />;
  return <>{children}</>;
}

export function FeedbackMessage({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;
  return (
    <p className={`state state-${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>
      {feedback.text}
    </p>
  );
}
