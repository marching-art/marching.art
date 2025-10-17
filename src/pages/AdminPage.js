// src/pages/AdminPage.js
import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../firebase';
import FinalRankingsManager from '../components/admin/FinalRankingsManager';
import LiveSeasonScheduler from '../components/admin/LiveSeasonScheduler';
import SeasonControls from '../components/admin/SeasonControls';
import ScoreDataViewer from '../components/admin/ScoreDataViewer';

// Card wrapper component
const AdminCard = ({ title, children }) => (
    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
        <h2 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">{title}</h2>
        {children}
    </div>
);

// Reports Manager Component
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

// Main Admin Page Component
const AdminPage = () => {
    const [email, setEmail] = useState('');
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [message, setMessage] = useState('');
    const [isScraping, setIsScraping] = useState(false);
    const [scraperMessage, setScraperMessage] = useState('');
    const [isCrawling, setIsCrawling] = useState(false);
    const [crawlerMessage, setCrawlerMessage] = useState('');
    const [jobStatus, setJobStatus] = useState({});
    const [isMigrating, setIsMigrating] = useState(false);
    const [migrationMessage, setMigrationMessage] = useState('');

    const handleMigrateProfiles = async () => {
        setMigrationMessage('Starting profile migration...');
        setIsMigrating(true);
        try {
            const migrateUserProfiles = httpsCallable(functions, 'migrateUserProfiles');
            const result = await migrateUserProfiles();
            setMigrationMessage(result.data.message);
        } catch (error) {
            console.error("Error calling migration function:", error);
            setMigrationMessage(`Error: ${error.message}`);
        }
        setIsMigrating(false);
    };

    const handleRoleChange = async (makeAdmin) => {
        setMessage('');
        setIsLoadingRoles(true);
        try {
            const setUserRole = httpsCallable(functions, 'setUserRole');
            const result = await setUserRole({ email, makeAdmin });
            setMessage(result.data.message || result.data.error);
        } catch (error) {
            console.error("Error calling function:", error);
            setMessage("An error occurred. Check the console for details.");
        }
        setIsLoadingRoles(false);
    };

    const handleTestScraper = async () => {
        setScraperMessage('Starting scraper test...');
        setIsScraping(true);
        try {
            const testScraper = httpsCallable(functions, 'testScraper');
            const result = await testScraper();
            setScraperMessage(result.data.message);
        } catch (error) {
            console.error("Error calling testScraper function:", error);
            setScraperMessage(`Error: ${error.message}`);
        }
        setIsScraping(false);
    };

    const handleCrawlAndQueue = async () => {
        setCrawlerMessage('Starting discovery process...');
        setIsCrawling(true);
        try {
            const discoverAndQueueUrls = httpsCallable(functions, 'discoverAndQueueUrls');
            const result = await discoverAndQueueUrls();
            setCrawlerMessage(result.data.message);
        } catch (error) {
            console.error("Error calling crawler function:", error);
            setCrawlerMessage(`Error: ${error.message}`);
        }
        setIsCrawling(false);
    };

    const handleManualTrigger = async (jobName) => {
        setJobStatus(prev => ({ ...prev, [jobName]: { loading: true, message: '' } }));
        try {
            const manualTrigger = httpsCallable(functions, 'manualTrigger');
            const result = await manualTrigger({ jobName });
            setJobStatus(prev => ({ ...prev, [jobName]: { loading: false, message: result.data.message } }));
        } catch (error) {
            setJobStatus(prev => ({ ...prev, [jobName]: { loading: false, message: `Error: ${error.message}` } }));
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
            <h1 className="text-4xl font-bold text-text-primary dark:text-text-primary-dark mb-6">Admin Panel</h1>
            
            {/* User Role Management */}
            <AdminCard title="User Role Management">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
                            User Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@example.com"
                            className="w-full p-2 border-theme border-accent dark:border-accent-dark rounded-theme bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark"
                        />
                    </div>
                    <div className="flex gap-4">
                        <button 
                            onClick={() => handleRoleChange(true)} 
                            disabled={isLoadingRoles || !email} 
                            className="border-theme border-primary dark:border-primary-dark text-primary dark:text-primary-dark hover:bg-primary dark:hover:bg-primary-dark hover:text-white font-bold py-2 px-4 rounded-theme disabled:opacity-50 transition-colors"
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

            {/* Content Moderation */}
            <AdminCard title="Content Moderation">
                <ReportsManager />
            </AdminCard>

            {/* Score Data Viewer */}
            <ScoreDataViewer />

            {/* Data & Scoring Tools */}
            <AdminCard title="Data & Scoring Tools">
                <div className="space-y-4">
                    <div>
                        <p className='text-sm text-text-secondary dark:text-text-secondary-dark mb-2'>
                            <strong>Import All Historical Recaps:</strong> Discovers all historical score recap URLs from dci.org and adds them to a queue for processing. 
                            This is a comprehensive, one-time operation to populate the database.
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
                            Useful for testing scraper logic without running the full discovery process.
                        </p>
                        <div className="flex items-center space-x-4">
                            <button 
                                onClick={handleTestScraper} 
                                disabled={isScraping} 
                                className="bg-secondary dark:bg-secondary-dark hover:opacity-90 text-white font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                            >
                                {isScraping ? 'Scraping...' : 'Run Scraper Test'}
                            </button>
                            {scraperMessage && <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">{scraperMessage}</p>}
                        </div>
                    </div>
                </div>
            </AdminCard>

            {/* Profile Migration */}
            <AdminCard title="Profile Migration">
                <div className="space-y-4">
                    <div>
                        <p className='text-sm text-text-secondary dark:text-text-secondary-dark mb-2'>
                            <strong>Migrate User Profiles:</strong> Converts existing single-corps user profiles to the new multi-corps structure. 
                            This should be run once after deploying the multi-corps update. Existing profiles will be preserved as World Class corps.
                        </p>
                        <div className="flex items-center space-x-4">
                            <button 
                                onClick={handleMigrateProfiles} 
                                disabled={isMigrating} 
                                className="bg-accent dark:bg-accent-dark hover:opacity-90 text-white font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                            >
                                {isMigrating ? 'Migrating...' : 'Migrate User Profiles'}
                            </button>
                            {migrationMessage && <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">{migrationMessage}</p>}
                        </div>
                    </div>
                </div>
            </AdminCard>

            {/* Season Controls */}
            <SeasonControls />

            {/* Live Season Scheduler */}
            <LiveSeasonScheduler />

            {/* Final Rankings Manager */}
            <FinalRankingsManager />
        </div>
    );
};

export default AdminPage;