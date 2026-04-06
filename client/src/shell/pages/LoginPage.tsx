export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm p-8 w-full max-w-[420px] space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 brand-gradient rounded-xl mx-auto flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">
            <span className="text-[#293b83]">Intelli</span>
            <span className="text-[#67b4b0]">Sense</span>
          </h1>
          <p className="text-sm text-[#b4b4b4]">Customer Lifecycle Intelligence</p>
        </div>

        {/* Form placeholder */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              className="mt-1 w-full px-4 py-3 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-[#67b4b0]/30 focus:outline-none"
            />
          </div>
          <div>
            <div className="flex justify-between">
              <label className="text-sm font-medium text-slate-700">Senha</label>
              <a href="#" className="text-sm text-[#67b4b0]">Esqueceu a senha?</a>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              className="mt-1 w-full px-4 py-3 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-[#67b4b0]/30 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="rounded text-[#293b83] focus:ring-[#293b83]" />
            Manter conectado
          </label>
          <button className="w-full h-12 brand-gradient text-white font-semibold rounded-lg hover:opacity-90 active:scale-[0.98] transition-all">
            Entrar
          </button>
        </div>

        {/* Separator */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-4 text-slate-400">ou</span>
          </div>
        </div>

        {/* Register */}
        <button className="w-full h-11 border-2 border-[#293b83] text-[#293b83] font-semibold rounded-lg hover:bg-slate-50 transition-colors">
          Criar conta
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-[#b4b4b4]">Powered by Brintell</p>
      </div>
    </div>
  );
}
