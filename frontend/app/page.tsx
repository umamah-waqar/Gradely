import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      <h1 className="text-5xl font-black mb-4 tracking-tight">GRADELY</h1>
      <p className="text-xl text-slate-400 mb-8">Real-time enterprise multi-tenant quiz engine.</p>
      <div className="flex gap-4">
        <Link href="/login" className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded font-medium transition">Login</Link>
        <Link href="/register" className="bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded font-medium transition">Register</Link>
      </div>
    </div>
  );
}