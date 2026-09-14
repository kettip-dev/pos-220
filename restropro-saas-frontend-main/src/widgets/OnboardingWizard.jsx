import React, { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { IconCheck, IconArrowRight, IconSparkles } from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { TEMPLATES } from "./templates";

/**
 * OnboardingWizard
 * ──────────────────────────────────────────────────────────────
 * Two-step modal shown to first-time dashboard users (no saved layout).
 * Step 1: pick a template starter.
 * Step 2: confirmation — applies the template & saves.
 */
export default function OnboardingWizard({ open, onApply, onSkip }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState("owner_overview");

  const apply = () => {
    onApply(selected);
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[10000]" onClose={() => {}}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
            leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-3xl rounded-2xl border border-restro-border-green bg-background shadow-2xl">
              <div className="border-b border-restro-border-green px-6 py-5">
                <div className="flex items-center gap-2 text-restro-green">
                  <IconSparkles size={18} stroke={iconStroke} />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Welcome — let's set up your dashboard
                  </span>
                </div>
                <Dialog.Title className="mt-1 text-2xl font-extrabold text-foreground">
                  Pick a starter that fits your role
                </Dialog.Title>
                <p className="mt-1 text-sm text-restro-text">
                  Don't worry — you can drag, resize, add and remove widgets afterwards.
                </p>
              </div>

              <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto p-6 sm:grid-cols-2 lg:grid-cols-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setSelected(t.key)}
                    className={`relative flex flex-col rounded-xl border-2 p-4 text-left transition ${
                      selected === t.key
                        ? "border-restro-green bg-restro-green-10"
                        : "border-restro-border-green hover:border-restro-green/60"
                    }`}
                  >
                    {selected === t.key && (
                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-restro-green text-white">
                        <IconCheck size={14} stroke={3} />
                      </span>
                    )}
                    <div
                      className="mb-3 h-1.5 w-12 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    <p className="text-base font-extrabold text-foreground">{t.title}</p>
                    <p className="mt-1 text-xs text-restro-text">{t.description}</p>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-restro-border-green px-6 py-4">
                <button
                  onClick={onSkip}
                  className="text-sm font-semibold text-restro-text hover:text-foreground"
                >
                  Skip — start blank
                </button>
                <button
                  onClick={apply}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-restro-green px-5 py-2.5 text-sm font-bold text-white transition hover:bg-restro-green/90 active:scale-95"
                >
                  Apply template
                  <IconArrowRight size={16} stroke={iconStroke} />
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
