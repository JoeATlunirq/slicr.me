
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ = () => {
  const faqs = [
    {
      question: "What's the refund policy?",
      answer: "Getting a refund is easy, just send an email within 30 days and we'll give you a full refund. There is a fully-unlocked free trial where you can try every feature with no time limit and 5 free exports."
    },
    {
      question: "Can I use it on more than 1 computer?",
      answer: "The license is personal, and you only need 1 per person. So feel free to use it on all your personal machines. If you're outfitting a team, please buy 1 license for each person."
    },
    {
      question: "Are updates included in the lifetime plan?",
      answer: "Most new features and bug fixes are included. There are some features that may end up being optional add-ons."
    },
    {
      question: "What file formats does it support?",
      answer: "Snipr.me can read most common audio and video formats, like MP4, MKV, MP3, M4A, WAV, and so on. It can export to MP4, M4A, and WAV."
    },
    {
      question: "Can I use Snipr.me with my favorite video editor?",
      answer: "Yes! Snipr.me can export edit lists in XML format that can be imported into popular video editing software like Adobe Premiere, DaVinci Resolve, Final Cut Pro, and ScreenFlow."
    },
    {
      question: "Does Snipr.me work with podcasts too?",
      answer: "Absolutely. Snipr.me works great with podcasts and any audio recordings. It can save you hours of editing time by automatically removing silent gaps between speakers."
    }
  ];

  return (
    <section id="faq" className="py-20">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Frequently Asked Questions</h2>
        
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-lg font-medium text-left">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-gray-700">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQ;
