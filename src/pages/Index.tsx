
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "react-router-dom";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Testimonials from "@/components/Testimonials";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import AppInterface from "@/components/AppInterface";
import { ArrowDown, Save, History } from "lucide-react";

const Index = () => {
  const [showApp, setShowApp] = useState(false);
  
  if (showApp) {
    return <AppInterface onBack={() => setShowApp(false)} />;
  }
  
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
              SilenceCut
            </span>
          </h1>
        </div>
        
        <nav className="hidden md:flex items-center space-x-6">
          <a href="#features" className="text-gray-700 hover:text-purple-600 transition-colors">Features</a>
          <a href="#how-it-works" className="text-gray-700 hover:text-purple-600 transition-colors">How It Works</a>
          <Link to="/scripts" className="text-gray-700 hover:text-purple-600 transition-colors flex items-center">
            <Save className="h-4 w-4 mr-1" />
            Scripts
          </Link>
          <Link to="/history" className="text-gray-700 hover:text-purple-600 transition-colors flex items-center">
            <History className="h-4 w-4 mr-1" />
            History
          </Link>
        </nav>
        
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => setShowApp(true)}
            className="border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            Try It Now
          </Button>
          <Button 
            onClick={() => setShowApp(true)}
            className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
          >
            Get Started
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <Hero onGetStarted={() => setShowApp(true)} />
      
      {/* Main Content */}
      <div className="container mx-auto px-4 py-16">
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing onGetStarted={() => setShowApp(true)} />
        <FAQ />
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-purple-50 to-pink-50 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between">
            <div className="mb-8 md:mb-0">
              <h2 className="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">SilenceCut</h2>
              <p className="text-gray-600 max-w-md">
                Automatically remove silence from your videos and save hours of editing time.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <h3 className="font-medium mb-4 text-purple-800">Product</h3>
                <ul className="space-y-2">
                  <li><a href="#features" className="text-gray-600 hover:text-purple-600">Features</a></li>
                  <li><a href="#how-it-works" className="text-gray-600 hover:text-purple-600">How it works</a></li>
                  <li><a href="#pricing" className="text-gray-600 hover:text-purple-600">Pricing</a></li>
                  <li><a href="#faq" className="text-gray-600 hover:text-purple-600">FAQ</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-4 text-purple-800">Resources</h3>
                <ul className="space-y-2">
                  <li><Link to="/scripts" className="text-gray-600 hover:text-purple-600">Saved Scripts</Link></li>
                  <li><Link to="/history" className="text-gray-600 hover:text-purple-600">Project History</Link></li>
                  <li><a href="#" className="text-gray-600 hover:text-purple-600">Tutorials</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-4 text-purple-800">Company</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-600 hover:text-purple-600">About</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-purple-600">Contact</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-purple-600">Privacy</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-purple-600">Terms</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-purple-100 mt-12 pt-6">
            <p className="text-gray-600 text-center">© {new Date().getFullYear()} SilenceCut. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Scroll to top button */}
      <a 
        href="#top" 
        className="fixed bottom-8 right-8 bg-gradient-to-r from-purple-500 to-pink-600 text-white p-3 rounded-full shadow-lg hover:from-purple-600 hover:to-pink-700 transition-all"
      >
        <ArrowDown className="transform rotate-180" />
      </a>
    </div>
  );
};

export default Index;
