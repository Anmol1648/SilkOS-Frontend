import { useEffect, useState } from 'react';
import { useDeal } from '../context/DealContext';
import { useToast, useConfirm } from '../context/AppContext';
import { deal as dealApi } from '../api/endpoints';
import { Pill, SkeletonCard } from '../components/ui';
import { titleCase } from '../lib/format';

const ROLES = ['co_founder', 'team', 'advisor', 'banker', 'board_member'];

export default function Members() {
  const { dealId, context } = useDeal();
  const { toast, error: toastError } = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [form, setForm] = useState({ email: '', role: 'co_founder' });
  const [busy, setBusy] = useState(false);
  const isOwner = ['founder', 'owner'].includes(context?.role);

  const load = () => dealApi.members(dealId).then((r) => setItems(r.items || [])).catch(() => setItems([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [dealId]);

  async function invite(e) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(form.email)) { toastError('Enter a valid email.'); return; }
    setBusy(true);
    try {
      await dealApi.invite(dealId, form);
      toast(`Invited ${form.email} — membership is pending until their first sign-in.`);
      setForm({ email: '', role: 'co_founder' });
      load();
    } catch (ex) { toastError(ex); }
    finally { setBusy(false); }
  }

  async function remove(userId, email) {
    if (!(await confirm({
      title: 'Remove member',
      message: `Remove ${email} from this deal?`,
      confirmLabel: 'Remove', tone: 'danger',
    }))) return;
    try { await dealApi.removeMember(dealId, userId); toast('Member removed.'); load(); }
    catch (ex) { toastError(ex); }
  }

  return (
    <>
      <div className="eyebrow">Deal settings</div>
      <h1>Members</h1>
      <p className="section-note">Invite co-founders, advisors or bankers by email. Roles govern what each person can edit and approve.</p>

      {isOwner && (
        <form className="card" onSubmit={invite} style={{ marginBottom: 16 }}>
          <h3>Invite someone</h3>
          <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label className="field" style={{ flex: 2, minWidth: 220, marginBottom: 0 }}>
              <span>Email</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="cfo@acme.ai" />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
              <span>Role</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
              </select>
            </label>
            <button className="btn btn-primary" disabled={busy}>Send invite</button>
          </div>
        </form>
      )}

      {items === null ? <SkeletonCard /> : (
        <div className="card">
          <table className="data">
            <thead><tr><th>Email</th><th>Role</th><th>Status</th>{isOwner && <th />}</tr></thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.userId || m.email}>
                  <td>{m.email}</td>
                  <td>{titleCase(m.role)}</td>
                  <td><Pill value={m.status} /></td>
                  {isOwner && (
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(m.userId, m.email)}>Remove</button>
                    </td>
                  )}
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={4} className="hint">Just you so far.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
