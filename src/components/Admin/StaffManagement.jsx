// src/components/Admin/StaffManagement.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Plus, Edit, Trash2, DollarSign, Award,
  Filter, X, Check, ChevronDown, AlertCircle
} from 'lucide-react';
import { db } from '../../firebase';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  where
} from 'firebase/firestore';
import toast from 'react-hot-toast';

const CAPTION_OPTIONS = [
  { value: 'GE1', label: 'General Effect 1', color: 'bg-purple-500' },
  { value: 'GE2', label: 'General Effect 2', color: 'bg-purple-400' },
  { value: 'VP', label: 'Visual Performance', color: 'bg-blue-500' },
  { value: 'VA', label: 'Visual Analysis', color: 'bg-blue-400' },
  { value: 'CG', label: 'Color Guard', color: 'bg-pink-500' },
  { value: 'B', label: 'Brass', color: 'bg-yellow-500' },
  { value: 'MA', label: 'Music Analysis', color: 'bg-green-500' },
  { value: 'P', label: 'Percussion', color: 'bg-red-500' }
];

const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [captionFilter, setCaptionFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    byCaption: {}
  });

  const [formData, setFormData] = useState({
    name: '',
    caption: 'GE1',
    yearInducted: new Date().getFullYear(),
    biography: '',
    baseValue: 500,
    available: true
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    filterStaff();
  }, [staff, searchTerm, captionFilter]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const staffRef = collection(db, 'staff_database');
      const q = query(staffRef, orderBy('yearInducted', 'desc'));
      const snapshot = await getDocs(q);

      const staffData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setStaff(staffData);

      // Calculate stats
      const captionCounts = {};
      staffData.forEach(member => {
        captionCounts[member.caption] = (captionCounts[member.caption] || 0) + 1;
      });

      setStats({
        total: staffData.length,
        byCaption: captionCounts
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Failed to load staff members');
      setLoading(false);
    }
  };

  const filterStaff = () => {
    let filtered = [...staff];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(member =>
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.biography?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply caption filter
    if (captionFilter !== 'all') {
      filtered = filtered.filter(member => member.caption === captionFilter);
    }

    setFilteredStaff(filtered);
  };

  const handleAddStaff = () => {
    setFormData({
      name: '',
      caption: 'GE1',
      yearInducted: new Date().getFullYear(),
      biography: '',
      baseValue: 500,
      available: true
    });
    setEditingStaff(null);
    setShowAddModal(true);
  };

  const handleEditStaff = (member) => {
    setFormData({
      name: member.name,
      caption: member.caption,
      yearInducted: member.yearInducted,
      biography: member.biography || '',
      baseValue: member.baseValue,
      available: member.available !== false
    });
    setEditingStaff(member);
    setShowAddModal(true);
  };

  const handleDeleteStaff = async (staffId, staffName) => {
    if (!window.confirm(`Are you sure you want to delete ${staffName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'staff_database', staffId));
      toast.success(`Deleted ${staffName}`);
      fetchStaff();
    } catch (error) {
      console.error('Error deleting staff:', error);
      toast.error('Failed to delete staff member');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const staffId = editingStaff
        ? editingStaff.id
        : formData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

      const staffRef = doc(db, 'staff_database', staffId);
      const staffData = {
        name: formData.name,
        caption: formData.caption,
        yearInducted: parseInt(formData.yearInducted),
        biography: formData.biography,
        baseValue: parseInt(formData.baseValue),
        available: formData.available,
        updatedAt: new Date()
      };

      if (editingStaff) {
        await updateDoc(staffRef, staffData);
        toast.success(`Updated ${formData.name}`);
      } else {
        await setDoc(staffRef, {
          ...staffData,
          createdAt: new Date()
        });
        toast.success(`Added ${formData.name}`);
      }

      setShowAddModal(false);
      fetchStaff();
    } catch (error) {
      console.error('Error saving staff:', error);
      toast.error('Failed to save staff member');
    }
  };

  const getCaptionColor = (caption) => {
    const option = CAPTION_OPTIONS.find(opt => opt.value === caption);
    return option?.color || 'bg-gray-500';
  };

  const getCaptionLabel = (caption) => {
    const option = CAPTION_OPTIONS.find(opt => opt.value === caption);
    return option?.label || caption;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cream-100">Staff Database</h2>
          <p className="text-cream-300 text-sm mt-1">
            Manage DCI Hall of Fame members and staff marketplace
          </p>
        </div>
        <button
          onClick={handleAddStaff}
          className="flex items-center gap-2 px-4 py-2 bg-gold-500 text-charcoal-900 rounded-lg hover:bg-gold-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Staff Member
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold-500/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-gold-400" />
            </div>
            <div>
              <p className="text-cream-300 text-sm">Total Staff</p>
              <p className="text-2xl font-bold text-cream-100">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-cream-300 text-sm">General Effect</p>
              <p className="text-2xl font-bold text-cream-100">
                {(stats.byCaption?.GE1 || 0) + (stats.byCaption?.GE2 || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-cream-300 text-sm">Visual</p>
              <p className="text-2xl font-bold text-cream-100">
                {(stats.byCaption?.VP || 0) + (stats.byCaption?.VA || 0) + (stats.byCaption?.CG || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-cream-300 text-sm">Music</p>
              <p className="text-2xl font-bold text-cream-100">
                {(stats.byCaption?.B || 0) + (stats.byCaption?.MA || 0) + (stats.byCaption?.P || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cream-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or biography..."
            className="w-full pl-10 pr-4 py-2 bg-charcoal-800 border border-charcoal-700 rounded-lg text-cream-100 placeholder-cream-400 focus:outline-none focus:border-gold-500"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cream-400" />
          <select
            value={captionFilter}
            onChange={(e) => setCaptionFilter(e.target.value)}
            className="pl-10 pr-8 py-2 bg-charcoal-800 border border-charcoal-700 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500 appearance-none cursor-pointer"
          >
            <option value="all">All Captions</option>
            {CAPTION_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label} ({stats.byCaption[option.value] || 0})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 text-cream-400 pointer-events-none" />
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-charcoal-900/50">
              <tr>
                <th className="text-left px-6 py-3 text-cream-300 text-sm font-semibold">Name</th>
                <th className="text-left px-6 py-3 text-cream-300 text-sm font-semibold">Caption</th>
                <th className="text-left px-6 py-3 text-cream-300 text-sm font-semibold">Year</th>
                <th className="text-left px-6 py-3 text-cream-300 text-sm font-semibold">Value</th>
                <th className="text-left px-6 py-3 text-cream-300 text-sm font-semibold">Status</th>
                <th className="text-right px-6 py-3 text-cream-300 text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-cream-300">
                      <div className="w-5 h-5 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
                      Loading staff members...
                    </div>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-cream-400">
                      <AlertCircle className="w-8 h-8" />
                      <p>No staff members found</p>
                      {searchTerm || captionFilter !== 'all' ? (
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setCaptionFilter('all');
                          }}
                          className="text-gold-400 hover:text-gold-300 text-sm"
                        >
                          Clear filters
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => (
                  <tr key={member.id} className="hover:bg-charcoal-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-cream-100 font-medium">{member.name}</p>
                        <p className="text-cream-400 text-sm line-clamp-1">{member.biography}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-white ${getCaptionColor(member.caption)}`}>
                        {member.caption}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-cream-100">{member.yearInducted}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-gold-400">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-semibold">{member.baseValue}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {member.available !== false ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold">
                          <Check className="w-3 h-3" />
                          Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs font-semibold">
                          <X className="w-3 h-3" />
                          Unavailable
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditStaff(member)}
                          className="p-2 text-cream-300 hover:text-gold-400 hover:bg-charcoal-700 rounded transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(member.id, member.name)}
                          className="p-2 text-cream-300 hover:text-red-400 hover:bg-charcoal-700 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-charcoal-800 border border-charcoal-700 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-cream-100">
                  {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 text-cream-300 hover:text-cream-100 hover:bg-charcoal-700 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-cream-300 text-sm font-semibold mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-charcoal-900 border border-charcoal-700 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500"
                    placeholder="e.g., George Zingali"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-cream-300 text-sm font-semibold mb-2">
                      Caption *
                    </label>
                    <select
                      value={formData.caption}
                      onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                      required
                      className="w-full px-4 py-2 bg-charcoal-900 border border-charcoal-700 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500"
                    >
                      {CAPTION_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-cream-300 text-sm font-semibold mb-2">
                      Year Inducted *
                    </label>
                    <input
                      type="number"
                      value={formData.yearInducted}
                      onChange={(e) => setFormData({ ...formData, yearInducted: e.target.value })}
                      required
                      min="1985"
                      max="2025"
                      className="w-full px-4 py-2 bg-charcoal-900 border border-charcoal-700 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-cream-300 text-sm font-semibold mb-2">
                    Biography
                  </label>
                  <textarea
                    value={formData.biography}
                    onChange={(e) => setFormData({ ...formData, biography: e.target.value })}
                    rows="3"
                    className="w-full px-4 py-2 bg-charcoal-900 border border-charcoal-700 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500"
                    placeholder="e.g., Visual designer and instructor, 27th Lancers..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-cream-300 text-sm font-semibold mb-2">
                      Base Value (CorpsCoin) *
                    </label>
                    <input
                      type="number"
                      value={formData.baseValue}
                      onChange={(e) => setFormData({ ...formData, baseValue: e.target.value })}
                      required
                      min="100"
                      max="10000"
                      className="w-full px-4 py-2 bg-charcoal-900 border border-charcoal-700 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500"
                    />
                  </div>

                  <div>
                    <label className="block text-cream-300 text-sm font-semibold mb-2">
                      Availability
                    </label>
                    <div className="flex items-center gap-4 h-10">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="available"
                          checked={formData.available === true}
                          onChange={() => setFormData({ ...formData, available: true })}
                          className="text-gold-500 focus:ring-gold-500"
                        />
                        <span className="text-cream-100">Available</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="available"
                          checked={formData.available === false}
                          onChange={() => setFormData({ ...formData, available: false })}
                          className="text-gold-500 focus:ring-gold-500"
                        />
                        <span className="text-cream-100">Unavailable</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2 bg-charcoal-700 text-cream-100 rounded-lg hover:bg-charcoal-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gold-500 text-charcoal-900 rounded-lg hover:bg-gold-400 transition-colors font-semibold"
                  >
                    {editingStaff ? 'Update Staff' : 'Add Staff'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StaffManagement;
