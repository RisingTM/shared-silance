import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  journey_id: string;
  username: string;
  display_name: string | null;
  role: "owner" | "partner";
  must_set_password: boolean;
};

export type Journey = {
  id: string;
  nc_start_date: string;
  has_been_reset: boolean;
};

export type Session = {
  user: User | null;
  profile: Profile | null;
  journey: Journey | null;
  partnerProfile: Profile | null;
  loading: boolean;
};

export function useSession(): Session & { refresh: () => Promise<void> } {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (u: User | null) => {
    if (!u) {
      setProfile(null);
      setJourney(null);
      setPartner(null);
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", u.id)
      .maybeSingle();
    setProfile(prof as Profile | null);
    if (prof) {
      const [{ data: j }, { data: others }] = await Promise.all([
        supabase.from("journeys").select("*").eq("id", prof.journey_id).maybeSingle(),
        supabase.from("profiles").select("*").eq("journey_id", prof.journey_id).neq("id", u.id),
      ]);
      setJourney(j as Journey | null);
      setPartner((others?.[0] as Profile) ?? null);
    } else {
      setJourney(null);
      setPartner(null);
    }
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
    await loadProfile(data.user);
  };

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      // Defer profile load to avoid deadlock
      setTimeout(() => loadProfile(session?.user ?? null), 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      loadProfile(data.session?.user ?? null).finally(() => setLoading(false));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, profile, journey, partnerProfile: partner, loading, refresh };
}

export async function signOut() {
  await supabase.auth.signOut();
}
