import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { TutorialStep } from '../data/tutorial-steps';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'tutorial-completed-v1';

function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(parsed.ids ?? []);
  } catch {
    return new Set();
  }
}

function saveCompleted(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids: Array.from(set), updatedAt: new Date().toISOString() }));
  } catch {}
}

interface TutorialContextValue {
  isVisible: boolean;
  stepIndex: number;
  totalSteps: number;
  currentStep: TutorialStep | null;
  activeFeatureId: string | null;
  activeFeatureName: string;
  steps: TutorialStep[];
  startTutorial: (featureId: string, steps: TutorialStep[], featureName: string, route: string, navState?: Record<string, unknown>) => void;
  nextStep: () => void;
  prevStep: () => void;
  closeTutorial: () => void;
  isCompleted: (id: string) => boolean;
  resetCompletion: (id: string) => void;
  completed: string[];
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [isVisible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(null);
  const [activeFeatureName, setActiveFeatureName] = useState('');
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const completedRef = useRef<Set<string>>(loadCompleted());
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, force] = useState(0);

  const totalSteps = steps.length;
  const currentStep = totalSteps > 0 && stepIndex >= 0 && stepIndex < totalSteps ? steps[stepIndex] : null;

  const startTutorial = useCallback((
    featureId: string,
    tutorialSteps: TutorialStep[],
    featureName: string,
    route: string,
    // Optional react-router location state. Several Guide features point at /terminal,
    // where the panel to spotlight lives behind an `activeGroup` (and sometimes a
    // sub-tab). Passing state lets us open the right pane instead of spotlighting
    // whatever pane happened to be open last.
    navState?: Record<string, unknown>,
  ) => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    setActiveFeatureId(featureId);
    setActiveFeatureName(featureName);
    setSteps(tutorialSteps);
    setStepIndex(0);
    setVisible(false);
    navigate(route, navState ? { state: navState } : undefined);
    showTimerRef.current = setTimeout(() => {
      setVisible(true);
    }, 500);
  }, [navigate]);

  const markCompleted = useCallback((id: string) => {
    completedRef.current.add(id);
    saveCompleted(completedRef.current);
    force((n) => n + 1);
  }, []);

  const nextStep = useCallback(() => {
    if (stepIndex < totalSteps - 1) {
      setStepIndex((i) => i + 1);
      return;
    }
    if (activeFeatureId) {
      markCompleted(activeFeatureId);
    }
    setVisible(false);
    setActiveFeatureId(null);
    setSteps([]);
  }, [stepIndex, totalSteps, activeFeatureId, markCompleted]);

  const prevStep = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const closeTutorial = useCallback(() => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    setVisible(false);
    setActiveFeatureId(null);
    setSteps([]);
  }, []);

  const isCompleted = useCallback((id: string) => completedRef.current.has(id), []);
  const resetCompletion = useCallback((id: string) => {
    completedRef.current.delete(id);
    saveCompleted(completedRef.current);
    force((n) => n + 1);
  }, []);

  return (
    <TutorialContext.Provider value={{
      isVisible, stepIndex, totalSteps, currentStep,
      activeFeatureId, activeFeatureName, steps,
      startTutorial, nextStep, prevStep, closeTutorial,
      isCompleted, resetCompletion,
      completed: Array.from(completedRef.current),
    }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorialContext() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorialContext must be used within TutorialProvider');
  return ctx;
}
