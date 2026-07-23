// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// src/components/Admin/ArticleManagement.jsx
// Admin article management - list, edit, archive articles
// Follows Admin panel dark theme: bg-background, bg-surface-card, bg-surface-raised

import React, { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listAllArticles,
  getArticleForEdit,
  updateArticle,
  archiveArticle,
  deleteArticle,
  regenerateArticleImage,
} from '../../api/functions';
import { ArticleRow, ArticleEditorModal } from './ArticleManagementParts';

// Filter tabs
const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'archived', label: 'Archived' },
];

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
          setArticles((prev) => [...prev, ...result.data.articles]);
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
        archive: isArchiving,
      });
      if (result.data.success) {
        toast.success(result.data.message);
        // Update local state
        setArticles((prev) =>
          prev.map((a) =>
            a.path === article.path
              ? { ...a, isArchived: isArchiving, isPublished: !isArchiving }
              : a
          )
        );
      }
    } catch (error) {
      console.error('Error toggling archive:', error);
      toast.error('Failed to update article');
    }
  };

  const handleDelete = async (article) => {
    if (
      !window.confirm(`Permanently delete "${article.headline}"?\n\nThis action cannot be undone.`)
    ) {
      return;
    }

    try {
      const result = await deleteArticle({
        path: article.path,
        confirmDelete: true,
      });
      if (result.data.success) {
        toast.success('Article deleted');
        setArticles((prev) => prev.filter((a) => a.path !== article.path));
      }
    } catch (error) {
      console.error('Error deleting article:', error);
      toast.error('Failed to delete article');
    }
  };

  // Filter articles based on search and filter tab
  const filteredArticles = articles.filter((article) => {
    // Search filter
    const matchesSearch =
      searchTerm === '' ||
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
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-muted animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search and refresh */}
      <div className="bg-surface-card border border-line rounded-none overflow-hidden">
        <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-secondary" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Article Management
            </h2>
            <span className="text-xs text-muted">({articles.length} total)</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Search and filters */}
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search articles by headline or summary..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-raised border border-line rounded-none text-white text-sm focus:outline-none focus:border-interactive"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-none transition-colors ${
                  activeFilter === tab.id
                    ? 'bg-interactive text-white'
                    : 'bg-surface-raised text-muted hover:text-white border border-line'
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
          <div className="bg-surface-card border border-line rounded-none p-8 text-center">
            <FileText className="w-8 h-8 text-muted mx-auto mb-2" />
            <p className="text-muted text-sm">
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
            className="w-full py-3 bg-surface-card border border-line rounded-none text-muted hover:text-white hover:bg-surface-raised transition-colors flex items-center justify-center gap-2"
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
                updates,
              });
              if (result.data.success) {
                toast.success('Article updated');
                // Update local state
                setArticles((prev) =>
                  prev.map((a) => (a.path === editingArticle.path ? { ...a, ...updates } : a))
                );
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
                setEditingArticle((prev) => ({ ...prev, imageUrl: result.data.imageUrl }));
                // Update the articles list
                setArticles((prev) =>
                  prev.map((a) => (a.path === path ? { ...a, imageUrl: result.data.imageUrl } : a))
                );
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

export default ArticleManagement;
