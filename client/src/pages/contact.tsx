import { Link } from "wouter";
import { ArrowLeft, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SiFacebook, SiTelegram } from "react-icons/si";
import telegramQr from "@assets/IMG_9866_1771435935513.jpeg";

export default function Contact() {
  return (
    <div className="min-h-screen bg-background" data-testid="page-contact">
      <div className="fixed top-4 left-4 z-20">
        <Link href="/">
          <Button size="icon" variant="ghost" className="bg-black/40 backdrop-blur-sm text-white" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
      </div>

      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-16">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2" data-testid="text-contact-title">
          Contact Us
        </h1>
        <p className="text-muted-foreground mb-10 text-center max-w-md">
          Have questions or feedback? Reach out to us through any of these channels.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg">
          <a
            href="https://m.me/174zmXfDk5"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-facebook-messenger"
          >
            <Card className="p-6 hover-elevate cursor-pointer text-center">
              <div className="w-16 h-16 rounded-full bg-blue-600/10 flex items-center justify-center mx-auto mb-4">
                <SiFacebook className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Facebook</h3>
              <p className="text-sm text-muted-foreground">Message us on Messenger</p>
              <Button variant="outline" className="mt-4 w-full">
                <MessageCircle className="w-4 h-4 mr-2" />
                Open Messenger
              </Button>
            </Card>
          </a>

          <a
            href="https://t.me/zawnaing"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-telegram"
          >
            <Card className="p-6 hover-elevate cursor-pointer text-center">
              <div className="w-16 h-16 rounded-full bg-sky-500/10 flex items-center justify-center mx-auto mb-4">
                <SiTelegram className="w-8 h-8 text-sky-400" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Telegram</h3>
              <p className="text-sm text-muted-foreground">Chat with us on Telegram</p>
              <Button variant="outline" className="mt-4 w-full">
                <Send className="w-4 h-4 mr-2" />
                Open Telegram
              </Button>
            </Card>
          </a>
        </div>

        <div className="mt-10">
          <Card className="p-4 overflow-hidden">
            <img
              src={telegramQr}
              alt="Telegram QR Code"
              className="w-48 h-48 object-contain mx-auto rounded-md"
              data-testid="img-telegram-qr"
            />
            <p className="text-xs text-muted-foreground text-center mt-2">Scan to connect on Telegram</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
