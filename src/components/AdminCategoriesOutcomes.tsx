import React, { useState } from 'react';
import { Edit3, Plus, Power } from 'lucide-react';
import { Category } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { createCategory, updateCategory } from '../lib/firestoreService';

export const AdminCategoriesOutcomes: React.FC = () => {
  const { categories } = useAuth();

  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setSaving(true);
    try {
      if (editingCat) {
        await updateCategory(editingCat.id, {
          name: catName.trim(),
          description: catDesc.trim(),
          active: editingCat.active,
        });
      } else {
        await createCategory(catName.trim(), catDesc.trim());
      }
      setCatName('');
      setCatDesc('');
      setEditingCat(null);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCategory = async (c: Category) => {
    await updateCategory(c.id, {
      name: c.name,
      description: c.description,
      active: !c.active,
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">
          {editingCat ? 'Edit Work Category' : 'Add Suggested Work Category'}
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Active categories appear as suggestions when employees log work. Employees can also type custom categories or set personal task &amp; outcome presets.
        </p>
        <form onSubmit={handleSaveCategory} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            required
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="Category Name (e.g., NIAT - Learnings)"
            className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="text"
            value={catDesc}
            onChange={(e) => setCatDesc(e.target.value)}
            placeholder="Short description..."
            className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {editingCat ? 'Update Category' : 'Add Category'}
            </button>
            {editingCat && (
              <button
                type="button"
                onClick={() => {
                  setEditingCat(null);
                  setCatName('');
                  setCatDesc('');
                }}
                className="px-3 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
              <th className="py-3 px-4">Category Name</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-medium text-slate-900">{c.name}</td>
                <td className="py-3 px-4 text-slate-600">{c.description || '-'}</td>
                <td className="py-3 px-4 text-xs">
                  <span className={c.active ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                    {c.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCat(c);
                      setCatName(c.name);
                      setCatDesc(c.description);
                    }}
                    className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-50"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleCategory(c)}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 ml-1"
                    title={c.active ? 'Deactivate' : 'Activate'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
