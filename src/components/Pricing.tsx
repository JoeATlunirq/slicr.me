
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

interface PricingProps {
  onGetStarted: () => void;
}

const Pricing = ({ onGetStarted }: PricingProps) => {
  const plans = [
    {
      name: "Free Trial",
      price: "$0",
      billing: "",
      features: [
        "Every feature unlocked",
        "No watermarks",
        "Limited to 5 exports",
        "Try before you buy"
      ],
      buttonText: "Download Trial",
      popular: false,
      action: onGetStarted
    },
    {
      name: "Lifetime License",
      price: "$129",
      billing: "once",
      features: [
        "All features included",
        "Free minor updates",
        "Use on all your devices",
        "30-day money back guarantee"
      ],
      buttonText: "Buy Now",
      popular: true,
      action: onGetStarted
    },
    {
      name: "Annual",
      price: "$79",
      billing: "per year",
      features: [
        "All features included",
        "All updates included",
        "Use on all your devices",
        "Cancel anytime"
      ],
      buttonText: "Subscribe",
      popular: false,
      action: onGetStarted
    }
  ];

  return (
    <section id="pricing" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-6">Try For Free, Buy For Life</h2>
        <p className="text-center text-xl text-gray-700 mb-16 max-w-3xl mx-auto">
          SilenceCut comes as either a one-time purchase or a subscription.
          Try the app for free on your own projects!
        </p>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`${
                plan.popular 
                  ? "border-primary shadow-lg shadow-primary/10" 
                  : "border border-gray-200"
              }`}
            >
              {plan.popular && (
                <div className="bg-primary text-white text-center py-1 text-sm font-medium">
                  MOST POPULAR
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.billing && <span className="ml-1 text-gray-600">/{plan.billing}</span>}
                </div>
                <CardDescription className="mt-2">
                  Everything you need to save time editing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start">
                      <Check className="h-5 w-5 text-primary mr-2 mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={plan.action}
                  variant={plan.popular ? "default" : "outline"}
                >
                  {plan.buttonText}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
