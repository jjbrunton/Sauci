import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, Mail } from 'lucide-react';
import logoImage from '@/assets/logo.png';

export function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-background">
            {/* Left side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-background via-[hsl(340,30%,12%)] to-background" />

                {/* Decorative elements */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-[hsl(25,80%,50%)]/10 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[hsl(280,50%,40%)]/5 rounded-full blur-3xl" />

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center justify-center w-full p-12">
                    <div className="text-center max-w-md">
                        {/* Logo */}
                        <div className="relative mb-8 inline-block">
                            <img
                                src={logoImage}
                                alt="Sauci"
                                className="w-32 h-32 object-contain mx-auto"
                            />
                            <div className="absolute inset-0 bg-gradient-rose opacity-20 rounded-full blur-2xl scale-150" />
                        </div>

                        <h1 className="text-5xl font-bold mb-4 text-gradient-sunset">
                            Sauci
                        </h1>
                        <p className="text-xl text-muted-foreground mb-8 font-light">
                            Admin Portal
                        </p>

                        <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-primary/50 to-transparent mb-8" />

                        <p className="text-muted-foreground/80 text-sm leading-relaxed">
                            Manage your content, monitor user engagement, and deliver exceptional experiences to couples everywhere.
                        </p>
                    </div>
                </div>

                {/* Bottom decoration */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            </div>

            {/* Right side - Login form */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden text-center mb-12">
                        <img
                            src={logoImage}
                            alt="Sauci"
                            className="w-20 h-20 object-contain mx-auto mb-4"
                        />
                        <h1 className="text-3xl font-bold text-gradient-sunset">Sauci</h1>
                        <p className="text-muted-foreground text-sm mt-1">Admin Portal</p>
                    </div>

                    {/* Form card */}
                    <div className="glass rounded-2xl p-8 glow-rose">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-foreground mb-2">
                                Welcome Back
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                Sign in to continue to your dashboard
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                                    Email Address
                                </Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        disabled={loading}
                                        className="pl-11 h-12 bg-background/50 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                                    Password
                                </Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={loading}
                                        className="pl-11 h-12 bg-background/50 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 transition-all"
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 bg-gradient-rose hover:opacity-90 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 btn-shine"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </form>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-xs text-muted-foreground/60 mt-8">
                        Sauci Admin Portal &copy; {new Date().getFullYear()}
                    </p>
                </div>
            </div>
        </div>
    );
}
