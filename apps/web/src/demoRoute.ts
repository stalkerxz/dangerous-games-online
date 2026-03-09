export type DemoRouteStep = 'campaign' | 'messenger' | 'clues' | 'parents' | 'report' | 'done';

export type DemoRouteState = {
  active: boolean;
  step: DemoRouteStep;
};

const DEMO_ROUTE_KEY = 'dgo-demo-route:v1';

const DEFAULT_STATE: DemoRouteState = {
  active: false,
  step: 'campaign'
};

export function readDemoRouteState(): DemoRouteState {
  const raw = localStorage.getItem(DEMO_ROUTE_KEY);
  if (!raw) {
    return DEFAULT_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DemoRouteState>;
    if (!parsed.active || !parsed.step) {
      return DEFAULT_STATE;
    }
    return {
      active: Boolean(parsed.active),
      step: parsed.step
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function startDemoRoute() {
  localStorage.setItem(DEMO_ROUTE_KEY, JSON.stringify({ active: true, step: 'campaign' } satisfies DemoRouteState));
}

export function updateDemoRouteStep(step: DemoRouteStep) {
  const current = readDemoRouteState();
  localStorage.setItem(DEMO_ROUTE_KEY, JSON.stringify({ ...current, active: true, step } satisfies DemoRouteState));
}

export function clearDemoRoute() {
  localStorage.removeItem(DEMO_ROUTE_KEY);
}
