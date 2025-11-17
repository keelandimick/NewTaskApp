import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export const Auth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    
    try {
      if (isResettingPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSuccessMessage('📧 Password reset email sent! Please check your inbox.');
        setEmail('');
      } else if (isSignUp) {
        await signUp(email, password);
        setSuccessMessage('🎉 Confirmation email sent! Please check your inbox to verify your account.');
        setEmail('');
        setPassword('');
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      // Provide more user-friendly error messages
      if (err.message?.includes('User already registered')) {
        setError('This email is already registered. Please sign in instead.');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Please check your email to confirm your account before signing in.');
      } else if (err.message?.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else {
        setError(err.message || 'An error occurred. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h2 className="text-2xl font-bold text-center mb-8">
            {isResettingPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Sign In'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            {!isResettingPassword && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            )}
            
            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}
            
            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-md">
                {successMessage}
              </div>
            )}
            
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              {isResettingPassword ? 'Send Reset Email' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-4 text-center space-y-2">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setIsResettingPassword(false);
                setError('');
                setSuccessMessage('');
                setPassword('');
              }}
              className="text-sm text-blue-600 hover:underline block w-full"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
            
            {!isSignUp && !isResettingPassword && (
              <button
                onClick={() => {
                  setIsResettingPassword(true);
                  setError('');
                  setSuccessMessage('');
                  setPassword('');
                }}
                className="text-sm text-blue-600 hover:underline block w-full"
              >
                Forgot your password?
              </button>
            )}
            
            {isResettingPassword && (
              <button
                onClick={() => {
                  setIsResettingPassword(false);
                  setError('');
                  setSuccessMessage('');
                }}
                className="text-sm text-blue-600 hover:underline block w-full"
              >
                Back to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};