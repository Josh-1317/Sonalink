import React, { useState } from 'react';
import { ArrowLeft, Loader2, Mail, Lock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Checkbox } from '../../components/ui/checkbox';
import { useAuth } from '../../lib/auth-context';
import { SonaLinkLogo } from '../../components/sonalink-logo';
import axiosClient from '../../api/axiosClient'; // Keep the import, though useAuth handles the call
import axios from 'axios';

interface LoginPageProps {
  onNavigate: (page: string) => void;
}

export function LoginPage({ onNavigate }: LoginPageProps) {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.email || !formData.password) {
      setError('All fields are required');
      return;
    }

    try {
      setIsLoading(true);
      await login(formData.email, formData.password);
      onNavigate('dashboard');
    } catch (err) {
        // --- UPDATED ERROR HANDLING LOGIC ---
        let errorMessage = 'An unexpected error occurred during login.';

        if (axios.isAxiosError(err) && err.response) {
            // Use the specific message sent from the backend
            const backendMessage = err.response.data.message; 
            
            if (backendMessage && backendMessage.includes('Account not verified')) {
                // Specific action for unverified account
                errorMessage = `${backendMessage} You can resend the verification email from the signup page.`;
            } else {
                // Use backend message for invalid credentials, etc.
                errorMessage = backendMessage || 'Invalid email or password.';
            }
        }
      setError(errorMessage);
        // --- END UPDATED LOGIC ---
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/30 via-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => onNavigate('landing')}
          className="mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
          Back
        </Button>

        <Card className="p-8 shadow-xl border-border/50 backdrop-blur">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <SonaLinkLogo className="w-11 h-11" />
            <span className="text-xl" style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif', fontWeight: 700, letterSpacing: '-0.01em' }}>SonaLink</span>
          </div>

          <div className="mb-8">
            <h1 className="mb-2">Welcome Back</h1>
            <p className="text-muted-foreground">
              Login to your account to continue
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6 animate-in fade-in slide-in-from-top-1 duration-300">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="yourname@sona.ac.in"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="remember"
                  checked={formData.rememberMe}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, rememberMe: checked as boolean })
                  }
                />
                <Label htmlFor="remember" className="text-sm cursor-pointer font-normal">
                  Remember me
                </Label>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('forgot-password')}
                className="text-sm text-primary hover:underline underline-offset-4 transition-all"
              >
                Forgot password?
              </button>
            </div>

            <Button type="submit" className="w-full h-11 mt-6" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">New to SonaLink?</span>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onNavigate('signup')}
            >
              Create an account
            </Button>
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
