
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface HeroProps {
  onGetStarted: () => void;
}

const Hero = ({ onGetStarted }: HeroProps) => {
  return (
    <section className="bg-gradient-to-b from-violet-50 via-indigo-50 to-white py-20">
      <div className="container mx-auto px-4 text-center">
        <div className="mb-8">
          <span className="inline-block bg-violet-100 text-violet-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            Your audio editing revolution
          </span>
        </div>
        
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          Tired of the endless
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-500 mt-2">
            silence trimming struggle?
          </span>
        </h1>
        
        <div className="max-w-3xl mx-auto mb-10">
          <p className="text-xl md:text-2xl text-gray-700 mb-4">
            SilenceCut intelligently zaps away the quiet spots in seconds
          </p>
          <p className="text-lg text-gray-600">
            Hunting down each small pause is <em className="font-medium text-violet-700">soul-crushing</em> work
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
          <Button 
            size="lg" 
            onClick={onGetStarted} 
            className="text-lg px-8 py-6 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 group"
          >
            Transform Your Content
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            onClick={onGetStarted} 
            className="text-lg px-8 py-6 border-violet-300 text-violet-700 hover:bg-violet-50"
          >
            View Demo
          </Button>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-4xl mx-auto bg-opacity-80 backdrop-blur-sm border border-violet-100">
          <span className="inline-block text-violet-500 text-sm font-semibold uppercase tracking-wider mb-3">
            Work smarter, not harder
          </span>
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Why waste time on manual edits?</h2>
          <p className="text-lg mb-6 text-gray-700">
            SilenceCut handles all those repetitive cuts automatically.
          </p>
          <p className="text-lg mb-6 text-gray-700">
            The perfect tool for podcasters, YouTubers, and content creators who value their time.
          </p>
          <p className="text-lg text-violet-700 font-medium">
            Free up your schedule for what really matters – creating amazing content your audience will love.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Hero;
