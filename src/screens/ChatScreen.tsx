import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { Menu, Plus, Paperclip, Send, Sparkles, Clapperboard, LoaderCircle, X, Film } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";
import type { Conversation, Message, RenderJob, FilmData } from "@/types/database";
import { VideoCard } from "@/components/VideoCard";

type Props = {
  onMenu: () => void;
  conversation: Conversation | null;
  onConversation: (conversation: Conversation | null) => void;
  onProject: (id: string) => void;
};

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const makeId = () => String(Date.now()) + "-" + Math.random().toString(36).slice(2, 11);
const kindFromMime = (mime: string): "image" | "video" | "audio" | null => {
  if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) return "image";
  if (["video/mp4", "video/quicktime", "video/webm"].includes(mime)) return "video";
  if (["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/ogg"].includes(mime)) return "audio";
  return null;
};

const mimeFromExtension: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg"
};

export function ChatScreen({ onMenu, conversation, onConversation, onProject }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [filmTitle, setFilmTitle] = useState("Votre production");
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const list = useRef<FlatList<Message>>(null);

  const loadMessages = async (id: string) => {
    const { data, error } = await supabase.from("messages").select("*")
      .eq("conversation_id", id).order("created_at", { ascending: true });
    if (!error) setMessages(((data ?? []) as Message[]).filter(m => m.role === "user" || m.role === "assistant"));
  };

  useEffect(() => {
    if (!conversation?.id) {
      setMessages([]); setJob(null); setVideoUrl(null); setPendingAttachments([]);
      return;
    }
    void loadMessages(conversation.id);
  }, [conversation?.id]);

  useEffect(() => {
    if (!conversation?.id) return;
    const channel = supabase.channel("messages-" + conversation.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "conversation_id=eq." + conversation.id },
        () => { void loadMessages(conversation.id); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversation?.id]);

  const loadFilmAndVideo = async (renderJob: RenderJob) => {
    if (!renderJob.output_path) return;
    const results = await Promise.all([
      supabase.storage.from("renders").createSignedUrl(renderJob.output_path, 3600),
      supabase.from("films").select("data,version").eq("project_id", renderJob.project_id)
        .eq("version", renderJob.film_version).maybeSingle()
    ]);
    const signed = results[0].data;
    const film = results[1].data;
    if (signed?.signedUrl) setVideoUrl(signed.signedUrl);
    if (film) {
      const data = film.data as FilmData;
      setFilmTitle(data?.info?.title || "Votre production");
    }
  };

  useEffect(() => {
    if (!job?.id) return;
    const channel = supabase.channel("render-" + job.id)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "render_jobs", filter: "id=eq." + job.id },
        payload => {
          const next = payload.new as RenderJob;
          setJob(next);
          if (next.status === "done" && next.output_path) void loadFilmAndVideo(next);
        })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [job?.id]);

  const watchJob = async (id: string) => {
    const { data, error } = await supabase.from("render_jobs").select("*").eq("id", id).maybeSingle();
    if (!error && data) {
      const current = data as RenderJob;
      setJob(current);
      if (current.status === "done" && current.output_path) await loadFilmAndVideo(current);
    }
  };

  const send = async () => {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Votre session a expiré. Reconnectez-vous.");
      let active = conversation;
      if (!active) {
        const { data, error } = await supabase.from("conversations")
          .insert({ user_id: user.id, title: message.slice(0, 70) })
          .select("*").single();
        if (error) throw error;
        active = data as Conversation;
        onConversation(active);
      }
      const body: { message: string; conversation_id: string; project_id?: string; attachments?: string[] } = {
        message, conversation_id: active.id
      };
      if (active.project_id) body.project_id = active.project_id;
      if (pendingAttachments.length) body.attachments = pendingAttachments;
      const controller = new AbortController();
      const requestTimeout = setTimeout(() => controller.abort(), 125_000);
      let response;
      try {
        response = await supabase.functions.invoke("chat-agent", { body, signal: controller.signal });
      } finally {
        clearTimeout(requestTimeout);
        setThinking(false);
      }
      const { data, error } = response;
      if (error) {
        let messageText = error.message;
        try {
          const detail = await error.context?.json();
          messageText = detail?.code === "rate_limited"
            ? "Vous avez atteint la limite temporaire. Réessayez un peu plus tard."
            : detail?.code === "llm_not_configured"
              ? "L'assistant est momentanément indisponible. Réessayez plus tard."
              : detail?.error || detail?.message || messageText;
        } catch { /* Keep the original error. */ }
        throw new Error(messageText);
      }
      if (data?.project_id && !active.project_id) {
        const { data: updated } = await supabase.from("conversations")
          .update({ project_id: data.project_id }).eq("id", active.id).select("*").single();
        active = (updated as Conversation | null) ?? { ...active, project_id: data.project_id };
        onConversation(active);
        onProject(data.project_id);
      }
      setPendingAttachments([]);
      if (data?.render_job_id) await watchJob(data.render_job_id);
      await loadMessages(active.id);
    } catch (error) {
      setInput(message);
      Alert.alert("Impossible d'envoyer", error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  const attach = async () => {
    if (!conversation?.project_id) {
      Alert.alert("Commencez votre production", "Envoyez d'abord votre première instruction. Vous pourrez ensuite joindre vos médias.");
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "video/*", "audio/*"], multiple: true, copyToCacheDirectory: true
      });
      if (result.canceled) return;
      setBusy(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Votre session a expiré.");
      const uploaded: string[] = [];
      for (const asset of result.assets) {
        const extensionCandidate = asset.name.includes(".") ? asset.name.split(".").pop()!.toLowerCase() : "bin";
        const extension = /^[a-z0-9]{1,8}$/.test(extensionCandidate) ? extensionCandidate : "bin";
        const mime = asset.mimeType || mimeFromExtension[extension] || "";
        const kind = kindFromMime(mime);
        if (!kind) throw new Error("Ce format de fichier n'est pas pris en charge.");
        if (asset.size && asset.size > MAX_UPLOAD_BYTES) throw new Error("Un fichier dépasse la limite de 50 Mo.");
        const path = user.id + "/" + conversation.project_id + "/" + makeId() + "." + extension;
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
        const { error: uploadError } = await supabase.storage.from("user-uploads")
          .upload(path, decode(base64), { contentType: mime || "application/octet-stream", upsert: false });
        if (uploadError) throw uploadError;
        const { data, error } = await supabase.from("media_assets").insert({
          project_id: conversation.project_id, user_id: user.id, kind, source: "upload", storage_path: path
        }).select("id").single();
        if (error) {
          await supabase.storage.from("user-uploads").remove([path]);
          throw error;
        }
        uploaded.push(data.id);
      }
      if (uploaded.length) {
        setPendingAttachments(previous => [...previous, ...uploaded]);
        setInput(previous => previous ? previous + "\nAnalyse les médias joints." : "Analyse les médias joints à ma production.");
      }
    } catch (error) {
      Alert.alert("Import impossible", error instanceof Error ? error.message : "Une erreur d'import est survenue.");
    } finally {
      setBusy(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={{
      alignSelf: item.role === "user" ? "flex-end" : "stretch",
      maxWidth: item.role === "user" ? "88%" : "100%",
      marginBottom: 18,
      backgroundColor: item.role === "user" ? colors.surfaceSoft : "transparent",
      borderRadius: 18, padding: item.role === "user" ? 14 : 0,
      borderWidth: item.role === "user" ? 1 : 0, borderColor: colors.border
    }}>
      {item.role === "assistant" && <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Sparkles color={colors.violetBright} size={17} /><Text style={{ color: colors.violetBright, fontSize: 12, fontWeight: "700" }}>GALINGTOSH</Text>
      </View>}
      <Text selectable style={{ color: colors.text, fontSize: 15, lineHeight: 23 }}>{item.content}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ height: 60, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border, gap: 14 }}>
        <Pressable onPress={onMenu} hitSlop={10}><Menu color={colors.text} size={24} /></Pressable>
        <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 17, fontWeight: "750" }}>Galingtosh</Text><Text style={{ color: colors.subtle, fontSize: 10, letterSpacing: 1.1 }}>STUDIO IA</Text></View>
        <Pressable onPress={() => { setJob(null); setVideoUrl(null); setPendingAttachments([]); onConversation(null); }} hitSlop={10}
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
          <Plus color={colors.text} size={21} />
        </Pressable>
      </View>
      {messages.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 30, paddingBottom: 38 }}>
          <View style={{ width: 118, height: 118, borderRadius: 42, backgroundColor: "#1A1030", borderWidth: 1, borderColor: "#56318C", alignItems: "center", justifyContent: "center", shadowColor: "#8B42FF", shadowOpacity: 0.25, shadowRadius: 28 }}>
            <Clapperboard color={colors.violetBright} size={52} strokeWidth={1.3} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "650", textAlign: "center", marginTop: 28 }}>Que souhaitez-vous créer ?</Text>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 10, lineHeight: 21 }}>Décrivez votre idée. Galingtosh s'occupe de la production.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 9, marginTop: 25 }}>
            {["Un court-métrage", "Un documentaire", "Un clip musical"].map(value =>
              <Pressable key={value} onPress={() => setInput(value + " : ")} style={{ paddingHorizontal: 13, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{value}</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : (
        <FlatList ref={list} data={messages} keyExtractor={item => item.id} renderItem={renderMessage}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 24 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })} />
      )}
      {thinking && <View style={{ flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 20, paddingBottom: 12 }}>
        <ActivityIndicator color={colors.violetBright} size="small" />
        <Text style={{ color: colors.muted, fontSize: 12 }}>Galingtosh prépare votre production…</Text>
      </View>}
      {job && <View style={{ marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          {job.status === "done" ? <Film color={colors.success} size={18} /> : job.status === "failed" ? <X color={colors.danger} size={18} /> : <LoaderCircle color={colors.violetBright} size={18} />}
          <Text style={{ color: colors.text, fontWeight: "600", flex: 1 }}>
            {job.status === "done" ? "Production terminée" : job.status === "failed" ? "La production a échoué" : job.status === "queued" ? "Production en attente" : job.status === "canceled" ? "Production annulée" : "Création de votre vidéo"}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{job.progress}%</Text>
        </View>
        <View style={{ height: 5, backgroundColor: colors.surfaceSoft, borderRadius: 4, marginTop: 12, overflow: "hidden" }}>
          <View style={{ height: 5, width: Math.max(0, Math.min(100, job.progress)) + "%", backgroundColor: colors.violet, borderRadius: 4 }} />
        </View>
        {job.status === "failed" && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 9 }}>Réessayez en demandant une nouvelle production.</Text>}
      </View>}
      {videoUrl && <View style={{ paddingHorizontal: 16, marginBottom: 10 }}><VideoCard uri={videoUrl} title={filmTitle} version={job?.film_version} /></View>}
      <View style={{ paddingHorizontal: 14, paddingTop: 9, paddingBottom: Platform.OS === "android" ? 10 : 14, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View style={{ minHeight: 56, maxHeight: 130, borderRadius: 29, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 8 }}>
          <Pressable onPress={attach} disabled={busy} style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
            <Paperclip color={pendingAttachments.length ? colors.violetBright : colors.muted} size={21} />
          </Pressable>
          <TextInput value={input} onChangeText={setInput} placeholder="Décrivez votre production..." placeholderTextColor={colors.subtle} multiline
            style={{ flex: 1, color: colors.text, fontSize: 14, maxHeight: 110, paddingTop: 12, paddingBottom: 12 }} />
          <Pressable onPress={send} disabled={busy || !input.trim()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: busy || !input.trim() ? colors.surfaceSoft : colors.violet, alignItems: "center", justifyContent: "center" }}>
            {busy ? <ActivityIndicator color="white" size="small" /> : <Send color="white" size={18} />}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
