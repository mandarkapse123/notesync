import React, { useState } from 'react';
import { X, Flame, Key, Check, AlertCircle, RefreshCw, Database, Code } from 'lucide-react';
import { getStoredFirebaseConfig, saveFirebaseConfig, testFirebaseConnection, FirebaseConfig } from '../lib/firebase';
import { syncService } from '../services/syncService';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const currentConfig = getStoredFirebaseConfig();
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '');
  const [authDomain, setAuthDomain] = useState(currentConfig?.authDomain || '');
  const [projectId, setProjectId] = useState(currentConfig?.projectId || '');
  const [appId, setAppId] = useState(currentConfig?.appId || '');

  const [rawPaste, setRawPaste] = useState('');
  const [showRawPaste, setShowRawPaste] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  // Helper to parse pasted firebaseConfig snippet
  const handleParseRaw = () => {
    try {
      const jsonMatch = rawPaste.match(/\{[\s\S]*\}/);
      const strToParse = jsonMatch ? jsonMatch[0] : rawPaste;

      const formatted = strToParse
        .replace(/(\w+):/g, '"$1":')
        .replace(/'/g, '"')
        .replace(/,\s*}/g, '}');

      const parsed = JSON.parse(formatted);
      if (parsed.apiKey) setApiKey(parsed.apiKey);
      if (parsed.authDomain) setAuthDomain(parsed.authDomain);
      if (parsed.projectId) setProjectId(parsed.projectId);
      if (parsed.appId) setAppId(parsed.appId);

      setShowRawPaste(false);
      setTestResult({ ok: true, message: 'Firebase configuration parsed! Click Connect below.' });
    } catch (err) {
      setTestResult({ ok: false, message: 'Could not auto-parse snippet. Please fill inputs manually.' });
    }
  };

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !projectId.trim()) {
      setTestResult({ ok: false, message: 'Please provide at least API Key and Project ID.' });
      return;
    }

    const config: FirebaseConfig = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      projectId: projectId.trim(),
      storageBucket: `${projectId.trim()}.appspot.com`,
      appId: appId.trim() || 'notesync-web-app',
    };

    setIsTesting(true);
    setTestResult(null);

    const result = await testFirebaseConnection(config);
    setIsTesting(false);
    setTestResult(result);

    if (result.ok) {
      saveFirebaseConfig(config);
      onConfigSaved();
      await syncService.pullAll();
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  const handleDisconnect = () => {
    saveFirebaseConfig(null);
    setApiKey('');
    setProjectId('');
    setTestResult({ ok: true, message: 'Disconnected from Firebase.' });
    onConfigSaved();
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md rounded-3xl bg-white dark:bg-ios-gray-900 border border-ios-gray-200 dark:border-ios-gray-800 p-5 shadow-ios-modal space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ios-gray-100 dark:border-ios-gray-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100">
                Firebase Cloud Backend
              </h3>
              <p className="text-xs text-ios-gray-500">
                100% Free Realtime Sync (No paid storage needed)
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

        {/* Quick Paste Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Firebase Credentials
          </span>
          <button
            type="button"
            onClick={() => setShowRawPaste(!showRawPaste)}
            className="flex items-center gap-1 text-[11px] text-ios-blue font-semibold hover:underline"
          >
            <Code className="w-3 h-3" />
            <span>{showRawPaste ? 'Manual Inputs' : 'Paste Config Object'}</span>
          </button>
        </div>

        {showRawPaste ? (
          <div className="space-y-2 p-3 rounded-2xl bg-ios-gray-50 dark:bg-ios-gray-800/50 border border-ios-gray-200 dark:border-ios-gray-700">
            <label className="block text-[11px] text-ios-gray-500">
              Paste your <code className="font-mono">const firebaseConfig = &#123; ... &#125;;</code> snippet:
            </label>
            <textarea
              rows={4}
              value={rawPaste}
              onChange={(e) => setRawPaste(e.target.value)}
              placeholder='apiKey: "AIza...", projectId: "notesync", ...'
              className="w-full text-xs font-mono p-2 rounded-xl bg-white dark:bg-ios-gray-900 border border-ios-gray-300 dark:border-ios-gray-700 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleParseRaw}
              className="w-full py-1.5 bg-ios-blue text-white text-xs font-semibold rounded-xl hover:bg-blue-600 shadow-sm"
            >
              Parse & Auto-Fill
            </button>
          </div>
        ) : (
          <form onSubmit={handleTestAndSave} className="space-y-2.5">
            {/* Project ID */}
            <div>
              <label className="block text-[11px] font-medium text-ios-gray-600 dark:text-ios-gray-400 mb-1">
                Project ID *
              </label>
              <input
                type="text"
                placeholder="e.g. notesync-app-123"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-ios-gray-100 dark:bg-ios-gray-800 border border-ios-gray-200/50 dark:border-ios-gray-700/50 font-mono text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* API Key */}
            <div>
              <label className="block text-[11px] font-medium text-ios-gray-600 dark:text-ios-gray-400 mb-1">
                API Key (apiKey) *
              </label>
              <div className="relative">
                <Key className="w-3.5 h-3.5 text-ios-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-ios-gray-100 dark:bg-ios-gray-800 border border-ios-gray-200/50 dark:border-ios-gray-700/50 font-mono text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* App ID */}
            <div>
              <label className="block text-[11px] font-medium text-ios-gray-600 dark:text-ios-gray-400 mb-1">
                App ID (appId)
              </label>
              <input
                type="text"
                placeholder="1:123456789:web:abcdef"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-ios-gray-100 dark:bg-ios-gray-800 border border-ios-gray-200/50 dark:border-ios-gray-700/50 font-mono text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500"
              />
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
              {currentConfig ? (
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
                  disabled={isTesting || !apiKey.trim() || !projectId.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-500 text-white rounded-xl hover:bg-amber-600 active:scale-95 disabled:opacity-50 transition-all shadow-sm"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Flame className="w-3.5 h-3.5 fill-current" />
                      <span>Save & Connect</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Firestore only reminder */}
        <div className="p-3 rounded-2xl bg-ios-gray-50 dark:bg-ios-gray-800/40 border border-ios-gray-200/60 dark:border-ios-gray-700/40 text-[11px] text-ios-gray-500 space-y-1">
          <div className="flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-300">
            <Database className="w-3 h-3 text-amber-500" />
            <span>Only Cloud Firestore is required:</span>
          </div>
          <p>
            You only need to enable <strong>Firestore Database</strong> in test mode. No Cloud Storage setup or paid plans required!
          </p>
        </div>
      </div>
    </div>
  );
};
