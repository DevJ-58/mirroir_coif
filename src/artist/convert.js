// Photo → 3D par TRELLIS (Microsoft, code libre), via sa démonstration gratuite hébergée
// sur Hugging Face. Pas de serveur GARO : le navigateur parle directement au service,
// avec un petit client du protocole Gradio (téléversement, file d'attente, flux d'événements).
// Un jeton Hugging Face gratuit (facultatif) augmente le quota de calcul.

const SPACE = 'trellis-community/TRELLIS';
const ENDPOINT = 'generate_and_extract_glb';

const rnd = () => Math.random().toString(36).slice(2, 13);
const auth = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

async function getJSON(url, token) {
  const r = await fetch(url, { headers: auth(token), credentials: 'omit' });
  if (!r.ok) throw new Error(`Service indisponible (${r.status})`);
  return r.json();
}

/** Adresse du service et description de ses fonctions. */
async function connect(token) {
  const { host } = await getJSON(`https://huggingface.co/api/spaces/${SPACE}/host`, token);
  const config = await getJSON(`${host}/config`, token);
  const prefix = config.api_prefix || '/gradio_api';
  return { base: host + prefix, config };
}

/** Téléverse les images, renvoie des descriptions de fichier Gradio. */
async function upload(base, files, token) {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  const r = await fetch(`${base}/upload`, { method: 'POST', body: fd, headers: auth(token), credentials: 'omit' });
  if (!r.ok) throw new Error(`Envoi de la photo refusé (${r.status})`);
  const paths = await r.json();
  return paths.map((p, i) => ({ path: p, orig_name: files[i].name, size: files[i].size, mime_type: files[i].type, meta: { _type: 'gradio.FileData' } }));
}

/** Lance une fonction du service et suit ses événements jusqu'au résultat. */
async function call(base, fnIndex, data, session, token, onEvent, signal) {
  const ctrl = new AbortController();
  signal?.addEventListener('abort', () => ctrl.abort());
  const join = await fetch(`${base}/queue/join`, {
    method: 'POST', credentials: 'omit', signal: ctrl.signal,
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: JSON.stringify({ data, event_data: null, fn_index: fnIndex, trigger_id: null, session_hash: session }),
  });
  if (!join.ok) {
    const t = await join.text().catch(() => '');
    throw new Error(/quota|GPU/i.test(t) ? 'Quota gratuit atteint' : `Demande refusée (${join.status})`);
  }
  const { event_id } = await join.json();
  const res = await fetch(`${base}/queue/data?session_hash=${session}`, { headers: { Accept: 'text/event-stream', ...auth(token) }, credentials: 'omit', signal: ctrl.signal });
  if (!res.ok) throw new Error(`Suivi impossible (${res.status})`);
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let k;
      while ((k = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, k); buf = buf.slice(k + 2);
        const line = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
        if (!line) continue;
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m.event_id && m.event_id !== event_id) continue;
        if (m.msg === 'process_completed') {
          if (!m.success || m.output?.error) {
            const e = String(m.output?.error || 'Le service a échoué.');
            throw new Error(/quota|ZeroGPU|exceeded/i.test(e) ? 'Quota gratuit atteint' : e);
          }
          return m.output.data;
        }
        onEvent?.(m);
        if (m.msg === 'close_stream') throw new Error('Le service a fermé la connexion.');
      }
    }
  } finally { ctrl.abort(); }
  throw new Error('Aucun résultat reçu du service de conversion.');
}

/**
 * images : [Blob] (1 à 4 vues de la même coiffure). onStatus(texte, progression 0→1 ou null).
 * Résout avec l'ArrayBuffer du .glb produit.
 */
export async function photoTo3D(images, { token = '', onStatus = () => {}, signal } = {}) {
  token = token.trim();
  onStatus('Connexion au service de conversion…', 0.03);
  const { base, config } = await connect(token);
  const deps = config.dependencies || [];
  const idx = (name) => deps.findIndex((d) => d.api_name === name);
  const fn = idx(ENDPOINT);
  if (fn < 0) throw new Error('Le service de conversion a changé : fonction introuvable.');
  const comps = new Map((config.components || []).map((c) => [c.id, c]));
  const session = rnd();

  // séance de travail (dossier temporaire côté service)
  const start = idx('start_session');
  if (start >= 0) { try { await call(base, start, [], session, token, null, signal); } catch { /* facultatif */ } }

  onStatus('Envoi de la photo…', 0.06);
  const files = images.map((b, i) => (b instanceof File ? b : new File([b], `vue-${i + 1}.png`, { type: b.type || 'image/png' })));
  const fds = await upload(base, files, token);
  const values = [
    fds[0],
    fds.slice(1).map((f) => ({ image: f, caption: null })),
    0, 7.5, 12, 3, 12, 'stochastic', 0.95, 1024,
  ];
  // les entrées « state » du service reçoivent null, les autres nos valeurs dans l'ordre
  let v = 0;
  const data = deps[fn].inputs.map((id) => (comps.get(id)?.type === 'state' ? null : values[v++]));

  const t0 = performance.now();
  let timer = setInterval(() => {
    const s = Math.round((performance.now() - t0) / 1000);
    onStatus(`Sculpture en 3D… ${s} s`, Math.min(0.85, 0.12 + s / 50));
  }, 1000);
  const guard = new AbortController();
  signal?.addEventListener('abort', () => guard.abort());
  const tout = setTimeout(() => guard.abort(), 8 * 60 * 1000);
  let out;
  try {
    out = await call(base, fn, data, session, token, (m) => {
      if (m.msg === 'estimation' && m.rank > 0) {
        clearInterval(timer); timer = null;
        onStatus(`File d’attente : position ${m.rank + 1}${m.rank_eta ? `, environ ${Math.round(m.rank_eta)} s` : ''}`, 0.08);
      }
      if (m.msg === 'process_starts' && !timer) {
        timer = setInterval(() => { const s = Math.round((performance.now() - t0) / 1000); onStatus(`Sculpture en 3D… ${s} s`, Math.min(0.85, 0.12 + s / 50)); }, 1000);
      }
    }, guard.signal);
  } catch (e) {
    if (guard.signal.aborted && !signal?.aborted) throw new Error('Le service est saturé, réessayez dans quelques minutes.');
    throw e;
  } finally { clearInterval(timer); clearTimeout(tout); }

  const file = out.flat().find((d) => d && typeof d === 'object' && /\.glb$/i.test(d.path || d.url || ''));
  if (!file) throw new Error('Le service n’a pas renvoyé de fichier 3D.');
  const url = file.url || `${base}/file=${file.path}`;
  onStatus('Téléchargement du modèle…', 0.92);
  const res = await fetch(url, { headers: auth(token), credentials: 'omit' });
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status}).`);
  onStatus('Modèle reçu', 1);
  return res.arrayBuffer();
}
