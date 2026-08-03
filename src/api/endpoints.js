// ---------------------------------------------------------------------------
// One binding per backend endpoint, verified against fundos/urls.py and the
// delivered views. Deal-scoped calls take dealId first.
// ---------------------------------------------------------------------------
import { api, get, post, put, patch, del } from './client';

// ---- Auth & identity (M0) --------------------------------------------------
export const auth = {
  signup: (body) => post('/auth/signup', body, { auth: false }),                 // {email,name?,companyName?} → 202
  requestOtp: (email) => post('/auth/otp/request', { email }, { auth: false }),
  verifyOtp: (email, code) => post('/auth/otp/verify', { email, code }, { auth: false }), // field is `code`
};

export const me = {
  contexts: () => get('/me/contexts'),                                           // {items:[{dealId,dealName,companyId,companyName,role}]}
  switchContext: (dealId) => post('/contexts/switch', { dealId }),
  notifications: () => get('/notifications'),
  markRead: (id) => post(`/notifications/${id}/read`, {}),
};

// ---- Onboarding (G2) -------------------------------------------------------
export const companies = {
  list: () => get('/companies'),
  create: (body) => post('/companies', body),                                    // {name, domain?, hqCountry?}
  deals: (companyId) => get(`/companies/${companyId}/deals`),
  createDeal: (companyId, body) => post(`/companies/${companyId}/deals`, body), // {name, roundType}
  remove: (companyId) => del(`/companies/${companyId}`),                        // DELETE — cascades everything
  updateLogo: (companyId, body) => patch(`/companies/${companyId}/logo`, body), // {logoBase64}
};

// ---- Deal navigation (M0) --------------------------------------------------
export const deal = {
  masterplan: (d) => get(`/deals/${d}/masterplan`),
  stageState: (d) => get(`/deals/${d}/stage-state`),
  dashboard: (d) => get(`/deals/${d}/dashboard`),
  overrideStage: (d, n) => post(`/deals/${d}/stages/${n}/override`, { confirm: true }),
  job: (d, jobId) => get(`/deals/${d}/jobs/${jobId}`),
  members: (d) => get(`/deals/${d}/members`),
  invite: (d, body) => post(`/deals/${d}/members`, body),                        // {email, role}
  removeMember: (d, userId) => del(`/deals/${d}/members/${userId}`),
};

// ---- CKB (M0) ---------------------------------------------------------------
export const ckb = {
  read: (d) => get(`/deals/${d}/ckb`),                                           // {completenessPct, groups:{...}}
  // Founder edit — sets verified; response {field, warnings[]} (soft, advisory)
  setField: (d, key, body) => patch(`/deals/${d}/ckb/fields/${encodeURIComponent(key)}`, body),
  // Accept / reject a parked AI suggestion (BR-M0-011)
  suggestionAction: (d, key, action) =>
    patch(`/deals/${d}/ckb/fields/${encodeURIComponent(key)}`, { action }),
  assign: (d, body) => post(`/deals/${d}/ckb/assign`, body),
};

// ---- Stage 1 ----------------------------------------------------------------
export const stage1 = {
  runResearch: (d, sources) => post(`/deals/${d}/research/run`, sources?.length ? { sources } : {}, { idempotent: true }),
  researchSources: (d) => get(`/deals/${d}/research/sources`),
  materials: (d) => get(`/deals/${d}/materials`),
  uploadMaterial: (d, file, category) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    return api(`/deals/${d}/materials`, { method: 'POST', formData: fd });
  },
  material: (d, mid) => get(`/deals/${d}/materials/${mid}`),
  setMaterialAction: (d, mid, aiStatus) => patch(`/deals/${d}/materials/${mid}`, { aiStatus }),
  // chunked / resumable large uploads (BR-M1-023)
  startUploadSession: (d, meta) => post(`/deals/${d}/uploads/sessions`, meta),
  putChunk: (d, sid, n, blob) => api(`/deals/${d}/uploads/sessions/${sid}/chunks/${n}`, { method: 'PUT', rawBody: blob }),
  completeUpload: (d, sid) => post(`/deals/${d}/uploads/sessions/${sid}/complete`, {}),
  generateReadiness: (d) => post(`/deals/${d}/readiness/generate`, {}, { idempotent: true }),
  readiness: (d) => get(`/deals/${d}/readiness`),
  gaps: (d) => get(`/deals/${d}/readiness/gaps`),
  gapAction: (d, gid, founderAction) => post(`/deals/${d}/readiness/gaps/${gid}/action`, { founderAction }),
  readinessReport: (d) => get(`/deals/${d}/readiness/report`),
};

