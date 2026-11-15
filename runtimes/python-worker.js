// Pyodide 314 requires a module worker; intentionally separate from classic JS runtimes.
import { loadPyodide } from './pyodide/pyodide.mjs';
self.onmessage = async ({data: {code, input = ''}}) => {
 let total = 0;
 const out = text => { text = String(text); total += text.length; if (total > 100000) throw Error('Output limit exceeded'); postMessage({type:'log',text}); };
 try {
  if (code.length > 1000000) throw Error('Input exceeds 1 MB limit');
  out('Loading local Pyodide 314.0.7…');
  const py = await loadPyodide({indexURL:new URL('./pyodide/', import.meta.url).href, stdout:out, stderr:s=>out('stderr: '+s)});
  const lines = input.split('\n'); let i = 0;
  py.setStdin({stdin:()=>i<lines.length?lines[i++]:null});
  const result = await py.runPythonAsync(code);
  if (result !== undefined) { out(String(result)); result?.destroy?.(); }
  postMessage({type:'done'});
 } catch(e) { postMessage({type:'error',text:e.stack || String(e)}); }
};
