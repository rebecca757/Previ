import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, FolderHeart, MessageCircle, ShieldCheck, User, LogOut, ChevronDown, Users, Plus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { useActiveProfile } from "@/contexts/ActiveProfile";
import { AddManagedProfileModal } from "@/components/AddManagedProfileModal";
import { differenceInYears } from "date-fns";
import { useState, type ReactNode } from "react";

const nav = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/archivio", label: "Archivio", icon: FolderHeart },
  { to: "/assistente", label: "Assistente", icon: MessageCircle },
  { to: "/prevenzione", label: "Prevenzione", icon: ShieldCheck },
  { to: "/profilo", label: "Profilo", icon: User },
];

function age(dob: string | null | undefined) {
  if (!dob) return null;
  try { return differenceInYears(new Date(), new Date(dob)); } catch { return null; }
}

function ProfileSwitcher() {
  const { ownId, activeId, activeProfile, managed, newManagedProfiles, profileType, activeManagedProfile, setActive, setActiveMp, refreshNewManaged } = useActiveProfile();
  const [addOpen, setAddOpen] = useState(false);

  if (!ownId) return null;

  const hasAny = managed.length > 0 || newManagedProfiles.length > 0;

  const currentName =
    profileType === "new_managed"
      ? activeManagedProfile?.name?.split(" ")[0] || "Profilo"
      : activeProfile?.full_name?.split(" ")[0] || (activeId === ownId ? "Tu" : "Profilo");

  const currentInitial = (
    profileType === "new_managed"
      ? activeManagedProfile?.name?.[0]
      : activeProfile?.full_name?.[0]
  )?.toUpperCase() || "?";

  const avatarBg = profileType === "new_managed" && activeManagedProfile?.avatar_color
    ? activeManagedProfile.avatar_color
    : undefined;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <div
              className="w-6 h-6 rounded-full grid place-items-center text-xs font-semibold text-white"
              style={{ backgroundColor: avatarBg || "var(--color-primary)" }}
            >
              {currentInitial}
            </div>
            <span className="text-sm">{currentName}</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Profilo attivo</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setActive(ownId)}>
            <User className="w-4 h-4 mr-2" />
            Il mio profilo
            {profileType === "owner" && <Check className="w-3 h-3 ml-auto text-primary" />}
          </DropdownMenuItem>

          {(managed.length > 0 || newManagedProfiles.length > 0) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Profili familiari</DropdownMenuLabel>
            </>
          )}

          {managed.map((m) => (
            <DropdownMenuItem key={m.id} onClick={() => setActive(m.id)}>
              <Users className="w-4 h-4 mr-2" />
              <div className="flex flex-col flex-1">
                <span className="text-sm">{m.full_name || "Senza nome"}</span>
                <span className="text-xs text-muted-foreground">{m.relation}</span>
              </div>
              {profileType === "family_link" && activeId === m.id && <Check className="w-3 h-3 ml-auto text-primary" />}
            </DropdownMenuItem>
          ))}

          {newManagedProfiles.map((mp) => (
            <DropdownMenuItem key={mp.id} onClick={() => setActiveMp(mp.id)}>
              <div
                className="w-4 h-4 rounded-full mr-2 grid place-items-center text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: mp.avatar_color || "#0F6E56" }}
              >
                {mp.name[0].toUpperCase()}
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-sm">{mp.name}</span>
                <span className="text-xs text-muted-foreground">{mp.relation}</span>
              </div>
              {profileType === "new_managed" && activeId === mp.id && <Check className="w-3 h-3 ml-auto text-primary" />}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            <span className="text-sm">Aggiungi profilo familiare</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddManagedProfileModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onDone={() => refreshNewManaged()}
      />
    </>
  );
}

function ManagingBanner() {
  const { isManaging, activeProfile, profileType, activeManagedProfile } = useActiveProfile();
  if (!isManaging) return null;

  const name = profileType === "new_managed"
    ? activeManagedProfile?.name
    : activeProfile?.full_name;
  const relation = profileType === "new_managed"
    ? activeManagedProfile?.relation
    : null;
  const dob = profileType === "new_managed"
    ? activeManagedProfile?.date_of_birth
    : activeProfile?.date_of_birth;
  const a = age(dob);

  if (!name) return null;

  return (
    <div
      className="rounded-xl border p-3 mb-4 text-sm flex items-center gap-2"
      style={{ backgroundColor: "rgba(15,110,86,0.08)", borderColor: "rgba(15,110,86,0.4)" }}
    >
      <Users className="w-4 h-4" style={{ color: "#0F6E56" }} />
      <span>
        Stai gestendo il profilo di <strong>{name}</strong>
        {relation && ` — ${relation}`}
        {a !== null && ` · ${a} ann${a === 1 ? "o" : "i"}`}
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background pb-safe-nav md:pb-0 md:pl-64">
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 border-r bg-card flex-col">
        <div className="p-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary grid place-items-center text-primary-foreground font-bold">P</div>
            <span className="font-semibold text-lg">Prevì</span>
          </Link>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((n) => {
            const active = location.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-4 h-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <Button variant="ghost" className="w-full justify-start" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" /> Esci
          </Button>
        </div>
      </aside>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 md:py-10 fade-in">
        <div className="flex justify-end mb-4"><ProfileSwitcher /></div>
        <ManagingBanner />
        <main>{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-40 pt-1 pb-safe">
        <div className="grid grid-cols-5">
          {nav.map((n) => {
            const active = location.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <Icon className="w-[22px] h-[22px]" />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
