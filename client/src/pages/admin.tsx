import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Content, type Episode, insertContentSchema } from "@shared/schema";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import {
  Plus, Trash2, Upload, Film, ArrowLeft, ChevronDown, ChevronUp, Tv, Play, ImagePlus, X, Loader2, Lock, Pencil, KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useCallback, useEffect } from "react";

const contentFormSchema = insertContentSchema.extend({
  title: z.string().min(1, "Title is required"),
  poster: z.string().min(1, "Poster is required"),
});

type ContentFormValues = z.infer<typeof contentFormSchema>;

function ImageUploadField({
  value,
  onChange,
  label,
  testId,
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
  testId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const metaRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });
      if (!metaRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await metaRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      onChange(objectPath);
    } catch {
      onChange("");
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  const isUploadedOrUrl = value && (value.startsWith("/objects/") || value.startsWith("/uploads/") || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/images/"));
  const [imgError, setImgError] = useState(false);
  const showPreview = isUploadedOrUrl && !imgError;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>

      {showPreview && (
        <div className="relative w-full rounded-md overflow-hidden border border-border bg-accent/30">
          <img
            src={value}
            alt="Preview"
            className="w-full h-48 object-cover"
            onError={() => setImgError(true)}
            onLoad={() => setImgError(false)}
          />
          <button
            type="button"
            onClick={() => { onChange(""); setImgError(false); }}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!showPreview && (
        <div className="flex gap-2 items-start">
          <Input
            placeholder="Paste URL or upload photo"
            value={value}
            onChange={(e) => { onChange(e.target.value); setImgError(false); }}
            className="flex-1"
            data-testid={`${testId}-url`}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            data-testid={`${testId}-upload`}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImagePlus className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
        data-testid={`${testId}-file`}
      />
    </div>
  );
}

function AddContentDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<ContentFormValues>({
    resolver: zodResolver(contentFormSchema),
    defaultValues: {
      title: "",
      type: "series",
      poster: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ContentFormValues) => {
      const res = await apiRequest("POST", "/api/content", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      toast({ title: "Content added successfully" });
      form.reset();
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-content">
          <Plus className="w-4 h-4 mr-2" />
          Add Content
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Content</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter title" data-testid="input-content-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-content-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="series">Series</SelectItem>
                      <SelectItem value="movie">Movie</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="poster"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <ImageUploadField
                      value={field.value}
                      onChange={field.onChange}
                      label="Poster"
                      testId="input-content-poster"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} placeholder="Description..." data-testid="input-content-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-content">
              {createMutation.isPending ? "Adding..." : "Add Content"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditContentDialog({ item }: { item: Content }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<ContentFormValues>({
    resolver: zodResolver(contentFormSchema),
    defaultValues: {
      title: item.title,
      type: item.type,
      poster: item.poster,
      description: item.description || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: item.title,
        type: item.type,
        poster: item.poster,
        description: item.description || "",
      });
    }
  }, [open, item]);

  const updateMutation = useMutation({
    mutationFn: async (data: ContentFormValues) => {
      const res = await apiRequest("PATCH", `/api/content/${item.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content", String(item.id)] });
      toast({ title: "Content updated successfully" });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`button-edit-content-${item.id}`}>
          <Pencil className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Content</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter title" data-testid="input-edit-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="series">Series</SelectItem>
                      <SelectItem value="movie">Movie</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="poster"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <ImageUploadField
                      value={field.value}
                      onChange={field.onChange}
                      label="Poster"
                      testId="input-edit-poster"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} placeholder="Description..." data-testid="input-edit-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={updateMutation.isPending} data-testid="button-update-content">
              {updateMutation.isPending ? "Updating..." : "Update Content"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function BulkUploadDialog({ contentId }: { contentId: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const bulkMutation = useMutation({
    mutationFn: async (data: { contentId: number; bulkLinks: string }) => {
      const res = await apiRequest("POST", "/api/episodes/bulk", data);
      return res.json();
    },
    onSuccess: (data: { count: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content", String(contentId), "episodes"] });
      toast({ title: `${data.count} episodes added` });
      setBulkText("");
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid={`button-bulk-upload-${contentId}`}>
          <Upload className="w-3.5 h-3.5 mr-1" />
          Bulk Add
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Upload Episodes</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter one episode per line in the format: <strong>Title, VideoLink</strong>
          </p>
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"Episode 1, https://vimeo.com/123\nEpisode 2, https://vimeo.com/456"}
            className="min-h-[200px] font-mono text-sm"
            data-testid="textarea-bulk"
          />
          <Button
            className="w-full"
            disabled={bulkMutation.isPending || !bulkText.trim()}
            onClick={() =>
              bulkMutation.mutate({ contentId, bulkLinks: bulkText })
            }
            data-testid="button-bulk-submit"
          >
            {bulkMutation.isPending ? "Uploading..." : "Upload All"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddEpisodeInline({ contentId }: { contentId: number }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState("");

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/episodes", {
        contentId,
        epTitle: title,
        videoLink: link,
        isLocked,
        password: isLocked ? password : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content", String(contentId), "episodes"] });
      toast({ title: "Episode added" });
      setTitle("");
      setLink("");
      setIsLocked(false);
      setPassword("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Episode title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 min-w-[120px]"
          data-testid={`input-ep-title-${contentId}`}
        />
        <Input
          placeholder="Video link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className="flex-1 min-w-[120px]"
          data-testid={`input-ep-link-${contentId}`}
        />
        <Button
          size="sm"
          disabled={addMutation.isPending || !title || !link}
          onClick={() => addMutation.mutate()}
          data-testid={`button-add-ep-${contentId}`}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Switch
            checked={isLocked}
            onCheckedChange={setIsLocked}
            data-testid={`switch-ep-lock-${contentId}`}
          />
          <span className="text-xs text-muted-foreground">Lock episode</span>
        </div>
        {isLocked && (
          <Input
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-40"
            data-testid={`input-ep-password-${contentId}`}
          />
        )}
      </div>
    </div>
  );
}

function ContentAdminCard({ item }: { item: Content }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const { data: episodes } = useQuery<Episode[]>({
    queryKey: ["/api/content", String(item.id), "episodes"],
    enabled: expanded,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/content/${item.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      toast({ title: "Content deleted" });
    },
  });

  const deleteEpMutation = useMutation({
    mutationFn: async (epId: number) => {
      await apiRequest("DELETE", `/api/episodes/${epId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content", String(item.id), "episodes"] });
      toast({ title: "Episode deleted" });
    },
  });

  const lockedCount = episodes?.filter((ep) => ep.isLocked).length || 0;

  return (
    <Card className="p-4" data-testid={`card-admin-content-${item.id}`}>
      <div className="flex items-start gap-4">
        <img
          src={item.poster}
          alt={item.title}
          className="w-16 h-20 object-cover rounded-md shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{item.title}</h3>
            <Badge variant="secondary" className="capitalize text-xs">{item.type}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.description || "No description"}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <EditContentDialog item={item} />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            data-testid={`button-expand-${item.id}`}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid={`button-delete-content-${item.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-sm font-medium">
              Episodes
              {lockedCount > 0 && (
                <span className="text-xs text-yellow-400 ml-2">({lockedCount} locked)</span>
              )}
            </h4>
            <BulkUploadDialog contentId={item.id} />
          </div>

          <AddEpisodeInline contentId={item.id} />

          {episodes && episodes.length > 0 ? (
            <div className="space-y-1">
              {episodes.map((ep) => (
                <div
                  key={ep.epId}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-accent/50"
                  data-testid={`row-episode-${ep.epId}`}
                >
                  <Play className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 truncate">{ep.epTitle}</span>
                  {ep.isLocked && (
                    <Lock className="w-3 h-3 text-yellow-400 shrink-0" />
                  )}
                  <span className="text-xs text-muted-foreground truncate max-w-[160px]">{ep.videoLink}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive"
                    onClick={() => deleteEpMutation.mutate(ep.epId)}
                    data-testid={`button-delete-ep-${ep.epId}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">No episodes yet</p>
          )}
        </div>
      )}
    </Card>
  );
}

export default function Admin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [authed, setAuthed] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [checking, setChecking] = useState(false);

  const { data: allContent, isLoading } = useQuery<Content[]>({
    queryKey: ["/api/content"],
    enabled: authed,
  });

  useEffect(() => {
    fetch("/api/admin/check", { credentials: "include" })
      .then((r) => { if (r.ok) setAuthed(true); })
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    try {
      const res = await apiRequest("POST", "/api/admin/login", { password: adminPassword });
      if (res.ok) {
        setAuthed(true);
      }
    } catch (err: any) {
      toast({ title: "Wrong password", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4" data-testid="page-admin-login">
        <Card className="p-8 max-w-sm w-full text-center">
          <KeyRound className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Admin Access</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Enter the admin password to continue
          </p>
          <form onSubmit={handleLogin} className="space-y-3">
            <Input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Admin password"
              data-testid="input-admin-password"
            />
            <Button type="submit" className="w-full" disabled={checking || !adminPassword} data-testid="button-admin-login">
              {checking ? "Checking..." : "Login"}
            </Button>
          </form>
          <Link href="/">
            <Button variant="ghost" className="mt-3 w-full" data-testid="button-admin-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-admin">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 md:px-8 py-3">
          <Link href="/">
            <Button size="icon" variant="ghost" data-testid="button-admin-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Admin Panel</h1>
          </div>
          <AddContentDialog />
        </div>
      </div>

      <div className="px-4 md:px-8 lg:px-12 py-6 max-w-4xl mx-auto">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-md" />
            ))}
          </div>
        ) : !allContent || allContent.length === 0 ? (
          <div className="text-center py-16">
            <Film className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">No content yet</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">Click "Add Content" to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {allContent.map((item) => (
              <ContentAdminCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
