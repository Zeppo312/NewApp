import React from 'react';
import { act,create,type ReactTestRenderer } from 'react-test-renderer';
import Screen from '../../app/data-consents';
import { DataConsentPanel } from '../../components/privacy/DataConsentPanel';
import { activeDataConsentCopy as copies, dataConsentCopy } from '../dataConsentCopy';
// Consent pages use the app shell (Header, background, glass card); keep it light in tests.
jest.mock('@/components/Header', () => { const R = require('react'); const { Pressable, Text } = require('react-native');
  return { __esModule: true, default: ({ title, showBackButton, onBackPress, backAccessibilityLabel }: any) => R.createElement(R.Fragment, null,
    R.createElement(Text, null, title), showBackButton ? R.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: backAccessibilityLabel, onPress: onBackPress }) : null) }; });
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: ({ children }: any) => children }));
jest.mock('@/components/ui/content-card', () => ({ ContentCard: ({ children }: any) => children }));
jest.mock('@/contexts/NavigationContext', () => ({ NavigationProvider: ({ children }: any) => children }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light', isDarkBackground: false, textPrimary: '#000', textSecondary: '#333', textTertiary: '#666' }) }));

let mockConsent:any;
let mockParams: { scope?: string | string[] };
const mockDecide=jest.fn(); const mockPush=jest.fn(); const mockRefresh=jest.fn(); const mockBack=jest.fn();
jest.mock('@/contexts/LocaleContext',()=>({useLocale:()=>({locale:'de'})}));
jest.mock('@/contexts/AuthContext',()=>({useAuth:()=>({signOut:jest.fn()})}));
let mockGated=false; const mockRelease=jest.fn();
jest.mock('@/components/privacy/DataConsentBoundary',()=>({useConsentGate:()=>({gated:mockGated,release:mockRelease})}));
jest.mock('@/contexts/DataConsentContext',()=>({useDataConsents:()=>mockConsent}));
jest.mock('expo-router',()=>({Stack:{Screen:()=>null},useLocalSearchParams:()=>mockParams,useRouter:()=>({push:mockPush,replace:jest.fn(),canGoBack:()=>true,back:mockBack})}));
let tree:ReactTestRenderer;
const text=()=>JSON.stringify(tree.toJSON());
const press=(label:string)=>tree.root.findAll(n=>n.props.accessibilityRole==='button'&&typeof n.props.onPress==='function'&&n.findAll(c=>c.props.children===label).length>0)[0].props.onPress();
beforeEach(()=>{jest.clearAllMocks();mockGated=false;mockParams={};mockDecide.mockReset().mockResolvedValue(undefined);mockConsent={mode:'active',snapshot:{health:null,ai:null,documentVersion:'2026-10-01.1'},healthAllowed:false,aiAllowed:false,pending:false,busy:false,cleanupFailed:false,decide:mockDecide,refresh:mockRefresh};});
afterEach(()=>{act(()=>tree?.unmount());});
const open=async()=>{await act(async()=>{tree=create(<Screen/>);});};
it('offers independent choices without a default grant and keeps account deletion/support accessible',async()=>{
 await open();expect(text()).toContain(copies.de.undecided);expect(text()).toContain(copies.de.healthConsequence);expect(tree.root.findAllByType(DataConsentPanel)).toHaveLength(0);
 act(()=>press(copies.de.account));expect(mockPush).toHaveBeenCalledWith('/account-deletion');
 act(()=>press(copies.de.support));expect(mockPush).toHaveBeenCalledWith('/support');
 act(()=>press(copies.de.viewConsent));const panel=tree.root.findByType(DataConsentPanel);expect(panel.props.active).toBe(true);expect(panel.props.scope).toBe('health');
 await act(async()=>{await panel.props.onDecide(false);});expect(mockDecide).toHaveBeenCalledWith('health','declined','de');
});
it('keeps a failed save reviewable and does not display a grant',async()=>{
 mockDecide.mockRejectedValue(new Error('offline'));await open();act(()=>press(copies.de.viewConsent));
 await act(async()=>{await tree.root.findByType(DataConsentPanel).props.onDecide(true);});
 expect(tree.root.findByType(DataConsentPanel).props.error).toBe(true);expect(text()).toContain(copies.de.error);
});
it('withdrawal is a persisted decision, and a refusal of a previous grant is withdrawal',async()=>{
 mockConsent.snapshot.health={decision:'granted',documentVersion:'2026-10-01.1'};mockConsent.healthAllowed=true;
 await open();await act(async()=>{press(copies.de.revoke);});expect(mockDecide).toHaveBeenCalledWith('health','revoked','de');
 act(()=>press(copies.de.review));await act(async()=>{await tree.root.findByType(DataConsentPanel).props.onDecide(false);});expect(mockDecide).toHaveBeenLastCalledWith('health','revoked','de');
});
it('shows a pending offline withdrawal and a retry instead of server confirmation',async()=>{
 mockConsent.mode='unavailable';mockConsent.pending=true;await open();expect(text()).toContain(copies.de.pending);expect(text()).toContain(copies.de.unavailable);
 act(()=>press(copies.de.retry));expect(mockRefresh).toHaveBeenCalled();expect(tree.root.findAllByType(DataConsentPanel)).toHaveLength(0);
});
it('keeps the effective flow unavailable when the release backend is inactive, with no preview grant',async()=>{
 mockConsent.mode='unavailable';mockConsent.snapshot={enabled:false,health:null,ai:null};
 await open();expect(text()).toContain(copies.de.releasePending);expect(text()).not.toContain(dataConsentCopy.de.settingsIntro);
 expect(tree.root.findAllByType(DataConsentPanel)).toHaveLength(0);expect(text()).not.toContain(copies.de.continue);
 act(()=>press(copies.de.retry));expect(mockRefresh).toHaveBeenCalled();expect(mockDecide).not.toHaveBeenCalled();
});
it('opens the requested AI dialog from a feature hint without granting or reopening after cancel',async()=>{
 mockParams={scope:'ai'};mockConsent.healthAllowed=true;await open();
 const panel=tree.root.findByType(DataConsentPanel);expect(panel.props.scope).toBe('ai');expect(mockDecide).not.toHaveBeenCalled();
 expect(tree.root.findAll(n=>n.props.accessibilityRole==='checkbox')[0].props.accessibilityState.checked).toBe(false);
 act(()=>panel.props.onCancel());
 mockConsent={...mockConsent,busy:true};act(()=>tree.update(<Screen/>));
 mockConsent={...mockConsent,busy:false};act(()=>tree.update(<Screen/>));
 expect(tree.root.findAllByType(DataConsentPanel)).toHaveLength(0);expect(mockDecide).not.toHaveBeenCalled();
});
it('lets the user explicitly agree later and return to the feature after server confirmation',async()=>{
 mockParams={scope:'ai'};mockConsent.healthAllowed=true;await open();
 await act(async()=>{await tree.root.findByType(DataConsentPanel).props.onDecide(true);});
 expect(mockDecide).toHaveBeenCalledWith('ai','granted','de');expect(mockBack).not.toHaveBeenCalled();
 expect(text()).not.toContain(copies.de.returnToFunction);
 mockConsent={...mockConsent,aiAllowed:true};act(()=>tree.update(<Screen/>));
 act(()=>press(copies.de.returnToFunction));expect(mockBack).toHaveBeenCalledTimes(1);
});
it('requests health first when entering an AI feature without its prerequisite',async()=>{
 mockParams={scope:'ai'};await open();expect(tree.root.findByType(DataConsentPanel).props.scope).toBe('health');
 await act(async()=>{await tree.root.findByType(DataConsentPanel).props.onDecide(true);});
 mockConsent={...mockConsent,healthAllowed:true};act(()=>tree.update(<Screen/>));
 expect(tree.root.findByType(DataConsentPanel).props.scope).toBe('ai');
 expect(mockDecide).toHaveBeenCalledWith('health','granted','de');expect(mockDecide).not.toHaveBeenCalledWith('ai','granted','de');
});
it('does not request a new choice before a current server check or during pending withdrawal',async()=>{
 mockParams={scope:'ai'};mockConsent.mode='unavailable';mockConsent.healthAllowed=true;await open();
 expect(tree.root.findAllByType(DataConsentPanel)).toHaveLength(0);
 mockConsent={...mockConsent,mode:'active',pending:true};act(()=>tree.update(<Screen/>));
 expect(tree.root.findAllByType(DataConsentPanel)).toHaveLength(0);
 mockConsent={...mockConsent,pending:false};act(()=>tree.update(<Screen/>));expect(tree.root.findByType(DataConsentPanel).props.scope).toBe('ai');
});
it.each(['unknown',['ai']] as const)('ignores invalid requested scope %s',async(scope)=>{
 mockParams={scope:scope as string|string[]};await open();expect(tree.root.findAllByType(DataConsentPanel)).toHaveLength(0);expect(mockDecide).not.toHaveBeenCalled();
});
it('first run leads through health, then offers the separate AI choice before continuing',async()=>{
 mockGated=true;await open();
 let panel=tree.root.findByType(DataConsentPanel);expect(panel.props.scope).toBe('health');expect(panel.props.step).toEqual({index:1,total:2});
 await act(async()=>{await panel.props.onDecide(true);});
 mockConsent={...mockConsent,healthAllowed:true,snapshot:{...mockConsent.snapshot,health:{decision:'granted',documentVersion:'2026-10-01.1'}}};act(()=>tree.update(<Screen/>));
 panel=tree.root.findByType(DataConsentPanel);expect(panel.props.scope).toBe('ai');expect(panel.props.step).toEqual({index:2,total:2});
 expect(mockDecide).not.toHaveBeenCalledWith('ai','granted','de');expect(mockRelease).not.toHaveBeenCalled();
 await act(async()=>{await panel.props.onDecide(false);});expect(mockDecide).toHaveBeenLastCalledWith('ai','declined','de');
 expect(tree.root.findAllByType(DataConsentPanel)).toHaveLength(0);
 act(()=>press(copies.de.proceed));expect(mockRelease).toHaveBeenCalledTimes(1);
});
it('opened from Settings, returns there via the back button instead of jumping to the app',async()=>{
 mockConsent.snapshot.health={decision:'granted',documentVersion:'2026-10-01.1'};mockConsent.healthAllowed=true;await open();
 expect(text()).not.toContain(copies.de.continue);
 const back=()=>tree.root.findAll(n=>n.props.accessibilityLabel===copies.de.cancel&&typeof n.props.onPress==='function')[0];
 act(()=>press(copies.de.review));expect(tree.root.findAllByType(DataConsentPanel)).toHaveLength(1);
 act(()=>back().props.onPress());expect(tree.root.findAllByType(DataConsentPanel)).toHaveLength(0);expect(mockBack).not.toHaveBeenCalled();
 act(()=>back().props.onPress());expect(mockBack).toHaveBeenCalledTimes(1);
});
