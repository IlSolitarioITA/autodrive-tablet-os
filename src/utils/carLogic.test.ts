import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_APPS,
  buildAndroidMediaIntent,
  calculateBatteryImpactEstimate,
  parseLocalVoiceCommand,
  resolveVoiceEngineDecision,
} from './carLogic';

const metrolistApp = INITIAL_APPS.find((a) => a.id === 'metrolist')!;

test('parseLocalVoiceCommand parses song playback on Metrolist with explicit package intent', () => {
  const result = parseLocalVoiceCommand(
    'Riproduci Blinding Lights su Metrolist',
    metrolistApp,
    INITIAL_APPS
  );

  assert.equal(result.action, 'PLAY_MEDIA');
  assert.equal(result.query, 'Blinding Lights');
  assert.equal(result.targetAppId, 'metrolist');
  assert.equal(result.targetPackage, 'com.metrolist.music');
  assert.ok(result.androidIntentUri.includes('com.metrolist.music'));
  assert.ok(result.androidIntentUri.includes('MEDIA_PLAY_FROM_SEARCH'));
});

test('parseLocalVoiceCommand routes to default music app when app name is omitted', () => {
  const vlcApp = INITIAL_APPS.find((a) => a.id === 'vlc')!;
  const result = parseLocalVoiceCommand('Riproduci Veridis Quo', vlcApp, INITIAL_APPS);

  assert.equal(result.action, 'PLAY_MEDIA');
  assert.equal(result.query, 'Veridis Quo');
  assert.equal(result.targetAppId, 'vlc');
  assert.equal(result.targetPackage, 'org.videolan.vlc');
});

test('parseLocalVoiceCommand handles media transport, navigation, and WhatsApp commands', () => {
  const nextCmd = parseLocalVoiceCommand('Brano successivo', metrolistApp, INITIAL_APPS);
  assert.equal(nextCmd.action, 'NEXT_TRACK');
  assert.ok(nextCmd.androidIntentUri.includes('KEY_EVENT=87'));

  const navCmd = parseLocalVoiceCommand('Portami a Piazza Duomo Milano', metrolistApp, INITIAL_APPS);
  assert.equal(navCmd.action, 'NAVIGATE_TO');
  assert.equal(navCmd.destination, 'Piazza Duomo Milano');
  assert.ok(navCmd.androidIntentUri.startsWith('google.navigation:q='));

  const waReply = parseLocalVoiceCommand(
    'Rispondi a Marco Sto guidando arrivo tra 10 minuti',
    metrolistApp,
    INITIAL_APPS
  );
  assert.equal(waReply.action, 'REPLY_MESSAGE');
  assert.equal(waReply.recipient, 'Marco');
  assert.equal(waReply.replyText, 'Sto guidando arrivo tra 10 minuti');
});

test('resolveVoiceEngineDecision switches automatically from Gemini to local offline when quota is exhausted or offline', () => {
  const activeGemini = resolveVoiceEngineDecision(
    { mode: 'hybrid_gemini_first', dailyGeminiLimit: 25, dailyGeminiUsed: 10 },
    true
  );
  assert.equal(activeGemini.selectedEngine, 'gemini_cloud');
  assert.equal(activeGemini.autoSwitched, false);
  assert.equal(activeGemini.remainingQuota, 15);

  const exhaustedQuota = resolveVoiceEngineDecision(
    { mode: 'hybrid_gemini_first', dailyGeminiLimit: 25, dailyGeminiUsed: 25 },
    true
  );
  assert.equal(exhaustedQuota.selectedEngine, 'local_offline');
  assert.equal(exhaustedQuota.autoSwitched, true);
  assert.equal(exhaustedQuota.remainingQuota, 0);

  const offlineState = resolveVoiceEngineDecision(
    { mode: 'hybrid_gemini_first', dailyGeminiLimit: 25, dailyGeminiUsed: 3 },
    false
  );
  assert.equal(offlineState.selectedEngine, 'local_offline');
  assert.equal(offlineState.autoSwitched, true);
});

test('calculateBatteryImpactEstimate confirms tablet Wi-Fi router saves >85% smartphone battery vs ZLink hotspot', () => {
  const tabletRouter = calculateBatteryImpactEstimate('tablet_wifi_router', 60);
  const legacyZlink = calculateBatteryImpactEstimate('legacy_zlink_hotspot', 60);

  assert.equal(tabletRouter.phoneHotspotRequired, false);
  assert.equal(legacyZlink.phoneHotspotRequired, true);
  assert.ok(tabletRouter.estimatedTripDrainPercent < legacyZlink.estimatedTripDrainPercent * 0.15);
});

test('buildAndroidMediaIntent generates valid Android intent URI strings', () => {
  const uri = buildAndroidMediaIntent(metrolistApp, 'PLAY_SEARCH', 'Midnight City');
  assert.equal(
    uri,
    'intent:#Intent;action=android.media.action.MEDIA_PLAY_FROM_SEARCH;package=com.metrolist.music;S.query=Midnight%20City;S.android.intent.extra.focus=vnd.android.cursor.item%2F*;end'
  );
});
