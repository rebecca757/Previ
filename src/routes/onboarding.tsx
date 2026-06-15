import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Configura il tuo profilo — Prevì" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");
  const [medications, setMedications] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const parseTags = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);

  async function finish() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: fullName,
        date_of_birth: dob || null,
        biological_sex: sex || null,
        blood_type: bloodType || null,
        allergies: parseTags(allergies),
        chronic_conditions: parseTags(conditions),
        medications: parseTags(medications),
        onboarded: true,
        updated_at: new Date().toISOString(),
      }).eq("id", user.id);
      if (error) throw error;

      if (weight || height) {
        await supabase.from("biometric_history").insert({
          user_id: user.id,
          weight_kg: weight ? parseFloat(weight) : null,
          height_cm: height ? parseFloat(height) : null,
        });
      }
      toast.success("Profilo creato!");
      navigate({ to: "/dashboard" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setSaving(false);
    }
  }

  const canNext1 = fullName.trim() && dob;
  return (
    <div className="min-h-screen gradient-hero py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <Progress value={(step / 3) * 100} />
          <div className="text-xs text-muted-foreground mt-2">Step {step} di 3</div>
        </div>

        <div className="bg-card rounded-2xl border p-6 md:p-8">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Dati anagrafici</h2>
              <p className="text-sm text-muted-foreground">Iniziamo dalle basi.</p>
              <div>
                <Label>Nome e cognome *</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <Label>Data di nascita *</Label>
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
              <div>
                <Label>Sesso biologico</Label>
                <Select value={sex} onValueChange={setSex}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Maschile</SelectItem>
                    <SelectItem value="F">Femminile</SelectItem>
                    <SelectItem value="NS">Preferisco non specificare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gruppo sanguigno</Label>
                <Select value={bloodType} onValueChange={setBloodType}>
                  <SelectTrigger><SelectValue placeholder="Seleziona (opzionale)" /></SelectTrigger>
                  <SelectContent>
                    {["A+","A-","B+","B-","AB+","AB-","0+","0-"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={!canNext1} onClick={() => setStep(2)}>Continua</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Condizioni di salute</h2>
              <p className="text-sm text-muted-foreground">Separati da virgola. Tutti i campi sono opzionali.</p>
              <div>
                <Label>Allergie note</Label>
                <Textarea placeholder="penicillina, lattosio…" value={allergies} onChange={(e) => setAllergies(e.target.value)} />
              </div>
              <div>
                <Label>Condizioni croniche</Label>
                <Textarea placeholder="ipertensione, diabete tipo 2…" value={conditions} onChange={(e) => setConditions(e.target.value)} />
              </div>
              <div>
                <Label>Farmaci assunti regolarmente</Label>
                <Textarea placeholder="es. ramipril 5mg…" value={medications} onChange={(e) => setMedications(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep(1)}>Indietro</Button>
                <Button className="flex-1" onClick={() => setStep(3)}>Continua</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Dati biometrici iniziali</h2>
              <p className="text-sm text-muted-foreground">Potrai aggiornarli ogni mese dal Profilo.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Peso (kg)</Label>
                  <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </div>
                <div>
                  <Label>Altezza (cm)</Label>
                  <Input type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} />
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                Perfetto! Il tuo profilo è pronto. Puoi aggiornare questi dati ogni mese dalla sezione Profilo.
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep(2)}>Indietro</Button>
                <Button className="flex-1" onClick={finish} disabled={saving}>
                  {saving ? "Salvataggio…" : "Completa"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
