
import { Card, CardContent } from "@/components/ui/card";

const Testimonials = () => {
  const testimonials = [
    {
      quote: "I knew SilenceCut is awesome, but it blew my freakin mind anyway. I used to say that 1 minute of video takes 1 hour to make. Well I just made 11 minute video in ~30 minutes. Recording and everything.",
      author: "Filip Hric",
      title: "@filip_hric"
    },
    {
      quote: "I absolutely LOVE SilenceCut! I've been creating Youtube videos for over a year, and half of my time editing is spent doing the tedious things like editing out the silence / breaths between words. This was easily the best $100 I've ever spent.",
      author: "Kelsey Rodriguez",
      title: "Content Creator"
    },
    {
      quote: "One of the reasons I've not been in a rush to find an editor is because of SilenceCut. It's one of the few things that has honestly been a game changer for me when it comes to Youtube.",
      author: "Akta",
      title: "YouTuber"
    },
    {
      quote: "I bought this in a heartbeat. It's going to save so much time editing screencasts. Such a smart, simple app.",
      author: "Adam McCrea",
      title: "@adamlogic"
    },
    {
      quote: "This tool REVOLUTIONIZES how I'm able to not only edit videos, but conceive and record them since it frees me up to not worry about dead time or bad takes. It paid for itself after one use.",
      author: "David Das",
      title: "Video Creator"
    }
  ];

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-6">Loved by Creators</h2>
        <p className="text-center text-xl text-gray-700 mb-16 max-w-3xl mx-auto">
          See what content creators are saying about how SilenceCut has transformed their workflow
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <blockquote className="text-lg mb-6">"{testimonial.quote}"</blockquote>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gray-200 rounded-full mr-4"></div>
                  <div>
                    <p className="font-medium">{testimonial.author}</p>
                    <p className="text-gray-600 text-sm">{testimonial.title}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
