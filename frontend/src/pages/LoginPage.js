import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('admin');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password, name, role);
        toast.success('Account created successfully');
      } else {
        await login(email, password);
        toast.success('Welcome back');
      }
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center p-4" data-testid="login-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fade-in-up stagger-1">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 bg-[#0B1F3B] rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#1E4FFF]" />
            </div>
            <span className="font-heading text-2xl font-bold text-[#0B1F3B] tracking-tight">Eenera</span>
          </div>
          <p className="text-sm text-slate-500">Governance Reasoning Engine</p>
        </div>

        <Card className="border-slate-200 shadow-sm animate-fade-in-up stagger-2">
          <CardHeader className="pb-4 border-b border-slate-100">
            <CardTitle className="text-lg font-heading">{isRegister ? 'Create Account' : 'Sign In'}</CardTitle>
            <CardDescription>
              {isRegister ? 'Set up your governance workspace' : 'Access your compliance dashboard'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      data-testid="register-name-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Smith"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={role} onValueChange={setRole} data-testid="register-role-select">
                      <SelectTrigger data-testid="role-select-trigger">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="contributor">Contributor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  data-testid="password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#0B1F3B] hover:bg-[#162B4D] text-white"
                disabled={loading}
                data-testid="auth-submit-btn"
              >
                {loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                onClick={() => setIsRegister(!isRegister)}
                className="text-sm text-[#1E4FFF] hover:underline"
                data-testid="toggle-auth-mode"
              >
                {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
