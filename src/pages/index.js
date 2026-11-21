// Registre des pages du site (l'accueil « / » est géré par site.js).
import lookbook from './lookbook.js';
import heritage from './heritage.js';
import technologie from './technologie.js';
import salons from './salons.js';
import partenaires from './partenaires.js';
import { journal, article } from './journal.js';
import { apropos, faq, contact } from './infos.js';
import notfound from './notfound.js';

export const PAGES = [lookbook, heritage, technologie, salons, partenaires, journal, article, apropos, faq, contact, notfound];

export { MENU } from './menu.js';
