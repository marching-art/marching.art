import { useState, useEffect } from 'react';
import { useDocument } from 'react-firebase-hooks/firestore';
import { doc } from 'firebase/firestore';
import { db } from '../firebase';

export const useCorpsData = () => {
  const [seasonDoc, loadingSeason] = useDocument(doc(db, 'game-settings', 'season'));
  
  const seasonUid = seasonDoc?.data()?.seasonUid;
  
  const [corpsListDoc, loadingCorpsList] = useDocument(
    seasonUid ? doc(db, 'dci-data', seasonUid) : null
  );
  
  const [corpsStatsDoc, loadingCorpsStats] = useDocument(
    seasonUid ? doc(db, 'dci-stats', seasonUid) : null
  );

  const [combinedData, setCombinedData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loading = loadingSeason || loadingCorpsList || loadingCorpsStats;
    setIsLoading(loading);

    if (!loading && corpsListDoc?.exists() && corpsStatsDoc?.exists()) {
      const list = corpsListDoc.data().corpsValues || [];
      const statsMap = new Map(
        corpsStatsDoc.data().data.map(stat => [stat.id, stat.stats])
      );

      const data = list.map(corps => ({
        ...corps,
        id: `${corps.corpsName}|${corps.sourceYear}`, // Unique ID
        stats: statsMap.get(`${corps.corpsName}|${corps.sourceYear}`) || {},
      }));
      
      setCombinedData(data);
    }
  }, [loadingSeason, loadingCorpsList, loadingCorpsStats, corpsListDoc, corpsStatsDoc]);

  return { 
    data: combinedData, 
    isLoading: isLoading,
    seasonUid: seasonUid 
  };
};