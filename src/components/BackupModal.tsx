import React, { useState } from 'react';
import { X, Download, Upload, Database, Check } from 'lucide-react';
import { db } from '../db';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      const notes = await db.notes.toArray();
      const topics = await db.topics.toArray();
      const tags = await db.tags.toArray();

      // Convert audioBlobs to base64 for JSON export if needed, or export text notes
      const notesExport = await Promise.all(
        notes.map(async (n) => {
          let audioBase64: string | undefined = undefined;
          if (n.audioBlob) {
            audioBase64 = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(n.audioBlob!);
            });
          }
          const { audioBlob, ...rest } = n;
          return { ...rest, audioBase64 };
        })
      );

      const backupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        notes: notesExport,
        topics,
        tags,
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notesync_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMsg('Backup downloaded successfully! ✅');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error('Export failed:', err);
      setStatusMsg('Export failed.');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.topics && Array.isArray(data.topics)) {
        await db.topics.bulkPut(data.topics);
      }
      if (data.tags && Array.isArray(data.tags)) {
        await db.tags.bulkPut(data.tags);
      }
      if (data.notes && Array.isArray(data.notes)) {
        const notesToPut = await Promise.all(
          data.notes.map(async (n: any) => {
            let audioBlob: Blob | undefined = undefined;
            if (n.audioBase64) {
              const res = await fetch(n.audioBase64);
              audioBlob = await res.blob();
            }
            const { audioBase64, ...rest } = n;
            return { ...rest, audioBlob };
          })
        );
        await db.notes.bulkPut(notesToPut);
      }

      setStatusMsg('Data restored successfully! 🎉');
      setTimeout(() => {
        setStatusMsg(null);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Import failed:', err);
      setStatusMsg('Invalid backup file.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-ios-gray-900 border border-ios-gray-200 dark:border-ios-gray-800 p-5 shadow-ios-modal space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-ios-blue" />
            <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100">Backup & Restore</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-ios-gray-400 hover:text-ios-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-ios-gray-500 leading-relaxed">
          Your notes and voice memos are stored 100% locally and privately on your device. Export a backup file anytime to keep safe or transfer to another device.
        </p>

        {statusMsg && (
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-medium flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>{statusMsg}</span>
          </div>
        )}

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleExport}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-ios-blue text-white text-xs font-semibold hover:bg-blue-600 active:scale-95 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export Backup (JSON)
          </button>

          <label className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-ios-gray-200 dark:border-ios-gray-800 bg-ios-gray-50 dark:bg-ios-gray-800/50 text-ios-gray-700 dark:text-ios-gray-300 text-xs font-semibold hover:bg-ios-gray-100 cursor-pointer active:scale-95 transition-all">
            <Upload className="w-3.5 h-3.5" />
            Restore from Backup
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};
