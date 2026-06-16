import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

// Un account collegato è un vero utente (email/password propri) al quale
// l'utente loggato ha ottenuto accesso tramite la tabella account_links.
export type ManagedProfile = {
  id: string; // user_id dell'account collegato
  full_name: string | null;
  date_of_birth: string | null;
  relation: string;
  link_id: string; // account_links.id
};

// Mantenuto solo per retro-compatibilità di tipo con eventuali import esistenti.
export type NewManagedProfile = {
  id: string;
  name: string;
  date_of_birth: string | null;
  sex: string | null;
  relation: string;
  blood_type: string | null;
  notes: string | null;
  avatar_color: string | null;
};

export type ProfileType = "owner" | "family_link" | "new_managed";
export type ProfileQueryFilter = { col: "user_id" | "managed_profile_id"; val: string };

type Ctx = {
  ownId: string | null;
  activeId: string | null;
  activeProfile: { id: string; full_name: string | null; date_of_birth: string | null } | null;
  managed: ManagedProfile[];
  newManagedProfiles: NewManagedProfile[];
  profileType: ProfileType;
  queryFilter: ProfileQueryFilter | null;
  activeManagedProfile: NewManagedProfile | null;
  isManaging: boolean;
  setActive: (id: string) => void;
  setActiveMp: (mpId: string) => void;
  refresh: () => Promise<void>;
  refreshNewManaged: () => Promise<void>;
};

const ActiveProfileContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "previ.activeProfileId";
const TYPE_KEY = "previ.activeProfileType";

export function ActiveProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [profileType, setProfileType] = useState<ProfileType>("owner");
  const [managed, setManaged] = useState<ManagedProfile[]>([]);
  const [ownProfile, setOwnProfile] = useState<any>(null);

  const refresh = async () => {
    if (!user) {
      setActiveId(null);
      setProfileType("owner");
      setManaged([]);
      setOwnProfile(null);
      return;
    }

    const [{ data: own }, linksRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,date_of_birth")
        .eq("id", user.id)
        .maybeSingle(),
      (supabase as any)
        .from("account_links")
        .select("id,linked_user_id,status")
        .eq("owner_id", user.id)
        .eq("status", "accepted"),
    ]);

    if (linksRes.error) {
      console.error(
        "[ActiveProfile] account_links query error — code:",
        linksRes.error.code,
        "message:",
        linksRes.error.message,
      );
      if (linksRes.error.code === "42P01") {
        console.error(
          "[ActiveProfile] ⚠️ Table 'account_links' does NOT exist. Run supabase/migrations/20260616120000_account_links.sql in the Supabase SQL Editor.",
        );
      }
    }
    setOwnProfile(own || null);

    const links = (linksRes.data || []) as { id: string; linked_user_id: string; status: string }[];
    const linkedIds = links.map((l) => l.linked_user_id);

    let list: ManagedProfile[] = [];
    if (linkedIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,full_name,date_of_birth")
        .in("id", linkedIds);
      list = linkedIds.map((id) => {
        const p = (profs || []).find((x: any) => x.id === id);
        const link = links.find((l) => l.linked_user_id === id);
        return {
          id,
          full_name: p?.full_name ?? null,
          date_of_birth: p?.date_of_birth ?? null,
          relation: "Account collegato",
          link_id: link?.id || "",
        };
      });
    }
    setManaged(list);

    const storedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (storedId && linkedIds.includes(storedId)) {
      setActiveId(storedId);
      setProfileType("family_link");
    } else {
      setActiveId(user.id);
      setProfileType("owner");
    }
  };

  useEffect(() => {
    refresh(); /* eslint-disable-next-line */
  }, [user?.id]);

  const setActive = (id: string) => {
    const type: ProfileType = id === user?.id ? "owner" : "family_link";
    setActiveId(id);
    setProfileType(type);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
      localStorage.setItem(TYPE_KEY, type);
    }
  };

  const queryFilter: ProfileQueryFilter | null = !activeId
    ? null
    : { col: "user_id", val: activeId };

  const activeProfile =
    activeId === user?.id
      ? ownProfile
      : managed.find((m) => m.id === activeId)
        ? {
            id: activeId!,
            full_name: managed.find((m) => m.id === activeId)!.full_name,
            date_of_birth: managed.find((m) => m.id === activeId)!.date_of_birth,
          }
        : null;

  return (
    <ActiveProfileContext.Provider
      value={{
        ownId: user?.id ?? null,
        activeId,
        activeProfile,
        managed,
        // managed_profiles abbandonato — stub per retro-compatibilità dei consumer.
        newManagedProfiles: [],
        profileType,
        queryFilter,
        activeManagedProfile: null,
        isManaging: profileType !== "owner",
        setActive,
        setActiveMp: () => {},
        refresh,
        refreshNewManaged: async () => {},
      }}
    >
      {children}
    </ActiveProfileContext.Provider>
  );
}

export function useActiveProfile() {
  const ctx = useContext(ActiveProfileContext);
  if (!ctx) {
    return {
      ownId: null,
      activeId: null,
      activeProfile: null,
      managed: [],
      newManagedProfiles: [],
      profileType: "owner" as ProfileType,
      queryFilter: null,
      activeManagedProfile: null,
      isManaging: false,
      setActive: () => {},
      setActiveMp: () => {},
      refresh: async () => {},
      refreshNewManaged: async () => {},
    } as Ctx;
  }
  return ctx;
}
