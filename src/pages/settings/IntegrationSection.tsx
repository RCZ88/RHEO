import { motion } from 'framer-motion';
import { Key, Shield, Sparkles, Wand2, Compass, Route, Network, Cpu, Eye, EyeOff, Plus, Check, X, AlertTriangle, Loader2, Brain, Bot, Globe, Mail, Calendar } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { SearchableSection } from './shared';

export function IntegrationSection(props: any) {
  const { openRouterApiKey, setOpenRouterApiKey, apiKeyTestStatus, setApiKeyTestStatus, apiKeyTestMessage, setApiKeyTestMessage, aiConfig, setAiConfig, aiProviders, setAiProviders, aiProviderRouting, setAiProviderRouting, providerTestStatus, setProviderTestStatus, providerTestMessages, setProviderTestMessages, showProviderApiKeys, setShowProviderApiKeys, interestTopics, setInterestTopics, newTopic, setNewTopic, kbDocs, setKbDocs, kbIngesting, setKbIngesting, kbQueryText, setKbQueryText, kbResults, setKbResults, kbQuerying, setKbQuerying, dataAccess, setDataAccess, agentColorOverrides, setAgentColorOverrides, sttApiKey, setSttApiKey, sttModel, setSttModel, sttBaseUrl, setSttBaseUrl, showSttKey, setShowSttKey, settingsSearch } = props;

  return (
    <div data-section="settings.integration" className="space-y-4">
      <SearchableSection terms={['openrouter', 'api key', 'provider', 'routing', 'daily brief', 'research', 'topics', 'usage', 'cost', 'data access', 'multi-provider']} search={settingsSearch}>
      <GlassCard className="space-y-6">
        <div><h2 className="text-lg font-semibold mb-1">AI Assistant</h2><p className="text-xs text-zinc-500">Configure AI briefing, weekly review, and research features</p></div>
        <div><label className="text-sm font-medium text-zinc-400 mb-2 block">OpenRouter API Key</label><div className="relative"><input type={showApiKey ? 'text' : 'password'} placeholder="sk-or-v1-..." value={openRouterApiKey} onChange={(e) => { setOpenRouterApiKey(e.target.value); setApiKeyTestStatus('idle'); }} className="w-full px-3 py-2 text-sm bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono pr-10" /><button onClick={() => setShowApiKey(prev => !prev)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300">{showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
      </GlassCard>
      </SearchableSection>
      <SearchableSection terms={['voice', 'speech', 'dictation', 'microphone', 'stt', 'speech api key', 'whisper']} search={settingsSearch}>
      <GlassCard className="space-y-4">
        <div><h2 className="text-lg font-semibold mb-1">Voice & Speech</h2><p className="text-xs text-zinc-500">Dictation engine order: Cloud API → Windows speech → Browser speech</p></div>
        <div><label className="text-sm font-medium text-zinc-400 mb-2 block">Speech API Key</label><div className="relative"><input type={showSttKey ? 'text' : 'password'} placeholder="gsk_..." value={sttApiKey} onChange={(e) => setSttApiKey(e.target.value)} className="w-full px-3 py-2 text-sm bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono pr-10" /><button onClick={() => setShowSttKey(prev => !prev)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300">{showSttKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
      </GlassCard>
      </SearchableSection>
    </div>
  );
}
