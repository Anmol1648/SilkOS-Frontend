// ---------------------------------------------------------------------------
// useArtifact — the async-generation wrapper the screen spec asks to build
// once (§7): skeleton → generate (202 {jobId, poll}) → poll the JOB status
// endpoint → on success, fetch the resource; on failure, surface the job's
// own error message.
//
// QA BUG-002 / BUG-014 / TC-100: the previous implementation polled the
// resource GET (which 404s until the artefact exists) and could not tell
// "still generating" from "the job failed" — failures span forever with no
// message. Every 202 from the backend carries `poll: /api/v1/deals/{d}/
// jobs/{jobId}`; this hook now uses it as documented.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, API_BASE, ApiError } from '../api/client';

const POLL_MS = 2200;
const POLL_LIMIT = 220; // ~8 minutes — real workers (research, models) can run long

/** Fetch a job-status URL as returned in a 202 body (absolute API path). */
async function fetchJob(pollUrl) {
  // `poll` arrives as "/api/v1/..." — the client prefixes API_BASE, so
  // strip a matching prefix before calling.
  let path = pollUrl || '';
  if (path.startsWith(API_BASE)) path = path.slice(API_BASE.length);
  else if (path.startsWith('/api/v1')) path = path.slice('/api/v1'.length);
  return api(path);
}

export function useArtifact(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);   // initial load
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);       // ApiError (incl. 423 gate)
  const [jobStatus, setJobStatus] = useState(null); // queued|running|succeeded|failed
  const alive = useRef(true);
  const pollTimer = useRef(null);

  const load = useCallback(async ({ silent } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetcher();
      if (!alive.current) return null;
      setData(res);
      setError(null);
      return res;
    } catch (e) {
      if (!alive.current) return null;
      if (e instanceof ApiError && e.isNotFound) setData(null); // not generated yet
      else setError(e);
      return null;
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; clearTimeout(pollTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  /**
   * Kick a generator. The action's 202 body ({jobId, jobStatus, poll}) is
   * used to poll the job itself; the resource is only fetched once the job
   * reports success. Falls back to resource polling for endpoints that
   * respond synchronously (201) without a job handle.
   */
  const generate = useCallback(async (action, { onDone, onError } = {}) => {
    setGenerating(true);
    setError(null);
    setJobStatus(null);
    const finishOk = async () => {
      const res = await load({ silent: true });
      setGenerating(false);
      setJobStatus('succeeded');
      if (res) onDone?.(res);
      return res;
    };
    const finishFail = (e) => {
      setGenerating(false);
      setJobStatus('failed');
      setError(e);
      onError?.(e);
    };
    try {
      const accepted = await action();
      const pollUrl = accepted?.poll;

      // Synchronous endpoints (201 with the artefact / no job handle).
      if (!pollUrl) { await finishOk(); return; }

      // Dev Celery runs eagerly, so the job may already be terminal.
      let tries = 0;
      const poll = async () => {
        if (!alive.current) return;
        let job = null;
        try { job = await fetchJob(pollUrl); }
        catch { /* transient — keep polling below */ }
        const status = job?.status || job?.jobStatus;
        if (status) setJobStatus(status);
        if (status === 'succeeded' || status === 'complete' || status === 'completed') {
          await finishOk();
          return;
        }
        if (status === 'failed' || status === 'error') {
          finishFail(new Error(job?.error
            || 'Generation failed — please review the earlier steps and try again.'));
          return;
        }
        if (++tries < POLL_LIMIT) {
          pollTimer.current = setTimeout(poll, POLL_MS);
        } else {
          // Never leave the user on an infinite spinner: stop, refresh the
          // resource in case it landed, and say so.
          const res = await load({ silent: true });
          setGenerating(false);
          if (res) { setJobStatus('succeeded'); onDone?.(res); }
          else {
            setJobStatus('timeout');
            onError?.(new Error('Generation is taking longer than expected — check back shortly.'));
          }
        }
      };
      poll();
    } catch (e) {
      finishFail(e);
    }
  }, [load]);

  return { data, loading, generating, error, jobStatus, reload: load, generate, setData };
}
