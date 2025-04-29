
import { Button } from "@/components/ui/button";
import { ArrowRight, Scissors, Clock, Sparkles } from "lucide-react";

interface HeroProps {
  onGetStarted: () => void;
}

const Hero = ({ onGetStarted }: HeroProps) => {
  return (
    <section className="bg-gradient-to-br from-fuchsia-100 via-violet-100 to-cyan-100 py-20 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-gradient-to-br from-pink-300 to-purple-400 opacity-30 blur-3xl"></div>
      <div className="absolute top-40 -left-20 w-72 h-72 rounded-full bg-gradient-to-br from-cyan-300 to-blue-400 opacity-20 blur-3xl"></div>
      
      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="mb-8">
          <span className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2 rounded-full text-sm font-medium mb-4 shadow-lg shadow-purple-200 animate-pulse">
            Say goodbye to editing drudgery
          </span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500">
            Smart Silence
          </span>
          <br />
          <span className="mt-2 block text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">
            Intelligent Editing
          </span>
        </h1>
        
        <div className="max-w-3xl mx-auto mb-10">
          <p className="text-xl md:text-2xl text-gray-700 mb-4">
            SilenceCut magically transforms your videos by removing dead air 
            <span className="inline-block animate-bounce mx-1">⚡</span> 
            in seconds
          </p>
          <p className="text-lg text-gray-600">
            No more <span className="line-through text-red-500">tedious cutting</span> or <span className="line-through text-red-500">endless scrubbing</span>. Let AI do the heavy lifting.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
          <Button 
            size="lg" 
            onClick={onGetStarted} 
            className="text-lg px-8 py-6 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-600 hover:from-violet-600 hover:via-fuchsia-600 hover:to-pink-700 shadow-lg shadow-purple-200/50 group transition-all duration-300"
          >
            Transform Your Content
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            onClick={onGetStarted} 
            className="text-lg px-8 py-6 border-2 border-violet-300 text-violet-700 hover:bg-violet-50 hover:border-violet-400 transition-all duration-300"
          >
            See How It Works
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl shadow-xl p-6 border border-purple-100 transform hover:scale-105 transition-all duration-300">
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 text-white p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
              <Scissors className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-purple-800">Smart Cutting</h3>
            <p className="text-gray-600">
              Our AI detects and removes silence with precision, creating flowing content.
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-xl p-6 border border-blue-100 transform hover:scale-105 transition-all duration-300">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
              <Clock className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-blue-800">Save Hours</h3>
            <p className="text-gray-600">
              What used to take hours now happens in seconds with our advanced algorithms.
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-white to-pink-50 rounded-2xl shadow-xl p-6 border border-pink-100 transform hover:scale-105 transition-all duration-300">
            <div className="bg-gradient-to-br from-pink-500 to-fuchsia-500 text-white p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-pink-800">Perfect Results</h3>
            <p className="text-gray-600">
              Fine-tune settings for results that sound natural and professional.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
