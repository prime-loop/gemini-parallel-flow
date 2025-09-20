import { useEffect, useState } from 'react';

// Mock user for test mode
const TEST_USER = {
  id: 'test-user-123',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  role: 'authenticated',
  updated_at: new Date().toISOString(),
};

const TEST_SESSION = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  expires_at: Date.now() + 3600 * 1000,
  token_type: 'bearer',
  user: TEST_USER,
};

export function useTestAuth() {
  const [isTestMode, setIsTestMode] = useState(false);

  useEffect(() => {
    // Check if test mode is enabled
    const testMode = localStorage.getItem('research_copilot_test_mode') === 'true';
    setIsTestMode(testMode);
  }, []);

  const enableTestMode = () => {
    localStorage.setItem('research_copilot_test_mode', 'true');
    setIsTestMode(true);
  };

  const disableTestMode = () => {
    localStorage.removeItem('research_copilot_test_mode');
    setIsTestMode(false);
  };

  return {
    isTestMode,
    enableTestMode,
    disableTestMode,
    testUser: TEST_USER,
    testSession: TEST_SESSION,
  };
}