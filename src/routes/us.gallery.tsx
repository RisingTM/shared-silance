import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { UsLockGate } from "@/components/UsLockGate";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronLeft, Download, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { PinchZoomImage } from "@/components/PinchZoomImage";

export const Route = createFileRoute("/us/gallery")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <UsLockGate>
          <Gallery />
        </UsLockGate>
      </AppShell>
    </RequireAuth>
  ),
});

type Album = { id: string; name: string; is_shared: boolean; owner_id: string; created_at: string };
type Photo = { id: string; storage_path: string; album_id: string | null; uploader_id: string; sort_order: number; created_at: string };

function Gallery() {
  const { user, journey, profile } = useSession();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [newAlbumName, setNewAlbumName] = useState("");
  const [newAlbumShared, setNewAlbumShared] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isOwner = profile?.role === "owner";

  const load = async () => {
    if (!journey) return;
    const [{ data: a }, { data: p }] = await Promise.all([
      supabase.from("us_albums").select("*").eq("journey_id", journey.id).order("created_at", { ascending: false }),
      supabase.from("us_photos").select("*").eq("journey_id", journey.id).is("album_id", null).order("sort_order", { ascending: true }).order("created_at", { ascending: false }),
    ]);
    setAlbums((a as Album[]) ?? []);
    setAllPhotos((p as Photo[]) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [journey?.id]);

  const loadAlbumPhotos = async (id: string) => {
    if (!journey) return;
    const { data } = await supabase
      .from("us_photos").select("*")
      .eq("journey_id", journey.id).eq("album_id", id)
      .order("sort_order", { ascending: true }).order("created_at", { ascending: false });
    setAllPhotos((data as Photo[]) ?? []);
  };

  // Sign URLs for visible photos
  useEffect(() => {
    const missing = allPhotos.filter((p) => !signed[p.id]);
    if (missing.length === 0) return;
    (async () => {
      const next: Record<string, string> = { ...signed };
      for (const p of missing) {
        const { data } = await supabase.storage.from("us-gallery").createSignedUrl(p.storage_path, 60 * 60);
        if (data?.signedUrl) next[p.id] = data.signedUrl;
      }
      setSigned(next);
    })();
    /* eslint-disable-next-line */
  }, [allPhotos]);

  const createAlbum = async () => {
    if (!journey || !user || !newAlbumName.trim()) return;
    const { error } = await supabase.from("us_albums").insert({
      journey_id: journey.id, owner_id: user.id, name: newAlbumName.trim(), is_shared: newAlbumShared,
    });
    if (error) return toast.error(error.message);
    setNewAlbumName(""); setNewAlbumShared(true); setCreateOpen(false);
    load();
  };

  const onUploadFiles = async (files: FileList | null) => {
    if (!files || !journey || !user) return;
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${journey.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("us-gallery").upload(path, file, {
        cacheControl: "3600", upsert: false,
      });
      if (upErr) { toast.error(upErr.message); continue; }
      const { error: insErr } = await supabase.from("us_photos").insert({
        journey_id: journey.id, uploader_id: user.id,
        album_id: openAlbum?.id ?? null, storage_path: path,
        sort_order: Date.now(),
      });
      if (insErr) toast.error(insErr.message);
    }
    if (openAlbum) await loadAlbumPhotos(openAlbum.id); else await load();
    toast.success("Uploaded");
  };

  const deletePhoto = async (p: Photo) => {
    const canDelete = p.uploader_id === user?.id || isOwner;
    if (!canDelete) return toast.error("You can only delete your own uploads");
    await supabase.storage.from("us-gallery").remove([p.storage_path]).catch(() => undefined);
    const { error } = await supabase.from("us_photos").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    if (openAlbum) loadAlbumPhotos(openAlbum.id); else load();
  };

  const deleteAlbum = async (a: Album) => {
    if (!confirm(`Delete album "${a.name}"? Photos inside will also be removed.`)) return;
    const { data: ps } = await supabase.from("us_photos").select("storage_path").eq("album_id", a.id);
    if (ps?.length) await supabase.storage.from("us-gallery").remove(ps.map((p: any) => p.storage_path)).catch(() => undefined);
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

  const downloadPhoto = async (p: Photo) => {
    const url = signed[p.id];
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = p.storage_path.split("/").pop() ?? "photo.jpg";
    document.body.appendChild(a); a.click(); a.remove();
  };

  if (openAlbum) {
    const photos = allPhotos.filter((p) => p.album_id === openAlbum.id);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setOpenAlbum(null); load(); }}>
            <ChevronLeft className="size-4" /> Back
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
        <h2 className="font-display text-2xl tracking-widest text-primary text-center">{openAlbum.name}</h2>
        <UploadButton fileRef={fileRef} onPick={onUploadFiles} />
        <PhotoGrid photos={photos} signed={signed} onOpen={setViewerId} />
        <PhotoViewer photos={photos} signed={signed} viewerId={viewerId} setViewerId={setViewerId} canDelete={(p) => p.uploader_id === user?.id || isOwner} onDelete={deletePhoto} onDownload={downloadPhoto} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/us" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> Us
        </Link>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="size-4" /> Album</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New album</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Album name" value={newAlbumName} onChange={(e) => setNewAlbumName(e.target.value)} />
              <div className="flex items-center justify-between">
                <span className="text-sm">Shared with partner</span>
                <Switch checked={newAlbumShared} onCheckedChange={setNewAlbumShared} />
              </div>
            </div>
            <DialogFooter><Button onClick={createAlbum}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <h2 className="font-display text-3xl tracking-widest text-primary text-center">GALLERY</h2>

      {albums.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {albums.map((a) => (
            <button
              key={a.id}
              onClick={() => { setOpenAlbum(a); loadAlbumPhotos(a.id); }}
              className="parchment-card rounded-2xl p-4 text-left hover:bg-accent/30 transition-colors min-h-[88px]"
            >
              <p className="font-display text-sm tracking-widest truncate">{a.name}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                {a.is_shared ? "shared" : "private"}
              </p>
            </button>
          ))}
        </div>
      )}

      <UploadButton fileRef={fileRef} onPick={onUploadFiles} label="Add to main feed" />
      <PhotoGrid photos={allPhotos} signed={signed} onOpen={setViewerId} />
      <PhotoViewer photos={allPhotos} signed={signed} viewerId={viewerId} setViewerId={setViewerId} canDelete={(p) => p.uploader_id === user?.id || isOwner} onDelete={deletePhoto} onDownload={downloadPhoto} />
    </div>
  );
}

