
import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../services/firebase';
import { AppData, ProcessedWorker, User } from '../types';

const INITIAL_DATA: AppData = {
  cameras: [],
  accessPoints: [],
  documents: [],
  notes: [],
  meetings: [],
  events: [],
  lastSync: '-'
};

export const useAppData = (user: User | null) => {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [thirdPartyWorkers, setThirdPartyWorkers] = useState<ProcessedWorker[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
        setIsLoading(false);
        return;
    }

    // Refs
    const camerasRef = ref(db, 'monitoramento/cameras');
    const accessRef = ref(db, 'monitoramento/access_points');
    const documentsRef = ref(db, 'monitoramento/documents');
    const thirdPartyRef = ref(db, 'monitoramento/third_party_workers');
    const metadataRef = ref(db, 'monitoramento/metadata');
    const notesRef = ref(db, 'monitoramento/organizer/notes');
    const meetingsRef = ref(db, 'monitoramento/organizer/meetings');
    const eventsRef = ref(db, 'monitoramento/organizer/events');

    // Listeners
    const unsubCameras = onValue(camerasRef, (snap) => {
        setData(prev => ({ ...prev, cameras: snap.val() || [] }));
        setIsLoading(false);
    });

    const unsubAccess = onValue(accessRef, (snap) => {
        setData(prev => ({ ...prev, accessPoints: snap.val() || [] }));
    });

    const unsubDocs = onValue(documentsRef, (snap) => {
        setData(prev => ({ ...prev, documents: snap.val() || [] }));
    });
    
    const unsubThirdParty = onValue(thirdPartyRef, (snap) => {
        setThirdPartyWorkers(snap.val() || []);
    });

    const unsubMetadata = onValue(metadataRef, (snap) => {
        const meta = snap.val();
        if (meta && meta.lastSync) {
            setData(prev => ({ ...prev, lastSync: meta.lastSync }));
        }
    });

    const unsubNotes = onValue(notesRef, (snap) => setData(prev => ({ ...prev, notes: snap.val() || [] })));
    const unsubMeetings = onValue(meetingsRef, (snap) => setData(prev => ({ ...prev, meetings: snap.val() || [] })));
    const unsubEvents = onValue(eventsRef, (snap) => setData(prev => ({ ...prev, events: snap.val() || [] })));

    return () => {
        unsubCameras();
        unsubAccess();
        unsubDocs();
        unsubThirdParty();
        unsubMetadata();
        unsubNotes();
        unsubMeetings();
        unsubEvents();
    };
  }, [user]);

  return { data, thirdPartyWorkers, isLoading };
};
