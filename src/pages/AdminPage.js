import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../firebase';
import { useUserStore } from '../store/userStore';

// Import your admin components
import SeasonControls from '../components/admin/SeasonControls';
import FinalRankingsManager from '../components/admin/FinalRankingsManager';
import LiveSeasonScheduler from '../components/admin/LiveSeasonScheduler';
import ScoreDataViewer from '../components/admin/ScoreDataViewer';

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
        });
        return () => unsubscribe();
    }, []);

    const handleUpdateStatus = async (reportId, status) => {
        const reportRef = doc(db, 'reports', reportId);
        await updateDoc(reportRef, { status });
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
            {isLoading && <p>Loading reports...</p>}
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
                            <button onClick={() => handleDeleteComment(report)} className="text-sm border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-bold py-1 px-3 rounded-theme transition-colors">Delete Comment</button>
                            <button onClick={() => handleUpdateStatus(report.id, 'reviewed')} className="text-sm border border-accent dark:border-accent-dark hover:bg-accent dark:hover:bg-accent-dark/20 font-bold py-1 px-3 rounded-theme transition-colors">Mark as Reviewed</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AdminPage = () => {
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    const [activeTab, setActiveTab] = useState('season');
    
    // User role management state
    const [email, setEmail] = useState('');
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [message, setMessage] = useState('');
    
    // Scraper state
    const [isScraping, setIsScraping] = useState(false);
    const [scraperMessage, setScraperMessage] = useState('');
    const [isCrawling, setIsCrawling] = useState(false);
    const [crawlerMessage, setCrawlerMessage] = useState('');
    
    // Manual jobs state
    const [jobStatus, setJobStatus] = useState({});
    
    // Migration state
    const [isMigrating, setIsMigrating] = useState(false);
    const [migrationMessage, setMigrationMessage] = useState('');

    // Show loading state
    if (isLoadingAuth) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading admin panel...</p>
                </div>
            </div>
        );
    }

    // Check admin permissions
    if (!loggedInProfile?.isAdmin) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        You don't have permission to access the admin panel.
                    </p>
                </div>
            </div>
        );
    }

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

    const tabs = [
        { id: 'season', name: 'Season Controls', icon: '⚙️' },
        { id: 'reports', name: 'Reports', icon: '🚨' },
        { id: 'data', name: 'Data Tools', icon: '📊' },
        { id: 'migration', name: 'Migration', icon: '🔄' },
        { id: 'jobs', name: 'Manual Jobs', icon: '▶️' },
        { id: 'rankings', name: 'Rankings', icon: '🏆' },
        { id: 'users', name: 'User Roles', icon: '👥' }
    ];

    const AdminCard = ({ title, children }) => (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
            <h2 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">{title}</h2>
            {children}
        </div>
    );

    const renderTabContent = () => {
        switch (activeTab) {
            case 'season':
                return (
                    <div className="space-y-8">
                        <SeasonControls />
                        <div className="border-t border-accent dark:border-accent-dark pt-8">
                            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Live Season Scheduler</h3>
                            <LiveSeasonScheduler />
                        </div>
                    </div>
                );
            
            case 'reports':
                return <ReportsManager />;
            
            case 'data':
                return (
                    <div className="space-y-8">
                        <ScoreDataViewer />
                        <div className="space-y-4">
                            <div>
                                <p className='text-sm text-text-secondary dark:text-text-secondary-dark mb-2'>
                                    <strong>Import All Historical Recaps:</strong> Discovers all historical score recap URLs from dci.org and adds them to a queue for processing.
                                </p>
                                <div className="flex items-center space-x-4">
                                    <button 
                                        onClick={handleCrawlAndQueue} 
                                        disabled={isCrawling} 
                                        className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                                    >
                                        {isCrawling ? 'Discovering...' : 'Import All Historical Recaps'}
                                    </button>
                                    {crawlerMessage && <p className="text-sm font-semibold">{crawlerMessage}</p>}
                                </div>
                            </div>

                            <div className="border-t border-accent dark:border-accent-dark pt-4">
                                <p className='text-sm text-text-secondary dark:text-text-secondary-dark mb-2'>
                                    <strong>Run Scraper Test:</strong> Manually triggers the backend scraper to fetch scores from a single recap page.
                                </p>
                                <div className="flex items-center space-x-4">
                                    <button 
                                        onClick={handleTestScraper} 
                                        disabled={isScraping} 
                                        className="bg-secondary hover:opacity-90 text-on-secondary font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                                    >
                                        {isScraping ? 'Scraping...' : 'Run Scraper Test'}
                                    </button>
                                    {scraperMessage && <p className="text-sm font-semibold">{scraperMessage}</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            
            case 'migration':
                return (
                    <div>
                        <p className='text-sm text-text-secondary dark:text-text-secondary-dark mb-4'>
                            <strong>Migrate User Profiles:</strong> Converts existing single-corps user profiles to the new multi-corps structure. 
                            This should be run once after deploying the multi-corps update.
                        </p>
                        <div className="flex items-center space-x-4">
                            <button 
                                onClick={handleMigrateProfiles} 
                                disabled={isMigrating} 
                                className="bg-yellow-600 hover:opacity-90 text-white font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                            >
                                {isMigrating ? 'Migrating...' : 'Migrate User Profiles'}
                            </button>
                            {migrationMessage && <p className="text-sm font-semibold">{migrationMessage}</p>}
                        </div>
                    </div>
                );
            
            case 'jobs':
                return (
                    <div className="space-y-4">
                        <div className="flex items-center space-x-4">
                            <button 
                                onClick={() => handleManualTrigger('calculateCorpsStatistics')} 
                                disabled={jobStatus.calculateCorpsStatistics?.loading} 
                                className="bg-secondary hover:opacity-90 text-on-secondary font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                            >
                                {jobStatus.calculateCorpsStatistics?.loading ? 'Calculating...' : 'Calculate Season Statistics'}
                            </button>
                            {jobStatus.calculateCorpsStatistics?.message && <p className="text-sm font-semibold">{jobStatus.calculateCorpsStatistics.message}</p>}
                        </div>
                        
                        <div className="flex items-center space-x-4">
                            <button 
                                onClick={() => handleManualTrigger('archiveSeasonResults')} 
                                disabled={jobStatus.archiveSeasonResults?.loading} 
                                className="bg-yellow-600 hover:opacity-90 text-white font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                            >
                                {jobStatus.archiveSeasonResults?.loading ? 'Archiving...' : 'Archive Season Champions'}
                            </button>
                            {jobStatus.archiveSeasonResults?.message && <p className="text-sm font-semibold">{jobStatus.archiveSeasonResults.message}</p>}
                        </div>
                        
                        <div className="flex items-center space-x-4">
                            <button 
                                onClick={() => handleManualTrigger('processAndArchiveOffSeasonScores')} 
                                disabled={jobStatus.processAndArchiveOffSeasonScores?.loading} 
                                className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme disabled:opacity-50"
                            >
                                {jobStatus.processAndArchiveOffSeasonScores?.loading ? 'Processing...' : 'Run Daily Score Processor'}
                            </button>
                            {jobStatus.processAndArchiveOffSeasonScores?.message && <p className="text-sm font-semibold">{jobStatus.processAndArchiveOffSeasonScores.message}</p>}
                        </div>
                    </div>
                );
            
            case 'rankings':
                return <FinalRankingsManager />;
            
            case 'users':
                return (
                    <div className="space-y-4">
                        <p className="text-text-secondary dark:text-text-secondary-dark">Enter a user's email address to grant or revoke admin privileges.</p>
                        <input 
                            type="email" 
                            placeholder="user@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:border-primary" 
                        />
                        <div className="flex space-x-4">
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
                                className="border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-bold py-2 px-4 rounded-theme disabled:opacity-50 transition-colors"
                            >
                                {isLoadingRoles ? 'Working...' : 'Remove Admin'}
                            </button>
                        </div>
                        {message && <p className="mt-4 text-sm font-semibold">{message}</p>}
                    </div>
                );
            
            default:
                return <SeasonControls />;
        }
    };

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-primary dark:text-primary-dark">
                        Admin Panel
                    </h1>
                    <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                        System administration and configuration
                    </p>
                </div>

                {/* Navigation Tabs */}
                <div className="border-b border-accent dark:border-accent-dark mb-8">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-primary dark:border-primary-dark text-primary dark:text-primary-dark'
                                        : 'border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark hover:border-accent dark:hover:border-accent-dark'
                                }`}
                            >
                                <span className="mr-2">{tab.icon}</span>
                                {tab.name}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6">
                    {renderTabContent()}
                </div>

                {/* Admin Info Panel */}
                <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-theme p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <span className="text-yellow-600 dark:text-yellow-400">⚠️</span>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                Admin Access
                            </h3>
                            <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                                <p>
                                    You are logged in as <strong>{loggedInProfile.username}</strong> with administrative privileges.
                                    Please use caution when making changes as they affect all users.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminPage;