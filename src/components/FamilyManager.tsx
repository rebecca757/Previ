import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveProfile } from "@/contexts/ActiveProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Plus, Users, UserPlus, Trash2, Mail } from "lucide-react";
import { differenceInYears, format } from "date-fns";
import { it } from "date-fns/locale";

type Link = { id: string; caregiver_user_id: string; managed_user_id: string; relation: string; link_type: string; status: string; management_type?: string | null };
type Invite = { id: string; invitee_email: string; relation: string; status: string; created_at: string; expires_at: string };

export function FamilyManager() {
  const { user } = useAuth();
  const { setActive, refresh } = useActiveProfile();
  const [links, setLinks] = useState<Link[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});
  const [invites, setInvites] = useState<Invite[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"minor" | "adult">("minor");
  const [loading, setLoading] = useState(false);

  // minor form
  const [mName, setMName] = useState("");
  const [mDob, setMDob] = useState("");
  const [mEmail, setMEmail] = useState("");
  const [mPwd, setMPwd] = useState("");
  const [mRel, setMRel] = useState("Figlio");
  const [mMgmt, setMMgmt] = useState<"indefinite" | "until_18">("indefinite");

  // adult invite form
  const [aEmail, setAEmail] = useState("");
  const [aRel, setARel] = useState("Madre");

  const load = async () => {
    if (!user) return;
    const [{ data: l }, { data: inv }] = await Promise.all([
      supabase.from("family_links").select("*").or(`caregiver_user_id.eq.${user.id},managed_user_id.eq.${user.id}`).eq("status", "active"),
      supabase.from("family_invites").select("*").eq("inviter_user_id", user.id).eq("status", "pending").order("created_at", { ascending: false }),
    ]);
    setLinks((l || []) as Link[]);
    setInvites((inv || []) as Invite[]);

    const ids = Array.from(new Set((l || []).flatMap((x: any) => [x.caregiver_user_id, x.managed_user_id]))).filter((id) => id !== user.id);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,date_of_birth").in("id", ids);
      const map: Record<string, any> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p; });
      setProfilesMap(map);
    } else {
      setProfilesMap({});
    }
  };

  useEffect(() => { load(); }, [user]);

  async function createMinor() {
    if (!mName || !mDob || !mEmail || !mPwd) { toast.error("Compila tutti i campi"); return; }
    const dobAge = (Date.now() - new Date(mDob).getTime()) / (365.25 * 24 * 3600 * 1000);
    if (mMgmt === "until_18" && dobAge >= 18) {
      toast.error("La gestione fino alla maggiore età è disponibile solo per minori.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-managed-profile", {
        body: { full_name: mName, date_of_birth: mDob, email: mEmail, password: mPwd, relation: mRel, management_type: mMgmt },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Profilo creato");
      setOpen(false);
      setMName(""); setMDob(""); setMEmail(""); setMPwd(""); setMRel("Figlio"); setMMgmt("indefinite");
      await load();
      await refresh();
      if (data?.managed_user_id) setActive(data.managed_user_id);
    } catch (e: any) {
      toast.error(e.message || "Errore nella creazione");
    } finally {
      setLoading(false);
    }
  }

  async function endCaregiverManagement(linkId: string) {
    if (!confirm("Terminare la gestione di questo profilo? Il collegamento diventerà genetico.")) return;
    const link = links.find((l) => l.id === linkId);
    if (!link) return;
    await supabase.from("family_links").update({ status: "revoked" }).eq("id", linkId);
    // Convert into two-way genetic link so the family history context is preserved.
    await (supabase as any).from("family_links").upsert([
      { caregiver_user_id: link.caregiver_user_id, managed_user_id: link.managed_user_id, relation: link.relation, link_type: "genetic", status: "active" },
      { caregiver_user_id: link.managed_user_id, managed_user_id: link.caregiver_user_id, relation: link.relation, link_type: "genetic", status: "active" },
    ], { onConflict: "caregiver_user_id,managed_user_id,link_type" });
    toast.success("Gestione terminata");
    await load();
    await refresh();
  }

  async function sendInvite() {
    if (!aEmail || !aRel) { toast.error("Compila email e relazione"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-family-invite", {
        body: { invitee_email: aEmail, relation: aRel },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Invito inviato");
      setOpen(false);
      setAEmail(""); setARel("Madre");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Errore invio invito");
    } finally {
      setLoading(false);
    }
  }

  async function removeLink(id: string) {
    if (!confirm("Rimuovere il collegamento?")) return;
    const link = links.find((l) => l.id === id);
    if (link) {
      // Revoke both directions of a genetic link
      await supabase.from("family_links").update({ status: "revoked" })
        .or(`and(caregiver_user_id.eq.${link.caregiver_user_id},managed_user_id.eq.${link.managed_user_id}),and(caregiver_user_id.eq.${link.managed_user_id},managed_user_id.eq.${link.caregiver_user_id})`)
        .eq("link_type", link.link_type);
    }
    toast.success("Collegamento rimosso");
    await load(); await refresh();
  }

  async function cancelInvite(id: string) {
    await supabase.from("family_invites").update({ status: "cancelled" }).eq("id", id);
    await load();
  }

  const caregiverLinks = links.filter((l) => l.link_type === "caregiver" && l.caregiver_user_id === user?.id);
  const geneticLinks = links.filter((l) => l.link_type === "genetic");

  return (
    <div className="space-y-5">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button><Plus className="w-4 h-4 mr-1" /> Aggiungi membro della famiglia</Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Aggiungi membro</DialogTitle></DialogHeader>
          <div className="flex gap-2 border-b">
            <button onClick={() => setTab("minor")} className={`px-3 py-2 text-sm ${tab === "minor" ? "border-b-2 border-primary font-semibold" : "text-muted-foreground"}`}>Profilo gestito</button>
            <button onClick={() => setTab("adult")} className={`px-3 py-2 text-sm ${tab === "adult" ? "border-b-2 border-primary font-semibold" : "text-muted-foreground"}`}>Collega un adulto</button>
          </div>
          {tab === "minor" ? (
            <div className="space-y-3 pt-2">
              <div><Label>Nome e cognome</Label><Input value={mName} onChange={(e) => setMName(e.target.value)} /></div>
              <div><Label>Data di nascita</Label><Input type="date" value={mDob} onChange={(e) => setMDob(e.target.value)} /></div>
              <div><Label>Email (placeholder ok)</Label><Input type="email" value={mEmail} onChange={(e) => setMEmail(e.target.value)} placeholder="nome.cognome@famiglia.it" /></div>
              <div><Label>Password</Label><Input type="password" value={mPwd} onChange={(e) => setMPwd(e.target.value)} /></div>
              <div>
                <Label>Relazione</Label>
                <Select value={mRel} onValueChange={setMRel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Figlio","Figlia","Madre","Padre","Marito","Moglie","Nonno","Nonna","Fratello","Sorella","Altro"].map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo di gestione</Label>
                <RadioGroup value={mMgmt} onValueChange={(v) => setMMgmt(v as "indefinite" | "until_18")}>
                  <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
                    <RadioGroupItem value="indefinite" id="mgmt-indef" className="mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Gestione a tempo indeterminato</div>
                      <div className="text-xs text-muted-foreground">Gestisci finché non termini manualmente. Adatto a figli minori, genitori anziani o familiari con disabilità.</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
                    <RadioGroupItem value="until_18" id="mgmt-18" className="mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Gestione fino alla maggiore età</div>
                      <div className="text-xs text-muted-foreground">Trasferimento automatico al compimento dei 18 anni. Solo per minori.</div>
                    </div>
                  </label>
                </RadioGroup>
              </div>
              <DialogFooter><Button onClick={createMinor} disabled={loading}>{loading ? "Creazione…" : "Crea profilo"}</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">Invierai un invito via email. Accettando, condividerete il contesto genetico per la prevenzione personalizzata.</p>
              <div><Label>Email del familiare</Label><Input type="email" value={aEmail} onChange={(e) => setAEmail(e.target.value)} /></div>
              <div>
                <Label>Relazione</Label>
                <Select value={aRel} onValueChange={setARel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Madre","Padre","Fratello","Sorella","Nonno","Nonna","Zio","Zia","Altro"].map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter><Button onClick={sendInvite} disabled={loading}>{loading ? "Invio…" : "Invia invito"}</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {caregiverLinks.length === 0 && geneticLinks.length === 0 && invites.length === 0 && (
        <div className="text-sm text-muted-foreground py-4 text-center border rounded-xl">
          Nessun familiare collegato. Aggiungi un membro per ricevere prevenzione personalizzata basata sulla tua storia genetica.
        </div>
      )}

      {caregiverLinks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Profili gestiti</h3>
          <div className="space-y-2">
            {caregiverLinks.map((l) => {
              const p = profilesMap[l.managed_user_id];
              const a = p?.date_of_birth ? differenceInYears(new Date(), new Date(p.date_of_birth)) : null;
              const mgmtLabel = l.management_type === "until_18" ? "Fino ai 18 anni" : "A tempo indeterminato";
              return (
                <div key={l.id} className="flex items-center justify-between p-3 border rounded-xl gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p?.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.relation}{a !== null && ` — ${a} anni`} · {mgmtLabel}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setActive(l.managed_user_id)}>Gestisci</Button>
                    <Button size="sm" variant="ghost" onClick={() => endCaregiverManagement(l.id)}>Termina</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {geneticLinks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><UserPlus className="w-4 h-4" /> Familiari collegati</h3>
          <div className="space-y-2">
            {geneticLinks.map((l) => {
              const otherId = l.caregiver_user_id === user?.id ? l.managed_user_id : l.caregiver_user_id;
              const p = profilesMap[otherId];
              return (
                <div key={l.id} className="flex items-center justify-between p-3 border rounded-xl">
                  <div>
                    <div className="font-medium">{p?.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{l.relation} · collegamento genetico</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeLink(l.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Mail className="w-4 h-4" /> Inviti in sospeso</h3>
          <div className="space-y-2">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center justify-between p-3 border rounded-xl">
                <div>
                  <div className="font-medium text-sm">{i.invitee_email}</div>
                  <div className="text-xs text-muted-foreground">{i.relation} · inviato {format(new Date(i.created_at), "d MMM", { locale: it })}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => cancelInvite(i.id)}>Annulla</Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
