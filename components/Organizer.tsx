import React, { useState } from 'react';
import { Note, Meeting, CalendarEvent } from '../types';
import { 
  Calendar, Clock, CheckSquare, Square, Trash2, Plus, 
  NotebookPen, Users, FileText, AlertCircle, Edit2, Save, X 
} from 'lucide-react';

interface OrganizerProps {
  notes: Note[];
  meetings: Meeting[];
  events: CalendarEvent[];
  onAddNote: (note: Note) => void;
  onToggleNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onEditNote: (id: string, newContent: string) => void;
  onAddMeeting: (meeting: Meeting) => void;
  onDeleteMeeting: (id: string) => void;
  onAddEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
}

const Organizer: React.FC<OrganizerProps> = ({
  notes, meetings, events,
  onAddNote, onToggleNote, onDeleteNote, onEditNote,
  onAddMeeting, onDeleteMeeting, onAddEvent, onDeleteEvent
}) => {
  // State for Inputs
  const [noteInput, setNoteInput] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  const [meetingForm, setMeetingForm] = useState({ title: '', date: '', time: '', participants: '', observations: '' });
  const [eventForm, setEventForm] = useState({ title: '', description: '', date: '', time: '' });
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);

  // --- NOTES HANDLERS ---
  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    onAddNote({
      id: Date.now().toString(),
      content: noteInput,
      completed: false,
      createdAt: new Date().toISOString()
    });
    setNoteInput('');
  };

  const startEditingNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.content);
  };

  const saveEditedNote = (id: string) => {
    if (editingNoteText.trim()) {
      onEditNote(id, editingNoteText);
    }
    setEditingNoteId(null);
  };

  // --- MEETING HANDLERS ---
  const handleMeetingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingForm.title || !meetingForm.date || !meetingForm.time) return;
    onAddMeeting({
      id: Date.now().toString(),
      ...meetingForm
    });
    setMeetingForm({ title: '', date: '', time: '', participants: '', observations: '' });
    setShowMeetingModal(false);
  };

  // --- EVENT HANDLERS ---
  const handleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title || !eventForm.date) return;
    onAddEvent({
      id: Date.now().toString(),
      ...eventForm
    });
    setEventForm({ title: '', description: '', date: '', time: '' });
    setShowEventModal(false);
  };

  // Sort Logic
  const sortedMeetings = [...meetings].sort((a, b) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime());
  const sortedEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in pb-12">
      
      {/* Header */}
      <div className="flex flex-col gap-2">
         <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="text-amber-500" />
            Agenda e Anotações
         </h2>
         <p className="text-slate-400 text-sm">Organize suas tarefas diárias, agende reuniões e não perca eventos importantes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMN 1: DAILY NOTES */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col h-[600px]">
           <div className="flex items-center gap-2 mb-4 text-blue-400 font-bold uppercase tracking-wider text-sm border-b border-slate-800 pb-2">
              <NotebookPen size={18} /> Anotações Rápidas
           </div>

           <form onSubmit={handleNoteSubmit} className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Escreva algo..." 
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors">
                <Plus size={20} />
              </button>
           </form>

           <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {notes.length === 0 && (
                <div className="text-center text-slate-600 text-xs italic py-10">
                  Nenhuma anotação pendente.
                </div>
              )}
              {notes.map(note => (
                <div key={note.id} className={`p-3 rounded-lg border transition-all group ${note.completed ? 'bg-slate-950/50 border-slate-800 opacity-60' : 'bg-slate-800/40 border-slate-700 hover:border-blue-500/50'}`}>
                   <div className="flex items-start gap-3">
                      <button 
                        onClick={() => onToggleNote(note.id)} 
                        className={`mt-0.5 shrink-0 ${note.completed ? 'text-emerald-500' : 'text-slate-500 hover:text-white'}`}
                      >
                        {note.completed ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                         {editingNoteId === note.id ? (
                           <div className="flex gap-2">
                             <input 
                               value={editingNoteText}
                               onChange={(e) => setEditingNoteText(e.target.value)}
                               className="w-full bg-slate-950 text-white text-sm p-1 rounded border border-blue-500 focus:outline-none"
                               autoFocus
                               onKeyDown={(e) => e.key === 'Enter' && saveEditedNote(note.id)}
                             />
                             <button onClick={() => saveEditedNote(note.id)} className="text-emerald-500"><Save size={16}/></button>
                           </div>
                         ) : (
                           <p className={`text-sm break-words ${note.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                              {note.content}
                           </p>
                         )}
                      </div>

                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         {editingNoteId !== note.id && (
                           <button onClick={() => startEditingNote(note)} className="text-slate-500 hover:text-blue-400 p-1">
                             <Edit2 size={14} />
                           </button>
                         )}
                         <button onClick={() => onDeleteNote(note.id)} className="text-slate-500 hover:text-rose-500 p-1">
                            <Trash2 size={14} />
                         </button>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* COLUMN 2: MEETINGS */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col h-[600px]">
           <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-sm">
                  <Users size={18} /> Reuniões
              </div>
              <button onClick={() => setShowMeetingModal(true)} className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1 font-bold">
                 <Plus size={14} /> Nova
              </button>
           </div>

           <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {sortedMeetings.length === 0 && (
                <div className="text-center text-slate-600 text-xs italic py-10">
                  Nenhuma reunião agendada.
                </div>
              )}
              {sortedMeetings.map(meeting => (
                <div key={meeting.id} className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 hover:border-emerald-500/50 transition-all relative group">
                   <button onClick={() => onDeleteMeeting(meeting.id)} className="absolute top-2 right-2 text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={14} />
                   </button>
                   <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-white text-sm">{meeting.title}</h4>
                      <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                         <Clock size={12} /> {meeting.time}
                      </div>
                   </div>
                   <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                      <Calendar size={12} /> {new Date(meeting.date).toLocaleDateString('pt-BR')}
                   </div>
                   {meeting.participants && (
                     <div className="text-xs text-slate-300 mb-2">
                        <span className="text-slate-500">Participantes:</span> {meeting.participants}
                     </div>
                   )}
                   {meeting.observations && (
                     <div className="text-xs text-slate-400 italic border-t border-slate-700/50 pt-2 mt-2">
                        "{meeting.observations}"
                     </div>
                   )}
                </div>
              ))}
           </div>
        </div>

        {/* COLUMN 3: IMPORTANT EVENTS */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col h-[600px]">
           <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-sm">
                  <AlertCircle size={18} /> Lembretes Importantes
              </div>
              <button onClick={() => setShowEventModal(true)} className="text-amber-400 hover:text-amber-300 text-xs flex items-center gap-1 font-bold">
                 <Plus size={14} /> Novo
              </button>
           </div>

           <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {sortedEvents.length === 0 && (
                <div className="text-center text-slate-600 text-xs italic py-10">
                  Nenhum lembrete definido.
                </div>
              )}
              {sortedEvents.map(event => (
                <div key={event.id} className="bg-amber-950/10 border-l-4 border-amber-500 rounded-r-lg p-4 relative group">
                   <button onClick={() => onDeleteEvent(event.id)} className="absolute top-2 right-2 text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={14} />
                   </button>
                   <h4 className="font-bold text-amber-100 text-sm mb-1">{event.title}</h4>
                   <div className="flex items-center gap-3 text-xs text-amber-500/80 mb-2 font-mono">
                      <span>{new Date(event.date).toLocaleDateString('pt-BR')}</span>
                      {event.time && <span>{event.time}</span>}
                   </div>
                   {event.description && (
                     <p className="text-xs text-slate-400 leading-relaxed">
                        {event.description}
                     </p>
                   )}
                </div>
              ))}
           </div>
        </div>

      </div>

      {/* --- MODALS --- */}

      {/* Meeting Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white">Nova Reunião</h3>
                    <button onClick={() => setShowMeetingModal(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                </div>
                <form onSubmit={handleMeetingSubmit} className="space-y-3">
                    <input required type="text" placeholder="Título da Reunião" value={meetingForm.title} onChange={e => setMeetingForm({...meetingForm, title: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" />
                    <div className="grid grid-cols-2 gap-3">
                        <input required type="date" value={meetingForm.date} onChange={e => setMeetingForm({...meetingForm, date: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm [color-scheme:dark]" />
                        <input required type="time" value={meetingForm.time} onChange={e => setMeetingForm({...meetingForm, time: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm [color-scheme:dark]" />
                    </div>
                    <input type="text" placeholder="Participantes (separar por vírgula)" value={meetingForm.participants} onChange={e => setMeetingForm({...meetingForm, participants: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" />
                    <textarea placeholder="Observações..." value={meetingForm.observations} onChange={e => setMeetingForm({...meetingForm, observations: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm h-20 resize-none" />
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded">Agendar</button>
                </form>
            </div>
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white">Novo Lembrete</h3>
                    <button onClick={() => setShowEventModal(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                </div>
                <form onSubmit={handleEventSubmit} className="space-y-3">
                    <input required type="text" placeholder="Título do Evento" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" />
                    <div className="grid grid-cols-2 gap-3">
                        <input required type="date" value={eventForm.date} onChange={e => setEventForm({...eventForm, date: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm [color-scheme:dark]" />
                        <input type="time" value={eventForm.time} onChange={e => setEventForm({...eventForm, time: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm [color-scheme:dark]" />
                    </div>
                    <textarea placeholder="Descrição..." value={eventForm.description} onChange={e => setEventForm({...eventForm, description: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm h-20 resize-none" />
                    <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded">Salvar Lembrete</button>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};

export default Organizer;