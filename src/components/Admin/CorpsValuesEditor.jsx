// src/components/Admin/CorpsValuesEditor.jsx
// Admin editor for the per-season corps point values stored at dci-data/{dataDocId}.
// Lets an admin pick any season doc, edit/add/delete corps entries, change point
// values, save the whole array back, or create a brand new season doc.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Database, Plus, Trash2, Save, RefreshCw, AlertCircle, X, FilePlus } from 'lucide-react';
import {
  listDciDataDocIds,
  getSeasonSettings,
  getCorpsValues,
  saveCorpsValues,
  createDciDataDoc,
} from '../../api/admin';
import toast from 'react-hot-toast';

const emptyRow = () => ({ corpsName: '', sourceYear: new Date().getFullYear(), points: 0 });

const CorpsValuesEditor = () => {
  const [seasonDocIds, setSeasonDocIds] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [rows, setRows] = useState([]);
  const [originalJson, setOriginalJson] = useState('[]');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showNewSeasonModal, setShowNewSeasonModal] = useState(false);
  const [newSeasonId, setNewSeasonId] = useState('');
  const [creatingSeason, setCreatingSeason] = useState(false);

  const isDirty = useMemo(() => JSON.stringify(rows) !== originalJson, [rows, originalJson]);

  // Load list of dci-data docs
  const loadSeasonDocs = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const ids = await listDciDataDocIds();
      setSeasonDocIds(ids);
      if (ids.length > 0) {
        // Default to the active season if we can read it; otherwise first id.
        // A functional update keeps any existing selection, so this callback
        // doesn't need to depend on selectedDocId.
        const season = await getSeasonSettings();
        const activeId = season ? season.dataDocId : null;
        setSelectedDocId(
          (prev) => prev || (activeId && ids.includes(activeId) ? activeId : ids[0])
        );
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadSeasonDocs();
  }, [loadSeasonDocs]);

  // Load corps values for the selected doc
  useEffect(() => {
    if (!selectedDocId) return;
    const loadDoc = async () => {
      setLoadingDoc(true);
      setError(null);
      try {
        const values = await getCorpsValues(selectedDocId);
        const sorted = [...values].sort((a, b) => (b.points || 0) - (a.points || 0));
        setRows(sorted);
        setOriginalJson(JSON.stringify(sorted));
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoadingDoc(false);
      }
    };
    loadDoc();
  }, [selectedDocId]);

  const updateRow = (idx, field, value) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        if (field === 'points' || field === 'sourceYear') {
          const n = value === '' ? '' : Number(value);
          return { ...r, [field]: n };
        }
        return { ...r, [field]: value };
      })
    );
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const deleteRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const discardChanges = () => {
    setRows(JSON.parse(originalJson));
  };

  const handleSave = async () => {
    // Validate
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.corpsName || !r.corpsName.trim()) {
        toast.error(`Row ${i + 1}: corps name is required`);
        return;
      }
      if (r.sourceYear === '' || !Number.isFinite(Number(r.sourceYear))) {
        toast.error(`Row ${i + 1}: source year must be a number`);
        return;
      }
      if (r.points === '' || !Number.isFinite(Number(r.points))) {
        toast.error(`Row ${i + 1}: points must be a number`);
        return;
      }
    }

    if (
      !window.confirm(
        `Save ${rows.length} corps entries to dci-data/${selectedDocId}?\n\nThis overwrites the corpsValues array for that season.`
      )
    )
      return;

    setSaving(true);
    try {
      const normalized = rows.map((r) => ({
        corpsName: r.corpsName.trim(),
        sourceYear: Number(r.sourceYear),
        points: Number(r.points),
      }));
      await saveCorpsValues(selectedDocId, normalized);
      const resorted = [...normalized].sort((a, b) => b.points - a.points);
      setRows(resorted);
      setOriginalJson(JSON.stringify(resorted));
      toast.success(`Saved ${normalized.length} corps to ${selectedDocId}`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSeason = async () => {
    const id = newSeasonId.trim();
    if (!id) return toast.error('Enter a season doc ID');
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      return toast.error('Use letters, numbers, _ or - only');
    }
    if (seasonDocIds.includes(id)) {
      return toast.error('A season with that ID already exists');
    }
    setCreatingSeason(true);
    try {
      await createDciDataDoc(id);
      toast.success(`Created dci-data/${id}`);
      setNewSeasonId('');
      setShowNewSeasonModal(false);
      await loadSeasonDocs();
      setSelectedDocId(id);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to create season');
    } finally {
      setCreatingSeason(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header / controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Database className="w-4 h-4 text-muted flex-shrink-0" />
          <label className="text-[10px] uppercase tracking-wider text-muted">Season Doc</label>
          <select
            value={selectedDocId}
            onChange={(e) => {
              if (isDirty && !window.confirm('Discard unsaved changes?')) return;
              setSelectedDocId(e.target.value);
            }}
            disabled={loadingList || saving}
            className="flex-1 max-w-xs px-2 py-1.5 bg-surface-sunken border border-line text-xs text-white font-data focus:outline-none focus:border-interactive disabled:opacity-50"
          >
            {seasonDocIds.length === 0 && <option value="">(none)</option>}
            {seasonDocIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={loadSeasonDocs}
          disabled={loadingList}
          className="flex items-center gap-1.5 h-8 px-2 text-[10px] font-bold uppercase bg-white/5 text-secondary border border-line hover:bg-white/10 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${loadingList ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button
          onClick={() => setShowNewSeasonModal(true)}
          className="flex items-center gap-1.5 h-8 px-2 text-[10px] font-bold uppercase bg-interactive/10 text-interactive border border-interactive/20 hover:bg-interactive hover:text-white transition-colors"
        >
          <FilePlus className="w-3 h-3" />
          New Season
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-900/20 border border-red-500/30 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-sunken border border-line overflow-hidden">
        <div className="bg-surface-raised px-3 py-2 border-b border-line flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {selectedDocId ? `${selectedDocId} — ${rows.length} corps` : 'Select a season'}
          </span>
          {isDirty && (
            <span className="text-[10px] font-bold uppercase text-warning">Unsaved changes</span>
          )}
        </div>

        {loadingDoc ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            Loading...
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-xs">
              <thead className="bg-surface-card sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted font-bold">
                    #
                  </th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted font-bold">
                    Corps Name
                  </th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted font-bold w-28">
                    Source Year
                  </th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted font-bold w-24">
                    Points
                  </th>
                  <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-muted font-bold w-16">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/5">
                    <td className="px-3 py-1.5 text-muted font-data tabular-nums">{idx + 1}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={row.corpsName}
                        onChange={(e) => updateRow(idx, 'corpsName', e.target.value)}
                        className="w-full px-2 py-1 bg-background border border-line text-xs text-white focus:outline-none focus:border-interactive"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        value={row.sourceYear}
                        onChange={(e) => updateRow(idx, 'sourceYear', e.target.value)}
                        className="w-full px-2 py-1 bg-background border border-line text-xs text-white font-data tabular-nums focus:outline-none focus:border-interactive"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        value={row.points}
                        onChange={(e) => updateRow(idx, 'points', e.target.value)}
                        className="w-full px-2 py-1 bg-background border border-line text-xs text-white font-data tabular-nums focus:outline-none focus:border-interactive"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        onClick={() => deleteRow(idx)}
                        className="inline-flex items-center justify-center w-6 h-6 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted">
                      No corps yet. Click "Add Corps" below to add one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-3 py-2 border-t border-line bg-surface-card">
          <button
            onClick={addRow}
            disabled={!selectedDocId || loadingDoc}
            className="flex items-center gap-1.5 h-7 px-2 text-[10px] font-bold uppercase bg-interactive/10 text-interactive border border-interactive/20 hover:bg-interactive hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Corps
          </button>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={discardChanges}
          disabled={!isDirty || saving}
          className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase bg-white/5 text-secondary border border-line hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Discard
        </button>
        <button
          onClick={handleSave}
          disabled={!isDirty || saving || !selectedDocId}
          className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase bg-interactive text-white border border-interactive hover:bg-interactive-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* New Season Modal */}
      {showNewSeasonModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card border border-line w-full max-w-sm">
            <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Create Season Doc
              </h2>
              <button
                onClick={() => setShowNewSeasonModal(false)}
                className="text-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] text-muted uppercase mb-2">Season Doc ID</label>
                <input
                  type="text"
                  placeholder="e.g. live_25 or off_summer_2025"
                  value={newSeasonId}
                  onChange={(e) => setNewSeasonId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-sunken border border-line text-sm text-white font-data focus:outline-none focus:border-interactive"
                />
                <p className="text-[10px] text-muted mt-1">
                  Creates an empty dci-data/&lt;id&gt; doc. Letters, numbers, _ and - only.
                </p>
              </div>
              <button
                onClick={handleCreateSeason}
                disabled={creatingSeason || !newSeasonId.trim()}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-interactive text-white text-xs font-bold hover:bg-interactive-hover disabled:opacity-50"
              >
                {creatingSeason ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FilePlus className="w-3.5 h-3.5" />
                )}
                {creatingSeason ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorpsValuesEditor;