function UploadButton({ fileRef, onPick, label = "Upload photos" }: {
  fileRef: React.RefObject<HTMLInputElement | null>; onPick: (f: FileList | null) => void; label?: string;
}) {
  return (
    <div>
      <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
        <Upload className="size-4" /> {label}
      </Button>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
    </div>
  );
}

function PhotoGrid({ photos, signed, onOpen }: {
  photos: Photo[]; signed: Record<string, string>; onOpen: (id: string) => void;
}) {
  if (photos.length === 0)
    return <p className="text-center text-xs text-muted-foreground py-8">No photos yet.</p>;
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((p) => (
        <button
          key={p.id}
          onClick={() => onOpen(p.id)}
          className="aspect-square rounded-lg overflow-hidden bg-muted/40 border border-border hover:opacity-90"
        >
          {signed[p.id] ? (
            <img src={signed[p.id]} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full animate-pulse bg-muted/60" />
          )}
        </button>
      ))}
    </div>
  );
}

function PhotoViewer({ photos, signed, viewerId, setViewerId, canDelete, onDelete, onDownload }: {
  photos: Photo[]; signed: Record<string, string>; viewerId: string | null;
  setViewerId: (id: string | null) => void;
  canDelete: (p: Photo) => boolean;
  onDelete: (p: Photo) => void;
  onDownload: (p: Photo) => void;
}) {
  const photo = photos.find((p) => p.id === viewerId);
  return (
    <Dialog open={!!photo} onOpenChange={(o) => !o && setViewerId(null)}>
      <DialogContent className="max-w-3xl p-2 bg-background">
        {photo && signed[photo.id] && (
          <div className="space-y-2">
            <div className="relative w-full h-[70vh] bg-black/80 rounded-lg overflow-hidden">
              <PinchZoomImage src={signed[photo.id]} />
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
                  <Button variant="destructive" size="sm" onClick={() => { onDelete(photo); setViewerId(null); }}>
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
