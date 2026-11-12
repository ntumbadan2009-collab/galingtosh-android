import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { ChevronLeft, Clapperboard, Film, RefreshCw, PlayCircle, Clock3 } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";
import type { Project, RenderJob } from "@/types/database";
import { VideoCard } from "@/components/VideoCard";

type LibraryProject = Project & { versions: RenderJob[] };

export function LibraryScreen({ onBack, onOpenProject }: { onBack: () => void; onOpenProject: (projectId: string) => void }) {
  const [items, setItems] = useState<LibraryProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ url: string; title: string; version: number } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [projectsResult, jobsResult] = await Promise.all([
      supabase.from("projects").select("id,user_id,title,type,created_at,updated_at")
        .eq("user_id", user.id).order("updated_at", { ascending: false }),
      supabase.from("render_jobs").select("id,project_id,film_version,status,progress,output_path,error,warnings,updated_at")
        .eq("user_id", user.id).order("created_at", { ascending: false })
    ]);
    if (projectsResult.error || jobsResult.error) {
      setItems([]);
      setLoading(false);
      return;
    }
    const jobs = (jobsResult.data ?? []) as RenderJob[];
    setItems(((projectsResult.data ?? []) as Project[]).map(project => ({
      ...project,
      versions: jobs.filter(job => job.project_id === project.id)
    })));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const openVersion = async (project: LibraryProject, job: RenderJob) => {
    if (job.status !== "done" || !job.output_path) return;
    const { data, error } = await supabase.storage.from("renders").createSignedUrl(job.output_path, 3600);
    if (error || !data?.signedUrl) return;
    setSelected({ url: data.signedUrl, title: project.title, version: job.film_version });
  };

  const statusLabel = (status: RenderJob["status"]) => {
    if (status === "done") return "Terminée";
    if (status === "failed") return "Échec";
    if (status === "queued") return "En attente";
    if (status === "canceled") return "Annulée";
    return "En cours";
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 14 }}>
        <Pressable onPress={onBack}><ChevronLeft color={colors.text} size={24} /></Pressable>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", flex: 1 }}>Bibliothèque</Text>
        <Pressable onPress={() => { void load(); }}><RefreshCw color={colors.muted} size={19} /></Pressable>
      </View>
      {selected && <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <VideoCard uri={selected.url} title={selected.title} version={selected.version} />
      </View>}
      {loading ? <ActivityIndicator color={colors.violetBright} style={{ marginTop: 50 }} /> : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 18, gap: 13 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 100, padding: 24 }}>
              <Clapperboard color={colors.subtle} size={42} />
              <Text style={{ color: colors.text, fontWeight: "600", fontSize: 16, marginTop: 18 }}>Votre bibliothèque est vide</Text>
              <Text style={{ color: colors.muted, textAlign: "center", marginTop: 8, lineHeight: 20 }}>Vos productions et leurs versions apparaîtront ici.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 15 }}>
              <Pressable onPress={() => onOpenProject(item.id)} style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
                <View style={{ width: 48, height: 48, borderRadius: 13, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
                  <Film color={colors.violetBright} size={23} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "600", fontSize: 15 }}>{item.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>{new Date(item.updated_at).toLocaleDateString("fr-FR")} · {item.versions.length} version(s)</Text>
                </View>
                <PlayCircle color={colors.muted} size={20} />
              </Pressable>
              {item.versions.length > 0 && <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 14, paddingTop: 12, gap: 8 }}>
                {item.versions.map(job => (
                  <Pressable key={job.id} onPress={() => { void openVersion(item, job); }}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.surfaceRaised, gap: 10 }}>
                    <Clock3 color={job.status === "done" ? colors.success : colors.muted} size={15} />
                    <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>Version {job.film_version}</Text>
                    <Text style={{ color: job.status === "done" ? colors.success : job.status === "failed" ? colors.danger : colors.muted, fontSize: 11 }}>{statusLabel(job.status)}</Text>
                    {job.status === "done" && <PlayCircle color={colors.violetBright} size={17} />}
                  </Pressable>
                ))}
              </View>}
            </View>
          )}
        />
      )}
    </View>
  );
}
