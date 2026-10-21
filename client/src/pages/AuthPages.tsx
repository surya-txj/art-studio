import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ErrorBox } from '../components/Status';

function useAfterLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return (role: string) => {
    const home = role === 'studio' ? '/studio' : '/';
    // Only return to the previous page if this role can actually open it.
    const studioOnly = from?.startsWith('/studio');
    const customerOnly = from && ['/account', '/wall-booking', '/pottery'].some((p) => from.startsWith(p));
    const allowed = from && !(role === 'studio' ? customerOnly : studioOnly);
    navigate(allowed ? from : home, { replace: true });
  };
}

export function LoginPage() {
  const { login } = useAuth();
  const goNext = useAfterLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(email, password);
      goNext(user.role);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="narrow">
      <h1>Log in</h1>
      <form onSubmit={onSubmit} className="form">
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && <ErrorBox message={error} />}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p>
        New here? <Link to="/register">Create a customer account</Link>
      </p>
    </section>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const goNext = useAfterLogin();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await register(name, email, password);
      goNext(user.role);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="narrow">
      <h1>Create a customer account</h1>
      <form onSubmit={onSubmit} className="form">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Password <span className="muted">(at least 8 characters)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        {error && <ErrorBox message={error} />}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
