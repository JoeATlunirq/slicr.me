import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

// WARNING: This password is hardcoded client-side and easily discoverable.
// This provides minimal protection against casual browsing only.
// Access the env var using import.meta.env for frontend code
const CORRECT_PASSWORD = import.meta.env.VITE_API_DOCS_PASSWORD || "password";

interface ApiLoginProps {
  onSuccess: () => void;
}

const ApiLogin: React.FC<ApiLoginProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Clear previous errors
    if (password === CORRECT_PASSWORD) {
      // In a real app, you'd set a token or session state.
      // Here, we just call the success callback provided by App.tsx.
      console.log("API Docs Password Correct. Granting access.");
      onSuccess();
    } else {
      setError('Incorrect password.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>API Documentation Access</CardTitle>
          <CardDescription>Please enter the password to view the API documentation.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter password"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">Login</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ApiLogin; 