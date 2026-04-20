import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { partnerEmailForUsername } from "@/server/journey.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/today" });
    });
  }, [nav]);

  // Owner email signup
  const [oEmail, setOEmail] = useState("");
  const [oPwd, setOPwd] = useState("");
  const handleOwnerSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: oEmail,
      password: oPwd,
      options: { emailRedirectTo: window.location.origin + "/setup" },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. Continuing…");
    // immediately redirect to setup (auto sign-in usually present without confirm)
    setTimeout(() => nav({ to: "/setup" }), 200);
  };
  // Owner email login
  const [liEmail, setLiEmail] = useState("");
  const [liPwd, setLiPwd] = useState("");
  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: liEmail, password: liPwd });
    setLoading(false);
    if (error) return toast.error(error.message);
    nav({ to: "/today" });
  };

  // Partner login
  const [pUser, setPUser] = useState("");
  const [pPwd, setPPwd] = useState("");
  const handlePartnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { email } = await partnerEmailForUsername({ data: { username: pUser } });
      const { error } = await supabase.auth.signInWithPassword({ email, password: pPwd });
      if (error) throw error;
      nav({ to: "/today" });
    } catch (err: any) {
      toast.error(err.message ?? "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="mx-auto max-w-2xl w-full px-4 py-12 flex-1">
        <div className="text-center mb-10">
          <p className="font-arabic text-3xl text-primary leading-tight">
            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
          </p>
          <h1 className="mt-6 font-display text-4xl tracking-widest">OUR JOURNEY</h1>
          <p className="mt-3 text-lg italic text-muted-foreground">
            A private sanctuary for two souls walking toward Allah.
          </p>
        </div>

        <div className="parchment-card rounded-2xl p-8">
          <Tabs defaultValue="owner-login" className="w-full">
            <TabsList className="grid grid-cols-3 w-full bg-secondary/50">
              <TabsTrigger value="owner-login">Sign in</TabsTrigger>
              <TabsTrigger value="partner-login">Partner</TabsTrigger>
              <TabsTrigger value="owner-signup">Begin</TabsTrigger>
            </TabsList>

            <TabsContent value="owner-login" className="pt-6">
              <form onSubmit={handleOwnerLogin} className="space-y-4">
                <div>
                  <Label className="font-display text-xs uppercase tracking-widest">Email</Label>
                  <Input type="email" required value={liEmail} onChange={(e) => setLiEmail(e.target.value)} />
                </div>
                <div>
                  <Label className="font-display text-xs uppercase tracking-widest">Password</Label>
                  <Input type="password" required value={liPwd} onChange={(e) => setLiPwd(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full">Sign in</Button>
              </form>
            </TabsContent>

            <TabsContent value="partner-login" className="pt-6">
              <p className="text-sm text-muted-foreground mb-4 italic">
                Sign in with the username he set for you.
              </p>
              <form onSubmit={handlePartnerLogin} className="space-y-4">
                <div>
                  <Label className="font-display text-xs uppercase tracking-widest">Username</Label>
                  <Input required value={pUser} onChange={(e) => setPUser(e.target.value)} />
                </div>
                <div>
                  <Label className="font-display text-xs uppercase tracking-widest">Password</Label>
                  <Input type="password" required value={pPwd} onChange={(e) => setPPwd(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full">Enter</Button>
              </form>
            </TabsContent>

            <TabsContent value="owner-signup" className="pt-6">
              <p className="text-sm text-muted-foreground mb-4 italic">
                Create your account. After this, you'll set up her username on the next step.
              </p>
              <form onSubmit={handleOwnerSignup} className="space-y-4">
                <div>
                  <Label className="font-display text-xs uppercase tracking-widest">Your email</Label>
                  <Input type="email" required value={oEmail} onChange={(e) => setOEmail(e.target.value)} />
                </div>
                <div>
                  <Label className="font-display text-xs uppercase tracking-widest">Password</Label>
                  <Input type="password" required minLength={8} value={oPwd} onChange={(e) => setOPwd(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full">Begin the journey</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground italic">
          No tracking. No ads. Only you, her, and Him.
        </p>
      </div>

      <footer className="border-t border-border/60 bg-card/40">
        <div className="mx-auto max-w-3xl px-4 py-6 text-center">
          <p className="font-arabic text-xl text-foreground/90 leading-loose">
            وَعَسَىٰ أَن تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَّكُمْ
          </p>
          <p className="mt-2 text-sm italic text-muted-foreground">
            "Perhaps you dislike a thing and it is good for you." — Al-Baqarah 2:216
          </p>
        </div>
      </footer>
    </div>
  );
}
