import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Player {
  id: string;
  session_id: string;
  user_id: string;
  username: string;
  avatar_color: string;
  score: number;
  is_host: boolean;
  is_ready: boolean;
  is_connected: boolean;
}

export interface Drawing {
  id: string;
  player_id: string;
  round: number;
  image_data: string;
  vote_count: number;
}

export interface Room {
  id: string;
  code: string;
  host_id: string;
  status: 'lobby' | 'drawing' | 'gallery' | 'voting' | 'results' | 'finished';
  current_round: number;
  total_rounds: number;
  draw_time: number;
  vote_time: number;
  max_players: number;
  current_prompt: string | null;
  phase_end_at: string | null;
}

interface GameState {
  playerId: string | null;
  roomCode: string | null;
  username: string | null;
  
  setPlayer: (playerId: string, username: string) => void;
  setRoom: (roomCode: string) => void;
  clearGame: () => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      playerId: null,
      roomCode: null,
      username: null,
      
      setPlayer: (playerId, username) => set({ playerId, username }),
      setRoom: (roomCode) => set({ roomCode }),
      clearGame: () => set({ playerId: null, roomCode: null, username: null }),
    }),
    {
      name: 'draw-to-impress-game',
    }
  )
);

// Generate a random room code
export const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Avatar colors
export const AVATAR_COLORS = [
  '#FF6B6B', // Coral
  '#4ECDC4', // Teal
  '#FFE66D', // Yellow
  '#95E1D3', // Mint
  '#F38181', // Salmon
  '#AA96DA', // Lavender
  '#FCBAD3', // Pink
  '#A8D8EA', // Sky Blue
  '#FF9F43', // Orange
  '#6C5CE7', // Purple
];

export const getRandomAvatarColor = (): string => {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
};
