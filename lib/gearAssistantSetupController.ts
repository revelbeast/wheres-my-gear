import { createSmartSetupAttempt, type SetupOutcome } from './gearAssistantSetupService';
import { validateSetup, type SetupPreview } from './gearAssistantSetup';

export type SetupCreationState = { phase: 'idle' | 'confirming' | 'saving' | 'failed' | 'uncertain' | 'reconciling' | 'success'; message: string };
export function canCreateSetup(preview: SetupPreview | null): boolean {
  return !!preview && validateSetup(preview).length === 0 && (!preview.parentKind ||
    (typeof preview.parentId === 'string' && !!preview.parentId.trim() && !/^(offline-|proposal-|temp-)|\//i.test(preview.parentId)));
}
export function setupCreationSummary(preview: SetupPreview, parentLabel: string): string {
  const counts = ['storage', 'room', 'compartment'].map(kind => `${preview.nodes.filter(n => n.kind === kind).length} ${kind === 'storage' ? 'storage spaces' : kind === 'room' ? 'rooms' : 'compartments'}`).join(', ');
  const lines = preview.nodes.map(node => {
    const parent = preview.nodes.find(n => n.id === node.parentId);
    const metadata = node.kind === 'storage' ? ` (${node.category}: ${node.subtype === 'Other' ? node.customSubtype?.trim() : node.subtype})` : '';
    return `${node.kind}: ${node.name}${metadata}${parent ? ` → in ${parent.name}` : preview.parentKind ? ` → in ${parentLabel}` : ''}`;
  });
  return `${counts}\n${preview.parentKind ? `Existing ${preview.parentKind === 'storage' ? 'storage space' : 'room'}: ${parentLabel}` : 'All parents will be newly created.'}\n\n${lines.join('\n')}\n\nConfirming will save these records to your Firebase inventory.`;
}
const guidance: Record<string, string> = {
  validation: 'Review the preview names, metadata, and parent selection.',
  authentication: 'Sign in with the account that confirmed this preview.',
  entitlement: 'Premium+ is required. Check your subscription before confirming again.',
  'entitlement-unavailable': 'Premium+ access could not be verified. Check your connection and account.',
  offline: 'Connect to the internet before confirming again.',
  'parent-state': 'The selected parent is unavailable or changed. Select an active parent again.',
  permission: 'Firebase denied permission. Check your account access before confirming again.',
};
/** Controller owns the attempt until a definitive outcome. No writes from begin/cancel/edit/reset. */
export function createSetupController(deps: {
  uid: () => string | undefined;
  premiumPlus: () => boolean;
  changed: (state: SetupCreationState) => void;
  success: (preview: SetupPreview) => Promise<void>;
  createAttempt?: typeof createSmartSetupAttempt;
}) {
  let state: SetupCreationState = { phase: 'idle', message: '' };
  let snapshot: SetupPreview | undefined, account: string | undefined;
  let attempt: ReturnType<typeof createSmartSetupAttempt> | undefined;
  let inFlight: Promise<void> | undefined;
  const locked = () => ['confirming','saving','uncertain','reconciling'].includes(state.phase);
  const set = (phase: SetupCreationState['phase'], message = '') => { state = { phase, message }; deps.changed(state); };
  async function run(reconcile: boolean) {
    try {
      const result: SetupOutcome = await (reconcile ? attempt!.reconcile() : attempt!.execute());
      if (result.ok) {
        set('success', `Created ${snapshot!.nodes.filter(n => n.kind === 'storage').length} storage spaces, ${snapshot!.nodes.filter(n => n.kind === 'room').length} rooms, and ${snapshot!.nodes.filter(n => n.kind === 'compartment').length} compartments.`);
        if (deps.uid() === account) {
          try { await deps.success(snapshot!); }
          catch { set('success', state.message + ' Saved successfully, but the display could not refresh. Reopen Inventory to refresh.'); }
        }
      } else if (result.reason === 'uncertain-result' || reconcile) {
        set('uncertain', `Creation may have succeeded. Do not submit it again or restart the app. Check the original attempt below. ${result.message ?? ''}`);
      } else set('failed', `${result.message ?? 'Creation was not completed.'} ${guidance[result.reason ?? ''] ?? ''}`);
    } catch {
      // An unexpected rejection must never enable a new attempt with new IDs.
      set('uncertain', 'Creation could not be confirmed. Keep this screen open and check the original attempt; do not resubmit or restart.');
    }
  }
  return {
    get state() { return state; }, locked,
    begin(preview: SetupPreview, parentLabel: string): string | null {
      if (locked() || inFlight) return null;
      if (!deps.uid()) { set('failed', guidance.authentication); return null; }
      if (!deps.premiumPlus()) { set('failed', guidance.entitlement); return null; }
      if (!canCreateSetup(preview)) { set('failed', guidance.validation); return null; }
      snapshot = JSON.parse(JSON.stringify(preview)) as SetupPreview;
      snapshot.nodes.forEach(Object.freeze); Object.freeze(snapshot.nodes); Object.freeze(snapshot);
      account = deps.uid(); attempt = undefined;
      set('confirming');
      return setupCreationSummary(snapshot, parentLabel);
    },
    cancel() { if (state.phase === 'confirming') { snapshot = undefined; set('idle'); } },
    confirm(): Promise<void> {
      if (inFlight) return inFlight;
      if (state.phase !== 'confirming' || !snapshot) return Promise.resolve();
      if (!account || deps.uid() !== account) { set('failed', guidance.authentication); return Promise.resolve(); }
      if (!deps.premiumPlus()) { set('failed', guidance.entitlement); return Promise.resolve(); }
      attempt = (deps.createAttempt ?? createSmartSetupAttempt)(snapshot, true);
      set('saving', 'Saving storage structure… Keep this screen open.');
      inFlight = run(false).finally(() => { inFlight = undefined; });
      return inFlight;
    },
    reconcile(): Promise<void> {
      if (inFlight) return inFlight;
      if (state.phase !== 'uncertain' || !attempt) return Promise.resolve();
      set('reconciling', 'Checking the original creation attempt…');
      inFlight = run(true).finally(() => { inFlight = undefined; });
      return inFlight;
    },
    reset() { if (!locked() && !inFlight) { snapshot = undefined; attempt = undefined; set('idle'); } },
  };
}