// ---- Stage 2 ----------------------------------------------------------------
export const stage2 = {
  objectives: (d) => get(`/deals/${d}/strategy/objectives`),
  saveObjectives: (d, body) => put(`/deals/${d}/strategy/objectives`, body),     // PUT upsert (verified)
  generatePeers: (d) => post(`/deals/${d}/strategy/peers/generate`, {}, { idempotent: true }),
  peers: (d) => get(`/deals/${d}/strategy/peers`),
  curatePeer: (d, body) => post(`/deals/${d}/strategy/peers/curate`, body),      // {action:add|remove|approve,...}
  peerDetail: (d, pid) => get(`/deals/${d}/strategy/peers/${pid}`),
  generateRaise: (d) => post(`/deals/${d}/strategy/raise/generate`, {}, { idempotent: true }),
  raise: (d) => get(`/deals/${d}/strategy/raise`),
  selectScenario: (d, scenarioId) => patch(`/deals/${d}/strategy/raise/scenario`, { scenarioId, selected: true }),
  generateValuation: (d) => post(`/deals/${d}/strategy/valuation/generate`, {}, { idempotent: true }),
  valuation: (d) => get(`/deals/${d}/strategy/valuation`),
  instruments: (d) => get(`/deals/${d}/strategy/instruments`),
  // BUG-017: the backend generator existed but had no UI entry point.
  generateInstruments: (d) => post(`/deals/${d}/strategy/instruments`, {}, { idempotent: true }),
  selectInstrument: (d, iid) => patch(`/deals/${d}/strategy/instruments/${iid}`, { selected: true }),
  // verified body shape: USD numbers (strategy/views.py DilutionSimulateView)
  simulateDilution: (d, body) => post(`/deals/${d}/strategy/dilution/simulate`, body, { idempotent: true }),
  generateBlueprint: (d) => post(`/deals/${d}/strategy/blueprint/generate`, {}, { idempotent: true }),
  blueprint: (d) => get(`/deals/${d}/strategy/blueprint`),
  approve: (d, body) => post(`/deals/${d}/strategy/approve`, body, { idempotent: true }),
  profile: (d) => get(`/deals/${d}/strategy/profile`),
  strategyReport: (d) => get(`/deals/${d}/strategy/report`),
};

// ---- Stage 3 ----------------------------------------------------------------
export const stage3 = {
  workspace: (d) => get(`/deals/${d}/workspace`),                                // 423 until Strategy approved
  generateStory: (d) => post(`/deals/${d}/story/generate`, {}, { idempotent: true }),
  story: (d) => get(`/deals/${d}/story`),
  approveStory: (d, selectedPositioningId) => post(`/deals/${d}/story/approve`, { selectedPositioningId }),
  generateTeaser: (d, body) => post(`/deals/${d}/teaser/generate`, body || {}, { idempotent: true }),
  teaser: (d) => get(`/deals/${d}/teaser`),
  exportTeaser: (d, format) => post(`/deals/${d}/teaser/export`, { format }),
  deckOutlineGenerate: (d, body) => post(`/deals/${d}/deck/outline`, body || {}, { idempotent: true }),
  deckOutline: (d) => get(`/deals/${d}/deck/outline`),
  approveOutline: (d) => post(`/deals/${d}/deck/approve-outline`, {}),
  generateSlides: (d) => post(`/deals/${d}/deck/slides`, {}, { idempotent: true }),
  slides: (d) => get(`/deals/${d}/deck/slides`),
  exportDeck: (d, format) => post(`/deals/${d}/deck/export`, { format }),
  generateModel: (d, body) => post(`/deals/${d}/model/generate`, body || {}, { idempotent: true }),
  modelStatements: (d, scenario = 'base') => get(`/deals/${d}/model/statements?scenario=${scenario}`),
  modelAssumptions: (d) => get(`/deals/${d}/model/assumptions`),
  patchAssumption: (d, body) => patch(`/deals/${d}/model/assumptions`, body),    // {group, key, value}
  exportModel: (d, format) => post(`/deals/${d}/model/export`, { format }),
  generateIm: (d, body) => post(`/deals/${d}/im/generate`, body || {}, { idempotent: true }),
  im: (d) => get(`/deals/${d}/im`),
  exportIm: (d, format) => post(`/deals/${d}/im/export`, { format }),
  runReview: (d) => post(`/deals/${d}/review/run`, {}, { idempotent: true }),
  review: (d) => get(`/deals/${d}/review`),
  reviewReport: (d) => get(`/deals/${d}/review/report`),
  approvePackage: (d) => post(`/deals/${d}/package/approve`, {}, { idempotent: true }),
  package: (d) => get(`/deals/${d}/package`),
};

