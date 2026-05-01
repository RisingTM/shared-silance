import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, Download, Plus, Trash2, Upload, X, FolderInput } from "lucide-react";
import { toast } from "sonner";

type Album = { id: string; name: string; is_shared: boolean; owner_id: string; created_at: string };
type Photo = {
  id: string;
  storage_path: string;
  album_id: string | null;
  uploader_id: string;
  sort_order: number;
  created_at: string;
};
type Profile = { id: string; username: string };

const LONG_PRESS_MS = 500;

export function UsGallery() {
  const { user, journey, profile, partnerProfile } = useSession();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [newAlbumName, setNewAlbumName] = useState("");
  const [newAlbumShared, setNewAlbumShared] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<string>("__none__");
  const fileRef = useRef<HTMLInputElement>(null);
  const isOwner = profile?.role === "owner";

  const profilesById = useMemo<Record<string, Profile>>(() => {
    const m: Record<string, Profile> = {};
    if (profile) m[profile.id] = { id: profile.id, username: profile.username };
    if (partnerProfile) m[partnerProfile.id] = { id: partnerProfile.id, username: partnerProfile.username };
    return m;
  }, [profile, partnerProfile]);

  const load = async () => {
    if (!journey) return;
    const { data: a } = await supabase
      .from("us_albums")
      .select("*")
      .eq("journey_id", journey.id)
      .order("created_at", { ascending: false });
    setAlbums((a as Album[]) ?? []);

    if (openAlbum) {
      const { data: p } = await supabase
        .from("us_photos")
        .select("*")
        .eq("journey_id", journey.id)
        .eq("album_id", openAlbum.id)
        .order("created_at", { ascending: false });
      setPhotos((p as Photo[]) ?? []);
    } else {
      // All photos: flat (across all visible albums + null)
      const { data: p } = await supabase
        .from("us_photos")
        .select("*")
        .eq("journey_id", journey.id)
        .order("created_at", { ascending: false });
      setPhotos((p as Photo[]) ?? []);
    }
    // Always refresh signed urls on load (per spec).
    setSigned({});
  };

  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [journey?.id, openAlbum?.id]);

  // Sign URLs fresh
  useEffect(() => {
    const missing = photos.filter((p) => !signed[p.id]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = { ...signed };
      for (const p of missing) {
        const { data } = await supabase.storage.from("us-gallery").createSignedUrl(p.storage_path, 60 * 60);
        if (data?.signedUrl) next[p.id] = data.signedUrl;
      }
      if (!cancelled) setSigned(next);
    })();
    return () => {
      cancelled = true;
    };
    /* eslint-disable-next-line */
  }, [photos]);

  const exitSelection = () => {
    setSelectionMode(false);
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Long-press handler factory
  const useLongPress = (id: string) => {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const start = () => {
      if (selectionMode) return;
      timer.current = setTimeout(() => {
        setSelectionMode(true);
        setSelected(new Set([id]));
      }, LONG_PRESS_MS);
    };
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    return { onPointerDown: start, onPointerUp: clear, onPointerLeave: clear, onPointerCancel: clear };
  };

  const createAlbum = async () => {
    if (!journey || !user || !newAlbumName.trim()) return;
    const { error } = await supabase
      .from("us_albums")
      .insert({
        journey_id: journey.id,
        owner_id: user.id,
        name: newAlbumName.trim(),
        is_shared: newAlbumShared,
      });
    if (error) return toast.error(error.message);
    setNewAlbumName("");
    setNewAlbumShared(true);
    setCreateOpen(false);
    load();
  };

  const onUploadFiles = async (files: FileList | null) => {
    if (!files || !journey || !user) return;
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${journey.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("us-gallery").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) {
        toast.error(upErr.message);
        continue;
      }
      const { error: insErr } = await supabase.from("us_photos").insert({
        journey_id: journey.id,
        uploader_id: user.id,
        album_id: openAlbum?.id ?? null,
        storage_path: path,
        sort_order: Date.now(),
      });
      if (insErr) toast.error(insErr.message);
    }
    await load();
    toast.success("Uploaded");
  };

  const canDeletePhoto = (p: Photo) => p.uploader_id === user?.id || !!isOwner;

  const deletePhoto = async (p: Photo) => {
    if (!canDeletePhoto(p)) return toast.error("You can only delete your own uploads");
    await supabase.storage.from("us-gallery").remove([p.storage_path]).catch(() => undefined);
    const { error } = await supabase.from("us_photos").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
  };

  const bulkDelete = async () => {
    const targets = photos.filter((p) => selected.has(p.id) && canDeletePhoto(p));
    if (!targets.length) return;
    if (!confirm(`Delete ${targets.length} photo${targets.length === 1 ? "" : "s"}?`)) return;
    await supabase.storage.from("us-gallery").remove(targets.map((t) => t.storage_path)).catch(() => undefined);
    const { error } = await supabase.from("us_photos").delete().in("id", targets.map((t) => t.id));
    if (error) return toast.error(error.message);
    exitSelection();
    load();
  };

  const bulkMove = async () => {
    const targets = photos.filter((p) => selected.has(p.id));
    if (!targets.length) return;
    const newAlbumId = moveTarget === "__none__" ? null : moveTarget;
    const { error } = await supabase
      .from("us_photos")
      .update({ album_id: newAlbumId })
      .in("id", targets.map((t) => t.id));
    if (error) return toast.error(error.message);
    setMoveOpen(false);
    exitSelection();
    load();
  };

  const deleteAlbum = async (a: Album) => {
    if (!confirm(`Delete album "${a.name}"? Photos inside will also be removed.`)) return;
    const { data: ps } = await supabase.from("us_photos").select("storage_path").eq("album_id", a.id);
    if (ps?.length)
      await supabase.storage
        .from("us-gallery")
        .remove(ps.map((p: any) => p.storage_path))
        .catch(() => undefined);
    const { error } = await supabase.from("us_albums").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    setOpenAlbum(null);
    load();
  };

  const toggleShared = async (a: Album) => {
    if (a.owner_id !== user?.id && !isOwner) return;
    await supabase.from("us_albums").update({ is_shared: !a.is_shared }).eq("id", a.id);
    load();
  };

  const downloadFromUrl = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const renderSelectionBar = () =>
    selectionMode && (
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-xl border border-border bg-card/95 backdrop-blur p-2">
        <Button variant="ghost" size="sm" onClick={exitSelection}>
          <X className="size-4" /> {selected.size} selected
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMoveOpen(true)} disabled={!selected.size}>
            <FolderInput className="size-4" /> Move
          </Button>
          <Button variant="destructive" size="sm" onClick={bulkDelete} disabled={!selected.size}>
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      </div>
    );

  const PhotoTile = ({ p }: { p: Photo }) => {
    const lp = useLongPress(p.id);
    const isSelected = selected.has(p.id);
    return (
      <button
        {...lp}
        onClick={(e) => {
          e.preventDefault();
          if (selectionMode) toggleSelect(p.id);
          else setViewerId(p.id);
        }}
        className={[
          "relative aspect-square rounded-lg overflow-hidden bg-muted/40 border hover:opacity-90 select-none",
          isSelected ? "border-primary ring-2 ring-primary/60" : "border-border",
        ].join(" ")}
      >
        {signed[p.id] ? (
          <img src={signed[p.id]} alt="" className="w-full h-full object-cover" loading="lazy" draggable={false} />
        ) : (
          <div className="w-full h-full animate-pulse bg-muted/60" />
        )}
        {selectionMode && (
          <span
            className={[
              "absolute top-1 right-1 size-5 rounded-full border flex items-center justify-center text-[10px]",
              isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-background/80 border-border",
            ].join(" ")}
          >
            {isSelected ? "✓" : ""}
          </span>
        )}
      </button>
    );
  };

  // ---- View: inside an album ----
  if (openAlbum) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpenAlbum(null);
              exitSelection();
            }}
          >
            <ChevronLeft className="size-4" /> Albums
          </Button>
          <div className="flex items-center gap-2">
            {(openAlbum.owner_id === user?.id || isOwner) && (
              <div className="flex items-center gap-2 text-xs">
                <span>Shared</span>
                <Switch checked={openAlbum.is_shared} onCheckedChange={() => toggleShared(openAlbum)} />
              </div>
            )}
            {(openAlbum.owner_id === user?.id || isOwner) && (
              <Button variant="ghost" size="icon" onClick={() => deleteAlbum(openAlbum)} aria-label="Delete album">
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
        <h3 className="font-display text-xl tracking-widest text-primary text-center">{openAlbum.name}</h3>
        {renderSelectionBar()}
        <UploadButton fileRef={fileRef} onPick={onUploadFiles} label="Upload photos" />
        <PhotoGrid photos={photos} renderTile={(p) => <PhotoTile p={p} key={p.id} />} />

        <PhotoViewer
          photos={photos}
          signed={signed}
          viewerId={viewerId}
          setViewerId={setViewerId}
          canDelete={canDeletePhoto}
          onDelete={async (p) => {
            await deletePhoto(p);
            setViewerId(null);
            load();
          }}
          onDownload={(p) => signed[p.id] && downloadFromUrl(signed[p.id], p.storage_path.split("/").pop() ?? "photo.jpg")}
          uploaderName={(p) => profilesById[p.uploader_id]?.username ?? "—"}
        />

        {/* Move dialog */}
        <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Move to album</DialogTitle></DialogHeader>
            <Select value={moveTarget} onValueChange={setMoveTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No album (main feed)</SelectItem>
                {albums.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} {a.is_shared ? "" : "(private)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setMoveOpen(false)}>Cancel</Button>
              <Button onClick={bulkMove}>Move</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ---- View: top level (tabs) ----
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl tracking-widest text-primary">GALLERY</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="size-4" /> Album
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New album</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Album name"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <span className="text-sm">Shared with partner</span>
                <Switch checked={newAlbumShared} onCheckedChange={setNewAlbumShared} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={createAlbum}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="all">All Photos</TabsTrigger>
          <TabsTrigger value="albums">Albums</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3">
          {renderSelectionBar()}
          <UploadButton fileRef={fileRef} onPick={onUploadFiles} />
          <PhotoGrid photos={photos} renderTile={(p) => <PhotoTile p={p} key={p.id} />} />
        </TabsContent>

        <TabsContent value="albums">
          {albums.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">No albums yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {albums.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setOpenAlbum(a)}
                  className="parchment-card rounded-2xl p-4 text-left hover:bg-accent/30 transition-colors min-h-[88px]"
                >
                  <p className="font-display text-sm tracking-widest truncate">{a.name}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                    {a.is_shared ? "shared" : "private"} · @{profilesById[a.owner_id]?.username ?? "—"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PhotoViewer
        photos={photos}
        signed={signed}
        viewerId={viewerId}
        setViewerId={setViewerId}
        canDelete={canDeletePhoto}
        onDelete={async (p) => {
          await deletePhoto(p);
          setViewerId(null);
          load();
        }}
        onDownload={(p) => signed[p.id] && downloadFromUrl(signed[p.id], p.storage_path.split("/").pop() ?? "photo.jpg")}
        uploaderName={(p) => profilesById[p.uploader_id]?.username ?? "—"}
      />
    </div>
  );
}

function UploadButton({
  fileRef,
  onPick,
  label = "Upload photos",
}: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  onPick: (f: FileList | null) => void;
  label?: string;
}) {
  return (
    <div>
      <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
        <Upload className="size-4" /> {label}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
    </div>
  );
}

function PhotoGrid({ photos, renderTile }: { photos: Photo[]; renderTile: (p: Photo) => React.ReactNode }) {
  if (photos.length === 0) return <p className="text-center text-xs text-muted-foreground py-8">No photos yet.</p>;
  return <div className="grid grid-cols-3 gap-2">{photos.map(renderTile)}</div>;
}

function PhotoViewer({
  photos,
  signed,
  viewerId,
  setViewerId,
  canDelete,
  onDelete,
  onDownload,
  uploaderName,
}: {
  photos: Photo[];
  signed: Record<string, string>;
  viewerId: string | null;
  setViewerId: (id: string | null) => void;
  canDelete: (p: Photo) => boolean;
  onDelete: (p: Photo) => void;
  onDownload: (p: Photo) => void;
  uploaderName: (p: Photo) => string;
}) {
  const photo = photos.find((p) => p.id === viewerId);
  return (
    <Dialog open={!!photo} onOpenChange={(o) => !o && setViewerId(null)}>
      <DialogContent className="max-w-3xl p-2 bg-background">
        {photo && signed[photo.id] && (
          <div className="space-y-2">
            <div className="relative w-full h-[70vh] bg-black/80 rounded-lg overflow-hidden flex items-center justify-center">
              <img
                src={signed[photo.id]}
                alt=""
                className="max-w-full max-h-full w-auto h-auto object-contain"
                style={{ touchAction: "pinch-zoom" }}
                draggable={false}
              />
              <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-white/70 font-display tracking-wider px-2 py-0.5 rounded bg-black/40">
                @{uploaderName(photo)}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setViewerId(null)}>
                <X className="size-4" /> Close
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onDownload(photo)}>
                  <Download className="size-4" /> Download
                </Button>
                {canDelete(photo) && (
                  <Button variant="destructive" size="sm" onClick={() => onDelete(photo)}>
                    <Trash2 className="size-4" /> Delete
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
