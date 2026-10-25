import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export function NotFound() {
  useEffect(() => {
    document.title = 'Page not found — StyledByC';
  }, []);
  const navigate = useNavigate();

  return (
    <main className="not-found" id="content">
      <div className="container">
        <div className="not-found-card">
          <h1>404</h1>
          <p>
            We couldn&rsquo;t find the page you&rsquo;re looking for.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/')}
          >
            Back to home
          </button>
        </div>
      </div>
    </main>
  );
}
