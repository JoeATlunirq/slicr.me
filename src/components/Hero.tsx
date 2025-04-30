import { Button } from "@/components/ui/button";

interface HeroProps {
  onGetStarted: () => void;
}

const Hero = ({ onGetStarted }: HeroProps) => {
  return (
    <section className="bg-gradient-to-b from-background to-gray-50 py-20 md:py-32">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold text-foreground mb-6 leading-tight">
          Video Editing Made <span className="text-primary">Effortless</span>
        </h1>
        
        <div className="max-w-3xl mx-auto mb-10">
          <p className="text-lg md:text-xl text-muted-foreground mb-10">
            Slicr.me removes the silence automatically in seconds
          </p>
          <p className="text-lg text-gray-600">
            Finding and removing every little pause takes <em className="font-medium">forever</em>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
          <Button size="lg" onClick={onGetStarted} className="text-lg px-8 py-6">
            Try It Now
          </Button>
          <Button size="lg" variant="outline" onClick={onGetStarted} className="text-lg px-8 py-6">
            See How It Works
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">What if it was automatic?</h2>
          <p className="text-lg mb-6">
            Slicr.me does all this tedious cutting for you.
          </p>
          <p className="text-lg mb-6">
            We don't have to do it by hand any more!
          </p>
          <p className="text-lg">
            Imagine all the time you can save – and how easy it'll be to produce more of the content your audience loves.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Hero;
