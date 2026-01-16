import { useState, useEffect } from "react";

export const useAuth = () => {
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock a persistent session
    let mockId = localStorage.getItem("mock_user_id");
    if (!mockId) {
      mockId = "user-" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("mock_user_id", mockId);
    }

    setSession({ user: { id: mockId } });
    setLoading(false);
  }, []);

  const signInAnonymously = async () => {
    return { error: null };
  };

  return {
    session,
    userId: session?.user?.id,
    loading,
    signInAnonymously
  };
};
