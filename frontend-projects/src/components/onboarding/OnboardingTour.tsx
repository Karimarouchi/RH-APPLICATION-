import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { buildSteps, getAppKind, serverAppName, Target, TourUser } from './tourSteps';

export const OPEN_TOUR_EVENT = 'antigone:open-tour';

const CARD_W = 390;
const MARGIN = 14;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const isShown = (el: HTMLElement | null): el is HTMLElement => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
};

/** Retrouve l'element reel du menu a mettre en surbrillance. */
const findTarget = (t: Target): HTMLElement | null => {
  if ('rail' in t) {
    const wanted = norm(t.rail);
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('.pc-icon-rail-shell button.pc-icon-btn'));
    return buttons.find((b) => norm(b.getAttribute('aria-label') || b.textContent || '') === wanted) ?? null;
  }
  if ('panel' in t) {
    const wanted = norm(t.panel);
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.pc-secondary-panel.open .pc-panel-item, .pc-secondary-panel.open .pc-panel-child'));
    return nodes.find((n) => norm(n.textContent || '') === wanted) ?? nodes.find((n) => norm(n.textContent || '').includes(wanted)) ?? null;
  }
  return document.querySelector<HTMLElement>(t.selector);
};

const closeMenuPanel = () => {
  const overlay = document.querySelector<HTMLElement>('.pc-panel-overlay');
  if (overlay) {
    overlay.click();
    return;
  }
  document.querySelector<HTMLElement>('.pc-secondary-panel.open .pc-close-btn')?.click();
};

