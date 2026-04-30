import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useLogin } from "../../shared/hooks/useAuth";
import { useAuthContext } from "../contexts/AuthContext";
import RegisterPage from "./RegisterPage";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [, navigate] = useLocation();
  const login = useLogin();
  const { deactivateDemo, isAuthenticated, isDemoMode } = useAuthContext();

  // Redirect after real login (not demo mode).
  useEffect(() => {
    if (isAuthenticated && !isDemoMode) navigate("/");
  }, [isAuthenticated, isDemoMode, navigate]);

  if (showRegister) {
    return <RegisterPage onBack={() => setShowRegister(false)} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password, rememberMe });
      navigate("/", { replace: true });
    } catch {
      // error shown in UI
    }
  };

  const handleDemo = async () => {
    try {
      deactivateDemo();
      await login.mutateAsync({
        email: "demo@dcco.com.br",
        password: "Demo@2026",
        rememberMe: true,
      });
      navigate("/");
    } catch {
      // error shown in UI
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm p-8 w-full max-w-[420px] space-y-6">
        {/* Logo */}
        <div className="flex justify-center py-2">
          <img
            src="/logo.png"
            alt="IntelliSense"
            className="w-72 h-auto object-contain"
          />
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-800 text-center">Acesse sua conta</h2>
        </div>

        {/* Error */}
        {login.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {login.error.message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">E-mail</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#67b4b0]/30 focus:border-[#67b4b0] focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between">
              <label className="text-sm font-medium text-slate-700">Senha</label>
              <a href="#" className="text-sm text-[#67b4b0] hover:underline">Esqueceu a senha?</a>
            </div>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#67b4b0]/30 focus:border-[#67b4b0] focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-[#293b83] cursor-pointer"
            />
            <span className="text-sm text-slate-600">Lembrar por 7 dias</span>
          </label>

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full h-12 brand-gradient text-white font-semibold rounded-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {login.isPending ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {/* Demo button */}
        <button
          onClick={handleDemo}
          disabled={login.isPending}
          className="w-full h-11 bg-slate-100 text-slate-600 font-medium rounded-lg hover:bg-slate-200 transition-colors text-sm"
        >
          {login.isPending ? "Entrando..." : "▶ Entrar como Demo (DCCO)"}
        </button>

        {/* Separator */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-4 text-slate-400">ou</span>
          </div>
        </div>

        <button
          onClick={() => setShowRegister(true)}
          className="w-full h-11 border-2 border-[#293b83] text-[#293b83] font-semibold rounded-lg hover:bg-slate-50 transition-colors"
        >
          Criar conta
        </button>

        <p className="text-center text-xs text-[#b4b4b4]">Powered by Brintell</p>
      </div>
    </div>
  );
}
