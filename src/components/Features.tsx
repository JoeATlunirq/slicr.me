
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors, Clock, Layout, Download, Settings, Sparkles, Save, History } from "lucide-react";

const Features = () => {
  const features = [
    {
      title: "AI-Powered Silence Detection",
      description: "Our neural network identifies silent parts with incredible accuracy, even in noisy environments.",
      icon: Scissors,
      color: "from-violet-400 via-purple-400 to-fuchsia-500"
    },
    {
      title: "Interactive Timeline Editor",
      description: "Fine-tune your edits with our intuitive timeline interface for complete creative control.",
      icon: Layout,
      color: "from-blue-400 via-cyan-400 to-teal-500"
    },
    {
      title: "Lightning-Fast Processing",
      description: "Process hours of content in minutes - transform your workflow and save precious time.",
      icon: Clock,
      color: "from-pink-400 via-rose-400 to-red-500"
    },
    {
      title: "Multiple Export Options",
      description: "Export to popular formats or create edit lists for professional editing software.",
      icon: Download,
      color: "from-emerald-400 via-green-400 to-lime-500"
    },
    {
      title: "Save & Reuse Scripts",
      description: "Store your perfect settings for different content types and reuse them instantly.",
      icon: Save,
      color: "from-amber-400 via-orange-400 to-yellow-500"
    },
    {
      title: "Project History",
      description: "Easily access and continue working on previous projects whenever you need them.",
      icon: History,
      color: "from-indigo-400 via-blue-400 to-sky-500"
    }
  ];

  return (
    <section id="features" className="py-20 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-pink-50 relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white to-transparent"></div>
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent"></div>
      
      <div className="text-center mb-16 relative z-10">
        <span className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2 rounded-full text-sm font-medium mb-4 shadow-lg">
          MAGICAL FEATURES
        </span>
        <h2 className="text-4xl md:text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500">
          Transform Your Editing Workflow
        </h2>
        <p className="text-xl text-gray-700 max-w-3xl mx-auto">
          SilenceCut revolutionizes post-production with smart tools that make editing feel like magic.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto px-4">
        {features.map((feature, index) => (
          <Card key={index} className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-white/80 backdrop-blur-sm overflow-hidden group">
            <div className={`h-2 bg-gradient-to-r ${feature.color} w-full`} />
            <CardHeader className="flex flex-col items-center space-y-2 pt-8">
              <div className={`p-3 rounded-full bg-gradient-to-r ${feature.color} text-white transform group-hover:scale-110 transition-transform shadow-lg`}>
                <feature.icon className="h-8 w-8" />
              </div>
              <CardTitle className="text-xl text-center">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-center pb-8">
              <CardDescription className="text-base">{feature.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="mt-16 text-center">
        <div className="inline-flex items-center justify-center p-1 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 shadow-lg">
          <button className="bg-white rounded-full px-8 py-3 font-medium text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-pink-600 hover:bg-gray-50 transition-colors">
            Explore All Features
          </button>
        </div>
      </div>
    </section>
  );
};

export default Features;
