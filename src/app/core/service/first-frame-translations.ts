import type { LangCode } from '../../model';

/**
 * The minimal first-frame translation set (T395, hub ADR-0009).
 *
 * The app paints its first frame before `/i18n/<lang>.json` arrives, and the
 * only translatable surfaces on that frame are the root-mounted consent
 * banner and the tab title (`TranslatedTitleStrategy` resolves `titles.*`
 * with `instant()` on every navigation). These strings are inlined so that
 * frame carries real copy instead of raw keys; everything else stays in the
 * locale files, which remain the source of truth — every value here MUST be
 * byte-identical to its `public/i18n/<lang>.json` entry, and
 * `e2e/first-frame-i18n.spec.ts` fails the suite on any drift.
 *
 * Keys are the full dotted i18n key, values are plain strings with no
 * interpolation parameters — `FirstFrameMissingTranslationHandler` returns
 * them verbatim, without running the parser.
 */
export const FIRST_FRAME_TRANSLATIONS: Record<LangCode, Record<string, string>> = {
  es: {
    'consentBanner.message':
      'Nos gustaría usar un poco de analítica para ver cuántos invitados nos visitan — nada más.',
    'consentBanner.note': 'Sin publicidad, sin perfiles. Puedes cambiar de idea cuando quieras.',
    'consentBanner.accept': 'Aceptar',
    'consentBanner.decline': 'Rechazar',
    'consentBanner.privacyLink': 'Política de privacidad',
    'titles.welcome': 'Sara & Christophe · Reserva la fecha',
    'titles.login': 'Sara & Christophe · Iniciar sesión',
    'titles.signingIn': 'Sara & Christophe · Iniciando sesión',
    'titles.rsvp': 'Sara & Christophe · RSVP',
    'titles.schedule': 'Sara & Christophe · El gran día',
    'titles.travel': 'Sara & Christophe · Cómo llegar',
    'titles.album': 'Sara & Christophe · Álbum',
    'titles.dashboard': 'Sara & Christophe · Panel',
    'titles.config': 'Sara & Christophe · Configuración',
    'titles.guestManager': 'Sara & Christophe · Gestor de invitados',
    'titles.seating': 'Sara & Christophe · Plan de mesas',
    'titles.invitee': 'Sara & Christophe · Tu día',
    'titles.profile': 'Sara & Christophe · Mi perfil',
    'titles.people': 'Sara & Christophe · Contactos',
    'titles.milestones': 'Sara & Christophe · Hitos',
    'titles.privacyPolicy': 'Sara & Christophe · Política de privacidad',
  },
  en: {
    'consentBanner.message':
      "We'd like to use a little analytics to see how many guests are visiting — nothing more.",
    'consentBanner.note': 'No ads, no profiles. You can change your mind whenever you like.',
    'consentBanner.accept': 'Accept',
    'consentBanner.decline': 'Decline',
    'consentBanner.privacyLink': 'Privacy policy',
    'titles.welcome': 'Sara & Christophe · Save the date',
    'titles.login': 'Sara & Christophe · Sign in',
    'titles.signingIn': 'Sara & Christophe · Signing in',
    'titles.rsvp': 'Sara & Christophe · RSVP',
    'titles.schedule': 'Sara & Christophe · The day',
    'titles.travel': 'Sara & Christophe · Getting there',
    'titles.album': 'Sara & Christophe · Album',
    'titles.dashboard': 'Sara & Christophe · Dashboard',
    'titles.config': 'Sara & Christophe · Configuration',
    'titles.guestManager': 'Sara & Christophe · Guest manager',
    'titles.seating': 'Sara & Christophe · Seating plan',
    'titles.invitee': 'Sara & Christophe · Your day',
    'titles.profile': 'Sara & Christophe · My profile',
    'titles.people': 'Sara & Christophe · Contacts',
    'titles.milestones': 'Sara & Christophe · Milestones',
    'titles.privacyPolicy': 'Sara & Christophe · Privacy policy',
  },
  fr: {
    'consentBanner.message':
      "Nous aimerions utiliser un peu d'analytique pour voir combien d'invités nous visitent — rien de plus.",
    'consentBanner.note':
      "Pas de publicité, pas de profilage. Vous pouvez changer d'avis à tout moment.",
    'consentBanner.accept': 'Accepter',
    'consentBanner.decline': 'Refuser',
    'consentBanner.privacyLink': 'Politique de confidentialité',
    'titles.welcome': 'Sara & Christophe · Réservez la date',
    'titles.login': 'Sara & Christophe · Connexion',
    'titles.signingIn': 'Sara & Christophe · Connexion en cours',
    'titles.rsvp': 'Sara & Christophe · RSVP',
    'titles.schedule': 'Sara & Christophe · Le jour J',
    'titles.travel': "Sara & Christophe · S'y rendre",
    'titles.album': 'Sara & Christophe · Album',
    'titles.dashboard': 'Sara & Christophe · Tableau de bord',
    'titles.config': 'Sara & Christophe · Configuration',
    'titles.guestManager': "Sara & Christophe · Gestionnaire d'invités",
    'titles.seating': 'Sara & Christophe · Plan de table',
    'titles.invitee': 'Sara & Christophe · Votre journée',
    'titles.profile': 'Sara & Christophe · Mon profil',
    'titles.people': 'Sara & Christophe · Contacts',
    'titles.milestones': 'Sara & Christophe · Étapes',
    'titles.privacyPolicy': 'Sara & Christophe · Politique de confidentialité',
  },
};
