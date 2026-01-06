// src/components/Admin/ArticleManagement.jsx
// Admin article management - list, edit, archive articles
// Follows Admin panel dark theme: bg-[#0a0a0a], bg-[#1a1a1a], bg-[#222]

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Search, RefreshCw, Edit3, Archive, ArchiveRestore,
  Trash2, X, Save, Eye, EyeOff, ChevronDown, ChevronUp,
  Calendar, Clock, AlertCircle, Check, Image, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listAllArticles,
  getArticleForEdit,
  updateArticle,
  archiveArticle,
  deleteArticle,
  regenerateArticleImage
} from '../../api/functions';

// Filter tabs
const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'archived', label: 'Archived' },
];

// Source badge colors
const SOURCE_COLORS = {
  current_season: 'bg-blue-500/20 text-blue-400',
  legacy: 'bg-purple-500/20 text-purple-400',
};

const PAGE_SIZE = 20;

const ArticleManagement = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [editingArticle, setEditingArticle] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastCreatedAt, setLastCreatedAt] = useState(null);

  // Load articles on mount
  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async (startAfter = null) => {
    try {
      if (startAfter) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      const result = await listAllArticles({ limit: PAGE_SIZE, startAfter });
      if (result.data.success) {
        if (startAfter) {
          // Append to existing articles
          setArticles(prev => [...prev, ...result.data.articles]);
        } else {
          // Replace articles (initial load or refresh)
          setArticles(result.data.articles);
        }
        setHasMore(result.data.hasMore);
        setLastCreatedAt(result.data.lastCreatedAt);
      }
    } catch (error) {
      console.error('Error loading articles:', error);
      toast.error('Failed to load articles');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && lastCreatedAt && !loadingMore) {
      loadArticles(lastCreatedAt);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setLastCreatedAt(null);
    await loadArticles();
    setRefreshing(false);
    toast.success('Articles refreshed');
  };

  const handleEditClick = async (article) => {
    setEditLoading(true);
    try {
      const result = await getArticleForEdit({ path: article.path });
      if (result.data.success) {
        setEditingArticle(result.data.article);
      }
    } catch (error) {
      console.error('Error loading article for edit:', error);
      toast.error('Failed to load article');
    } finally {
      setEditLoading(false);
    }
  };

  const handleArchiveToggle = async (article) => {
    const isArchiving = !article.isArchived;
    try {
      const result = await archiveArticle({
        path: article.path,
        archive: isArchiving
      });
      if (result.data.success) {
        toast.success(result.data.message);
        // Update local state
        setArticles(prev => prev.map(a =>
          a.path === article.path
            ? { ...a, isArchived: isArchiving, isPublished: !isArchiving }
            : a
        ));
      }
    } catch (error) {
      console.error('Error toggling archive:', error);
      toast.error('Failed to update article');
    }
  };

  const handleDelete = async (article) => {
    if (!window.confirm(`Permanently delete "${article.headline}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const result = await deleteArticle({
        path: article.path,
        confirmDelete: true
      });
      if (result.data.success) {
        toast.success('Article deleted');
        setArticles(prev => prev.filter(a => a.path !== article.path));
      }
    } catch (error) {
      console.error('Error deleting article:', error);
      toast.error('Failed to delete article');
    }
  };

  // Filter articles based on search and filter tab
  const filteredArticles = articles.filter(article => {
    // Search filter
    const matchesSearch = searchTerm === '' ||
      article.headline.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.summary.toLowerCase().includes(searchTerm.toLowerCase());

    // Tab filter
    let matchesFilter = true;
    if (activeFilter === 'published') {
      matchesFilter = article.isPublished && !article.isArchived;
    } else if (activeFilter === 'archived') {
      matchesFilter = article.isArchived;
    }

    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search and refresh */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-sm overflow-hidden">
        <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-yellow-500" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Article Management
            </h2>
            <span className="text-xs text-gray-500">
              ({articles.length} total)
            </span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Search and filters */}
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search articles by headline or summary..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#222] border border-[#333] rounded text-white text-sm focus:outline-none focus:border-[#0057B8]"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  activeFilter === tab.id
                    ? 'bg-[#0057B8] text-white'
                    : 'bg-[#222] text-gray-400 hover:text-white border border-[#333]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Articles list */}
      <div className="space-y-2">
        {filteredArticles.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-8 text-center">
            <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">
              {searchTerm ? `No articles found matching "${searchTerm}"` : 'No articles found'}
            </p>
          </div>
        ) : (
          filteredArticles.map((article) => (
            <ArticleRow
              key={article.path}
              article={article}
              onEdit={() => handleEditClick(article)}
              onArchive={() => handleArchiveToggle(article)}
              onDelete={() => handleDelete(article)}
              formatDate={formatDate}
              editLoading={editLoading}
            />
          ))
        )}

        {/* Load More button */}
        {hasMore && !searchTerm && activeFilter === 'all' && (
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full py-3 bg-[#1a1a1a] border border-[#333] rounded-sm text-gray-400 hover:text-white hover:bg-[#222] transition-colors flex items-center justify-center gap-2"
          >
            {loadingMore ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Load More Articles
              </>
            )}
          </button>
        )}
      </div>

      {/* Edit Modal */}
      {editingArticle && (
        <ArticleEditorModal
          article={editingArticle}
          onClose={() => setEditingArticle(null)}
          onSave={async (updates) => {
            try {
              const result = await updateArticle({
                path: editingArticle.path,
                updates
              });
              if (result.data.success) {
                toast.success('Article updated');
                // Update local state
                setArticles(prev => prev.map(a =>
                  a.path === editingArticle.path
                    ? { ...a, ...updates }
                    : a
                ));
                setEditingArticle(null);
              }
            } catch (error) {
              console.error('Error updating article:', error);
              toast.error('Failed to update article');
            }
          }}
          onRegenerateImage={async (path, headline, category) => {
            try {
              const result = await regenerateArticleImage({ path, headline, category });
              if (result.data.success) {
                toast.success('New image generated!');
                // Update the editing article's imageUrl
                setEditingArticle(prev => ({ ...prev, imageUrl: result.data.imageUrl }));
                // Update the articles list
                setArticles(prev => prev.map(a =>
                  a.path === path
                    ? { ...a, imageUrl: result.data.imageUrl }
                    : a
                ));
                return result.data.imageUrl;
              }
            } catch (error) {
              console.error('Error regenerating image:', error);
              toast.error('Failed to generate new image');
            }
            return null;
          }}
        />
      )}
    </div>
  );
};

// Individual article row component
const ArticleRow = ({ article, onEdit, onArchive, onDelete, formatDate, editLoading }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-sm overflow-hidden">
      {/* Main row */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Image thumbnail */}
          <div className="w-16 h-16 bg-[#222] rounded flex-shrink-0 overflow-hidden">
            {article.imageUrl ? (
              <img
                src={article.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Image className="w-6 h-6 text-gray-600" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-bold text-white text-sm truncate">
                  {article.headline}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                  {article.summary}
                </p>
              </div>

              {/* Status badges */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_COLORS[article.source]}`}>
                  {article.source === 'current_season' ? 'Season' : 'Legacy'}
                </span>
                {article.isArchived ? (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium flex items-center gap-1">
                    <EyeOff className="w-3 h-3" />
                    Archived
                  </span>
                ) : article.isPublished ? (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    Published
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
                    Draft
                  </span>
                )}
              </div>
            </div>

            {/* Metadata row */}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              {article.reportDay !== undefined && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Day {article.reportDay}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(article.createdAt)}
              </span>
              <span className="text-gray-600">
                {article.category}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onEdit}
              disabled={editLoading}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#333] rounded transition-colors"
              title="Edit article"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={onArchive}
              className={`p-2 rounded transition-colors ${
                article.isArchived
                  ? 'text-green-400 hover:text-green-300 hover:bg-green-500/10'
                  : 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10'
              }`}
              title={article.isArchived ? 'Restore article' : 'Archive article'}
            >
              {article.isArchived ? (
                <ArchiveRestore className="w-4 h-4" />
              ) : (
                <Archive className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#333] rounded transition-colors"
              title="Toggle details"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-[#333] bg-[#0a0a0a] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500">Path:</span>
              <span className="ml-2 text-gray-300 font-mono">{article.path}</span>
            </div>
            <div>
              <span className="text-gray-500">ID:</span>
              <span className="ml-2 text-gray-300 font-mono">{article.id}</span>
            </div>
            {article.updatedAt && (
              <div>
                <span className="text-gray-500">Last Updated:</span>
                <span className="ml-2 text-gray-300">{formatDate(article.updatedAt)}</span>
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div className="pt-3 border-t border-[#333]">
            <button
              onClick={onDelete}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Permanently
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Article Editor Modal
const ArticleEditorModal = ({ article, onClose, onSave, onRegenerateImage }) => {
  // Use narrative field as fallback for fullStory (backend stores generated articles in 'narrative')
  const [formData, setFormData] = useState({
    headline: article.headline || '',
    summary: article.summary || '',
    fullStory: article.fullStory || article.narrative || '',
    fantasyImpact: article.fantasyImpact || '',
    imageUrl: article.imageUrl || '',
    isPublished: article.isPublished !== false,
  });
  const [saving, setSaving] = useState(false);
  const [regeneratingImage, setRegeneratingImage] = useState(false);
  const [activeSection, setActiveSection] = useState('basic');

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.headline.trim()) {
      toast.error('Headline is required');
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    const originalFullStory = article.fullStory || article.narrative || '';
    return (
      formData.headline !== (article.headline || '') ||
      formData.summary !== (article.summary || '') ||
      formData.fullStory !== originalFullStory ||
      formData.fantasyImpact !== (article.fantasyImpact || '') ||
      formData.imageUrl !== (article.imageUrl || '') ||
      formData.isPublished !== (article.isPublished !== false)
    );
  };

  const handleRegenerateImage = async () => {
    if (!window.confirm('Generate a new AI image for this article? This will replace the current image.')) {
      return;
    }
    setRegeneratingImage(true);
    try {
      const newImageUrl = await onRegenerateImage(article.path, formData.headline, article.category);
      if (newImageUrl) {
        handleChange('imageUrl', newImageUrl);
      }
    } finally {
      setRegeneratingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-sm w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-yellow-500" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Edit Article</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-[#333] bg-[#1a1a1a] flex-shrink-0">
          {[
            { id: 'basic', label: 'Basic Info' },
            { id: 'content', label: 'Full Content' },
            { id: 'sections', label: 'Sections' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeSection === tab.id
                  ? 'text-[#0057B8] border-[#0057B8]'
                  : 'text-gray-500 border-transparent hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
          <div className="p-4 space-y-4">
            {activeSection === 'basic' && (
              <>
                {/* Headline */}
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
                    Headline *
                  </label>
                  <input
                    type="text"
                    value={formData.headline}
                    onChange={(e) => handleChange('headline', e.target.value)}
                    className="w-full px-3 py-2 bg-[#222] border border-[#333] rounded text-white text-sm focus:outline-none focus:border-[#0057B8]"
                    placeholder="Enter headline..."
                  />
                </div>

                {/* Summary */}
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
                    Summary
                  </label>
                  <textarea
                    value={formData.summary}
                    onChange={(e) => handleChange('summary', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-[#222] border border-[#333] rounded text-white text-sm focus:outline-none focus:border-[#0057B8] resize-none"
                    placeholder="Enter summary..."
                  />
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
                    Image URL
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => handleChange('imageUrl', e.target.value)}
                      className="flex-1 px-3 py-2 bg-[#222] border border-[#333] rounded text-white text-sm focus:outline-none focus:border-[#0057B8]"
                      placeholder="https://..."
                    />
                    {formData.imageUrl && (
                      <div className="w-16 h-10 bg-[#222] rounded overflow-hidden flex-shrink-0">
                        <img
                          src={formData.imageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleRegenerateImage}
                      disabled={regeneratingImage}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors flex-shrink-0"
                      title="Generate a new AI image for this article"
                    >
                      {regeneratingImage ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          New Image
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Published toggle */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleChange('isPublished', !formData.isPublished)}
                    className={`relative w-12 h-6 rounded-sm transition-colors ${
                      formData.isPublished ? 'bg-green-600' : 'bg-[#333]'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-sm transition-transform ${
                        formData.isPublished ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-300">
                    {formData.isPublished ? 'Published' : 'Unpublished'}
                  </span>
                </div>
              </>
            )}

            {activeSection === 'content' && (
              <>
                {/* Full Story */}
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
                    Full Story
                  </label>
                  <textarea
                    value={formData.fullStory}
                    onChange={(e) => handleChange('fullStory', e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 bg-[#222] border border-[#333] rounded text-white text-sm focus:outline-none focus:border-[#0057B8] resize-none font-mono"
                    placeholder="Enter full story content..."
                  />
                </div>

                {/* Fantasy Impact */}
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
                    Fantasy Impact
                  </label>
                  <textarea
                    value={formData.fantasyImpact}
                    onChange={(e) => handleChange('fantasyImpact', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-[#222] border border-[#333] rounded text-white text-sm focus:outline-none focus:border-[#0057B8] resize-none"
                    placeholder="Describe fantasy impact..."
                  />
                </div>
              </>
            )}

            {activeSection === 'sections' && (
              <div className="space-y-4">
                {/* DCI Recap Section */}
                {article.dciRecap && (
                  <SectionEditor
                    title="DCI Recap"
                    section={article.dciRecap}
                    color="blue"
                  />
                )}

                {/* Fantasy Spotlight Section */}
                {article.fantasySpotlight && (
                  <SectionEditor
                    title="Fantasy Spotlight"
                    section={article.fantasySpotlight}
                    color="purple"
                  />
                )}

                {/* Cross-Over Analysis Section */}
                {article.crossOverAnalysis && (
                  <SectionEditor
                    title="Cross-Over Analysis"
                    section={article.crossOverAnalysis}
                    color="green"
                  />
                )}

                {!article.dciRecap && !article.fantasySpotlight && !article.crossOverAnalysis && (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No structured sections available for this article</p>
                    <p className="text-xs mt-1">Use the Content tab to edit the full story</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[#333] bg-[#222] px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="text-xs text-gray-500">
              {hasChanges() ? (
                <span className="text-yellow-500">Unsaved changes</span>
              ) : (
                <span>No changes</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !hasChanges()}
                className="flex items-center gap-2 px-4 py-2 bg-[#0057B8] text-white font-bold text-sm rounded hover:bg-[#0066d6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// Section Editor (read-only display for now, can be expanded later)
const SectionEditor = ({ title, section, color }) => {
  const [expanded, setExpanded] = useState(false);

  const colorClasses = {
    blue: 'border-blue-500/30 bg-blue-500/5',
    purple: 'border-purple-500/30 bg-purple-500/5',
    green: 'border-green-500/30 bg-green-500/5',
  };

  return (
    <div className={`border rounded-sm ${colorClasses[color]}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-white text-sm">{title}</span>
          {section.title && (
            <span className="text-xs text-gray-500">- {section.title}</span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {section.narrative && (
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">
                Narrative
              </label>
              <p className="text-sm text-gray-300 bg-[#1a1a1a] p-3 rounded">
                {section.narrative}
              </p>
            </div>
          )}

          {/* Display any array fields */}
          {Object.entries(section).map(([key, value]) => {
            if (Array.isArray(value) && value.length > 0) {
              return (
                <div key={key}>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <div className="text-xs text-gray-400 bg-[#1a1a1a] p-3 rounded font-mono overflow-x-auto">
                    <pre>{JSON.stringify(value, null, 2)}</pre>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
};

export default ArticleManagement;
