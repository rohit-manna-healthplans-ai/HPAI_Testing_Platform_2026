import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Badge, Spinner, useAsync } from '../components/ui.jsx';
import { fmtDay } from '../utils/format.js';

export default function Verify() {
  const { code } = useParams();
  const { loading, data, error } = useAsync(() => api.verifyCertificate(code), [code]);
  const valid = data?.valid;
  return (
    <div className="login-screen">
      <div className="login-card verify-card">
        <img src="/logo.png" alt="HPAI" />
        <h1>Certificate verification</h1>
        <p className="sub mono">{code}</p>
        {loading && <Spinner label="Checking…" />}
        {!loading && (error || !valid) && (
          <div className="alert alert-error" role="alert" style={{ justifyContent: 'center' }}>
            {error && error.status !== 404 ? error.message : 'No certificate found with this code.'}
          </div>
        )}
        {!loading && valid && (
          <div className="stack">
            <div><Badge tone="green">✓ Valid certificate</Badge></div>
            <h2>{data.name}</h2>
            <p className="muted">has completed the <b>HPAI Testing Assessment</b></p>
            <div className="score-big" style={{ fontSize: 46 }}>{data.score}<small>/{data.max}</small></div>
            <p className="muted small">{data.percentage}% · Issued {fmtDay(data.issued_at)}</p>
          </div>
        )}
        <p style={{ marginTop: 22 }}><Link to="/login" className="small">Go to platform</Link></p>
      </div>
    </div>
  );
}
