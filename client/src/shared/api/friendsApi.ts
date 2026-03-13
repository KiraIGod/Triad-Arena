import axiosInstance from './axios'

export interface Friend {
  id: string;
  username: string;
  status: 'online' | 'offline';
}

export interface FriendRequest {
  id: string;
  userId: string;
  username: string;
}

export interface FriendsResponse {
  friends: Friend[];
  requests: FriendRequest[];
}

export const fetchFriendsList = async (token: string): Promise<FriendsResponse> => {
  const response = await axiosInstance.get('/friends', {
    headers: { Authorization: `Bearer ${token}` }
  })
  return response.data
}

export const sendFriendRequest = async (token: string, targetUsername: string): Promise<void> => {
  const response = await axiosInstance.post('/friends/request',
    { targetUsername },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data
}

export const respondToFriendRequest = async (token: string, requestId: string, action: 'accept' | 'decline'): Promise<void> => {
  const response = await axiosInstance.put('/friends/respond',
    { requestId, action },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data
}