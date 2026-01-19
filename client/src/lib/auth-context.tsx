import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient'; // Import the configured Axios client
import axios from 'axios'; // Import axios for error type checking

// Define the User type based on your backend response
interface User {
    id: number;
    name: string;
    email: string;
    bio?: string;       // Optional fields from backend
    avatar_url?: string; // Optional fields from backend
    created_at?: string; // Optional fields from backend
    role?: string;      // Optional fields from backend
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean; // Add loading state for initial check
    login: (email: string, password: string) => Promise<User>; // Return User on success
    signup: (name: string, email: string, password: string) => Promise<any>; // Return response data
    logout: () => void;
    updateUser: (updates: Partial<User>) => Promise<void>; // Make async for API call
    fetchCurrentUser: () => Promise<void>; // Function to manually refresh user data
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // Start loading initially

    // Effect to check authentication status on initial load
    useEffect(() => {
        const checkAuthStatus = async () => {
            setIsLoading(true);
            const token = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user'); // Also get stored user

            if (token) {
                try {
                    // Optionally verify token by fetching user data
                    // Or trust the stored user if token exists (faster initial load)
                    if (storedUser) {
                        setUser(JSON.parse(storedUser));
                        setIsAuthenticated(true);
                    } else {
                        // If user data isn't stored, fetch it
                        await fetchCurrentUser(); // This will set user and isAuthenticated on success
                    }
                } catch (error) {
                    console.error("Token validation failed:", error);
                    // If fetching fails (e.g., token expired), clear storage
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setUser(null);
                    setIsAuthenticated(false);
                }
            } else {
                // No token found
                setUser(null);
                setIsAuthenticated(false);
            }
            setIsLoading(false); // Finished loading/checking
        };

        checkAuthStatus();
    }, []); // Run only once on mount

    // Function to fetch and update current user state
    const fetchCurrentUser = async () => {
        try {
            const response = await axiosClient.get('/users/me'); // Backend endpoint to get current user
            const fetchedUser = response.data.user;
            setUser(fetchedUser);
            localStorage.setItem('user', JSON.stringify(fetchedUser)); // Update stored user data
            setIsAuthenticated(true);
        } catch (error) {
            // If fetching fails, assume token is invalid/expired
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
            setIsAuthenticated(false);
            console.error("Failed to fetch current user:", error);
            throw error; // Re-throw if needed elsewhere
        }
    };


    const login = async (email: string, password: string): Promise<User> => {
        try {
            const response = await axiosClient.post('/auth/login', { email, password });
            const { token, user: loggedInUser } = response.data;

            // Store token and user data
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(loggedInUser));

            // Update state
            setUser(loggedInUser);
            setIsAuthenticated(true);

            return loggedInUser; // Return user data on successful login

        } catch (error) {
            // Clear any potentially stale auth data on login failure
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
            setIsAuthenticated(false);
            console.error('Login API call failed:', error);
            throw error; // Re-throw the error for the component to handle (display message)
        }
    };

    const signup = async (name: string, email: string, password: string): Promise<any> => {
        try {
            // Call the backend signup endpoint
            const response = await axiosClient.post('/auth/signup', { name, email, password });

            // Signup usually requires email verification, so don't log the user in yet.
            // Just return the success response data (e.g., the message)
            // Do NOT set token or user state here.
            return response.data;

        } catch (error) {
            console.error('Signup API call failed:', error);
            throw error; // Re-throw error for the component
        }
    };

    const logout = () => {
        // Clear state
        setUser(null);
        setIsAuthenticated(false);

        // Clear stored data
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // Optional: Redirect to login page
        // window.location.href = '/auth/login';
    };

    const updateUser = async (updates: Partial<User>) => {
        if (!user) return; // Should not happen if authenticated

        try {
            // Call backend endpoint to update profile (assuming PUT /api/users/me)
            const response = await axiosClient.put('/users/me', updates); // Send only the updates
            const updatedUser = response.data.user; // Assuming backend returns updated user

            // Update state and local storage
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));

        } catch (error) {
            console.error("Update user API call failed:", error);
            throw error; // Re-throw error for component UI
        }
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, signup, logout, updateUser, fetchCurrentUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Define User type based on backend (adjust if needed)
export interface User {
    id: number;
    name: string;
    email: string;
    bio?: string;
    avatar_url?: string;
    created_at?: string;
    role?: string;
}
