import React, { useState } from 'react';
import { X, Cloud, Key, Link as LinkIcon, Check, AlertCircle, RefreshCw, Database } from 'lucide-react';
import { getStoredSupabaseConfig, saveSupabaseConfig, testSupabaseConnection } from '../lib/supabase';
import { syncService } from '../services/syncService';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const currentConfig = getStoredSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({ ok: false, message: 'Please enter both Supabase URL and Anon Key.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const result = await testSupabaseConnection(url.trim(), anonKey.trim());
    setIsTesting(false);
    setTestResult(result);

    if (result.ok) {
      saveSupabaseConfig(url.trim(), anonKey.trim());
      onConfigSaved();
      // Trigger initial pull
      await syncService.pullAll();
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  const handleDisconnect = () => {
    saveSupabaseConfig('', '');
    setUrl('');
    setAnonKey('');
    setTestResult({ ok: true, message: 'Disconnected from Supabase.' });
    onConfigSaved();
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md rounded-3xl bg-white dark:bg-ios-gray-900 border border-ios-gray-200 dark:border-ios-gray-800 p-5 shadow-ios-modal space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ios-gray-100 dark:border-ios-gray-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100">
                Supabase Cloud Backend
              </h3>
              <p className="text-xs text-ios-gray-500">
                Sync notes & voice memos across all your devices
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-ios-gray-400 hover:text-ios-gray-600 dark:hover:text-ios-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleTestAndSave} className="space-y-3.5">
          {/* Supabase Project URL */}
          <div>
            <label className="block text-xs font-medium text-ios-gray-600 dark:text-ios-gray-400 mb-1">
              Project URL
            </label>
            <div className="relative">
              <LinkIcon className="w-3.5 h-3.5 text-ios-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                placeholder="https://xyzcompany.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-ios-gray-100 dark:bg-ios-gray-800 border border-ios-gray-200/50 dark:border-ios-gray-700/50 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-ios-blue font-mono"
              />
            </div>
          </div>

          {/* Supabase Anon Key */}
          <div>
            <label className="block text-xs font-medium text-ios-gray-600 dark:text-ios-gray-400 mb-1">
              Anon / Public API Key
            </label>
            <div className="relative">
              <Key className="w-3.5 h-3.5 text-ios-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-ios-gray-100 dark:bg-ios-gray-800 border border-ios-gray-200/50 dark:border-ios-gray-700/50 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-ios-blue font-mono"
              />
            </div>
          </div>

          {/* Status Message */}
          {testResult && (
            <div
              className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                testResult.ok
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
              }`}
            >
              {testResult.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-ios-gray-100 dark:border-ios-gray-800">
            {currentConfig.url ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Disconnect
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-semibold text-ios-gray-600 dark:text-ios-gray-400 hover:bg-ios-gray-100 dark:hover:bg-ios-gray-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isTesting || !url.trim() || !anonKey.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all shadow-sm"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Save & Connect</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Quick SQL schema tip */}
        <div className="p-3 rounded-2xl bg-ios-gray-50 dark:bg-ios-gray-800/40 border border-ios-gray-200/60 dark:border-ios-gray-700/40 text-[11px] text-ios-gray-500 space-y-1">
          <div className="flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-300">
            <Database className="w-3 h-3 text-ios-blue" />
            <span>Database Setup Reminder:</span>
          </div>
          <p>
            Make sure to run the <code className="bg-ios-gray-200 dark:bg-ios-gray-700 px-1 py-0.5 rounded text-ios-blue font-mono">supabase_schema.sql</code> script in your Supabase SQL Editor to create the tables and audio storage bucket.
          </p>
        </div>
      </div>
    </div>
  );
};
