
export type Status = 'ONLINE' | 'OFFLINE';

export type UserRole = 'admin' | 'viewer';
export type UserStatus = 'pending' | 'active' | 'blocked';

export interface User {
  uid: string; 
  email: string;
  name: string;
  role: UserRole;
  status?: UserStatus;
  // Profile fields
  photoURL?: string;
  bannerURL?: string;
  jobTitle?: string;
  bio?: string;
}

export interface Camera {
  uuid: string;        // Unique internal ID for React keys and specific targeting
  id: string;          // ID_Camera (e.g., MÓDULO A/B – 13/13)
  name: string;        // Nome_Camera (e.g., EME MD F PT 3)
  location: string;    // Localização (e.g., G2 MODULO B MEZANINO)
  module: string;      // Módulo (e.g., A, B, C)
  warehouse: string;   // Galpão (e.g., Galpão 1, Geral)
  responsible: string; // Responsável (e.g., Robson)
  status: Status;      // ONLINE / OFFLINE
}

export interface AccessPoint {
  uuid: string;        // Unique internal ID
  id: string;
  name: string;
  type: string;
  location: string;
  warehouse: string;   // Galpão
  status: Status;
  lastLog: string;
  latency?: string;    // Ping result (e.g., '12ms' or 'timeout')
}

export interface PublicDocument {
  uuid: string;
  name: string;        // Ex: AVCB, Alvará
  organ: string;       // Ex: Corpo de Bombeiros, Prefeitura
  expirationDate: string; // YYYY-MM-DD
  status?: 'VALID' | 'WARNING' | 'EXPIRED'; // Calculated on runtime
}

// --- NEW FEATURES INTERFACES ---

export interface Note {
  id: string;
  content: string;
  completed: boolean;
  createdAt: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  participants: string;
  observations: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  timestamp: string; // ISO String
}

export interface ProcessedWorker {
    id: string;
    name: string;
    company: string;
    unit: string;
    time: string;
    date: string; // YYYY-MM-DD
    accessPoint: string;
    eventType: string; // 'Entrada' ou 'Desbloqueio'
}

export interface AppData {
  cameras: Camera[];
  accessPoints: AccessPoint[];
  documents: PublicDocument[];
  notes: Note[];
  meetings: Meeting[];
  events: CalendarEvent[];
  lastSync: string;
}

declare global {
  interface Window {
    XLSX: any;
  }
}
