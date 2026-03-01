export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">PropertyLeads</h1>
          <p className="mt-1 text-sm text-slate-500">UK property lead generation</p>
        </div>
        {children}
      </div>
    </div>
  )
}
