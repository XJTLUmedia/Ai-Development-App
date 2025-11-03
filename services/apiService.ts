// This service handles communication with the backend server.
// Note: The backend server in `backend/server.ts` must be running for these calls to succeed.

const API_BASE_URL = 'http://localhost:3001/api'; // Adjust if your backend runs elsewhere

// --- Token Management ---

export const setToken = (token: string): void => {
  localStorage.setItem('authToken', token);
};

export const getToken = (): string | null => {
  return localStorage.getItem('authToken');
};

export const removeToken = (): void => {
  localStorage.removeItem('authToken');
};

export const getUserFromToken = (): { username: string } | null => {
    const token = getToken();
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return { username: payload.username };
    } catch (error) {
        console.error("Failed to parse token:", error);
        removeToken();
        return null;
    }
}

// --- API Call Helper ---

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    (headers as any)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }
    throw new Error(errorData.error || `An unexpected API error occurred.`);
  }

  // For 201 Created with message but no JSON body
  if (response.status === 201 && response.headers.get('content-length') === '0') {
      return { success: true };
  }
  
  return response.json();
};

// --- Auth Endpoints ---

export const register = (credentials: { username: string, password: any }) => {
    return apiFetch('/register', {
        method: 'POST',
        body: JSON.stringify(credentials),
    });
};

export const login = (credentials: { username: string, password: any }) => {
    return apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
    });
};

// --- History Endpoints ---

/**
 * Saves the chat history to the backend. Fails silently if user is not logged in.
 * @param goal The user's primary goal.
 * @param result The final synthesized result from the AI.
 */
export const saveChatHistory = async (goal: string, result: string): Promise<void> => {
  if (!getToken()) {
    console.log("User not logged in. Skipping history save.");
    return;
  }
  try {
    await apiFetch('/save_history', {
      method: 'POST',
      body: JSON.stringify({ goal, result }),
    });
    console.log('Successfully saved chat history.');
  } catch (error) {
    console.error('Failed to save chat history:', error);
    // In a real app, you might show a non-intrusive notification to the user
  }
};

export const getHistory = () => {
  return apiFetch('/history');
};