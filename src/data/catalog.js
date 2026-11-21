// Catalogue : des coiffures en photos de mannequin coiffé (public/styles/catalog.json),
// complétées par celles que les artistes publient depuis l'atelier (enregistrées sur l'appareil).
export const CATEGORIES = [
  { id: 'all', label: 'Tout' },
  { id: 'tresses', label: 'Tresses & locks' },
  { id: 'naturel', label: 'Naturel' },
  { id: 'courtes', label: 'Coupes courtes' },
  { id: 'lisses', label: 'Lissés & attachés' },
];

/** Rempli par loadCatalog() avant l'ouverture du site. */
export const STYLES = [];

export async function loadCatalog() {
  try {
    const r = await fetch('/styles/catalog.json', { cache: 'no-cache' });
    const list = await r.json();
    for (const s of list) STYLES.push({ ...s, kind: 'photo' });
  } catch (e) { console.warn('catalogue indisponible', e); }
  return STYLES;
}

/** Coiffure n° i du catalogue (en boucle) : les pages du site s'en servent pour leurs illustrations. */
export const pick = (i) => STYLES[((i % STYLES.length) + STYLES.length) % STYLES.length];

export const COLORS = [
  { id: 'ebene', name: 'Noir ébène', hex: '#15100d', tip: '#15100d' },
  { id: 'brun', name: 'Brun cacao', hex: '#3b2417', tip: '#4a2e1c' },
  { id: 'chatain', name: 'Châtain', hex: '#5e3b22', tip: '#7a5030' },
  { id: 'cuivre', name: 'Cuivré', hex: '#7c2f15', tip: '#a3471f' },
  { id: 'miel', name: 'Ombré miel', hex: '#2a1a12', tip: '#b07a40' },
  { id: 'blond', name: 'Blond polaire', hex: '#c9b48c', tip: '#e6d7b8' },
  { id: 'bordeaux', name: 'Bordeaux', hex: '#3d0c18', tip: '#5e1424' },
];
