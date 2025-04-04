import apiClient from './apiClient';

interface MatchActionParams {
  targetUserId: string;
  action: 'like' | 'pass';
}

interface MatchActionResponse {
  success: boolean;
  match: {
    targetUser: string;
    action: 'like' | 'pass';
    isMatch: boolean;
  };
}

export interface MatchProfile {
  matchId: string;
  userId: string;
  name: string;
  matchedAt: string;
  photo: string | null;
  lastActive: string;
}

interface MatchesResponse {
  success: boolean;
  matches: MatchProfile[];
}

const matchService = {
  async likeOrPassUser(params: MatchActionParams): Promise<MatchActionResponse> {
    const response = await apiClient.post<MatchActionResponse>('/matches/action', params);
    return response.data;
  },
  
  async getMatches(): Promise<MatchesResponse> {
    const response = await apiClient.get<MatchesResponse>('/matches');
    return response.data;
  },
  
  async unmatch(matchId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/matches/${matchId}`);
    return response.data;
  }
};

export default matchService;
