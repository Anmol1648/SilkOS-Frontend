import { Navigate } from 'react-router-dom';
import { useDeal } from '../context/DealContext';

/**
 * Stage 1 moved from the deal to the company (C1 — the Company Profile
 * describes the company, not a particular raise). Anyone arriving on the
 * old /deals/:id/stage/1 path is forwarded to the company profile.
 */
export default function StageOneRedirect() {
  const { context } = useDeal();
  const companyId = context?.companyId;
  if (!companyId) return <Navigate to="/dashboard" replace />;
  return <Navigate to={`/companies/${companyId}/profile`} replace />;
}