const OnboardingTour: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigateHook = useNavigate();
  const navigateRef = useRef(navigateHook);
  navigateRef.current = navigateHook;
  const navigate = useCallback((to: string) => navigateRef.current(to), []);
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;
  const kind = getAppKind();
  const app = serverAppName(kind);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardH, setCardH] = useState(260);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const openedRail = useRef<string | null>(null);
  const targetEl = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const anyUser = user as (typeof user & TourUser & { isClient?: boolean; loginClient?: string; toursVus?: string[] }) | null;
  const steps = useMemo(() => (anyUser ? buildSteps(anyUser, kind) : []), [anyUser, kind]);
  const identity = anyUser ? String(anyUser.username ?? anyUser.loginClient ?? anyUser.compteId ?? '') : '';
  const storageKey = `tour-seen:${app}:${identity}`;
  const isClientUser = !!anyUser?.isClient;
  const homePath = isClientUser ? '/client/accueil' : kind === 'rh' ? '/dashboard' : '/accueil';
  // Sur petit ecran le menu est masque : on montre seulement des cartes explicatives, sans cibler le menu.
  const canSpotlight = vp.w >= 1024 || isClientUser;

  const alreadySeen = useCallback((): boolean => {
    if (!anyUser) return true;
    if ((anyUser.toursVus ?? []).includes(app)) return true;
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  }, [anyUser, app, storageKey]);

  // Ouverture automatique a la premiere connexion (apres le changement du mot de passe provisoire)
  useEffect(() => {
    if (!anyUser || anyUser.mustChangePassword) return;
    if (!alreadySeen()) {
      setIndex(0);
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyUser?.compteId, anyUser?.mustChangePassword]);

  // Reouverture a la demande (bouton « ? »)
  useEffect(() => {
    const onOpen = () => {
      setDirection(1);
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_TOUR_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TOUR_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setRect(null);
    targetEl.current = null;
    if (openedRail.current) {
      closeMenuPanel();
      openedRail.current = null;
    }
    if (canSpotlight) navigate(homePath);
    if (!anyUser || alreadySeen()) return;
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* stockage indisponible */
    }
    if (!anyUser.isClient) {
      api.post('/auth/tour-vu', null, { params: { app } }).catch(() => undefined);
      updateUser({ toursVus: [...(anyUser.toursVus ?? []), app] } as never);
    }
  }, [alreadySeen, anyUser, app, canSpotlight, homePath, navigate, storageKey, updateUser]);

  const go = useCallback(
    (delta: number) => {
      setDirection(delta);
      setIndex((i) => Math.min(Math.max(i + delta, 0), steps.length - 1));
    },
    [steps.length],
  );

  const step = steps[Math.min(index, Math.max(steps.length - 1, 0))];
  const stepRef = useRef(step);
  stepRef.current = step;
  const canSpotlightRef = useRef(canSpotlight);
  canSpotlightRef.current = canSpotlight;
  const clickedStep = useRef<string | null>(null);
  const stepId = step?.id;
  const last = index === steps.length - 1;

  // Prepare l'interface reelle pour l'etape : ouvre / ferme le panneau, clique si besoin, attend la cible.
  // Tout est tolerant a la lenteur : on attend les elements au lieu d'abandonner, et le suivi ci-dessous
  // retrouve la cible meme si elle apparait tard.
  useEffect(() => {
    const s = stepRef.current;
    if (!open || !s) return;
    let cancelled = false;
    (async () => {
      targetEl.current = null;
      setRect(null);
      const wantsMenu = canSpotlightRef.current && !!s.target;
      if (s.go && canSpotlightRef.current && locationRef.current !== s.go) {
        navigate(s.go);
        await sleep(450);
      }
      if (!wantsMenu) {
        if (openedRail.current) {
          closeMenuPanel();
          openedRail.current = null;
        }
        return;
      }
      const target = s.target as Target;
      const wantedRail = s.open ?? null;
      if (openedRail.current !== wantedRail) {
        if (openedRail.current) {
          closeMenuPanel();
          openedRail.current = null;
          // attend la fermeture reelle du panneau (machine lente) avant de continuer
          for (let k = 0; k < 25 && document.querySelector('.pc-secondary-panel.open') && !cancelled; k++) {
            if (k === 12) closeMenuPanel();
            await sleep(60);
          }
          await sleep(120);
        }
        if (wantedRail && !cancelled) {
          for (let k = 0; k < 30 && !findTarget({ rail: wantedRail }) && !cancelled; k++) await sleep(60);
          findTarget({ rail: wantedRail })?.click();
          openedRail.current = wantedRail;
          await sleep(420);
        }
      }
      if (cancelled) return;
      if (s.click && 'rail' in target && clickedStep.current !== s.id) {
        clickedStep.current = s.id;
        findTarget(target)?.click();
        await sleep(350);
      }
      for (let k = 0; k < 100 && !cancelled; k++) {
        const el = findTarget(target);
        if (isShown(el)) {
          el.scrollIntoView({ block: 'nearest' });
          targetEl.current = el;
          setRect(el.getBoundingClientRect());
          return;
        }
        // le panneau ne s'est pas ouvert (clic perdu pendant une animation) : on reessaie une fois
        if (k === 40 && wantedRail && !document.querySelector('.pc-secondary-panel.open')) {
          findTarget({ rail: wantedRail })?.click();
        }
        await sleep(60);
      }
      // cible vraiment introuvable : carte au centre (le suivi ci-dessous retentera tant que l'etape est affichee)
    })();
    return () => {
      cancelled = true;
    };
  }, [open, index, stepId, canSpotlight, navigate]);

  // Suit l'element cible (animation du panneau, defilement, redimensionnement) et le retrouve s'il apparait tard
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => {
      const s = stepRef.current;
      let el = targetEl.current;
      if ((!el || !el.isConnected) && s?.target && canSpotlightRef.current) {
        const found = findTarget(s.target);
        if (isShown(found)) {
          el = found;
          targetEl.current = found;
        }
      }
      if (el && el.isConnected) {
        const r = el.getBoundingClientRect();
        setRect((prev) =>
          prev && Math.abs(prev.left - r.left) < 0.5 && Math.abs(prev.top - r.top) < 0.5 && Math.abs(prev.width - r.width) < 0.5 ? prev : r,
        );
      }
    }, 160);
    return () => window.clearInterval(id);
  }, [open]);

  useLayoutEffect(() => {
    if (cardRef.current) {
      const h = cardRef.current.offsetHeight;
      if (Math.abs(h - cardH) > 1) setCardH(h);
    }
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (last) close();
        else go(1);
      } else if (e.key === 'ArrowLeft') {
        go(-1);
      } else if (e.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, last, go, close]);

  if (!anyUser || steps.length === 0 || !step) return null;

  // Position de la carte : a droite de l'element cible, sinon a gauche, sinon au-dessous / au-dessus, sinon au centre
  const anchored = !!rect;
  const cardWidth = Math.min(CARD_W, vp.w - 2 * MARGIN);
  let cardStyle: React.CSSProperties = {};
  let side: 'right' | 'left' | 'below' | 'above' = 'right';
  let arrowTop = 24;
  if (rect) {
    const centeredTop = () => Math.min(Math.max(rect.top + rect.height / 2 - cardH / 2, MARGIN), vp.h - cardH - MARGIN);
    let left = rect.right + 22;
    let top = centeredTop();
    if (left + cardWidth > vp.w - MARGIN) {
      if (rect.left - 22 - cardWidth >= MARGIN) {
        side = 'left';
        left = rect.left - 22 - cardWidth;
      } else if (rect.bottom + 18 + cardH <= vp.h - MARGIN) {
        side = 'below';
        left = Math.min(Math.max(rect.left, MARGIN), vp.w - cardWidth - MARGIN);
        top = rect.bottom + 18;
      } else {
        side = 'above';
        left = Math.min(Math.max(rect.left, MARGIN), vp.w - cardWidth - MARGIN);
        top = Math.max(rect.top - 18 - cardH, MARGIN);
      }
    }
    arrowTop = Math.min(Math.max(rect.top + rect.height / 2 - top - 8, 18), cardH - 34);
    cardStyle = { position: 'fixed', left, top, width: cardWidth };
  }

  const ui = (
    <>
      {/* Bouton d'aide permanent */}
      {(
        <button
          type="button"
          data-tour="help"
          aria-label="Ouvrir le guide de l'application"
          title="Guide de l'application"
          onClick={() => window.dispatchEvent(new Event(OPEN_TOUR_EVENT))}
          className="fixed right-6 bottom-[88px] z-[9990] flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-base font-bold text-brand-600 shadow-lg shadow-black/10 backdrop-blur transition hover:scale-110 hover:bg-brand-50 dark:border-gray-700 dark:bg-gray-800/95 dark:text-brand-300 dark:hover:bg-gray-700"
        >
          ?
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            key="tour-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Guide de l'application"
            className="fixed inset-0 z-[10050]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Fond : sombre, avec un « trou » lumineux autour de l'element explique */}
            {rect ? (
              <div
                aria-hidden
                className="pointer-events-none fixed rounded-2xl"
                style={{
                  left: rect.left - 6,
                  top: rect.top - 6,
                  width: rect.width + 12,
                  height: rect.height + 12,
                  boxShadow: '0 0 0 9999px rgba(10,8,18,0.66), 0 0 0 3px var(--brand), 0 0 0 7px rgba(255,255,255,0.35), 0 0 28px 8px rgba(255,255,255,0.18)',
                  transition: 'left .3s ease, top .3s ease, width .3s ease, height .3s ease',
                }}
              />
            ) : (
              <div aria-hidden className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
            )}

            <div
              className={anchored ? '' : 'flex h-full w-full items-center justify-center p-4'}
              style={anchored ? undefined : undefined}
            >
              <motion.div
                ref={cardRef}
                key={anchored ? 'anchored' : 'centered'}
                style={anchored ? cardStyle : { width: Math.min(560, vp.w - 2 * MARGIN) }}
                className="relative"
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              >
                {anchored && (side === 'right' || side === 'left') && (
                  <span
                    aria-hidden
                    className={`absolute z-10 h-4 w-4 rotate-45 rounded-sm bg-brand-500 ${side === 'right' ? '-left-2' : '-right-2'}`}
                    style={{ top: arrowTop }}
                  />
                )}

                <div className="flex max-h-[92vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/40 dark:bg-gray-900">
                {/* Bandeau */}
                <div className="relative bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 px-6 pt-5 pb-6 text-white">
                  <div className="flex items-center justify-between text-[11px] font-semibold tracking-wide uppercase text-white/85">
                    <span>
                      Étape {index + 1} sur {steps.length}
                    </span>
                    <button type="button" onClick={close} className="rounded-full px-3 py-1 text-white/85 transition hover:bg-white/20 hover:text-white">
                      Passer le guide
                    </button>
                  </div>
                  <div className="mt-4 flex items-center gap-3.5">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={step.id + '-icon'}
                        className={`flex shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-inner ring-1 ring-white/30 backdrop-blur ${anchored ? 'h-12 w-12 text-2xl' : 'h-16 w-16 text-3xl'}`}
                        initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                      >
                        {step.icon}
                      </motion.div>
                    </AnimatePresence>
                    <h2 className={`min-w-0 leading-tight font-extrabold ${anchored ? 'text-xl' : 'text-2xl'}`}>{step.title}</h2>
                  </div>
                </div>

                {/* Contenu */}
                <div className="min-h-[96px] flex-1 overflow-y-auto px-6 py-5">
                  <AnimatePresence mode="wait" initial={false} custom={direction}>
                    <motion.div
                      key={step.id}
                      custom={direction}
                      initial={{ opacity: 0, x: direction * 28 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction * -28 }}
                      transition={{ duration: 0.2 }}
                    >
                      <p className="text-[14.5px] leading-relaxed text-gray-700 dark:text-gray-200">{step.body}</p>
                      {step.points && step.points.length > 0 && (
                        <ul className="mt-3.5 space-y-2.5">
                          {step.points.map((p) => (
                            <li key={p} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
                              <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">
                                ✓
                              </span>
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Pied : progression + boutons */}
                <div className="border-t border-gray-100 bg-gray-50/80 px-6 py-3.5 dark:border-gray-800 dark:bg-gray-900/80">
                  <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-300"
                      style={{ width: `${((index + 1) / steps.length) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => go(-1)}
                      disabled={index === 0}
                      className="rounded-xl px-3.5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200/70 disabled:invisible dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      ← Précédent
                    </button>
                    <button
                      type="button"
                      onClick={() => (last ? close() : go(1))}
                      className="rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-brand-500/30 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-500/40 active:translate-y-0"
                    >
                      {last ? 'Terminer ✓' : 'Suivant →'}
                    </button>
                  </div>
                </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  return createPortal(ui, document.body);
};

export default OnboardingTour;
