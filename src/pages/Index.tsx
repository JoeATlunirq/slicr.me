import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Testimonials from "@/components/Testimonials";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import AppInterface from "@/components/AppInterface";
import { ArrowDown } from "lucide-react";

const Index = () => {
  const [showApp, setShowApp] = useState(() => {
    const savedState = sessionStorage.getItem('slicrShowApp');
    return savedState === 'true';
  });

  const handleGetStarted = () => {
    setShowApp(true);
    sessionStorage.setItem('slicrShowApp', 'true');
  };

  const handleBack = () => {
    setShowApp(false);
    sessionStorage.removeItem('slicrShowApp');
  };

  useEffect(() => {
    if (showApp) {
      sessionStorage.setItem('slicrShowApp', 'true');
    } else {
      sessionStorage.removeItem('slicrShowApp');
    }
  }, [showApp]);

  if (showApp) {
    return <AppInterface onBack={handleBack} />;
  }
  
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold">Slicr<span className="text-primary">.me</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleGetStarted}>
            Try It Now
          </Button>
          <Button onClick={handleGetStarted}>
            Get Started
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <Hero onGetStarted={handleGetStarted} />
      
      {/* Main Content */}
      <div className="container mx-auto px-4 py-16">
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing onGetStarted={handleGetStarted} />
        <FAQ />
      </div>

      {/* Footer */}
      <footer className="bg-gray-100 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between">
            <div className="mb-8 md:mb-0">
              <h2 className="text-xl font-bold mb-4">Slicr.me</h2>
              <p className="text-gray-600 max-w-md">
                Automatically remove silence from your videos and save hours of editing time.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <h3 className="font-medium mb-4">Product</h3>
                <ul className="space-y-2">
                  <li><a href="#features" className="text-gray-600 hover:text-primary">Features</a></li>
                  <li><a href="#how-it-works" className="text-gray-600 hover:text-primary">How it works</a></li>
                  <li><a href="#pricing" className="text-gray-600 hover:text-primary">Pricing</a></li>
                  <li><a href="#faq" className="text-gray-600 hover:text-primary">FAQ</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-4">Resources</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-600 hover:text-primary">Support</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-primary">Tutorials</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-4">Company</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-600 hover:text-primary">About</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-primary">Contact</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-primary">Privacy</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-primary">Terms</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 mt-12 pt-6">
            <p className="text-gray-600 text-center">© {new Date().getFullYear()} Slicr.meAll rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Scroll to top button */}
      <a 
        href="#top" 
        className="fixed bottom-8 right-8 bg-primary text-white p-3 rounded-full shadow-lg hover:bg-primary/90 transition-all"
      >
        <ArrowDown className="transform rotate-180" />
      </a>
    </div>
  );
};

export default Index;