// ---- Platform configuration (admin-owned; read-only to the client) ---------
// Everything here is configured by an administrator in the Django Admin
// panel. The client renders whatever it is given rather than hard-coding
// branding, stage numbering, labels or reference data.
export const config = {
  app: () => api('/config/app', { auth: false }),                 // {brand, stages}
  countries: () => api('/config/countries', { auth: false }),     // {items:[...]}
  buckets: () => get('/config/buckets'),                          // seven fund-raise values
  profileSections: () => get('/config/profile-sections'),
  uiCopy: () => api('/config/ui-copy', { auth: false }),
};

// ---- Stage 1: Company Profile (company-scoped per C1) ----------------------
// A company is an independent entity: it may have no deal, or several
// concurrent ones. The profile therefore hangs off the company.
export const profile = {
  read: (c) => get(`/companies/${c}/profile`),
  onboard: (c, body) => post(`/companies/${c}/profile/onboard`, body, { idempotent: true }),
  confirmReview: (c) => post(`/companies/${c}/profile/review`, {}),
  deepGenerate: (c) => post(`/companies/${c}/profile/deep-generate`, {}, { idempotent: true }),
  ask: (c, question) => post(`/companies/${c}/profile/qa`, { question }),
  saveSection: (c, key, body) =>
    patch(`/companies/${c}/profile/sections/${encodeURIComponent(key)}`, body),
  regenerateSection: (c, key, force = false) =>
    post(`/companies/${c}/profile/sections/${encodeURIComponent(key)}/regenerate`,
      { force }, { idempotent: true }),
  sectionHistory: (c, key) =>
    get(`/companies/${c}/profile/sections/${encodeURIComponent(key)}/history`),
  addFounder: (c, body) => post(`/companies/${c}/founders`, body),
  updateFounder: (c, id, body) => patch(`/companies/${c}/founders/${id}`, body),
  removeFounder: (c, id) => del(`/companies/${c}/founders/${id}`),
  // Generic list-record CRUD (Key People, Competitors, Funding History,
  // Recent News) — one endpoint family, keyed by sectionKey. Mirrors the
  // founder verbs; the backend validates each record type.
  addRecord: (c, sectionKey, body) =>
    post(`/companies/${c}/profile/records/${encodeURIComponent(sectionKey)}`, body),
  updateRecord: (c, sectionKey, id, body) =>
    patch(`/companies/${c}/profile/records/${encodeURIComponent(sectionKey)}/${id}`, body),
  removeRecord: (c, sectionKey, id) =>
    del(`/companies/${c}/profile/records/${encodeURIComponent(sectionKey)}/${id}`),
  // Numeric/structured forms — Revenue Model, Company Metrics, Financial
  // Summary. Body is {items:[...]}; validated server-side (e.g. revenue
  // shares must total 100%).
  saveStructuredForm: (c, sectionKey, items) =>
    patch(`/companies/${c}/profile/sections/${encodeURIComponent(sectionKey)}/structured`,
      { items }),
  // Field-level AI regeneration — returns {status, fieldKey, value}; the
  // caller decides whether to accept the value into the form.
  regenerateField: (c, sectionKey, fieldKey) =>
    post(`/companies/${c}/profile/sections/${encodeURIComponent(sectionKey)}/fields/${encodeURIComponent(fieldKey)}/regenerate`,
      {}, { idempotent: true }),
  cashPosition: (c) => get(`/companies/${c}/cash-position`),
  saveCashPosition: (c, body) => post(`/companies/${c}/cash-position`, body),
  fundraiseRecommendation: (c) => get(`/companies/${c}/fundraise-recommendation`),
  // C6 — headline deal terms. Only the two inputs are sent; post-money and
  // dilution are calculated server-side and returned alongside them.
  // Resolves (creating if needed) the deal that company-scoped strategy
  // screens work against — the deal stays hidden from the founder.
  defaultDeal: (c) => get(`/companies/${c}/default-deal`),
  // Document Center uploads (multipart — the client sets no Content-Type
  // so the browser can add the multipart boundary).
  uploadDocument: (c, formData) =>
    api(`/companies/${c}/documents`, { method: 'POST', formData }),
  deleteDocument: (c, id) => del(`/companies/${c}/documents/${id}`),
  dealTargets: (c, query = '') => get(`/companies/${c}/deal-targets${query}`),
  saveDealTargets: (c, body) => post(`/companies/${c}/deal-targets`, body),
};
