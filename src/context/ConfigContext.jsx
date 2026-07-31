import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { config as configApi } from '../api/endpoints';

/**
 * Platform configuration, loaded once at boot.
 *
 * Branding, the stage journey, and user-visible copy are all owned by an
 * administrator in the Django Admin panel. Nothing here is hard-coded in
 * the client: an admin renames the product, reorders the journey or
 * rewords a message and the UI follows on the next load.
 *
 * The fallbacks below exist only so the app renders something sensible if
 * the config endpoint is unreachable — they are never the source of truth.
 */

const FALLBACK_BRAND = {
  productName: 'Silk',
  browserTitle: 'Silk',
  tagline: '',
  // The product marks ship with the build, so the app is branded even
  // before an administrator sets anything (and if /config/app is briefly
  // unreachable). An admin-supplied URL always overrides these.
  logoUrl: '/brand/silk-logo.svg',
  logoMonoUrl: '/brand/silk-logo-white.svg',
  primaryColor: '#1F6F4A',
};

const FALLBACK_STAGES = [
  { stageNo: 0, stageKey: 'foundation', label: 'Foundation', isImplemented: true, prerequisites: [] },
  { stageNo: 1, stageKey: 'company_profile', label: 'Company Profile', isImplemented: true, prerequisites: [] },
  { stageNo: 2, stageKey: 'fundraising_strategy', label: 'Fundraising Strategy', isImplemented: true, prerequisites: [] },
  { stageNo: 3, stageKey: 'investor_discovery', label: 'Investor Discovery', isImplemented: false, prerequisites: [] },
  { stageNo: 4, stageKey: 'outreach', label: 'Outreach', isImplemented: false, prerequisites: [] },
  { stageNo: 5, stageKey: 'term_sheets', label: 'Term Sheets', isImplemented: false, prerequisites: [] },
  { stageNo: 6, stageKey: 'due_diligence', label: 'Due Diligence', isImplemented: false, prerequisites: [] },
  { stageNo: 7, stageKey: 'definitive_documents', label: 'Definitive Documents', isImplemented: false, prerequisites: [] },
  { stageNo: 8, stageKey: 'closing', label: 'Closing', isImplemented: false, prerequisites: [] },
];

const ConfigContext = createContext({
  brand: FALLBACK_BRAND,
  stages: FALLBACK_STAGES,
  copy: () => '',
  loading: true,
});

export function ConfigProvider({ children }) {
  const [brand, setBrand] = useState(FALLBACK_BRAND);
  const [stages, setStages] = useState(FALLBACK_STAGES);
  const [copyMap, setCopyMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [app, ui] = await Promise.all([
          configApi.app().catch(() => null),
          configApi.uiCopy().catch(() => null),
        ]);
        if (cancelled) return;
        if (app?.brand) setBrand({ ...FALLBACK_BRAND, ...app.brand });
        if (app?.stages?.length) setStages(app.stages);
        if (ui?.items) setCopyMap(ui.items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Browser title and theme colour follow the admin's branding.
  useEffect(() => {
    if (brand.browserTitle) document.title = brand.browserTitle;
    if (brand.primaryColor) {
      document.documentElement.style.setProperty('--brand', brand.primaryColor);
    }
    if (brand.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = brand.faviconUrl;
    }
  }, [brand]);

  const value = useMemo(() => ({
    brand,
    stages,
    loading,
    /** Admin-editable string, with a code default when unset. */
    copy: (key, fallback = '') => copyMap[key] ?? fallback,
    stage: (n) => stages.find((s) => s.stageNo === n) || null,
    stageLabel: (n) => stages.find((s) => s.stageNo === n)?.label || `Stage ${n}`,
  }), [brand, stages, copyMap, loading]);

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export const useConfig = () => useContext(ConfigContext);
