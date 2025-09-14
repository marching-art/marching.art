import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import FinalRankingsManager from '../admin/FinalRankingsManager';
import LiveSeasonScheduler from '../admin/LiveSeasonScheduler';
import SeasonControls from '../admin/SeasonControls';
import ScoreDataViewer from '../admin/ScoreDataViewer'; 

const AdminPage = () => {
    // ... (all existing state and handler functions remain the same) ...
    // State for User Role Management
    const [email, setEmail] = useState('');
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [message, setMessage] = useState('');

    // State for Scraper Test
    const [isScraping, setIsScraping] = useState(false);
    const [scraperMessage, setScraperMessage] = useState('');
    
    // State for Crawler Test
    const [isCrawling, setIsCrawling] = useState(false);
    const [crawlerMessage, setCrawlerMessage] = useState('');


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
        <div className="p-4 md:p-8 space-y-8">
            <h1 className="text-4xl font-bold text-brand-primary dark:text-brand-primary-dark mb-6">Admin Panel</h1>
            
            <ScoreDataViewer />

            <div className="bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-primary shadow-lg">
                <h2 className="text-2xl font-bold text-brand-primary dark:text-brand-primary-dark mb-4">Data & Scoring Tools</h2>
                <div className="space-y-4">
                    <p className='text-sm text-gray-600 dark:text-gray-400'>
                        <strong>Import All Historical Recaps:</strong> Discovers all historical score recap URLs from dci.org and adds them to a queue for processing. This is a comprehensive, one-time operation to populate the database.
                    </p>
                    <div className="flex items-center space-x-4">
                        <button 
                            onClick={handleCrawlAndQueue} 
                            disabled={isCrawling} 
                            className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
                        >
                            {isCrawling ? 'Discovering...' : 'Import All Historical Recaps'}
                        </button>
                        {crawlerMessage && <p className="text-sm font-semibold">{crawlerMessage}</p>}
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

                     <p className='text-sm text-gray-600 dark:text-gray-400'>
                        <strong>Run Scraper Test:</strong> Manually triggers the backend scraper to fetch scores from a single, specific recap page. Useful for testing scraper logic without running the full discovery process.
                    </p>
                    <div className="flex items-center space-x-4">
                        <button 
                            onClick={handleTestScraper} 
                            disabled={isScraping} 
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
                        >
                            {isScraping ? 'Scraping...' : 'Run Scraper Test'}
                        </button>
                        {scraperMessage && <p className="text-sm font-semibold">{scraperMessage}</p>}
                    </div>
                </div>
            </div>
            
            <div className="bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-primary shadow-lg">
    <h2 className="text-2xl font-bold text-brand-primary dark:text-brand-primary-dark mb-4">Manual Job Triggers</h2>
    <div className="space-y-4">

        {/* --- Process Daily Scores Trigger --- */}
        <div className="flex items-center space-x-4">
            <button 
                onClick={() => handleManualTrigger('processDailyScores')} 
                disabled={jobStatus.processDailyScores?.loading} 
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
            >
                {jobStatus.processDailyScores?.loading ? 'Processing...' : 'Run Daily Score Processor'}
            </button>
            {jobStatus.processDailyScores?.message && <p className="text-sm font-semibold">{jobStatus.processDailyScores.message}</p>}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

        {/* --- Archive Daily Recaps Trigger --- */}
        <div className="flex items-center space-x-4">
            <button 
                onClick={() => handleManualTrigger('archiveDailyFantasyScores')} 
                disabled={jobStatus.archiveDailyFantasyScores?.loading} 
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
            >
                {jobStatus.archiveDailyFantasyScores?.loading ? 'Archiving...' : 'Run Daily Recap Archiver'}
            </button>
            {jobStatus.archiveDailyFantasyScores?.message && <p className="text-sm font-semibold">{jobStatus.archiveDailyFantasyScores.message}</p>}
        </div>

    </div>
</div>

            <div className="bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-secondary shadow-lg">
                <h2 className="text-2xl font-bold text-brand-primary dark:text-brand-secondary-dark mb-4">Season Manager</h2>
                <SeasonControls />
                <div className="border-t-2 border-brand-accent dark:border-brand-accent-dark my-6"></div>
                <LiveSeasonScheduler />
            </div>

            <div className="bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-secondary shadow-lg">
                <FinalRankingsManager />
            </div>

            <div className="bg-brand-surface dark:bg-brand-surface-dark p-6 rounded-lg border-2 border-brand-secondary shadow-lg">
                <h2 className="text-2xl font-bold text-brand-primary dark:text-brand-secondary-dark mb-4">Manage User Roles</h2>
                <div className="space-y-4">
                    <p className="text-brand-text-secondary dark:text-brand-text-secondary-dark">Enter a user's email address to grant or revoke admin privileges.</p>
                    <input type="email" placeholder="user@example.com" className="w-full bg-white dark:bg-brand-background-dark border border-brand-accent dark:border-brand-accent-dark rounded p-2 text-brand-text-primary dark:text-brand-text-primary-dark placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-secondary" />
                    <div className="flex space-x-4">
                        <button onClick={() => handleRoleChange(true)} disabled={isLoadingRoles || !email} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"> {isLoadingRoles ? 'Working...' : 'Make Admin'} </button>
                        <button onClick={() => handleRoleChange(false)} disabled={isLoadingRoles || !email} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"> {isLoadingRoles ? 'Working...' : 'Remove Admin'} </button>
                    </div>
                    {message && <p className="mt-4 text-sm font-semibold">{message}</p>}
                </div>
            </div>
        </div>
        
    );
};
export default AdminPage;