// Catalogue de démonstration — dans la version SaaS, chaque salon gère le sien.
export const CATEGORIES = [
  { id: 'all', label: 'Tout' },
  { id: 'tresses', label: 'Tresses & locks' },
  { id: 'naturel', label: 'Naturel' },
  { id: 'courtes', label: 'Coupes courtes' },
  { id: 'lisses', label: 'Lissés & attachés' },
];

export const STYLES = [
  { id: 'box-braids', kind: 'braids', name: 'Box Braids', cat: 'tresses', duration: '5 h', price: '35 000', desc: 'Tresses longues à section carrée, posées une à une. Tombé lourd et mouvement libre jusqu’au milieu du dos.' },
  { id: 'cornrows', kind: 'cornrows', name: 'Nattes collées', cat: 'tresses', duration: '2 h 30', price: '15 000', desc: 'Onze rangs plaqués de l’avant vers la nuque, terminés en tresses libres. Net, graphique, durable.' },
  { id: 'locks', kind: 'locks', name: 'Locks', cat: 'tresses', duration: '6 h', price: '60 000', desc: 'Locks texturées de longueur épaule, départ volumineux et pointes affinées.' },
  { id: 'twists', kind: 'twists', name: 'Vanilles', cat: 'tresses', duration: '3 h 30', price: '25 000', desc: 'Twists à deux brins, volume aérien et longueur mi-nuque. Protection et légèreté.' },
  { id: 'afro', kind: 'afro', name: 'Afro sculpté', cat: 'naturel', duration: '1 h 30', price: '12 000', desc: 'Volume naturel arrondi et défini, contour travaillé aux ciseaux pour une silhouette parfaite.' },
  { id: 'waves-fade', kind: 'wavesFade', name: 'Waves dégradé', cat: 'courtes', duration: '1 h 15', price: '10 000', desc: '360 waves sur le dessus, dégradé bas fondu sur les côtés et contour net à la tondeuse, coins carrés aux tempes.' },
  { id: 'waves', kind: 'waves', name: '360 Waves', cat: 'courtes', duration: '1 h', price: '8 000', desc: 'Ondulations concentriques depuis le vertex. Brossage et entretien inclus.' },
  { id: 'fade', kind: 'fade', name: 'Dégradé américain', cat: 'courtes', duration: '45 min', price: '6 000', desc: 'Côtés fondus à la tondeuse, dessus texturé. Transition progressive sans démarcation.' },
  { id: 'buzz', kind: 'buzz', name: 'Coupe rase', cat: 'courtes', duration: '20 min', price: '3 000', desc: 'Coupe uniforme très courte, contour net. Simple, sculptural, intemporel.' },
  { id: 'bun', kind: 'bun', name: 'Chignon haut', cat: 'lisses', duration: '1 h', price: '10 000', desc: 'Base plaquée brillante et chignon torsadé haut. Élégance de cérémonie.' },
  { id: 'bob', kind: 'bob', name: 'Carré lisse', cat: 'lisses', duration: '2 h', price: '18 000', desc: 'Carré net à hauteur de mâchoire, raie au milieu, brillance miroir.' },
  { id: 'long', kind: 'long', name: 'Lissage long', cat: 'lisses', duration: '3 h', price: '30 000', desc: 'Longueurs lisses jusqu’aux omoplates, tombé fluide et reflets profonds.' },
];

export const COLORS = [
  { id: 'ebene', name: 'Noir ébène', hex: '#15100d', tip: '#15100d' },
  { id: 'brun', name: 'Brun cacao', hex: '#3b2417', tip: '#4a2e1c' },
  { id: 'chatain', name: 'Châtain', hex: '#5e3b22', tip: '#7a5030' },
  { id: 'cuivre', name: 'Cuivré', hex: '#7c2f15', tip: '#a3471f' },
  { id: 'miel', name: 'Ombré miel', hex: '#2a1a12', tip: '#b07a40' },
  { id: 'blond', name: 'Blond polaire', hex: '#c9b48c', tip: '#e6d7b8' },
  { id: 'bordeaux', name: 'Bordeaux', hex: '#3d0c18', tip: '#5e1424' },
];
