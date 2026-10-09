import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { buildSteps, getAppKind, serverAppName, TourUser } from './tourSteps';

export const OPEN_TOUR_EVENT = 'antigone:open-tour';

const OnboardingTour: React.FC = () => {
  const { user, updateUser } = useAuth();
  const kind = getAppKind();
  const app = serverAppName(kind);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const anyUser = user as (typeof user & TourUser & { isClient?: boolean; loginClient?: string; toursVus?: string[] }) | null;
  const steps = useMemo(() => (anyUser ? buildSteps(anyUser, kind) : []), [anyUser, kind]);
  const identity = anyUser ? String(anyUser.username ?? anyUser.loginClient ?? anyUser.compteId ?? '') : '';
  const storageKey = `tour-seen:${app}:${identity}`;

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

  const close = useCallback(() => {
    setOpen(false);
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
  }, [alreadySeen, anyUser, app, storageKey, updateUser]);

  const go = useCallback(
    (delta: number) => {
      setDirection(delta);
      setIndex((i) => Math.min(Math.max(i + delta, 0), steps.length - 1));
    },
    [steps.length],
  );

  const last = index === steps.length - 1;

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

  if (!anyUser || steps.length === 0) return null;
  const step = steps[Math.min(index, steps.length - 1)];

  return (
    <>
      {/* Bouton d'aide permanent */}
      {!open && (
        <button
          type="button"
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
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/30 dark:bg-gray-900"
              initial={{ scale: 0.94, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 16, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            >
              {/* Bandeau */}
              <div className="relative bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 px-7 pt-6 pb-8 text-white">
                <div className="flex items-center justify-between text-xs font-semibold tracking-wide uppercase text-white/85">
                  <span>
                    Étape {index + 1} sur {steps.length}
                  </span>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-full px-3 py-1 text-white/85 transition hover:bg-white/20 hover:text-white"
                  >
                    Passer le guide
                  </button>
                </div>
                <div className="mt-5 flex items-center gap-4">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={step.id + '-icon'}
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-inner ring-1 ring-white/30 backdrop-blur"
                      initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                    >
                      {step.icon}
                    </motion.div>
                  </AnimatePresence>
                  <div className="min-w-0">
                    <h2 className="text-2xl leading-tight font-extrabold">{step.title}</h2>
                    {step.menu && (
                      <p className="mt-1 inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium text-white/95">
                        Menu : {step.menu}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Contenu */}
              <div className="min-h-[190px] flex-1 overflow-y-auto px-7 py-6">
                <AnimatePresence mode="wait" initial={false} custom={direction}>
                  <motion.div
                    key={step.id}
                    custom={direction}
                    initial={{ opacity: 0, x: direction * 36 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -36 }}
                    transition={{ duration: 0.22 }}
                  >
                    <p className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-200">{step.body}</p>
                    {step.points && step.points.length > 0 && (
                      <ul className="mt-4 space-y-2.5">
                        {step.points.map((p) => (
                          <li key={p} className="flex items-start gap-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">
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
              <div className="border-t border-gray-100 bg-gray-50/80 px-7 py-4 dark:border-gray-800 dark:bg-gray-900/80">
                <div className="mb-4 flex items-center justify-center gap-1.5">
                  {steps.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={`Aller à l'étape ${i + 1}`}
                      onClick={() => {
                        setDirection(i > index ? 1 : -1);
                        setIndex(i);
                      }}
                      className={`h-2 rounded-full transition-all ${
                        i === index ? 'w-6 bg-brand-500' : i < index ? 'w-2 bg-brand-300' : 'w-2 bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    disabled={index === 0}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-200/70 disabled:invisible dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    ← Précédent
                  </button>
                  <button
                    type="button"
                    onClick={() => (last ? close() : go(1))}
                    className="rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-7 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/30 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-500/40 active:translate-y-0"
                  >
                    {last ? 'Terminer ✓' : 'Suivant →'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default OnboardingTour;
