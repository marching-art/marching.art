import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../firebase';
import FinalRankingsManager from '../components/admin/FinalRankingsManager';
import LiveSeasonScheduler from '../components/admin/LiveSeasonScheduler';
import SeasonControls from '../components/admin/SeasonControls';
import ScoreDataViewer from '../components/admin/ScoreDataViewer';
import CompactTabPanel from '../components/ui/CompactTabPanel';

const AdminCard = ({ title, children }) => (
    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
        <h2 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">{title}</h2>
        {children}
    </div>
);

const ReportsManager = () => {
    const [reports, setReports] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const reportsRef = collection(db, 'reports');
        const q = query(reportsRef, where('status', '==', 'new'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setIsLoading(false);
        }, (error) => {
            console.error("Error loading reports:", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleUpdateStatus = async (reportId, status) => {
        try {
            const reportRef = doc(db, 'reports', reportId);
            await updateDoc(reportRef, { status });
        } catch (error) {
            console.error("Error updating report status:", error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleDeleteComment = async (report) => {
        if (!window.confirm("This will permanently delete the comment. Are you sure?")) return;
        try {
            const deleteComment = httpsCallable(functions, 'deleteComment');
            await deleteComment({
                profileOwnerId: report.reportedOnProfileUid,
                commentId: report.commentId
            });
            await handleUpdateStatus(report.id, 'resolved');
        } catch (error) {
            alert(`Error deleting comment: ${error.message}`);
        }
    };
    
    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">New Comment Reports</h3>
            {isLoading && <p className="text-text-secondary dark:text-text-secondary-dark">Loading reports...</p>}
            {!isLoading && reports.length === 0 && <p className="text-text-secondary dark:text-text-secondary-dark">No new reports found.</p>}
            <div className="space-y-3">
                {reports.map(report => (
                    <div key={report.id} className="p-3 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark">
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            Reported by: <span className="font-mono text-xs">{report.reporterUid}</span>
                        </p>
                        <blockquote className="border-l-4 border-accent dark:border-accent-dark pl-3 my-2 italic">
                           "{report.commentText}"
                        </blockquote>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            Original Author: <span className="font-mono text-xs">{report.commentAuthorUid}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                            <button 
                                onClick={() => handleDeleteComment(report)} 
                                className="text-sm border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-bold py-1 px-3 rounded-theme transition-colors"
                            >
                                Delete Comment
                            </button>
                            <button 
                                onClick={() => handleUpdateStatus(report.id, 'reviewed')} 
                                className="text-sm border border-accent dark:border-accent-dark hover:bg-accent dark:hover:bg-accent-dark/20 font-bold py-1 px-3 rounded-theme transition-colors"
                            >
                                Mark as Reviewed
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AdminPage = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [isCrawling, setIsCrawling] = useState(false);
    const [crawlerMessage, setCrawlerMessage] = useState('');
    const [isScraping, setIsScraping] = useState(false);
    const [scraperMessage, setScraperMessage] = useState('');

    const handleRoleChange = async (makeAdmin) => {
        setIsLoadingRoles(true);
        setMessage('');
        try {
            const setAdminRole = httpsCallable(functions, 'setAdminRole');
            const result = await setAdminRole({ email, isAdmin: makeAdmin });
            setMessage(result.data.message);
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        }
        setIsLoadingRoles(false);
    };

    const handleCrawlAndQueue = async () => {
        setIsCrawling(true);
        setCrawlerMessage('');
        try {
            const crawl = httpsCallable(functions, 'crawlAndQueueRecaps');
            const result = await crawl();
            setCrawlerMessage(result.data.message || 'Crawl completed successfully.');
        } catch (error) {
            setCrawlerMessage(`Error: ${error.message}`);
        }
        setIsCrawling(false);
    };

    const handleScraperTest = async () => {
        setIsScraping(true);
        setScraperMessage('');
        try {
            const test = httpsCallable(functions, 'testScraper');
            const result = await test();
            setScraperMessage(result.data.message || 'Test completed successfully.');
        } catch (error) {
            setScraperMessage(`Error: ${error.message}`);
        }
        setIsScraping(false);
    };

    const tabs = [
        {
            label: 'Users',
            icon: '👥',
            content: (
                <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
                    <AdminCard title="Admin Role Management">
                        <div className="space-y-4">
                            <input
                                type="email"
                                placeholder="Enter user email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-background dark:bg-background-dark border-theme border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark"
                            />
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => handleRoleChange(true)} 
                                    disabled={isLoadingRoles || !email} 
                                    className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                                >
                                    {isLoadingRoles ? 'Working...' : 'Make Admin'}
                                </button>
                                <button 
                                    onClick={() => handleRoleChange(false)} 
                                    disabled={isLoadingRoles || !email} 
                                    className="border-theme border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-bold py-2 px-4 rounded-theme disabled:opacity-50 transition-colors"
                                >
                                    {isLoadingRoles ? 'Working...' : 'Remove Admin'}
                                </button>
                            </div>
                            {message && <p className="mt-4 text-sm font-semibold text-text-primary dark:text-text-primary-dark">{message}</p>}
                        </div>
                    </AdminCard>
                </div>
            )
        },
        {
            label: 'Reports',
            icon: '⚠️',
            content: (
                <div className="p-4 md:p-8 max-w-5xl mx-auto">
                    <AdminCard title="Content Moderation">
                        <ReportsManager />
                    </AdminCard>
                </div>
            )
        },
        {
            label: 'Season',
            icon: '⚙️',
            content: (
                <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
                    <SeasonControls />
                    <LiveSeasonScheduler />
                    <FinalRankingsManager />
                </div>
            )
        },
        {
            label: 'Data',
            icon: '📊',
            content: (
                <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
                    <ScoreDataViewer />
                    
                    <AdminCard title="Data & Scoring Tools">
                        <div className="space-y-4">
                            <div>
                                <p className='text-sm text-text-secondary dark:text-text-secondary-dark mb-2'>
                                    <strong>Import All Historical Recaps:</strong> Discovers all historical score recap URLs from dci.org and adds them to a queue for processing.
                                </p>
                                <div className="flex items-center space-x-4">
                                    <button 
                                        onClick={handleCrawlAndQueue} 
                                        disabled={isCrawling} 
                                        className="bg-primary dark:bg-primary-dark hover:opacity-90 text-white font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                                    >
                                        {isCrawling ? 'Discovering...' : 'Import All Historical Recaps'}
                                    </button>
                                    {crawlerMessage && <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">{crawlerMessage}</p>}
                                </div>
                            </div>

                            <div className="border-t-theme border-accent dark:border-accent-dark my-4"></div>

                            <div>
                                <p className='text-sm text-text-secondary dark:text-text-secondary-dark mb-2'>
                                    <strong>Run Scraper Test:</strong> Manually triggers the backend scraper to fetch scores from a single, specific recap page.
                                </p>
                                <div className="flex items-center space-x-4">
                                    <button 
                                        onClick={handleScraperTest} 
                                        disabled={isScraping} 
                                        className="bg-secondary hover:opacity-90 text-on-secondary font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                                    >
                                        {isScraping ? 'Running...' : 'Run Scraper Test'}
                                    </button>
                                    {scraperMessage && <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">{scraperMessage}</p>}
                                </div>
                            </div>
                        </div>
                    </AdminCard>
                </div>
            )
        }
    ];

    return (
        <div className="page-content">
            <CompactTabPanel tabs={tabs} defaultTab={0} layout="top" />
        </div>
    );
};

export default AdminPage;
