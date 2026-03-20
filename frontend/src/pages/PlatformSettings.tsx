import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, Eye, Info, Brain, MessageSquare } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface AppSettings {
  login_banner: string;
  llm_model: string;
}

const MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', desc: 'Fastest, lowest cost' },
  { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6', desc: 'Recommended — balanced quality and speed' },
  { id: 'claude-opus-4-6',           label: 'Claude Opus 4.6',   desc: 'Most capable, best document quality' },
];

export default function PlatformSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [banner, setBanner] = useState('');
  const [llmModel, setLlmModel] = useState('claude-sonnet-4-6');
  const [previewBanner, setPreviewBanner] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ['platform-settings'],
    queryFn: () => api.get('/settings'),
    enabled: user?.role === 'admin',
  });

  useEffect(() => {
    if (settings) {
      setBanner(settings.login_banner ?? '');
      setLlmModel(settings.llm_model ?? 'claude-sonnet-4-6');
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => api.patch('/settings', { login_banner: banner, llm_model: llmModel }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-settings'] });
      qc.invalidateQueries({ queryKey: ['llm-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (user?.role !== 'admin') {
    return (
      <div className="card p-8 text-center text-slate-500">
        Platform settings are only accessible to administrators.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="section-header">Platform Settings</h2>
        <p className="section-subtitle">Configure platform-wide settings visible to all users</p>
      </div>

      {/* Login Banner */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare size={15} className="text-primary-400" />
          <h3 className="font-semibold text-sm text-slate-200">Login Page Banner</h3>
        </div>
        <p className="text-xs text-slate-400">
          This message is displayed on the login page before users enter their credentials.
          Use it for system notices, compliance statements, terms of use reminders, or maintenance windows.
        </p>

        <div>
          <label className="label">Banner message</label>
          <textarea
            rows={5}
            className="input w-full font-mono text-sm"
            placeholder="e.g. This system is for authorized users only. All activity is monitored and logged. Unauthorized access is prohibited and will be prosecuted to the fullest extent of the law."
            value={banner}
            onChange={e => setBanner(e.target.value)}
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-slate-500">{banner.length} characters — leave blank to hide the banner</span>
            <button
              onClick={() => setPreviewBanner(v => !v)}
              className="btn-ghost text-xs flex items-center gap-1 text-slate-400"
            >
              <Eye size={11} />
              {previewBanner ? 'Hide preview' : 'Preview'}
            </button>
          </div>
        </div>

        {/* Live preview */}
        {previewBanner && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
            <Info size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-300 whitespace-pre-wrap leading-relaxed flex-1">
              {banner || <span className="italic text-amber-500/60">Banner is empty — nothing will be shown</span>}
            </p>
          </div>
        )}
      </div>

      {/* LLM Model */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Brain size={15} className="text-primary-400" />
          <h3 className="font-semibold text-sm text-slate-200">AI Model (LLM)</h3>
        </div>
        <p className="text-xs text-slate-400">
          Selects the Claude model used for AI evidence review and ATO document generation.
        </p>
        <div className="space-y-2">
          {MODELS.map(m => (
            <label
              key={m.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                llmModel === m.id
                  ? 'border-primary-600 bg-primary-900/30'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name="llm"
                value={m.id}
                checked={llmModel === m.id}
                onChange={() => setLlmModel(m.id)}
                className="mt-0.5"
              />
              <div>
                <div className={`text-sm font-medium ${llmModel === m.id ? 'text-primary-300' : 'text-slate-200'}`}>{m.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{m.desc}</div>
                <div className="text-xs font-mono text-slate-600 mt-0.5">{m.id}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="btn-primary"
        >
          <Save size={14} />
          {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-sm text-emerald-400">Settings saved.</span>}
      </div>
    </div>
  );
}
