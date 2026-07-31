// Lightweight guard for the exact bug class that shipped twice:
// a react-router-dom hook (or other named import) used but not imported.
// Not a full linter — just catches "used a symbol from a known module
// without importing it".
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROUTER_HOOKS = ['useParams','useNavigate','useSearchParams','useLocation','useMatch','Link','NavLink','Navigate','Outlet'];
const REACT_HOOKS  = ['useState','useEffect','useMemo','useCallback','useRef','useContext','useReducer','useLayoutEffect'];

function walk(dir, acc=[]) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e!=='node_modules') walk(p, acc); }
    else if (p.endsWith('.jsx') || p.endsWith('.js')) acc.push(p);
  }
  return acc;
}

let problems = 0;
for (const file of walk('src')) {
  const src = readFileSync(file, 'utf8');
  // strip comments crudely so a mention in a comment doesn't count
  const code = src.replace(/\/\/.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'');
  const importLines = code.split('\n').filter(l => l.trim().startsWith('import')).join('\n');
  for (const sym of [...ROUTER_HOOKS, ...REACT_HOOKS]) {
    const used = new RegExp(`(?<![\\w.])${sym}\\s*[({<]`).test(code);
    if (!used) continue;
    const imported = new RegExp(`import[^;]*\\b${sym}\\b[^;]*from`).test(importLines);
    if (!imported) { console.log(`UNDEF: ${sym} used but not imported in ${file}`); problems++; }
  }
}
console.log(problems ? `\n${problems} problem(s)` : 'clean — no undefined imports');
process.exit(problems ? 1 : 0);
