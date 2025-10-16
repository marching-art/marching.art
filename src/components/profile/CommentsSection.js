import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';
import { sendCommentNotification, deleteComment, reportComment } from '../../utils/api';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';

const timeSince = (timestamp) => {
    if (!timestamp) return 'just now';
    const date = timestamp.toDate();
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000; if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000; if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400; if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600; if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60; if (interval > 1) return Math.floor(interval) + "m ago";
    return "just now";
};

const CommentsSection = ({ profileOwnerId, loggedInProfile }) => {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [menuOpenFor, setMenuOpenFor] = useState(null);
    const menuRef = useRef(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [commentToDelete, setCommentToDelete] = useState(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuOpenFor(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!profileOwnerId) return;
        setIsLoading(true);
        const commentsRef = collection(db, 'artifacts', dataNamespace, 'users', profileOwnerId, 'comments');
        const q = query(commentsRef, orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            setComments(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setIsLoading(false);
        }, (err) => {
            console.error("Error fetching comments:", err);
            setError("Could not load comments.");
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [profileOwnerId]);

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || !loggedInProfile) return;
        setIsSubmitting(true);
        setError('');
        try {
            const commentsRef = collection(db, 'artifacts', dataNamespace, 'users', profileOwnerId, 'comments');
            await addDoc(commentsRef, {
                text: newComment.trim(),
                authorUid: loggedInProfile.userId,
                authorUsername: loggedInProfile.username,
                timestamp: serverTimestamp(),
            });
            if (profileOwnerId !== loggedInProfile.userId) {
                await sendCommentNotification({
                    recipientUid: profileOwnerId,
                    commenterUsername: loggedInProfile.username
                });
            }
            setNewComment('');
        } catch (err) {
            setError(err.message || "Failed to post comment.");
        }
        setIsSubmitting(false);
    };
    
    const handleDeleteRequest = (comment) => {
        setMenuOpenFor(null);
        setCommentToDelete(comment);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!commentToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteComment({ profileOwnerId, commentId: commentToDelete.id });
        } catch (err) {
            setError(err.message || "Failed to delete comment.");
        }
        setIsSubmitting(false);
        setIsDeleteModalOpen(false);
        setCommentToDelete(null);
    };

    const handleReport = async (comment) => {
        setMenuOpenFor(null);
        if (!window.confirm("Are you sure you want to report this comment for review?")) return;
        try {
            await reportComment({
                profileOwnerId: profileOwnerId,
                commentId: comment.id,
                commentText: comment.text,
                commentAuthorUid: comment.authorUid,
            });
            alert("Comment reported. An admin will review it shortly.");
        } catch (err) {
            setError(err.message || "Failed to report comment.");
        }
    };

    return (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Comment">
                 <div>
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-4">Are you sure you want to permanently delete this comment?</p>
                    <blockquote className="border-l-4 border-accent dark:border-accent-dark pl-4 my-2 italic text-text-secondary dark:text-text-secondary-dark">{commentToDelete?.text}</blockquote>
                    <div className="flex justify-end space-x-2 mt-6">
                        <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="border-theme border-accent dark:border-accent-dark hover:bg-accent dark:hover:bg-accent-dark/20 text-text-primary dark:text-text-primary-dark font-bold py-2 px-4 rounded-theme transition-colors">Cancel</button>
                        <button type="button" onClick={handleDeleteConfirm} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-theme disabled:opacity-50">{isSubmitting ? 'Deleting...' : 'Delete'}</button>
                    </div>
                 </div>
            </Modal>

            <h3 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">Comments</h3>
            {loggedInProfile && (
                <form onSubmit={handleCommentSubmit} className="mb-6">
                    <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Leave a comment..." className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary" rows="3" disabled={isSubmitting} />
                    {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
                    <div className="text-right mt-2">
                        <button type="submit" disabled={isSubmitting || !newComment.trim()} className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50">{isSubmitting ? 'Posting...' : 'Post Comment'}</button>
                    </div>
                </form>
            )}
            {isLoading ? <p>Loading comments...</p> : comments.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {comments.map(comment => {
                        const canDelete = loggedInProfile && (loggedInProfile.userId === profileOwnerId || loggedInProfile.isAdmin);
                        const canReport = loggedInProfile && loggedInProfile.userId !== comment.authorUid;
                        return (
                            <div key={comment.id} className="p-3 bg-background dark:bg-background-dark rounded-theme">
                                <div className="flex items-start justify-between text-sm">
                                    <span className="font-bold text-text-primary dark:text-text-primary-dark">{comment.authorUsername}</span>
                                    <div className="flex items-center gap-2 relative">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">{timeSince(comment.timestamp)}</span>
                                        {(canDelete || canReport) && (
                                            <button onClick={() => setMenuOpenFor(comment.id === menuOpenFor ? null : comment.id)} className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"><Icon path="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" className="w-5 h-5" /></button>
                                        )}
                                        {menuOpenFor === comment.id && (
                                            <div ref={menuRef} className="absolute top-full right-0 mt-1 w-32 bg-surface dark:bg-surface-dark rounded-theme shadow-lg border border-accent dark:border-accent-dark z-10">
                                                {canReport && <button onClick={() => handleReport(comment)} className="w-full text-left px-3 py-2 text-sm hover:bg-accent dark:hover:bg-accent-dark/20">Report</button>}
                                                {canDelete && <button onClick={() => handleDeleteRequest(comment)} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-accent dark:hover:bg-accent-dark/20">Delete</button>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <p className="mt-1 text-text-secondary dark:text-text-secondary-dark break-words">{comment.text}</p>
                            </div>
                        );
                    })}
                </div>
            ) : <p className="text-text-secondary dark:text-text-secondary-dark italic">No comments yet.</p>}
        </div>
    );
};

export default CommentsSection;