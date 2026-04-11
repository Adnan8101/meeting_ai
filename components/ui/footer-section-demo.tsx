import { Footer } from '@/components/ui/footer-section';

export default function FooterSectionDemo() {
  return (
    <div
      className="relative flex min-h-svh flex-col"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.9)), url('https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1800&q=80')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="min-h-screen flex items-center justify-center">
        <h1 className="font-mono text-2xl font-bold text-white">Scroll Down!</h1>
      </div>
      <Footer />
    </div>
  );
}
