
import { ref, set } from 'firebase/database';
import { db } from './firebase';
import { Note, Meeting, CalendarEvent } from '../types';

class OrganizerService {
  // --- Notes ---
  async addNote(note: Note, currentNotes: Note[]) {
    await set(ref(db, 'monitoramento/organizer/notes'), [note, ...currentNotes]);
  }

  async toggleNote(id: string, currentNotes: Note[]) {
    const newNotes = currentNotes.map(n => n.id === id ? { ...n, completed: !n.completed } : n);
    await set(ref(db, 'monitoramento/organizer/notes'), newNotes);
  }

  async editNote(id: string, content: string, currentNotes: Note[]) {
    const newNotes = currentNotes.map(n => n.id === id ? { ...n, content } : n);
    await set(ref(db, 'monitoramento/organizer/notes'), newNotes);
  }

  async deleteNote(id: string, currentNotes: Note[]) {
    const newNotes = currentNotes.filter(n => n.id !== id);
    await set(ref(db, 'monitoramento/organizer/notes'), newNotes);
  }

  // --- Meetings ---
  async addMeeting(meeting: Meeting, currentMeetings: Meeting[]) {
    await set(ref(db, 'monitoramento/organizer/meetings'), [...currentMeetings, meeting]);
  }

  async deleteMeeting(id: string, currentMeetings: Meeting[]) {
    const newMeetings = currentMeetings.filter(m => m.id !== id);
    await set(ref(db, 'monitoramento/organizer/meetings'), newMeetings);
  }

  // --- Events ---
  async addEvent(event: CalendarEvent, currentEvents: CalendarEvent[]) {
    await set(ref(db, 'monitoramento/organizer/events'), [...currentEvents, event]);
  }

  async deleteEvent(id: string, currentEvents: CalendarEvent[]) {
    const newEvents = currentEvents.filter(e => e.id !== id);
    await set(ref(db, 'monitoramento/organizer/events'), newEvents);
  }
}

export const organizerService = new OrganizerService();
