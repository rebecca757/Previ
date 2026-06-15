import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type ManagedProfile = {
  id: string;
  full_name: string | null;
  date_of_birth: string | null;
  relation: string;
  link_id: string;
};

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
  const [newManagedProfiles, setNewManagedProfiles] = useState<NewManagedProfile[]>([]);
  const [ownProfile, setOwnProfile] = useState<any>(null);

  const refreshNewManaged = async (): Promise<void> => {
    if (!user) { setNewManagedProfiles([]); return; }
    const { data } = await (supabase as any)
      .from("managed_profiles")
      .select("id,name,date_of_birth,sex,relation,blood_type,notes,avatar_color")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: true });
    setNewManagedProfiles((data || []) as NewManagedProfile[]);
  };

  const refresh = async () => {
    if (!user) {
      setActiveId(null);
      setProfileType("owner");
      setManaged([]);
      setNewManagedProfiles([]);
      setOwnProfile(null);
      return;
    }
    const [{ data: own }, { data: links }, nmData] = await Promise.all([
      supabase.from("profiles").select("id,full_name,date_of_birth").eq("id", user.id).maybeSingle(),
      supabase
        .from("family_links")
        .select("id,managed_user_id,relation,link_type,status")
        .eq("caregiver_user_id", user.id)
        .eq("link_type", "caregiver")
        .eq("status", "active"),
      (supabase as any)
        .from("managed_profiles")
        .select("id,name,date_of_birth,sex,relation,blood_type,notes,avatar_color")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: true }),
    ]);
    if (nmData.error) {
      console.error("[ActiveProfile] managed_profiles query error — code:", nmData.error.code, "message:", nmData.error.message);
      if (nmData.error.code === "42P01") {
        console.error("[ActiveProfile] ⚠️ Table 'managed_profiles' does NOT exist in your Supabase database.");
        console.error("[ActiveProfile] → Go to Supabase Dashboard > SQL Editor and run the migration in supabase/migrations/20260612140000_managed_profiles.sql");
      }
    }
    setOwnProfile(own || null);

    const managedIds = (links || []).map((l: any) => l.managed_user_id);
    let managedList: ManagedProfile[] = [];
    if (managedIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,full_name,date_of_birth")
        .in("id", managedIds);
      managedList = (profs || []).map((p: any) => {
        const link = (links || []).find((l: any) => l.managed_user_id === p.id);
        return { ...p, relation: link?.relation || "", link_id: link?.id || "" };
      });
    }
    setManaged(managedList);

    const newMp = (nmData.data || []) as NewManagedProfile[];
    setNewManagedProfiles(newMp);

    const storedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const storedType = typeof window !== "undefined" ? localStorage.getItem(TYPE_KEY) : null;

    if (storedType === "new_managed" && storedId && newMp.find((mp) => mp.id === storedId)) {
      setActiveId(storedId);
      setProfileType("new_managed");
    } else if (storedId === user.id) {
      setActiveId(storedId);
      setProfileType("owner");
    } else if (storedId && managedIds.includes(storedId)) {
      setActiveId(storedId);
      setProfileType("family_link");
    } else {
      setActiveId(user.id);
      setProfileType("owner");
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user?.id]);

  const setActive = (id: string) => {
    const type: ProfileType = id === user?.id ? "owner" : "family_link";
    setActiveId(id);
    setProfileType(type);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
      localStorage.setItem(TYPE_KEY, type);
    }
  };

  const setActiveMp = (mpId: string) => {
    setActiveId(mpId);
    setProfileType("new_managed");
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, mpId);
      localStorage.setItem(TYPE_KEY, "new_managed");
    }
  };

  const queryFilter: ProfileQueryFilter | null = !activeId
    ? null
    : profileType === "new_managed"
      ? { col: "managed_profile_id", val: activeId }
      : { col: "user_id", val: activeId };

  const activeManagedProfile: NewManagedProfile | null =
    profileType === "new_managed" && activeId
      ? newManagedProfiles.find((mp) => mp.id === activeId) ?? null
      : null;

  const activeProfile =
    profileType === "new_managed"
      ? null
      : activeId === user?.id
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
        newManagedProfiles,
        profileType,
        queryFilter,
        activeManagedProfile,
        isManaging: profileType !== "owner",
        setActive,
        setActiveMp,
        refresh,
        refreshNewManaged,
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
